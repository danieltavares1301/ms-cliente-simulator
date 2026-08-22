import { z } from 'zod';

const apexUtcDateTimePattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.000)?Z$/;

export const apexCompatibleUtcDateTimeSchema = z
  .string()
  .regex(
    apexUtcDateTimePattern,
    'Expected UTC datetime ending in Z, with no fraction or exactly .000',
  )
  .refine((value) => {
    const parsed = new Date(value);
    const normalizedInput = value.endsWith('.000Z')
      ? value
      : value.replace(/Z$/, '.000Z');
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString() === normalizedInput
    );
  }, 'Invalid UTC datetime');

const optionalText = z.string().min(1).optional();

const commonEventDataShape = {
  id: optionalText,
  idcliente: z.string().min(1),
  idprospectsalesforce: optionalText,
  numerocpf: optionalText,
  dataalteracao: apexCompatibleUtcDateTimeSchema.optional(),
};

function requireConsistentClientIds<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
) {
  return schema.superRefine((data, context) => {
    const eventData = data as {
      id?: string;
      idcliente?: string;
    };
    if (eventData.id && eventData.id !== eventData.idcliente) {
      context.addIssue({
        code: 'custom',
        message: 'data.id must equal data.idcliente when both are present',
        path: ['id'],
      });
    }
  });
}

const clienteDataSchema = requireConsistentClientIds(
  z
    .object({
      ...commonEventDataShape,
      categoria: optionalText,
      codsap: optionalText,
      datanascimento: optionalText,
      escolaridade: optionalText,
      estadocivil: optionalText,
      naturalidade: optionalText,
      nomecompleto: optionalText,
      nomemae: optionalText,
      nomepai: optionalText,
      numeropis: optionalText,
      numerodocumento: optionalText,
      orgaoemissordocumento: optionalText,
      profissao: optionalText,
      sistemaorigem: optionalText,
      tipopessoa: optionalText,
      tituloeleitor: optionalText,
      sexo: optionalText,
    })
    .strict(),
);

const contatoDataSchema = requireConsistentClientIds(
  z
    .object({
      ...commonEventDataShape,
      tipocontato: z.enum(['Email', 'Celular', 'Telefone']),
      descricao: z.string().min(1),
    })
    .strict(),
);

const enderecoDataSchema = requireConsistentClientIds(
  z
    .object({
      ...commonEventDataShape,
      tipoendereco: z.literal('COBRANCA'),
      idcidade: optionalText,
      logradouro: optionalText,
      numerocep: optionalText,
      bairro: optionalText,
      numero: optionalText,
    })
    .strict(),
);

const eventGridEnvelopeItemShape = {
  id: z.string().min(1),
  subject: z.string(),
  eventTime: apexCompatibleUtcDateTimeSchema,
  dataVersion: z.string(),
  metadataVersion: z.string(),
  topic: z.string(),
};

function eventVariant<T extends string, D extends z.ZodType>(
  eventType: T,
  data: D,
) {
  return z
    .object({
      ...eventGridEnvelopeItemShape,
      eventType: z.literal(eventType),
      data,
    })
    .strict();
}

export const eventTypeSchema = z.enum([
  'cliente-insert',
  'cliente-update',
  'contato-insert',
  'contato-update',
  'endereco-insert',
  'endereco-update',
]);

export const clienteInsertEventSchema = eventVariant(
  'cliente-insert',
  clienteDataSchema,
);
export const clienteUpdateEventSchema = eventVariant(
  'cliente-update',
  clienteDataSchema,
);
export const contatoInsertEventSchema = eventVariant(
  'contato-insert',
  contatoDataSchema,
);
export const contatoUpdateEventSchema = eventVariant(
  'contato-update',
  contatoDataSchema,
);
export const enderecoInsertEventSchema = eventVariant(
  'endereco-insert',
  enderecoDataSchema,
);
export const enderecoUpdateEventSchema = eventVariant(
  'endereco-update',
  enderecoDataSchema,
);

export const eventGridEventSchema = z.discriminatedUnion('eventType', [
  clienteInsertEventSchema,
  clienteUpdateEventSchema,
  contatoInsertEventSchema,
  contatoUpdateEventSchema,
  enderecoInsertEventSchema,
  enderecoUpdateEventSchema,
]);

export const eventGridEnvelopeSchema = z.array(eventGridEventSchema).length(1);

export type EventGridEvent = z.infer<typeof eventGridEventSchema>;
export type EventGridEnvelope = z.infer<typeof eventGridEnvelopeSchema>;
