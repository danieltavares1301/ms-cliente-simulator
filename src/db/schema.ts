import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const redactedJson = (name: string) =>
  jsonb(name).$type<Record<string, unknown>>().notNull().default({});

const timestampWithTimezone = (name: string) =>
  timestamp(name, { mode: 'date', withTimezone: true });

export const runStatusEnum = pgEnum('run_status', [
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
]);

export const stepKindEnum = pgEnum('step_kind', [
  'SETUP',
  'DISPATCH',
  'VERIFY',
  'CLEANUP',
]);

export const stepStatusEnum = pgEnum('step_status', [
  'PENDING',
  'SCHEDULED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
]);

export const cleanupPolicyEnum = pgEnum('cleanup_policy', [
  'ALWAYS',
  'ON_SUCCESS',
  'NEVER',
]);

export const scenarioRun = pgTable(
  'scenario_run',
  {
    id: uuid().defaultRandom().primaryKey(),
    scenarioKey: text('scenario_key').notNull(),
    scenarioVersion: integer('scenario_version').notNull(),
    status: runStatusEnum().notNull().default('CREATED'),
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    requestedBy: text('requested_by').notNull(),
    seed: integer().notNull(),
    variablesRedacted: redactedJson('variables_redacted'),
    dryRun: boolean('dry_run').notNull().default(false),
    stopOnFailure: boolean('stop_on_failure').notNull().default(true),
    expectedCallbackMin: integer('expected_callback_min').notNull().default(0),
    expectedCallbackMax: integer('expected_callback_max').notNull().default(0),
    asyncWaitDeadline: timestampWithTimezone('async_wait_deadline'),
    cleanupPolicy: cleanupPolicyEnum('cleanup_policy').notNull(),
    createdAt: timestampWithTimezone('created_at').notNull().defaultNow(),
    startedAt: timestampWithTimezone('started_at'),
    finishedAt: timestampWithTimezone('finished_at'),
    retentionExpiresAt: timestampWithTimezone('retention_expires_at').notNull(),
  },
  (table) => [
    unique('scenario_run_requester_idempotency_key_unique').on(
      table.requestedBy,
      table.idempotencyKeyHash,
    ),
    check('scenario_run_version_positive', sql`${table.scenarioVersion} > 0`),
    check(
      'scenario_run_callback_min_nonnegative',
      sql`${table.expectedCallbackMin} >= 0`,
    ),
    check(
      'scenario_run_callback_max_valid',
      sql`${table.expectedCallbackMax} >= ${table.expectedCallbackMin}`,
    ),
    index('scenario_run_status_idx').on(table.status),
    index('scenario_run_retention_expires_at_idx').on(table.retentionExpiresAt),
  ],
);

export const scenarioRunStep = pgTable(
  'scenario_run_step',
  {
    id: uuid().defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => scenarioRun.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    ordinal: integer().notNull(),
    target: text().notNull(),
    eventType: text('event_type'),
    status: stepStatusEnum().notNull().default('PENDING'),
    scheduledAt: timestampWithTimezone('scheduled_at'),
    startedAt: timestampWithTimezone('started_at'),
    finishedAt: timestampWithTimezone('finished_at'),
    requestRedacted: redactedJson('request_redacted'),
    responseRedacted: redactedJson('response_redacted'),
    httpStatus: integer('http_status'),
    durationMs: integer('duration_ms'),
    attemptCount: integer('attempt_count').notNull().default(0),
    qstashMessageId: text('qstash_message_id'),
    errorCode: text('error_code'),
    stepKind: stepKindEnum('step_kind').notNull(),
  },
  (table) => [
    unique('scenario_run_step_run_step_key_unique').on(
      table.runId,
      table.stepKey,
    ),
    unique('scenario_run_step_run_ordinal_unique').on(
      table.runId,
      table.ordinal,
    ),
    check('scenario_run_step_ordinal_nonnegative', sql`${table.ordinal} >= 0`),
    check(
      'scenario_run_step_http_status_valid',
      sql`${table.httpStatus} is null or ${table.httpStatus} between 100 and 599`,
    ),
    check(
      'scenario_run_step_duration_nonnegative',
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
    check(
      'scenario_run_step_attempt_count_nonnegative',
      sql`${table.attemptCount} >= 0`,
    ),
    index('scenario_run_step_run_status_idx').on(table.runId, table.status),
  ],
);

export const deliveryAttempt = pgTable(
  'delivery_attempt',
  {
    id: uuid().defaultRandom().primaryKey(),
    stepId: uuid('step_id')
      .notNull()
      .references(() => scenarioRunStep.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    requestId: text('request_id').notNull().unique(),
    httpStatus: integer('http_status'),
    durationMs: integer('duration_ms'),
    responseRedacted: redactedJson('response_redacted'),
    errorCode: text('error_code'),
    createdAt: timestampWithTimezone('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('delivery_attempt_step_attempt_number_unique').on(
      table.stepId,
      table.attemptNumber,
    ),
    check('delivery_attempt_number_positive', sql`${table.attemptNumber} > 0`),
    check(
      'delivery_attempt_http_status_valid',
      sql`${table.httpStatus} is null or ${table.httpStatus} between 100 and 599`,
    ),
    check(
      'delivery_attempt_duration_nonnegative',
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
    index('delivery_attempt_step_created_at_idx').on(
      table.stepId,
      table.createdAt,
    ),
  ],
);

export const graphqlCallback = pgTable(
  'graphql_callback',
  {
    id: uuid().defaultRandom().primaryKey(),
    runId: uuid('run_id').references(() => scenarioRun.id, {
      onDelete: 'set null',
    }),
    requestId: text('request_id').notNull().unique(),
    operationName: text('operation_name').notNull(),
    idClienteHash: text('id_cliente_hash').notNull(),
    idProspectHash: text('id_prospect_hash').notNull(),
    normalizedCorrelationKeyHash: text(
      'normalized_correlation_key_hash',
    ).notNull(),
    policy: text().notNull(),
    httpStatus: integer('http_status').notNull(),
    requestRedacted: redactedJson('request_redacted'),
    responseRedacted: redactedJson('response_redacted'),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestampWithTimezone('created_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'graphql_callback_http_status_valid',
      sql`${table.httpStatus} between 100 and 599`,
    ),
    check(
      'graphql_callback_duration_nonnegative',
      sql`${table.durationMs} >= 0`,
    ),
    index('graphql_callback_run_created_at_idx').on(
      table.runId,
      table.createdAt,
    ),
    index('graphql_callback_correlation_key_idx').on(
      table.normalizedCorrelationKeyHash,
    ),
  ],
);

export const auditEvent = pgTable(
  'audit_event',
  {
    id: uuid().defaultRandom().primaryKey(),
    actor: text().notNull(),
    action: text().notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    metadataRedacted: redactedJson('metadata_redacted'),
    createdAt: timestampWithTimezone('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_event_resource_created_at_idx').on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
    index('audit_event_action_created_at_idx').on(
      table.action,
      table.createdAt,
    ),
  ],
);
