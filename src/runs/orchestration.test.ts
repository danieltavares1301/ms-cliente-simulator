import { describe, expect, it, vi } from 'vitest';

import type {
  CreateRunInput,
  CreateRunResult,
  Run,
  RunPage,
  RunRepository,
  RunStep,
  RunStepPage,
} from '../db/run-repository';
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
        scheduledAt: step.scheduledAt ?? null,
        startedAt: step.startedAt ?? null,
        finishedAt: step.finishedAt ?? null,
        httpStatus: step.httpStatus ?? null,
        durationMs: step.durationMs ?? null,
        attemptCount: step.attemptCount ?? 0,
        qstashMessageId: step.qstashMessageId ?? null,
        errorCode: step.errorCode ?? null,
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

  appendAuditEvent(): never {
    throw new Error('not used');
  }

  listAuditEvents(): never {
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

  claimDispatch(): never {
    throw new Error('not used');
  }

  completeDispatch(): never {
    throw new Error('not used');
  }

  listDeliveryAttempts(): never {
    throw new Error('not used');
  }
}

function createService(repository: RunRepository, scheduler?: Scheduler) {
  return createRunOrchestrationService({
    repository,
    scheduler,
    idempotencyPepper: 'p'.repeat(32),
    requestedBy: 'simulator-admin-api',
    now: () => now,
    generateRunId: () => runId,
  });
}

describe('run orchestration service', () => {
  it('renders and persists a dry run without scheduling or raw payload persistence', async () => {
    const repository = new MemoryRunRepository();
    const scheduler = { schedule: vi.fn(), cancelPending: vi.fn() };
    const result = await createService(repository, scheduler).createRun({
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
    expect(repository.runs[0].variablesRedacted).toStrictEqual({
      keys: ['eventStartAt', 'seed'],
    });
    expect(JSON.stringify([...repository.steps.values()])).not.toContain(
      'numerocpf',
    );
    expect(
      [...repository.steps.values()]
        .flat()
        .every(({ status }) => status === 'SKIPPED'),
    ).toBe(true);
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
});
