import { z } from 'zod';

export const graphqlContentType = 'application/graphql' as const;
export type AtualizarClienteGraphqlRequestBody = string;

export const atualizarClienteInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    nomeCompleto: z.string().min(1).optional(),
    dataNascimento: z.string().min(1).optional(),
    cadastroNacional: z.string().min(1).optional(),
    numeroDocumento: z.string().min(1).optional(),
    dataEmissaoDocumento: z.string().min(1).optional(),
    estadoEmissorDocumento: z.string().min(1).optional(),
    naturalidade: z.string().min(1).optional(),
    escolaridade: z.string().min(1).optional(),
    nomeMae: z.string().min(1).optional(),
    renda: z.number().optional(),
    orgaoEmissorDocumento: z.string().min(1).optional(),
    nacionalidade: z.string().min(1).optional(),
    sexo: z.string().min(1).optional(),
    estadoCivil: z.string().min(1).optional(),
    idProspectSalesforce: z.string().min(1).optional(),
  })
  .strict();

export type AtualizarClienteInput = z.infer<typeof atualizarClienteInputSchema>;

export type AtualizarClienteOperation = {
  operation: 'mutation';
  field: 'atualizarCliente';
  cliente: AtualizarClienteInput;
  selection: readonly ['id'];
};

export const graphqlSuccessResponseSchema = z
  .object({
    data: z
      .object({
        atualizarCliente: z
          .object({
            id: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const graphqlErrorResponseSchema = z
  .object({
    errors: z
      .array(
        z
          .object({
            message: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const graphqlResponseSchema = z.union([
  graphqlSuccessResponseSchema,
  graphqlErrorResponseSchema,
]);

export const graphqlResponsePolicySchema = z.enum([
  'SUCCESS_200',
  'SUCCESS_201',
  'GRAPHQL_ERROR_200',
  'HTTP_400',
  'HTTP_401',
  'HTTP_429',
  'HTTP_500',
  'INVALID_JSON_200',
  'EMPTY_BODY_200',
  'DELAYED_RESPONSE',
]);

export type GraphqlResponse = z.infer<typeof graphqlResponseSchema>;
export type GraphqlResponsePolicy = z.infer<typeof graphqlResponsePolicySchema>;
