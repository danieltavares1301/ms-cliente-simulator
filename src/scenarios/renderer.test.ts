import { describe, expect, it, vi } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
import { scanRenderedFixtureSecrets, scanSecrets } from '../redaction/scanner';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

const scenarioKeys = [
  'contato-antes-cliente-colisao',
  'cpf-divergente-identidade-antiga-pac-aprovada',
  'cpf-divergente-contato-primeiro',
  'cpf-divergente-identidade-antiga',
  'cliente-insert-prospect-divergente',
  'evento-duplicado',
  'evento-obsoleto',
  'graphql-erro-500',
  'graphql-resposta-invalida',
  'graphql-timeout',
  'maquina-estado-insert-apos-cliente-criado',
  'maquina-estado-insert-minimo',
  'maquina-estado-insert-sem-cliente-falha',
  'maquina-estado-update-reentrega-mesmo-evento',
  'id-prospect-igual-id-cliente',
  'match-id-cliente',
  'match-cpf-sem-id-cliente',
  'no-match-cliente-insert',
  'cliente-update-nova-estrutura',
  'ordem-mesmo-eventtime-cliente-primeiro',
  'ordem-mesmo-eventtime-contato-primeiro',
  'ordem-mesmo-eventtime-endereco-primeiro',
  'pac-aprovada-sincroniza-contatos',
  'pac-conflito-proponentes-principais',
  'pac-insert-minimo',
  'pac-insert-opportunity-perdida-forca-cancelado',
  'pac-update-com-contestacao-pendente-sincroniza-contatos',
  'pac-update-altera-status-sem-proponentes',
  'pac-update-reenviando-proponentes',
] as const;

const expectedStepCountByScenario = {
  'contato-antes-cliente-colisao': 3,
  'cpf-divergente-identidade-antiga-pac-aprovada': 4,
  'cpf-divergente-contato-primeiro': 3,
  'cpf-divergente-identidade-antiga': 3,
  'cliente-insert-prospect-divergente': 1,
  'evento-duplicado': 1,
  'evento-obsoleto': 1,
  'graphql-erro-500': 1,
  'graphql-resposta-invalida': 1,
  'graphql-timeout': 1,
  'maquina-estado-insert-apos-cliente-criado': 1,
  'maquina-estado-insert-minimo': 1,
  'maquina-estado-insert-sem-cliente-falha': 1,
  'maquina-estado-update-reentrega-mesmo-evento': 2,
  'id-prospect-igual-id-cliente': 1,
  'match-id-cliente': 1,
  'match-cpf-sem-id-cliente': 1,
  'no-match-cliente-insert': 1,
  'cliente-update-nova-estrutura': 1,
  'ordem-mesmo-eventtime-cliente-primeiro': 4,
  'ordem-mesmo-eventtime-contato-primeiro': 4,
  'ordem-mesmo-eventtime-endereco-primeiro': 4,
  'pac-aprovada-sincroniza-contatos': 1,
  'pac-conflito-proponentes-principais': 1,
  'pac-insert-minimo': 1,
  'pac-insert-opportunity-perdida-forca-cancelado': 1,
  'pac-update-com-contestacao-pendente-sincroniza-contatos': 1,
  'pac-update-altera-status-sem-proponentes': 2,
  'pac-update-reenviando-proponentes': 2,
} as const;

const input = {
  version: 1,
  seed: 'phase-two-seed',
  runId: 'run_phase_two_a',
  eventStartAt: '2026-08-22T15:00:00.000Z',
} as const;

function clientEventData(fixture: ReturnType<typeof renderScenarioFixture>) {
  const step = fixture.steps.find(
    (candidate) =>
      candidate.eventType === 'cliente-insert' ||
      candidate.eventType === 'cliente-update',
  );
  if (!step) {
    throw new Error('Expected fixture with cliente event');
  }
  return step.envelope[0].data as {
    idcliente: string;
    numerocpf?: string;
    nomecompleto?: string;
  };
}

