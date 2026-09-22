import { describe, expect, it, vi } from 'vitest';

import { renderScenarioFixture } from '../scenarios/renderer';
import type { SalesforceRestClient } from './rest-client';
import { createSalesforceTestDataAdapter } from './test-data-adapter';

const accountId = '001000000000001AAA';
const opportunityId = '006000000000001AAA';
const opportunityLineItemId = '00k000000000001AAA';

function fixture() {
  return renderScenarioFixture({
    scenarioKey: 'maquina-estado-insert-minimo',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_maquina_a',
    eventStartAt: '2026-09-22T00:00:00.000Z',
  });
}

function negativeFixture() {
  return renderScenarioFixture({
    scenarioKey: 'maquina-estado-insert-sem-cliente-falha',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_maquina_b',
    eventStartAt: '2026-09-22T00:05:00.000Z',
  });
}

function updateFixture() {
  return renderScenarioFixture({
    scenarioKey: 'maquina-estado-update-transicao-estado',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_maquina_update_a',
    eventStartAt: '2026-09-22T00:10:00.000Z',
  });
}

function trocaUnidadeUpdateFixture() {
  return renderScenarioFixture({
    scenarioKey: 'maquina-estado-update-troca-unidade',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_maquina_update_troca_unidade',
    eventStartAt: '2026-09-22T00:12:00.000Z',
  });
}

function obsoleteUpdateFixture() {
  return renderScenarioFixture({
    scenarioKey: 'maquina-estado-update-evento-obsoleto',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_maquina_update_c',
    eventStartAt: '2026-09-22T00:20:00.000Z',
  });
}

function approvedAccountFixture() {
  return renderScenarioFixture({
    scenarioKey: 'e2e-opportunity-permanece-conta-aprovada',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_cross_keep_account',
    eventStartAt: '2026-09-22T22:00:00.000Z',
  });
}

function obsoleteWithoutClientFixture() {
  return renderScenarioFixture({
    scenarioKey: 'e2e-evento-obsoleto-sem-cliente-ignorado',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_cross_obsolete',
    eventStartAt: '2026-09-22T22:10:00.000Z',
  });
}

function unrecognizedEstadoUpdateFixture() {
  return renderScenarioFixture({
    scenarioKey: 'maquina-estado-update-estado-nao-reconhecido',
    version: 1,
    seed: 'phase-seven-seed',
    runId: 'run_phase_seven_maquina_update_d',
    eventStartAt: '2026-09-22T00:25:00.000Z',
  });
}

function input(rendered = fixture()) {
  return {
    runId: rendered.runId,
    scenarioKey: rendered.scenarioKey,
    fixture: rendered,
  };
}

