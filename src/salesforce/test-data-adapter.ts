import { z } from 'zod';

import {
  renderedScenarioFixtureSchema,
  type RenderedScenarioFixture,
} from '../contracts/fixtures';
import {
  asAllowlistedQuery,
  escapeSoqlLiteral,
  SALESFORCE_API_VERSION,
  type SalesforceCompositeRequest,
  type SalesforceRestClient,
} from './rest-client';

const adapterInputSchema = z
  .object({
    runId: z.string().regex(/^run_[A-Za-z0-9_-]{1,64}$/),
    scenarioKey: z.enum([
      'match-id-cliente',
      'match-cpf-sem-id-cliente',
      'no-match-cliente-insert',
      'cliente-update-nova-estrutura',
    ]),
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
    if (!fixture.identifiers.accountIdCliente.startsWith('CLI-SIM-')) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture Account identifier is not simulator-owned',
        path: ['fixture', 'identifiers', 'accountIdCliente'],
      });
    }

    const expectedSetup = {
      'match-id-cliente': ['CREATE_SYNTHETIC_ACCOUNT', 'ID_CLIENTE'],
      'match-cpf-sem-id-cliente': ['CREATE_SYNTHETIC_ACCOUNT', 'CPF'],
      'no-match-cliente-insert': ['ENSURE_ACCOUNT_ABSENT'],
      'cliente-update-nova-estrutura': ['ENSURE_ACCOUNT_ABSENT'],
    }[scenarioKey];
    const setup = fixture.setup[0];
    const setupMatchesScenario =
      fixture.setup.length === 1 &&
      setup !== undefined &&
      setup.operation === expectedSetup[0] &&
      (setup.operation !== 'CREATE_SYNTHETIC_ACCOUNT' ||
        setup.matchBy === expectedSetup[1]);
    if (!setupMatchesScenario) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture setup does not match the core scenario',
        path: ['fixture', 'setup'],
      });
      return;
    }

    const setupCpf =
      setup.operation === 'CREATE_SYNTHETIC_ACCOUNT'
        ? setup.account.cpf
        : setup.keys.cpf;
    const setupIdsMatch =
      setup.operation === 'CREATE_SYNTHETIC_ACCOUNT'
        ? (setup.matchBy === 'CPF' ||
            setup.account.idCliente === fixture.identifiers.accountIdCliente) &&
          setup.account.idProspect === fixture.identifiers.accountIdProspect
        : setup.keys.idCliente === fixture.identifiers.accountIdCliente &&
          setup.keys.idProspect === fixture.identifiers.accountIdProspect;
    if (!setupIdsMatch) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture setup identifiers are inconsistent',
        path: ['fixture', 'setup'],
      });
    }

    for (const [index, step] of fixture.steps.entries()) {
      const event = step.envelope[0]?.data;
      if (
        event === undefined ||
        event.idcliente !== fixture.identifiers.accountIdCliente ||
        event.numerocpf !== setupCpf ||
        event.nomecompleto === undefined ||
        (event.idprospectsalesforce !== undefined &&
          event.idprospectsalesforce !== fixture.identifiers.accountIdProspect)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Fixture event identifiers are inconsistent',
          path: ['fixture', 'steps', index],
        });
      }
    }

    if (
      fixture.cleanup.length !== 1 ||
      fixture.cleanup[0]?.ownership.idCliente !==
        fixture.identifiers.accountIdCliente
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Fixture cleanup ownership is inconsistent',
        path: ['fixture', 'cleanup'],
      });
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
    | 'NO_OTHER_ACCOUNT_UPDATED'
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

const recordTypeQueryResponseSchema = z
  .object({
    totalSize: z.literal(1),
    done: z.literal(true),
    records: z
      .array(
        z
          .object({
            Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
          })
          .passthrough(),
      )
      .length(1),
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
            referenceId: z.literal('createAccount'),
          })
          .passthrough(),
      )
      .length(1),
  })
  .passthrough();

type AccountRecord = z.infer<typeof accountRecordSchema>;

const accountFields =
  'Id,Id__c,IdProspectSalesforce__c,CPF__pc,LastName,IsPersonAccount' as const;
const setupAccountFields = `${accountFields},DataAlteracaoEvento__c` as const;

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

function fixtureEvent(fixture: RenderedScenarioFixture) {
  return fixture.steps[0]!.envelope[0]!.data;
}

function fixtureCpf(fixture: RenderedScenarioFixture): string {
  const setup = fixture.setup[0]!;
  return setup.operation === 'CREATE_SYNTHETIC_ACCOUNT'
    ? setup.account.cpf
    : setup.keys.cpf;
}

function accountLookupQuery(
  fixture: RenderedScenarioFixture,
  includeSetupDate = false,
) {
  const fields = includeSetupDate ? setupAccountFields : accountFields;
  return asAllowlistedQuery(
    `SELECT ${fields} FROM Account WHERE Id__c = ${literal(
      fixture.identifiers.accountIdCliente,
    )} OR CPF__pc = ${literal(fixtureCpf(fixture))}`,
  );
}

