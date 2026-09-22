import { describe, expect, it, vi } from 'vitest';

import type {
  ClaimLifecycleStepResult,
  CreateRunInput,
  CreateRunResult,
  AuditEvent,
  DispatchPayload,
  Run,
  RunPage,
  RunRepository,
  RunStep,
  RunStepPage,
} from '../db/run-repository';
import type { SalesforceTestDataAdapter } from '../salesforce/test-data-adapter';
import { scenarioCatalog } from '../scenarios/catalog';
import { createRunOrchestrationService } from './orchestration';
import type { Scheduler } from './scheduler';

const now = new Date('2026-08-22T12:00:00.000Z');
const runId = '11111111-1111-4111-8111-111111111111';
const request = {
  scenarioKey: 'match-id-cliente',
  scenarioVersion: 1,
  variables: {
    seed: 'TC001-A',
    eventStartAt: '2026-08-21T10:00:00Z',
  },
  execution: { dryRun: true, speed: 1, stopOnFailure: true },
} as const;

class MemoryRunRepository implements RunRepository {
  readonly runs: Run[] = [];
  readonly steps = new Map<string, RunStep[]>();
  readonly audits: Array<{
    action: string;
    metadataRedacted: Record<string, unknown>;
  }> = [];

  async createRun(input: CreateRunInput): Promise<CreateRunResult> {
    const existing = this.runs.find(
      (run) =>
        run.requestedBy === input.run.requestedBy &&
        run.idempotencyKeyHash === input.run.idempotencyKeyHash,
    );
    if (existing) {
      return {
        outcome:
          existing.requestFingerprint === input.run.requestFingerprint
            ? 'REPLAY'
            : 'CONFLICT',
        run: existing,
      };
    }

    const persisted: Run = {
      ...input.run,
      status: input.run.status ?? 'CREATED',
      asyncWaitDeadline: input.run.asyncWaitDeadline ?? null,
      startedAt: input.run.startedAt ?? null,
      finishedAt: input.run.finishedAt ?? null,
      schedulingKind: input.run.schedulingKind ?? null,
      schedulingLeaseExpiresAt: input.run.schedulingLeaseExpiresAt ?? null,
      dispatchMode: input.run.dispatchMode ?? 'FAKE',
      testDataEnabled: input.run.testDataEnabled ?? false,
      createdAt: now,
    };
    this.runs.push(persisted);
    this.steps.set(
      persisted.id,
      input.steps.map((step, index) => ({
        ...step,
        id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
        runId: persisted.id,
        eventType: step.eventType ?? null,
        eventEnvelope: step.eventEnvelope ?? null,
        scheduledAt: step.scheduledAt ?? null,
        startedAt: step.startedAt ?? null,
        finishedAt: step.finishedAt ?? null,
        httpStatus: step.httpStatus ?? null,
        durationMs: step.durationMs ?? null,
        attemptCount: step.attemptCount ?? 0,
        qstashMessageId: step.qstashMessageId ?? null,
        errorCode: step.errorCode ?? null,
        schedulingKind: step.schedulingKind ?? null,
        schedulingLeaseExpiresAt: step.schedulingLeaseExpiresAt ?? null,
        lifecycleClaimId: step.lifecycleClaimId ?? null,
      })),
    );
    return { outcome: 'CREATED', run: persisted };
  }

  async findRun(candidate: string): Promise<Run | null> {
    return this.runs.find(({ id }) => id === candidate) ?? null;
  }

  async listRuns(): Promise<RunPage> {
    return { items: this.runs, total: this.runs.length, hasMore: false };
  }

  async listSteps(candidate: string): Promise<RunStepPage> {
    const items = this.steps.get(candidate) ?? [];
    return { items, total: items.length, hasMore: false };
  }

  async appendAuditEvent(
    event: Omit<AuditEvent, 'id' | 'createdAt'>,
  ): Promise<AuditEvent> {
    this.audits.push(event);
    return {
      ...event,
      id: '33333333-3333-4333-8333-333333333333',
      createdAt: now,
    };
  }

  listAuditEvents(): never {
    throw new Error('not used');
  }

  async findCorrelatableRun(): Promise<
    Awaited<ReturnType<RunRepository['findCorrelatableRun']>>
  > {
    return null;
  }

