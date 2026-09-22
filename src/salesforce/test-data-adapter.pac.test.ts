import { describe, expect, it, vi } from 'vitest';

import { renderScenarioFixture } from '../scenarios/renderer';
import type { SalesforceRestClient } from './rest-client';
import {
  createSalesforceTestDataAdapter,
  SalesforceTestDataAdapterError,
} from './test-data-adapter';

const accountId = '001000000000001AAA';
const opportunityId = '006000000000001AAA';
const propostaId = 'a0A000000000001AAA';
const proponenteId = 'a10000000000001AAA';

function pacFixture() {
  return renderScenarioFixture({
    scenarioKey: 'pac-insert-minimo',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_a',
    eventStartAt: '2026-09-22T00:00:00.000Z',
  });
}

function pacInput(rendered = pacFixture()) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function pacApprovedFixture() {
  return renderScenarioFixture({
    scenarioKey: 'pac-aprovada-sincroniza-contatos',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_b',
    eventStartAt: '2026-09-22T00:00:00.000Z',
  });
}

function pacApprovedInput(rendered = pacApprovedFixture()) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function pacUpdateWithoutProponentesFixture() {
  return renderScenarioFixture({
    scenarioKey: 'pac-update-altera-status-sem-proponentes',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_d',
    eventStartAt: '2026-09-22T00:00:00.000Z',
  });
}

function pacUpdateWithoutProponentesInput(
  rendered = pacUpdateWithoutProponentesFixture(),
) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function pacUpdateWithProponentesFixture() {
  return renderScenarioFixture({
    scenarioKey: 'pac-update-reenviando-proponentes',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_e',
    eventStartAt: '2026-09-22T00:00:00.000Z',
  });
}

function pacUpdateWithProponentesInput(
  rendered = pacUpdateWithProponentesFixture(),
) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function pacEventData(rendered = pacFixture()) {
  return rendered.steps[0]!.envelope[0]!.data as {
    id: string;
    idjornadapac: string;
    status?: string;
  };
}

function pacApprovedEventData(rendered = pacApprovedFixture()) {
  return rendered.steps[0]!.envelope[0]!.data as {
    id: string;
    idjornadapac: string;
    status: string;
    dataalteracao: string;
    proponentes: Array<{
      id: string;
      idPac: string;
      idCliente: string;
      cpf: string;
      tipoClassificacao: string;
      dataAlteracao: string;
      nomeCompleto?: string;
      email?: string;
      telefoneCelular?: string;
    }>;
  };
}

function pacUpdateWithoutProponentesFinalEventData(
  rendered = pacUpdateWithoutProponentesFixture(),
) {
  return rendered.steps[1]!.envelope[0]!.data as {
    id: string;
    idjornadapac: string;
    status: string;
  };
}

