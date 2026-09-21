import { describe, expect, it, vi } from 'vitest';

import { renderScenarioFixture } from '../scenarios/renderer';
import {
  escapeSoqlLiteral,
  type AllowlistedQuery,
  type SalesforceRestClient,
} from './rest-client';
import {
  createSalesforceTestDataAdapter,
  SalesforceTestDataAdapterError,
} from './test-data-adapter';

const accountId = '001000000000001AAA';
const leadId = '00Q000000000001AAA';

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

function leadFixture() {
  const rendered = JSON.parse(
    JSON.stringify(fixture('no-match-cliente-insert')),
  ) as ReturnType<typeof fixture> & {
    expectedOutcomes: Array<Record<string, unknown>>;
    setup: Array<Record<string, unknown>>;
    cleanup: Array<Record<string, unknown>>;
  };
  rendered.scenarioKey = 'phase6-lead-adapter';
  rendered.identifiers.accountIdProspect = 'LEAD-SIM-owned';
  rendered.identifiers.leadIdExterno = 'LEAD-SIM-owned';
  rendered.steps[0].envelope[0].data.idprospectsalesforce =
    rendered.identifiers.leadIdExterno;
  rendered.setup = [
    {
      operation: 'CREATE_SYNTHETIC_LEAD',
      lead: {
        idExterno: rendered.identifiers.leadIdExterno,
        cpf: rendered.steps[0].envelope[0].data.numerocpf ?? '53278655842',
        firstName: 'Cliente',
        lastName: 'Simulado',
        email: 'lead@example.com',
        celular: '31999990000',
        cidadeInteresse: 'Belo Horizonte',
        status: 'Pendente de Distribuição',
        descricaoOrigem: 'InsertClientePAC',
      },
    },
  ];
  rendered.expectedOutcomes = [
    {
      kind: 'BUSINESS_RESULT',
      result: 'PERSON_ACCOUNT_CREATED',
      description: 'Lead criado ou localizado com os dados esperados.',
      checks: [
        'LEAD_COUNT_BY_ID_EXTERNO_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
        { check: 'LEAD_EMAIL_EQUALS_EXPECTED', value: 'lead@example.com' },
        { check: 'LEAD_MOBILE_EQUALS_EXPECTED', value: '31999990000' },
        {
          check: 'LEAD_DESCRICAO_ORIGEM_EQUALS',
          value: 'InsertClientePAC',
        },
      ],
    },
  ];
  rendered.cleanup = [
    {
      operation: 'DELETE_OWNED_RECORDS',
      target: 'LEAD',
      ownership: {
        idExternoPrefix: 'LEAD-SIM-',
      },
    },
  ];
  return rendered;
}

function leadInput(rendered = leadFixture()) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function createLeadSetup(rendered = leadFixture()) {
  const setup = rendered.setup[0];
  if (setup.operation !== 'CREATE_SYNTHETIC_LEAD') {
    throw new Error('Expected CREATE_SYNTHETIC_LEAD fixture');
  }
  return setup as {
    lead: {
      idExterno?: string;
      cpf: string;
      firstName?: string;
      lastName: string;
      email?: string;
      celular?: string;
      cidadeInteresse?: string;
      status?: string;
      descricaoOrigem?: string;
    };
  };
}

function ensureLeadAbsentFixture() {
  const rendered = leadFixture();
  const setup = createLeadSetup(rendered).lead;
  rendered.setup = [
    {
      operation: 'ENSURE_LEAD_ABSENT',
      keys: {
        idExterno: rendered.identifiers.leadIdExterno,
        cpf: setup.cpf,
        email: setup.email,
        celular: setup.celular,
      },
    },
  ];
  return rendered;
}

