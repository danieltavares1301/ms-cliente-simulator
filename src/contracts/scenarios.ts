import { z } from 'zod';

import { eventTypeSchema } from './event-grid';

const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safePublicTextPattern = /^[^<>\u0000-\u001f\u007f]+$/u;

const safePublicTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(safePublicTextPattern);

const kebabCaseSchema = z.string().trim().regex(kebabCasePattern);
const normalizedTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(kebabCasePattern);

export const scenarioScopeSchema = z.enum(['CORE', 'EXTENDED']);
export const scenarioAvailabilitySchema = z.enum(['CONTRACT_ONLY', 'READY']);

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    tag: z.preprocess(
      (value) => (value === '' ? undefined : value),
      normalizedTagSchema.optional(),
    ),
    scope: scenarioScopeSchema.optional(),
  })
  .strict();

export const paginationMetadataSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const scenarioMetadataSchema = z
  .object({
    key: kebabCaseSchema,
    version: z.number().int().positive(),
    name: safePublicTextSchema,
    description: safePublicTextSchema,
    scope: scenarioScopeSchema,
    tags: z.array(normalizedTagSchema),
    availability: scenarioAvailabilitySchema,
  })
  .strict();

const variableDescriptionSchema = safePublicTextSchema.optional();

const stringVariableSchema = z
  .object({
    type: z.literal('string'),
    description: variableDescriptionSchema,
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    enum: z.array(z.string().max(200)).min(1).max(100).optional(),
  })
  .strict()
  .refine(
    ({ minLength, maxLength }) =>
      minLength === undefined ||
      maxLength === undefined ||
      minLength <= maxLength,
    { message: 'minLength must not exceed maxLength' },
  );

const numericVariableShape = {
  description: variableDescriptionSchema,
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
};

const numberVariableSchema = z
  .object({ type: z.literal('number'), ...numericVariableShape })
  .strict()
  .refine(
    ({ minimum, maximum }) =>
      minimum === undefined || maximum === undefined || minimum <= maximum,
    { message: 'minimum must not exceed maximum' },
  );

const integerVariableSchema = z
  .object({ type: z.literal('integer'), ...numericVariableShape })
  .strict()
  .refine(
    ({ minimum, maximum }) =>
      minimum === undefined || maximum === undefined || minimum <= maximum,
    { message: 'minimum must not exceed maximum' },
  );

const booleanVariableSchema = z
  .object({
    type: z.literal('boolean'),
    description: variableDescriptionSchema,
  })
  .strict();

export const scenarioVariableSchema = z.discriminatedUnion('type', [
  stringVariableSchema,
  numberVariableSchema,
  integerVariableSchema,
  booleanVariableSchema,
]);

export const scenarioVariablesSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(kebabCaseSchema, scenarioVariableSchema),
    required: z.array(kebabCaseSchema),
    additionalProperties: z.literal(false),
  })
  .strict()
  .superRefine(({ properties, required }, context) => {
    const uniqueRequired = new Set(required);
    if (uniqueRequired.size !== required.length) {
      context.addIssue({
        code: 'custom',
        message: 'Required variable names must be unique',
        path: ['required'],
      });
    }
    for (const requiredName of uniqueRequired) {
      if (!(requiredName in properties)) {
        context.addIssue({
          code: 'custom',
          message: 'Required variable must have a declared property',
          path: ['required'],
        });
      }
    }
  });

const templateReferenceSchema = z.discriminatedUnion('source', [
  z
    .object({
      source: z.literal('VARIABLE'),
      path: kebabCaseSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal('GENERATED'),
      value: z.enum(['RUN_ID', 'STEP_ID', 'EVENT_TIME']),
    })
    .strict(),
]);

type PayloadTemplateValue =
  | string
  | number
  | boolean
  | null
  | z.infer<typeof templateReferenceSchema>
  | PayloadTemplateValue[]
  | { [key: string]: PayloadTemplateValue };

const payloadTemplateValueSchema: z.ZodType<PayloadTemplateValue> = z.lazy(() =>
  z.union([
    z.string().max(500),
    z.number().finite(),
    z.boolean(),
    z.null(),
    templateReferenceSchema,
    z.array(payloadTemplateValueSchema).max(100),
    z.record(
      z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
      payloadTemplateValueSchema,
    ),
  ]),
);

