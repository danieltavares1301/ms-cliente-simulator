import { z } from 'zod';

const optionalNullableStringSchema = z.string().nullable().optional();

export const contestacaoInsertRequestSchema = z
  .object({
    idPac: optionalNullableStringSchema,
    idMotivo: optionalNullableStringSchema,
    descricao: optionalNullableStringSchema,
    usuarioSolucao: optionalNullableStringSchema,
  })
  .strict();

export const contestacaoDocumentosRequestSchema = z
  .object({
    IdJornada: optionalNullableStringSchema,
    MotivoContestacao: optionalNullableStringSchema,
  })
  .strict();

export type ContestacaoInsertRequest = z.infer<
  typeof contestacaoInsertRequestSchema
>;
export type ContestacaoDocumentosRequest = z.infer<
  typeof contestacaoDocumentosRequestSchema
>;
