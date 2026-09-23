import { z } from 'zod';

import {
  renderedScenarioFixtureSchema,
  type RenderedScenarioFixture,
} from '../contracts/fixtures';
import {
  asAllowlistedQuery,
  escapeSoqlLiteral,
  getLeadGestaoVendasRecordTypeId,
  getPersonAccountRecordTypeId,
  type SalesforceCompositeRequest,
  type SalesforceRestClient,
} from './rest-client';

const adapterInputSchema = z
  .object({
    runId: z.string().regex(/^run_[A-Za-z0-9_-]{1,64}$/),
    scenarioKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    fixture: renderedScenarioFixtureSchema,
  })
  .strict()
  .superRefine(({ runId, scenarioKey, fixture }, context) => {
    if (runId !== fixture.runId) {
      context.addIssue({
        code: 'custom',
        message: 'Run does not match fixture',
        path: ['runId'],
      });
    }
    if (scenarioKey !== fixture.scenarioKey) {
      context.addIssue({
        code: 'custom',
        message: 'Scenario does not match fixture',
        path: ['scenarioKey'],
      });
    }

    const accountSetups = fixture.setup.filter(isSyntheticAccountSetup);
    const accountSetup = accountSetups.find(
      (instruction) => instruction.role === 'PRIMARY',
    );
    const controlAccountSetup = accountSetups.find(
      (instruction) => instruction.role === 'CONTROL',
    );
    const leadSetups = fixture.setup.filter(isSyntheticLeadSetup);
    const opportunitySetups = fixture.setup.filter(isSyntheticOpportunitySetup);
    const leadSetup = leadSetups.find(
      (instruction) => instruction.role === 'PRIMARY',
    );
    const collisionLeadSetup = leadSetups.find(
      (instruction) => instruction.role === 'COLLISION',
    );
    const absentAccountSetup = fixture.setup.find(
      (instruction) => instruction.operation === 'ENSURE_ACCOUNT_ABSENT',
    );
    const absentLeadSetup = fixture.setup.find(
      (instruction) => instruction.operation === 'ENSURE_LEAD_ABSENT',
    );
    const businessEvent = fixtureBusinessEvent(fixture);
    const businessEventCpf =
      'numerocpf' in businessEvent ? businessEvent.numerocpf : undefined;
    const setupCpf =
      businessEventCpf ??
      accountSetup?.account.cpf ??
      absentAccountSetup?.keys.cpf ??
      leadSetup?.lead.cpf ??
      absentLeadSetup?.keys.cpf;

    if (
      accountSetups.filter((instruction) => instruction.role === 'PRIMARY')
        .length > 1
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Fixture cannot declare more than one PRIMARY synthetic account',
        path: ['fixture', 'setup'],
      });
    }
    if (
      leadSetups.filter((instruction) => instruction.role === 'PRIMARY').length >
      1
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture cannot declare more than one PRIMARY synthetic lead',
        path: ['fixture', 'setup'],
      });
    }
    if (
      leadSetups.filter((instruction) => instruction.role === 'COLLISION')
        .length > 1
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Fixture cannot declare more than one COLLISION synthetic lead',
        path: ['fixture', 'setup'],
      });
    }
    if (
      accountSetups.filter((instruction) => instruction.role === 'CONTROL')
        .length > 1
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Fixture cannot declare more than one CONTROL synthetic account',
        path: ['fixture', 'setup'],
      });
    }
    if (opportunitySetups.length > 1) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture cannot declare more than one synthetic Opportunity',
        path: ['fixture', 'setup'],
      });
    }

    if (
      (accountSetup !== undefined || absentAccountSetup !== undefined) &&
      !fixture.identifiers.accountIdCliente.startsWith('CLI-SIM-')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture Account identifier is not simulator-owned',
        path: ['fixture', 'identifiers', 'accountIdCliente'],
      });
    }
    if (accountSetup !== undefined) {
      const accountIdsMatch =
        (accountSetup.matchBy === 'CPF' ||
          accountSetup.account.idCliente ===
            fixture.identifiers.accountIdCliente) &&
        accountSetup.account.idProspect ===
          fixture.identifiers.accountIdProspect;
      if (!accountIdsMatch) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture Account setup identifiers are inconsistent',
          path: ['fixture', 'setup'],
        });
      }
    }
    if (controlAccountSetup !== undefined) {
      const accountIdsMatch =
        controlAccountSetup.account.idCliente ===
          fixture.identifiers.controlAccountIdCliente &&
        controlAccountSetup.account.idProspect ===
          fixture.identifiers.controlAccountIdProspect;
      if (!accountIdsMatch) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture control Account setup identifiers are inconsistent',
          path: ['fixture', 'setup'],
        });
      }
    } else if (
      fixture.identifiers.controlAccountIdCliente !== undefined ||
      fixture.identifiers.controlAccountIdProspect !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Fixture control Account identifiers require a CONTROL synthetic account setup',
        path: ['fixture', 'identifiers'],
      });
    }
    if (absentAccountSetup !== undefined) {
      const accountIdsMatch =
        absentAccountSetup.keys.idCliente ===
          fixture.identifiers.accountIdCliente &&
        absentAccountSetup.keys.idProspect ===
          fixture.identifiers.accountIdProspect;
      if (!accountIdsMatch) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture Account absence keys are inconsistent',
          path: ['fixture', 'setup'],
        });
      }
    }
    if (
      leadSetup?.lead.idExterno !== undefined &&
      leadSetup.lead.idExterno !== fixture.identifiers.leadIdExterno
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture Lead external id is inconsistent',
        path: ['fixture', 'setup'],
      });
    }
    if (
      leadSetup?.lead.idExterno !== undefined &&
      !leadSetup.lead.idExterno.startsWith('LEAD-SIM-')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Synthetic Lead external id must be simulator-owned',
        path: ['fixture', 'setup'],
      });
    }
    if (
      collisionLeadSetup?.lead.idExterno !== undefined &&
      collisionLeadSetup.lead.idExterno !==
        fixture.identifiers.collisionLeadIdExterno
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture collision Lead external id is inconsistent',
        path: ['fixture', 'setup'],
      });
    }
    if (
      collisionLeadSetup?.lead.idExterno !== undefined &&
      !collisionLeadSetup.lead.idExterno.startsWith('LEAD-SIM-')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Collision Lead external id must be simulator-owned',
        path: ['fixture', 'setup'],
      });
    }
    if (
      absentLeadSetup?.keys.idExterno !== undefined &&
      absentLeadSetup.keys.idExterno !== fixture.identifiers.leadIdExterno &&
      absentLeadSetup.keys.idExterno !==
        fixture.identifiers.controlAccountIdProspect
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture Lead absence keys are inconsistent',
        path: ['fixture', 'setup'],
      });
    }

    for (const [index, step] of fixture.steps.entries()) {
      const event = step.envelope[0]?.data;
      const requiresPacFields =
        step.eventType === 'pac-insert' || step.eventType === 'pac-update';
      const requiresMaquinaEstadoFields =
        step.eventType === 'jornadausuario-insert' ||
        step.eventType === 'jornadausuario-update';
      const requiresClientFields =
        step.eventType === 'cliente-insert' ||
        step.eventType === 'cliente-update';
      const requiresContactFields = step.eventType === 'contato-insert';
      const requiresAddressFields = step.eventType === 'endereco-insert';
      const opportunitySetup = opportunitySetups[0];
      const expectedOpportunityExternalId =
        opportunitySetup?.opportunity.idExterno ??
        maquinaEstadoFixtureEvent(fixture)?.id;
      const pacPrimaryProponente =
        event !== undefined && isPacFixtureEventData(event)
          ? event.proponentes?.find(
              (proponente) => proponente.tipoClassificacao === 'Principal',
            )
          : undefined;
      const eventIdCliente =
        event !== undefined
          ? 'idcliente' in event
            ? event.idcliente
            : 'cliente' in event &&
                event.cliente !== null &&
                typeof event.cliente === 'object' &&
                'idCliente' in event.cliente
              ? (event.cliente as { idCliente?: string | null }).idCliente
              : undefined
          : undefined;
      const eventIdProspect =
        event !== undefined
          ? 'idprospectsalesforce' in event
            ? event.idprospectsalesforce
            : 'cliente' in event &&
                event.cliente !== null &&
                typeof event.cliente === 'object' &&
                'idProspectSalesforce' in event.cliente
              ? (event.cliente as { idProspectSalesforce?: string })
                  .idProspectSalesforce
              : undefined
          : undefined;
      const allowedPacClientIds = [
        fixture.identifiers.accountIdCliente,
        fixture.identifiers.controlAccountIdCliente,
      ].filter((value): value is string => value !== undefined);
      const usesAllowedMaquinaEstadoIdentity =
        isMaquinaEstadoFixtureEventData(event) &&
        event.id.startsWith('OPP-SIM-') &&
        ((event.cliente.idCliente === fixture.identifiers.accountIdCliente &&
          event.cliente.idProspectSalesforce ===
            fixture.identifiers.accountIdProspect) ||
          (fixture.identifiers.controlAccountIdCliente !== undefined &&
            event.cliente.idCliente ===
              fixture.identifiers.controlAccountIdCliente &&
            event.cliente.idProspectSalesforce ===
              fixture.identifiers.controlAccountIdProspect) ||
          (fixture.identifiers.controlAccountIdProspect !== undefined &&
            event.cliente.idCliente === null &&
            event.cliente.idProspectSalesforce ===
              fixture.identifiers.controlAccountIdProspect) ||
          (absentAccountSetup !== undefined &&
            event.cliente.idCliente === null &&
            event.cliente.idProspectSalesforce ===
              fixture.identifiers.accountIdProspect) ||
          (fixture.identifiers.controlAccountIdCliente === undefined &&
            event.cliente.idCliente?.startsWith('CLI-SIM-X-') === true &&
            event.cliente.idProspectSalesforce.startsWith('PRO-SIM-X-')));
      const usesAllowedIdentity =
        !requiresPacFields &&
        (requiresMaquinaEstadoFields
          ? usesAllowedMaquinaEstadoIdentity
          : (eventIdCliente !== undefined &&
              eventIdCliente === fixture.identifiers.accountIdCliente) ||
            (!requiresClientFields &&
              fixture.identifiers.controlAccountIdCliente !== undefined &&
              eventIdCliente === fixture.identifiers.controlAccountIdCliente));
      const allowsEchoedClientId =
        requiresClientFields &&
        eventIdProspect === fixture.identifiers.accountIdCliente;
      const allowsSyntheticNoMatchProspect =
        requiresMaquinaEstadoFields &&
        fixture.identifiers.controlAccountIdProspect === undefined &&
        eventIdCliente?.startsWith('CLI-SIM-X-') === true &&
        eventIdProspect?.startsWith('PRO-SIM-X-') === true;
      if (
        event === undefined ||
        (requiresPacFields &&
          (!isPacFixtureEventData(event) ||
            expectedOpportunityExternalId === undefined ||
            event.idjornadapac !== expectedOpportunityExternalId ||
            (event.proponentes !== undefined &&
              event.proponentes.some(
                (proponente) =>
                  proponente.idPac !== event.id ||
                  !allowedPacClientIds.includes(proponente.idCliente) ||
                  !proponente.id.startsWith('PROP-SIM-'),
              )) ||
            (pacPrimaryProponente !== undefined &&
              pacPrimaryProponente.cpf !== fixtureCpf(fixture)))) ||
        (requiresMaquinaEstadoFields && !usesAllowedMaquinaEstadoIdentity) ||
        (!requiresPacFields && !usesAllowedIdentity) ||
        (requiresClientFields &&
          (!isClientFixtureEventData(event) ||
            (setupCpf !== undefined && event.numerocpf !== setupCpf))) ||
        (requiresClientFields &&
          (!isClientFixtureEventData(event) ||
            event.nomecompleto === undefined)) ||
        (requiresContactFields &&
          (!isContactFixtureEventData(event) ||
            event.tipocontato === undefined)) ||
        (requiresContactFields &&
          (!isContactFixtureEventData(event) ||
            event.descricao === undefined)) ||
        (requiresAddressFields &&
          (!isAddressFixtureEventData(event) ||
            event.tipoendereco !== 'COBRANCA')) ||
        (requiresAddressFields &&
          (!isAddressFixtureEventData(event) ||
            event.logradouro === undefined)) ||
        (eventIdProspect !== undefined &&
          eventIdProspect !==
            fixture.identifiers.accountIdProspect &&
          eventIdProspect !==
            fixture.identifiers.controlAccountIdProspect &&
          !allowsSyntheticNoMatchProspect &&
          !allowsEchoedClientId)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture event identifiers are inconsistent',
          path: ['fixture', 'steps', index],
        });
      }
    }

    for (const cleanup of fixture.cleanup) {
      if (
        (cleanup.target === 'ACCOUNT' ||
          cleanup.target === 'CLIENT_STRUCTURE') &&
        cleanup.ownership.idCliente !== fixture.identifiers.accountIdCliente
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture cleanup ownership is inconsistent',
          path: ['fixture', 'cleanup'],
        });
      }
      if (
        cleanup.target === 'ACCOUNT' &&
        cleanup.ownership.controlAccountIdCliente !==
          fixture.identifiers.controlAccountIdCliente
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture control Account cleanup ownership is inconsistent',
          path: ['fixture', 'cleanup'],
        });
      }
      if (
        cleanup.target === 'LEAD' &&
        cleanup.ownership.idExternoPrefix !== 'LEAD-SIM-'
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture Lead cleanup ownership is inconsistent',
          path: ['fixture', 'cleanup'],
        });
      }
      if (
        cleanup.target === 'OPPORTUNITY' &&
        (cleanup.ownership.idExterno !==
          (opportunitySetups[0]?.opportunity.idExterno ??
            maquinaEstadoFixtureEvent(fixture)?.id) ||
          cleanup.ownership.pacIdExterno !== pacFixtureEvent(fixture)?.id)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture Opportunity cleanup ownership is inconsistent',
          path: ['fixture', 'cleanup'],
        });
      }
      if (
        cleanup.target === 'PROPONENTE' &&
        (() => {
          const expectedProponentes = pacFixtureOwnedProponentes(fixture);
          const expectedPairs = expectedProponentes.map(
            (proponente) => `${proponente.id}::${proponente.idCliente}`,
          );
          const actualPairs = cleanup.ownership.proponentes.map(
            (proponente) => `${proponente.idExterno}::${proponente.idCliente}`,
          );
          return (
            cleanup.ownership.pacIdExterno !== pacFixtureEvent(fixture)?.id ||
            JSON.stringify(actualPairs.sort()) !==
              JSON.stringify(expectedPairs.sort())
          );
        })()
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture Proponente cleanup ownership is inconsistent',
          path: ['fixture', 'cleanup'],
        });
      }
    }
  });

