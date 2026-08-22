import type { RunRepository, RunStatus } from '../db/run-repository';
import type { CancellationReasonCode } from '../contracts';
import type { Scheduler } from './scheduler';

export type RunAdministrationErrorCode =
  | 'RUN_NOT_FOUND'
  | 'RUN_NOT_CANCELLABLE'
  | 'NO_ELIGIBLE_STEPS'
  | 'CANCELLATION_FAILED'
  | 'SCHEDULING_FAILED';

export class RunAdministrationError extends Error {
  constructor(
    readonly code: RunAdministrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RunAdministrationError';
  }
}

type Dependencies = {
  repository: RunRepository;
  scheduler: Scheduler;
  actor?: string;
};

export interface RunAdministrationResult {
  runId: string;
  status: RunStatus;
  affectedStepCount: number;
  replayed: boolean;
}

export function createRunAdministrationService(dependencies: Dependencies) {
  const actor = dependencies.actor ?? 'simulator-admin-api';

  return {
    async cancelRun(input: {
      runId: string;
      reasonCode?: CancellationReasonCode;
    }): Promise<RunAdministrationResult> {
      const begun = await dependencies.repository.beginCancellation({
        runId: input.runId,
        actor,
        ...(input.reasonCode === undefined
          ? {}
          : { reasonCode: input.reasonCode }),
      });
      if (begun.outcome === 'NOT_FOUND') {
        throw new RunAdministrationError('RUN_NOT_FOUND', 'Run not found');
      }
      if (begun.outcome === 'CONFLICT') {
        throw new RunAdministrationError(
          'RUN_NOT_CANCELLABLE',
          `Run in ${begun.status} cannot be cancelled`,
        );
      }
      if (begun.outcome === 'REPLAY') {
        return {
          runId: input.runId,
          status: begun.status,
          affectedStepCount: begun.affectedStepCount,
          replayed: true,
        };
      }

      let cancellation;
      try {
        cancellation = (await dependencies.scheduler.cancelPending(
          begun.messageIds,
        )) ?? {
          cancelledMessageIds: [...begun.messageIds],
          failedMessageIds: [],
        };
      } catch {
        cancellation = {
          cancelledMessageIds: [],
          failedMessageIds: [...begun.messageIds],
        };
      }
      if (cancellation.cancelledMessageIds.length > 0) {
        await dependencies.repository.recordCancellationProgress({
          runId: input.runId,
          actor,
          messageIds: cancellation.cancelledMessageIds,
        });
      }
      if (cancellation.failedMessageIds.length > 0) {
        await dependencies.repository.recordCancellationFailure({
          runId: input.runId,
          actor,
          ...(input.reasonCode === undefined
            ? {}
            : { reasonCode: input.reasonCode }),
          requestedCount: begun.messageIds.length,
          cancelledCount: cancellation.cancelledMessageIds.length,
          errorCode: 'QSTASH_CANCEL_FAILED',
        });
        throw new RunAdministrationError(
          'CANCELLATION_FAILED',
          'QStash cancellation failed',
        );
      }

      const finalized = await dependencies.repository.finalizeCancellation({
        runId: input.runId,
        actor,
        ...(input.reasonCode === undefined
          ? {}
          : { reasonCode: input.reasonCode }),
        expectedAffectedStepCount: begun.affectedStepCount,
      });
      return {
        runId: input.runId,
        status: finalized.status,
        affectedStepCount: finalized.affectedStepCount,
        replayed: begun.outcome === 'IN_PROGRESS',
      };
    },

    async retryRun(input: {
      runId: string;
      stepKeys?: readonly string[];
    }): Promise<RunAdministrationResult> {
      const reserved = await dependencies.repository.reserveRetries({
        runId: input.runId,
        ...(input.stepKeys === undefined ? {} : { stepKeys: input.stepKeys }),
        actor,
      });
      if (reserved.outcome === 'NOT_FOUND') {
        throw new RunAdministrationError('RUN_NOT_FOUND', 'Run not found');
      }
      if (
        reserved.outcome === 'CONFLICT' ||
        reserved.outcome === 'NO_ELIGIBLE'
      ) {
        throw new RunAdministrationError(
          'NO_ELIGIBLE_STEPS',
          'Run has no eligible failed steps',
        );
      }

      try {
        await dependencies.scheduler.schedule({
          runId: input.runId,
          steps: reserved.steps.map((step) => ({ ...step, delayMs: 0 })),
        });
      } catch {
        await dependencies.repository.releaseRetryReservations({
          runId: input.runId,
          stepIds: reserved.steps.map(({ stepId }) => stepId),
          actor,
          errorCode: 'QSTASH_SCHEDULING_FAILED',
        });
        throw new RunAdministrationError(
          'SCHEDULING_FAILED',
          'Retry scheduling failed',
        );
      }

      const run = await dependencies.repository.findRun(input.runId);
      if (run === null) {
        throw new RunAdministrationError('RUN_NOT_FOUND', 'Run not found');
      }
      await dependencies.repository.appendAuditEvent({
        actor,
        action: 'RUN_RETRY_SCHEDULED',
        resourceType: 'scenario_run',
        resourceId: input.runId,
        metadataRedacted: {
          count: reserved.steps.length,
          status: run.status,
        },
      });
      return {
        runId: input.runId,
        status: run.status,
        affectedStepCount: reserved.steps.length,
        replayed: false,
      };
    },
  };
}
