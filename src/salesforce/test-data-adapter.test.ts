import { describe, expect, it, vi } from 'vitest';

import { renderScenarioFixture } from '../scenarios/renderer';
import type { AllowlistedQuery, SalesforceRestClient } from './rest-client';
import {
  createSalesforceTestDataAdapter,
  SalesforceTestDataAdapterError,
} from './test-data-adapter';

const accountId = '001000000000001AAA';

type CoreScenarioKey =
  | 'match-id-cliente'
  | 'match-cpf-sem-id-cliente'
  | 'no-match-cliente-insert'
  | 'cliente-update-nova-estrutura';

function fixture(scenarioKey: CoreScenarioKey = 'match-id-cliente') {
  return renderScenarioFixture({
    scenarioKey,
    version: 1,
    seed: 'phase-four-seed',
    runId: 'run_phase_four_a',
    eventStartAt: '2026-09-20T16:30:00.000Z',
  });
}

function input(scenarioKey: CoreScenarioKey = 'match-id-cliente') {
  const rendered = fixture(scenarioKey);
  return {
    runId: rendered.runId,
    scenarioKey,
    fixture: rendered,
  };
}

function restClient(): SalesforceRestClient & {
  query: ReturnType<typeof vi.fn>;
  composite: ReturnType<typeof vi.fn>;
  deleteRecord: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn(),
    composite: vi.fn(),
    deleteRecord: vi.fn(),
  } as unknown as SalesforceRestClient & {
    query: ReturnType<typeof vi.fn>;
    composite: ReturnType<typeof vi.fn>;
    deleteRecord: ReturnType<typeof vi.fn>;
  };
}

function createSetup(rendered = fixture()) {
  const setup = rendered.setup[0];
  if (setup.operation !== 'CREATE_SYNTHETIC_ACCOUNT') {
    throw new Error('Expected CREATE_SYNTHETIC_ACCOUNT fixture');
  }
  return setup;
}

function accountFromFixture(
  rendered = fixture(),
  overrides: Record<string, unknown> = {},
) {
  const event = rendered.steps[0].envelope[0].data;
  return {
    Id: accountId,
    Id__c: event.idcliente,
    IdProspectSalesforce__c: event.idprospectsalesforce ?? null,
    CPF__pc: event.numerocpf,
    LastName: event.nomecompleto,
    IsPersonAccount: true,
    DataAlteracaoEvento__c: event.dataalteracao,
    ...overrides,
  };
}