export type SalesforceTestDataAdapterInput = z.input<typeof adapterInputSchema>;

export type SalesforceTestDataAdapterErrorCode =
  | 'INVALID_FIXTURE'
  | 'SETUP_CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'OWNERSHIP_MISMATCH'
  | 'SALESFORCE_RESPONSE_INVALID';

export class SalesforceTestDataAdapterError extends Error {
  constructor(readonly code: SalesforceTestDataAdapterErrorCode) {
    super(code);
    this.name = 'SalesforceTestDataAdapterError';
  }
}

export type SalesforceTestDataSetupResult = {
  status: 'CREATED' | 'REPLAY' | 'READY';
  createdCount: number;
  replayedCount: number;
  recordIds: string[];
};

export type SalesforceTestDataVerificationCheck = {
  check:
    | 'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE'
    | 'ACCOUNT_COUNT_BY_CPF_IS_ONE'
    | 'ACCOUNT_NOT_CREATED'
    | 'ACCOUNT_CLIENT_ID_EQUALS_EVENT'
    | 'ACCOUNT_NAME_EQUALS_EVENT'
    | 'ACCOUNT_NAME_EQUALS_SETUP'
    | 'ACCOUNT_IS_PERSON_ACCOUNT'
    | 'ACCOUNT_CPF_EQUALS_EVENT'
    | 'ACCOUNT_CPF_EQUALS_SETUP'
    | 'ACCOUNT_EMAIL_EXCLUDED'
    | 'ACCOUNT_MOBILE_EXCLUDED'
    | 'ACCOUNT_EMAIL_EQUALS_EXPECTED'
    | 'ACCOUNT_MOBILE_EQUALS_EXPECTED'
    | 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED'
    | 'ACCOUNT_PROSPECT_ID_EQUALS_EXPECTED'
    | 'ACCOUNT_PROSPECT_ID_NOT_STAMPED'
    | 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED'
    | 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED'
    | 'CONTROL_ACCOUNT_UNCHANGED'
    | 'NO_OTHER_ACCOUNT_UPDATED'
    | 'LEAD_COUNT_BY_ID_EXTERNO_IS_ONE'
    | 'LEAD_COUNT_BY_CPF_IS_ONE'
    | 'LEAD_CPF_EQUALS_EVENT'
    | 'LEAD_EMAIL_EQUALS_EXPECTED'
    | 'LEAD_MOBILE_EQUALS_EXPECTED'
    | 'LEAD_EMAIL_EXCLUDED'
    | 'LEAD_MOBILE_EXCLUDED'
    | 'LEAD_DESCRICAO_ORIGEM_EQUALS'
    | 'LEAD_NOT_CREATED'
    | 'LEAD_NOT_REQUIRED'
    | 'PROPONENTE_NOT_REQUIRED'
    | 'PROPONENTE_NOT_PRESENT'
    | 'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE'
    | 'PROPONENTE_COUNT_EQUALS_EXPECTED'
    | 'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC'
    | 'PRIMARY_PROPONENTE_EMAIL_EQUALS_EXPECTED'
    | 'PRIMARY_PROPONENTE_MOBILE_EQUALS_EXPECTED'
    | 'CONTROL_PROPONENTE_EMAIL_EQUALS_EXPECTED'
    | 'CONTROL_PROPONENTE_MOBILE_EQUALS_EXPECTED'
    | 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT'
    | 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE'
    | 'OPPORTUNITY_LINE_ITEM_PRODUCT_EXTERNAL_ID_EQUALS_EXPECTED'
    | 'OPPORTUNITY_NOT_CREATED'
    | 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED'
    | 'OPPORTUNITY_STAGE_EQUALS_EXPECTED'
    | 'OPPORTUNITY_UNIDADE_EXTERNAL_ID_EQUALS_EXPECTED'
    | 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED'
    | 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY';
  passed: boolean;
  actualCount?: number;
};

export type SalesforceTestDataVerifyResult = {
  passed: boolean;
  checks: SalesforceTestDataVerificationCheck[];
  recordIds: string[];
};

export type SalesforceTestDataCleanupResult = {
  status: 'DELETED' | 'NO_OP';
  deletedCount: number;
};

export interface SalesforceTestDataAdapter {
  setup(
    input: SalesforceTestDataAdapterInput,
  ): Promise<SalesforceTestDataSetupResult>;
  verify(
    input: SalesforceTestDataAdapterInput,
  ): Promise<SalesforceTestDataVerifyResult>;
  cleanup(
    input: SalesforceTestDataAdapterInput,
    ownedRecordIds: readonly string[],
  ): Promise<SalesforceTestDataCleanupResult>;
}

type SalesforceTestDataAdapterDependencies = {
  restClient: SalesforceRestClient;
};

const nullableText = z.string().nullable();

const accountRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    Id__c: nullableText,
    IdProspectSalesforce__c: nullableText,
    CPF__pc: nullableText,
    LastName: nullableText,
    IsPersonAccount: z.boolean(),
    PersonEmail: nullableText.optional(),
    PersonMobilePhone: nullableText.optional(),
    Celular__c: nullableText.optional(),
    BillingStreet: nullableText.optional(),
    DataAlteracaoEvento__c: nullableText.optional(),
  })
  .passthrough();

const accountQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(accountRecordSchema),
  })
  .passthrough();

const leadRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    Id__c: nullableText,
    FirstName: nullableText.optional(),
    LastName: nullableText,
    CPF__c: nullableText,
    MobilePhone: nullableText,
    CelularSemFormatacao__c: nullableText,
    Email: nullableText,
    CidadeInteresse__c: nullableText,
    Marca__c: nullableText,
    RecordTypeId: nullableText,
    ManipularFase__c: z.boolean(),
    Status: nullableText,
    PermitirCriarLead__c: z.boolean(),
    DescricaoOrigem__c: nullableText.optional(),
  })
  .passthrough();

const leadQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(leadRecordSchema),
  })
  .passthrough();

const opportunityRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    Id__c: nullableText,
    AccountId: nullableText,
    Name: nullableText,
    StageName: nullableText,
    CloseDate: nullableText,
    Unidade__c: nullableText.optional(),
    Unidade__r: z
      .object({
        Id__c: nullableText.optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    PACAtual__c: nullableText.optional(),
  })
  .passthrough();

const opportunityLineItemRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    OpportunityId: nullableText,
    Id__c: nullableText.optional(),
    Product2Id: nullableText.optional(),
    Product2: z
      .object({
        Id__c: nullableText.optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const opportunityLineItemQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(opportunityLineItemRecordSchema),
  })
  .passthrough();

const opportunityQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(opportunityRecordSchema),
  })
  .passthrough();

const propostaAnaliseCreditoRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    Id__c: nullableText,
    Oportunidade__c: nullableText,
    Status__c: nullableText.optional(),
  })
  .passthrough();

const propostaAnaliseCreditoQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(propostaAnaliseCreditoRecordSchema),
  })
  .passthrough();

const contestacaoRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    Id__c: nullableText,
    PAC__c: nullableText,
    DataSolucao__c: nullableText.optional(),
  })
  .passthrough();

const contestacaoQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(contestacaoRecordSchema),
  })
  .passthrough();

const proponenteRecordSchema = z
  .object({
    Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
    Id__c: nullableText,
    Proponente__c: nullableText,
    PropostaAnaliseCredito__c: nullableText,
    IdCliente__c: nullableText,
    CpfProponente__c: nullableText.optional(),
    TipoClassificacao__c: nullableText.optional(),
    EmailAtualizado__c: nullableText.optional(),
    Celular__c: nullableText.optional(),
    DataAlteracaoEvento__c: nullableText.optional(),
    NomeCompleto__c: nullableText.optional(),
  })
  .passthrough();

const proponenteQueryResponseSchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    done: z.literal(true),
    records: z.array(proponenteRecordSchema),
  })
  .passthrough();

const compositeResponseSchema = z
  .object({
    compositeResponse: z
      .array(
        z
          .object({
            body: z
              .object({
                id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
                success: z.literal(true),
                errors: z.array(z.unknown()).length(0),
              })
              .passthrough(),
            httpStatusCode: z.number().int().min(200).max(299),
            referenceId: z.enum([
              'createAccount',
              'createContestacao',
              'createLead',
              'createOpportunity',
              'createPropostaAnaliseCredito',
            ]),
          })
          .passthrough(),
      )
      .length(1),
  })
  .passthrough();

type AccountRecord = z.infer<typeof accountRecordSchema>;
type LeadRecord = z.infer<typeof leadRecordSchema>;
type OpportunityRecord = z.infer<typeof opportunityRecordSchema>;
type OpportunityLineItemRecord = z.infer<typeof opportunityLineItemRecordSchema>;
type PropostaAnaliseCreditoRecord = z.infer<
  typeof propostaAnaliseCreditoRecordSchema
>;
type ContestacaoRecord = z.infer<typeof contestacaoRecordSchema>;
type ProponenteRecord = z.infer<typeof proponenteRecordSchema>;
type FixtureCheck =
  RenderedScenarioFixture['expectedOutcomes'][number]['checks'][number];
type SyntheticAccountSetup = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_ACCOUNT' }
>;
type SyntheticLeadSetup = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_LEAD' }
>;
type SyntheticOpportunitySetup = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_OPPORTUNITY' }
>;
type SyntheticPropostaAnaliseCreditoSetup = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_PROPOSTA_ANALISE_CREDITO' }
>;
type SyntheticContestacaoSetup = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_CONTESTACAO' }
>;
type FixtureEventData =
  RenderedScenarioFixture['steps'][number]['envelope'][number]['data'];
type ClientFixtureEventData = FixtureEventData & {
  nomecompleto?: string;
  numerocpf?: string;
};
type ContactFixtureEventData = FixtureEventData & {
  tipocontato: string;
  descricao: string;
};
type AddressFixtureEventData = FixtureEventData & {
  tipoendereco: 'COBRANCA';
  logradouro?: string;
  numerocep?: string;
  bairro?: string;
  numero?: string;
};
type PacFixtureEventData = FixtureEventData & {
  id: string;
  idjornadapac: string;
  status?: string;
  proponentes?: PacFixtureProponenteData[];
};
type MaquinaEstadoFixtureEventData = FixtureEventData & {
  cliente: {
    idCliente: string;
    idProspectSalesforce: string;
  };
  id: string;
  estado: string;
  idunidade: string;
};
type PacFixtureProponenteData = {
  id: string;
  idPac: string;
  idCliente: string;
  cpf: string;
  tipoClassificacao: string;
  dataAlteracao: string;
  nomeCompleto?: string;
  email?: string;
  telefoneCelular?: string;
};

const accountFields =
  'Id,Id__c,IdProspectSalesforce__c,CPF__pc,LastName,IsPersonAccount,PersonEmail,PersonMobilePhone,Celular__c,BillingStreet' as const;
const setupAccountFields = `${accountFields},DataAlteracaoEvento__c` as const;
const leadFields =
  'Id,Id__c,FirstName,LastName,CPF__c,MobilePhone,CelularSemFormatacao__c,Email,CidadeInteresse__c,Marca__c,RecordTypeId,ManipularFase__c,Status,PermitirCriarLead__c,DescricaoOrigem__c' as const;
const leadSyntheticIdPrefix = 'LEAD-SIM-' as const;
const opportunityFields =
  'Id,Id__c,AccountId,Name,StageName,CloseDate,Unidade__c,Unidade__r.Id__c,PACAtual__c' as const;
const opportunityLineItemFields =
  'Id,OpportunityId,Id__c,Product2Id,Product2.Id__c' as const;
const propostaAnaliseCreditoFields =
  'Id,Id__c,Oportunidade__c,Status__c' as const;
const contestacaoFields = 'Id,Id__c,PAC__c,DataSolucao__c' as const;
const proponenteFields =
  'Id,Id__c,Proponente__c,PropostaAnaliseCredito__c,IdCliente__c,CpfProponente__c,TipoClassificacao__c,EmailAtualizado__c,Celular__c,DataAlteracaoEvento__c,NomeCompleto__c' as const;
const leadDefaultStatus = 'Pendente de Distribuição' as const;
const leadDefaultBrand = '1' as const;

function literal(value: string): string {
  return `'${escapeSoqlLiteral(value)}'`;
}

function parseInput(
  candidate: SalesforceTestDataAdapterInput,
): SalesforceTestDataAdapterInput & { fixture: RenderedScenarioFixture } {
  const result = adapterInputSchema.safeParse(candidate);
  if (!result.success) {
    throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
  }
  return result.data;
}