export function createSalesforceTestDataAdapter(
  dependencies: SalesforceTestDataAdapterDependencies,
): SalesforceTestDataAdapter {
  let personAccountRecordTypeId: string | undefined;

  async function queryAccounts(
    query: ReturnType<typeof asAllowlistedQuery>,
  ): Promise<AccountRecord[]> {
    return parseAccountQueryResponse(
      await dependencies.restClient.query<unknown>(query),
    );
  }

  async function getPersonAccountRecordTypeId(): Promise<string> {
    if (personAccountRecordTypeId !== undefined) {
      return personAccountRecordTypeId;
    }

    const response = await dependencies.restClient.query<unknown>(
      asAllowlistedQuery(
        "SELECT Id FROM RecordType WHERE SobjectType = 'Account' AND DeveloperName = 'PersonAccount' LIMIT 1",
      ),
    );
    const parsed = recordTypeQueryResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new SalesforceTestDataAdapterError('SALESFORCE_RESPONSE_INVALID');
    }
    personAccountRecordTypeId = parsed.data.records[0]!.Id;
    return personAccountRecordTypeId;
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
          existing.DataAlteracaoEvento__c === account.dataAlteracao;

        if (matchesFixture) {
          replayedCount += 1;
          recordIds.push(existing.Id);
          continue;
        }
        if (records.length > 0) {
          throw new SalesforceTestDataAdapterError('SETUP_CONFLICT');
        }

        const recordTypeId = await getPersonAccountRecordTypeId();
        const body: SalesforceCompositeRequest['body'] = {
          RecordTypeId: recordTypeId,
          LastName: account.name,
          IdProspectSalesforce__c: account.idProspect,
          CPF__pc: account.cpf,
          DataAlteracaoEvento__c: account.dataAlteracao,
        };
        if (account.idCliente !== null) {
          body.Id__c = account.idCliente;
        }

        const requests: readonly SalesforceCompositeRequest[] = [
          {
            method: 'POST',
            url: `/services/data/${SALESFORCE_API_VERSION}/sobjects/Account`,
            referenceId: 'createAccount',
            body,
          },
        ];
        const response = compositeResponseSchema.safeParse(
          await dependencies.restClient.composite(requests),
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
      const records = await queryAccounts(accountLookupQuery(fixture));
      const byClientId = records.filter(
        (record) => record.Id__c === event.idcliente,
      );
      const byCpf = records.filter(
        (record) => record.CPF__pc === event.numerocpf,
      );
      const target =
        byClientId.length === 1
          ? byClientId[0]
          : byCpf.length === 1
            ? byCpf[0]
            : undefined;
      const checks: SalesforceTestDataVerificationCheck[] = [];

      for (const check of fixture.expectedOutcomes.flatMap(
        (outcome) => outcome.checks,
      )) {
        switch (check) {
          case 'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE':
            checks.push({
              check,
              passed: byClientId.length === 1,
              actualCount: byClientId.length,
            });
            break;
          case 'ACCOUNT_COUNT_BY_CPF_IS_ONE':
            checks.push({
              check,
              passed: byCpf.length === 1,
              actualCount: byCpf.length,
            });
            break;
          case 'ACCOUNT_CLIENT_ID_EQUALS_EVENT':
            checks.push({
              check,
              passed: byCpf.length === 1 && byCpf[0].Id__c === event.idcliente,
            });
            break;
          case 'ACCOUNT_NAME_EQUALS_EVENT':
            checks.push({
              check,
              passed:
                target !== undefined && target.LastName === event.nomecompleto,
            });
            break;
          case 'ACCOUNT_IS_PERSON_ACCOUNT':
            checks.push({
              check,
              passed: target?.IsPersonAccount === true,
            });
            break;
          case 'ACCOUNT_CPF_EQUALS_EVENT':
            checks.push({
              check,
              passed:
                target !== undefined && target.CPF__pc === event.numerocpf,
            });
            break;
          case 'NO_OTHER_ACCOUNT_UPDATED':
            checks.push({
              check,
              passed:
                records.length === 1 &&
                target !== undefined &&
                target.Id__c === event.idcliente &&
                target.CPF__pc === event.numerocpf &&
                target.LastName === event.nomecompleto &&
                (event.idprospectsalesforce === undefined ||
                  target.IdProspectSalesforce__c ===
                    event.idprospectsalesforce),
              actualCount: records.length,
            });
            break;
          case 'LEAD_NOT_REQUIRED':
          case 'PROPONENTE_NOT_REQUIRED':
            checks.push({ check, passed: true });
            break;
          default:
            throw new SalesforceTestDataAdapterError('INVALID_FIXTURE');
        }
      }

      return {
        passed: checks.every((check) => check.passed),
        checks,
        recordIds: target === undefined ? [] : [target.Id],
      };
    },

    async cleanup(
      candidate,
      ownedRecordIds,
    ): Promise<SalesforceTestDataCleanupResult> {
      const { fixture } = parseInput(candidate);
      const exactOwnerId = fixture.identifiers.accountIdCliente;
      const uniqueIds = [...new Set(ownedRecordIds)];
      const validIds = z
        .array(z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/))
        .safeParse(uniqueIds);
      if (!validIds.success || !exactOwnerId.startsWith('CLI-SIM-')) {
        throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
      }
      if (uniqueIds.length === 0) {
        return { status: 'NO_OP', deletedCount: 0 };
      }
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
          (record.Id__c !== null && record.Id__c !== exactOwnerId)
        ) {
          throw new SalesforceTestDataAdapterError('OWNERSHIP_MISMATCH');
        }
      }

      await Promise.all(
        records.map((record) =>
          dependencies.restClient.deleteRecord('Account', record.Id),
        ),
      );

      return {
        status: records.length > 0 ? 'DELETED' : 'NO_OP',
        deletedCount: records.length,
      };
    },
  };
}