export const payloadTemplateSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('CONTRACT_ONLY'),
      contract: z.literal('EVENT_GRID'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('DECLARATIVE'),
      contract: z.literal('EVENT_GRID'),
      value: z.record(
        z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
        payloadTemplateValueSchema,
      ),
    })
    .strict(),
]);

export const deliveryPolicySchema = z
  .object({
    duplicateCount: z.number().int().min(0).max(10),
    retryOn: z.array(z.number().int().min(100).max(599)).max(20),
    maxAttempts: z.number().int().min(1).max(10),
  })
  .strict();

export const scenarioStepSchema = z
  .object({
    key: kebabCaseSchema,
    target: z.enum(['CLIENTE', 'PAC', 'MAQUINA_ESTADO']),
    eventType: eventTypeSchema,
    delayMs: z.number().int().nonnegative(),
    payloadTemplate: payloadTemplateSchema,
    deliveryPolicy: deliveryPolicySchema,
  })
  .strict();

export const publicScenarioStepSchema = scenarioStepSchema.omit({
  payloadTemplate: true,
});

export const expectedOutcomeSchema = z
  .object({
    kind: z.literal('BUSINESS_RESULT'),
    result: z.enum([
      'ACCOUNT_UPDATED_ONLY',
      'CLIENT_ID_STAMPED_WITHOUT_DUPLICATE',
      'PERSON_ACCOUNT_CREATED',
      'CLIENT_STRUCTURE_CREATED_OR_COMPLETED',
    ]),
    description: safePublicTextSchema,
  })
  .strict();

const setupInstructionSchema = z
  .object({
    operation: z.enum([
      'ENSURE_MATCHING_ACCOUNT',
      'ENSURE_NO_MATCHING_ACCOUNT',
      'ENSURE_CLIENT_STRUCTURE_ABSENT',
    ]),
  })
  .strict();

const cleanupInstructionSchema = z
  .object({
    operation: z.literal('DELETE_OWNED_RECORDS'),
    target: z.enum(['ACCOUNT', 'LEAD', 'CLIENT_STRUCTURE']),
  })
  .strict();

const asyncPolicySchema = z
  .object({
    expectedCallbacks: z
      .object({
        min: z.number().int().nonnegative(),
        max: z.number().int().nonnegative(),
      })
      .strict()
      .refine(({ min, max }) => min <= max, {
        message: 'Callback minimum must not exceed maximum',
      }),
    waitTimeoutMs: z.number().int().nonnegative(),
    missingCallbackResult: z.enum(['SUCCESS', 'PARTIAL', 'FAILED']),
  })
  .strict();

const scenarioDefinitionBaseSchema = scenarioMetadataSchema.extend({
  variablesSchema: scenarioVariablesSchema,
  setup: z.array(setupInstructionSchema).max(20).optional(),
  steps: z.array(scenarioStepSchema).min(1).max(100),
  expectedOutcomes: z.array(expectedOutcomeSchema).min(1).max(20),
  asyncPolicy: asyncPolicySchema,
  cleanup: z.array(cleanupInstructionSchema).max(20).optional(),
});

export const scenarioDefinitionSchema = scenarioDefinitionBaseSchema
  .superRefine(({ steps }, context) => {
    if (new Set(steps.map(({ key }) => key)).size !== steps.length) {
      context.addIssue({
        code: 'custom',
        message: 'Step keys must be unique',
        path: ['steps'],
      });
    }
  })
  .transform((definition) => ({
    ...definition,
    tags: [...new Set(definition.tags)].sort(),
  }));

export const scenarioListResponseSchema = z
  .object({
    data: z.array(scenarioMetadataSchema),
    pagination: paginationMetadataSchema,
  })
  .strict();

export const scenarioDetailSchema = scenarioMetadataSchema
  .extend({
    variablesSchema: scenarioVariablesSchema,
    steps: z.array(publicScenarioStepSchema),
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
export type ScenarioMetadata = z.infer<typeof scenarioMetadataSchema>;
export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>;
export type ScenarioListResponse = z.infer<typeof scenarioListResponseSchema>;
export type ScenarioDetail = z.infer<typeof scenarioDetailSchema>;
