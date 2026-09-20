import type { EventGridEnvelope, RenderedScenarioFixture } from '../contracts';

export const runStatuses = [
  'CREATED',
  'PROVISIONING',
  'SCHEDULED',
  'RUNNING',
  'WAITING_ASYNC',
  'VERIFYING',
  'SUCCEEDED',
  'FAILED',
  'PARTIAL',
  'CANCELLING',
  'CANCELLED',
] as const;

export const stepStatuses = [
  'PENDING',
  'SCHEDULED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
] as const;

export const stepKinds = ['SETUP', 'DISPATCH', 'VERIFY', 'CLEANUP'] as const;
export const cleanupPolicies = ['ALWAYS', 'ON_SUCCESS', 'NEVER'] as const;
export const schedulingKinds = ['INITIAL', 'RETRY'] as const;
export const dispatchModes = ['FAKE', 'SALESFORCE'] as const;

export type RunStatus = (typeof runStatuses)[number];
export type StepStatus = (typeof stepStatuses)[number];
export type StepKind = (typeof stepKinds)[number];
export type CleanupPolicy = (typeof cleanupPolicies)[number];
export type SchedulingKind = (typeof schedulingKinds)[number];
export type DispatchMode = (typeof dispatchModes)[number];
export type RedactedMetadata = Record<string, unknown>;

export interface Run {
  id: string;
  scenarioKey: string;
  scenarioVersion: number;
  status: RunStatus;
  idempotencyKeyHash: string;
  requestFingerprint: string;
  requestedBy: string;
  seed: number;
  variablesRedacted: RedactedMetadata;
  fixtureSnapshot: RenderedScenarioFixture | null;
  dryRun: boolean;
  stopOnFailure: boolean;
  expectedCallbackMin: number;
  expectedCallbackMax: number;
  asyncWaitDeadline: Date | null;
  cleanupPolicy: CleanupPolicy;
  dispatchMode: DispatchMode;
  testDataEnabled: boolean;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  retentionExpiresAt: Date;
  schedulingKind: SchedulingKind | null;
  schedulingLeaseExpiresAt: Date | null;
}

export interface RunStep {
  id: string;
  runId: string;
  stepKey: string;
  ordinal: number;
  target: string;
  eventType: string | null;
  status: StepStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  eventEnvelope: EventGridEnvelope | null;
  requestRedacted: RedactedMetadata;
  responseRedacted: RedactedMetadata;
  httpStatus: number | null;
  durationMs: number | null;
  attemptCount: number;
  qstashMessageId: string | null;
  errorCode: string | null;
  stepKind: StepKind;
  schedulingKind: SchedulingKind | null;
  schedulingLeaseExpiresAt: Date | null;
  lifecycleClaimId: string | null;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadataRedacted: RedactedMetadata;
  createdAt: Date;
}

export interface DeliveryAttempt {
  id: string;
  stepId: string;
  attemptNumber: number;
  requestId: string;
  httpStatus: number | null;
  durationMs: number | null;
  responseRedacted: RedactedMetadata;
  errorCode: string | null;
  createdAt: Date;
}

export type DispatchClaimResult =
  | { outcome: 'CLAIMED' }
  | {
      outcome:
        | 'TERMINAL'
        | 'ALREADY_RUNNING'
        | 'OUT_OF_ORDER'
        | 'ATTEMPT_CONFLICT'
        | 'NOT_FOUND';
    };

export type LifecycleStepKind = Extract<
  StepKind,
  'SETUP' | 'VERIFY' | 'CLEANUP'
>;

export type ClaimLifecycleStepResult =
  | { outcome: 'CLAIMED'; claimId: string; run: Run; step: RunStep }
  | {
      outcome: 'TERMINAL';
      runStatus: RunStatus;
      stepStatus: StepStatus;
    }
  | {
      outcome:
        'IN_PROGRESS' | 'NOT_READY' | 'NOT_FOUND' | 'CANCELLED' | 'STALE';
    };

