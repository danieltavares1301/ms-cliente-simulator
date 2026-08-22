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

export type RunStatus = (typeof runStatuses)[number];
export type StepStatus = (typeof stepStatuses)[number];
export type StepKind = (typeof stepKinds)[number];
export type CleanupPolicy = (typeof cleanupPolicies)[number];
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
  dryRun: boolean;
  stopOnFailure: boolean;
  expectedCallbackMin: number;
  expectedCallbackMax: number;
  asyncWaitDeadline: Date | null;
  cleanupPolicy: CleanupPolicy;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  retentionExpiresAt: Date;
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
  requestRedacted: RedactedMetadata;
  responseRedacted: RedactedMetadata;
  httpStatus: number | null;
  durationMs: number | null;
  attemptCount: number;
  qstashMessageId: string | null;
  errorCode: string | null;
  stepKind: StepKind;
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

export type NewRun = Omit<
  Run,
  | 'id'
  | 'status'
  | 'createdAt'
  | 'startedAt'
  | 'finishedAt'
  | 'asyncWaitDeadline'
> & {
  status?: RunStatus;
  asyncWaitDeadline?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export type NewRunStep = Omit<
  RunStep,
  | 'id'
  | 'runId'
  | 'eventType'
  | 'scheduledAt'
  | 'startedAt'
  | 'finishedAt'
  | 'httpStatus'
  | 'durationMs'
  | 'attemptCount'
  | 'qstashMessageId'
  | 'errorCode'
> & {
  eventType?: string | null;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  attemptCount?: number;
  qstashMessageId?: string | null;
  errorCode?: string | null;
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
  hasMore: boolean;
}

export interface RunRepository {
  createRun(input: CreateRunInput): Promise<CreateRunResult>;
  findRun(runId: string): Promise<Run | null>;
  listRuns(page: { limit: number; offset?: number }): Promise<RunPage>;
  listSteps(runId: string): Promise<RunStep[]>;
  appendAuditEvent(
    event: Omit<AuditEvent, 'id' | 'createdAt'>,
  ): Promise<AuditEvent>;
  listAuditEvents(runId: string, limit: number): Promise<AuditEvent[]>;
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
}
