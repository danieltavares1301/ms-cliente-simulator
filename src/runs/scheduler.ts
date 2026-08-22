export interface ScheduledStepReference {
  stepId: string;
  stepKey: string;
  ordinal: number;
  delayMs: number;
  attemptNumber: number;
}

export interface Scheduler {
  schedule(input: {
    runId: string;
    steps: readonly ScheduledStepReference[];
  }): Promise<void>;
  cancelPending(messageIds: readonly string[]): Promise<{
    cancelledMessageIds: string[];
    failedMessageIds: string[];
  }>;
}

export interface DispatchPublisher {
  publish(input: {
    runId: string;
    stepId: string;
    attemptNumber: number;
    delaySeconds: number;
  }): Promise<{ messageId: string }>;
}
