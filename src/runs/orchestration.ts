import { createHash, randomUUID } from 'node:crypto';

import {
  apexCompatibleUtcDateTimeSchema,
  type CreateRunRequest,
  type DryRunPreview,
  type ScenarioDefinition,
} from '../contracts';
import {
  createIdempotencyKeyHash,
  createRequestFingerprint,
} from '../db/idempotency';
import type { NewRunStep, Run, RunRepository } from '../db/run-repository';
import type { SalesforceTestDataAdapter } from '../salesforce/test-data-adapter';
import { scenarioCatalog } from '../scenarios/catalog';
import { renderScenarioFixture } from '../scenarios/renderer';
import type { Scheduler } from './scheduler';
import { createSalesforceLifecycleService } from './salesforce-lifecycle';

export type RunServiceErrorCode =
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_VARIABLES'
  | 'SCENARIO_NOT_READY'
  | 'SCHEDULER_NOT_CONFIGURED'
  | 'SCHEDULING_FAILED'
  | 'TEST_DATA_SETUP_FAILED'
  | 'SALESFORCE_DISPATCH_DISABLED'
  | 'SALESFORCE_TEST_DATA_DISABLED';

export class RunServiceError extends Error {
  constructor(
    readonly code: RunServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RunServiceError';
  }
}

export interface CreateRunServiceResult {
  outcome: 'CREATED' | 'REPLAY';
  run: Run;
  preview?: DryRunPreview;
}

type ServiceDependencies = {
  repository: RunRepository;
  scheduler?: Scheduler;
  idempotencyPepper: string;
  requestedBy: string;
  now?: () => Date;
  generateRunId?: () => string;
  testDataEnabled?: boolean;
  dispatchMode?: 'FAKE' | 'SALESFORCE';
  testDataAdapter?: SalesforceTestDataAdapter;
};

function isDeclaredValueValid(
  declaration: ScenarioDefinition['variablesSchema']['properties'][string],
  value: unknown,
): boolean {
  if (declaration.type === 'string') {
    return (
      typeof value === 'string' &&
      (declaration.minLength === undefined ||
        value.length >= declaration.minLength) &&
      (declaration.maxLength === undefined ||
        value.length <= declaration.maxLength) &&
      (declaration.enum === undefined || declaration.enum.includes(value))
    );
  }
  if (declaration.type === 'boolean') return typeof value === 'boolean';
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (declaration.type === 'integer' && !Number.isInteger(value))
  ) {
    return false;
  }
  return (
    (declaration.minimum === undefined || value >= declaration.minimum) &&
    (declaration.maximum === undefined || value <= declaration.maximum)
  );
}

function validateVariables(
  definition: ScenarioDefinition,
  variables: Record<string, unknown>,
): void {
  const declarations = definition.variablesSchema.properties;
  const names = Object.keys(variables);
  const valid =
    definition.variablesSchema.required.every((name) => name in variables) &&
    (definition.variablesSchema.additionalProperties ||
      names.every((name) => name in declarations)) &&
    names.every((name) => {
      const declaration = declarations[name];
      return (
        declaration !== undefined &&
        isDeclaredValueValid(declaration, variables[name])
      );
    });

  if (!valid) {
    throw new RunServiceError(
      'INVALID_VARIABLES',
      'Variables do not match the scenario schema',
    );
  }
}

function seedAsInteger(seed: string): number {
  return Number.parseInt(
    createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 7),
    16,
  );
}

function deriveSteps(
  fixture: ReturnType<typeof renderScenarioFixture>,
  dryRun: boolean,
  speed: number,
  testDataEnabled: boolean,
): NewRunStep[] {
  const eventStart = Date.parse(fixture.eventStartAt);
  const nonDispatchStatus =
    testDataEnabled && !dryRun ? ('PENDING' as const) : ('SKIPPED' as const);
  const dispatchStatus = dryRun ? ('SKIPPED' as const) : ('PENDING' as const);
  let ordinal = 0;
  // The Salesforce test data adapter processes every fixture.setup
  // instruction atomically in a single adapter.setup() call, so a single
  // "setup" lifecycle step is claimed/completed regardless of how many
  // setup instructions the fixture declares. Deriving one row per
  // instruction here would leave every row after the first permanently
  // PENDING (only the lowest-ordinal row of a given stepKind is ever
  // claimed), which blocks all later steps via the OUT_OF_ORDER guard.
  const setup: NewRunStep[] = [
    {
      stepKey: 'setup-1',
      ordinal: ordinal++,
      target: 'ACCOUNT',
      status: nonDispatchStatus,
      requestRedacted: {
        operations: fixture.setup.map(({ operation }) => operation),
        target: 'ACCOUNT',
      },
      responseRedacted: {},
      stepKind: 'SETUP' as const,
    },
  ];
  const dispatch = fixture.steps.map((step) => ({
    stepKey: step.key,
    ordinal: ordinal++,
    target: step.target,
    eventType: step.eventType,
    status: dispatchStatus,
    scheduledAt: new Date(eventStart + step.delayMs / speed),
    eventEnvelope: step.envelope,
    requestRedacted: {
      eventId: step.envelope[0].id,
      eventType: step.eventType,
    },
    responseRedacted: {},
    stepKind: 'DISPATCH' as const,
  }));
  const verify = fixture.expectedOutcomes.map((outcome, index) => ({
    stepKey: `verify-${index + 1}`,
    ordinal: ordinal++,
    target: 'SALESFORCE',
    status: nonDispatchStatus,
    requestRedacted: {
      kind: outcome.kind,
      checks: [...outcome.checks],
    },
    responseRedacted: {},
    stepKind: 'VERIFY' as const,
  }));
  // Same reasoning as setup above: adapter.cleanup() processes every
  // fixture.cleanup instruction atomically in a single call, so it must be
  // represented as a single lifecycle step regardless of instruction count.
  const cleanup: NewRunStep[] = [
    {
      stepKey: 'cleanup-1',
      ordinal: ordinal++,
      target: fixture.cleanup[0]!.target,
      status: nonDispatchStatus,
      requestRedacted: {
        operations: fixture.cleanup.map(({ operation, target }) => ({
          operation,
          target,
        })),
      },
      responseRedacted: {},
      stepKind: 'CLEANUP' as const,
    },
  ];
  return [...setup, ...dispatch, ...verify, ...cleanup];
}

