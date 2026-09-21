import { createHash } from 'node:crypto';

import { z } from 'zod';

import { apexCompatibleUtcDateTimeSchema } from '../contracts/event-grid.ts';
import {
  renderedScenarioFixtureSchema,
  type RenderedScenarioFixture,
} from '../contracts/fixtures.ts';
import { generateSyntheticCpf } from '../synthetic/cpf.ts';
import { scenarioCatalog } from './catalog.ts';

const renderInputSchema = z
  .object({
    scenarioKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.number().int().positive(),
    seed: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    runId: z.string().regex(/^run_[A-Za-z0-9_-]{1,64}$/),
    eventStartAt: apexCompatibleUtcDateTimeSchema,
  })
  .strict();

export type RenderScenarioFixtureInput = z.input<typeof renderInputSchema>;

type GeneratedValue =
  | 'RUN_ID'
  | 'STEP_ID'
  | 'EVENT_ID'
  | 'EVENT_TIME'
  | 'BASELINE_TIME'
  | 'CLIENT_ID'
  | 'CLIENT_ID_X'
  | 'PROSPECT_ID'
  | 'PROSPECT_ID_X'
  | 'CPF'
  | 'CPF_X'
  | 'PERSON_NAME'
  | 'BASE_PERSON_NAME';

type RenderContext = Readonly<Record<GeneratedValue, string>>;

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeUtc(value: string): string {
  return new Date(value).toISOString();
}

function isGeneratedReference(
  value: unknown,
): value is { source: 'GENERATED'; value: GeneratedValue } {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).length === 2 &&
    'source' in value &&
    value.source === 'GENERATED' &&
    'value' in value &&
    typeof value.value === 'string'
  );
}

function resolveTemplate(value: unknown, context: RenderContext): unknown {
  if (isGeneratedReference(value)) return context[value.value];
  if (Array.isArray(value))
    return value.map((item) => resolveTemplate(item, context));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveTemplate(item, context),
      ]),
    );
  }
  return value;
}

export function renderScenarioFixture(
  candidate: RenderScenarioFixtureInput,
): RenderedScenarioFixture {
  const input = renderInputSchema.parse(candidate);
  const definition = scenarioCatalog.get(input.scenarioKey, input.version);
  if (!definition || definition.availability !== 'READY') {
    throw new Error('Scenario fixture is not available');
  }

  const eventStartAt = normalizeUtc(input.eventStartAt);
  const seedToken = digest(`seed|${input.seed}`).slice(0, 10);
  const namespaceToken = digest(`run|${input.runId}`).slice(0, 10);
  const accountIdCliente = `CLI-SIM-${namespaceToken}-${seedToken}`;
  const accountIdProspect = `PRO-SIM-${namespaceToken}-${seedToken}`;
  const syntheticCpf = generateSyntheticCpf(input.seed, input.runId);
  const controlAccountIdCliente = `CLI-SIM-X-${namespaceToken}-${seedToken}`;
  const controlAccountIdProspect = `PRO-SIM-X-${namespaceToken}-${seedToken}`;
  const controlSyntheticCpf = generateSyntheticCpf(
    `${input.seed}:x`,
    input.runId,
  );
  const baseContext = {
    RUN_ID: input.runId,
    STEP_ID: '',
    EVENT_ID: '',
    EVENT_TIME: eventStartAt,
    BASELINE_TIME: new Date(Date.parse(eventStartAt) - 1_000).toISOString(),
    CLIENT_ID: accountIdCliente,
    CLIENT_ID_X: controlAccountIdCliente,
    PROSPECT_ID: accountIdProspect,
    PROSPECT_ID_X: controlAccountIdProspect,
    CPF: syntheticCpf,
    CPF_X: controlSyntheticCpf,
    PERSON_NAME: `Cliente Simulado ${seedToken}`,
    BASE_PERSON_NAME: `Cliente Simulado Base ${seedToken}`,
  } satisfies RenderContext;
  const hasControlAccount =
    definition.setup?.some(
      (instruction) =>
        instruction.operation === 'CREATE_SYNTHETIC_ACCOUNT' &&
        instruction.role === 'CONTROL',
    ) ?? false;

  const setup = resolveTemplate(definition.setup ?? [], baseContext);
  const steps = definition.steps.map((step) => {
    if (
      step.target !== 'CLIENTE' ||
      step.payloadTemplate.kind !== 'DECLARATIVE'
    )
      throw new Error(
        'Core fixture step must be declarative and target CLIENTE',
      );

    const scheduledAt = new Date(
      Date.parse(eventStartAt) + step.delayMs,
    ).toISOString();
    const stepToken = digest(`step|${step.key}`).slice(0, 8);
    const context = {
      ...baseContext,
      STEP_ID: `step_${namespaceToken}_${stepToken}`,
      EVENT_ID: `EVT-SIM-${namespaceToken}-${stepToken}`,
      EVENT_TIME: scheduledAt,
    } satisfies RenderContext;
    const event = resolveTemplate(step.payloadTemplate.value, context);

    return {
      key: step.key,
      target: step.target,
      eventType: step.eventType,
      delayMs: step.delayMs,
      scheduledAt,
      deliveryPolicy: {
        duplicateCount: step.deliveryPolicy.duplicateCount,
        retryOn: [...step.deliveryPolicy.retryOn],
        maxAttempts: step.deliveryPolicy.maxAttempts,
      },
      envelope: [event],
    };
  });
  const cleanup = (definition.cleanup ?? []).map((instruction) => {
    if (instruction.target === 'LEAD') {
      return {
        operation: instruction.operation,
        target: instruction.target,
        ownership: { idExternoPrefix: 'LEAD-SIM-' as const },
      };
    }

    return {
      operation: instruction.operation,
      target: instruction.target,
      ownership:
        instruction.target === 'ACCOUNT' && hasControlAccount
          ? {
              idCliente: accountIdCliente,
              controlAccountIdCliente,
            }
          : { idCliente: accountIdCliente },
    };
  });
  const expectedOutcomes = definition.expectedOutcomes.map((outcome) => ({
    ...outcome,
    checks: [...outcome.checks],
  }));
  const asyncPolicy = {
    expectedCallbacks: { ...definition.asyncPolicy.expectedCallbacks },
    waitTimeoutMs: definition.asyncPolicy.waitTimeoutMs,
    missingCallbackResult: definition.asyncPolicy.missingCallbackResult,
  };
  const fixture = {
    scenarioKey: definition.key,
    version: definition.version,
    seed: input.seed,
    runId: input.runId,
    eventStartAt,
    identifiers: {
      accountIdCliente,
      accountIdProspect,
      ...(hasControlAccount
        ? {
            controlAccountIdCliente,
            controlAccountIdProspect,
          }
        : {}),
      leadIdExterno: accountIdProspect,
    },
    setup,
    steps,
    expectedOutcomes,
    asyncPolicy,
    cleanup,
  };
  return renderedScenarioFixtureSchema.parse(fixture);
}
