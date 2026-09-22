import { z } from 'zod';

import {
  apexCompatibleUtcDateTimeSchema,
  eventGridEnvelopeSchema,
} from './event-grid.ts';
import {
  asyncPolicySchema,
  deliveryPolicySchema,
  renderedExpectedOutcomeSchema,
  scenarioGraphqlResponseSchema,
} from './scenarios.ts';

const renderedEnvelopeSchema = eventGridEnvelopeSchema;

const renderedAccountSchema = z
  .object({
    idCliente: z.string().min(1).max(50).nullable(),
    idProspect: z.string().min(1).max(50),
    cpf: z.string().regex(/^\d{11}$/),
    name: z.string().min(1).max(80),
    dataAlteracao: apexCompatibleUtcDateTimeSchema,
  })
  .strict();

const renderedLeadSchema = z
  .object({
    idExterno: z.string().min(1).max(150).optional(),
    cpf: z.string().regex(/^\d{11}$/),
    firstName: z.string().min(1).max(40).optional(),
    lastName: z.string().min(1).max(80),
    email: z.string().min(1).max(80).optional(),
    celular: z.string().min(1).max(40).optional(),
    cidadeInteresse: z.string().min(1).max(255).optional(),
    status: z.string().min(1).max(80).default('Pendente de Distribuição'),
    descricaoOrigem: z.string().min(1).max(255).optional(),
  })
  .strict();

const renderedOpportunitySchema = z
  .object({
    idExterno: z.string().min(1).max(50),
    accountId: z.string().min(1).max(50),
    name: z.string().min(1).max(120),
    stageName: z.string().min(1).max(255),
    closeDate: z.iso.date(),
  })
  .strict();

const renderedLeadAbsentKeysSchema = z
  .object({
    idExterno: z.string().min(1).max(150).optional(),
    cpf: z
      .string()
      .regex(/^\d{11}$/)
      .optional(),
    email: z.string().min(1).max(80).optional(),
    celular: z.string().min(1).max(40).optional(),
  })
  .strict()
  .refine(
    ({ idExterno, cpf, email, celular }) =>
      idExterno !== undefined ||
      cpf !== undefined ||
      email !== undefined ||
      celular !== undefined,
    { message: 'ENSURE_LEAD_ABSENT requires at least one key' },
  );

