import { z } from 'zod';

const apexUtcDateTimePattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.000)?Z$/;

const maquinaEstadoDateTimeSchema = z
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

export const maquinaEstadoClienteSchema = z
  .object({
    idCliente: z.string().min(1),
    idProspectSalesforce: z.string().min(1),
  })
  .strict();

export const maquinaEstadoDataSchema = z
  .object({
    cliente: maquinaEstadoClienteSchema,
    id: z.string().min(1),
    dataalteracao: maquinaEstadoDateTimeSchema,
    estado: z.string().min(1),
    idunidade: z.string().min(1),
  })
  .strict();

const eventGridEnvelopeItemShape = {
  id: z.string().min(1),
  subject: z.string(),
  eventTime: maquinaEstadoDateTimeSchema,
  dataVersion: z.string(),
  metadataVersion: z.string(),
  topic: z.string(),
};

function eventVariant<T extends string>(eventType: T) {
  return z
    .object({
      ...eventGridEnvelopeItemShape,
      eventType: z.literal(eventType),
      data: maquinaEstadoDataSchema,
    })
    .strict();
}

export const jornadaUsuarioInsertEventSchema =
  eventVariant('jornadausuario-insert');
export const jornadaUsuarioUpdateEventSchema =
  eventVariant('jornadausuario-update');

export type MaquinaEstadoData = z.infer<typeof maquinaEstadoDataSchema>;
