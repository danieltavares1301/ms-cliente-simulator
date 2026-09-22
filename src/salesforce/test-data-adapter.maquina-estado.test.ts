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
});
