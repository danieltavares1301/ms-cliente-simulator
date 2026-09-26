import { describe, expect, it } from 'vitest';

import { eventGridEnvelopeSchema } from '../src/contracts/event-grid.ts';
import {
  buildConcurrentDispatchPlan,
  countLeadsById,
  findRunCreatedLeadIds,
  parseCliArguments,
  resolveFieldWinners,
} from './stress-o10-concurrent-events-lib.ts';

const baseEnvelope = eventGridEnvelopeSchema.parse([
  {
    id: 'sim-run_o10-step_001',
    subject: 'MS_Clientes',
    eventType: 'cliente-update',
    eventTime: '2026-09-21T18:00:00.000Z',
    dataVersion: '1.0',
    metadataVersion: '1',
    topic: '/simulator/ms-clientes',
    data: {
      idcliente: 'CLI-SIM-O10',
      idprospectsalesforce: 'PRO-SIM-O10',
      numerocpf: '95125961485',
      dataalteracao: '2026-09-21T18:00:00.000Z',
      nomecompleto: 'Cliente Base O10',
    },
  },
]);

describe('parseCliArguments', () => {
  it('defaults event mix to mixed', () => {
    const options = parseCliArguments([]);

    expect(options.eventMix).toBe('mixed');
  });

  it('accepts explicit uniform mode', () => {
    const options = parseCliArguments(['--event-mix=uniform']);

    expect(options.eventMix).toBe('uniform');
  });

  it('rejects unknown event mix values', () => {
    expect(() => parseCliArguments(['--event-mix=desconhecido'])).toThrow(
      'Modo inválido para event-mix: desconhecido',
    );
  });
});

