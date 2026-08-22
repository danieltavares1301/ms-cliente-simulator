import type { RunStatus, StepStatus } from '../db/run-repository';

export const runTransitions: Readonly<Record<RunStatus, readonly RunStatus[]>> =
  {
    CREATED: ['PROVISIONING', 'SCHEDULED', 'CANCELLING', 'FAILED'],
    PROVISIONING: [
      'SCHEDULED',
      'RUNNING',
      'WAITING_ASYNC',
      'VERIFYING',
      'CANCELLING',
      'FAILED',
      'PARTIAL',
    ],
    SCHEDULED: [
      'RUNNING',
      'WAITING_ASYNC',
      'VERIFYING',
      'CANCELLING',
      'FAILED',
      'PARTIAL',
    ],
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
    FAILED: ['SCHEDULED', 'RUNNING', 'WAITING_ASYNC', 'VERIFYING'],
    PARTIAL: ['SCHEDULED', 'RUNNING', 'WAITING_ASYNC', 'VERIFYING'],
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

const postDispatchRunStatuses: readonly RunStatus[] = [
  'WAITING_ASYNC',
  'VERIFYING',
  'SUCCEEDED',
  'CANCELLING',
  'CANCELLED',
] as const;

const terminalDispatchStepStatuses: readonly StepStatus[] = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
] as const;

export function deriveDispatchRunStatus(input: {
  currentStatus: RunStatus;
  dispatchStepStatuses: readonly StepStatus[];
  expectedCallbackMax: number;
}): RunStatus {
  if (postDispatchRunStatuses.includes(input.currentStatus)) {
    return input.currentStatus;
  }

  const hasDispatchSteps = input.dispatchStepStatuses.length > 0;
  const hasRunning = input.dispatchStepStatuses.includes('RUNNING');
  const hasPendingPublication = input.dispatchStepStatuses.some((status) =>
    ['PENDING', 'SCHEDULED'].includes(status),
  );
  const hasSucceeded = input.dispatchStepStatuses.includes('SUCCEEDED');
  const hasFailed = input.dispatchStepStatuses.some((status) =>
    ['FAILED', 'CANCELLED'].includes(status),
  );
  const allTerminal =
    hasDispatchSteps &&
    input.dispatchStepStatuses.every((status) =>
      terminalDispatchStepStatuses.includes(status),
    );

  if (hasFailed) return hasSucceeded ? 'PARTIAL' : 'FAILED';
  if (hasRunning || (hasPendingPublication && hasSucceeded)) return 'RUNNING';
  if (allTerminal) {
    return input.expectedCallbackMax > 0 ? 'WAITING_ASYNC' : 'VERIFYING';
  }
  if (input.currentStatus === 'RUNNING') return 'RUNNING';
  return 'SCHEDULED';
}
