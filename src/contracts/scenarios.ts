import { z } from 'zod';

export const scenarioScopeSchema = z.enum(['CORE', 'EXTENDED']);

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    tag: z.string().min(1).optional(),
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
    key: z.string().min(1),
    version: z.number().int().positive(),
    name: z.string().min(1),
    scope: scenarioScopeSchema,
    tags: z.array(z.string().min(1)),
  })
  .strict();

export const scenarioListResponseSchema = z
  .object({
    data: z.array(scenarioMetadataSchema),
    pagination: paginationMetadataSchema,
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
export type ScenarioMetadata = z.infer<typeof scenarioMetadataSchema>;
export type ScenarioListResponse = z.infer<typeof scenarioListResponseSchema>;
