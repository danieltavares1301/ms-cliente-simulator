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

function pacEventData(rendered = pacFixture()) {
  return rendered.steps[0]!.envelope[0]!.data as {
    id: string;
    idjornadapac: string;
    status?: string;
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
            Status__c: event.status ?? null,
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
