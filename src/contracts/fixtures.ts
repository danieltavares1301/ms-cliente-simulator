import { z } from 'zod';

import {
  apexCompatibleUtcDateTimeSchema,
  clienteInsertEventSchema,
  clienteUpdateEventSchema,
} from './event-grid.ts';
import {
  asyncPolicySchema,
  deliveryPolicySchema,
  expectedOutcomeSchema,
} from './scenarios.ts';

const clientEnvelopeSchema = z
  .array(z.union([clienteInsertEventSchema, clienteUpdateEventSchema]))
  .length(1);

const renderedAccountSchema = z
  .object({
    idCliente: z.string().min(1).max(50).nullable(),
    idProspect: z.string().min(1).max(50),
    cpf: z.string().regex(/^\d{11}$/),
    name: z.string().min(1).max(80),
    dataAlteracao: apexCompatibleUtcDateTimeSchema,
  })
  .strict();

export const renderedSetupInstructionSchema = z.discriminatedUnion(
  'operation',
  [
    z
      .object({
        operation: z.literal('CREATE_SYNTHETIC_ACCOUNT'),
        matchBy: z.enum(['ID_CLIENTE', 'CPF']),
        account: renderedAccountSchema,
      })
      .strict()
      .superRefine(({ matchBy, account }, context) => {
        if (matchBy === 'ID_CLIENTE' && account.idCliente === null) {
          context.addIssue({
            code: 'custom',
            message: 'ID_CLIENTE setup requires an idCliente',
            path: ['account', 'idCliente'],
          });
        }
        if (matchBy === 'CPF' && account.idCliente !== null) {
          context.addIssue({
            code: 'custom',
            message: 'CPF setup must start without an idCliente',
            path: ['account', 'idCliente'],
          });
        }
      }),
    z
      .object({
        operation: z.literal('ENSURE_ACCOUNT_ABSENT'),
        keys: z
          .object({
            idCliente: z.string().min(1).max(50),
            idProspect: z.string().min(1).max(50),
            cpf: z.string().regex(/^\d{11}$/),
          })
          .strict(),
      })
      .strict(),
  ],
);

const renderedCleanupInstructionSchema = z
  .object({
    operation: z.literal('DELETE_OWNED_RECORDS'),
    target: z.literal('ACCOUNT'),
    ownership: z
      .object({
        idCliente: z.string().min(1).max(50),
      })
      .strict(),
  })
  .strict();

const renderedFixtureStepSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    target: z.literal('CLIENTE'),
    eventType: z.enum(['cliente-insert', 'cliente-update']),
    delayMs: z.number().int().nonnegative(),
    scheduledAt: apexCompatibleUtcDateTimeSchema,
    deliveryPolicy: deliveryPolicySchema,
    envelope: clientEnvelopeSchema,
  })
  .strict()
  .superRefine(({ eventType, envelope, scheduledAt }, context) => {
    const event = envelope[0];
    if (event.eventType !== eventType) {
      context.addIssue({
        code: 'custom',
        message: 'Rendered event type must match its step',
        path: ['envelope', 0, 'eventType'],
      });
    }
    if (
      event.eventTime !== scheduledAt ||
      event.data.dataalteracao !== scheduledAt
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Rendered event dates must match scheduledAt',
        path: ['envelope', 0],
      });
    }
  });

const syntheticCpfOriginSchema = z
  .object({
    kind: z.literal('CPF'),
    generator: z.literal('DETERMINISTIC_CPF_V1'),
    proof: z.string().regex(/^[a-f0-9]{32}$/),
    paths: z
      .array(z.string().regex(/^\$(?:\.[A-Za-z_$][\w$]*|\[\d+\])+$/))
      .min(1),
  })
  .strict();

export const renderedScenarioFixtureSchema = z
  .object({
    scenarioKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.number().int().positive(),
    seed: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    runId: z.string().regex(/^run_[A-Za-z0-9_-]{1,64}$/),
    eventStartAt: apexCompatibleUtcDateTimeSchema,
    identifiers: z
      .object({
        accountIdCliente: z.string().min(1).max(50),
        accountIdProspect: z.string().min(1).max(50),
        leadIdExterno: z.string().min(1).max(150),
      })
      .strict()
      .refine(
        ({ accountIdProspect, leadIdExterno }) =>
          accountIdProspect === leadIdExterno,
        { message: 'Account prospect and Lead external ID must match' },
      ),
    setup: z.array(renderedSetupInstructionSchema).min(1).max(20),
    steps: z.array(renderedFixtureStepSchema).min(1).max(100),
    expectedOutcomes: z.array(expectedOutcomeSchema).min(1).max(20),
    asyncPolicy: asyncPolicySchema,
    cleanup: z.array(renderedCleanupInstructionSchema).min(1).max(20),
    syntheticOrigins: z.array(syntheticCpfOriginSchema).length(1),
  })
  .strict();

export type RenderedScenarioFixture = z.infer<
  typeof renderedScenarioFixtureSchema
>;
export type RenderedFixtureStep = z.infer<typeof renderedFixtureStepSchema>;
export type RenderedSetupInstruction = z.infer<
  typeof renderedSetupInstructionSchema
>;