function leadFromFixture(
  rendered = leadFixture(),
  overrides: Record<string, unknown> = {},
) {
  const setup = createLeadSetup(rendered).lead;
  return {
    Id: leadId,
    Id__c: setup.idExterno ?? rendered.identifiers.leadIdExterno,
    FirstName: setup.firstName ?? null,
    LastName: setup.lastName,
    CPF__c: setup.cpf,
    MobilePhone: setup.celular ?? null,
    CelularSemFormatacao__c: setup.celular ?? null,
    Email: setup.email ?? null,
    CidadeInteresse__c: setup.cidadeInteresse ?? null,
    Marca__c: '1',
    RecordTypeId: '012000000000002AAA',
    ManipularFase__c: true,
    Status: setup.status ?? 'Pendente de Distribuição',
    PermitirCriarLead__c: true,
    DescricaoOrigem__c: setup.descricaoOrigem ?? null,
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

  it('creates the minimal GestaoVendas Lead through Composite with only allowlisted fields', async () => {
    const rendered = leadFixture();
    const setup = createLeadSetup(rendered).lead;
    const client = restClient();
    client.query
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000002AAA' }],
      });
    client.composite.mockResolvedValue({
      compositeResponse: [
        {
          body: { id: leadId, success: true, errors: [] },
          httpHeaders: {},
          httpStatusCode: 201,
          referenceId: 'createLead',
        },
      ],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        leadInput(rendered),
      ),
    ).resolves.toStrictEqual({
      status: 'CREATED',
      createdCount: 1,
      replayedCount: 0,
      recordIds: [leadId],
    });

    const requests = client.composite.mock.calls[0][0];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Lead',
      referenceId: 'createLead',
      body: {
        Id__c: rendered.identifiers.leadIdExterno,
        FirstName: setup.firstName,
        LastName: setup.lastName,
        CPF__c: setup.cpf,
        MobilePhone: setup.celular,
        CelularSemFormatacao__c: setup.celular,
        Email: setup.email,
        CidadeInteresse__c: setup.cidadeInteresse,
        Marca__c: '1',
        RecordTypeId: '012000000000002AAA',
        ManipularFase__c: true,
        Status: setup.status,
        PermitirCriarLead__c: true,
        DescricaoOrigem__c: setup.descricaoOrigem,
      },
    });
    expect(requests[0].body).not.toHaveProperty('OwnerId');
  });

  it('returns REPLAY without DML when the existing Lead matches the fixture', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [leadFromFixture(rendered)],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).setup(leadInput(rendered));

    expect(result.status).toBe('REPLAY');
    expect(result.recordIds).toStrictEqual([leadId]);
    expect(client.composite).not.toHaveBeenCalled();
  });

  it('fails with SETUP_CONFLICT without mutating an incompatible Lead', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [leadFromFixture(rendered, { Email: 'outro@example.com' })],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        leadInput(rendered),
      ),
    ).rejects.toMatchObject({ code: 'SETUP_CONFLICT' });
    expect(client.composite).not.toHaveBeenCalled();
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });

  it('fails ENSURE_LEAD_ABSENT when any fixed Lead identifier already exists', async () => {
    const rendered = ensureLeadAbsentFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [leadFromFixture(leadFixture())],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        leadInput(rendered),
      ),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('escapes the allowlisted Lead search fields in SOQL', async () => {
    const rendered = ensureLeadAbsentFixture();
    rendered.identifiers.accountIdProspect = "LEAD-SIM-x' OR Name != null";
    rendered.identifiers.leadIdExterno = rendered.identifiers.accountIdProspect;
    rendered.steps[0].envelope[0].data.idprospectsalesforce =
      rendered.identifiers.leadIdExterno;
    rendered.setup[0] = {
      operation: 'ENSURE_LEAD_ABSENT',
      keys: {
        idExterno: rendered.identifiers.leadIdExterno,
        cpf: rendered.steps[0].envelope[0].data.numerocpf,
        email: "lead'@example.com",
        celular: "31999'990000",
      },
    };
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 0,
      done: true,
      records: [],
    });

    await createSalesforceTestDataAdapter({ restClient: client }).setup(
      leadInput(rendered),
    );

    const query = String(client.query.mock.calls[0][0] as AllowlistedQuery);
    expect(query).toContain(
      `Id__c = '${escapeSoqlLiteral(rendered.identifiers.leadIdExterno)}'`,
    );
    expect(query).toContain(
      `Email = '${escapeSoqlLiteral("lead'@example.com")}'`,
    );
    expect(query).toContain(
      `CelularSemFormatacao__c = '${escapeSoqlLiteral('31999990000')}'`,
    );
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
    rendered.cleanup[0].target = 'OPPORTUNITY';
    const client = restClient();

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).verify(
        candidate as never,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_FIXTURE' });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('passes the Lead verification checks for count, CPF, contacts and origin', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [leadFromFixture(rendered)],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(leadInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.recordIds).toStrictEqual([leadId]);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        {
          check: 'LEAD_COUNT_BY_ID_EXTERNO_IS_ONE',
          passed: true,
          actualCount: 1,
        },
        { check: 'LEAD_CPF_EQUALS_EVENT', passed: true },
        { check: 'LEAD_EMAIL_EQUALS_EXPECTED', passed: true },
        { check: 'LEAD_MOBILE_EQUALS_EXPECTED', passed: true },
        { check: 'LEAD_DESCRICAO_ORIGEM_EQUALS', passed: true },
      ]),
    );
  });

  it('passes the Lead exclusion checks used by Regra 6.6', async () => {
    const rendered = leadFixture();
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description:
          'Lead criado sem contatos quando ambos colidem com outra pessoa.',
        checks: ['LEAD_EMAIL_EXCLUDED', 'LEAD_MOBILE_EXCLUDED'],
      },
    ];
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        leadFromFixture(rendered, {
          Email: null,
          MobilePhone: null,
          CelularSemFormatacao__c: null,
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(leadInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'LEAD_EMAIL_EXCLUDED', passed: true },
        { check: 'LEAD_MOBILE_EXCLUDED', passed: true },
      ]),
    );
  });

  it('passes LEAD_NOT_CREATED when no matching Lead exists', async () => {
    const rendered = ensureLeadAbsentFixture();
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description: 'Nenhum lead extra deve ser criado.',
        checks: ['LEAD_NOT_CREATED'],
      },
    ];
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 0,
      done: true,
      records: [],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(leadInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.recordIds).toStrictEqual([]);
    expect(result.checks).toContainEqual({
      check: 'LEAD_NOT_CREATED',
      passed: true,
      actualCount: 0,
    });
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

  it('deletes setup Leads owned by the simulator prefix', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [leadFromFixture(rendered)],
    });
    client.deleteRecord.mockResolvedValue(undefined);

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        leadInput(rendered),
        [leadId],
      ),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 1 });
    expect(client.deleteRecord).toHaveBeenCalledWith('Lead', leadId);
  });

  it('deletes Apex-created Leads only from the explicit Salesforce Id allowlist', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        leadFromFixture(rendered, {
          Id__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
        }),
      ],
    });
    client.deleteRecord.mockResolvedValue(undefined);

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        leadInput(rendered),
        [leadId],
      ),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 1 });
    expect(client.deleteRecord).toHaveBeenCalledWith('Lead', leadId);
  });
});
