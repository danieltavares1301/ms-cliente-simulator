import { createHash } from 'node:crypto';

import type { RunRepository } from '../db/run-repository';
import type { Scheduler } from './scheduler';

type QStashPublishRequest = {
  url: string;
  body: {
    runId: string;
    stepId: string;
    attemptNumber: number;
  };
  delay: number;
  retries: number;
  deduplicationId: string;
};

type QStashClient = {
  publishJSON(request: QStashPublishRequest): Promise<{ messageId: string }>;
  messages: {
    cancel(messageId: string | string[]): Promise<unknown>;
  };
};

type QStashRunSchedulerDependencies = {
  repository: RunRepository;
  clientFactory: () => QStashClient;
  publicAppBaseUrl: string;
  retries: number;
};

export function createDispatchDeduplicationId(
  runId: string,
  stepId: string,
  attemptNumber: number,
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([runId, stepId, attemptNumber]))
    .digest('base64url');
  return `dispatch_${digest}`;
}

function isMissingMessage(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status =
    'status' in error
      ? error.status
      : 'statusCode' in error
        ? error.statusCode
        : undefined;
  return status === 404 || status === 410;
}

export class QStashSchedulingError extends Error {
  readonly code = 'QSTASH_SCHEDULING_FAILED';

  constructor() {
    super('QStash scheduling failed');
    this.name = 'QStashSchedulingError';
  }
}

export class QStashRunScheduler implements Scheduler {
  private client: QStashClient | undefined;
  private readonly destination: string;

  constructor(private readonly dependencies: QStashRunSchedulerDependencies) {
    this.destination = `${dependencies.publicAppBaseUrl.replace(/\/+$/, '')}/api/v1/internal/dispatches`;
  }

  async schedule(input: Parameters<Scheduler['schedule']>[0]): Promise<void> {
    const ordered = [...input.steps].sort(
      (left, right) => left.ordinal - right.ordinal,
    );
    let publishedCount = 0;

    for (const step of ordered) {
      try {
        const result = await this.getClient().publishJSON({
          url: this.destination,
          body: {
            runId: input.runId,
            stepId: step.stepId,
            attemptNumber: step.attemptNumber,
          },
          delay: Math.ceil(step.delayMs / 1_000),
          retries: this.dependencies.retries,
          deduplicationId: createDispatchDeduplicationId(
            input.runId,
            step.stepId,
            step.attemptNumber,
          ),
        });
        publishedCount += 1;
        const persisted =
          await this.dependencies.repository.recordStepScheduled({
            stepId: step.stepId,
            messageId: result.messageId,
          });
        if (!persisted)
          throw new Error('Scheduled step could not be persisted');
      } catch {
        await this.dependencies.repository.recordSchedulingFailure({
          runId: input.runId,
          failedStepId: step.stepId,
          publishedCount,
        });
        throw new QStashSchedulingError();
      }
    }

    try {
      await this.dependencies.repository.markRunScheduled(input.runId);
    } catch {
      await this.dependencies.repository.recordSchedulingFailure({
        runId: input.runId,
        failedStepId: ordered.at(-1)?.stepId ?? input.runId,
        publishedCount,
      });
      throw new QStashSchedulingError();
    }
  }

  async cancelPending(
    messageIds: readonly string[],
  ): ReturnType<Scheduler['cancelPending']> {
    const cancelledMessageIds: string[] = [];
    const failedMessageIds: string[] = [];
    for (const messageId of [...new Set(messageIds)]) {
      try {
        await this.getClient().messages.cancel(messageId);
        cancelledMessageIds.push(messageId);
      } catch (error) {
        (isMissingMessage(error) ? cancelledMessageIds : failedMessageIds).push(
          messageId,
        );
      }
    }
    return { cancelledMessageIds, failedMessageIds };
  }

  private getClient(): QStashClient {
    this.client ??= this.dependencies.clientFactory();
    return this.client;
  }
}
