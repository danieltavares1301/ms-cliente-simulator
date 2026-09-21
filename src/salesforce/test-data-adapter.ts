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
    const absentAccountSetup = fixture.setup.find(
      (instruction) => instruction.operation === 'ENSURE_ACCOUNT_ABSENT',
    );
    const leadSetup = fixture.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_LEAD',
    );
    const absentLeadSetup = fixture.setup.find(
      (instruction) => instruction.operation === 'ENSURE_LEAD_ABSENT',
    );
    const setupCpf =
      fixtureEvent(fixture).numerocpf ??
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
      if (
        event === undefined ||
        event.idcliente !== fixture.identifiers.accountIdCliente ||
        (setupCpf !== undefined && event.numerocpf !== setupCpf) ||
        event.nomecompleto === undefined ||
        (event.idprospectsalesforce !== undefined &&
          event.idprospectsalesforce !==
            fixture.identifiers.accountIdProspect &&
          event.idprospectsalesforce !==
            fixture.identifiers.controlAccountIdProspect)
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
    | 'ACCOUNT_CLIENT_ID_EQUALS_EVENT'
    | 'ACCOUNT_NAME_EQUALS_EVENT'
    | 'ACCOUNT_IS_PERSON_ACCOUNT'
    | 'ACCOUNT_CPF_EQUALS_EVENT'
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
    | 'PROPONENTE_NOT_REQUIRED';
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
            referenceId: z.enum(['createAccount', 'createLead']),
          })
          .passthrough(),
      )
      .length(1),
  })
  .passthrough();

type AccountRecord = z.infer<typeof accountRecordSchema>;
type LeadRecord = z.infer<typeof leadRecordSchema>;
type FixtureCheck =
  RenderedScenarioFixture['expectedOutcomes'][number]['checks'][number];
type SyntheticAccountSetup = Extract<
  RenderedScenarioFixture['setup'][number],
  { operation: 'CREATE_SYNTHETIC_ACCOUNT' }
>;

const accountFields =
  'Id,Id__c,IdProspectSalesforce__c,CPF__pc,LastName,IsPersonAccount' as const;
const setupAccountFields = `${accountFields},DataAlteracaoEvento__c` as const;
const leadFields =
  'Id,Id__c,FirstName,LastName,CPF__c,MobilePhone,CelularSemFormatacao__c,Email,CidadeInteresse__c,Marca__c,RecordTypeId,ManipularFase__c,Status,PermitirCriarLead__c,DescricaoOrigem__c' as const;
const leadSyntheticIdPrefix = 'LEAD-SIM-' as const;
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

function parseLeadQueryResponse(value: unknown): LeadRecord[] {
  const result = leadQueryResponseSchema.safeParse(value);
  if (!result.success || result.data.totalSize !== result.data.records.length) {
    throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
  }
  return result.data.records;
}