export type CompleteLifecycleStepResult =
  { outcome: 'COMPLETED' } | { outcome: 'STALE' | 'CANCELLED' };

export type NewRun = Omit<
  Run,
  | 'status'
  | 'createdAt'
  | 'startedAt'
  | 'finishedAt'
  | 'asyncWaitDeadline'
  | 'schedulingKind'
  | 'schedulingLeaseExpiresAt'
  | 'dispatchMode'
  | 'testDataEnabled'
> & {
  status?: RunStatus;
  asyncWaitDeadline?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  schedulingKind?: SchedulingKind | null;
  schedulingLeaseExpiresAt?: Date | null;
  dispatchMode?: DispatchMode;
  testDataEnabled?: boolean;
};

export type NewRunStep = Omit<
  RunStep,
  | 'id'
  | 'runId'
  | 'eventType'
  | 'scheduledAt'
  | 'startedAt'
  | 'finishedAt'
  | 'eventEnvelope'
  | 'httpStatus'
  | 'durationMs'
  | 'attemptCount'
  | 'qstashMessageId'
  | 'errorCode'
  | 'schedulingKind'
  | 'schedulingLeaseExpiresAt'
  | 'lifecycleClaimId'
> & {
  eventType?: string | null;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  eventEnvelope?: EventGridEnvelope | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  attemptCount?: number;
  qstashMessageId?: string | null;
  errorCode?: string | null;
  schedulingKind?: SchedulingKind | null;
  schedulingLeaseExpiresAt?: Date | null;
  lifecycleClaimId?: string | null;
};

export interface CreateRunInput {
  run: NewRun;
  steps: readonly NewRunStep[];
}

export interface CreateRunResult {
  outcome: 'CREATED' | 'REPLAY' | 'CONFLICT';
  run: Run;
}

export interface RunPage {
  items: Run[];
  total: number;
  hasMore: boolean;
}