describe('basic scenario fixture definitions', () => {
  it.each(scenarioKeys)(
    'publishes complete READY fixture %s',
    (scenarioKey) => {
      const definition = scenarioCatalog.get(scenarioKey, 1);

      expect(definition).toBeDefined();
      expect(definition?.availability).toBe('READY');
      expect(definition?.setup?.length).toBeGreaterThan(0);
      expect(definition?.steps).toHaveLength(
        expectedStepCountByScenario[scenarioKey],
      );
      expect(['CLIENTE', 'PAC', 'MAQUINA_ESTADO']).toContain(
        definition?.steps[0].target,
      );
      expect(definition?.steps[0].payloadTemplate.kind).toBe('DECLARATIVE');
      expect(definition?.expectedOutcomes.length).toBeGreaterThan(0);
      expect(definition?.expectedOutcomes[0].checks.length).toBeGreaterThan(0);
      expect(definition?.asyncPolicy).toBeDefined();
      expect(definition?.cleanup?.length).toBeGreaterThan(0);
    },
  );

  it('models only Apex behavior actually triggered by each core event', () => {
    expect(
      scenarioCatalog.get('contato-antes-cliente-colisao', 1)
        ?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'CONTROL_ACCOUNT_UNCHANGED',
        'LEAD_COUNT_BY_CPF_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
        'LEAD_EMAIL_EXCLUDED',
        {
          check: 'LEAD_MOBILE_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
        },
      ],
    });
    expect(
      scenarioCatalog.get('contato-antes-cliente-colisao', 1)?.asyncPolicy,
    ).toStrictEqual({
      expectedCallbacks: { min: 1, max: 1 },
      waitTimeoutMs: 30_000,
      missingCallbackResult: 'PARTIAL',
    });
    expect(
      scenarioCatalog.get('cpf-divergente-contato-primeiro', 1)
        ?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'CONTROL_ACCOUNT_UNCHANGED',
        'LEAD_COUNT_BY_CPF_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
        'LEAD_EMAIL_EXCLUDED',
        'LEAD_MOBILE_EXCLUDED',
      ],
    });
    expect(
      scenarioCatalog.get('cpf-divergente-contato-primeiro', 1)?.asyncPolicy,
    ).toStrictEqual({
      expectedCallbacks: { min: 1, max: 1 },
      waitTimeoutMs: 30_000,
      missingCallbackResult: 'PARTIAL',
    });
    expect(
      scenarioCatalog.get('cpf-divergente-identidade-antiga', 1)
        ?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'ACCOUNT_EMAIL_EXCLUDED',
        'ACCOUNT_MOBILE_EXCLUDED',
        {
          check: 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'COLLISION_EMAIL' },
        },
        {
          check: 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
        },
        'LEAD_COUNT_BY_CPF_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
        'LEAD_EMAIL_EXCLUDED',
        'LEAD_MOBILE_EXCLUDED',
      ],
    });
    expect(
      scenarioCatalog.get('cpf-divergente-identidade-antiga', 1)?.asyncPolicy,
    ).toStrictEqual({
      expectedCallbacks: { min: 1, max: 1 },
      waitTimeoutMs: 30_000,
      missingCallbackResult: 'PARTIAL',
    });
    expect(
      scenarioCatalog.get('cliente-insert-prospect-divergente', 1)
        ?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'CONTROL_ACCOUNT_UNCHANGED',
        'LEAD_COUNT_BY_CPF_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
      ],
    });
    expect(
      scenarioCatalog.get('cliente-insert-prospect-divergente', 1)?.asyncPolicy,
    ).toStrictEqual({
      expectedCallbacks: { min: 1, max: 1 },
      waitTimeoutMs: 30_000,
      missingCallbackResult: 'PARTIAL',
    });
    expect(scenarioCatalog.get('evento-duplicado', 1)?.steps[0]).toMatchObject({
      key: 'cliente-update',
      deliveryPolicy: {
        duplicateCount: 1,
        retryOn: [],
        maxAttempts: 1,
      },
    });
    expect(
      scenarioCatalog.get('evento-duplicado', 1)?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'ACCOUNT_UPDATED_ONLY',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'NO_OTHER_ACCOUNT_UPDATED',
      ],
    });
    expect(
      scenarioCatalog.get('evento-obsoleto', 1)?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'ACCOUNT_UPDATED_ONLY',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_SETUP',
        'ACCOUNT_CPF_EQUALS_SETUP',
      ],
    });
    expect(
      scenarioCatalog.get('evento-obsoleto', 1)?.steps[0]?.payloadTemplate,
    ).toMatchObject({
      kind: 'DECLARATIVE',
      value: {
        data: {
          dataalteracao: { source: 'GENERATED', value: 'EARLIER_TIME' },
          numerocpf: { source: 'GENERATED', value: 'CPF_X' },
        },
      },
    });
    expect(
      scenarioCatalog.get('graphql-erro-500', 1)?.graphqlResponse,
    ).toStrictEqual({
      policy: 'HTTP_500',
    });
    expect(
      scenarioCatalog.get('graphql-resposta-invalida', 1)?.graphqlResponse,
    ).toStrictEqual({
      policy: 'INVALID_JSON_200',
    });
    expect(
      scenarioCatalog.get('graphql-timeout', 1)?.graphqlResponse,
    ).toStrictEqual({
      policy: 'DELAYED_RESPONSE',
      delayMs: 8_000,
    });
    expect(
      scenarioCatalog.get('id-prospect-igual-id-cliente', 1)
        ?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'PERSON_ACCOUNT_CREATED',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'ACCOUNT_PROSPECT_ID_NOT_STAMPED',
      ],
    });
    expect(
      scenarioCatalog.get('id-prospect-igual-id-cliente', 1)?.steps[0]
        ?.payloadTemplate,
    ).toMatchObject({
      kind: 'DECLARATIVE',
      value: {
        data: {
          idcliente: { source: 'GENERATED', value: 'CLIENT_ID' },
          idprospectsalesforce: { source: 'GENERATED', value: 'CLIENT_ID' },
        },
      },
    });
    expect(
      scenarioCatalog.get('ordem-mesmo-eventtime-cliente-primeiro', 1)
        ?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'ACCOUNT_UPDATED_ONLY',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        {
          check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'SYNTHETIC_EMAIL' },
        },
        {
          check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
        },
        {
          check: 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'SYNTHETIC_STREET' },
        },
      ],
    });
    expect(
      scenarioCatalog.get('ordem-mesmo-eventtime-cliente-primeiro', 1)?.steps,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'cliente-insert',
          payloadTemplate: expect.objectContaining({
            value: expect.objectContaining({
              eventTime: { source: 'GENERATED', value: 'PINNED_EVENT_TIME' },
              data: expect.objectContaining({
                dataalteracao: {
                  source: 'GENERATED',
                  value: 'PINNED_EVENT_TIME',
                },
              }),
            }),
          }),
        }),
        expect.objectContaining({
          eventType: 'endereco-insert',
          payloadTemplate: expect.objectContaining({
            value: expect.objectContaining({
              eventTime: { source: 'GENERATED', value: 'PINNED_EVENT_TIME' },
              data: expect.objectContaining({
                logradouro: {
                  source: 'GENERATED',
                  value: 'SYNTHETIC_STREET',
                },
                dataalteracao: {
                  source: 'GENERATED',
                  value: 'PINNED_EVENT_TIME',
                },
              }),
            }),
          }),
        }),
      ]),
    );
    expect(
      scenarioCatalog.get('match-id-cliente', 1)?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'ACCOUNT_UPDATED_ONLY',
      checks: expect.arrayContaining([
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_NAME_EQUALS_EVENT',
      ]),
    });
    expect(
      scenarioCatalog.get('match-cpf-sem-id-cliente', 1)?.expectedOutcomes[0],
    ).toMatchObject({
      result: 'CLIENT_ID_STAMPED_WITHOUT_DUPLICATE',
      checks: expect.arrayContaining([
        'ACCOUNT_COUNT_BY_CPF_IS_ONE',
        'ACCOUNT_CLIENT_ID_EQUALS_EVENT',
      ]),
    });
    for (const scenarioKey of [
      'no-match-cliente-insert',
      'cliente-update-nova-estrutura',
    ] as const) {
      expect(
        scenarioCatalog.get(scenarioKey, 1)?.expectedOutcomes[0],
      ).toMatchObject({
        result: 'PERSON_ACCOUNT_CREATED',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'LEAD_NOT_REQUIRED',
          'PROPONENTE_NOT_REQUIRED',
        ],
      });
      expect(
        scenarioCatalog.get(scenarioKey, 1)?.asyncPolicy.expectedCallbacks,
      ).toStrictEqual({ min: 0, max: 0 });
    }
  });
  expect(scenarioCatalog.get('pac-insert-minimo', 1)?.steps[0]).toMatchObject({
    target: 'PAC',
    eventType: 'pac-insert',
  });
  expect(
    scenarioCatalog.get('pac-aprovada-sincroniza-contatos', 1)?.steps[0],
  ).toMatchObject({
    target: 'PAC',
    eventType: 'pac-insert',
  });
  expect(
    scenarioCatalog.get('pac-aprovada-sincroniza-contatos', 1)
      ?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      {
        check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'SYNTHETIC_EMAIL' },
      },
      {
        check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
      },
      'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
    ]),
  });
  expect(
    scenarioCatalog.get('pac-insert-minimo', 1)?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: ['PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY'],
  });
  expect(
    scenarioCatalog.get(
      'pac-insert-opportunity-perdida-forca-cancelado',
      1,
    )?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      {
        check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
        value: 'CREDITO_APROVADO_CONDICIONADO',
      },
    ]),
  });
  expect(
    scenarioCatalog.get('pac-insert-minimo', 1)?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get(
      'pac-insert-opportunity-perdida-forca-cancelado',
      1,
    )?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get('pac-aprovada-sincroniza-contatos', 1)?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get(
      'pac-update-com-contestacao-pendente-sincroniza-contatos',
      1,
    )?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      {
        check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_EMAIL' },
      },
      {
        check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_CELULAR' },
      },
      'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE',
    ]),
  });
  expect(
    scenarioCatalog.get(
      'pac-update-com-contestacao-pendente-sincroniza-contatos',
      1,
    )?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get('pac-conflito-proponentes-principais', 1)
      ?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      'ACCOUNT_EMAIL_EXCLUDED',
      'ACCOUNT_MOBILE_EXCLUDED',
      {
        check: 'PROPONENTE_COUNT_EQUALS_EXPECTED',
        value: 2,
      },
      {
        check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
        value: 'CREDITO_APROVADO_CONDICIONADO',
      },
    ]),
  });
  expect(
    scenarioCatalog.get('pac-conflito-proponentes-principais', 1)?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get('pac-update-obsoleto-nivel-pac', 1)?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      'ACCOUNT_EMAIL_EXCLUDED',
      'ACCOUNT_MOBILE_EXCLUDED',
      {
        check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
        value: 'EM_ANALISE_CREDITO',
      },
    ]),
  });
  expect(
    scenarioCatalog.get('pac-update-obsoleto-nivel-pac', 1)?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get('pac-update-obsoleto-nivel-proponente', 1)
      ?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
      {
        check: 'PRIMARY_PROPONENTE_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'SYNTHETIC_EMAIL' },
      },
      {
        check: 'PRIMARY_PROPONENTE_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
      },
      {
        check: 'CONTROL_PROPONENTE_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_EMAIL' },
      },
      {
        check: 'CONTROL_PROPONENTE_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_CELULAR' },
      },
    ]),
  });
  expect(
    scenarioCatalog.get('pac-update-obsoleto-nivel-proponente', 1)
      ?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
  expect(
    scenarioCatalog.get('cpf-divergente-identidade-antiga-pac-aprovada', 1)
      ?.expectedOutcomes[0],
  ).toMatchObject({
    result: 'PAC_CREATED_AND_LINKED',
    checks: expect.arrayContaining([
      {
        check: 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'COLLISION_EMAIL' },
      },
      {
        check: 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
      },
      {
        check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_EMAIL' },
      },
      {
        check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_CELULAR' },
      },
      {
        check: 'LEAD_EMAIL_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_EMAIL' },
      },
      {
        check: 'LEAD_MOBILE_EQUALS_EXPECTED',
        value: { source: 'GENERATED', value: 'PAC_CELULAR' },
      },
      'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
    ]),
  });
  expect(
    scenarioCatalog.get('cpf-divergente-identidade-antiga-pac-aprovada', 1)
      ?.asyncPolicy,
  ).toStrictEqual({
    expectedCallbacks: { min: 1, max: 1 },
    waitTimeoutMs: 30_000,
    missingCallbackResult: 'PARTIAL',
  });
});