  async recordGraphqlCallback(): Promise<
    Awaited<ReturnType<RunRepository['recordGraphqlCallback']>>
  > {
    throw new Error('not used');
  }

  beginCancellation(): never {
    throw new Error('not used');
  }

  finalizeCancellation(): never {
    throw new Error('not used');
  }

  recordCancellationFailure(): never {
    throw new Error('not used');
  }

  recordCancellationProgress(): never {
    throw new Error('not used');
  }

  async claimInitialScheduling(input: {
    runId: string;
    recovery: boolean;
  }): Promise<
    | { outcome: 'CLAIMED'; previousStatus: Run['status'] }
    | { outcome: 'IN_PROGRESS' }
    | { outcome: 'NOT_RECOVERABLE' }
  > {
    const run = this.runs.find(({ id }) => id === input.runId);
    if (
      run === undefined ||
      !['CREATED', 'FAILED', 'PARTIAL', 'SCHEDULED'].includes(run.status)
    ) {
      return { outcome: 'IN_PROGRESS' };
    }
    const pending = (this.steps.get(input.runId) ?? []).filter(
      (step) =>
        step.stepKind === 'DISPATCH' &&
        step.status === 'PENDING' &&
        step.qstashMessageId === null,
    );
    if (pending.length === 0) return { outcome: 'NOT_RECOVERABLE' };
    const previousStatus = run.status;
    run.status = 'PROVISIONING';
    if (
      input.recovery &&
      run.testDataEnabled &&
      (previousStatus === 'FAILED' || previousStatus === 'PARTIAL')
    ) {
      for (const step of this.steps.get(input.runId) ?? []) {
        if (step.stepKind !== 'DISPATCH') {
          step.status = 'PENDING';
          step.startedAt = null;
          step.finishedAt = null;
          step.responseRedacted = {};
          step.errorCode = null;
          step.lifecycleClaimId = null;
        }
      }
    }
    if (input.recovery) {
      this.audits.push({
        action: 'RUN_SCHEDULING_RECOVERY_STARTED',
        metadataRedacted: {
          previousStatus,
          pendingCount: pending.length,
        },
      });
    }
    return { outcome: 'CLAIMED', previousStatus };
  }

  reserveRetries(): never {
    throw new Error('not used');
  }

  releaseRetryReservations(): never {
    throw new Error('not used');
  }

  updateRunStatus(): never {
    throw new Error('not used');
  }

  updateStepStatus(): never {
    throw new Error('not used');
  }

  recordStepScheduled(): never {
    throw new Error('not used');
  }

  markRunScheduled(): never {
    throw new Error('not used');
  }

  recordSchedulingFailure(): never {
    throw new Error('not used');
  }

  async getDispatchPayload(input: {
    runId: string;
    stepId: string;
  }): Promise<DispatchPayload | null> {
    const step = this.steps.get(input.runId)?.find(({ id }) => id === input.stepId);
    return step?.eventEnvelope === null || step?.eventEnvelope === undefined
      ? null
      : { target: step.target, envelope: step.eventEnvelope as NonNullable<RunStep['eventEnvelope']> };
  }

  claimDispatch(): never {
    throw new Error('not used');
  }

  completeDispatch(): never {
    throw new Error('not used');
  }

  async claimLifecycleStep(input: {
    runId: string;
    stepKind: 'SETUP' | 'VERIFY' | 'CLEANUP';
    claimedAt: Date;
  }): Promise<ClaimLifecycleStepResult> {
    const run = this.runs.find(({ id }) => id === input.runId);
    const step = this.steps
      .get(input.runId)
      ?.find(({ stepKind }) => stepKind === input.stepKind);
    if (run === undefined || step === undefined)
      return { outcome: 'NOT_FOUND' };
    if (step.status === 'SUCCEEDED' || step.status === 'FAILED') {
      return {
        outcome: 'TERMINAL',
        runStatus: run.status,
        stepStatus: step.status,
      };
    }
    if (step.status === 'RUNNING') return { outcome: 'IN_PROGRESS' };
    step.status = 'RUNNING';
    step.startedAt = input.claimedAt;
    step.lifecycleClaimId = '33333333-3333-4333-8333-333333333333';
    return {
      outcome: 'CLAIMED',
      claimId: step.lifecycleClaimId,
      run,
      step,
    };
  }

