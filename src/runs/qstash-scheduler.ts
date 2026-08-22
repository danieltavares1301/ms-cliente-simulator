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
};

type QStashRunSchedulerDependencies = {
  repository: RunRepository;
  clientFactory: () => QStashClient;
  publicAppBaseUrl: string;
  retries: number;
};

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
          deduplicationId: `${input.runId}:${step.stepId}:${step.attemptNumber}`,
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

  private getClient(): QStashClient {
    this.client ??= this.dependencies.clientFactory();
    return this.client;
  }
}
