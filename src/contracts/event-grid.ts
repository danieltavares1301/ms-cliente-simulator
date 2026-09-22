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

function forbidDataId<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.superRefine((data, context) => {
    const eventData = data as {
      id?: string;
    };
    if (eventData.id) {
      context.addIssue({
        code: 'custom',
        message:
          'data.id must be omitted; Apex only populates IdCliente when it falls back to data.idcliente',
        path: ['id'],
      });
    }
  });
}

const clienteDataSchema = forbidDataId(
  z
    .object({
      ...commonEventDataShape,
      categoria: optionalText,
      codsap: optionalText,
      datanascimento: z.iso.date().optional(),
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

const contatoDataSchema = forbidDataId(
  z
    .object({
      ...commonEventDataShape,
      tipocontato: z.enum(['Email', 'Celular', 'Telefone']),
      descricao: z.string().min(1),
    })
    .strict(),
);

const enderecoDataSchema = forbidDataId(
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

const pacProponenteDataSchema = z
  .object({
    comprova36MesesApurado: z.boolean().optional(),
    cpfConjuge: optionalText,
    cpf: z.string().min(1),
    declaraImpostoRendaDesc: optionalText,
    declaraImpostoRenda: optionalText,
    email: optionalText,
    estadoCivilChklistDesc: optionalText,
    scoreSerasa: z.number().int().optional(),
    estadoCivil: optionalText,
    fatorSocial: optionalText,
    fatorSocialDesc: optionalText,
    fonteRenda: optionalText,
    fonteRendaDesc: optionalText,
    grauInstrucao: optionalText,
    id: z.string().min(1),
    idPac: z.string().min(1),
    idCliente: z.string().min(1),
    idProponente: optionalText,
    nomeCompleto: optionalText,
    nomeConjuge: optionalText,
    possui3AnosCarteiraDesc: optionalText,
    possui3AnosCarteira: optionalText,
    possuiImovelNaMesmaCidadeDoEmpreendimento: z.boolean().optional(),
    possuiSubsidioGoverno: optionalText,
    possuiSubsidioGovernoDesc: optionalText,
    telefoneCelular: optionalText,
    tipoNotificacao: optionalText,
    valorFGTSApurado: z.number().finite().optional(),
    tipoClassificacao: z.string().min(1),
    rendaTotal: z.number().finite().optional(),
    dataNascimento: z.iso.date().optional(),
    dataAlteracao: apexCompatibleUtcDateTimeSchema,
  })
  .strict();

const pacDataSchema = z
  .object({
    id: z.string().min(1),
    idjornadapac: z.string().min(1),
    status: optionalText,
    datavalidade: z.iso.date().optional(),
    dataaprovacao: apexCompatibleUtcDateTimeSchema.optional(),
    dataalteracao: apexCompatibleUtcDateTimeSchema.optional(),
    proponentes: z.array(pacProponenteDataSchema).max(100).optional(),
  })
  .strict();

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
  'pac-insert',
  'pac-update',
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
export const pacInsertEventSchema = eventVariant('pac-insert', pacDataSchema);
export const pacUpdateEventSchema = eventVariant('pac-update', pacDataSchema);

export const eventGridEventSchema = z.discriminatedUnion('eventType', [
  clienteInsertEventSchema,
  clienteUpdateEventSchema,
  contatoInsertEventSchema,
  contatoUpdateEventSchema,
  enderecoInsertEventSchema,
  enderecoUpdateEventSchema,
  pacInsertEventSchema,
  pacUpdateEventSchema,
]);

export const eventGridEnvelopeSchema = z.array(eventGridEventSchema).length(1);

export type EventGridEvent = z.infer<typeof eventGridEventSchema>;
export type EventGridEnvelope = z.infer<typeof eventGridEnvelopeSchema>;
