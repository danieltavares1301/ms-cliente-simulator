import { z } from 'zod';

import { apexCompatibleUtcDateTimeSchema } from './event-grid';

export const pacCreditoRequestSchema = z
  .object({
    IdSalesforcePac: z.string().min(1),
    IdPac: z.string().min(1),
    IdJornada: z.string().min(1).nullable().optional(),
    DataCriacao: apexCompatibleUtcDateTimeSchema,
  })
  .strict();

export type PacCreditoRequest = z.infer<typeof pacCreditoRequestSchema>;