  async completeLifecycleStep(input: {
    runId: string;
    stepId: string;
    claimId: string;
    succeeded: boolean;
    responseRedacted: Record<string, unknown>;
    errorCode: string | null;
    finishedAt: Date;
  }): Promise<import('../db/run-repository').CompleteLifecycleStepResult> {
    const step = this.steps
      .get(input.runId)
      ?.find(({ id }) => id === input.stepId);
    if (step?.status !== 'RUNNING' || step.lifecycleClaimId !== input.claimId) {
      return { outcome: 'STALE' };
    }
    step.status = input.succeeded ? 'SUCCEEDED' : 'FAILED';
    step.responseRedacted = input.responseRedacted;
    step.errorCode = input.errorCode;
    step.finishedAt = input.finishedAt;
    step.lifecycleClaimId = null;
    return { outcome: 'COMPLETED' };
  }

  recordLifecycleCompensation(): Promise<'COMPLETED'> {
    return Promise.resolve('COMPLETED');
  }

  async finalizeLifecycleRun(input: {
    runId: string;
    finishedAt: Date;
  }): Promise<Run['status']> {
    const run = this.runs.find(({ id }) => id === input.runId);
    if (run === undefined) throw new Error('run missing');
    const setupFailed = this.steps
      .get(input.runId)
      ?.some(
        ({ stepKind, status }) => stepKind === 'SETUP' && status === 'FAILED',
      );
    run.status = setupFailed ? 'FAILED' : 'SUCCEEDED';
    run.finishedAt = input.finishedAt;
    return run.status;
  }

  listDeliveryAttempts(): never {
    throw new Error('not used');
  }
}

function createService(
  repository: RunRepository,
  scheduler?: Scheduler,
  options: {
    testDataEnabled?: boolean;
    testDataAdapter?: SalesforceTestDataAdapter;
    dispatchMode?: 'FAKE' | 'SALESFORCE';
  } = {},
) {
  return createRunOrchestrationService({
    repository,
    scheduler,
    ...options,
    dispatchMode:
      options.dispatchMode ?? (options.testDataEnabled ? 'SALESFORCE' : 'FAKE'),
    idempotencyPepper: 'p'.repeat(32),
    requestedBy: 'simulator-admin-api',
    now: () => now,
    generateRunId: () => runId,
  });
}

