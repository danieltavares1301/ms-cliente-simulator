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
  scenarioDetailSchema,
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

  it('defines pagination and scenario metadata for the catalog', () => {
    expect(
      paginationQuerySchema.parse({ page: '2', pageSize: '25', tag: 'core' }),
    ).toStrictEqual({ page: 2, pageSize: 25, tag: 'core' });

    expect(
      scenarioMetadataSchema.parse({
        key: 'match-id-cliente',
        version: 1,
        name: 'Match por Id Cliente',
        description: 'Atualiza somente a Account correta.',
        scope: 'CORE',
        tags: ['core'],
        availability: 'CONTRACT_ONLY',
      }),
    ).toMatchObject({ key: 'match-id-cliente', scope: 'CORE' });
  });

  it('keeps the public scenario detail declarative and sanitized', () => {
    expect(
      scenarioDetailSchema.parse({
        key: 'match-id-cliente',
        version: 1,
        name: 'Match por Id Cliente',
        description: 'Atualiza somente a Account correta.',
        scope: 'CORE',
        tags: ['core'],
        availability: 'CONTRACT_ONLY',
        variablesSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        steps: [
          {
            key: 'cliente-update',
            target: 'CLIENTE',
            eventType: 'cliente-update',
            delayMs: 0,
            deliveryPolicy: {
              duplicateCount: 0,
              retryOn: [],
              maxAttempts: 1,
            },
          },
        ],
      }),
    ).toMatchObject({ key: 'match-id-cliente', version: 1 });
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
    {
      eventType: 'pac-insert',
      data: {
        id: 'PAC-SIM-001',
        idjornadapac: 'OPP-SIM-001',
        status: 'EM_ANALISE_CREDITO',
        datavalidade: '2026-09-30',
        dataaprovacao: '2026-08-21T10:00:00.000Z',
        dataalteracao: '2026-08-21T10:00:00.000Z',
      },
    },
    {
      eventType: 'pac-update',
      data: {
        id: 'PAC-SIM-002',
        idjornadapac: 'OPP-SIM-002',
        dataalteracao: '2026-08-21T10:00:00.000Z',
      },
    },
    {
      eventType: 'jornadausuario-insert',
      data: {
        cliente: {
          idCliente: 'CLI-SIM-001',
          idProspectSalesforce: 'PRO-SIM-001',
        },
        id: 'OPP-SIM-001',
        dataalteracao: '2026-08-21T10:00:00.000Z',
        estado: 'SIMULACAO',
        idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
      },
    },
    {
      eventType: 'jornadausuario-update',
      data: {
        cliente: {
          idCliente: 'CLI-SIM-001',
          idProspectSalesforce: 'PRO-SIM-001',
        },
        id: 'OPP-SIM-002',
        dataalteracao: '2026-08-21T10:00:00.000Z',
        estado: 'SIMULACAO',
        idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
      },
    },
  ] as const;

  it.each(variants)('accepts $eventType', (variant) => {
    expect(
      eventGridEnvelopeSchema.parse([{ ...commonEvent, ...variant }]),
    ).toHaveLength(1);
  });

  it('keeps contato-insert strict about tipocontato and descricao', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'contato-insert',
          data: { ...commonData, descricao: 'sim@example.invalid' },
        },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'contato-insert',
          data: { ...commonData, tipocontato: 'Email' },
        },
      ]),
    ).toThrow();
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

  it('requires pac events to declare both id and idjornadapac', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'pac-insert',
          data: {
            idjornadapac: 'OPP-SIM-001',
            dataalteracao: commonData.dataalteracao,
          },
        },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'pac-update',
          data: {
            id: 'PAC-SIM-001',
            dataalteracao: commonData.dataalteracao,
          },
        },
      ]),
    ).toThrow();
  });

  it('requires jornadausuario events to declare cliente, estado and idunidade', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'jornadausuario-insert',
          data: {
            id: 'OPP-SIM-001',
            dataalteracao: commonData.dataalteracao,
            estado: 'SIMULACAO',
          },
        },
      ]),
    ).toThrow();
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'jornadausuario-update',
          data: {
            cliente: {
              idCliente: commonData.idcliente,
              idProspectSalesforce: commonData.idprospectsalesforce,
            },
            id: 'OPP-SIM-001',
            dataalteracao: commonData.dataalteracao,
            estado: 'SIMULACAO',
          },
        },
      ]),
    ).toThrow();
  });

  it('accepts PAC payloads with proponentes and enforces their required fields', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'pac-insert',
          data: {
            id: 'PAC-SIM-010',
            idjornadapac: 'OPP-SIM-010',
            status: 'CREDITO_APROVADO_CONDICIONADO',
            dataalteracao: '2026-08-21T10:00:00.000Z',
            proponentes: [
              {
                id: 'PROP-SIM-010',
                idPac: 'PAC-SIM-010',
                idCliente: 'CLI-SIM-001',
                cpf: '00000000000',
                tipoClassificacao: 'Principal',
                dataAlteracao: '2026-08-21T10:00:00.000Z',
                nomeCompleto: 'Cliente Sintético',
                email: 'pac.aprovada@example.invalid',
                telefoneCelular: '31999990000',
              },
            ],
          },
        },
      ]),
    ).not.toThrow();

    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          eventType: 'pac-update',
          data: {
            id: 'PAC-SIM-011',
            idjornadapac: 'OPP-SIM-011',
            proponentes: [
              {
                id: 'PROP-SIM-011',
                idPac: 'PAC-SIM-011',
                idCliente: 'CLI-SIM-001',
                cpf: '00000000000',
                tipoClassificacao: 'Principal',
              },
            ],
          },
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

  it('accepts the two UTC timestamp variants verified in Apex', () => {
    for (const timestamp of [
      '2026-08-21T10:00:00Z',
      '2026-08-21T10:00:00.000Z',
    ]) {
      expect(() =>
        eventGridEnvelopeSchema.parse([
          {
            ...commonEvent,
            eventTime: timestamp,
            ...variants[0],
            data: { ...variants[0].data, dataalteracao: timestamp },
          },
        ]),
      ).not.toThrow();
    }
  });

  it('accepts only Apex parseDate-compatible client birth dates', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([
        {
          ...commonEvent,
          ...variants[0],
          data: { ...variants[0].data, datanascimento: '1990-02-28' },
        },
      ]),
    ).not.toThrow();

    for (const datanascimento of [
      'texto-arbitrario',
      '1990-02-28T00:00:00Z',
      '1990-02-31',
      '28/02/1990',
    ]) {
      expect(() =>
        eventGridEnvelopeSchema.parse([
          {
            ...commonEvent,
            ...variants[0],
            data: { ...variants[0].data, datanascimento },
          },
        ]),
      ).toThrow();
    }
  });

  it('accepts payloads sem data.id e usa apenas idcliente como identificador de negócio', () => {
    expect(() =>
      eventGridEnvelopeSchema.parse([{ ...commonEvent, ...variants[0] }]),
    ).not.toThrow();
  });

  it.each(
    variants.filter(
      (variant) =>
        variant.eventType !== 'pac-insert' &&
        variant.eventType !== 'pac-update' &&
        variant.eventType !== 'jornadausuario-insert' &&
        variant.eventType !== 'jornadausuario-update',
    ),
  )(
    'rejects populated data.id for $eventType because Apex requires fallback to data.idcliente',
    (variant) => {
      for (const id of [commonData.idcliente, 'DIFFERENT-ID']) {
        expect(() =>
          eventGridEnvelopeSchema.parse([
            {
              ...commonEvent,
              ...variant,
              data: { ...variant.data, id },
            },
          ]),
        ).toThrow();
      }
    },
  );
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
