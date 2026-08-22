export interface ScheduledStepReference {
  stepKey: string;
  ordinal: number;
  scheduledAt: Date | null;
}

export interface Scheduler {
  schedule(input: {
    runId: string;
    steps: readonly ScheduledStepReference[];
  }): Promise<void>;
}

export interface DispatchPublisher {
  publish(input: {
    runId: string;
    stepId: string;
  }): Promise<{ messageId: string }>;
}
