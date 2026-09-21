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
const controlAccountId = '001000000000002AAA';
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

function clientEventData(rendered = fixture()) {
  const step = rendered.steps.find(
    (candidate) =>
      candidate.eventType === 'cliente-insert' ||
      candidate.eventType === 'cliente-update',
  );
  if (!step) {
    throw new Error('Expected fixture with cliente event');
  }
  return step.envelope[0].data as {
    idcliente: string;
    idprospectsalesforce?: string;
    numerocpf?: string;
    nomecompleto?: string;
    dataalteracao?: string;
  };
}

function accountFromFixture(
  rendered = fixture(),
  overrides: Record<string, unknown> = {},
) {
  const event = clientEventData(rendered);
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
      role: 'PRIMARY',
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

function prospectDivergenteFixture() {
  const rendered = JSON.parse(
    JSON.stringify(fixture('no-match-cliente-insert')),
  ) as ReturnType<typeof fixture> & {
    expectedOutcomes: Array<Record<string, unknown>>;
    setup: Array<Record<string, unknown>>;
    cleanup: Array<Record<string, unknown>>;
    identifiers: ReturnType<typeof fixture>['identifiers'] & {
      controlAccountIdCliente?: string;
      controlAccountIdProspect?: string;
    };
  };
  rendered.scenarioKey = 'cliente-insert-prospect-divergente';
  rendered.identifiers.controlAccountIdCliente = 'CLI-SIM-X-phase-four';
  rendered.identifiers.controlAccountIdProspect = 'PRO-SIM-X-phase-four';
  rendered.steps[0].key = 'cliente-insert-divergente';
  rendered.steps[0].envelope[0].data.idprospectsalesforce =
    rendered.identifiers.controlAccountIdProspect;
  rendered.setup = [
    {
      operation: 'CREATE_SYNTHETIC_ACCOUNT',
      role: 'CONTROL',
      matchBy: 'ID_CLIENTE',
      account: {
        idCliente: rendered.identifiers.controlAccountIdCliente,
        idProspect: rendered.identifiers.controlAccountIdProspect,
        cpf: '39095812030',
        name: 'Cliente Controle',
        dataAlteracao: '2026-09-20T16:29:59.000Z',
      },
    },
    {
      operation: 'ENSURE_ACCOUNT_ABSENT',
      keys: {
        idCliente: rendered.identifiers.accountIdCliente,
        idProspect: rendered.identifiers.accountIdProspect,
        cpf: rendered.steps[0].envelope[0].data.numerocpf ?? '53278655842',
      },
    },
    {
      operation: 'ENSURE_LEAD_ABSENT',
      keys: {
        idExterno: rendered.identifiers.controlAccountIdProspect,
        cpf: rendered.steps[0].envelope[0].data.numerocpf ?? '53278655842',
      },
    },
  ];
  rendered.expectedOutcomes = [
    {
      kind: 'BUSINESS_RESULT',
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      description:
        'Cria a Account Y, gera Lead novo por CPF e preserva a Account de controle X.',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'CONTROL_ACCOUNT_UNCHANGED',
        'LEAD_COUNT_BY_CPF_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
      ],
    },
  ];
  rendered.cleanup = [
    {
      operation: 'DELETE_OWNED_RECORDS',
      target: 'ACCOUNT',
      ownership: {
        idCliente: rendered.identifiers.accountIdCliente,
        controlAccountIdCliente: rendered.identifiers.controlAccountIdCliente,
      },
    },
    {
      operation: 'DELETE_OWNED_RECORDS',
      target: 'LEAD',
      ownership: { idExternoPrefix: 'LEAD-SIM-' },
    },
  ];
  return rendered;
}