function fixtureEvent(fixture: RenderedScenarioFixture) {
  return fixture.steps[0]!.envelope[0]!.data;
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

function fixtureCpf(fixture: RenderedScenarioFixture): string {
  const eventCpf = fixtureEvent(fixture).numerocpf;
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

  const leadSetup = fixture.setup.find(
    (instruction) => instruction.operation === 'CREATE_SYNTHETIC_LEAD',
  );
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
  setup = fixture.setup.find(
    (instruction) => instruction.operation === 'CREATE_SYNTHETIC_LEAD',
  ),
) {
  return setup?.operation === 'CREATE_SYNTHETIC_LEAD'
    ? (setup.lead.idExterno ?? fixture.identifiers.leadIdExterno)
    : fixture.identifiers.leadIdExterno;
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

function leadLookupKeysForSetup(fixture: RenderedScenarioFixture) {
  const setup = fixture.setup[0]!;
  if (setup.operation === 'CREATE_SYNTHETIC_LEAD') {
    return {
      idExterno: getLeadExternalId(fixture, setup),
      cpf: setup.lead.cpf,
      email: setup.lead.email,
      celular: normalizePhoneDigits(setup.lead.celular),
    };
  }
  if (setup.operation === 'ENSURE_LEAD_ABSENT') {
    return {
      idExterno: setup.keys.idExterno,
      cpf: setup.keys.cpf,
      email: setup.keys.email,
      celular: normalizePhoneDigits(setup.keys.celular),
    };
  }
  throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
}

function leadLookupQueryForSetup(fixture: RenderedScenarioFixture) {
  return asAllowlistedQuery(
    `SELECT ${leadFields} FROM Lead WHERE ${buildLeadWhereClause(
      leadLookupKeysForSetup(fixture),
    )}`,
  );
}

function leadLookupQueryForVerify(fixture: RenderedScenarioFixture) {
  return asAllowlistedQuery(
    `SELECT ${leadFields} FROM Lead WHERE ${buildLeadWhereClause({
      idExterno: getLeadExternalId(fixture),
      cpf: fixtureEvent(fixture).numerocpf,
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

  return {
    async setup(candidate): Promise<SalesforceTestDataSetupResult> {
      const { fixture } = parseInput(candidate);
      let createdCount = 0;
      let replayedCount = 0;
      const recordIds: string[] = [];

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
          const records = await queryLeads(leadLookupQueryForSetup(fixture));
          if (records.length > 0) {
            throw new SalesforceTestDataAdapterError('PRECONDITION_FAILED');
          }
          continue;
        }

        if (instruction.operation === 'CREATE_SYNTHETIC_LEAD') {
          const { lead } = instruction;
          const leadExternalId = getLeadExternalId(fixture, instruction);
          const normalizedCell = normalizePhoneDigits(lead.celular) ?? null;
          const records = await queryLeads(leadLookupQueryForSetup(fixture));
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
        recordIds.push(response.data.compositeResponse[0]!.body.id);
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
      const event = fixtureEvent(fixture);
      const expectedChecks = fixture.expectedOutcomes.flatMap(
        (outcome) => outcome.checks,
      );
      const needsAccountRecords = expectedChecks.some((check) => {
        const checkName = verificationCheckName(check);
        return (
          checkName.startsWith('ACCOUNT_') ||
          checkName === 'CONTROL_ACCOUNT_UNCHANGED' ||
          checkName === 'NO_OTHER_ACCOUNT_UPDATED'
        );
      });
      const needsLeadRecords = expectedChecks.some((check) => {
        const checkName = verificationCheckName(check);
        return (
          checkName.startsWith('LEAD_') && checkName !== 'LEAD_NOT_REQUIRED'
        );
      });

      const accountRecords = needsAccountRecords
        ? await queryAccounts(accountLookupQuery(fixture))
        : [];
      const leadRecords = needsLeadRecords
        ? await queryLeads(leadLookupQueryForVerify(fixture))
        : [];
      const byClientId = accountRecords.filter(
        (record) => record.Id__c === event.idcliente,
      );
      const byCpf = accountRecords.filter(
        (record) => record.CPF__pc === event.numerocpf,
      );
      const accountTarget =
        byClientId.length === 1
          ? byClientId[0]
          : byCpf.length === 1
            ? byCpf[0]
            : undefined;
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
        (record) => record.CPF__c === event.numerocpf,
      );
      const leadTarget =
        leadByExternalId.length === 1
          ? leadByExternalId[0]
          : leadByCpf.length === 1
            ? leadByCpf[0]
            : leadRecords.length === 1
              ? leadRecords[0]
              : undefined;
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
          case 'ACCOUNT_CLIENT_ID_EQUALS_EVENT':
            checks.push({
              check: checkName,
              passed: byCpf.length === 1 && byCpf[0].Id__c === event.idcliente,
            });
            break;
          case 'ACCOUNT_NAME_EQUALS_EVENT':
            checks.push({
              check: checkName,
              passed:
                accountTarget !== undefined &&
                accountTarget.LastName === event.nomecompleto,
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
                accountTarget.CPF__pc === event.numerocpf,
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
                accountTarget.Id__c === event.idcliente &&
                accountTarget.CPF__pc === event.numerocpf &&
                accountTarget.LastName === event.nomecompleto &&
                (event.idprospectsalesforce === undefined ||
                  accountTarget.IdProspectSalesforce__c ===
                    event.idprospectsalesforce),
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
                leadTarget.CPF__c === event.numerocpf,
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
            if (expectedValue === undefined) {
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

        throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
      }

      return {
        status: deletedCount > 0 ? 'DELETED' : 'NO_OP',
        deletedCount,
      };
    },
  };
}