export interface RunFilters {
  status?: RunStatus;
  scenarioKey?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface RunStepPage {
  items: RunStep[];
  total: number;
  hasMore: boolean;
}

export type BeginCancellationResult =
  | {
      outcome: 'STARTED';
      messageIds: string[];
      affectedStepCount: number;
    }
  | {
      outcome: 'REPLAY';
      status: 'CANCELLED';
      affectedStepCount: number;
    }
  | {
      outcome: 'IN_PROGRESS';
      status: 'CANCELLING';
      messageIds: string[];
      affectedStepCount: number;
    }
  | { outcome: 'CONFLICT'; status: RunStatus }
  | { outcome: 'NOT_FOUND' };

export interface RetryStepReservation {
  stepId: string;
  stepKey: string;
  ordinal: number;
  attemptNumber: number;
}

export type ClaimInitialSchedulingResult =
  | { outcome: 'CLAIMED'; previousStatus: RunStatus }
  | { outcome: 'IN_PROGRESS' }
  | { outcome: 'NOT_RECOVERABLE' }
  | { outcome: 'NOT_FOUND' };

export type ReserveRetriesResult =
  | { outcome: 'RESERVED'; steps: RetryStepReservation[] }
  | { outcome: 'IN_PROGRESS'; status: RunStatus }
  | { outcome: 'NO_ELIGIBLE'; status: RunStatus }
  | { outcome: 'CONFLICT'; status: RunStatus }
  | { outcome: 'NOT_FOUND' };

export interface RunRepository {
  createRun(input: CreateRunInput): Promise<CreateRunResult>;
  findRun(runId: string): Promise<Run | null>;
  listRuns(page: {
    limit: number;
    offset?: number;
    filters?: RunFilters;
  }): Promise<RunPage>;
  listSteps(
    runId: string,
    page: { limit: number; offset?: number },
  ): Promise<RunStepPage>;
  appendAuditEvent(
    event: Omit<AuditEvent, 'id' | 'createdAt'>,
  ): Promise<AuditEvent>;
  listAuditEvents(runId: string, limit: number): Promise<AuditEvent[]>;
  beginCancellation(input: {
    runId: string;
    actor: string;
    reasonCode?: string;
  }): Promise<BeginCancellationResult>;
  recordCancellationProgress(input: {
    runId: string;
    actor: string;
    messageIds: readonly string[];
  }): Promise<void>;
  finalizeCancellation(input: {
    runId: string;
    actor: string;
    reasonCode?: string;
    expectedAffectedStepCount: number;
  }): Promise<{ status: 'CANCELLED'; affectedStepCount: number }>;
  recordCancellationFailure(input: {
    runId: string;
    actor: string;
    reasonCode?: string;
    requestedCount: number;
    cancelledCount?: number;
    errorCode: 'QSTASH_CANCEL_FAILED';
  }): Promise<void>;
  claimInitialScheduling(input: {
    runId: string;
    actor: string;
    recovery: boolean;
  }): Promise<ClaimInitialSchedulingResult>;
  reserveRetries(input: {
    runId: string;
    stepKeys?: readonly string[];
    actor: string;
  }): Promise<ReserveRetriesResult>;
  releaseRetryReservations(input: {
    runId: string;
    stepIds: readonly string[];
    actor: string;
    errorCode: 'QSTASH_SCHEDULING_FAILED';
  }): Promise<void>;
  updateRunStatus(input: {
    runId: string;
    expectedStatus: RunStatus;
    nextStatus: RunStatus;
    startedAt?: Date;
    finishedAt?: Date;
  }): Promise<boolean>;
  updateStepStatus(input: {
    stepId: string;
    expectedStatus: StepStatus;
    nextStatus: StepStatus;
    scheduledAt?: Date;
    startedAt?: Date;
    finishedAt?: Date;
  }): Promise<boolean>;
  recordStepScheduled(input: {
    stepId: string;
    messageId: string;
  }): Promise<boolean>;
  markRunScheduled(runId: string): Promise<void>;
  recordSchedulingFailure(input: {
    runId: string;
    failedStepId: string;
    publishedCount: number;
  }): Promise<void>;
  claimDispatch(input: {
    runId: string;
    stepId: string;
    attemptNumber: number;
    claimedAt: Date;
  }): Promise<DispatchClaimResult>;
  getDispatchPayload(input: {
    runId: string;
    stepId: string;
  }): Promise<EventGridEnvelope | null>;
  completeDispatch(input: {
    runId: string;
    stepId: string;
    attemptNumber: number;
    requestId: string;
    httpStatus: number;
    durationMs: number;
    responseRedacted: RedactedMetadata;
    errorCode: string | null;
    finishedAt: Date;
  }): Promise<{ runStatus: RunStatus }>;
  claimLifecycleStep(input: {
    runId: string;
    stepKind: LifecycleStepKind;
    claimedAt: Date;
    actor: string;
  }): Promise<ClaimLifecycleStepResult>;
  completeLifecycleStep(input: {
    runId: string;
    stepId: string;
    stepKind: LifecycleStepKind;
    claimId: string;
    succeeded: boolean;
    responseRedacted: RedactedMetadata;
    errorCode: string | null;
    actor: string;
    finishedAt: Date;
  }): Promise<CompleteLifecycleStepResult>;
  recordLifecycleCompensation(input: {
    runId: string;
    succeeded: boolean;
    responseRedacted: RedactedMetadata;
    errorCode: string | null;
    actor: string;
    finishedAt: Date;
  }): Promise<'COMPLETED' | 'NOT_FOUND'>;
  finalizeLifecycleRun(input: {
    runId: string;
    actor: string;
    finishedAt: Date;
  }): Promise<RunStatus>;
  listDeliveryAttempts(
    stepId: string,
    limit: number,
  ): Promise<DeliveryAttempt[]>;
}