function pacUpdateWithProponentesFinalEventData(
  rendered = pacUpdateWithProponentesFixture(),
) {
  return rendered.steps[1]!.envelope[0]!.data as {
    id: string;
    idjornadapac: string;
    status: string;
    dataalteracao: string;
    proponentes: Array<{
      id: string;
      idPac: string;
      idCliente: string;
      cpf: string;
      tipoClassificacao: string;
      dataAlteracao: string;
      nomeCompleto?: string;
      email?: string;
      telefoneCelular?: string;
    }>;
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

describe('Salesforce PAC test data adapter', () => {
  it('creates the synthetic Opportunity scaffolding after creating the primary Account', async () => {
    const rendered = pacFixture();
    const accountSetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_ACCOUNT',
    );
    const opportunitySetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    if (
      accountSetup?.operation !== 'CREATE_SYNTHETIC_ACCOUNT' ||
      opportunitySetup?.operation !== 'CREATE_SYNTHETIC_OPPORTUNITY'
    ) {
      throw new Error('Expected PAC fixture scaffolding');
    }

    const client = restClient();
    client.query
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000001AAA' }],
      })
      .mockResolvedValueOnce({ totalSize: 0, done: true, records: [] });
    client.composite
      .mockResolvedValueOnce({
        compositeResponse: [
          {
            body: { id: accountId, success: true, errors: [] },
            httpStatusCode: 201,
            referenceId: 'createAccount',
          },
        ],
      })
      .mockResolvedValueOnce({
        compositeResponse: [
          {
            body: { id: opportunityId, success: true, errors: [] },
            httpStatusCode: 201,
            referenceId: 'createOpportunity',
          },
        ],
      });

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).setup(
        pacInput(rendered),
      ),
    ).resolves.toStrictEqual({
      status: 'CREATED',
      createdCount: 2,
      replayedCount: 0,
      recordIds: [accountId, opportunityId],
    });

    expect(client.composite.mock.calls[0]?.[0][0]).toMatchObject({
      referenceId: 'createAccount',
      body: {
        Id__c: accountSetup.account.idCliente,
      },
    });
    expect(client.composite.mock.calls[1]?.[0][0]).toMatchObject({
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Opportunity',
      referenceId: 'createOpportunity',
      body: {
        Name: opportunitySetup.opportunity.name,
        StageName: opportunitySetup.opportunity.stageName,
        CloseDate: opportunitySetup.opportunity.closeDate,
        Id__c: opportunitySetup.opportunity.idExterno,
        AccountId: accountId,
      },
    });
  });

  it('verifies that the PAC record was created and linked to the synthetic Opportunity', async () => {
    const rendered = pacFixture();
    const event = pacEventData(rendered);
    const opportunitySetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    if (opportunitySetup?.operation !== 'CREATE_SYNTHETIC_OPPORTUNITY') {
      throw new Error('Expected PAC fixture opportunity scaffolding');
    }
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: opportunitySetup.opportunity.idExterno,
            AccountId: accountId,
            Name: opportunitySetup.opportunity.name,
            StageName: opportunitySetup.opportunity.stageName,
            CloseDate: opportunitySetup.opportunity.closeDate,
            PACAtual__c: propostaId,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(pacInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.recordIds).toStrictEqual([opportunityId, propostaId]);
    expect(result.checks).toContainEqual({
      check: 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      passed: true,
    });
  });

  it('verifies PAC approval by asserting Account contact sync and principal Proponente linkage', async () => {
    const rendered = pacApprovedFixture();
    const event = pacApprovedEventData(rendered);
    const proponente = event.proponentes[0]!;
    const opportunitySetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    if (opportunitySetup?.operation !== 'CREATE_SYNTHETIC_OPPORTUNITY') {
      throw new Error('Expected PAC fixture opportunity scaffolding');
    }
    const client = restClient();
    const queryResponses = [
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: accountId,
            Id__c: proponente.idCliente,
            IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
            CPF__pc: proponente.cpf,
            LastName: 'Cliente Simulado',
            IsPersonAccount: true,
            PersonEmail: proponente.email ?? null,
            PersonMobilePhone: `55${proponente.telefoneCelular}`,
            Celular__c: proponente.telefoneCelular ?? null,
            BillingStreet: null,
            DataAlteracaoEvento__c: event.dataalteracao,
          },
        ],
      },
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: opportunitySetup.opportunity.idExterno,
            AccountId: accountId,
            Name: opportunitySetup.opportunity.name,
            StageName: opportunitySetup.opportunity.stageName,
            CloseDate: opportunitySetup.opportunity.closeDate,
            PACAtual__c: propostaId,
          },
        ],
      },
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      },
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: proponenteId,
            Id__c: proponente.id,
            Proponente__c: accountId,
            PropostaAnaliseCredito__c: propostaId,
            IdCliente__c: proponente.idCliente,
            CpfProponente__c: proponente.cpf,
            TipoClassificacao__c: proponente.tipoClassificacao,
            EmailAtualizado__c: proponente.email ?? null,
            Celular__c: proponente.telefoneCelular ?? null,
            DataAlteracaoEvento__c: proponente.dataAlteracao,
            NomeCompleto__c: proponente.nomeCompleto ?? null,
          },
        ],
      },
    ];
    let queryIndex = 0;
    client.query.mockImplementation(async () => queryResponses[queryIndex++]!);

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(pacApprovedInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.recordIds).toStrictEqual([
      accountId,
      opportunityId,
      propostaId,
      proponenteId,
    ]);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED', passed: true },
        { check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED', passed: true },
        {
          check: 'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
          passed: true,
        },
        {
          check: 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          passed: true,
        },
      ]),
    );
    expect(client.query.mock.calls[3]?.[0]).toContain(
      'SELECT Id,Id__c,Proponente__c,PropostaAnaliseCredito__c,IdCliente__c,CpfProponente__c,TipoClassificacao__c,EmailAtualizado__c,Celular__c,DataAlteracaoEvento__c,NomeCompleto__c FROM Proponente__c',
    );
  });

  it('fails verification when persisted principal Proponente fields diverge from the PAC payload', async () => {
    const rendered = pacApprovedFixture();
    const event = pacApprovedEventData(rendered);
    const proponente = event.proponentes[0]!;
    const opportunitySetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    if (opportunitySetup?.operation !== 'CREATE_SYNTHETIC_OPPORTUNITY') {
      throw new Error('Expected PAC fixture opportunity scaffolding');
    }

    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: accountId,
            Id__c: proponente.idCliente,
            IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
            CPF__pc: proponente.cpf,
            LastName: 'Cliente Simulado',
            IsPersonAccount: true,
            PersonEmail: proponente.email ?? null,
            PersonMobilePhone: `55${proponente.telefoneCelular}`,
            Celular__c: proponente.telefoneCelular ?? null,
            BillingStreet: null,
            DataAlteracaoEvento__c: event.dataalteracao,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: opportunitySetup.opportunity.idExterno,
            AccountId: accountId,
            Name: opportunitySetup.opportunity.name,
            StageName: opportunitySetup.opportunity.stageName,
            CloseDate: opportunitySetup.opportunity.closeDate,
            PACAtual__c: propostaId,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: proponenteId,
            Id__c: proponente.id,
            Proponente__c: accountId,
            PropostaAnaliseCredito__c: propostaId,
            IdCliente__c: 'CLI-FOREIGN',
            CpfProponente__c: proponente.cpf,
            TipoClassificacao__c: proponente.tipoClassificacao,
            EmailAtualizado__c: proponente.email ?? null,
            Celular__c: proponente.telefoneCelular ?? null,
            DataAlteracaoEvento__c: proponente.dataAlteracao,
            NomeCompleto__c: 'Nome divergente tolerado pelo Apex',
          },
        ],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(pacApprovedInput(rendered));

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual({
      check: 'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
      passed: false,
    });
  });

  it('verifies the PAC update without proponentes by keeping the PAC linked, updating the status and confirming the principal Proponente is absent', async () => {
    const rendered = pacUpdateWithoutProponentesFixture();
    const event = pacUpdateWithoutProponentesFinalEventData(rendered);
    const opportunitySetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    if (opportunitySetup?.operation !== 'CREATE_SYNTHETIC_OPPORTUNITY') {
      throw new Error('Expected PAC fixture opportunity scaffolding');
    }

    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: opportunitySetup.opportunity.idExterno,
            AccountId: accountId,
            Name: opportunitySetup.opportunity.name,
            StageName: opportunitySetup.opportunity.stageName,
            CloseDate: opportunitySetup.opportunity.closeDate,
            PACAtual__c: propostaId,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 0,
        done: true,
        records: [],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(pacUpdateWithoutProponentesInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'PROPONENTE_NOT_PRESENT', passed: true, actualCount: 0 },
        {
          check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
          passed: true,
        },
        {
          check: 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          passed: true,
        },
      ]),
    );
  });

  it('queries PropostaAnaliseCredito__c even when only PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED is expected, without PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY', async () => {
    const rendered = pacUpdateWithoutProponentesFixture();
    const event = pacUpdateWithoutProponentesFinalEventData(rendered);

    const isolatedFixture = {
      ...rendered,
      expectedOutcomes: rendered.expectedOutcomes.map((outcome) => ({
        ...outcome,
        checks: outcome.checks.filter(
          (check) =>
            (typeof check === 'string' ? check : check.check) ===
            'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
        ),
      })),
    };

    const client = restClient();
    client.query.mockResolvedValueOnce({
      totalSize: 1,
      done: true,
      records: [
        {
          Id: propostaId,
          Id__c: event.id,
          Oportunidade__c: opportunityId,
          Status__c: event.status,
        },
      ],
    });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify({
      runId: rendered.runId,
      scenarioKey: rendered.scenarioKey,
      fixture: isolatedFixture,
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(result.checks).toEqual([
      {
        check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
        passed: true,
      },
    ]);
  });

  it('verifies the PAC update with replayed proponentes by keeping one record, updating the PAC status and synchronizing the new contacts', async () => {
    const rendered = pacUpdateWithProponentesFixture();
    const event = pacUpdateWithProponentesFinalEventData(rendered);
    const proponente = event.proponentes[0]!;
    const opportunitySetup = rendered.setup.find(
      (instruction) => instruction.operation === 'CREATE_SYNTHETIC_OPPORTUNITY',
    );
    if (opportunitySetup?.operation !== 'CREATE_SYNTHETIC_OPPORTUNITY') {
      throw new Error('Expected PAC fixture opportunity scaffolding');
    }

    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: accountId,
            Id__c: proponente.idCliente,
            IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
            CPF__pc: proponente.cpf,
            LastName: 'Cliente Simulado',
            IsPersonAccount: true,
            PersonEmail: proponente.email ?? null,
            PersonMobilePhone: `55${proponente.telefoneCelular}`,
            Celular__c: proponente.telefoneCelular ?? null,
            BillingStreet: null,
            DataAlteracaoEvento__c: event.dataalteracao,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: opportunitySetup.opportunity.idExterno,
            AccountId: accountId,
            Name: opportunitySetup.opportunity.name,
            StageName: opportunitySetup.opportunity.stageName,
            CloseDate: opportunitySetup.opportunity.closeDate,
            PACAtual__c: propostaId,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: proponenteId,
            Id__c: proponente.id,
            Proponente__c: accountId,
            PropostaAnaliseCredito__c: propostaId,
            IdCliente__c: proponente.idCliente,
            CpfProponente__c: proponente.cpf,
            TipoClassificacao__c: proponente.tipoClassificacao,
            EmailAtualizado__c: proponente.email ?? null,
            Celular__c: proponente.telefoneCelular ?? null,
            DataAlteracaoEvento__c: proponente.dataAlteracao,
            NomeCompleto__c: proponente.nomeCompleto ?? null,
          },
        ],
      });

    const result = await createSalesforceTestDataAdapter({
      restClient: client,
    }).verify(pacUpdateWithProponentesInput(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        {
          check: 'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE',
          passed: true,
          actualCount: 1,
        },
        {
          check: 'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
          passed: true,
        },
        {
          check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
          passed: true,
        },
        { check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED', passed: true },
        { check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED', passed: true },
      ]),
    );
  });

  it('deletes the PAC record before deleting its synthetic Opportunity', async () => {
    const rendered = pacFixture();
    const event = pacEventData(rendered);
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status ?? null,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: event.idjornadapac,
            AccountId: accountId,
            Name: 'Opportunity Sintética',
            StageName: 'Simulação',
            CloseDate: '2026-09-30',
            PACAtual__c: propostaId,
          },
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
        pacInput(rendered),
        [propostaId, opportunityId],
      ),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 2 });
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      1,
      'PropostaAnaliseCredito__c',
      propostaId,
    );
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      2,
      'Opportunity',
      opportunityId,
    );
  });

  it('deletes the synthetic Proponente before deleting its PAC and Opportunity scaffolding', async () => {
    const rendered = pacApprovedFixture();
    const event = pacApprovedEventData(rendered);
    const proponente = event.proponentes[0]!;
    const client = restClient();
    const queryResponses = [
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: proponenteId,
            Id__c: proponente.id,
            Proponente__c: accountId,
            PropostaAnaliseCredito__c: propostaId,
            IdCliente__c: proponente.idCliente,
            CpfProponente__c: proponente.cpf,
            TipoClassificacao__c: proponente.tipoClassificacao,
            EmailAtualizado__c: proponente.email ?? null,
            Celular__c: proponente.telefoneCelular ?? null,
            DataAlteracaoEvento__c: proponente.dataAlteracao,
            NomeCompleto__c: proponente.nomeCompleto ?? null,
          },
        ],
      },
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      },
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      },
      {
        totalSize: 1,
        done: true,
        records: [
          {
            Id: opportunityId,
            Id__c: event.idjornadapac,
            AccountId: accountId,
            Name: 'Opportunity Sintética PAC',
            StageName: 'Simulação',
            CloseDate: '2027-12-31',
            PACAtual__c: propostaId,
          },
        ],
      },
      {
        totalSize: 0,
        done: true,
        records: [],
      },
    ];
    let queryIndex = 0;
    client.query.mockImplementation(async () => queryResponses[queryIndex++]!);
    client.deleteRecord.mockResolvedValue(undefined);

    await expect(
      createSalesforceTestDataAdapter({ restClient: client }).cleanup(
        pacApprovedInput(rendered),
        [proponenteId, propostaId, opportunityId],
      ),
    ).resolves.toStrictEqual({ status: 'DELETED', deletedCount: 3 });
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      1,
      'Proponente__c',
      proponenteId,
    );
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      2,
      'PropostaAnaliseCredito__c',
      propostaId,
    );
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      3,
      'Opportunity',
      opportunityId,
    );
  });

  it('fails closed when a Proponente cleanup target has a mismatched synthetic client id', async () => {
    const rendered = pacApprovedFixture();
    const event = pacApprovedEventData(rendered);
    const proponente = event.proponentes[0]!;
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: proponenteId,
            Id__c: proponente.id,
            Proponente__c: accountId,
            PropostaAnaliseCredito__c: propostaId,
            IdCliente__c: 'CLI-FOREIGN',
            CpfProponente__c: proponente.cpf,
            TipoClassificacao__c: proponente.tipoClassificacao,
            EmailAtualizado__c: proponente.email ?? null,
            Celular__c: proponente.telefoneCelular ?? null,
            DataAlteracaoEvento__c: proponente.dataAlteracao,
            NomeCompleto__c: proponente.nomeCompleto ?? null,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: event.id,
            Oportunidade__c: opportunityId,
            Status__c: event.status,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 0,
        done: true,
        records: [],
      })
      .mockResolvedValueOnce({
        totalSize: 0,
        done: true,
        records: [],
      });
    client.deleteRecord.mockResolvedValue(undefined);

    const cleanupOperation = createSalesforceTestDataAdapter({
      restClient: client,
    }).cleanup(pacApprovedInput(rendered), [proponenteId, propostaId]);

    await expect(cleanupOperation).rejects.toBeInstanceOf(
      SalesforceTestDataAdapterError,
    );
    await expect(cleanupOperation).rejects.toMatchObject({
      code: 'OWNERSHIP_MISMATCH',
    });
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });

  it('fails closed when a PAC record is not owned by the rendered synthetic identifiers', async () => {
    const rendered = pacFixture();
    const event = pacEventData(rendered);
    const client = restClient();
    client.query
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [
          {
            Id: propostaId,
            Id__c: 'PAC-FOREIGN',
            Oportunidade__c: opportunityId,
            Status__c: event.status ?? null,
          },
        ],
      })
      .mockResolvedValueOnce({
        totalSize: 0,
        done: true,
        records: [],
      });

    const cleanupOperation = createSalesforceTestDataAdapter({
      restClient: client,
    }).cleanup(pacInput(rendered), [propostaId]);

    await expect(cleanupOperation).rejects.toBeInstanceOf(
      SalesforceTestDataAdapterError,
    );
    await expect(cleanupOperation).rejects.toMatchObject({
      code: 'OWNERSHIP_MISMATCH',
    });
    expect(client.deleteRecord).not.toHaveBeenCalled();
  });
});
