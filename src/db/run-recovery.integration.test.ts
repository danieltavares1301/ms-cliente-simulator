import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DrizzleRunRepository } from './drizzle-run-repository';
import type { CreateRunInput, NewRunStep, RunRepository } from './run-repository';
import * as schema from './schema';
import { createRunOrchestrationService } from '../runs/orchestration';
import { createSalesforceLifecycleService } from '../runs/salesforce-lifecycle';
import type { Scheduler } from '../runs/scheduler';
import {
  SalesforceTestDataAdapterError,
  SalesforceTestDataPartialSetupError,
} from '../salesforce/test-data-adapter';
import { renderScenarioFixture } from '../scenarios/renderer';

// Regressões da revisão de 2026-09-27 da recuperação de falhas da
// orquestração: cada teste reproduz um cenário que deixava registro órfão na
// org ou run preso, com o repositório real sobre as migrations reais.

const actor = 'recovery-test';
const runId = '00000000-0000-4000-8000-0000000000a1';
const idempotencyKey = '123e4567-e89b-12d3-a456-426614174000';
const setupRecordId = '001000000000SETAAA';
const fixtureSnapshot = renderScenarioFixture({
  scenarioKey: 'match-id-cliente',
  version: 1,
  seed: 'recovery-test',
  runId: 'run_000000000000400080000000000000a1',
  eventStartAt: '2026-08-21T10:00:00.000Z',
});
const envelope = [
  {
    id: 'evt-recovery',
    subject: 'cliente/evt-recovery',
    eventType: 'cliente-update',
    eventTime: '2026-08-21T10:00:00Z',
    dataVersion: '1.0',
    metadataVersion: '1',
    topic: '/subscriptions/test/topics/clientes',
    data: {
      idcliente: 'cli-recovery',
      numerocpf: '12345678901',
      dataalteracao: '2026-08-21T10:00:00Z',
    },
  },
] as const;

function step(
  stepKind: NewRunStep['stepKind'],
  stepKey: string,
  ordinal: number,
  overrides: Partial<NewRunStep> = {},
): NewRunStep {
  return {
    stepKey,
    ordinal,
    target: stepKind === 'DISPATCH' ? 'CLIENTE' : 'SALESFORCE',
    status: 'PENDING',
    requestRedacted: {},
    responseRedacted: {},
    stepKind,
    ...(stepKind === 'DISPATCH'
      ? { eventType: 'cliente-update', eventEnvelope: [...envelope] }
      : {}),
    ...overrides,
  };
}

function runInput(
  run: Partial<CreateRunInput['run']>,
  steps: NewRunStep[],
): CreateRunInput {
  return {
    run: {
      id: runId,
      scenarioKey: 'match-id-cliente',
      scenarioVersion: 1,
      idempotencyKeyHash: 'c'.repeat(64),
      requestFingerprint: 'd'.repeat(64),
      requestedBy: actor,
      seed: 7,
      variablesRedacted: {},
      fixtureSnapshot,
      dryRun: false,
      stopOnFailure: true,
      expectedCallbackMin: 0,
      expectedCallbackMax: 0,
      cleanupPolicy: 'ALWAYS',
      retentionExpiresAt: new Date('2026-08-29T00:00:00.000Z'),
      ...run,
    },
    steps,
  };
}

function testDataAdapter(
  overrides: Partial<Record<'setup' | 'verify' | 'cleanup', unknown>> = {},
) {
  return {
    setup: vi.fn(),
    verify: vi.fn().mockResolvedValue({ passed: true, checks: [], recordIds: [] }),
    cleanup: vi.fn().mockResolvedValue({ status: 'DELETED', deletedCount: 1 }),
    ...overrides,
  } as never;
}

function schedulerDouble() {
  const schedule = vi.fn<Scheduler['schedule']>().mockResolvedValue(undefined);
  const scheduler: Scheduler = {
    schedule,
    cancelPending: vi.fn().mockResolvedValue({
      cancelledMessageIds: [],
      failedMessageIds: [],
    }),
  };
  return { scheduler, schedule };
}