describe('Salesforce test data adapter setup', () => {
  it('creates the minimal Person Account through Composite without OwnerId', async () => {
    const rendered = fixture();
    const setup = createSetup(rendered);
    const client = restClient();
    client.query
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000001AAA' }],
      });
    client.composite.mockResolvedValue({
      compositeResponse: [
        {
          body: { id: accountId, success: true, errors: [] },
          httpHeaders: {},
          httpStatusCode: 201,
          referenceId: 'createAccount',
        },
      ],
    });
    const adapter = createSalesforceTestDataAdapter({ restClient: client });

    await expect(adapter.setup(input())).resolves.toStrictEqual({
      status: 'CREATED',
      createdCount: 1,
      replayedCount: 0,
      recordIds: [accountId],
    });

    const requests = client.composite.mock.calls[0][0];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Account',
      referenceId: 'createAccount',
      body: {
        RecordTypeId: '012000000000001AAA',
        LastName: setup.account.name,
        Id__c: rendered.identifiers.accountIdCliente,
        IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
        CPF__pc: setup.account.cpf,
        DataAlteracaoEvento__c: setup.account.dataAlteracao,
      },
    });
    expect(requests[0].body).not.toHaveProperty('OwnerId');
  });

  it('returns REPLAY without DML when the existing Account matches the fixture', async () => {
    const rendered = fixture();
    const setupAccount = createSetup(rendered).account;
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        {
          Id: accountId,
          Id__c: setupAccount.idCliente,
          IdProspectSalesforce__c: setupAccount.idProspect,
          CPF__pc: setupAccount.cpf,
          LastName: setupAccount.name,
          IsPersonAccount: true,
          DataAlteracaoEvento__c: setupAccount.dataAlteracao,
        },
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).setup(input());

    expect(result.status).toBe('REPLAY');
    expect(result.recordIds).toStrictEqual([accountId]);
    expect(client.composite).not.toHaveBeenCalled();
  });

  it('fails with SETUP_CONFLICT without mutating an incompatible Account', async () => {
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(fixture(), { LastName: 'Incompatível' })],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(input()),
    ).rejects.toMatchObject({ code: 'SETUP_CONFLICT' });
    expect(client.composite).not.toHaveBeenCalled();
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });

  it('fails ENSURE_ACCOUNT_ABSENT when any fixed identifier already exists', async () => {
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(fixture('no-match-cliente-insert'))],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        input('no-match-cliente-insert'),
      ),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('rejects a fixture whose run or scenario does not match the typed input', async () => {
    const client = restClient();
    const candidate = input();

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup({
        ...candidate,
        runId: 'run_other',
      }),
    ).rejects.toBeInstanceOf(SalesforceTestDataAdapterError);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe('Salesforce test data adapter verify', () => {
  it.each([
    'match-id-cliente',
    'match-cpf-sem-id-cliente',
    'no-match-cliente-insert',
    'cliente-update-nova-estrutura',
  ] as const)('passes every fixed check for %s', async (scenarioKey) => {
    const rendered = fixture(scenarioKey);
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(rendered)],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(input(scenarioKey));

    expect(result.passed).toBe(true);
    expect(result.recordIds).toStrictEqual([accountId]);
    expect(result.checks).toHaveLength(
      rendered.expectedOutcomes.flatMap((outcome) => outcome.checks).length,
    );
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it('fails person-account verification for a Business Account with the expected id', async () => {
    const rendered = fixture('no-match-cliente-insert');
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(rendered, {
          IsPersonAccount: false,
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(input('no-match-cliente-insert'));

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual({
      check: 'ACCOUNT_IS_PERSON_ACCOUNT',
      passed: false,
    });
  });

  it('fails verification when the Account CPF diverges from the event', async () => {
    const rendered = fixture('cliente-update-nova-estrutura');
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(rendered, {
          CPF__pc: '99999999999',
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(input('cliente-update-nova-estrutura'));

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual({
      check: 'ACCOUNT_CPF_EQUALS_EVENT',
      passed: false,
    });
  });

  it('reports count, value and isolation failures without throwing', async () => {
    const rendered = fixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 2,
      done: true,
      records: [
        accountFromFixture(rendered, { LastName: 'Nome divergente' }),
        accountFromFixture(rendered, { Id: '001000000000002AAA' }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(input());

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        {
          check: 'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          passed: false,
          actualCount: 2,
        },
        { check: 'ACCOUNT_NAME_EQUALS_EVENT', passed: false },
        { check: 'NO_OTHER_ACCOUNT_UPDATED', passed: false, actualCount: 2 },
      ]),
    );
  });

  it('reports CPF count and stamped client id failures without throwing', async () => {
    const rendered = fixture('match-cpf-sem-id-cliente');
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 2,
      done: true,
      records: [
        accountFromFixture(rendered, {
          Id__c: 'CLI-SIM-foreign-one',
          LastName: 'Nome divergente',
        }),
        accountFromFixture(rendered, {
          Id: '001000000000002AAA',
          Id__c: 'CLI-SIM-foreign-two',
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(input('match-cpf-sem-id-cliente'));

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        {
          check: 'ACCOUNT_COUNT_BY_CPF_IS_ONE',
          passed: false,
          actualCount: 2,
        },
        { check: 'ACCOUNT_CLIENT_ID_EQUALS_EVENT', passed: false },
        { check: 'ACCOUNT_NAME_EQUALS_EVENT', passed: false },
      ]),
    );
  });

  it('uses only generated fixture values in its allowlisted SOQL', async () => {
    const rendered = fixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(rendered)],
    });

    await createSalesforceTestDataAdapter({ restClient: client }).verify(
      input(),
    );

    const query = client.query.mock.calls[0][0] as AllowlistedQuery;
    expect(String(query)).toContain(rendered.identifiers.accountIdCliente);
    expect(String(query)).toContain(
      rendered.steps[0].envelope[0].data.numerocpf,
    );
    expect(String(query)).not.toContain('SELECT *');
  });

  it('rejects unknown fixture operations and targets before querying', async () => {
    const candidate = JSON.parse(JSON.stringify(input())) as Record<
      string,
      unknown
    >;
    const rendered = candidate.fixture as {
      setup: Array<Record<string, unknown>>;
      cleanup: Array<Record<string, unknown>>;
    };
    rendered.setup[0].operation = 'CREATE_LEAD';
    rendered.cleanup[0].target = 'LEAD';
    const client = restClient();

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).verify(
        candidate as never,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_FIXTURE' });
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe('Salesforce test data adapter cleanup', () => {
  it('is an idempotent no-op when no Account exists', async () => {
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 0,
      done: true,
      records: [],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        input(),
        [],
      ),
    ).resolves.toStrictEqual({ status: 'NO_OP', deletedCount: 0 });
    expect(client.query).not.toHaveBeenCalled();
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });

  it('deletes the CPF setup Account with null Id__c by its persisted Salesforce ID', async () => {
    const rendered = fixture('match-cpf-sem-id-cliente');
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(rendered, { Id__c: null })],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        input('match-cpf-sem-id-cliente'),
        [accountId],
      ),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 1 });
    expect(client.deleteRecord).toHaveBeenCalledWith('Account', accountId);
  });

  it('fails closed when an Account selected by fixture keys is not owned', async () => {
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(fixture(), {
          Id__c: 'CLI-FOREIGN',
        }),
      ],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(input(), [
        accountId,
      ]),
    ).rejects.toMatchObject({ code: 'OWNERSHIP_MISMATCH' });
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });

  it('deletes only Accounts with the exact namespaced fixture owner id', async () => {
    const rendered = fixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(rendered)],
    });
    client.deleteRecord.mockResolvedValue(undefined);

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(input(), [
        accountId,
      ]),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 1 });
    expect(client.deleteRecord).toHaveBeenCalledWith('Account', accountId);
  });
});
