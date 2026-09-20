import { describe, expect, it, vi } from 'vitest';

import type { RunRepository } from '../db/run-repository';
import type { Scheduler } from './scheduler';
import {
  createRunAdministrationService,
  RunAdministrationError,
} from './administration';

const runId = '11111111-1111-4111-8111-111111111111';

describe('run administration service', () => {
  it('cancels only pending QStash message IDs and finalizes the run', async () => {
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'STARTED',
        messageIds: ['msg-pending', 'msg-scheduled'],
        affectedStepCount: 3,
      }),
      finalizeCancellation: vi.fn().mockResolvedValue({
        status: 'CANCELLED',
        affectedStepCount: 3,
      }),
      recordCancellationProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as RunRepository;
    const scheduler = {
      cancelPending: vi.fn().mockResolvedValue(undefined),
    } as unknown as Scheduler;
    const service = createRunAdministrationService({ repository, scheduler });

    const result = await service.cancelRun({
      runId,
      reasonCode: 'OPERATOR_REQUEST',
    });

    expect(scheduler.cancelPending).toHaveBeenCalledWith([
      'msg-pending',
      'msg-scheduled',
    ]);
    expect(repository.finalizeCancellation).toHaveBeenCalledWith({
      runId,
      actor: 'simulator-admin-api',
      reasonCode: 'OPERATOR_REQUEST',
      expectedAffectedStepCount: 3,
    });
    expect(result).toMatchObject({
      replayed: false,
      runId,
      status: 'CANCELLED',
      affectedStepCount: 3,
    });
  });

  it('keeps CANCELLING and records a sanitized error after QStash failure', async () => {
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'STARTED',
        messageIds: ['msg-pending'],
        affectedStepCount: 1,
      }),
      recordCancellationFailure: vi.fn().mockResolvedValue(undefined),
    } as unknown as RunRepository;
    const scheduler = {
      cancelPending: vi.fn().mockResolvedValue({
        cancelledMessageIds: [],
        failedMessageIds: ['msg-pending'],
      }),
    } as unknown as Scheduler;
    const service = createRunAdministrationService({ repository, scheduler });

    await expect(
      service.cancelRun({ runId, reasonCode: 'INCIDENT_RESPONSE' }),
    ).rejects.toMatchObject({ code: 'CANCELLATION_FAILED' });
    expect(repository.recordCancellationFailure).toHaveBeenCalledWith({
      runId,
      actor: 'simulator-admin-api',
      reasonCode: 'INCIDENT_RESPONSE',
      requestedCount: 1,
      cancelledCount: 0,
      errorCode: 'QSTASH_CANCEL_FAILED',
    });
    expect(
      JSON.stringify(
        (repository.recordCancellationFailure as ReturnType<typeof vi.fn>).mock
          .calls,
      ),
    ).not.toContain('secret provider body');
  });

  it('recovers a CANCELLING replay, persists partial progress, and retries only remaining messages', async () => {
    const beginCancellation = vi
      .fn()
      .mockResolvedValueOnce({
        outcome: 'IN_PROGRESS',
        status: 'CANCELLING',
        messageIds: ['msg-already-cancelled', 'msg-pending'],
        affectedStepCount: 2,
      })
      .mockResolvedValueOnce({
        outcome: 'IN_PROGRESS',
        status: 'CANCELLING',
        messageIds: ['msg-pending'],
        affectedStepCount: 1,
      });
    const recordCancellationProgress = vi.fn().mockResolvedValue(undefined);
    const recordCancellationFailure = vi.fn().mockResolvedValue(undefined);
    const finalizeCancellation = vi.fn().mockResolvedValue({
      status: 'CANCELLED',
      affectedStepCount: 2,
    });
    const repository = {
      beginCancellation,
      recordCancellationProgress,
      recordCancellationFailure,
      finalizeCancellation,
    } as unknown as RunRepository;
    const cancelPending = vi
      .fn()
      .mockResolvedValueOnce({
        cancelledMessageIds: ['msg-already-cancelled'],
        failedMessageIds: ['msg-pending'],
      })
      .mockResolvedValueOnce({
        cancelledMessageIds: ['msg-pending'],
        failedMessageIds: [],
      });
    const service = createRunAdministrationService({
      repository,
      scheduler: { cancelPending } as unknown as Scheduler,
    });

    await expect(service.cancelRun({ runId })).rejects.toMatchObject({
      code: 'CANCELLATION_FAILED',
    });
    await expect(service.cancelRun({ runId })).resolves.toMatchObject({
      replayed: true,
      status: 'CANCELLED',
    });

    expect(cancelPending).toHaveBeenNthCalledWith(1, [
      'msg-already-cancelled',
      'msg-pending',
    ]);
    expect(cancelPending).toHaveBeenNthCalledWith(2, ['msg-pending']);
    expect(recordCancellationProgress).toHaveBeenNthCalledWith(1, {
      runId,
      actor: 'simulator-admin-api',
      messageIds: ['msg-already-cancelled'],
    });
    expect(recordCancellationFailure).toHaveBeenCalledWith({
      runId,
      actor: 'simulator-admin-api',
      requestedCount: 2,
      cancelledCount: 1,
      errorCode: 'QSTASH_CANCEL_FAILED',
    });
    expect(finalizeCancellation).toHaveBeenCalledOnce();
  });

  it('allows concurrent cancellation replays to converge without inconsistent effects', async () => {
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'IN_PROGRESS',
        status: 'CANCELLING',
        messageIds: ['msg-pending'],
        affectedStepCount: 1,
      }),
      recordCancellationProgress: vi.fn().mockResolvedValue(undefined),
      finalizeCancellation: vi.fn().mockResolvedValue({
        status: 'CANCELLED',
        affectedStepCount: 1,
      }),
    } as unknown as RunRepository;
    const cancelled = new Set<string>();
    const cancelPending = vi.fn(async (messageIds: readonly string[]) => {
      for (const messageId of messageIds) cancelled.add(messageId);
      return {
        cancelledMessageIds: [...messageIds],
        failedMessageIds: [],
      };
    });
    const service = createRunAdministrationService({
      repository,
      scheduler: { cancelPending } as unknown as Scheduler,
    });

    const results = await Promise.all([
      service.cancelRun({ runId }),
      service.cancelRun({ runId }),
    ]);

    expect(results.every(({ status }) => status === 'CANCELLED')).toBe(true);
    expect(cancelled).toStrictEqual(new Set(['msg-pending']));
  });

  it('returns CANCELLED replay without calling QStash', async () => {
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'REPLAY',
        status: 'CANCELLED',
        affectedStepCount: 0,
      }),
    } as unknown as RunRepository;
    const scheduler = {
      cancelPending: vi.fn(),
    } as unknown as Scheduler;
    const service = createRunAdministrationService({ repository, scheduler });

    await expect(service.cancelRun({ runId })).resolves.toMatchObject({
      replayed: true,
      status: 'CANCELLED',
    });

    expect(scheduler.cancelPending).not.toHaveBeenCalled();
  });

  it('cleans persisted Salesforce-owned records before finalizing cancellation', async () => {
    const compensate = vi.fn().mockResolvedValue({ outcome: 'SUCCEEDED' });
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'STARTED',
        messageIds: [],
        affectedStepCount: 1,
      }),
      findRun: vi.fn().mockResolvedValue({
        id: runId,
        testDataEnabled: true,
      }),
      finalizeCancellation: vi.fn().mockResolvedValue({
        status: 'CANCELLED',
        affectedStepCount: 1,
      }),
    } as unknown as RunRepository;
    const service = createRunAdministrationService({
      repository,
      scheduler: {
        cancelPending: vi.fn().mockResolvedValue({
          cancelledMessageIds: [],
          failedMessageIds: [],
        }),
      } as unknown as Scheduler,
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({ compensate }),
    });

    await expect(service.cancelRun({ runId })).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    expect(compensate).toHaveBeenCalledWith(runId);
    expect(repository.finalizeCancellation).toHaveBeenCalledOnce();
  });

  it('keeps cancellation recoverable when Salesforce cleanup fails', async () => {
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'STARTED',
        messageIds: [],
        affectedStepCount: 1,
      }),
      findRun: vi.fn().mockResolvedValue({
        id: runId,
        testDataEnabled: true,
      }),
      finalizeCancellation: vi.fn(),
    } as unknown as RunRepository;
    const service = createRunAdministrationService({
      repository,
      scheduler: {
        cancelPending: vi.fn().mockResolvedValue({
          cancelledMessageIds: [],
          failedMessageIds: [],
        }),
      } as unknown as Scheduler,
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({
        compensate: vi.fn().mockResolvedValue({
          outcome: 'FAILED',
          errorCode: 'OWNERSHIP_MISMATCH',
        }),
      }),
    });

    await expect(service.cancelRun({ runId })).rejects.toMatchObject({
      code: 'CANCELLATION_FAILED',
    });
    expect(repository.finalizeCancellation).not.toHaveBeenCalled();
  });

  it('does not skip persisted cleanup when the current test-data flag is off', async () => {
    const compensate = vi.fn();
    const repository = {
      beginCancellation: vi.fn().mockResolvedValue({
        outcome: 'STARTED',
        messageIds: [],
        affectedStepCount: 1,
      }),
      findRun: vi.fn().mockResolvedValue({
        id: runId,
        testDataEnabled: true,
      }),
      finalizeCancellation: vi.fn(),
    } as unknown as RunRepository;
    const service = createRunAdministrationService({
      repository,
      scheduler: {
        cancelPending: vi.fn().mockResolvedValue({
          cancelledMessageIds: [],
          failedMessageIds: [],
        }),
      } as unknown as Scheduler,
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      testDataAvailable: false,
      lifecycleServiceFactory: () => ({ compensate }),
    });

    await expect(service.cancelRun({ runId })).rejects.toMatchObject({
      code: 'CANCELLATION_FAILED',
    });
    expect(compensate).not.toHaveBeenCalled();
    expect(repository.finalizeCancellation).not.toHaveBeenCalled();
  });

  it('reserves eligible failed steps once, publishes incremented attempts, and preserves history in the repository', async () => {
    const reserved = [
      {
        stepId: '22222222-2222-4222-8222-222222222222',
        stepKey: 'cliente-update',
        ordinal: 1,
        attemptNumber: 2,
      },
    ];
    const repository = {
      reserveRetries: vi.fn().mockResolvedValue({
        outcome: 'RESERVED',
        steps: reserved,
      }),
      findRun: vi.fn().mockResolvedValue({ id: runId, status: 'SCHEDULED' }),
      appendAuditEvent: vi.fn().mockResolvedValue({}),
    } as unknown as RunRepository;
    const scheduler = {
      schedule: vi.fn().mockResolvedValue(undefined),
    } as unknown as Scheduler;
    const service = createRunAdministrationService({ repository, scheduler });

    const result = await service.retryRun({
      runId,
      stepKeys: ['cliente-update'],
    });

    expect(repository.reserveRetries).toHaveBeenCalledWith({
      runId,
      stepKeys: ['cliente-update'],
      actor: 'simulator-admin-api',
    });
    expect(scheduler.schedule).toHaveBeenCalledWith({
      runId,
      steps: [{ ...reserved[0], delayMs: 0 }],
    });
    expect(result).toMatchObject({
      runId,
      status: 'SCHEDULED',
      affectedStepCount: 1,
    });
  });

  it('maps terminal conflict and no eligible retries to stable errors', async () => {
    const scheduler = {} as Scheduler;
    const terminal = createRunAdministrationService({
      repository: {
        beginCancellation: vi
          .fn()
          .mockResolvedValue({ outcome: 'CONFLICT', status: 'FAILED' }),
      } as unknown as RunRepository,
      scheduler,
    });

    const noEligible = createRunAdministrationService({
      repository: {
        reserveRetries: vi
          .fn()
          .mockResolvedValue({ outcome: 'NO_ELIGIBLE', status: 'FAILED' }),
      } as unknown as RunRepository,
      scheduler,
    });

    await expect(terminal.cancelRun({ runId })).rejects.toEqual(
      expect.objectContaining<Partial<RunAdministrationError>>({
        code: 'RUN_NOT_CANCELLABLE',
      }),
    );
    await expect(noEligible.retryRun({ runId })).rejects.toEqual(
      expect.objectContaining<Partial<RunAdministrationError>>({
        code: 'NO_ELIGIBLE_STEPS',
      }),
    );
  });

  it('returns an in-progress retry replay without publishing a duplicate', async () => {
    const repository = {
      reserveRetries: vi.fn().mockResolvedValue({
        outcome: 'IN_PROGRESS',
        status: 'FAILED',
      }),
    } as unknown as RunRepository;
    const scheduler = {
      schedule: vi.fn(),
    } as unknown as Scheduler;
    const service = createRunAdministrationService({ repository, scheduler });

    await expect(service.retryRun({ runId })).resolves.toStrictEqual({
      runId,
      status: 'FAILED',
      affectedStepCount: 0,
      replayed: true,
    });
    expect(scheduler.schedule).not.toHaveBeenCalled();
  });

  it('releases reserved retries after scheduling failure so recovery stays possible', async () => {
    const releaseRetryReservations = vi.fn().mockResolvedValue(undefined);
    const repository = {
      reserveRetries: vi.fn().mockResolvedValue({
        outcome: 'RESERVED',
        steps: [
          {
            stepId: '22222222-2222-4222-8222-222222222222',
            stepKey: 'cliente-update',
            ordinal: 1,
            attemptNumber: 2,
          },
        ],
      }),
      releaseRetryReservations,
    } as unknown as RunRepository;
    const service = createRunAdministrationService({
      repository,
      scheduler: {
        schedule: vi.fn().mockRejectedValue(new Error('provider secret')),
      } as unknown as Scheduler,
    });

    await expect(service.retryRun({ runId })).rejects.toMatchObject({
      code: 'SCHEDULING_FAILED',
    });
    expect(releaseRetryReservations).toHaveBeenCalledWith({
      runId,
      stepIds: ['22222222-2222-4222-8222-222222222222'],
      actor: 'simulator-admin-api',
      errorCode: 'QSTASH_SCHEDULING_FAILED',
    });
  });
});
