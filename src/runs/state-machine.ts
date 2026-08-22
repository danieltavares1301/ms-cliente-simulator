import type { RunStatus, StepStatus } from '../db/run-repository';

export const runTransitions: Readonly<Record<RunStatus, readonly RunStatus[]>> =
  {
    CREATED: ['PROVISIONING', 'SCHEDULED', 'CANCELLING', 'FAILED'],
    PROVISIONING: ['SCHEDULED', 'RUNNING', 'CANCELLING', 'FAILED', 'PARTIAL'],
    SCHEDULED: ['RUNNING', 'CANCELLING', 'FAILED', 'PARTIAL'],
    RUNNING: [
      'WAITING_ASYNC',
      'VERIFYING',
      'SUCCEEDED',
      'FAILED',
      'PARTIAL',
      'CANCELLING',
    ],
    WAITING_ASYNC: [
      'VERIFYING',
      'SUCCEEDED',
      'FAILED',
      'PARTIAL',
      'CANCELLING',
    ],
    VERIFYING: ['SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLING'],
    SUCCEEDED: [],
    FAILED: ['SCHEDULED', 'RUNNING'],
    PARTIAL: ['SCHEDULED', 'RUNNING'],
    CANCELLING: ['CANCELLED', 'PARTIAL'],
    CANCELLED: [],
  };

export const stepTransitions: Readonly<
  Record<StepStatus, readonly StepStatus[]>
> = {
  PENDING: ['SCHEDULED', 'RUNNING', 'CANCELLED', 'SKIPPED'],
  SCHEDULED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: [],
  FAILED: ['PENDING', 'SCHEDULED'],
  CANCELLED: [],
  SKIPPED: [],
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return runTransitions[from].includes(to);
}

export function canTransitionStep(from: StepStatus, to: StepStatus): boolean {
  return stepTransitions[from].includes(to);
}
