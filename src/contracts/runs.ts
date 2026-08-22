import { z } from 'zod';

import { apexCompatibleUtcDateTimeSchema } from './event-grid';
import { paginationMetadataSchema } from './scenarios';

const scenarioKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const runIdSchema = z.string().uuid();

export const createRunRequestSchema = z
  .object({
    scenarioKey: scenarioKeySchema,
    scenarioVersion: z.number().int().positive().max(10_000),
    variables: z
      .object({
        seed: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Za-z0-9_-]+$/),
        eventStartAt: apexCompatibleUtcDateTimeSchema,
      })
      .strict(),
    execution: z
      .object({
        dryRun: z.boolean(),
        speed: z.number().finite().min(0.1).max(100),
        stopOnFailure: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const idempotencyKeySchema = z.string().uuid();

export const cancellationReasonCodeSchema = z.enum([
  'OPERATOR_REQUEST',
  'INCIDENT_RESPONSE',
  'SUPERSEDED',
]);

export const cancelRunRequestSchema = z
  .object({
    reasonCode: cancellationReasonCodeSchema.optional(),
  })
  .strict();

const retryStepKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

export const retryRunRequestSchema = z
  .object({
    stepKeys: z.array(retryStepKeySchema).min(1).max(100).optional(),
  })
  .strict()
  .refine(
    ({ stepKeys }) =>
      stepKeys === undefined || new Set(stepKeys).size === stepKeys.length,
    { message: 'stepKeys must be unique' },
  );

const optionalQueryValue = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );

export const runStatusSchema = z.enum([
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

export const runListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: optionalQueryValue(runStatusSchema),
    scenarioKey: optionalQueryValue(scenarioKeySchema),
    createdFrom: optionalQueryValue(apexCompatibleUtcDateTimeSchema),
    createdTo: optionalQueryValue(apexCompatibleUtcDateTimeSchema),
  })
  .strict()
  .refine(
    ({ createdFrom, createdTo }) =>
      createdFrom === undefined ||
      createdTo === undefined ||
      Date.parse(createdFrom) <= Date.parse(createdTo),
    { message: 'createdFrom must not exceed createdTo' },
  );

export const runStepsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const runResponseSchema = z
  .object({
    runId: runIdSchema,
    status: runStatusSchema,
    scenarioKey: scenarioKeySchema,
    scenarioVersion: z.number().int().positive(),
    dryRun: z.boolean(),
    createdAt: z.string().datetime(),
    stepsUrl: z.string().startsWith('/api/v1/runs/'),
  })
  .strict();

export const dryRunPreviewSchema = z
  .object({
    eventStartAt: z.string().datetime(),
    setup: z.array(
      z
        .object({
          operation: z.string().min(1).max(64),
          target: z.string().min(1).max(64),
        })
        .strict(),
    ),
    steps: z.array(
      z
        .object({
          key: z.string().min(1).max(100),
          target: z.string().min(1).max(64),
          eventType: z.string().min(1).max(100),
          scheduledAt: z.string().datetime(),
        })
        .strict(),
    ),
    assertions: z.array(
      z
        .object({
          kind: z.string().min(1).max(64),
          checks: z.array(z.string().min(1).max(100)).max(20),
        })
        .strict(),
    ),
    cleanup: z.array(
      z
        .object({
          operation: z.string().min(1).max(64),
          target: z.string().min(1).max(64),
        })
        .strict(),
    ),
  })
  .strict();

export const createRunResponseSchema = z
  .object({
    data: runResponseSchema,
    replayed: z.boolean(),
    preview: dryRunPreviewSchema.optional(),
  })
  .strict();

export const runListResponseSchema = z
  .object({
    data: z.array(runResponseSchema),
    pagination: paginationMetadataSchema,
  })
  .strict();

export const runStepResponseSchema = z
  .object({
    stepId: z.string().uuid(),
    key: z.string().min(1).max(100),
    ordinal: z.number().int().nonnegative(),
    kind: z.enum(['SETUP', 'DISPATCH', 'VERIFY', 'CLEANUP']),
    target: z.string().min(1).max(64),
    eventType: z.string().min(1).max(100).nullable(),
    status: z.enum([
      'PENDING',
      'SCHEDULED',
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'SKIPPED',
    ]),
    scheduledAt: z.string().datetime().nullable(),
    attemptCount: z.number().int().nonnegative(),
  })
  .strict();

export const runStepListResponseSchema = z
  .object({
    data: z.array(runStepResponseSchema),
    pagination: paginationMetadataSchema,
  })
  .strict();

export const runActionResponseSchema = z
  .object({
    data: z
      .object({
        runId: runIdSchema,
        status: runStatusSchema,
        affectedStepCount: z.number().int().nonnegative(),
      })
      .strict(),
    replayed: z.boolean(),
  })
  .strict();

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;
export type DryRunPreview = z.infer<typeof dryRunPreviewSchema>;
export type RunListQuery = z.infer<typeof runListQuerySchema>;
export type RunStepsQuery = z.infer<typeof runStepsQuerySchema>;
export type CancellationReasonCode = z.infer<
  typeof cancellationReasonCodeSchema
>;
export type CancelRunRequest = z.infer<typeof cancelRunRequestSchema>;
export type RetryRunRequest = z.infer<typeof retryRunRequestSchema>;