describe('run orchestration service', () => {
  it('renders and persists a dry run with sanitized metadata and the real dispatch envelope', async () => {
    const repository = new MemoryRunRepository();
    const scheduler = { schedule: vi.fn(), cancelPending: vi.fn() };
    const testDataAdapter = {
      setup: vi.fn(),
      verify: vi.fn(),
      cleanup: vi.fn(),
    };
    const result = await createService(repository, scheduler, {
      testDataEnabled: true,
      dispatchMode: 'SALESFORCE',
      testDataAdapter,
    }).createRun({
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request,
    });

    expect(result.outcome).toBe('CREATED');
    expect(result.run.id).toBe(runId);
    expect(result.preview?.steps).toStrictEqual([
      expect.objectContaining({
        key: 'cliente-update',
        eventType: 'cliente-update',
      }),
    ]);
    expect(scheduler.schedule).not.toHaveBeenCalled();
    expect(testDataAdapter.setup).not.toHaveBeenCalled();
    expect(testDataAdapter.verify).not.toHaveBeenCalled();
    expect(testDataAdapter.cleanup).not.toHaveBeenCalled();
    expect(repository.runs[0].variablesRedacted).toStrictEqual({
      keys: ['eventStartAt', 'seed'],
    });
    const persistedDispatch = [...repository.steps.values()]
      .flat()
      .find(({ stepKind }) => stepKind === 'DISPATCH');
    expect(persistedDispatch?.requestRedacted).toStrictEqual({
      eventId: expect.any(String),
      eventType: 'cliente-update',
      expectedHttpStatus: 200,
    });
    const eventData = persistedDispatch?.eventEnvelope?.[0].data as
      | { numerocpf?: string }
      | undefined;
    expect(eventData?.numerocpf).toMatch(/^\d{11}$/);
    expect(
      [...repository.steps.values()]
        .flat()
        .every(({ status }) => status === 'SKIPPED'),
    ).toBe(true);
  });

  it('persists scenario GraphQL response metadata when the fixture declares a callback policy', async () => {
    const graphqlPolicyDefinition = {
      ...scenarioCatalog.get('cliente-insert-prospect-divergente', 1)!,
      key: 'graphql-timeout-mock',
      graphqlResponse: {
        policy: 'DELAYED_RESPONSE',
        delayMs: 8_000,
      },
    } as const;

    vi.resetModules();
    vi.doMock('../scenarios/catalog', () => ({
      scenarioCatalog: {
        listAll: () => [graphqlPolicyDefinition],
        listActive: () => [graphqlPolicyDefinition],
        get: (key: string, version: number) =>
          key === graphqlPolicyDefinition.key &&
          version === graphqlPolicyDefinition.version
            ? graphqlPolicyDefinition
            : undefined,
        getActive: (key: string) =>
          key === graphqlPolicyDefinition.key
            ? graphqlPolicyDefinition
            : undefined,
      },
    }));

    try {
      const { createRunOrchestrationService: createMockedService } =
        await import('./orchestration');
      const repository = new MemoryRunRepository();
      const scheduler = { schedule: vi.fn(), cancelPending: vi.fn() };
      const service = createMockedService({
        repository,
        scheduler,
        idempotencyPepper: 'p'.repeat(32),
        requestedBy: 'simulator-admin-api',
        now: () => now,
        generateRunId: () => runId,
      });

      await service.createRun({
        idempotencyKey: '223e4567-e89b-12d3-a456-426614174000',
        request: {
          ...request,
          scenarioKey: 'graphql-timeout-mock',
        },
      });

      expect(repository.runs[0].variablesRedacted).toStrictEqual({
        keys: ['eventStartAt', 'seed'],
        graphqlResponsePolicy: 'DELAYED_RESPONSE',
        graphqlResponseDelayMs: 8_000,
      });
    } finally {
      vi.doUnmock('../scenarios/catalog');
      vi.resetModules();
    }
  });

  it('expands duplicateCount into deterministic redeliveries with the same envelope content', async () => {
    const duplicateScenarioDefinition = {
      key: 'evento-duplicado-mock',
      version: 1,
      name: 'Evento duplicado mockado',
      description: 'Exercita reentregas físicas do mesmo envelope.',
      scope: 'EXTENDED',
      tags: ['regression', 'o14', 'idempotencia'],
      availability: 'READY',
      variablesSchema: {
        type: 'object',
        properties: {
          seed: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
          },
          eventStartAt: {
            type: 'string',
            minLength: 20,
            maxLength: 24,
          },
        },
        required: ['seed', 'eventStartAt'],
        additionalProperties: false,
      },
      setup: [
        {
          operation: 'CREATE_SYNTHETIC_ACCOUNT',
          role: 'PRIMARY',
          matchBy: 'ID_CLIENTE',
          account: {
            idCliente: { source: 'GENERATED', value: 'CLIENT_ID' },
            idProspect: { source: 'GENERATED', value: 'PROSPECT_ID' },
            cpf: { source: 'GENERATED', value: 'CPF' },
            name: { source: 'GENERATED', value: 'BASE_PERSON_NAME' },
            dataAlteracao: { source: 'GENERATED', value: 'BASELINE_TIME' },
          },
        },
      ],
      steps: [
        {
          key: 'cliente-update',
          target: 'CLIENTE',
          eventType: 'cliente-update',
          delayMs: 0,
          payloadTemplate: {
            kind: 'DECLARATIVE',
            contract: 'EVENT_GRID',
            value: {
              id: { source: 'GENERATED', value: 'EVENT_ID' },
              subject: 'MS_Clientes',
              eventType: 'cliente-update',
              eventTime: { source: 'GENERATED', value: 'EVENT_TIME' },
              dataVersion: '1.0',
              metadataVersion: '1',
              topic: '/simulator/ms-clientes',
              data: {
                idcliente: { source: 'GENERATED', value: 'CLIENT_ID' },
                idprospectsalesforce: {
                  source: 'GENERATED',
                  value: 'PROSPECT_ID',
                },
                numerocpf: { source: 'GENERATED', value: 'CPF' },
                dataalteracao: { source: 'GENERATED', value: 'EVENT_TIME' },
                nomecompleto: { source: 'GENERATED', value: 'PERSON_NAME' },
              },
            },
          },
          deliveryPolicy: {
            duplicateCount: 1,
            retryOn: [],
            maxAttempts: 1,
          },
        },
      ],
      expectedOutcomes: [
        {
          kind: 'BUSINESS_RESULT',
          result: 'ACCOUNT_UPDATED_ONLY',
          description: 'A reentrega não deve criar efeitos adicionais.',
          checks: ['ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE'],
        },
      ],
      asyncPolicy: {
        expectedCallbacks: { min: 0, max: 0 },
        waitTimeoutMs: 0,
        missingCallbackResult: 'SUCCESS',
      },
      cleanup: [
        {
          operation: 'DELETE_OWNED_RECORDS',
          target: 'ACCOUNT',
        },
      ],
    } as const;

    vi.resetModules();
    vi.doMock('../scenarios/catalog', () => ({
      scenarioCatalog: {
        listAll: () => [duplicateScenarioDefinition],
        listActive: () => [duplicateScenarioDefinition],
        get: (key: string, version: number) =>
          key === duplicateScenarioDefinition.key &&
          version === duplicateScenarioDefinition.version
            ? duplicateScenarioDefinition
            : undefined,
        getActive: (key: string) =>
          key === duplicateScenarioDefinition.key
            ? duplicateScenarioDefinition
            : undefined,
      },
    }));

    try {
      const { createRunOrchestrationService: createMockedService } =
        await import('./orchestration');
      const repository = new MemoryRunRepository();
      const scheduler = { schedule: vi.fn(), cancelPending: vi.fn() };
      const service = createMockedService({
        repository,
        scheduler,
        idempotencyPepper: 'p'.repeat(32),
        requestedBy: 'simulator-admin-api',
        now: () => now,
        generateRunId: () => runId,
      });

      const result = await service.createRun({
        idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
        request: {
          scenarioKey: duplicateScenarioDefinition.key,
          scenarioVersion: 1,
          variables: {
            seed: 'TC001-A',
            eventStartAt: '2026-08-21T10:00:00Z',
          },
          execution: { dryRun: true, speed: 1, stopOnFailure: true },
        },
      });

      expect(result.preview?.steps).toStrictEqual([
        {
          key: 'cliente-update',
          target: 'CLIENTE',
          eventType: 'cliente-update',
          scheduledAt: '2026-08-21T10:00:00.000Z',
        },
        {
          key: 'cliente-update-redelivery-1',
          target: 'CLIENTE',
          eventType: 'cliente-update',
          scheduledAt: '2026-08-21T10:00:00.500Z',
        },
      ]);
      const dispatchSteps =
        repository.steps
          .get(runId)
          ?.filter(({ stepKind }) => stepKind === 'DISPATCH') ?? [];

      expect(
        dispatchSteps.map(({ stepKey, ordinal, scheduledAt }) => ({
          stepKey,
          ordinal,
          scheduledAt: scheduledAt?.toISOString(),
        })),
      ).toStrictEqual([
        {
          stepKey: 'cliente-update',
          ordinal: 1,
          scheduledAt: '2026-08-21T10:00:00.000Z',
        },
        {
          stepKey: 'cliente-update-redelivery-1',
          ordinal: 2,
          scheduledAt: '2026-08-21T10:00:00.500Z',
        },
      ]);
      expect(dispatchSteps[1]?.requestRedacted).toStrictEqual(
        dispatchSteps[0]?.requestRedacted,
      );
      expect(dispatchSteps[1]?.eventEnvelope).toStrictEqual(
        dispatchSteps[0]?.eventEnvelope,
      );
    } finally {
      vi.doUnmock('../scenarios/catalog');
      vi.resetModules();
    }
  });

  it('replays the original run and conflicts when the normalized body changes', async () => {
    const repository = new MemoryRunRepository();
    const service = createService(repository);
    const first = await service.createRun({
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request,
    });
    const replay = await service.createRun({
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        execution: { stopOnFailure: true, speed: 1, dryRun: true },
        variables: {
          eventStartAt: '2026-08-21T10:00:00Z',
          seed: 'TC001-A',
        },
        scenarioVersion: 1,
        scenarioKey: 'match-id-cliente',
      },
    });

    expect(replay).toMatchObject({
      outcome: 'REPLAY',
      run: { id: first.run.id },
    });
    expect(replay.preview).toStrictEqual(first.preview);
    expect(repository.runs).toHaveLength(1);

    await expect(
      service.createRun({
        idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
        request: {
          ...request,
          execution: { ...request.execution, speed: 2 },
        },
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects an unknown scenario and requires a scheduler before persisting a non-dry run', async () => {
    const repository = new MemoryRunRepository();
    const service = createService(repository);

    await expect(
      service.createRun({
        idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
        request: { ...request, scenarioKey: 'unknown-scenario' },
      }),
    ).rejects.toMatchObject({ code: 'SCENARIO_NOT_READY' });

    await expect(
      service.createRun({
        idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
        request: {
          ...request,
          execution: { ...request.execution, dryRun: false },
        },
      }),
    ).rejects.toMatchObject({ code: 'SCHEDULER_NOT_CONFIGURED' });
    expect(repository.runs).toHaveLength(0);
  });

  it('persists and schedules a non-dry run when a scheduler is injected', async () => {
    const repository = new MemoryRunRepository();
    const scheduler = {
      schedule: vi.fn().mockResolvedValue(undefined),
      cancelPending: vi.fn(),
    };
    const result = await createService(repository, scheduler).createRun({
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        ...request,
        execution: { ...request.execution, dryRun: false },
      },
    });

    expect(result.outcome).toBe('CREATED');
    expect(scheduler.schedule).toHaveBeenCalledWith({
      runId,
      steps: [
        expect.objectContaining({
          stepKey: 'cliente-update',
          delayMs: 0,
          attemptNumber: 1,
        }),
      ],
    });
    expect(
      repository.steps
        .get(runId)
        ?.filter(({ stepKind }) => stepKind !== 'DISPATCH')
        .every(({ status }) => status === 'SKIPPED'),
    ).toBe(true);
  });

  it('runs Salesforce setup before scheduling when test data is enabled', async () => {
    const repository = new MemoryRunRepository();
    const calls: string[] = [];
    const testDataAdapter = {
      setup: vi.fn().mockImplementation(async () => {
        calls.push('setup');
        return {
          status: 'CREATED',
          createdCount: 1,
          replayedCount: 0,
          recordIds: ['001000000000001AAA'],
        };
      }),
      verify: vi.fn(),
      cleanup: vi.fn().mockResolvedValue({
        status: 'DELETED',
        deletedCount: 1,
      }),
    };
    const scheduler = {
      schedule: vi.fn().mockImplementation(async () => {
        calls.push('schedule');
      }),
      cancelPending: vi.fn(),
    };

    const result = await createService(repository, scheduler, {
      testDataEnabled: true,
      dispatchMode: 'SALESFORCE',
      testDataAdapter,
    }).createRun({
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        ...request,
        execution: { ...request.execution, dryRun: false },
      },
    });

    expect(calls).toStrictEqual(['setup', 'schedule']);
    expect(result.run.fixtureSnapshot).toStrictEqual(
      repository.runs[0].fixtureSnapshot,
    );
    expect(result.run).toMatchObject({
      dispatchMode: 'SALESFORCE',
      testDataEnabled: true,
    });
    expect(
      repository.steps
        .get(runId)
        ?.filter(({ stepKind }) => stepKind !== 'DISPATCH')
        .map(({ status }) => status),
    ).toStrictEqual(['SUCCEEDED', 'PENDING', 'PENDING']);
  });

  it('derives exactly one SETUP and one CLEANUP step regardless of how many setup/cleanup instructions the fixture declares', async () => {
    // Regression: cliente-insert-prospect-divergente renders 3 setup
    // instructions and 2 cleanup instructions. claimLifecycleStep only ever
    // claims the lowest-ordinal row of a given stepKind, so deriving one row
    // per instruction left every row after the first permanently PENDING,
    // which then blocked the DISPATCH step forever via the OUT_OF_ORDER
    // guard (found via a real run against mrv-devDan in Phase 6).
    const repository = new MemoryRunRepository();
    const calls: string[] = [];
    const testDataAdapter = {
      setup: vi.fn().mockImplementation(async () => {
        calls.push('setup');
        return {
          status: 'CREATED',
          createdCount: 1,
          replayedCount: 0,
          recordIds: ['001000000000001AAA'],
        };
      }),
      verify: vi.fn(),
      cleanup: vi.fn().mockResolvedValue({
        status: 'DELETED',
        deletedCount: 2,
      }),
    };
    const scheduler = {
      schedule: vi.fn().mockImplementation(async () => {
        calls.push('schedule');
      }),
      cancelPending: vi.fn(),
    };

    const result = await createService(repository, scheduler, {
      testDataEnabled: true,
      dispatchMode: 'SALESFORCE',
      testDataAdapter,
    }).createRun({
      idempotencyKey: '223e4567-e89b-12d3-a456-426614174000',
      request: {
        scenarioKey: 'cliente-insert-prospect-divergente',
        scenarioVersion: 1,
        variables: {
          seed: 'TC-PROSPECT-DIVERGENTE',
          eventStartAt: '2026-08-21T10:00:00Z',
        },
        execution: { dryRun: false, speed: 1, stopOnFailure: true },
      },
    });

    expect(calls).toStrictEqual(['setup', 'schedule']);
    expect(result.run.status).not.toBe('FAILED');
    const stepsByKind = repository.steps
      .get(result.run.id)!
      .reduce<Record<string, number>>((counts, step) => {
        counts[step.stepKind] = (counts[step.stepKind] ?? 0) + 1;
        return counts;
      }, {});
    expect(stepsByKind.SETUP).toBe(1);
    expect(stepsByKind.CLEANUP).toBe(1);
  });

  it('does not publish QStash when Salesforce setup fails', async () => {
    const repository = new MemoryRunRepository();
    const scheduler = {
      schedule: vi.fn(),
      cancelPending: vi.fn(),
    };
    const testDataAdapter = {
      setup: vi.fn().mockRejectedValue(new Error('Salesforce unavailable')),
      verify: vi.fn(),
      cleanup: vi.fn().mockResolvedValue({ status: 'NO_OP', deletedCount: 0 }),
    };

    await expect(
      createService(repository, scheduler, {
        testDataEnabled: true,
        testDataAdapter,
      }).createRun({
        idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
        request: {
          ...request,
          execution: { ...request.execution, dryRun: false },
        },
      }),
    ).rejects.toMatchObject({ code: 'TEST_DATA_SETUP_FAILED' });

    expect(scheduler.schedule).not.toHaveBeenCalled();
    expect(testDataAdapter.cleanup).toHaveBeenCalledWith(
      expect.any(Object),
      [],
    );
    expect(repository.runs[0]).toMatchObject({ status: 'FAILED' });
  });

  it('recreates cleaned setup data while recovering QStash scheduling', async () => {
    const repository = new MemoryRunRepository();
    const testDataAdapter = {
      setup: vi.fn().mockResolvedValue({
        status: 'CREATED',
        createdCount: 1,
        replayedCount: 0,
        recordIds: ['001000000000001AAA'],
      }),
      verify: vi.fn(),
      cleanup: vi.fn().mockResolvedValue({
        status: 'DELETED',
        deletedCount: 1,
      }),
    };
    const scheduler = {
      schedule: vi
        .fn()
        .mockImplementationOnce(async () => {
          repository.runs[0]!.status = 'FAILED';
          repository.runs[0]!.schedulingKind = null;
          throw new Error('QStash unavailable');
        })
        .mockImplementationOnce(async () => {
          repository.runs[0]!.status = 'SCHEDULED';
        }),
      cancelPending: vi.fn(),
    };
    const service = createService(repository, scheduler, {
      testDataEnabled: true,
      testDataAdapter,
    });
    const input = {
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        ...request,
        execution: { ...request.execution, dryRun: false },
      },
    };

    await expect(service.createRun(input)).rejects.toMatchObject({
      code: 'SCHEDULING_FAILED',
    });
    expect(testDataAdapter.cleanup).toHaveBeenCalledWith(expect.any(Object), [
      '001000000000001AAA',
    ]);
    await service.createRun(input);

    expect(testDataAdapter.setup).toHaveBeenCalledTimes(2);
    expect(scheduler.schedule).toHaveBeenCalledTimes(2);
  });

  it('replays a partially scheduled creation and publishes only PENDING steps without message ids', async () => {
    const repository = new MemoryRunRepository();
    const schedule = vi
      .fn()
      .mockImplementationOnce(async () => {
        const run = repository.runs[0];
        const step = repository.steps.get(runId)?.[0];
        if (run) run.status = 'FAILED';
        if (step) {
          step.status = 'PENDING';
          step.qstashMessageId = null;
        }
        throw new Error('provider unavailable');
      })
      .mockImplementationOnce(async ({ steps }) => {
        const run = repository.runs[0];
        const persisted = repository.steps.get(runId)?.[0];
        expect(steps).toHaveLength(1);
        if (run) run.status = 'SCHEDULED';
        if (persisted) {
          persisted.status = 'SCHEDULED';
          persisted.qstashMessageId = 'msg-recovered';
        }
      });
    const service = createService(repository, {
      schedule,
      cancelPending: vi.fn(),
    });
    const input = {
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        ...request,
        execution: { ...request.execution, dryRun: false },
      },
    };

    await expect(service.createRun(input)).rejects.toMatchObject({
      code: 'SCHEDULING_FAILED',
    });
    const replay = await service.createRun(input);

    expect(replay).toMatchObject({
      outcome: 'REPLAY',
      run: { status: 'SCHEDULED' },
    });
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(repository.audits).toContainEqual({
      action: 'RUN_SCHEDULING_RECOVERY_STARTED',
      metadataRedacted: {
        previousStatus: 'FAILED',
        pendingCount: 1,
      },
    });
    expect(JSON.stringify(repository.audits)).not.toContain('payload');
  });

  it('lets only one concurrent replay claim initial scheduling', async () => {
    const repository = new MemoryRunRepository();
    let releaseSchedule!: () => void;
    const scheduling = new Promise<void>((resolve) => {
      releaseSchedule = resolve;
    });
    const schedule = vi
      .fn()
      .mockImplementationOnce(async () => {
        repository.runs[0]!.status = 'FAILED';
        throw new Error('provider unavailable');
      })
      .mockImplementationOnce(async () => {
        await scheduling;
        repository.runs[0]!.status = 'SCHEDULED';
      });
    const service = createService(repository, {
      schedule,
      cancelPending: vi.fn(),
    });
    const input = {
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        ...request,
        execution: { ...request.execution, dryRun: false },
      },
    };
    await expect(service.createRun(input)).rejects.toMatchObject({
      code: 'SCHEDULING_FAILED',
    });

    const firstReplay = service.createRun(input);
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(2));
    const secondReplay = await service.createRun(input);
    releaseSchedule();
    await firstReplay;

    expect(secondReplay.outcome).toBe('REPLAY');
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('does not promote a persisted FAKE run when flags are enabled later', async () => {
    const repository = new MemoryRunRepository();
    const input = {
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request,
    };
    const first = await createService(repository, undefined, {
      dispatchMode: 'FAKE',
      testDataEnabled: false,
    }).createRun(input);
    const replay = await createService(repository, undefined, {
      dispatchMode: 'SALESFORCE',
      testDataEnabled: true,
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
    }).createRun(input);

    expect(first.run.dispatchMode).toBe('FAKE');
    expect(replay.run).toMatchObject({
      dispatchMode: 'FAKE',
      testDataEnabled: false,
    });
  });

  it('does not downgrade a persisted SALESFORCE run when flags are disabled later', async () => {
    const repository = new MemoryRunRepository();
    const scheduler = {
      schedule: vi.fn().mockResolvedValue(undefined),
      cancelPending: vi.fn(),
    };
    const testDataAdapter = {
      setup: vi.fn().mockResolvedValue({
        status: 'CREATED',
        createdCount: 1,
        replayedCount: 0,
        recordIds: ['001000000000001AAA'],
      }),
      verify: vi.fn(),
      cleanup: vi
        .fn()
        .mockResolvedValue({ status: 'DELETED', deletedCount: 1 }),
    };
    const input = {
      idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
      request: {
        ...request,
        execution: { ...request.execution, dryRun: false },
      },
    };
    await createService(repository, scheduler, {
      dispatchMode: 'SALESFORCE',
      testDataEnabled: true,
      testDataAdapter,
    }).createRun(input);

    await expect(
      createService(repository, scheduler, {
        dispatchMode: 'FAKE',
        testDataEnabled: false,
      }).createRun(input),
    ).rejects.toMatchObject({ code: 'SALESFORCE_DISPATCH_DISABLED' });
    expect(repository.runs[0]).toMatchObject({
      dispatchMode: 'SALESFORCE',
      testDataEnabled: true,
    });
  });
});
