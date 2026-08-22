import { describe, expect, it } from 'vitest';

import { createHealthResponse } from '../health';
import {
  eventGridEnvelopeSchema,
  graphqlResponsePolicySchema,
  graphqlResponseSchema,
  healthResponseSchema,
  paginationQuerySchema,
  restErrorResponseSchema,
  scenarioMetadataSchema,
} from './index';

const commonEvent = {
  id: 'sim-run-001-step-001',
  subject: 'MS_Clientes',
  eventTime: '2026-08-21T10:00:00.000Z',
  dataVersion: '1.0',
  metadataVersion: '1',
  topic: '/simulator/ms-clientes',
};

const commonData = {
  idcliente: 'CLI-SIM-001',
  idprospectsalesforce: 'PRO-SIM-001',
  numerocpf: '00000000000',
  dataalteracao: '2026-08-21T10:00:00.000Z',
};

function testDatabaseUrl(): string {
  const url = new URL('postgresql://localhost/ms_clientes');
  url.username = 'test';
  url.password = 'test-password';
  return url.toString();
}

describe('public REST contracts', () => {
  it('accepts the current health response without exposing configuration', () => {
    const health = createHealthResponse({
      APP_ENV: 'test',
      TARGET_ENV: 'mrv-devDan',
      TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
      TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
      DATABASE_URL: testDatabaseUrl(),
      QSTASH_URL: 'https://qstash.example.com',
    });

    expect(healthResponseSchema.parse(health)).toStrictEqual(health);
  });

  it('enforces the uniform error envelope and rejects sensitive diagnostics', () => {
    const safeError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        requestId: 'req_01J',
        details: { field: 'eventType' },
      },
    };

    expect(restErrorResponseSchema.parse(safeError)).toStrictEqual(safeError);
    expect(() =>
      restErrorResponseSchema.parse({
        ...safeError,
        stack: 'internal stack',
      }),
    ).toThrow();
    expect(() =>
      restErrorResponseSchema.parse({
        error: {
          ...safeError.error,
          details: { nested: { token: 'must-not-leak' } },
        },
      }),
    ).toThrow();
    expect(() =>
      restErrorResponseSchema.parse({
        error: {
          ...safeError.error,
          details: { payload: { idcliente: 'CLI-SIM-001' } },
        },
      }),
    ).toThrow();
  });

  it('defines pagination and scenario metadata for the next increment', () => {
    expect(
      paginationQuerySchema.parse({ page: '2', pageSize: '25', tag: 'core' }),
    ).toStrictEqual({ page: 2, pageSize: 25, tag: 'core' });

    expect(
      scenarioMetadataSchema.parse({
        key: 'match-id-cliente',
        version: 1,
        name: 'Match por Id Cliente',
        scope: 'CORE',
        tags: ['core'],
      }),
    ).toMatchObject({ key: 'match-id-cliente', scope: 'CORE' });
  });
});

describe('Event Grid contracts', () => {
  const variants = [
    {
      eventType: 'cliente-insert',
      data: { ...commonData, nomecompleto: 'Cliente Sintético' },
    },
    {
      eventType: 'cliente-update',
      data: { ...commonData, categoria: 'SIMULADO' },
    },
    {
      eventType: 'contato-insert',
      data: {
        ...commonData,
        tipocontato: 'Email',
        descricao: 'sim@example.invalid',
      },
    },
    {
      eventType: 'contato-update',
      data: { ...commonData, tipocontato: 'Celular', descricao: '000000000' },
    },
    {
      eventType: 'endereco-insert',
      data: {
        ...commonData,
        tipoendereco: 'COBRANCA',
        idcidade: 'CID-SIM-001',
        logradouro: 'Rua Sintética',
        numerocep: '00000000',
        bairro: 'Bairro Sintético',
        numero: '0',
      },
    },
    {
      eventType: 'endereco-update',
      data: { ...commonData, tipoendereco: 'COBRANCA', numero: '1' },
    },
  ] as const;

  it.each(variants)('accepts $eventType', (variant) => {
    expect(
      eventGridEnvelopeSchema.parse([{ ...commonEvent, ...variant }]),
    ).toHaveLength(1);
  });

  it('requires exactly one event and idcliente', () => {
    expect(() => eventGridEnvelopeSchema.parse([])).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        { ...commonEvent, ...variants[0] },
        { ...commonEvent, ...variants[1] },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'cliente-insert',
          data: { dataalteracao: commonData.dataalteracao },
        },
      ]),
    ).toThrow();
  });

  it('accepts only Apex-compatible UTC timestamps and strict public fields', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventTime: '2026-08-21T10:00:00-03:00',
          ...variants[0],
        },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventTime: '2026-02-31T10:00:00.000Z',
          ...variants[0],
        },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          ...variants[0],
          data: {
            ...variants[0].data,
            dataalteracao: '2026-08-21T10:00:00.123Z',
          },
        },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        { ...commonEvent, ...variants[0], unexpected: true },
      ]),
    ).toThrow();
  });

  it('rejects divergent data.id and data.idcliente values', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          ...variants[0],
          data: { ...variants[0].data, id: 'DIFFERENT-ID' },
        },
      ]),
    ).toThrow();
  });
});

describe('GraphQL atualizarCliente response contracts', () => {
  it('validates simulated success and GraphQL error JSON', () => {
    expect(
      graphqlResponseSchema.parse({
        data: { atualizarCliente: { id: 'CLI-SIM-001' } },
      }),
    ).toStrictEqual({
      data: { atualizarCliente: { id: 'CLI-SIM-001' } },
    });

    expect(
      graphqlResponseSchema.parse({
        errors: [{ message: 'Simulated GraphQL error' }],
      }),
    ).toStrictEqual({
      errors: [{ message: 'Simulated GraphQL error' }],
    });
  });

  it('rejects malformed success responses and knows every planned policy', () => {
    expect(() =>
      graphqlResponseSchema.parse({ data: { atualizarCliente: {} } }),
    ).toThrow();

    for (const policy of [
      'SUCCESS_200',
      'SUCCESS_201',
      'GRAPHQL_ERROR_200',
      'HTTP_400',
      'HTTP_401',
      'HTTP_429',
      'HTTP_500',
      'INVALID_JSON_200',
      'EMPTY_BODY_200',
      'DELAYED_RESPONSE',
    ]) {
      expect(graphqlResponsePolicySchema.parse(policy)).toBe(policy);
    }
  });
});