export const renderedSetupInstructionSchema = z.discriminatedUnion(
  'operation',
  [
    z
      .object({
        operation: z.literal('CREATE_SYNTHETIC_ACCOUNT'),
        role: z.enum(['PRIMARY', 'CONTROL']).default('PRIMARY'),
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
    z
      .object({
        operation: z.literal('CREATE_SYNTHETIC_LEAD'),
        role: z.enum(['PRIMARY', 'COLLISION']),
        lead: renderedLeadSchema,
      })
      .strict(),
    z
      .object({
        operation: z.literal('CREATE_SYNTHETIC_OPPORTUNITY'),
        opportunity: renderedOpportunitySchema,
      })
      .strict(),
    z
      .object({
        operation: z.literal('ENSURE_LEAD_ABSENT'),
        keys: renderedLeadAbsentKeysSchema,
      })
      .strict(),
  ],
);

const renderedCleanupInstructionSchema = z.discriminatedUnion('target', [
  z
    .object({
      operation: z.literal('DELETE_OWNED_RECORDS'),
      target: z.literal('ACCOUNT'),
      ownership: z
        .object({
          idCliente: z.string().min(1).max(50),
          controlAccountIdCliente: z.string().min(1).max(50).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('DELETE_OWNED_RECORDS'),
      target: z.literal('LEAD'),
      ownership: z
        .object({
          idExternoPrefix: z.literal('LEAD-SIM-'),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('DELETE_OWNED_RECORDS'),
      target: z.literal('CLIENT_STRUCTURE'),
      ownership: z
        .object({
          idCliente: z.string().min(1).max(50),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('DELETE_OWNED_RECORDS'),
      target: z.literal('OPPORTUNITY'),
      ownership: z
        .object({
          idExterno: z.string().min(1).max(50),
          pacIdExterno: z.string().min(1).max(50),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('DELETE_OWNED_RECORDS'),
      target: z.literal('PROPONENTE'),
      ownership: z
        .object({
          proponentes: z
            .array(
              z
                .object({
                  idExterno: z.string().min(1).max(50),
                  idCliente: z.string().min(1).max(50),
                })
                .strict(),
            )
            .min(1)
            .max(20),
          pacIdExterno: z.string().min(1).max(50),
        })
        .strict(),
    })
    .strict(),
]);

const pacEventTypeSchema = z.enum(['pac-insert', 'pac-update']);

const renderedFixtureStepSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    target: z.enum(['CLIENTE', 'PAC']),
    eventType: z.union([
      z.enum([
        'cliente-insert',
        'cliente-update',
        'contato-insert',
        'endereco-insert',
      ]),
      pacEventTypeSchema,
    ]),
    delayMs: z.number().int().nonnegative(),
    scheduledAt: apexCompatibleUtcDateTimeSchema,
    deliveryPolicy: deliveryPolicySchema,
    envelope: renderedEnvelopeSchema,
  })
  .strict()
  .superRefine(({ target, eventType, envelope }, context) => {
    const event = envelope[0];
    if (event.eventType !== eventType) {
      context.addIssue({
        code: 'custom',
        message: 'Rendered event type must match its step',
        path: ['envelope', 0, 'eventType'],
      });
    }
    const isPacEvent = pacEventTypeSchema.safeParse(eventType).success;
    if (target === 'PAC' && !isPacEvent) {
      context.addIssue({
        code: 'custom',
        message: 'PAC steps only accept pac-insert or pac-update events',
        path: ['target'],
      });
    }
    if (target === 'CLIENTE' && isPacEvent) {
      context.addIssue({
        code: 'custom',
        message: 'CLIENTE steps cannot dispatch PAC events',
        path: ['target'],
      });
    }
  });

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
        controlAccountIdCliente: z.string().min(1).max(50).optional(),
        controlAccountIdProspect: z.string().min(1).max(50).optional(),
        leadIdExterno: z.string().min(1).max(150),
        collisionLeadIdExterno: z.string().min(1).max(150).optional(),
      })
      .strict()
      .refine(
        ({ controlAccountIdCliente, controlAccountIdProspect }) =>
          (controlAccountIdCliente === undefined &&
            controlAccountIdProspect === undefined) ||
          (controlAccountIdCliente !== undefined &&
            controlAccountIdProspect !== undefined),
        {
          message:
            'Control Account identifiers must either both be present or both be omitted',
        },
      )
      .refine(
        ({ accountIdProspect, leadIdExterno }) =>
          accountIdProspect === leadIdExterno,
        { message: 'Account prospect and Lead external ID must match' },
      ),
    setup: z.array(renderedSetupInstructionSchema).min(1).max(20),
    steps: z.array(renderedFixtureStepSchema).min(1).max(100),
    expectedOutcomes: z.array(renderedExpectedOutcomeSchema).min(1).max(20),
    asyncPolicy: asyncPolicySchema,
    graphqlResponse: scenarioGraphqlResponseSchema.optional(),
    cleanup: z.array(renderedCleanupInstructionSchema).min(1).max(20),
  })
  .strict()
  .superRefine(({ identifiers, setup, cleanup }, context) => {
    const syntheticAccountSetups = setup.filter(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_ACCOUNT',
    );
    const primaryAccounts = syntheticAccountSetups.filter(
      (instruction) => instruction.role === 'PRIMARY',
    );
    const controlAccounts = syntheticAccountSetups.filter(
      (instruction) => instruction.role === 'CONTROL',
    );
    const syntheticLeadSetups = setup.filter(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_LEAD',
    );
    const syntheticOpportunitySetups = setup.filter(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    const primaryLeads = syntheticLeadSetups.filter(
      (instruction) => instruction.role === 'PRIMARY',
    );
    const collisionLeads = syntheticLeadSetups.filter(
      (instruction) => instruction.role === 'COLLISION',
    );

    if (primaryAccounts.length > 1) {
      context.addIssue({
        code: 'custom',
        message: 'At most one PRIMARY synthetic account is allowed',
        path: ['setup'],
      });
    }
    if (controlAccounts.length > 1) {
      context.addIssue({
        code: 'custom',
        message: 'At most one CONTROL synthetic account is allowed',
        path: ['setup'],
      });
    }
    if (primaryLeads.length > 1) {
      context.addIssue({
        code: 'custom',
        message: 'At most one PRIMARY synthetic lead is allowed',
        path: ['setup'],
      });
    }
    if (collisionLeads.length > 1) {
      context.addIssue({
        code: 'custom',
        message: 'At most one COLLISION synthetic lead is allowed',
        path: ['setup'],
      });
    }
    if (syntheticOpportunitySetups.length > 1) {
      context.addIssue({
        code: 'custom',
        message: 'At most one synthetic Opportunity is allowed',
        path: ['setup'],
      });
    }

    if (
      controlAccounts.length === 1 &&
      (identifiers.controlAccountIdCliente === undefined ||
        identifiers.controlAccountIdProspect === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Rendered fixture identifiers must include the control Account ids',
        path: ['identifiers'],
      });
    }
    if (
      controlAccounts.length === 0 &&
      (identifiers.controlAccountIdCliente !== undefined ||
        identifiers.controlAccountIdProspect !== undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Control Account identifiers are only allowed when a CONTROL account exists',
        path: ['identifiers'],
      });
    }
    if (
      collisionLeads.length === 1 &&
      identifiers.collisionLeadIdExterno === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Rendered fixture identifiers must include the collision Lead external id',
        path: ['identifiers', 'collisionLeadIdExterno'],
      });
    }
    if (
      collisionLeads.length === 0 &&
      identifiers.collisionLeadIdExterno !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Collision Lead identifier is only allowed when a COLLISION lead exists',
        path: ['identifiers', 'collisionLeadIdExterno'],
      });
    }

    for (const [index, cleanupInstruction] of cleanup.entries()) {
      if (cleanupInstruction.target === 'ACCOUNT') {
        if (controlAccounts.length === 1) {
          if (
            cleanupInstruction.ownership.controlAccountIdCliente !==
            identifiers.controlAccountIdCliente
          ) {
            context.addIssue({
              code: 'custom',
              message:
                'Account cleanup must include the control Account ownership id',
              path: ['cleanup', index, 'ownership', 'controlAccountIdCliente'],
            });
          }
          continue;
        }

        if (
          cleanupInstruction.ownership.controlAccountIdCliente !== undefined
        ) {
          context.addIssue({
            code: 'custom',
            message:
              'Account cleanup cannot declare a control ownership id without a CONTROL account',
            path: ['cleanup', index, 'ownership', 'controlAccountIdCliente'],
          });
        }
        continue;
      }
      if (
        cleanupInstruction.target === 'OPPORTUNITY' &&
        syntheticOpportunitySetups[0]?.opportunity.idExterno !==
          cleanupInstruction.ownership.idExterno
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Opportunity cleanup ownership must match the setup',
          path: ['cleanup', index, 'ownership', 'idExterno'],
        });
      }
    }
  });

export type RenderedScenarioFixture = z.infer<
  typeof renderedScenarioFixtureSchema
>;
export type RenderedFixtureStep = z.infer<typeof renderedFixtureStepSchema>;
export type RenderedSetupInstruction = z.infer<
  typeof renderedSetupInstructionSchema
>;
