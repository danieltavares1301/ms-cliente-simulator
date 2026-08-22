import { z } from 'zod';

const forbiddenDiagnosticKeys = ['stack', 'payload', 'token'];

const jsonValueSchema: z.ZodType<
  string | number | boolean | null | { [key: string]: unknown } | unknown[]
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

function findForbiddenDiagnosticKey(
  value: unknown,
  path: PropertyKey[] = [],
): PropertyKey[] | undefined {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const result = findForbiddenDiagnosticKey(item, [...path, index]);
      if (result) return result;
    }
    return undefined;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (
        forbiddenDiagnosticKeys.some((part) => normalizedKey.includes(part))
      ) {
        return [...path, key];
      }
      const result = findForbiddenDiagnosticKey(item, [...path, key]);
      if (result) return result;
    }
  }

  return undefined;
}

const safeErrorDetailsSchema = z
  .record(z.string(), jsonValueSchema)
  .superRefine((details, context) => {
    const forbiddenPath = findForbiddenDiagnosticKey(details);
    if (forbiddenPath) {
      context.addIssue({
        code: 'custom',
        message: 'Error details contain a forbidden diagnostic field',
        path: forbiddenPath,
      });
    }
  });

export const restErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        requestId: z.string().min(1),
        details: safeErrorDetailsSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    version: z.string().min(1),
    orchestration: z.enum(['disabled', 'configured']),
    dependencies: z
      .object({
        application: z.literal('ok'),
        configuration: z.literal('ok'),
      })
      .strict(),
  })
  .strict();

export type RestErrorResponse = z.infer<typeof restErrorResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
