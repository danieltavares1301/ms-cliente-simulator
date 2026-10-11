import { z } from 'zod';

import { eventDateTimeSchema } from './event-datetime.ts';

export const maquinaEstadoClienteSchema = z
  .object({
    idCliente: z.string().min(1).nullable(),
    idProspectSalesforce: z.string().min(1),
  })
  .strict();

export const maquinaEstadoDataSchema = z
  .object({
    cliente: maquinaEstadoClienteSchema,
    id: z.string().min(1),
    dataalteracao: eventDateTimeSchema,
    estado: z.string().min(1),
    idunidade: z.string().min(1),
  })
  .strict();

const eventGridEnvelopeItemShape = {
  id: z.string().min(1),
  subject: z.string(),
  eventTime: eventDateTimeSchema,
  dataVersion: z.string(),
  metadataVersion: z.string().optional(),
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