function contatoAntesClienteColisaoFixture() {
  const rendered = JSON.parse(
    JSON.stringify(fixture('no-match-cliente-insert')),
  ) as ReturnType<typeof fixture> & {
    expectedOutcomes: Array<Record<string, unknown>>;
    setup: Array<Record<string, unknown>>;
    cleanup: Array<Record<string, unknown>>;
    identifiers: ReturnType<typeof fixture>['identifiers'] & {
      collisionLeadIdExterno?: string;
    };
  };
  const scheduledAt = '2026-09-20T16:30:00.000Z';

  rendered.scenarioKey = 'contato-antes-cliente-colisao';
  rendered.identifiers.collisionLeadIdExterno = 'LEAD-SIM-COL-phase-four';
  rendered.steps = [
    {
      key: 'contato-email',
      target: 'CLIENTE',
      eventType: 'contato-insert',
      delayMs: 0,
      scheduledAt,
      deliveryPolicy: {
        duplicateCount: 0,
        retryOn: [],
        maxAttempts: 1,
      },
      envelope: [
        {
          id: 'EVT-SIM-contact-phase-four',
          subject: 'MS_Clientes',
          eventType: 'contato-insert',
          eventTime: scheduledAt,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: rendered.identifiers.accountIdCliente,
            idprospectsalesforce: rendered.identifiers.accountIdProspect,
            tipocontato: 'Email',
            descricao: 'colisao.phase-four@simulador.mrv.invalid',
            dataalteracao: scheduledAt,
          },
        },
      ],
    },
  ];
  rendered.setup = [
    {
      operation: 'ENSURE_ACCOUNT_ABSENT',
      keys: {
        idCliente: rendered.identifiers.accountIdCliente,
        idProspect: rendered.identifiers.accountIdProspect,
        cpf: '53278655842',
      },
    },
    {
      operation: 'CREATE_SYNTHETIC_LEAD',
      role: 'COLLISION',
      lead: {
        idExterno: rendered.identifiers.collisionLeadIdExterno,
        cpf: '39095812030',
        lastName: 'Terceiro Colidente',
        email: 'colisao.phase-four@simulador.mrv.invalid',
        status: 'Pendente de Distribuição',
      },
    },
  ];
  rendered.expectedOutcomes = [
    {
      kind: 'BUSINESS_RESULT',
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      description:
        'Fixture mínima para validar contato-insert e Lead de colisão.',
      checks: ['LEAD_NOT_REQUIRED'],
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

function contatoAntesClienteColisaoInput(
  rendered = contatoAntesClienteColisaoFixture(),
) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function prospectDivergenteInput(rendered = prospectDivergenteFixture()) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function controlAccountFromFixture(
  rendered = prospectDivergenteFixture(),
  overrides: Record<string, unknown> = {},
) {
  const setup = rendered.setup[0];
  if (
    setup.operation !== 'CREATE_SYNTHETIC_ACCOUNT' ||
    setup.role !== 'CONTROL'
  ) {
    throw new Error('Expected CONTROL synthetic account fixture');
  }
  return {
    Id: controlAccountId,
    Id__c: setup.account.idCliente,
    IdProspectSalesforce__c: setup.account.idProspect,
    CPF__pc: setup.account.cpf,
    LastName: setup.account.name,
    IsPersonAccount: true,
    DataAlteracaoEvento__c: setup.account.dataAlteracao,
    ...overrides,
  };
}

function createdLeadFromFixture(
  rendered = prospectDivergenteFixture(),
  overrides: Record<string, unknown> = {},
) {
  const event = clientEventData(rendered);
  return {
    Id: leadId,
    Id__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
    FirstName: 'Cliente',
    LastName: event.nomecompleto,
    CPF__c: event.numerocpf,
    MobilePhone: null,
    CelularSemFormatacao__c: null,
    Email: null,
    CidadeInteresse__c: null,
    Marca__c: '1',
    RecordTypeId: '012000000000002AAA',
    ManipularFase__c: true,
    Status: 'Pendente de Distribuição',
    PermitirCriarLead__c: true,
    DescricaoOrigem__c: 'InsertClientePAC',
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

  it('returns REPLAY when Salesforce echoes DataAlteracaoEvento__c with a numeric offset instead of Z', async () => {
    // Regression: real Salesforce REST responses format datetimes as
    // "...+0000" instead of the "...Z" suffix we send, which previously broke
    // the raw string comparison and produced a false SETUP_CONFLICT on any
    // retry/replay of an already-created Account (found via a real run against
    // mrv-devDan in Phase 6).
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
          DataAlteracaoEvento__c: setupAccount.dataAlteracao.replace(
            'Z',
            '+0000',
          ),
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

  it('resolves the ENSURE_LEAD_ABSENT keys from its own setup instruction, not from setup[0]', async () => {
    // Regression: leadLookupKeysForSetup used to always read fixture.setup[0],
    // which is only correct when the Lead-related setup instruction happens to
    // be the first entry. The prospect-divergente fixture places
    // CREATE_SYNTHETIC_ACCOUNT (CONTROL) at index 0 and ENSURE_LEAD_ABSENT at
    // index 2, so the old code treated the Account setup as a Lead setup and
    // threw INVALID_FIXTURE (found via a real run against mrv-devDan).
    const rendered = prospectDivergenteFixture();
    const client = restClient();
    client.query
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] }) // CREATE_SYNTHETIC_ACCOUNT (control) existing check
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000001AAA' }],
      }) // Person Account RecordType lookup
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] }) // ENSURE_ACCOUNT_ABSENT
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] }); // ENSURE_LEAD_ABSENT
    client.composite.mockResolvedValue({
      compositeResponse: [
        {
          body: { id: controlAccountId, success: true, errors: [] },
          httpStatusCode: 201,
          referenceId: 'createAccount',
        },
      ],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        prospectDivergenteInput(rendered),
      ),
    ).resolves.toMatchObject({ status: 'CREATED', createdCount: 1 });

    const leadAbsenceQuery = String(client.query.mock.calls[3][0]);
    const leadSetup = rendered.setup[2];
    if (leadSetup.operation !== 'ENSURE_LEAD_ABSENT') {
      throw new Error('Expected fixture setup[2] to be ENSURE_LEAD_ABSENT');
    }
    expect(leadAbsenceQuery).toContain(
      `Id__c = '${leadSetup.keys.idExterno}'`,
    );
    expect(leadAbsenceQuery).toContain(`CPF__c = '${leadSetup.keys.cpf}'`);
  });

  it('accepts contato steps rendered with the control identity in O08 fixtures', async () => {
    const rendered = renderScenarioFixture({
      scenarioKey: 'cpf-divergente-identidade-antiga',
      version: 1,
      seed: 'phase-four-seed',
      runId: 'run_phase_four_a',
      eventStartAt: '2026-09-20T16:30:00.000Z',
    });
    const client = restClient();
    client.query
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000001AAA' }],
      })
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] });
    client.composite.mockResolvedValue({
      compositeResponse: [
        {
          body: { id: controlAccountId, success: true, errors: [] },
          httpStatusCode: 201,
          referenceId: 'createAccount',
        },
      ],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup({
        runId: rendered.runId,
        scenarioKey: rendered.scenarioKey,
        fixture: rendered,
      }),
    ).resolves.toMatchObject({ status: 'CREATED', createdCount: 1 });
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

  it('verifies that obsolete events leave the Account name and CPF at the setup values', async () => {
    const rendered = fixture('match-id-cliente');
    const setup = createSetup(rendered);
    rendered.scenarioKey = 'evento-obsoleto';
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'Evento obsoleto não deve sobrescrever nome nem CPF persistidos.',
        checks: ['ACCOUNT_NAME_EQUALS_SETUP', 'ACCOUNT_CPF_EQUALS_SETUP'],
      },
    ];
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(rendered, {
          LastName: setup.account.name,
          CPF__pc: setup.account.cpf,
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'ACCOUNT_NAME_EQUALS_SETUP', passed: true },
        { check: 'ACCOUNT_CPF_EQUALS_SETUP', passed: true },
      ]),
    );
  });

  it('fails ACCOUNT_NAME_EQUALS_SETUP/ACCOUNT_CPF_EQUALS_SETUP when the Account was overwritten by the obsolete event', async () => {
    // Regression guard: these checks must compare against the fixture SETUP
    // values, not the (obsolete) event values — otherwise a bug that wired
    // them to the event would still report a false PASS here.
    const rendered = fixture('match-id-cliente');
    rendered.scenarioKey = 'evento-obsoleto';
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'Evento obsoleto não deve sobrescrever nome nem CPF persistidos.',
        checks: ['ACCOUNT_NAME_EQUALS_SETUP', 'ACCOUNT_CPF_EQUALS_SETUP'],
      },
    ];
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(rendered, {
          LastName: 'Nome do evento obsoleto',
          CPF__pc: '99988877766',
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'ACCOUNT_NAME_EQUALS_SETUP', passed: false },
        { check: 'ACCOUNT_CPF_EQUALS_SETUP', passed: false },
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

  it('accepts contato-insert fixtures without nomecompleto and keeps the collision Lead independent', async () => {
    const rendered = contatoAntesClienteColisaoFixture();
    const client = restClient();
    client.query
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000002AAA' }],
      });
    client.composite.mockResolvedValue({
      compositeResponse: [
        {
          httpStatusCode: 201,
          body: { id: leadId, success: true, errors: [] },
          referenceId: 'createLead',
        },
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).setup(contatoAntesClienteColisaoInput(rendered));

    expect(result).toMatchObject({
      status: 'CREATED',
      createdCount: 1,
      recordIds: [leadId],
    });
    expect(String(client.query.mock.calls[1]?.[0])).toContain(
      rendered.identifiers.collisionLeadIdExterno!,
    );
    expect(String(client.query.mock.calls[1]?.[0])).not.toContain(
      rendered.identifiers.leadIdExterno,
    );
    expect(client.composite.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({
            Id__c: rendered.identifiers.collisionLeadIdExterno,
            CPF__c: '39095812030',
            Email: 'colisao.phase-four@simulador.mrv.invalid',
          }),
        }),
      ]),
    );
  });

  it('still rejects cliente-insert sem nomecompleto after supporting contato-insert steps', async () => {
    const candidate = input('no-match-cliente-insert');
    delete (
      candidate.fixture.steps[0]?.envelope[0]?.data as {
        nomecompleto?: string;
      }
    ).nomecompleto;
    const client = restClient();

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(candidate),
    ).rejects.toMatchObject({ code: 'INVALID_FIXTURE' });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('rejects endereco-insert sem logradouro after supporting O03 permutations', async () => {
    const rendered = renderScenarioFixture({
      scenarioKey: 'ordem-mesmo-eventtime-cliente-primeiro',
      version: 1,
      seed: 'phase-four-seed',
      runId: 'run_phase_four_a',
      eventStartAt: '2026-09-20T16:30:00.000Z',
    });
    const addressStep = rendered.steps.find(
      (step) => step.eventType === 'endereco-insert',
    );
    if (!addressStep) {
      throw new Error('Expected endereco-insert step');
    }
    delete (
      addressStep.envelope[0].data as {
        logradouro?: string;
      }
    ).logradouro;
    const client = restClient();

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup({
        runId: rendered.runId,
        scenarioKey: rendered.scenarioKey,
        fixture: rendered,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FIXTURE' });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('rejects collision Leads whose rendered external id diverges from fixture identifiers', async () => {
    const rendered = contatoAntesClienteColisaoFixture();
    (
      rendered.setup[1] as {
        lead: {
          idExterno?: string;
        };
      }
    ).lead.idExterno = 'LEAD-SIM-COL-diferente';
    const client = restClient();

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        contatoAntesClienteColisaoInput(rendered),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_FIXTURE' });
    expect(client.query).not.toHaveBeenCalled();
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

  it('verifies contato-antes-cliente-colisao against the cliente-insert outcome and not the collision lead', async () => {
    const rendered = renderScenarioFixture({
      scenarioKey: 'contato-antes-cliente-colisao',
      version: 1,
      seed: 'phase-four-seed',
      runId: 'run_phase_four_a',
      eventStartAt: '2026-09-20T16:30:00.000Z',
    });
    const controlSetup = rendered.setup.find(
      (instruction) =>
        instruction.operation === 'CREATE_SYNTHETIC_ACCOUNT' &&
        instruction.role === 'CONTROL',
    );
    const expectedMobile = rendered.expectedOutcomes[0]?.checks.find(
      (check) =>
        typeof check !== 'string' &&
        check.check === 'LEAD_MOBILE_EQUALS_EXPECTED',
    );
    const clientEvent = clientEventData(rendered);
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 2,
        done: true,
        records: [
          {
            Id: accountId,
            Id__c: clientEvent.idcliente,
            IdProspectSalesforce__c: null,
            CPF__pc: clientEvent.numerocpf,
            LastName: clientEvent.nomecompleto,
            IsPersonAccount: true,
          },
          {
            Id: controlAccountId,
            Id__c:
              controlSetup?.operation === 'CREATE_SYNTHETIC_ACCOUNT'
                ? controlSetup.account.idCliente
                : null,
            IdProspectSalesforce__c:
              controlSetup?.operation === 'CREATE_SYNTHETIC_ACCOUNT'
                ? controlSetup.account.idProspect
                : null,
            CPF__pc:
              controlSetup?.operation === 'CREATE_SYNTHETIC_ACCOUNT'
                ? controlSetup.account.cpf
                : null,
            LastName:
              controlSetup?.operation === 'CREATE_SYNTHETIC_ACCOUNT'
                ? controlSetup.account.name
                : null,
            IsPersonAccount: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: leadId,
            Id__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
            FirstName: null,
            LastName: clientEvent.nomecompleto ?? null,
            CPF__c: clientEvent.numerocpf ?? null,
            MobilePhone:
              typeof expectedMobile === 'string' ? null : expectedMobile?.value,
            CelularSemFormatacao__c:
              typeof expectedMobile === 'string' ? null : expectedMobile?.value,
            Email: null,
            CidadeInteresse__c: null,
            Marca__c: '1',
            RecordTypeId: '012000000000002AAA',
            ManipularFase__c: true,
            Status: 'Pendente de Distribuição',
            PermitirCriarLead__c: true,
            DescricaoOrigem__c: null,
          },
        ],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(true);
    expect(String(client.query.mock.calls[1]?.[0])).not.toContain(
      rendered.identifiers.collisionLeadIdExterno!,
    );
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'LEAD_EMAIL_EXCLUDED', passed: true },
        { check: 'LEAD_MOBILE_EQUALS_EXPECTED', passed: true },
        { check: 'CONTROL_ACCOUNT_UNCHANGED', passed: true },
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

  it('passes ACCOUNT_NOT_CREATED when no matching Account exists', async () => {
    const rendered = JSON.parse(
      JSON.stringify(fixture('no-match-cliente-insert')),
    ) as ReturnType<typeof fixture> & {
      expectedOutcomes: Array<Record<string, unknown>>;
    };
    rendered.scenarioKey = 'phase6-account-absent';
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description: 'Nenhuma Account do cliente novo deve existir.',
        checks: ['ACCOUNT_NOT_CREATED'],
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
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(true);
    expect(result.recordIds).toStrictEqual([]);
    expect(result.checks).toContainEqual({
      check: 'ACCOUNT_NOT_CREATED',
      passed: true,
      actualCount: 0,
    });
  });

  it('fails ACCOUNT_NOT_CREATED when the Account already exists', async () => {
    const rendered = JSON.parse(
      JSON.stringify(fixture('no-match-cliente-insert')),
    ) as ReturnType<typeof fixture> & {
      expectedOutcomes: Array<Record<string, unknown>>;
    };
    rendered.scenarioKey = 'phase6-account-absent';
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description: 'Nenhuma Account do cliente novo deve existir.',
        checks: ['ACCOUNT_NOT_CREATED'],
      },
    ];
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [accountFromFixture(rendered)],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual({
      check: 'ACCOUNT_NOT_CREATED',
      passed: false,
      actualCount: 1,
    });
  });

  it('passes the O08 checks when contacts stay on the control Account and Y remains empty', async () => {
    const rendered = renderScenarioFixture({
      scenarioKey: 'cpf-divergente-identidade-antiga',
      version: 1,
      seed: 'phase-four-seed',
      runId: 'run_phase_four_a',
      eventStartAt: '2026-09-20T16:30:00.000Z',
    }) as ReturnType<typeof fixture> & {
      expectedOutcomes: Array<Record<string, unknown>>;
    };
    const emailContato = rendered.steps[0]!.envelope[0]!.data as {
      descricao: string;
    };
    const celularContato = rendered.steps[1]!.envelope[0]!.data as {
      descricao: string;
    };
    rendered.expectedOutcomes = [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
        description:
          'Os contatos parciais ficam em X; Y e o Lead final permanecem sem contatos.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'ACCOUNT_EMAIL_EXCLUDED',
          'ACCOUNT_MOBILE_EXCLUDED',
          {
            check: 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: emailContato.descricao,
          },
          {
            check: 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: celularContato.descricao,
          },
          'LEAD_COUNT_BY_CPF_IS_ONE',
          'LEAD_CPF_EQUALS_EVENT',
          'LEAD_EMAIL_EXCLUDED',
          'LEAD_MOBILE_EXCLUDED',
        ],
      },
    ];
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 2,
        done: true,
        records: [
          accountFromFixture(rendered, {
            IdProspectSalesforce__c: '50dcfa9f-9d7e-4205-5cb2-2065dd60148c',
            PersonEmail: null,
            PersonMobilePhone: null,
            Celular__c: null,
          }),
          controlAccountFromFixture(rendered, {
            PersonEmail: emailContato.descricao,
            PersonMobilePhone: `55${celularContato.descricao}`,
            Celular__c: celularContato.descricao,
          }),
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [createdLeadFromFixture(rendered)],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'ACCOUNT_EMAIL_EXCLUDED', passed: true },
        { check: 'ACCOUNT_MOBILE_EXCLUDED', passed: true },
        { check: 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED', passed: true },
        { check: 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED', passed: true },
        { check: 'LEAD_EMAIL_EXCLUDED', passed: true },
        { check: 'LEAD_MOBILE_EXCLUDED', passed: true },
      ]),
    );
  });

  it('passes the O03 account convergence checks for email, mobile and billing street', async () => {
    const rendered = renderScenarioFixture({
      scenarioKey: 'ordem-mesmo-eventtime-contato-primeiro',
      version: 1,
      seed: 'phase-four-seed',
      runId: 'run_phase_four_a',
      eventStartAt: '2026-09-20T16:30:00.000Z',
    });
    const emailStep = rendered.steps.find(
      (step) =>
        step.eventType === 'contato-insert' &&
        (step.envelope[0].data as { tipocontato?: string }).tipocontato ===
          'Email',
    );
    const mobileStep = rendered.steps.find(
      (step) =>
        step.eventType === 'contato-insert' &&
        (step.envelope[0].data as { tipocontato?: string }).tipocontato ===
          'Celular',
    );
    const addressStep = rendered.steps.find(
      (step) => step.eventType === 'endereco-insert',
    );
    const expectedEmail = (emailStep?.envelope[0].data as { descricao: string })
      .descricao;
    const expectedMobile = (
      mobileStep?.envelope[0].data as { descricao: string }
    ).descricao;
    const expectedStreet = (
      addressStep?.envelope[0].data as { logradouro: string }
    ).logradouro;
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(rendered, {
          PersonEmail: expectedEmail,
          PersonMobilePhone: `55${expectedMobile}`,
          Celular__c: expectedMobile,
          BillingStreet: expectedStreet,
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED', passed: true },
        { check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED', passed: true },
        { check: 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED', passed: true },
      ]),
    );
  });

  it('fails the O03 account convergence checks when email, mobile and billing street diverge', async () => {
    // Regression guard: these three checks must genuinely compare the
    // queried Account fields against the expected fixture values, not
    // always report true. Overwrite each field with a divergent value and
    // confirm each check independently reports passed: false.
    const rendered = renderScenarioFixture({
      scenarioKey: 'ordem-mesmo-eventtime-contato-primeiro',
      version: 1,
      seed: 'phase-four-seed',
      runId: 'run_phase_four_a',
      eventStartAt: '2026-09-20T16:30:00.000Z',
    });
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        accountFromFixture(rendered, {
          PersonEmail: 'divergente@simulador.mrv.invalid',
          PersonMobilePhone: '5511900000000',
          Celular__c: '11900000000',
          BillingStreet: 'Rua Divergente, 999',
        }),
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: rendered,
    });

    expect(result.passed).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED', passed: false },
        { check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED', passed: false },
        { check: 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED', passed: false },
      ]),
    );
  });

  it('passes the divergent prospect checks and queries the control Account explicitly', async () => {
    const rendered = prospectDivergenteFixture();
    const primaryAccount = accountFromFixture(rendered, {
      IdProspectSalesforce__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
    });
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 2,
        done: true,
        records: [primaryAccount, controlAccountFromFixture(rendered)],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [createdLeadFromFixture(rendered)],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(prospectDivergenteInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'CONTROL_ACCOUNT_UNCHANGED', passed: true },
        {
          check: 'LEAD_COUNT_BY_CPF_IS_ONE',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
    const accountQuery = String(
      client.query.mock.calls[0][0] as AllowlistedQuery,
    );
    expect(accountQuery).toContain(
      rendered.identifiers.controlAccountIdCliente!,
    );
    expect(accountQuery).toContain('39095812030');
  });

  it('fails CONTROL_ACCOUNT_UNCHANGED when the control Account diverges', async () => {
    const rendered = prospectDivergenteFixture();
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 2,
        done: true,
        records: [
          accountFromFixture(rendered, {
            IdProspectSalesforce__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
          }),
          controlAccountFromFixture(rendered, {
            LastName: 'Controle alterado indevidamente',
          }),
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [createdLeadFromFixture(rendered)],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(prospectDivergenteInput(rendered));

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual({
      check: 'CONTROL_ACCOUNT_UNCHANGED',
      passed: false,
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

  it('deletes both the primary and control Accounts when both are simulator-owned', async () => {
    const rendered = prospectDivergenteFixture();
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 2,
        done: true,
        records: [
          accountFromFixture(rendered, { IdProspectSalesforce__c: null }),
          controlAccountFromFixture(rendered),
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 0,
        done: true,
        records: [],
      });
    client.deleteRecord.mockResolvedValue(undefined);

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        prospectDivergenteInput(rendered),
        [accountId, controlAccountId],
      ),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 2 });
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      1,
      'Account',
      accountId,
    );
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      2,
      'Account',
      controlAccountId,
    );
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
    const setup = createLeadSetup(rendered).lead;
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        leadFromFixture(rendered, {
          Id__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
          CPF__c: setup.cpf,
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

  it('rejects Apex-created Leads with a mismatched fixture CPF even when the Salesforce Id is allowlisted', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        leadFromFixture(rendered, {
          Id__c: 'e7d66d58-7ca3-4d75-a3c8-5ca3f4210f9b',
          CPF__c: '39095812030',
        }),
      ],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        leadInput(rendered),
        [leadId],
      ),
    ).rejects.toMatchObject({ code: 'OWNERSHIP_MISMATCH' });
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });

  it('rejects cleanup for Leads without Id__c even when the Salesforce Id is allowlisted', async () => {
    const rendered = leadFixture();
    const client = restClient();
    client.query.mockResolvedValue({
      totalSize: 1,
      done: true,
      records: [
        leadFromFixture(rendered, {
          Id__c: null,
        }),
      ],
    });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        leadInput(rendered),
        [leadId],
      ),
    ).rejects.toMatchObject({ code: 'OWNERSHIP_MISMATCH' });
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });
});