function eventData(rendered = fixture()) {
  return rendered.steps[0]!.envelope[0]!.data as {
    id: string;
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

describe('Salesforce test data adapter for MaquinaEstado smoke scenario', () => {
  it('verifies the created Opportunity, its Account link and the synthetic OpportunityLineItem', async () => {
    const rendered = fixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: eventData(rendered).id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Simulação',
              CloseDate: '2027-12-31',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE', passed: true, actualCount: 1 },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
    expect(result.recordIds).toEqual(
      expect.arrayContaining([accountId, opportunityId, opportunityLineItemId]),
    );
  });

  it('deletes the synthetic OpportunityLineItem before deleting the owned Opportunity', async () => {
    const rendered = fixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM PropostaAnaliseCredito__c')) {
        return { totalSize: 0, done: true, records: [] };
      }
      if (soql.includes('FROM Contestacao__c')) {
        return { totalSize: 0, done: true, records: [] };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: eventData(rendered).id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Simulação',
              CloseDate: '2027-12-31',
            },
          ],
        };
      }
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.cleanup(input(rendered), [accountId, opportunityId]);

    expect(result).toEqual({ status: 'DELETED', deletedCount: 3 });
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      1,
      'OpportunityLineItem',
      opportunityLineItemId,
    );
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      2,
      'Opportunity',
      opportunityId,
    );
    expect(client.deleteRecord).toHaveBeenNthCalledWith(
      3,
      'Account',
      accountId,
    );
  });

  it('verifies the expected rejection path without Opportunity or OpportunityLineItem creation', async () => {
    const rendered = negativeFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 0,
          done: true,
          records: [],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_NOT_CREATED', passed: true, actualCount: 0 },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 0,
        },
      ]),
    );
    expect(result.recordIds).toEqual([]);
  });

  it('verifies the existing Opportunity was updated in place to Qualificação de Documentos', async () => {
    const rendered = updateFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });
    const updateEventData = rendered.steps[1]!.envelope[0]!.data as { id: string };

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: updateEventData.id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Qualificação de Documentos',
              CloseDate: '2027-12-31',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE', passed: true, actualCount: 1 },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
    expect(result.recordIds).toEqual(
      expect.arrayContaining([accountId, opportunityId, opportunityLineItemId]),
    );
  });

  it('verifies troca_unidade preserves the stage and points both Opportunity and line item to the new Product2 external id', async () => {
    const rendered = trocaUnidadeUpdateFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });
    const finalEventData = rendered.steps[2]!.envelope[0]!.data as { id: string };

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
              Product2Id: '01tV200000AQbuDIAT',
              Product2: {
                Id__c: '6eeda6b4-1ee9-48a2-a5db-123044783c25',
              },
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: finalEventData.id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Qualificação de Documentos',
              CloseDate: '2027-12-31',
              Unidade__c: '01tV200000AQbuDIAT',
              Unidade__r: {
                Id__c: '6eeda6b4-1ee9-48a2-a5db-123044783c25',
              },
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE', passed: true, actualCount: 1 },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
        { check: 'OPPORTUNITY_UNIDADE_EXTERNAL_ID_EQUALS_EXPECTED', passed: true },
        {
          check: 'OPPORTUNITY_LINE_ITEM_PRODUCT_EXTERNAL_ID_EQUALS_EXPECTED',
          passed: true,
        },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
    expect(result.recordIds).toEqual(
      expect.arrayContaining([accountId, opportunityId, opportunityLineItemId]),
    );
  });

  it('verifies an obsolete update keeps the Opportunity in Qualificação de Documentos', async () => {
    const rendered = obsoleteUpdateFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });
    const obsoleteEventData = rendered.steps[2]!.envelope[0]!.data as { id: string };

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: obsoleteEventData.id,
              AccountId: accountId,
              Name: 'Opportunity Sint?tica MaquinaEstado',
              StageName: 'Qualificação de Documentos',
              CloseDate: '2027-12-31',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE', passed: true, actualCount: 1 },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
    expect(result.recordIds).toEqual(
      expect.arrayContaining([accountId, opportunityId, opportunityLineItemId]),
    );
  });

  it('verifies the cross-endpoint PAC scenario keeps the Opportunity linked to the approved PRIMARY Account', async () => {
    const rendered = approvedAccountFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });
    const pacEventData = rendered.steps[2]!.envelope[0]!.data as {
      id: string;
      proponentes: Array<{
        id: string;
        cpf: string;
        email?: string;
        telefoneCelular?: string;
      }>;
    };
    const proponente = pacEventData.proponentes[0]!;

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 2,
          done: true,
          records: [
            {
              Id: '001000000000002AAA',
              Id__c: rendered.identifiers.controlAccountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.controlAccountIdProspect,
              CPF__pc: '26026568043',
              LastName: 'Cliente Controle',
              IsPersonAccount: true,
            },
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Aprovado',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM Lead')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: '00Q000000000001AAA',
              Id__c: 'legacy-routed-lead',
              FirstName: null,
              CPF__c: proponente.cpf,
              LastName: 'Lead Aprovado',
              Email: proponente.email,
              MobilePhone: proponente.telefoneCelular,
              CelularSemFormatacao__c: proponente.telefoneCelular,
              CidadeInteresse__c: null,
              Marca__c: '1',
              RecordTypeId: '012000000000001AAA',
              ManipularFase__c: true,
              Status: 'Pendente de Distribuição',
              PermitirCriarLead__c: true,
              DescricaoOrigem__c: null,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: rendered.steps[0]!.envelope[0]!.data.id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Qualificação de Documentos',
              CloseDate: '2027-12-31',
              PACAtual__c: 'a0k000000000001AAA',
            },
          ],
        };
      }
      if (soql.includes('FROM PropostaAnaliseCredito__c')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: 'a0k000000000001AAA',
              Id__c: pacEventData.id,
              Oportunidade__c: opportunityId,
              Status__c: 'CREDITO_APROVADO_CONDICIONADO',
            },
          ],
        };
      }
      if (soql.includes('FROM Proponente__c')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: 'a0j000000000001AAA',
              Id__c: proponente.id,
              Proponente__c: accountId,
              PropostaAnaliseCredito__c: 'a0k000000000001AAA',
              IdCliente__c: rendered.identifiers.accountIdCliente,
              CpfProponente__c: proponente.cpf,
              TipoClassificacao__c: 'Principal',
              EmailAtualizado__c: proponente.email,
              Celular__c: proponente.telefoneCelular,
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY', passed: true },
        {
          check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
          passed: true,
        },
        {
          check: 'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
          passed: true,
        },
        { check: 'LEAD_COUNT_BY_CPF_IS_ONE', passed: true, actualCount: 1 },
        { check: 'LEAD_EMAIL_EQUALS_EXPECTED', passed: true },
        { check: 'LEAD_MOBILE_EQUALS_EXPECTED', passed: true },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
      ]),
    );
    expect(result.recordIds).toEqual(
      expect.arrayContaining([
        accountId,
        opportunityId,
        opportunityLineItemId,
        '00Q000000000001AAA',
        'a0k000000000001AAA',
        'a0j000000000001AAA',
      ]),
    );
  });

  it('verifies the cross-endpoint obsolete event fixture even when the final update uses synthetic no-match identifiers', async () => {
    const rendered = obsoleteWithoutClientFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: rendered.steps[0]!.envelope[0]!.data.id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Qualificação de Documentos',
              CloseDate: '2027-12-31',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE', passed: true, actualCount: 1 },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
  });

  it('verifies an unrecognized estado update preserves the existing Opportunity stage', async () => {
    const rendered = unrecognizedEstadoUpdateFixture();
    const client = restClient();
    const adapter = createSalesforceTestDataAdapter({ restClient: client });
    const finalEventData = rendered.steps[2]!.envelope[0]!.data as { id: string };

    client.query.mockImplementation(async (query: unknown) => {
      const soql = String(query);
      if (soql.includes('FROM Account')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: accountId,
              Id__c: rendered.identifiers.accountIdCliente,
              IdProspectSalesforce__c: rendered.identifiers.accountIdProspect,
              CPF__pc: '39095812030',
              LastName: 'Cliente Simulado Base',
              IsPersonAccount: true,
            },
          ],
        };
      }
      if (soql.includes('FROM OpportunityLineItem')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityLineItemId,
              OpportunityId: opportunityId,
              Id__c: `${opportunityId}1`,
            },
          ],
        };
      }
      if (soql.includes('FROM Opportunity')) {
        return {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: opportunityId,
              Id__c: finalEventData.id,
              AccountId: accountId,
              Name: 'Opportunity Sintética MaquinaEstado',
              StageName: 'Qualificação de Documentos',
              CloseDate: '2027-12-31',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    const result = await adapter.verify(input(rendered));

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        { check: 'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE', passed: true, actualCount: 1 },
        { check: 'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT', passed: true },
        { check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED', passed: true },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          passed: true,
          actualCount: 1,
        },
      ]),
    );
    expect(result.recordIds).toEqual(
      expect.arrayContaining([accountId, opportunityId, opportunityLineItemId]),
    );
  });

});