describe('buildConcurrentDispatchPlan', () => {
  it('builds a mixed round-robin plan with all supported event variants', () => {
    const plan = buildConcurrentDispatchPlan(baseEnvelope, {
      concurrency: 8,
      eventMix: 'mixed',
      eventTimeStepMs: 0,
    });

    expect(plan.map((entry) => entry.variantKey)).toEqual([
      'cliente-update',
      'contato-insert-email',
      'contato-insert-celular',
      'endereco-insert',
      'cliente-update',
      'contato-insert-email',
      'contato-insert-celular',
      'endereco-insert',
    ]);
    expect(plan[0]?.envelope[0].data).toMatchObject({
      nomecompleto: 'Cliente Concorrente 01',
    });
    expect(plan[1]?.envelope[0].data).toMatchObject({
      tipocontato: 'Email',
      descricao: 'concorrente-02@simulador.mrv.invalid',
    });
    expect(plan[2]?.envelope[0].data).toMatchObject({
      tipocontato: 'Celular',
      descricao: '11990000003',
    });
    expect(plan[3]?.envelope[0].data).toMatchObject({
      tipoendereco: 'COBRANCA',
      logradouro: 'Rua Concorrente 04',
    });
    expect(
      plan.every(
        (entry) =>
          entry.envelope[0].eventTime === '2026-09-21T18:00:00.000Z' &&
          entry.payloadSummary.dataalteracao === '2026-09-21T18:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('preserves the legacy uniform mode for cliente-update only', () => {
    const plan = buildConcurrentDispatchPlan(baseEnvelope, {
      concurrency: 3,
      eventMix: 'uniform',
      eventTimeStepMs: 0,
    });

    expect(plan.map((entry) => entry.variantKey)).toEqual([
      'cliente-update',
      'cliente-update',
      'cliente-update',
    ]);
    expect(
      plan.every((entry) => entry.envelope[0].eventType === 'cliente-update'),
    ).toBe(true);
  });
});

describe('resolveFieldWinners', () => {
  it('reports one winner per independent account field', () => {
    const plan = buildConcurrentDispatchPlan(baseEnvelope, {
      concurrency: 4,
      eventMix: 'mixed',
      eventTimeStepMs: 0,
    });

    const winners = resolveFieldWinners(
      {
        LastName: 'Cliente Concorrente 01',
        CPF__pc: '95125961485',
        PersonEmail: 'concorrente-02@simulador.mrv.invalid',
        Celular__c: '11990000003',
        PersonMobilePhone: '5511990000003',
        BillingStreet: 'Rua Concorrente 04',
      },
      plan,
    );

    expect(winners.lastName.request?.index).toBe(1);
    expect(winners.lastName.request?.variantKey).toBe('cliente-update');
    expect(winners.personEmail.request?.index).toBe(2);
    expect(winners.personEmail.request?.variantKey).toBe(
      'contato-insert-email',
    );
    expect(winners.mobile.request?.index).toBe(3);
    expect(winners.mobile.request?.variantKey).toBe(
      'contato-insert-celular',
    );
    expect(winners.billingStreet.request?.index).toBe(4);
    expect(winners.billingStreet.request?.variantKey).toBe('endereco-insert');
  });
});

function createFakeQueryClient(respond: (soql: string) => unknown) {
  const queries: string[] = [];
  return {
    queries,
    client: {
      query: async <T>(soql: string): Promise<T> => {
        queries.push(soql);
        return respond(soql) as T;
      },
    },
  };
}

describe('findRunCreatedLeadIds', () => {
  it('returns only Leads linked to run Accounts and created during the run', async () => {
    const fake = createFakeQueryClient((soql) =>
      soql.includes('FROM Account')
        ? {
            records: [
              {
                IdProspectSalesforce__c: 'PRO-SIM-O06-X-abc',
                CreatedDate: '2026-09-23T17:50:00.000+0000',
              },
              {
                IdProspectSalesforce__c: '084b6938-9430-b4d7-a53f-aa37b2e60cee',
                CreatedDate: '2026-09-23T17:51:00.000+0000',
              },
            ],
          }
        : {
            records: [
              { Id: '00QHZ00000bjPq02AE', CreatedDate: '2026-09-23T17:52:31.000+0000' },
              { Id: '00QHZ00000aaaaaAAA', CreatedDate: '2026-09-01T10:00:00.000+0000' },
            ],
          },
    );

    const leadIds = await findRunCreatedLeadIds(fake.client, [
      '001HZ00000accXAAAA',
      '001HZ00000accYAAAA',
    ]);

    expect(leadIds).toEqual(['00QHZ00000bjPq02AE']);
    expect(fake.queries[0]).toContain(
      "WHERE Id IN ('001HZ00000accXAAAA', '001HZ00000accYAAAA')",
    );
    expect(fake.queries[1]).toContain(
      "WHERE Id__c IN ('PRO-SIM-O06-X-abc', '084b6938-9430-b4d7-a53f-aa37b2e60cee')",
    );
  });

  it('skips the Lead query when no run Account has a prospect', async () => {
    const fake = createFakeQueryClient(() => ({
      records: [
        { IdProspectSalesforce__c: null, CreatedDate: '2026-09-23T17:50:00.000+0000' },
      ],
    }));

    await expect(
      findRunCreatedLeadIds(fake.client, ['001HZ00000accYAAAA']),
    ).resolves.toEqual([]);
    expect(fake.queries).toHaveLength(1);
  });

  it('does not query when there are no run Accounts', async () => {
    const fake = createFakeQueryClient(() => {
      throw new Error('não deveria consultar');
    });

    await expect(findRunCreatedLeadIds(fake.client, [])).resolves.toEqual([]);
    await expect(countLeadsById(fake.client, [])).resolves.toBe(0);
  });
});

describe('countLeadsById', () => {
  it('counts the remaining Leads by record id', async () => {
    const fake = createFakeQueryClient(() => ({
      totalSize: 1,
      records: [
        { Id: '00QHZ00000bjPq02AE', Id__c: null, CPF__c: null, LastName: 'O06 Y' },
      ],
    }));

    await expect(
      countLeadsById(fake.client, ['00QHZ00000bjPq02AE']),
    ).resolves.toBe(1);
    expect(fake.queries[0]).toContain("WHERE Id IN ('00QHZ00000bjPq02AE')");
  });
});