describe('recuperação de falhas da orquestração', () => {
  let client: PGlite;
  let repository: DrizzleRunRepository;
  let currentTime: Date;

  beforeEach(async () => {
    currentTime = new Date('2026-08-22T12:00:00.000Z');
    client = new PGlite();
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: 'drizzle' });
    repository = new DrizzleRunRepository(database, {
      now: () => currentTime,
    });
  });

  afterEach(async () => {
    await client.close();
  });

  async function stepOf(kind: NewRunStep['stepKind']) {
    const steps = (await repository.listSteps(runId, { limit: 20 })).items;
    return steps.find(({ stepKind }) => stepKind === kind)!;
  }

  it('mantém PARTIAL e cancelável um run com massa de teste quando a reentrega repete o dispatch depois de o cleanup falhar', async () => {
    await repository.createRun(
      runInput({ status: 'SCHEDULED', testDataEnabled: true }, [
        step('SETUP', 'setup-1', 0, { status: 'SUCCEEDED' }),
        step('DISPATCH', 'dispatch', 1, { status: 'SCHEDULED' }),
        step('VERIFY', 'verify-1', 2),
        step('CLEANUP', 'cleanup-1', 3),
      ]),
    );
    const dispatch = await stepOf('DISPATCH');
    const attempt = { runId, stepId: dispatch.id, attemptNumber: 1 };
    await repository.claimDispatch({ ...attempt, claimedAt: currentTime });
    await expect(
      repository.completeDispatch({
        ...attempt,
        requestId: 'attempt-1',
        httpStatus: 500,
        durationMs: 1,
        responseRedacted: {},
        errorCode: 'DISPATCH_TARGET_FAILED',
        finishedAt: currentTime,
      }),
    ).resolves.toStrictEqual({ runStatus: 'FAILED' });
    await repository.recordLifecycleCompensation({
      runId,
      succeeded: false,
      responseRedacted: { status: 'FAILED' },
      errorCode: 'SALESFORCE_TEST_DATA_OPERATION_FAILED',
      actor,
      finishedAt: currentTime,
    });

    // Reentrega do QStash depois do 503 LIFECYCLE_CLEANUP_FAILED.
    await expect(
      repository.claimDispatch({ ...attempt, claimedAt: currentTime }),
    ).resolves.toStrictEqual({ outcome: 'TERMINAL' });
    expect(await repository.findRun(runId)).toMatchObject({ status: 'PARTIAL' });
    await expect(
      repository.beginCancellation({ runId, actor }),
    ).resolves.toMatchObject({ outcome: 'STARTED' });
  });

  it('recusa retry de run com massa de teste, que exige um run novo', async () => {
    await repository.createRun(
      runInput({ status: 'FAILED', testDataEnabled: true }, [
        step('DISPATCH', 'dispatch', 0, { status: 'FAILED', attemptCount: 1 }),
      ]),
    );

    await expect(
      repository.reserveRetries({ runId, actor }),
    ).resolves.toStrictEqual({ outcome: 'NOT_RETRYABLE', status: 'FAILED' });
    expect(await stepOf('DISPATCH')).toMatchObject({
      status: 'FAILED',
      attemptCount: 1,
      schedulingKind: null,
    });
  });

  it('retoma um retry que caiu depois do claim do dispatch', async () => {
    await repository.createRun(
      runInput({ status: 'FAILED' }, [
        step('DISPATCH', 'dispatch', 0, { status: 'FAILED', attemptCount: 1 }),
      ]),
    );
    const dispatch = await stepOf('DISPATCH');
    await expect(
      repository.reserveRetries({ runId, actor }),
    ).resolves.toMatchObject({ outcome: 'RESERVED' });
    await repository.recordStepScheduled({
      stepId: dispatch.id,
      messageId: 'msg-retry',
    });
    await repository.markRunScheduled(runId);
    const attempt = { runId, stepId: dispatch.id, attemptNumber: 2 };
    const claimedAt = new Date('2026-08-22T12:01:00.000Z');

    await expect(
      repository.claimDispatch({ ...attempt, claimedAt }),
    ).resolves.toStrictEqual({ outcome: 'CLAIMED' });
    // O processo cai antes de concluir; o QStash reentrega 5 s depois.
    await expect(
      repository.claimDispatch({
        ...attempt,
        claimedAt: new Date(claimedAt.getTime() + 5_000),
      }),
    ).resolves.toStrictEqual({ outcome: 'CLAIMED' });
    await expect(
      repository.completeDispatch({
        ...attempt,
        requestId: 'attempt-2',
        httpStatus: 200,
        durationMs: 1,
        responseRedacted: {},
        errorCode: null,
        finishedAt: claimedAt,
      }),
    ).resolves.toStrictEqual({ runStatus: 'VERIFYING' });
    expect(await repository.listDeliveryAttempts(dispatch.id, 10)).toMatchObject(
      [{ attemptNumber: 2, httpStatus: 200 }],
    );
  });

  it('mantém PARTIAL um run cuja publicação falhou quando a mensagem já publicada chega depois', async () => {
    await repository.createRun(
      runInput({ status: 'CREATED' }, [
        step('DISPATCH', 'dispatch-a', 0),
        step('DISPATCH', 'dispatch-b', 1),
      ]),
    );
    const steps = (await repository.listSteps(runId, { limit: 10 })).items;
    await expect(
      repository.claimInitialScheduling({ runId, actor, recovery: false }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });
    await repository.recordStepScheduled({
      stepId: steps[0]!.id,
      messageId: 'msg-a',
    });
    await repository.recordSchedulingFailure({
      runId,
      failedStepId: steps[1]!.id,
      publishedCount: 1,
    });

    const attempt = { runId, stepId: steps[0]!.id, attemptNumber: 1 };
    await repository.claimDispatch({ ...attempt, claimedAt: currentTime });
    await expect(
      repository.completeDispatch({
        ...attempt,
        requestId: 'late-a',
        httpStatus: 200,
        durationMs: 1,
        responseRedacted: {},
        errorCode: null,
        finishedAt: currentTime,
      }),
    ).resolves.toStrictEqual({ runStatus: 'PARTIAL' });
    // O replay continua conseguindo publicar o step que faltou.
    await expect(
      repository.claimInitialScheduling({ runId, actor, recovery: true }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });
  });

  it.each([
    'evento-duplicado',
    'maquina-estado-update-reentrega-mesmo-evento',
  ])(
    'faz replay idempotente de %s, que tem reentrega física',
    async (scenarioKey) => {
      const service = createRunOrchestrationService({
        repository,
        idempotencyPepper: 'p'.repeat(32),
        requestedBy: actor,
      });
      const request = {
        scenarioKey,
        scenarioVersion: 1,
        variables: { seed: 'S1', eventStartAt: '2026-08-21T10:00:00Z' },
        execution: { dryRun: true, speed: 1, stopOnFailure: true },
      };

      const first = await service.createRun({ idempotencyKey, request });
      const replay = await service.createRun({ idempotencyKey, request });

      expect(first.outcome).toBe('CREATED');
      expect(replay).toMatchObject({
        outcome: 'REPLAY',
        run: { id: first.run.id },
      });
    },
  );

  it('agenda a reentrega física com o atraso dela, e não com zero', async () => {
    const { scheduler, schedule } = schedulerDouble();
    const service = createRunOrchestrationService({
      repository,
      scheduler,
      idempotencyPepper: 'p'.repeat(32),
      requestedBy: actor,
    });

    await service.createRun({
      idempotencyKey,
      request: {
        scenarioKey: 'maquina-estado-update-reentrega-mesmo-evento',
        scenarioVersion: 1,
        variables: { seed: 'S1', eventStartAt: '2026-08-21T10:00:00Z' },
        execution: { dryRun: false, speed: 1, stopOnFailure: true },
      },
    });

    const scheduled = schedule.mock.calls[0]![0].steps;
    const delayOf = (stepKey: string) =>
      scheduled.find((entry) => entry.stepKey === stepKey)?.delayMs;
    expect(delayOf('maquina-estado-update-documentacao-reentrega')).toBe(3_000);
    expect(
      delayOf('maquina-estado-update-documentacao-reentrega-redelivery-1'),
    ).toBe(3_500);
  });

  it('retoma no replay um run que ficou em CREATED por falha transitória antes do claim', async () => {
    const { scheduler, schedule } = schedulerDouble();
    let failNextClaim = true;
    const flakyRepository = new Proxy(repository, {
      get(target, property, receiver) {
        if (property === 'claimInitialScheduling' && failNextClaim) {
          return async () => {
            failNextClaim = false;
            throw new Error('falha transitória');
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as RunRepository;
    const service = createRunOrchestrationService({
      repository: flakyRepository,
      scheduler,
      idempotencyPepper: 'p'.repeat(32),
      requestedBy: actor,
    });
    const request = {
      scenarioKey: 'match-id-cliente',
      scenarioVersion: 1,
      variables: { seed: 'S1', eventStartAt: '2026-08-21T10:00:00Z' },
      execution: { dryRun: false, speed: 1, stopOnFailure: true },
    };

    await expect(
      service.createRun({ idempotencyKey, request }),
    ).rejects.toThrow('falha transitória');
    expect((await repository.listRuns({ limit: 10 })).items).toMatchObject([
      { status: 'CREATED' },
    ]);

    await expect(
      service.createRun({ idempotencyKey, request }),
    ).resolves.toMatchObject({ outcome: 'REPLAY' });
    expect(schedule).toHaveBeenCalledOnce();
  });

  it('limpa os registros que o VERIFY achou depois de o cancelamento já ter compensado', async () => {
    await repository.createRun(
      runInput({ status: 'VERIFYING', testDataEnabled: true }, [
        step('SETUP', 'setup-1', 0, {
          status: 'SUCCEEDED',
          responseRedacted: { recordIds: [setupRecordId] },
        }),
        step('DISPATCH', 'dispatch', 1, { status: 'SUCCEEDED' }),
        step('VERIFY', 'verify-1', 2),
        step('CLEANUP', 'cleanup-1', 3),
      ]),
    );
    let releaseVerify!: () => void;
    let signalVerifyStarted!: () => void;
    const verifyStarted = new Promise<void>((resolve) => {
      signalVerifyStarted = resolve;
    });
    const verifyGate = new Promise<void>((resolve) => {
      releaseVerify = resolve;
    });
    const adapter = testDataAdapter({
      verify: vi
        .fn()
        .mockImplementationOnce(async () => {
          signalVerifyStarted();
          await verifyGate;
          return {
            passed: true,
            checks: [],
            recordIds: ['00Q000000000EVTAAA'],
          };
        })
        .mockResolvedValue({ passed: true, checks: [], recordIds: [] }),
    });
    const lifecycle = createSalesforceLifecycleService({
      repository,
      adapter,
      actor,
      now: () => currentTime,
    });

    const verifying = lifecycle.afterDispatch(runId);
    await verifyStarted;
    // Cancelamento enquanto o VERIFY roda, como no administration.cancelRun.
    await repository.beginCancellation({ runId, actor });
    await lifecycle.compensate(runId);
    await repository.finalizeCancellation({
      runId,
      actor,
      expectedAffectedStepCount: 0,
    });
    releaseVerify();

    await expect(verifying).resolves.toStrictEqual({ outcome: 'CANCELLED' });
    const cleanup = (adapter as { cleanup: ReturnType<typeof vi.fn> }).cleanup;
    expect(cleanup).toHaveBeenCalledWith(expect.anything(), [setupRecordId]);
    expect(cleanup).toHaveBeenLastCalledWith(expect.anything(), [
      '00Q000000000EVTAAA',
    ]);
  });

  it('leva à compensação os IDs que um setup criou antes de falhar', async () => {
    await repository.createRun(
      runInput({ status: 'PROVISIONING', testDataEnabled: true }, [
        step('SETUP', 'setup-1', 0),
        step('DISPATCH', 'dispatch', 1),
        step('VERIFY', 'verify-1', 2),
        step('CLEANUP', 'cleanup-1', 3),
      ]),
    );
    const adapter = testDataAdapter({
      setup: vi
        .fn()
        .mockRejectedValue(
          new SalesforceTestDataPartialSetupError(
            new SalesforceTestDataAdapterError('PRECONDITION_FAILED'),
            [setupRecordId],
          ),
        ),
    });
    const lifecycle = createSalesforceLifecycleService({
      repository,
      adapter,
      actor,
      now: () => currentTime,
    });

    await expect(lifecycle.setup(runId)).resolves.toStrictEqual({
      outcome: 'FAILED',
      errorCode: 'PRECONDITION_FAILED',
    });
    expect(
      (adapter as { cleanup: ReturnType<typeof vi.fn> }).cleanup,
    ).toHaveBeenCalledWith(expect.anything(), [setupRecordId]);
    expect(await repository.findRun(runId)).toMatchObject({ status: 'FAILED' });
  });

  it('a compensação descobre e apaga registros que o Apex criou antes do VERIFY', async () => {
    await repository.createRun(
      runInput({ status: 'FAILED', testDataEnabled: true }, [
        step('SETUP', 'setup-1', 0, {
          status: 'SUCCEEDED',
          responseRedacted: { recordIds: [setupRecordId] },
        }),
        step('DISPATCH', 'dispatch', 1, { status: 'FAILED' }),
        step('VERIFY', 'verify-1', 2),
        step('CLEANUP', 'cleanup-1', 3),
      ]),
    );
    const adapter = testDataAdapter({
      verify: vi.fn().mockResolvedValue({
        passed: false,
        checks: [],
        recordIds: ['00Q000000000APXAAA'],
      }),
    });

    await expect(
      createSalesforceLifecycleService({
        repository,
        adapter,
        actor,
        now: () => currentTime,
      }).compensate(runId),
    ).resolves.toStrictEqual({ outcome: 'SUCCEEDED' });
    expect(
      (adapter as { cleanup: ReturnType<typeof vi.fn> }).cleanup,
    ).toHaveBeenCalledWith(expect.anything(), [
      setupRecordId,
      '00Q000000000APXAAA',
    ]);
  });
});