function parseAccountQueryResponse(value: unknown): AccountRecord[] {
  const result = accountQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function parseProponenteQueryResponse(value: unknown): ProponenteRecord[] {
  const result = proponenteQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function parseLeadQueryResponse(value: unknown): LeadRecord[] {
  const result = leadQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function parseOpportunityQueryResponse(value: unknown): OpportunityRecord[] {
  const result = opportunityQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function parseOpportunityLineItemQueryResponse(
  value: unknown,
): OpportunityLineItemRecord[] {
  const result = opportunityLineItemQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function parsePropostaAnaliseCreditoQueryResponse(
  value: unknown,
): PropostaAnaliseCreditoRecord[] {
  const result = propostaAnaliseCreditoQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function parseContestacaoQueryResponse(value: unknown): ContestacaoRecord[] {
  const result = contestacaoQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function fixtureEvent(fixture: RenderedScenarioFixture) {
  return fixture.steps[0]!.envelope[0]!.data;
}

function fixtureBusinessEvent(fixture: RenderedScenarioFixture) {
  return (
    fixture.steps.find(
      (step) =>
        step.eventType === 'cliente-insert' ||
        step.eventType === 'cliente-update',
    )?.envelope[0]?.data ?? fixtureEvent(fixture)
  );
}

function isClientFixtureEventData(
  event: FixtureEventData,
): event is ClientFixtureEventData {
  return 'nomecompleto' in event;
}

function isContactFixtureEventData(
  event: FixtureEventData,
): event is ContactFixtureEventData {
  return 'tipocontato' in event && 'descricao' in event;
}

function isAddressFixtureEventData(
  event: FixtureEventData,
): event is AddressFixtureEventData {
  return 'tipoendereco' in event;
}

function isPacFixtureEventData(event: FixtureEventData): event is PacFixtureEventData {
  return 'id' in event && 'idjornadapac' in event;
}

function isMaquinaEstadoFixtureEventData(
  event: FixtureEventData,
): event is MaquinaEstadoFixtureEventData {
  return (
    'cliente' in event &&
    event.cliente !== null &&
    typeof event.cliente === 'object' &&
    'id' in event &&
    'estado' in event &&
    'idunidade' in event
  );
}

function isSyntheticAccountSetup(
  instruction: RenderedScenarioFixture['setup'][number],
): instruction is SyntheticAccountSetup {
  return instruction.operation === 'CREATE_SYNTHETIC_ACCOUNT';
}

function primaryAccountSetup(
  fixture: RenderedScenarioFixture,
): SyntheticAccountSetup | undefined {
  return fixture.setup.find(
    (instruction): instruction is SyntheticAccountSetup =>
      isSyntheticAccountSetup(instruction) && instruction.role === 'PRIMARY',
  );
}

function controlAccountSetup(
  fixture: RenderedScenarioFixture,
): SyntheticAccountSetup | undefined {
  return fixture.setup.find(
    (instruction): instruction is SyntheticAccountSetup =>
      isSyntheticAccountSetup(instruction) && instruction.role === 'CONTROL',
  );
}

function isSyntheticLeadSetup(
  instruction: RenderedScenarioFixture['setup'][number],
): instruction is SyntheticLeadSetup {
  return instruction.operation === 'CREATE_SYNTHETIC_LEAD';
}

function isSyntheticOpportunitySetup(
  instruction: RenderedScenarioFixture['setup'][number],
): instruction is SyntheticOpportunitySetup {
  return instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY';
}

function isSyntheticPropostaAnaliseCreditoSetup(
  instruction: RenderedScenarioFixture['setup'][number],
): instruction is SyntheticPropostaAnaliseCreditoSetup {
  return instruction.operation === 'CREATE_SYNTHETIC_PROPOSTA_ANALISE_CREDITO';
}

function isSyntheticContestacaoSetup(
  instruction: RenderedScenarioFixture['setup'][number],
): instruction is SyntheticContestacaoSetup {
  return instruction.operation === 'CREATE_SYNTHETIC_CONTESTACAO';
}

function primaryLeadSetup(
  fixture: RenderedScenarioFixture,
): SyntheticLeadSetup | undefined {
  return fixture.setup.find(
    (instruction): instruction is SyntheticLeadSetup =>
      isSyntheticLeadSetup(instruction) && instruction.role === 'PRIMARY',
  );
}

function primaryOpportunitySetup(
  fixture: RenderedScenarioFixture,
): SyntheticOpportunitySetup | undefined {
  return fixture.setup.find(
    (instruction): instruction is SyntheticOpportunitySetup =>
      isSyntheticOpportunitySetup(instruction),
  );
}

function syntheticPropostaAnaliseCreditoSetup(
  fixture: RenderedScenarioFixture,
): SyntheticPropostaAnaliseCreditoSetup | undefined {
  return fixture.setup.find(
    (instruction): instruction is SyntheticPropostaAnaliseCreditoSetup =>
      isSyntheticPropostaAnaliseCreditoSetup(instruction),
  );
}

function syntheticContestacaoSetup(
  fixture: RenderedScenarioFixture,
): SyntheticContestacaoSetup | undefined {
  return fixture.setup.find(
    (instruction): instruction is SyntheticContestacaoSetup =>
      isSyntheticContestacaoSetup(instruction),
  );
}

function fixtureCpf(fixture: RenderedScenarioFixture): string {
  const businessEvent = fixtureBusinessEvent(fixture);
  const eventCpf =
    'numerocpf' in businessEvent ? businessEvent.numerocpf : undefined;
  if (eventCpf !== undefined) {
    return eventCpf;
  }

  const primarySetup = primaryAccountSetup(fixture);
  if (primarySetup !== undefined) {
    return primarySetup.account.cpf;
  }

  const absentAccountSetup = fixture.setup.find(
    (instruction) => instruction.operation === 'ENSURE_ACCOUNT_ABSENT',
  );
  if (absentAccountSetup !== undefined) {
    return absentAccountSetup.keys.cpf;
  }

  const leadSetup = primaryLeadSetup(fixture);
  if (leadSetup !== undefined) {
    return leadSetup.lead.cpf;
  }

  const absentLeadSetup = fixture.setup.find(
    (instruction) => instruction.operation === 'ENSURE_LEAD_ABSENT',
  );
  return absentLeadSetup?.keys.cpf ?? '';
}

function controlFixtureCpf(
  fixture: RenderedScenarioFixture,
): string | undefined {
  return controlAccountSetup(fixture)?.account.cpf;
}

function accountLookupQuery(
  fixture: RenderedScenarioFixture,
  includeSetupDate = false,
) {
  const fields = includeSetupDate ? setupAccountFields : accountFields;
  const controlId = fixture.identifiers.controlAccountIdCliente;
  const controlCpf = controlFixtureCpf(fixture);
  const clauses = [
    `Id__c = ${literal(fixture.identifiers.accountIdCliente)}`,
    `CPF__pc = ${literal(fixtureCpf(fixture))}`,
    controlId !== undefined ? `Id__c = ${literal(controlId)}` : null,
    controlCpf !== undefined ? `CPF__pc = ${literal(controlCpf)}` : null,
  ].filter((clause): clause is string => clause !== null);
  return asAllowlistedQuery(
    `SELECT ${fields} FROM Account WHERE ${clauses.join(' OR ')}`,
  );
}

function sameInstant(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  // Salesforce echoes datetime fields with a numeric UTC offset (e.g.
  // "...+0000") instead of the "...Z" suffix we send when rendering
  // fixtures. Comparing the parsed instant (instead of the raw string)
  // avoids false SETUP_CONFLICT results on replay/retry of an already
  // created Account.
  const parsedA = Date.parse(a);
  const parsedB = Date.parse(b);
  if (Number.isNaN(parsedA) || Number.isNaN(parsedB)) {
    return a === b;
  }
  return parsedA === parsedB;
}

function normalizePhoneDigits(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const digits = value.replace(/\D+/g, '');
  return digits.length === 0 ? undefined : digits;
}

function getLeadExternalId(
  fixture: RenderedScenarioFixture,
  setup?: LeadSetupInstruction,
) {
  if (setup?.operation === 'CREATE_SYNTHETIC_LEAD') {
    return (
      setup.lead.idExterno ??
      (setup.role === 'COLLISION'
        ? fixture.identifiers.collisionLeadIdExterno
        : fixture.identifiers.leadIdExterno) ??
      fixture.identifiers.leadIdExterno
    );
  }

  const primarySetup = primaryLeadSetup(fixture);
  return primarySetup?.lead.idExterno ?? fixture.identifiers.leadIdExterno;
}

function buildLeadWhereClause(keys: {
  idExterno?: string;
  cpf?: string;
  email?: string;
  celular?: string;
}) {
  const clauses = [
    keys.idExterno !== undefined ? `Id__c = ${literal(keys.idExterno)}` : null,
    keys.cpf !== undefined ? `CPF__c = ${literal(keys.cpf)}` : null,
    keys.email !== undefined ? `Email = ${literal(keys.email)}` : null,
    keys.celular !== undefined
      ? `CelularSemFormatacao__c = ${literal(keys.celular)}`
      : null,
  ].filter((clause): clause is string => clause !== null);
  if (clauses.length === 0) {
    throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
  }
  return clauses.join(' OR ');
}

function pacFixtureEvent(
  fixture: RenderedScenarioFixture,
): PacFixtureEventData | undefined {
  const event = [...fixture.steps]
    .reverse()
    .find(
      (step) => step.eventType === 'pac-insert' || step.eventType === 'pac-update',
    )?.envelope[0]?.data;
  return event !== undefined && isPacFixtureEventData(event) ? event : undefined;
}

function maquinaEstadoFixtureEvent(
  fixture: RenderedScenarioFixture,
): MaquinaEstadoFixtureEventData | undefined {
  const event = [...fixture.steps]
    .reverse()
    .find(
      (step) =>
        step.eventType === 'jornadausuario-insert' ||
        step.eventType === 'jornadausuario-update',
    )?.envelope[0]?.data;
  return event !== undefined && isMaquinaEstadoFixtureEventData(event)
    ? event
    : undefined;
}

function pacFixturePrimaryProponente(
  fixture: RenderedScenarioFixture,
): PacFixtureProponenteData | undefined {
  for (const step of [...fixture.steps].reverse()) {
    if (step.eventType !== 'pac-insert' && step.eventType !== 'pac-update') {
      continue;
    }
    const event = step.envelope[0]?.data;
    if (!isPacFixtureEventData(event)) {
      continue;
    }
    const principal = event.proponentes?.find(
      (proponente) => proponente.tipoClassificacao === 'Principal',
    );
    if (principal !== undefined) {
      return principal;
    }
  }
  return undefined;
}

function pacFixtureOwnedProponentes(
  fixture: RenderedScenarioFixture,
): PacFixtureProponenteData[] {
  const owned = new Map<string, PacFixtureProponenteData>();
  for (const step of fixture.steps) {
    if (step.eventType !== 'pac-insert' && step.eventType !== 'pac-update') {
      continue;
    }
    const event = step.envelope[0]?.data;
    if (!isPacFixtureEventData(event)) {
      continue;
    }
    for (const proponente of event.proponentes ?? []) {
      owned.set(proponente.id, proponente);
    }
  }
  return [...owned.values()];
}

function pacFixtureProponenteForClientId(
  fixture: RenderedScenarioFixture,
  idCliente: string | undefined,
): PacFixtureProponenteData | undefined {
  if (idCliente === undefined) {
    return undefined;
  }

  for (const step of [...fixture.steps].reverse()) {
    if (step.eventType !== 'pac-insert' && step.eventType !== 'pac-update') {
      continue;
    }
    const event = step.envelope[0]?.data;
    if (!isPacFixtureEventData(event)) {
      continue;
    }
    const matchingProponentes =
      event.proponentes?.filter((proponente) => proponente.idCliente === idCliente) ??
      [];
    const match =
      matchingProponentes.find(
        (proponente) => proponente.tipoClassificacao === 'Principal',
      ) ?? matchingProponentes[0];
    if (match !== undefined) {
      return match;
    }
  }

  return undefined;
}

function opportunityLookupQueryForSetup(setup: SyntheticOpportunitySetup) {
  return asAllowlistedQuery(
    `SELECT ${opportunityFields} FROM Opportunity WHERE Id__c = ${literal(
      setup.opportunity.idExterno,
    )}`,
  );
}

function opportunityLookupQueryForVerify(fixture: RenderedScenarioFixture) {
  const setup = primaryOpportunitySetup(fixture);
  if (setup !== undefined) {
    return opportunityLookupQueryForSetup(setup);
  }
  const event = maquinaEstadoFixtureEvent(fixture);
  if (event === undefined) {
    throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
  }
  return asAllowlistedQuery(
    `SELECT ${opportunityFields} FROM Opportunity WHERE Id__c = ${literal(
      event.id,
    )}`,
  );
}

function propostaAnaliseCreditoLookupQueryForSetup(
  setup: SyntheticPropostaAnaliseCreditoSetup,
) {
  return asAllowlistedQuery(
    `SELECT ${propostaAnaliseCreditoFields} FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(
      setup.propostaAnaliseCredito.idExterno,
    )}`,
  );
}

function contestacaoLookupQueryForSetup(setup: SyntheticContestacaoSetup) {
  return asAllowlistedQuery(
    `SELECT ${contestacaoFields} FROM Contestacao__c WHERE Id__c = ${literal(
      setup.contestacao.idExterno,
    )}`,
  );
}

function propostaAnaliseCreditoLookupQueryForVerify(
  fixture: RenderedScenarioFixture,
) {
  const event = pacFixtureEvent(fixture);
  if (event === undefined) {
    throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
  }
  return asAllowlistedQuery(
    `SELECT ${propostaAnaliseCreditoFields} FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(
      event.id,
    )}`,
  );
}

function proponenteLookupQueryForVerify(fixture: RenderedScenarioFixture) {
  const proponentes = pacFixtureOwnedProponentes(fixture);
  if (proponentes.length === 0) {
    throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
  }
  return asAllowlistedQuery(
    `SELECT ${proponenteFields} FROM Proponente__c WHERE Id__c IN (${proponentes
      .map((proponente) => literal(proponente.id))
      .join(',')})`,
  );
}

type LeadSetupInstruction = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_LEAD' | 'ENSURE_LEAD_ABSENT' }
>;

function leadLookupKeysForSetup(
  fixture: RenderedScenarioFixture,
  setup: LeadSetupInstruction,
) {
  if (setup.operation === 'CREATE_SYNTHETIC_LEAD') {
    return {
      idExterno: getLeadExternalId(fixture, setup),
      cpf: setup.lead.cpf,
      email: setup.lead.email,
      celular: normalizePhoneDigits(setup.lead.celular),
    };
  }
  return {
    idExterno: setup.keys.idExterno,
    cpf: setup.keys.cpf,
    email: setup.keys.email,
    celular: normalizePhoneDigits(setup.keys.celular),
  };
}

function leadLookupQueryForSetup(
  fixture: RenderedScenarioFixture,
  setup: LeadSetupInstruction,
) {
  return asAllowlistedQuery(
    `SELECT ${leadFields} FROM Lead WHERE ${buildLeadWhereClause(
      leadLookupKeysForSetup(fixture, setup),
    )}`,
  );
}

function leadLookupQueryForVerify(fixture: RenderedScenarioFixture) {
  const businessEvent = fixtureBusinessEvent(fixture);
  return asAllowlistedQuery(
    `SELECT ${leadFields} FROM Lead WHERE ${buildLeadWhereClause({
      idExterno: getLeadExternalId(fixture),
      cpf: 'numerocpf' in businessEvent ? businessEvent.numerocpf : undefined,
    })}`,
  );
}

function verificationCheckName(
  check: FixtureCheck,
): SalesforceTestDataVerificationCheck['check'] {
  return typeof check === 'string' ? check : check.check;
}

function verificationCheckValue(check: FixtureCheck) {
  return typeof check === 'string' ? undefined : check.value;
}

function isBlankText(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

export function createSalesforceTestDataAdapter(
  dependencies: SalesforceTestDataAdapterDependencies,
): SalesforceTestDataAdapter {
  async function queryAccounts(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<AccountRecord[]> {
    return parseAccountQueryResponse(
      await dependencies.restClient.query<unknown>(query),
    );
  }

  async function queryLeads(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<LeadRecord[]> {
    return parseLeadQueryResponse(await dependencies.restClient.query(query));
  }

  async function queryOpportunities(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<OpportunityRecord[]> {
    return parseOpportunityQueryResponse(
      await dependencies.restClient.query(query),
    );
  }

  async function queryOpportunityLineItems(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<OpportunityLineItemRecord[]> {
    return parseOpportunityLineItemQueryResponse(
      await dependencies.restClient.query(query),
    );
  }

  async function queryPropostasAnaliseCredito(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<PropostaAnaliseCreditoRecord[]> {
    return parsePropostaAnaliseCreditoQueryResponse(
      await dependencies.restClient.query(query),
    );
  }

  async function queryContestacoes(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<ContestacaoRecord[]> {
    return parseContestacaoQueryResponse(
      await dependencies.restClient.query(query),
    );
  }

  async function queryProponentes(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<ProponenteRecord[]> {
    return parseProponenteQueryResponse(
      await dependencies.restClient.query(query),
    );
  }

  return {
    async setup(candidate): Promise<SalesforceTestDataSetupResult> {
      const { fixture } = parseInput(candidate);
      let createdCount = 0;
      let replayedCount = 0;
      const recordIds: string[] = [];
      const accountIdsByExternalId = new Map<string, string>();
      const opportunityIdsByExternalId = new Map<string, string>();
      const propostaIdsByExternalId = new Map<string, string>();

      for (const instruction of fixture.setup) {
        if (instruction.operation === 'ENSURE_ACCOUNT_ABSENT') {
          const { keys } = instruction;
          const records = await queryAccounts(
            asAllowlistedQuery(
              `SELECT ${accountFields} FROM Account WHERE Id__c = ${literal(
                keys.idCliente,
              )} OR IdProspectSalesforce__c = ${literal(
                keys.idProspect,
              )} OR CPF__pc = ${literal(keys.cpf)}`,
            ),
          );
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('PRECONDITION_FAILED');
          }
          continue;
        }

        if (instruction.operation === 'ENSURE_LEAD_ABSENT') {
          const records = await queryLeads(
            leadLookupQueryForSetup(fixture, instruction),
          );
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('PRECONDITION_FAILED');
          }
          continue;
        }

        if (instruction.operation === 'CREATE_SYNTHETIC_LEAD') {
          const { lead } = instruction;
          const leadExternalId = getLeadExternalId(fixture, instruction);
          const normalizedCell = normalizePhoneDigits(lead.celular) ?? null;
          const records = await queryLeads(
            leadLookupQueryForSetup(fixture, instruction),
          );
          const existing = records[0];
          const matchesFixture =
            records.length === 1 &&
            existing.Id__c === leadExternalId &&
            existing.FirstName === (lead.firstName ?? null) &&
            existing.LastName === lead.lastName &&
            existing.CPF__c === lead.cpf &&
            existing.MobilePhone === (lead.celular ?? null) &&
            existing.CelularSemFormatacao__c === normalizedCell &&
            existing.Email === (lead.email ?? null) &&
            existing.CidadeInteresse__c === (lead.cidadeInteresse ?? null) &&
            existing.Marca__c === leadDefaultBrand &&
            existing.ManipularFase__c === true &&
            existing.Status === (lead.status ?? leadDefaultStatus) &&
            existing.PermitirCriarLead__c === true &&
            existing.DescricaoOrigem__c === (lead.descricaoOrigem ?? null);

          if (matchesFixture) {
            replayedCount += 1;
            recordIds.push(existing.Id);
            continue;
          }
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('SETUP_CONFLICT');
          }

          let recordTypeId: string;
          try {
            recordTypeId = await getLeadGestaoVendasRecordTypeId(
              dependencies.restClient,
            );
          } catch {
            throw new SalesforceTestDataAdapterError(
              'SALESFORCE_RESPONSE_INVALID',
            );
          }

          const request: SalesforceCompositeRequest = {
            method: 'POST',
            url: '/services/data/v61.0/sobjects/Lead',
            referenceId: 'createLead',
            body: {
              Id__c: leadExternalId,
              LastName: lead.lastName,
              Marca__c: leadDefaultBrand,
              RecordTypeId: recordTypeId,
              ManipularFase__c: true,
              Status: lead.status ?? leadDefaultStatus,
              PermitirCriarLead__c: true,
            },
          };
          if (lead.firstName !== undefined) {
            request.body.FirstName = lead.firstName;
          }
          if (lead.cpf !== undefined) {
            request.body.CPF__c = lead.cpf;
          }
          if (lead.celular !== undefined) {
            request.body.MobilePhone = lead.celular;
          }
          if (normalizedCell !== null) {
            request.body.CelularSemFormatacao__c = normalizedCell;
          }
          if (lead.email !== undefined) {
            request.body.Email = lead.email;
          }
          if (lead.cidadeInteresse !== undefined) {
            request.body.CidadeInteresse__c = lead.cidadeInteresse;
          }
          if (lead.descricaoOrigem !== undefined) {
            request.body.DescricaoOrigem__c = lead.descricaoOrigem;
          }

          const response = compositeResponseSchema.safeParse(
            await dependencies.restClient.composite([request]),
          );
          if (!response.success) {
            throw new SalesforceTestDataAdapterError(
              'SALESFORCE_RESPONSE_INVALID',
            );
          }
          createdCount += 1;
          recordIds.push(response.data.compositeResponse[0]!.body.id);
          continue;
        }

        if (instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY') {
          const { opportunity } = instruction;
          const expectedAccountId = accountIdsByExternalId.get(
            opportunity.accountId,
          );
          if (expectedAccountId === undefined) {
            throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
          }
          const records = await queryOpportunities(
            opportunityLookupQueryForSetup(instruction),
          );
          const existing = records[0];
          const matchesFixture =
            records.length === 1 &&
            existing.Id__c === opportunity.idExterno &&
            existing.AccountId === expectedAccountId &&
            existing.Name === opportunity.name &&
            existing.StageName === opportunity.stageName &&
            existing.CloseDate === opportunity.closeDate;

          if (matchesFixture) {
            replayedCount += 1;
            recordIds.push(existing.Id);
            opportunityIdsByExternalId.set(opportunity.idExterno, existing.Id);
            continue;
          }
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('SETUP_CONFLICT');
          }

          const response = compositeResponseSchema.safeParse(
            await dependencies.restClient.composite([
              {
                method: 'POST',
                url: '/services/data/v61.0/sobjects/Opportunity',
                referenceId: 'createOpportunity',
                body: {
                  Name: opportunity.name,
                  StageName: opportunity.stageName,
                  CloseDate: opportunity.closeDate,
                  Id__c: opportunity.idExterno,
                  AccountId: expectedAccountId,
                },
              },
            ]),
          );
          if (!response.success) {
            throw new SalesforceTestDataAdapterError(
              'SALESFORCE_RESPONSE_INVALID',
            );
          }
          createdCount += 1;
          const opportunityRecordId = response.data.compositeResponse[0]!.body.id;
          recordIds.push(opportunityRecordId);
          opportunityIdsByExternalId.set(opportunity.idExterno, opportunityRecordId);
          continue;
        }

        if (
          instruction.operation === 'CREATE_SYNTHETIC_PROPOSTA_ANALISE_CREDITO'
        ) {
          const { propostaAnaliseCredito } = instruction;
          const expectedOpportunityId = opportunityIdsByExternalId.get(
            propostaAnaliseCredito.opportunityIdExterno,
          );
          if (expectedOpportunityId === undefined) {
            throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
          }
          const records = await queryPropostasAnaliseCredito(
            propostaAnaliseCreditoLookupQueryForSetup(instruction),
          );
          const existing = records[0];
          const matchesFixture =
            records.length === 1 &&
            existing.Id__c === propostaAnaliseCredito.idExterno &&
            existing.Oportunidade__c === expectedOpportunityId &&
            existing.Status__c === propostaAnaliseCredito.status;

          if (matchesFixture) {
            replayedCount += 1;
            recordIds.push(existing.Id);
            propostaIdsByExternalId.set(
              propostaAnaliseCredito.idExterno,
              existing.Id,
            );
            continue;
          }
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('SETUP_CONFLICT');
          }

          const response = compositeResponseSchema.safeParse(
            await dependencies.restClient.composite([
              {
                method: 'POST',
                url: '/services/data/v61.0/sobjects/PropostaAnaliseCredito__c',
                referenceId: 'createPropostaAnaliseCredito',
                body: {
                  Id__c: propostaAnaliseCredito.idExterno,
                  Oportunidade__c: expectedOpportunityId,
                  Status__c: propostaAnaliseCredito.status,
                },
              },
            ]),
          );
          if (!response.success) {
            throw new SalesforceTestDataAdapterError(
              'SALESFORCE_RESPONSE_INVALID',
            );
          }
          createdCount += 1;
          const propostaRecordId = response.data.compositeResponse[0]!.body.id;
          recordIds.push(propostaRecordId);
          propostaIdsByExternalId.set(
            propostaAnaliseCredito.idExterno,
            propostaRecordId,
          );
          continue;
        }

        if (instruction.operation === 'CREATE_SYNTHETIC_CONTESTACAO') {
          const { contestacao } = instruction;
          const expectedPropostaId = propostaIdsByExternalId.get(
            contestacao.pacIdExterno,
          );
          if (expectedPropostaId === undefined) {
            throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
          }
          const records = await queryContestacoes(
            contestacaoLookupQueryForSetup(instruction),
          );
          const existing = records[0];
          const matchesFixture =
            records.length === 1 &&
            existing.Id__c === contestacao.idExterno &&
            existing.PAC__c === expectedPropostaId &&
            existing.DataSolucao__c === null;

          if (matchesFixture) {
            replayedCount += 1;
            recordIds.push(existing.Id);
            continue;
          }
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('SETUP_CONFLICT');
          }

          const response = compositeResponseSchema.safeParse(
            await dependencies.restClient.composite([
              {
                method: 'POST',
                url: '/services/data/v61.0/sobjects/Contestacao__c',
                referenceId: 'createContestacao',
                body: {
                  Id__c: contestacao.idExterno,
                  PAC__c: expectedPropostaId,
                },
              },
            ]),
          );
          if (!response.success) {
            throw new SalesforceTestDataAdapterError(
              'SALESFORCE_RESPONSE_INVALID',
            );
          }
          createdCount += 1;
          recordIds.push(response.data.compositeResponse[0]!.body.id);
          continue;
        }

        if (instruction.operation !== 'CREATE_SYNTHETIC_ACCOUNT') {
          throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
        }

        const { account, matchBy } = instruction;
        const matchQuery =
          matchBy === 'ID_CLIENTE'
            ? `Id__c = ${literal(account.idCliente as string)}`
            : `CPF__pc = ${literal(account.cpf)}`;
        const records = await queryAccounts(
          asAllowlistedQuery(
            `SELECT ${setupAccountFields} FROM Account WHERE ${matchQuery}`,
          ),
        );
        const existing = records[0];
        const matchesFixture =
          records.length === 1 &&
          existing.Id__c === account.idCliente &&
          existing.IdProspectSalesforce__c === account.idProspect &&
          existing.CPF__pc === account.cpf &&
          existing.LastName === account.name &&
          existing.IsPersonAccount &&
          sameInstant(existing.DataAlteracaoEvento__c, account.dataAlteracao);

        if (matchesFixture) {
          replayedCount += 1;
          recordIds.push(existing.Id);
          if (account.idCliente !== null) {
            accountIdsByExternalId.set(account.idCliente, existing.Id);
          }
          continue;
        }
        if (records.length > 0) {
          throw new SalesforceTestDataAdapterError('SETUP_CONFLICT');
        }

        let recordTypeId: string;
        try {
          recordTypeId = await getPersonAccountRecordTypeId(
            dependencies.restClient,
          );
        } catch {
          throw new SalesforceTestDataAdapterError(
            'SALESFORCE_RESPONSE_INVALID',
          );
        }

        const request: SalesforceCompositeRequest = {
          method: 'POST',
          url: '/services/data/v61.0/sobjects/Account',
          referenceId: 'createAccount',
          body: {
            RecordTypeId: recordTypeId,
            LastName: account.name,
            IdProspectSalesforce__c: account.idProspect,
            CPF__pc: account.cpf,
            DataAlteracaoEvento__c: account.dataAlteracao,
          },
        };
        if (account.idCliente !== null) {
          request.body.Id__c = account.idCliente;
        }

        const response = compositeResponseSchema.safeParse(
          await dependencies.restClient.composite([request]),
        );
        if (!response.success) {
          throw new SalesforceTestDataAdapterError(
            'SALESFORCE_RESPONSE_INVALID',
          );
        }
        createdCount += 1;
        const accountRecordId = response.data.compositeResponse[0]!.body.id;
        recordIds.push(accountRecordId);
        if (account.idCliente !== null) {
          accountIdsByExternalId.set(account.idCliente, accountRecordId);
        }
      }

      return {
        status:
          createdCount > 0 ? 'CREATED' : replayedCount > 0 ? 'REPLAY' : 'READY',
        createdCount,
        replayedCount,
        recordIds,
      };
    },

    async verify(candidate): Promise<SalesforceTestDataVerifyResult> {
      const { fixture } = parseInput(candidate);
      const event = fixtureBusinessEvent(fixture);
      const pacPrimaryProponente = pacFixturePrimaryProponente(fixture);
      const primaryFixtureProponente = pacFixtureProponenteForClientId(
        fixture,
        fixture.identifiers.accountIdCliente,
      );
      const controlFixtureProponente = pacFixtureProponenteForClientId(
        fixture,
        fixture.identifiers.controlAccountIdCliente,
      );
      const eventIdCliente =
        'idcliente' in event
          ? event.idcliente
          : isMaquinaEstadoFixtureEventData(event)
            ? event.cliente.idCliente
            : undefined;
      const eventCpf = 'numerocpf' in event ? event.numerocpf : undefined;
      const accountIdentityClientId =
        eventIdCliente ??
        pacPrimaryProponente?.idCliente ??
        primaryFixtureProponente?.idCliente;
      const accountIdentityCpf =
        eventCpf ?? pacPrimaryProponente?.cpf ?? primaryFixtureProponente?.cpf;
      const eventIdProspect =
        'idprospectsalesforce' in event
          ? event.idprospectsalesforce
          : isMaquinaEstadoFixtureEventData(event)
            ? event.cliente.idProspectSalesforce
            : undefined;
      const clientEvent = isClientFixtureEventData(event) ? event : undefined;
      const expectedChecks = fixture.expectedOutcomes.flatMap(
        (outcome) => outcome.checks,
      );
      const needsAccountRecords = expectedChecks.some((check) => {
        const checkName = verificationCheckName(check);
        return (
          checkName.startsWith('ACCOUNT_') ||
          checkName.startsWith('CONTROL_ACCOUNT_') ||
          checkName === 'NO_OTHER_ACCOUNT_UPDATED' ||
          checkName === 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT'
        );
      });
      const needsLeadRecords = expectedChecks.some((check) => {
        const checkName = verificationCheckName(check);
        return (
          checkName.startsWith('LEAD_') && checkName !== 'LEAD_NOT_REQUIRED'
        );
      });
      const needsProponenteRecords = expectedChecks.some((check) => {
        const checkName = verificationCheckName(check);
        return (
          ((checkName.startsWith('PROPONENTE_') &&
            checkName !== 'PROPONENTE_NOT_REQUIRED') ||
            checkName.startsWith('PRIMARY_PROPONENTE_') ||
            checkName.startsWith('CONTROL_PROPONENTE_'))
        );
      });
      const needsOpportunityRecords = expectedChecks.some(
        (check) => {
          const checkName = verificationCheckName(check);
          return (
            checkName === 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY' ||
            checkName.startsWith('OPPORTUNITY_')
          );
        },
      );
      const needsOpportunityLineItems = expectedChecks.some(
        (check) =>
          verificationCheckName(check) ===
            'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED' ||
          verificationCheckName(check) ===
            'OPPORTUNITY_LINE_ITEM_PRODUCT_EXTERNAL_ID_EQUALS_EXPECTED',
      );
      const needsPropostaRecords = expectedChecks.some((check) => {
        const checkName = verificationCheckName(check);
        return (
          checkName.startsWith('PROPOSTA_ANALISE_CREDITO_') ||
          checkName === 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY'
        );
      });

      const accountRecords = needsAccountRecords
        ? await queryAccounts(accountLookupQuery(fixture))
        : [];
      const leadRecords = needsLeadRecords
        ? await queryLeads(leadLookupQueryForVerify(fixture))
        : [];
      const opportunityRecords = needsOpportunityRecords
        ? await queryOpportunities(opportunityLookupQueryForVerify(fixture))
        : [];
      const propostaRecords = needsPropostaRecords
        ? await queryPropostasAnaliseCredito(
            propostaAnaliseCreditoLookupQueryForVerify(fixture),
          )
        : [];
      const proponenteRecords = needsProponenteRecords
        ? await queryProponentes(proponenteLookupQueryForVerify(fixture))
        : [];
      const byClientId = accountRecords.filter(
        (record) =>
          accountIdentityClientId !== undefined &&
          record.Id__c === accountIdentityClientId,
      );
      const byCpf = accountRecords.filter(
        (record) =>
          accountIdentityCpf !== undefined &&
          record.CPF__pc === accountIdentityCpf,
      );
      const matchedAccountCount = new Set(
        [...byClientId, ...byCpf].map((record) => record.Id),
      ).size;
      const accountTarget =
        byClientId.length === 1
          ? byClientId[0]
          : byCpf.length === 1
            ? byCpf[0]
            : undefined;
      const expectedPrimaryAccount = primaryAccountSetup(fixture);
      const controlTarget = fixture.identifiers.controlAccountIdCliente
        ? accountRecords.find(
            (record) =>
              record.Id__c === fixture.identifiers.controlAccountIdCliente,
          )
        : undefined;
      const expectedControlAccount = controlAccountSetup(fixture);
      const leadExternalId = getLeadExternalId(fixture);
      const leadByExternalId = leadRecords.filter(
        (record) => record.Id__c === leadExternalId,
      );
      const leadByCpf = leadRecords.filter(
        (record) => eventCpf !== undefined && record.CPF__c === eventCpf,
      );
      const leadTarget =
        leadByExternalId.length === 1
          ? leadByExternalId[0]
          : leadByCpf.length === 1
            ? leadByCpf[0]
            : leadRecords.length === 1
              ? leadRecords[0]
              : undefined;
      const opportunitySetup = primaryOpportunitySetup(fixture);
      const pacEvent = pacFixtureEvent(fixture);
      const opportunityTarget =
        opportunitySetup !== undefined
          ? opportunityRecords.find(
              (record) => record.Id__c === opportunitySetup.opportunity.idExterno,
            )
          : (() => {
              const event = maquinaEstadoFixtureEvent(fixture);
              return event === undefined
                ? undefined
                : opportunityRecords.find((record) => record.Id__c === event.id);
            })();
      const opportunityLineItems =
        needsOpportunityLineItems && opportunityTarget !== undefined
          ? await queryOpportunityLineItems(
              asAllowlistedQuery(
                `SELECT ${opportunityLineItemFields} FROM OpportunityLineItem WHERE OpportunityId = ${literal(
                  opportunityTarget.Id,
                )}`,
              ),
            )
          : [];
      const propostaTarget =
        pacEvent === undefined
          ? undefined
          : propostaRecords.find((record) => record.Id__c === pacEvent.id);
      const proponenteTarget =
        pacPrimaryProponente === undefined
          ? undefined
          : proponenteRecords.find(
              (record) => record.Id__c === pacPrimaryProponente.id,
            );
      const primaryProponenteTarget =
        primaryFixtureProponente === undefined
          ? undefined
          : proponenteRecords.find(
              (record) => record.Id__c === primaryFixtureProponente.id,
            );
      const controlProponenteTarget =
        controlFixtureProponente === undefined
          ? undefined
          : proponenteRecords.find(
              (record) => record.Id__c === controlFixtureProponente.id,
            );
      const primaryProponenteCount =
        primaryFixtureProponente === undefined
          ? 0
          : proponenteRecords.filter(
              (record) => record.Id__c === primaryFixtureProponente.id,
            ).length;
      const checks: SalesforceTestDataVerificationCheck[] = [];

      for (const check of expectedChecks) {
        const checkName = verificationCheckName(check);
        const expectedValue = verificationCheckValue(check);

        switch (checkName) {
          case 'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE':
            checks.push({
              check: checkName,
              passed: byClientId.length === 1,
              actualCount: byClientId.length,
            });
            break;
          case 'ACCOUNT_COUNT_BY_CPF_IS_ONE':
            checks.push({
              check: checkName,
              passed: byCpf.length === 1,
              actualCount: byCpf.length,
            });
            break;
          case 'ACCOUNT_NOT_CREATED':
            checks.push({
              check: checkName,
              passed: matchedAccountCount === 0,
              actualCount: matchedAccountCount,
            });
            break;
          case 'ACCOUNT_CLIENT_ID_EQUALS_EVENT':
            checks.push({
              check: checkName,
              passed:
                eventIdCliente !== undefined &&
                byCpf.length === 1 &&
                byCpf[0].Id__c === eventIdCliente,
            });
            break;
          case 'ACCOUNT_NAME_EQUALS_EVENT':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                clientEvent !== undefined &&
                accountTarget.LastName === clientEvent.nomecompleto,
            });
            break;
          case 'ACCOUNT_NAME_EQUALS_SETUP':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                expectedPrimaryAccount !== undefined &&
                accountTarget.LastName === expectedPrimaryAccount.account.name,
            });
            break;
          case 'ACCOUNT_IS_PERSON_ACCOUNT':
            checks.push({
              check: checkName,
              passed: accountTarget?.IsPersonAccount === true,
            });
            break;
          case 'ACCOUNT_CPF_EQUALS_EVENT':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                clientEvent !== undefined &&
                accountTarget.CPF__pc === clientEvent.numerocpf,
            });
            break;
          case 'ACCOUNT_CPF_EQUALS_SETUP':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                expectedPrimaryAccount !== undefined &&
                accountTarget.CPF__pc === expectedPrimaryAccount.account.cpf,
            });
            break;
          case 'ACCOUNT_EMAIL_EXCLUDED':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                accountTarget.PersonEmail === null,
            });
            break;
          case 'ACCOUNT_MOBILE_EXCLUDED':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                accountTarget.PersonMobilePhone === null &&
                accountTarget.Celular__c === null,
            });
            break;
          case 'ACCOUNT_EMAIL_EQUALS_EXPECTED':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                accountTarget.PersonEmail === expectedValue,
            });
            break;
          case 'ACCOUNT_MOBILE_EQUALS_EXPECTED':
            if (typeof expectedValue !== 'string') {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                (accountTarget.Celular__c ??
                  normalizePhoneDigits(accountTarget.PersonMobilePhone) ??
                  null) === normalizePhoneDigits(expectedValue),
            });
            break;
          case 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                accountTarget.BillingStreet === expectedValue,
            });
            break;
          case 'ACCOUNT_PROSPECT_ID_EQUALS_EXPECTED':
            if (typeof expectedValue !== 'string') {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                accountTarget.IdProspectSalesforce__c === expectedValue,
            });
            break;
          case 'ACCOUNT_PROSPECT_ID_NOT_STAMPED':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                isBlankText(accountTarget.IdProspectSalesforce__c),
            });
            break;
          case 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                controlTarget !== undefined &&
                controlTarget.PersonEmail === expectedValue,
            });
            break;
          case 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED':
            if (typeof expectedValue !== 'string') {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                controlTarget !== undefined &&
                (controlTarget.Celular__c ??
                  normalizePhoneDigits(controlTarget.PersonMobilePhone) ??
                  null) === normalizePhoneDigits(expectedValue),
            });
            break;
          case 'CONTROL_ACCOUNT_UNCHANGED':
            checks.push({
              check: checkName,
              passed:
                expectedControlAccount !== undefined &&
                controlTarget !== undefined &&
                controlTarget.CPF__pc === expectedControlAccount.account.cpf &&
                controlTarget.LastName ===
                  expectedControlAccount.account.name &&
                controlTarget.IdProspectSalesforce__c ===
                  expectedControlAccount.account.idProspect,
            });
            break;
          case 'NO_OTHER_ACCOUNT_UPDATED':
            checks.push({
              check: checkName,
              passed:
                accountRecords.length === 1 &&
                accountTarget !== undefined &&
                accountTarget.Id__c === eventIdCliente &&
                clientEvent !== undefined &&
                accountTarget.CPF__pc === clientEvent.numerocpf &&
                accountTarget.LastName === clientEvent.nomecompleto &&
                (eventIdProspect === undefined ||
                  accountTarget.IdProspectSalesforce__c ===
                    eventIdProspect),
              actualCount: accountRecords.length,
            });
            break;
          case 'LEAD_COUNT_BY_ID_EXTERNO_IS_ONE':
            checks.push({
              check: checkName,
              passed: leadByExternalId.length === 1,
              actualCount: leadByExternalId.length,
            });
            break;
          case 'LEAD_COUNT_BY_CPF_IS_ONE':
            checks.push({
              check: checkName,
              passed: leadByCpf.length === 1,
              actualCount: leadByCpf.length,
            });
            break;
          case 'LEAD_CPF_EQUALS_EVENT':
            checks.push({
              check: checkName,
              passed:
                leadTarget !== undefined &&
                leadTarget.CPF__c === eventCpf,
            });
            break;
          case 'LEAD_EMAIL_EQUALS_EXPECTED':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                leadTarget !== undefined && leadTarget.Email === expectedValue,
            });
            break;
          case 'LEAD_MOBILE_EQUALS_EXPECTED':
            if (typeof expectedValue !== 'string') {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                leadTarget !== undefined &&
                (leadTarget.CelularSemFormatacao__c ??
                  normalizePhoneDigits(leadTarget.MobilePhone) ??
                  null) === normalizePhoneDigits(expectedValue),
            });
            break;
          case 'LEAD_EMAIL_EXCLUDED':
            checks.push({
              check: checkName,
              passed: leadTarget !== undefined && leadTarget.Email === null,
            });
            break;
          case 'LEAD_MOBILE_EXCLUDED':
            checks.push({
              check: checkName,
              passed:
                leadTarget !== undefined &&
                leadTarget.MobilePhone === null &&
                leadTarget.CelularSemFormatacao__c === null,
            });
            break;
          case 'LEAD_DESCRICAO_ORIGEM_EQUALS':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                leadTarget !== undefined &&
                leadTarget.DescricaoOrigem__c === expectedValue,
            });
            break;
          case 'LEAD_NOT_CREATED':
            checks.push({
              check: checkName,
              passed: leadRecords.length === 0,
              actualCount: leadRecords.length,
            });
            break;
          case 'LEAD_NOT_REQUIRED':
          case 'PROPONENTE_NOT_REQUIRED':
            checks.push({ check: checkName, passed: true });
            break;
          case 'PROPONENTE_NOT_PRESENT':
            checks.push({
              check: checkName,
              passed: proponenteRecords.length === 0,
              actualCount: proponenteRecords.length,
            });
            break;
          case 'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE':
            checks.push({
              check: checkName,
              passed: primaryProponenteCount === 1,
              actualCount: primaryProponenteCount,
            });
            break;
          case 'PROPONENTE_COUNT_EQUALS_EXPECTED':
            checks.push({
              check: checkName,
              passed:
                typeof expectedValue === 'number' &&
                proponenteRecords.length === expectedValue,
              actualCount: proponenteRecords.length,
            });
            break;
          case 'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC':
            checks.push({
              check: checkName,
              passed:
                proponenteTarget !== undefined &&
                accountTarget !== undefined &&
                propostaTarget !== undefined &&
                pacPrimaryProponente !== undefined &&
                proponenteTarget.Proponente__c === accountTarget.Id &&
                proponenteTarget.PropostaAnaliseCredito__c === propostaTarget.Id &&
                proponenteTarget.IdCliente__c === pacPrimaryProponente.idCliente &&
                proponenteTarget.CpfProponente__c === pacPrimaryProponente.cpf &&
                proponenteTarget.TipoClassificacao__c ===
                  pacPrimaryProponente.tipoClassificacao &&
                proponenteTarget.EmailAtualizado__c ===
                  (pacPrimaryProponente.email ?? null) &&
                proponenteTarget.Celular__c ===
                  (pacPrimaryProponente.telefoneCelular ?? null),
            });
            break;
          case 'PRIMARY_PROPONENTE_EMAIL_EQUALS_EXPECTED':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                primaryProponenteTarget !== undefined &&
                primaryProponenteTarget.EmailAtualizado__c === expectedValue,
            });
            break;
          case 'PRIMARY_PROPONENTE_MOBILE_EQUALS_EXPECTED':
            if (typeof expectedValue !== 'string') {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                primaryProponenteTarget !== undefined &&
                (primaryProponenteTarget.Celular__c ?? null) ===
                  normalizePhoneDigits(expectedValue),
            });
            break;
          case 'CONTROL_PROPONENTE_EMAIL_EQUALS_EXPECTED':
            if (expectedValue === undefined) {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                controlProponenteTarget !== undefined &&
                controlProponenteTarget.EmailAtualizado__c === expectedValue,
            });
            break;
          case 'CONTROL_PROPONENTE_MOBILE_EQUALS_EXPECTED':
            if (typeof expectedValue !== 'string') {
              throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
            }
            checks.push({
              check: checkName,
              passed:
                controlProponenteTarget !== undefined &&
                (controlProponenteTarget.Celular__c ?? null) ===
                  normalizePhoneDigits(expectedValue),
            });
            break;
          case 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE':
            checks.push({
              check: checkName,
              passed: opportunityRecords.length === 1,
              actualCount: opportunityRecords.length,
            });
            break;
          case 'OPPORTUNITY_NOT_CREATED':
            checks.push({
              check: checkName,
              passed: opportunityRecords.length === 0,
              actualCount: opportunityRecords.length,
            });
            break;
          case 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT':
            checks.push({
              check: checkName,
              passed:
                opportunityTarget !== undefined &&
                accountTarget !== undefined &&
                opportunityTarget.AccountId === accountTarget.Id,
            });
            break;
          case 'OPPORTUNITY_STAGE_EQUALS_EXPECTED':
            checks.push({
              check: checkName,
              passed:
                typeof expectedValue === 'string' &&
                opportunityTarget?.StageName === expectedValue,
            });
            break;
          case 'OPPORTUNITY_UNIDADE_EXTERNAL_ID_EQUALS_EXPECTED':
            checks.push({
              check: checkName,
              passed:
                typeof expectedValue === 'string' &&
                opportunityTarget?.Unidade__r?.Id__c === expectedValue,
            });
            break;
          case 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED':
            checks.push({
              check: checkName,
              passed:
                typeof expectedValue === 'number' &&
                opportunityLineItems.length === expectedValue,
              actualCount: opportunityLineItems.length,
            });
            break;
          case 'OPPORTUNITY_LINE_ITEM_PRODUCT_EXTERNAL_ID_EQUALS_EXPECTED':
            checks.push({
              check: checkName,
              passed:
                typeof expectedValue === 'string' &&
                opportunityLineItems.length === 1 &&
                opportunityLineItems[0]?.Product2?.Id__c === expectedValue,
            });
            break;
          case 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED':
            checks.push({
              check: checkName,
              passed:
                typeof expectedValue === 'string' &&
                propostaTarget?.Status__c === expectedValue,
            });
            break;
          case 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY':
            checks.push({
              check: checkName,
              passed:
                propostaTarget !== undefined &&
                opportunityTarget !== undefined &&
                propostaTarget.Oportunidade__c === opportunityTarget.Id &&
                opportunityTarget.PACAtual__c === propostaTarget.Id,
            });
            break;
          default:
            throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
        }
      }

      const resultRecordIds = new Set<string>();
      if (accountTarget !== undefined) {
        resultRecordIds.add(accountTarget.Id);
      }
      if (leadTarget !== undefined) {
        resultRecordIds.add(leadTarget.Id);
      }
      if (opportunityTarget !== undefined) {
        resultRecordIds.add(opportunityTarget.Id);
      }
      for (const lineItem of opportunityLineItems) {
        resultRecordIds.add(lineItem.Id);
      }
      if (propostaTarget !== undefined) {
        resultRecordIds.add(propostaTarget.Id);
      }
      if (proponenteTarget !== undefined) {
        resultRecordIds.add(proponenteTarget.Id);
      } else if (primaryProponenteTarget !== undefined) {
        resultRecordIds.add(primaryProponenteTarget.Id);
      }

      return {
        passed: checks.every((check) => check.passed),
        checks,
        recordIds: [...resultRecordIds],
      };
    },

    async cleanup(
      candidate,
      ownedRecordIds,
    ): Promise<SalesforceTestDataCleanupResult> {
      const { fixture } = parseInput(candidate);
      const uniqueIds = [...new Set(ownedRecordIds)];
      const validIds = z
        .array(z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/))
        .safeParse(uniqueIds);
      if (!validIds.success) {
        throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
      }
      if (uniqueIds.length === 0) {
        return { status: 'NO_OP', deletedCount: 0 };
      }
      let deletedCount = 0;

      for (const instruction of fixture.cleanup) {
        if (instruction.target === 'ACCOUNT') {
          const exactOwnerIds = [
            fixture.identifiers.accountIdCliente,
            fixture.identifiers.controlAccountIdCliente,
          ].filter((value): value is string => value !== undefined);
          const records = await queryAccounts(
            asAllowlistedQuery(
              `SELECT ${accountFields} FROM Account WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );

          for (const record of records) {
            if (
              !uniqueIds.includes(record.Id) ||
              (record.Id__c !== null && !exactOwnerIds.includes(record.Id__c))
            ) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }

          await Promise.all(
            records.map((record) =>
              dependencies.restClient.deleteRecord('Account', record.Id),
            ),
          );
          deletedCount += records.length;
          continue;
        }

        if (instruction.target === 'LEAD') {
          const expectedCpf = fixtureCpf(fixture);
          const records = await queryLeads(
            asAllowlistedQuery(
              `SELECT ${leadFields} FROM Lead WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );

          for (const record of records) {
            if (record.Id__c?.startsWith(leadSyntheticIdPrefix) === true) {
              continue;
            }
            if (record.Id__c === null) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
            // CPF is used only to validate the ownership of an already allowlisted
            // Salesforce Id returned by verify(); cleanup still never selects Leads
            // by CPF/email alone.
            if (record.CPF__c !== expectedCpf) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }

          await Promise.all(
            records.map((record) =>
              dependencies.restClient.deleteRecord('Lead', record.Id),
            ),
          );
          deletedCount += records.length;
          continue;
        }

        if (instruction.target === 'PROPONENTE') {
          const expectedPairs = instruction.ownership.proponentes;
          const proponenteRecords = await queryProponentes(
            asAllowlistedQuery(
              `SELECT ${proponenteFields} FROM Proponente__c WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );
          const propostaRecords = await queryPropostasAnaliseCredito(
            asAllowlistedQuery(
              `SELECT ${propostaAnaliseCreditoFields} FROM PropostaAnaliseCredito__c WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );
          const propostaOwner = propostaRecords.find(
            (record) => record.Id__c === instruction.ownership.pacIdExterno,
          );

          if (proponenteRecords.length > 0 && propostaOwner === undefined) {
            throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
          }

          for (const record of proponenteRecords) {
            const matchesOwnedPair = expectedPairs.some(
              (pair) =>
                pair.idExterno === record.Id__c &&
                pair.idCliente === (record.IdCliente__c ?? ''),
            );
            if (
              !uniqueIds.includes(record.Id) ||
              !matchesOwnedPair ||
              record.PropostaAnaliseCredito__c !== propostaOwner?.Id
            ) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }

          await Promise.all(
            proponenteRecords.map((record) =>
              dependencies.restClient.deleteRecord('Proponente__c', record.Id),
            ),
          );
          deletedCount += proponenteRecords.length;
          continue;
        }

        if (instruction.target === 'OPPORTUNITY') {
          const propostaRecords = await queryPropostasAnaliseCredito(
            asAllowlistedQuery(
              `SELECT ${propostaAnaliseCreditoFields} FROM PropostaAnaliseCredito__c WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );
          const contestacaoRecords = await queryContestacoes(
            asAllowlistedQuery(
              `SELECT ${contestacaoFields} FROM Contestacao__c WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );
          const opportunityRecords = await queryOpportunities(
            asAllowlistedQuery(
              `SELECT ${opportunityFields} FROM Opportunity WHERE Id IN (${uniqueIds
                .map(literal)
                .join(',')})`,
            ),
          );
          const opportunityLineItemRecords =
            opportunityRecords.length === 0
              ? []
              : await queryOpportunityLineItems(
                  asAllowlistedQuery(
                    `SELECT ${opportunityLineItemFields} FROM OpportunityLineItem WHERE OpportunityId IN (${opportunityRecords
                      .map((record) => literal(record.Id))
                      .join(',')})`,
                  ),
                );

          for (const record of propostaRecords) {
            if (
              !uniqueIds.includes(record.Id) ||
              (instruction.ownership.pacIdExterno !== undefined &&
                record.Id__c !== instruction.ownership.pacIdExterno)
            ) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }
          for (const record of opportunityRecords) {
            if (
              !uniqueIds.includes(record.Id) ||
              record.Id__c !== instruction.ownership.idExterno
            ) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }
          for (const record of contestacaoRecords) {
            if (!uniqueIds.includes(record.Id)) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
            if (
              propostaRecords.length === 0 ||
              !propostaRecords.some((proposta) => proposta.Id === record.PAC__c)
            ) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }
          for (const record of opportunityLineItemRecords) {
            if (
              record.OpportunityId === null ||
              !opportunityRecords.some(
                (opportunity) => opportunity.Id === record.OpportunityId,
              )
            ) {
              throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
            }
          }
          if (
            propostaRecords.length > 0 &&
            opportunityRecords.length > 0 &&
            propostaRecords.some(
              (record) => record.Oportunidade__c !== opportunityRecords[0]?.Id,
            )
          ) {
            throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
          }

          for (const record of contestacaoRecords) {
            await dependencies.restClient.deleteRecord('Contestacao__c', record.Id);
          }
          for (const record of propostaRecords) {
            await dependencies.restClient.deleteRecord(
              'PropostaAnaliseCredito__c',
              record.Id,
            );
          }
          for (const record of opportunityLineItemRecords) {
            await dependencies.restClient.deleteRecord(
              'OpportunityLineItem',
              record.Id,
            );
          }
          for (const record of opportunityRecords) {
            await dependencies.restClient.deleteRecord(
              'Opportunity',
              record.Id,
            );
          }
          deletedCount +=
            contestacaoRecords.length +
            propostaRecords.length +
            opportunityLineItemRecords.length +
            opportunityRecords.length;
          continue;
        }

        throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
      }

      return {
        status: deletedCount > 0 ? 'DELETED' : 'NO_OP',
        deletedCount,
      };
    },
  };
}