function createPreview(
  fixture: ReturnType<typeof renderScenarioFixture>,
  speed: number,
): DryRunPreview {
  const eventStart = Date.parse(fixture.eventStartAt);
  return {
    eventStartAt: fixture.eventStartAt,
    setup: fixture.setup.map(({ operation }) => ({
      operation,
      target: 'ACCOUNT',
    })),
    steps: fixture.steps.map(({ key, target, eventType, delayMs }) => ({
      key,
      target,
      eventType,
      scheduledAt: new Date(eventStart + delayMs / speed).toISOString(),
    })),
    assertions: fixture.expectedOutcomes.map(({ kind, checks }) => ({
      kind,
      checks: checks.map((check) =>
        typeof check === 'string' ? check : check.check,
      ),
    })),
    cleanup: fixture.cleanup.map(({ operation, target }) => ({
      operation,
      target,
    })),
  };
}

export function createRunOrchestrationService(
  dependencies: ServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());
  const generateRunId = dependencies.generateRunId ?? randomUUID;

  return {
    async createRun(input: {
      idempotencyKey: string;
      request: CreateRunRequest;
    }): Promise<CreateRunServiceResult> {
      if (
        !input.request.execution.dryRun &&
        dependencies.scheduler === undefined
      ) {
        throw new RunServiceError(
          'SCHEDULER_NOT_CONFIGURED',
          'Scheduler is not configured',
        );
      }
      const definition = scenarioCatalog.get(
        input.request.scenarioKey,
        input.request.scenarioVersion,
      );
      if (definition?.availability !== 'READY') {
        throw new RunServiceError(
          'SCENARIO_NOT_READY',
          'Scenario or version is not ready',
        );
      }
      validateVariables(
        definition as ScenarioDefinition,
        input.request.variables,
      );
      const seed = input.request.variables.seed;
      const eventStartAt = input.request.variables.eventStartAt;
      if (
        typeof seed !== 'string' ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(seed) ||
        typeof eventStartAt !== 'string' ||
        !apexCompatibleUtcDateTimeSchema.safeParse(eventStartAt).success
      ) {
        throw new RunServiceError(
          'INVALID_VARIABLES',
          'Variables do not match the renderer contract',
        );
      }

      const runId = generateRunId();
      const fixture = renderScenarioFixture({
        scenarioKey: input.request.scenarioKey,
        version: input.request.scenarioVersion,
        seed,
        runId: `run_${runId.replaceAll('-', '')}`,
        eventStartAt,
      });
      const steps = deriveSteps(
        fixture,
        input.request.execution.dryRun,
        input.request.execution.speed,
        dependencies.testDataEnabled === true,
      );
      const createdAt = now();
      const normalizedRequest = {
        ...input.request,
        variables: {
          ...input.request.variables,
          eventStartAt: new Date(eventStartAt).toISOString(),
        },
      };
      const result = await dependencies.repository.createRun({
        run: {
          id: runId,
          scenarioKey: definition.key,
          scenarioVersion: definition.version,
          idempotencyKeyHash: createIdempotencyKeyHash(
            input.idempotencyKey,
            dependencies.idempotencyPepper,
          ),
          requestFingerprint: createRequestFingerprint(normalizedRequest),
          requestedBy: dependencies.requestedBy,
          seed: seedAsInteger(seed),
          variablesRedacted: {
            keys: Object.keys(input.request.variables).sort(),
          },
          fixtureSnapshot: fixture,
          dryRun: input.request.execution.dryRun,
          stopOnFailure: input.request.execution.stopOnFailure,
          expectedCallbackMin: fixture.asyncPolicy.expectedCallbacks.min,
          expectedCallbackMax: fixture.asyncPolicy.expectedCallbacks.max,
          asyncWaitDeadline:
            fixture.asyncPolicy.waitTimeoutMs === 0
              ? null
              : new Date(
                  Date.parse(fixture.eventStartAt) +
                    fixture.asyncPolicy.waitTimeoutMs,
                ),
          cleanupPolicy: 'ALWAYS',
          dispatchMode: dependencies.dispatchMode ?? 'FAKE',
          testDataEnabled: dependencies.testDataEnabled === true,
          retentionExpiresAt: new Date(
            createdAt.getTime() + 7 * 24 * 60 * 60 * 1_000,
          ),
        },
        steps,
      });

      if (result.outcome === 'CONFLICT') {
        throw new RunServiceError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used with a different request',
        );
      }
      if (
        !input.request.execution.dryRun &&
        result.run.dispatchMode === 'SALESFORCE' &&
        dependencies.dispatchMode !== 'SALESFORCE'
      ) {
        throw new RunServiceError(
          'SALESFORCE_DISPATCH_DISABLED',
          'Salesforce dispatch is temporarily disabled',
        );
      }
      if (
        !input.request.execution.dryRun &&
        result.run.testDataEnabled &&
        dependencies.testDataEnabled !== true
      ) {
        throw new RunServiceError(
          'SALESFORCE_TEST_DATA_DISABLED',
          'Salesforce test data lifecycle is temporarily disabled',
        );
      }
      if (
        !input.request.execution.dryRun &&
        result.run.testDataEnabled &&
        dependencies.testDataAdapter === undefined
      ) {
        throw new RunServiceError(
          'TEST_DATA_SETUP_FAILED',
          'Salesforce test data adapter is not configured',
        );
      }
      let responseRun = result.run;
      if (
        !input.request.execution.dryRun &&
        dependencies.scheduler &&
        (result.outcome === 'CREATED' ||
          ['PROVISIONING', 'FAILED', 'PARTIAL', 'SCHEDULED'].includes(
            result.run.status,
          ))
      ) {
        const claim = await dependencies.repository.claimInitialScheduling({
          runId: result.run.id,
          actor: dependencies.requestedBy,
          recovery: result.outcome === 'REPLAY',
        });
        if (claim.outcome === 'CLAIMED') {
          if (
            result.run.testDataEnabled &&
            dependencies.testDataAdapter !== undefined
          ) {
            const setup = await createSalesforceLifecycleService({
              repository: dependencies.repository,
              adapter: dependencies.testDataAdapter,
              actor: dependencies.requestedBy,
              now,
            }).setup(result.run.id);
            if (
              setup.outcome === 'FAILED' ||
              (setup.outcome === 'TERMINAL' && !setup.succeeded)
            ) {
              throw new RunServiceError(
                'TEST_DATA_SETUP_FAILED',
                'Salesforce test data setup failed',
              );
            }
            if (setup.outcome !== 'SUCCEEDED' && setup.outcome !== 'TERMINAL') {
              responseRun =
                (await dependencies.repository.findRun(result.run.id)) ??
                result.run;
              return { outcome: result.outcome, run: responseRun };
            }
          }
          const persistedSteps = (
            await dependencies.repository.listSteps(result.run.id, {
              limit: 100,
            })
          ).items;
          const fixtureStepsByKey = new Map(
            fixture.steps.map((step) => [step.key, step]),
          );
          try {
            await dependencies.scheduler.schedule({
              runId: result.run.id,
              steps: persistedSteps
                .filter(
                  ({ stepKind, status, qstashMessageId }) =>
                    stepKind === 'DISPATCH' &&
                    status === 'PENDING' &&
                    qstashMessageId === null,
                )
                .map(({ id, stepKey, ordinal, attemptCount }) => ({
                  stepId: id,
                  stepKey,
                  ordinal,
                  delayMs:
                    (fixtureStepsByKey.get(stepKey)?.delayMs ?? 0) /
                    input.request.execution.speed,
                  attemptNumber: Math.max(1, attemptCount),
                })),
            });
          } catch {
            if (
              responseRun.testDataEnabled &&
              dependencies.testDataAdapter !== undefined
            ) {
              await createSalesforceLifecycleService({
                repository: dependencies.repository,
                adapter: dependencies.testDataAdapter,
                actor: dependencies.requestedBy,
                now,
              }).compensate(result.run.id);
            }
            throw new RunServiceError(
              'SCHEDULING_FAILED',
              'Run was persisted but QStash scheduling failed',
            );
          }
        }
      }
      if (!input.request.execution.dryRun) {
        responseRun =
          (await dependencies.repository.findRun(result.run.id)) ?? result.run;
      }

      const responseFixture =
        result.outcome === 'REPLAY' && result.run.id !== runId
          ? renderScenarioFixture({
              scenarioKey: input.request.scenarioKey,
              version: input.request.scenarioVersion,
              seed,
              runId: `run_${result.run.id.replaceAll('-', '')}`,
              eventStartAt,
            })
          : fixture;
      return {
        outcome: result.outcome,
        run: responseRun,
        ...(input.request.execution.dryRun
          ? {
              preview: createPreview(
                responseFixture,
                input.request.execution.speed,
              ),
            }
          : {}),
      };
    },
  };
}