describe('renderScenarioFixture', () => {
  it('accepts rendered contato-insert steps and explicit collision lead identifiers', () => {
    const scheduledAt = '2026-08-22T15:00:00.000Z';

    expect(() =>
      renderedScenarioFixtureSchema.parse({
        scenarioKey: 'contato-antes-cliente-colisao',
        version: 1,
        seed: input.seed,
        runId: input.runId,
        eventStartAt: scheduledAt,
        identifiers: {
          accountIdCliente: 'CLI-SIM-001',
          accountIdProspect: 'PRO-SIM-001',
          leadIdExterno: 'PRO-SIM-001',
          controlAccountIdCliente: 'CLI-SIM-X-001',
          controlAccountIdProspect: 'PRO-SIM-X-001',
          collisionLeadIdExterno: 'LEAD-SIM-COL-001',
        },
        setup: [
          {
            operation: 'CREATE_SYNTHETIC_ACCOUNT',
            role: 'CONTROL',
            matchBy: 'ID_CLIENTE',
            account: {
              idCliente: 'CLI-SIM-X-001',
              idProspect: 'PRO-SIM-X-001',
              cpf: '39095812030',
              name: 'Cliente Controle',
              dataAlteracao: '2026-08-22T14:59:59.000Z',
            },
          },
          {
            operation: 'CREATE_SYNTHETIC_LEAD',
            role: 'COLLISION',
            lead: {
              idExterno: 'LEAD-SIM-COL-001',
              cpf: '39095812030',
              lastName: 'Terceiro Colidente',
              email: 'colisao.simulada@simulador.mrv.invalid',
              status: 'Pendente de Distribuição',
            },
          },
        ],
        steps: [
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
                id: 'EVT-SIM-001',
                subject: 'MS_Clientes',
                eventType: 'contato-insert',
                eventTime: scheduledAt,
                dataVersion: '1.0',
                metadataVersion: '1',
                topic: '/simulator/ms-clientes',
                data: {
                  idcliente: 'CLI-SIM-001',
                  idprospectsalesforce: 'PRO-SIM-X-001',
                  tipocontato: 'Email',
                  descricao: 'colisao.simulada@simulador.mrv.invalid',
                  dataalteracao: scheduledAt,
                },
              },
            ],
          },
        ],
        expectedOutcomes: [
          {
            kind: 'BUSINESS_RESULT',
            result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
            description: 'Conta Y criada com colisão parcial de contatos.',
            checks: [
              { check: 'LEAD_MOBILE_EQUALS_EXPECTED', value: '11999990000' },
            ],
          },
        ],
        asyncPolicy: {
          expectedCallbacks: { min: 1, max: 1 },
          waitTimeoutMs: 30_000,
          missingCallbackResult: 'PARTIAL',
        },
        cleanup: [
          {
            operation: 'DELETE_OWNED_RECORDS',
            target: 'ACCOUNT',
            ownership: {
              idCliente: 'CLI-SIM-001',
              controlAccountIdCliente: 'CLI-SIM-X-001',
            },
          },
          {
            operation: 'DELETE_OWNED_RECORDS',
            target: 'LEAD',
            ownership: { idExternoPrefix: 'LEAD-SIM-' },
          },
        ],
      }),
    ).not.toThrow();
  });

  it('renders O01 with divergent prospect on both contato steps before cliente-insert', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'cpf-divergente-contato-primeiro',
      version: 1,
      seed: input.seed,
      runId: input.runId,
      eventStartAt: input.eventStartAt,
    });

    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'contato-email',
      'contato-celular',
      'cliente-insert-final',
    ]);
    for (const step of fixture.steps.slice(0, 2)) {
      expect(step.envelope[0]?.data).toMatchObject({
        idcliente: fixture.identifiers.accountIdCliente,
        idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
      });
    }
  });

  it('renders O08 with contato steps pinned to the control identity before cliente-insert for Y', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'cpf-divergente-identidade-antiga',
      version: 1,
      seed: input.seed,
      runId: input.runId,
      eventStartAt: input.eventStartAt,
    });

    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'contato-email-x',
      'contato-celular-x',
      'cliente-insert-y',
    ]);
    for (const step of fixture.steps.slice(0, 2)) {
      expect(step.envelope[0]?.data).toMatchObject({
        idcliente: fixture.identifiers.controlAccountIdCliente,
        idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
      });
    }
    expect(fixture.steps[2]?.envelope[0]?.data).toMatchObject({
      idcliente: fixture.identifiers.accountIdCliente,
      idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
    });
  });

  it('renders the O08 PAC retest with the same three O08 steps plus an approved PAC step for Y', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'cpf-divergente-identidade-antiga-pac-aprovada',
      version: 1,
      seed: input.seed,
      runId: input.runId,
      eventStartAt: input.eventStartAt,
    });

    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'contato-email-x',
      'contato-celular-x',
      'cliente-insert-y',
      'pac-insert-aprovada-y',
    ]);
    for (const step of fixture.steps.slice(0, 2)) {
      expect(step.envelope[0]?.data).toMatchObject({
        idcliente: fixture.identifiers.controlAccountIdCliente,
        idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
      });
    }
    expect(fixture.steps[2]?.envelope[0]?.data).toMatchObject({
      idcliente: fixture.identifiers.accountIdCliente,
      idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
    });
    expect(fixture.steps[3]?.envelope[0]?.data).toMatchObject({
      idjornadapac: expect.stringMatching(/^OPP-SIM-/),
      status: 'CREDITO_APROVADO_CONDICIONADO',
      proponentes: [
        expect.objectContaining({
          idCliente: fixture.identifiers.accountIdCliente,
          cpf: expect.stringMatching(/^\d{11}$/),
          email: expect.stringMatching(/^pac\..+@simulador\.mrv\.invalid$/),
        }),
      ],
    });
  });

  it('renders the PAC conflito fixture with two distinct principal proponentes targeting the same Account identity', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-conflito-proponentes-principais',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_h',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(1);
    const pacData = fixture.steps[0]!.envelope[0]!.data as {
      id: string;
      status: string;
      proponentes: Array<{
        id: string;
        idPac: string;
        idCliente: string;
        cpf: string;
        tipoClassificacao: string;
        email?: string;
        telefoneCelular?: string;
      }>;
    };

    expect(pacData.status).toBe('CREDITO_APROVADO_CONDICIONADO');
    expect(pacData.proponentes).toHaveLength(2);
    expect(pacData.proponentes[0]!.id).not.toBe(pacData.proponentes[1]!.id);
    expect(pacData.proponentes[0]!.idPac).toBe(pacData.id);
    expect(pacData.proponentes[1]!.idPac).toBe(pacData.id);
    expect(pacData.proponentes[0]!.idCliente).toBe(
      fixture.identifiers.accountIdCliente,
    );
    expect(pacData.proponentes[1]!.idCliente).toBe(
      fixture.identifiers.accountIdCliente,
    );
    expect(pacData.proponentes[0]!.cpf).toBe(pacData.proponentes[1]!.cpf);
    expect(pacData.proponentes[0]!.tipoClassificacao).toBe('Principal');
    expect(pacData.proponentes[1]!.tipoClassificacao).toBe('Principal');
    expect(pacData.proponentes[0]!.email).not.toBe(
      pacData.proponentes[1]!.email,
    );
    expect(pacData.proponentes[0]!.telefoneCelular).not.toBe(
      pacData.proponentes[1]!.telefoneCelular,
    );
  });

  it('renders O03 with the same logical eventTime across different physical dispatch times', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'ordem-mesmo-eventtime-endereco-primeiro',
      version: 1,
      seed: input.seed,
      runId: input.runId,
      eventStartAt: input.eventStartAt,
    });

    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'endereco-insert',
      'contato-celular',
      'cliente-insert',
      'contato-email',
    ]);
    expect(fixture.steps.map((step) => step.scheduledAt)).toStrictEqual([
      '2026-08-22T15:00:00.000Z',
      '2026-08-22T15:00:01.000Z',
      '2026-08-22T15:00:02.000Z',
      '2026-08-22T15:00:03.000Z',
    ]);
    expect(
      new Set(fixture.steps.map((step) => step.envelope[0].eventTime)),
    ).toStrictEqual(new Set([input.eventStartAt]));
    expect(
      new Set(fixture.steps.map((step) => step.envelope[0].data.dataalteracao)),
    ).toStrictEqual(new Set([input.eventStartAt]));
    expect(
      fixture.steps.find((step) => step.eventType === 'endereco-insert')
        ?.envelope[0].data,
    ).toMatchObject({
      tipoendereco: 'COBRANCA',
      logradouro: expect.any(String),
      numerocep: '30140071',
      bairro: 'Funcionarios',
      numero: '100',
    });
  });

  it('rejects rendered fixtures with more than one collision lead setup', () => {
    const scheduledAt = '2026-08-22T15:00:00.000Z';
    const collisionLead = {
      operation: 'CREATE_SYNTHETIC_LEAD',
      role: 'COLLISION',
      lead: {
        idExterno: 'LEAD-SIM-COL-001',
        cpf: '39095812030',
        lastName: 'Terceiro Colidente',
        email: 'colisao.simulada@simulador.mrv.invalid',
        status: 'Pendente de Distribuição',
      },
    } as const;

    expect(() =>
      renderedScenarioFixtureSchema.parse({
        scenarioKey: 'contato-antes-cliente-colisao',
        version: 1,
        seed: input.seed,
        runId: input.runId,
        eventStartAt: scheduledAt,
        identifiers: {
          accountIdCliente: 'CLI-SIM-001',
          accountIdProspect: 'PRO-SIM-001',
          leadIdExterno: 'PRO-SIM-001',
          collisionLeadIdExterno: 'LEAD-SIM-COL-001',
        },
        setup: [collisionLead, collisionLead],
        steps: [
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
                id: 'EVT-SIM-001',
                subject: 'MS_Clientes',
                eventType: 'contato-insert',
                eventTime: scheduledAt,
                dataVersion: '1.0',
                metadataVersion: '1',
                topic: '/simulator/ms-clientes',
                data: {
                  idcliente: 'CLI-SIM-001',
                  tipocontato: 'Email',
                  descricao: 'colisao.simulada@simulador.mrv.invalid',
                  dataalteracao: scheduledAt,
                },
              },
            ],
          },
        ],
        expectedOutcomes: [
          {
            kind: 'BUSINESS_RESULT',
            result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
            description: 'Conta Y criada com colisão parcial de contatos.',
            checks: [
              { check: 'LEAD_MOBILE_EQUALS_EXPECTED', value: '11999990000' },
            ],
          },
        ],
        asyncPolicy: {
          expectedCallbacks: { min: 1, max: 1 },
          waitTimeoutMs: 30_000,
          missingCallbackResult: 'PARTIAL',
        },
        cleanup: [
          {
            operation: 'DELETE_OWNED_RECORDS',
            target: 'LEAD',
            ownership: { idExternoPrefix: 'LEAD-SIM-' },
          },
        ],
      }),
    ).toThrow(/collision/i);
  });

  it.each(scenarioKeys)(
    'renders %s as one strict Event Grid envelope without placeholders',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });

      expect(renderedScenarioFixtureSchema.parse(fixture)).toStrictEqual(
        fixture,
      );
      expect(fixture.steps).toHaveLength(
        expectedStepCountByScenario[scenarioKey],
      );
      for (const step of fixture.steps) {
        expect(step.envelope).toHaveLength(1);
        expect(eventGridEnvelopeSchema.parse(step.envelope)).toStrictEqual(
          step.envelope,
        );
      }
      expect(JSON.stringify(fixture)).not.toMatch(
        /\{\{|\$\{|VARIABLE|GENERATED|CONTRACT_ONLY/,
      );
    },
  );

  it.each(scenarioKeys)(
    'never emits data.id inside CLIENTE Event Grid payloads for %s',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });

      for (const step of fixture.steps) {
        if (step.target === 'CLIENTE') {
          expect(step.envelope[0].data).not.toHaveProperty('id');
        }
      }
    },
  );

  it('is byte-logically deterministic for identical input', () => {
    const first = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-id-cliente',
    });
    const second = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-id-cliente',
    });

    expect(second).toStrictEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('keeps seed logical values while runId namespaces persisted identifiers', () => {
    const first = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-id-cliente',
    });
    const second = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-id-cliente',
      runId: 'run_phase_two_b',
    });
    const firstEvent = clientEventData(first);
    const secondEvent = clientEventData(second);

    expect(second.identifiers).not.toStrictEqual(first.identifiers);
    expect(second.setup[0]).not.toStrictEqual(first.setup[0]);
    expect(secondEvent.idcliente).not.toBe(firstEvent.idcliente);
    expect(secondEvent.numerocpf).not.toBe(firstEvent.numerocpf);
    expect(secondEvent.nomecompleto).toBe(firstEvent.nomecompleto);
  });

  it.each(scenarioKeys)(
    'respects Salesforce external identifier lengths for %s',
    (scenarioKey) => {
      const { identifiers } = renderScenarioFixture({
        ...input,
        scenarioKey,
        runId: `run_${'namespace'.repeat(6)}`,
      });

      expect(identifiers.accountIdCliente.length).toBeLessThanOrEqual(50);
      expect(identifiers.accountIdProspect.length).toBeLessThanOrEqual(50);
      expect(identifiers.leadIdExterno.length).toBeLessThanOrEqual(150);
      expect(identifiers.accountIdProspect).toBe(identifiers.leadIdExterno);
    },
  );

  it.each(scenarioKeys)(
    'produces deterministic Apex-compatible UTC dates and applies delay for %s',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });
      const isPinnedLogicalEventTime = scenarioKey.startsWith(
        'ordem-mesmo-eventtime-',
      );
      for (const step of fixture.steps) {
        const expectedTime = new Date(
          Date.parse(input.eventStartAt) + step.delayMs,
        ).toISOString();
        const expectedDataAlteracao =
          scenarioKey === 'evento-obsoleto'
            ? '2026-08-22T14:59:54.000Z'
            : isPinnedLogicalEventTime
              ? input.eventStartAt
              : expectedTime;
        const expectedEventTime = isPinnedLogicalEventTime
          ? input.eventStartAt
          : expectedTime;

        expect(step.scheduledAt).toBe(expectedTime);
        expect(step.envelope[0].eventTime).toBe(expectedEventTime);
        expect(step.envelope[0].data.dataalteracao).toBe(expectedDataAlteracao);
      }
    },
  );

  it('renders declarative client events whose dataalteracao is older than the delivery time', async () => {
    const obsoleteScenarioDefinition = {
      key: 'evento-obsoleto-mock',
      version: 1,
      name: 'Evento obsoleto mockado',
      description:
        'Permite publicar um cliente-update com dataalteracao anterior ao setup.',
      scope: 'EXTENDED',
      tags: ['regression', 'obsolescencia'],
      availability: 'READY',
      variablesSchema: {
        type: 'object',
        properties: {
          seed: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
          },
          eventStartAt: {
            type: 'string',
            minLength: 20,
            maxLength: 24,
          },
        },
        required: ['seed', 'eventStartAt'],
        additionalProperties: false,
      },
      setup: [
        {
          operation: 'CREATE_SYNTHETIC_ACCOUNT',
          role: 'PRIMARY',
          matchBy: 'ID_CLIENTE',
          account: {
            idCliente: { source: 'GENERATED', value: 'CLIENT_ID' },
            idProspect: { source: 'GENERATED', value: 'PROSPECT_ID' },
            cpf: { source: 'GENERATED', value: 'CPF' },
            name: { source: 'GENERATED', value: 'BASE_PERSON_NAME' },
            dataAlteracao: { source: 'GENERATED', value: 'BASELINE_TIME' },
          },
        },
      ],
      steps: [
        {
          key: 'cliente-update',
          target: 'CLIENTE',
          eventType: 'cliente-update',
          delayMs: 0,
          payloadTemplate: {
            kind: 'DECLARATIVE',
            contract: 'EVENT_GRID',
            value: {
              id: { source: 'GENERATED', value: 'EVENT_ID' },
              subject: 'MS_Clientes',
              eventType: 'cliente-update',
              eventTime: { source: 'GENERATED', value: 'EVENT_TIME' },
              dataVersion: '1.0',
              metadataVersion: '1',
              topic: '/simulator/ms-clientes',
              data: {
                idcliente: { source: 'GENERATED', value: 'CLIENT_ID' },
                idprospectsalesforce: {
                  source: 'GENERATED',
                  value: 'PROSPECT_ID',
                },
                numerocpf: { source: 'GENERATED', value: 'CPF_X' },
                dataalteracao: { source: 'GENERATED', value: 'EARLIER_TIME' },
                nomecompleto: { source: 'GENERATED', value: 'PERSON_NAME' },
              },
            },
          },
          deliveryPolicy: {
            duplicateCount: 0,
            retryOn: [],
            maxAttempts: 1,
          },
        },
      ],
      expectedOutcomes: [
        {
          kind: 'BUSINESS_RESULT',
          result: 'ACCOUNT_UPDATED_ONLY',
          description: 'Resultado mantido no setup por obsolescência.',
          checks: ['ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE'],
        },
      ],
      asyncPolicy: {
        expectedCallbacks: { min: 0, max: 0 },
        waitTimeoutMs: 0,
        missingCallbackResult: 'SUCCESS',
      },
      cleanup: [
        {
          operation: 'DELETE_OWNED_RECORDS',
          target: 'ACCOUNT',
        },
      ],
    } as const;

    vi.resetModules();
    vi.doMock('./catalog', () => ({
      scenarioCatalog: {
        listAll: () => [obsoleteScenarioDefinition],
        listActive: () => [obsoleteScenarioDefinition],
        get: (key: string, version: number) =>
          key === obsoleteScenarioDefinition.key &&
          version === obsoleteScenarioDefinition.version
            ? obsoleteScenarioDefinition
            : undefined,
        getActive: (key: string) =>
          key === obsoleteScenarioDefinition.key
            ? obsoleteScenarioDefinition
            : undefined,
      },
    }));

    try {
      const { renderScenarioFixture: renderMockedFixture } =
        await import('./renderer');

      const fixture = renderMockedFixture({
        scenarioKey: obsoleteScenarioDefinition.key,
        version: 1,
        seed: input.seed,
        runId: input.runId,
        eventStartAt: input.eventStartAt,
      });

      expect(fixture.steps[0]?.scheduledAt).toBe('2026-08-22T15:00:00.000Z');
      expect(fixture.steps[0]?.envelope[0].eventTime).toBe(
        '2026-08-22T15:00:00.000Z',
      );
      expect(fixture.steps[0]?.envelope[0].data.dataalteracao).toBe(
        '2026-08-22T14:59:54.000Z',
      );
    } finally {
      vi.doUnmock('./catalog');
      vi.resetModules();
    }
  });

  it('renders an optional GraphQL response policy declared by the scenario', async () => {
    const graphqlTimeoutDefinition = {
      ...scenarioCatalog.get('cliente-insert-prospect-divergente', 1)!,
      key: 'graphql-timeout-mock',
      graphqlResponse: {
        policy: 'DELAYED_RESPONSE',
        delayMs: 8_000,
      },
    } as const;

    vi.resetModules();
    vi.doMock('./catalog', () => ({
      scenarioCatalog: {
        listAll: () => [graphqlTimeoutDefinition],
        listActive: () => [graphqlTimeoutDefinition],
        get: (key: string, version: number) =>
          key === graphqlTimeoutDefinition.key &&
          version === graphqlTimeoutDefinition.version
            ? graphqlTimeoutDefinition
            : undefined,
        getActive: (key: string) =>
          key === graphqlTimeoutDefinition.key
            ? graphqlTimeoutDefinition
            : undefined,
      },
    }));

    try {
      const { renderScenarioFixture: renderMockedFixture } =
        await import('./renderer');
      const fixture = renderMockedFixture({
        ...input,
        scenarioKey: 'graphql-timeout-mock',
      });

      expect(fixture.graphqlResponse).toStrictEqual({
        policy: 'DELAYED_RESPONSE',
        delayMs: 8_000,
      });
    } finally {
      vi.doUnmock('./catalog');
      vi.resetModules();
    }
  });

  it.each(scenarioKeys)(
    'passes both scanners without provenance bypass for %s',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });

      expect(scanRenderedFixtureSecrets(fixture)).toEqual([]);
      expect(scanSecrets(fixture)).toEqual([]);
      expect(fixture).not.toHaveProperty('syntheticOrigins');
    },
  );

  it('describes exact allowlisted setup and cleanup operations', () => {
    const contatoAntesCliente = renderScenarioFixture({
      ...input,
      scenarioKey: 'contato-antes-cliente-colisao',
    });
    const divergent = renderScenarioFixture({
      ...input,
      scenarioKey: 'cliente-insert-prospect-divergente',
    });
    const byId = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-id-cliente',
    });
    const byCpf = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-cpf-sem-id-cliente',
    });
    const noMatch = renderScenarioFixture({
      ...input,
      scenarioKey: 'no-match-cliente-insert',
    });

    expect(byId.setup[0]).toMatchObject({
      operation: 'CREATE_SYNTHETIC_ACCOUNT',
      matchBy: 'ID_CLIENTE',
      account: {
        idCliente: byId.identifiers.accountIdCliente,
        idProspect: byId.identifiers.accountIdProspect,
      },
    });
    expect(byCpf.setup[0]).toMatchObject({
      operation: 'CREATE_SYNTHETIC_ACCOUNT',
      matchBy: 'CPF',
      account: {
        idCliente: null,
        idProspect: byCpf.identifiers.accountIdProspect,
      },
    });
    expect(noMatch.setup[0]).toMatchObject({
      operation: 'ENSURE_ACCOUNT_ABSENT',
      keys: { idCliente: noMatch.identifiers.accountIdCliente },
    });
    expect(noMatch.cleanup).toStrictEqual([
      {
        operation: 'DELETE_OWNED_RECORDS',
        target: 'ACCOUNT',
        ownership: { idCliente: noMatch.identifiers.accountIdCliente },
      },
    ]);
    expect(
      contatoAntesCliente.identifiers.collisionLeadIdExterno,
    ).toBeDefined();
    expect(
      contatoAntesCliente.setup.filter(
        (instruction) => instruction.operation === 'CREATE_SYNTHETIC_LEAD',
      ),
    ).toContainEqual(
      expect.objectContaining({
        role: 'COLLISION',
        lead: expect.objectContaining({
          idExterno: contatoAntesCliente.identifiers.collisionLeadIdExterno,
        }),
      }),
    );
    expect(divergent.identifiers.controlAccountIdCliente).toBeDefined();
    expect(divergent.identifiers.controlAccountIdProspect).toBeDefined();
    expect(divergent.cleanup).toStrictEqual([
      {
        operation: 'DELETE_OWNED_RECORDS',
        target: 'ACCOUNT',
        ownership: {
          idCliente: divergent.identifiers.accountIdCliente,
          controlAccountIdCliente:
            divergent.identifiers.controlAccountIdCliente,
        },
      },
      {
        operation: 'DELETE_OWNED_RECORDS',
        target: 'LEAD',
        ownership: { idExternoPrefix: 'LEAD-SIM-' },
      },
    ]);
  });

  it('renders the GraphQL failure and echo-prospect fixtures with the expected callback metadata', () => {
    const erro500 = renderScenarioFixture({
      ...input,
      scenarioKey: 'graphql-erro-500',
    });
    const invalida = renderScenarioFixture({
      ...input,
      scenarioKey: 'graphql-resposta-invalida',
    });
    const timeout = renderScenarioFixture({
      ...input,
      scenarioKey: 'graphql-timeout',
    });
    const echo = renderScenarioFixture({
      ...input,
      scenarioKey: 'id-prospect-igual-id-cliente',
    });

    expect(erro500.graphqlResponse).toStrictEqual({ policy: 'HTTP_500' });
    expect(invalida.graphqlResponse).toStrictEqual({
      policy: 'INVALID_JSON_200',
    });
    expect(timeout.graphqlResponse).toStrictEqual({
      policy: 'DELAYED_RESPONSE',
      delayMs: 8_000,
    });
    expect(echo.graphqlResponse).toBeUndefined();
    const echoData = echo.steps[0]?.envelope[0].data as
      { idcliente?: string; idprospectsalesforce?: string } | undefined;
    expect(echoData?.idcliente).toBe(echoData?.idprospectsalesforce);
  });

  it('keeps the control identifiers deterministic and distinct from the primary account', () => {
    const fixture = renderScenarioFixture({
      ...input,
      scenarioKey: 'cliente-insert-prospect-divergente',
    });

    expect(fixture.identifiers.controlAccountIdCliente).toBeDefined();
    expect(fixture.identifiers.controlAccountIdProspect).toBeDefined();
    expect(fixture.identifiers.controlAccountIdCliente).not.toBe(
      fixture.identifiers.accountIdCliente,
    );
    expect(fixture.identifiers.controlAccountIdProspect).not.toBe(
      fixture.identifiers.accountIdProspect,
    );
    expect(fixture.setup[0]).toMatchObject({
      operation: 'CREATE_SYNTHETIC_ACCOUNT',
      role: 'CONTROL',
      account: {
        idCliente: fixture.identifiers.controlAccountIdCliente,
        idProspect: fixture.identifiers.controlAccountIdProspect,
      },
    });
    const firstStepData = fixture.steps[0].envelope[0].data as {
      idprospectsalesforce?: string;
    };
    expect(firstStepData.idprospectsalesforce).toBe(
      fixture.identifiers.controlAccountIdProspect,
    );
  });

  it('renders the combined O02 + Regra 6.6 scenario with dynamic mobile expectation', () => {
    const fixture = renderScenarioFixture({
      ...input,
      scenarioKey: 'contato-antes-cliente-colisao',
    });

    expect(fixture.identifiers.collisionLeadIdExterno).toMatch(/^LEAD-SIM-/);
    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'cliente-insert-divergente',
      'contato-email',
      'contato-celular',
    ]);
    expect(fixture.steps[0]?.eventType).toBe('cliente-insert');
    expect(fixture.steps[1]?.eventType).toBe('contato-insert');
    expect(fixture.steps[2]?.eventType).toBe('contato-insert');
    expect(fixture.steps[1]?.envelope[0].data).toMatchObject({
      tipocontato: 'Email',
      descricao: expect.stringContaining('@simulador.mrv.invalid'),
    });
    expect(fixture.steps[1]?.envelope[0].data).not.toHaveProperty(
      'idprospectsalesforce',
    );
    expect(fixture.steps[2]?.envelope[0].data).toMatchObject({
      tipocontato: 'Celular',
      descricao: expect.stringMatching(/^\d{11}$/),
    });
    expect(fixture.steps[2]?.envelope[0].data).not.toHaveProperty(
      'idprospectsalesforce',
    );
    expect(fixture.expectedOutcomes[0]?.checks).toContainEqual(
      expect.objectContaining({
        check: 'LEAD_MOBILE_EQUALS_EXPECTED',
        value: expect.stringMatching(/^\d{11}$/),
      }),
    );
  });

  it('emits only cliente fields consumed by the Apex contract', () => {
    const matched = renderScenarioFixture({
      ...input,
      scenarioKey: 'match-id-cliente',
    });
    const noMatch = renderScenarioFixture({
      ...input,
      scenarioKey: 'no-match-cliente-insert',
    });

    expect(Object.keys(matched.steps[0].envelope[0].data).sort()).toStrictEqual(
      [
        'dataalteracao',
        'idcliente',
        'idprospectsalesforce',
        'nomecompleto',
        'numerocpf',
      ],
    );
    expect(Object.keys(noMatch.steps[0].envelope[0].data).sort()).toStrictEqual(
      ['dataalteracao', 'idcliente', 'nomecompleto', 'numerocpf'],
    );
  });
});
