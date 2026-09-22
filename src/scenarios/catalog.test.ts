import { describe, expect, it } from 'vitest';

import { scenarioDefinitionSchema } from '../contracts';
import { createScenarioCatalog, scenarioCatalog } from './catalog';
import { basicScenarioDefinitions } from './definitions';

const matchIdClienteDefinition = basicScenarioDefinitions.find(
  ({ key }) => key === 'match-id-cliente',
)!;
const noMatchDefinition = basicScenarioDefinitions.find(
  ({ key }) => key === 'no-match-cliente-insert',
)!;

describe('scenarioDefinitionSchema', () => {
  it('normalizes, deduplicates, and sorts tags', () => {
    const parsed = scenarioDefinitionSchema.parse({
      ...matchIdClienteDefinition,
      tags: [' Match ', 'core', 'match'],
    });

    expect(parsed.tags).toStrictEqual(['core', 'match']);
  });

  it('rejects unsafe executable templates', () => {
    expect(() =>
      scenarioDefinitionSchema.parse({
        ...matchIdClienteDefinition,
        steps: [
          {
            ...matchIdClienteDefinition.steps[0],
            payloadTemplate: () => ({ idcliente: 'unsafe' }),
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects more than one synthetic primary account in the same fixture', () => {
    expect(() =>
      scenarioDefinitionSchema.parse({
        ...matchIdClienteDefinition,
        setup: [
          matchIdClienteDefinition.setup?.[0],
          matchIdClienteDefinition.setup?.[0],
        ],
      }),
    ).toThrow(/primary/i);
  });

  it('rejects more than one synthetic control account in the same fixture', () => {
    const controlSetup = {
      operation: 'CREATE_SYNTHETIC_ACCOUNT',
      role: 'CONTROL',
      matchBy: 'ID_CLIENTE',
      account: {
        idCliente: { source: 'GENERATED', value: 'CLIENT_ID_X' },
        idProspect: { source: 'GENERATED', value: 'PROSPECT_ID_X' },
        cpf: { source: 'GENERATED', value: 'CPF_X' },
        name: { source: 'GENERATED', value: 'BASE_PERSON_NAME' },
        dataAlteracao: { source: 'GENERATED', value: 'BASELINE_TIME' },
      },
    } as const;

    expect(() =>
      scenarioDefinitionSchema.parse({
        ...noMatchDefinition,
        setup: [controlSetup, controlSetup, ...noMatchDefinition.setup!],
      }),
    ).toThrow(/control/i);
  });

  it('accepts optional GraphQL response policy configuration', () => {
    const parsed = scenarioDefinitionSchema.parse({
      ...matchIdClienteDefinition,
      key: 'graphql-timeout-mock',
      graphqlResponse: {
        policy: 'DELAYED_RESPONSE',
        delayMs: 8_000,
      },
    });

    expect(parsed.graphqlResponse).toStrictEqual({
      policy: 'DELAYED_RESPONSE',
      delayMs: 8_000,
    });
  });

  it('accepts a collision Lead role and generated expected outcome values', () => {
    const parsed = scenarioDefinitionSchema.parse({
      ...noMatchDefinition,
      key: 'contato-antes-cliente-colisao',
      tags: ['regression', 'o01', 'regra-6-6'],
      setup: [
        ...(noMatchDefinition.setup ?? []),
        {
          operation: 'CREATE_SYNTHETIC_LEAD',
          role: 'COLLISION',
          lead: {
            idExterno: {
              source: 'GENERATED',
              value: 'COLLISION_LEAD_ID_EXTERNO',
            },
            cpf: { source: 'GENERATED', value: 'COLLISION_CPF' },
            lastName: 'Terceiro Colidente',
            email: { source: 'GENERATED', value: 'COLLISION_EMAIL' },
          },
        },
      ],
      expectedOutcomes: [
        {
          kind: 'BUSINESS_RESULT',
          result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
          description:
            'Permite checks parametrizados por valores gerados na renderização.',
          checks: [
            {
              check: 'LEAD_MOBILE_EQUALS_EXPECTED',
              value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
            },
          ],
        },
      ],
    });

    expect(parsed.setup?.at(-1)).toMatchObject({
      operation: 'CREATE_SYNTHETIC_LEAD',
      role: 'COLLISION',
    });
    expect(parsed.expectedOutcomes[0]?.checks[0]).toMatchObject({
      check: 'LEAD_MOBILE_EQUALS_EXPECTED',
      value: { source: 'GENERATED', value: 'CLEAN_CELULAR' },
    });
  });

  it('rejects more than one synthetic collision lead in the same fixture', () => {
    const collisionLead = {
      operation: 'CREATE_SYNTHETIC_LEAD',
      role: 'COLLISION',
      lead: {
        idExterno: { source: 'GENERATED', value: 'COLLISION_LEAD_ID_EXTERNO' },
        cpf: { source: 'GENERATED', value: 'COLLISION_CPF' },
        lastName: 'Terceiro Colidente',
        email: { source: 'GENERATED', value: 'COLLISION_EMAIL' },
      },
    } as const;

    expect(() =>
      scenarioDefinitionSchema.parse({
        ...noMatchDefinition,
        setup: [
          collisionLead,
          collisionLead,
          ...(noMatchDefinition.setup ?? []),
        ],
      }),
    ).toThrow(/collision/i);
  });

  it('rejects more than one synthetic primary lead in the same fixture', () => {
    const primaryLead = {
      operation: 'CREATE_SYNTHETIC_LEAD',
      role: 'PRIMARY',
      lead: {
        idExterno: { source: 'GENERATED', value: 'PROSPECT_ID' },
        cpf: { source: 'GENERATED', value: 'CPF' },
        lastName: 'Cliente Simulado',
      },
    } as const;

    expect(() =>
      scenarioDefinitionSchema.parse({
        ...noMatchDefinition,
        setup: [primaryLead, primaryLead, ...(noMatchDefinition.setup ?? [])],
      }),
    ).toThrow(/primary synthetic lead/i);
  });
});

describe('versioned scenario catalog', () => {
  it('loads the ready scenarios with deterministic ordering', () => {
    expect(scenarioCatalog.listActive()).toHaveLength(37);
    expect(
      scenarioCatalog.listActive().map(({ key, version, availability }) => ({
        key,
        version,
        availability,
      })),
    ).toStrictEqual([
      {
        key: 'cliente-insert-prospect-divergente',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'cliente-update-nova-estrutura',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'contato-antes-cliente-colisao',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'cpf-divergente-contato-primeiro',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'cpf-divergente-identidade-antiga',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'cpf-divergente-identidade-antiga-pac-aprovada',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'evento-duplicado',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'evento-obsoleto',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'graphql-erro-500',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'graphql-resposta-invalida',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'graphql-timeout',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'id-prospect-igual-id-cliente',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-insert-apos-cliente-criado',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-insert-minimo',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-insert-sem-cliente-falha',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-insert-troca-unidade-falha',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-update-estado-nao-reconhecido',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-update-evento-obsoleto',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-update-reentrega-mesmo-evento',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-update-sem-cliente-falha',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-update-transicao-estado',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'maquina-estado-update-troca-unidade',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'match-cpf-sem-id-cliente',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'match-id-cliente',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'no-match-cliente-insert',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'ordem-mesmo-eventtime-cliente-primeiro',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'ordem-mesmo-eventtime-contato-primeiro',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'ordem-mesmo-eventtime-endereco-primeiro',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-aprovada-sincroniza-contatos',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-conflito-proponentes-principais',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-insert-minimo',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-insert-opportunity-perdida-forca-cancelado',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-update-altera-status-sem-proponentes',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-update-com-contestacao-pendente-sincroniza-contatos',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-update-obsoleto-nivel-pac',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-update-obsoleto-nivel-proponente',
        version: 1,
        availability: 'READY',
      },
      {
        key: 'pac-update-reenviando-proponentes',
        version: 1,
        availability: 'READY',
      },
    ]);
  });

  it('rejects duplicate key and version identities', () => {
    expect(() =>
      createScenarioCatalog([
        matchIdClienteDefinition,
        matchIdClienteDefinition,
      ]),
    ).toThrow(/match-id-cliente@1/);
  });

  it('keeps deterministic ordering by key and version', () => {
    const catalog = createScenarioCatalog([
      { ...matchIdClienteDefinition, version: 2 },
      basicScenarioDefinitions.find(
        ({ key }) => key === 'match-cpf-sem-id-cliente',
      )!,
      matchIdClienteDefinition,
    ]);

    expect(
      catalog
        .listAll()
        .map((scenario) => `${scenario.key}@${scenario.version}`),
    ).toStrictEqual([
      'match-cpf-sem-id-cliente@1',
      'match-id-cliente@1',
      'match-id-cliente@2',
    ]);
    expect(catalog.getActive('match-id-cliente')?.version).toBe(2);
  });

  it('deep-freezes definitions so published versions cannot be overwritten', () => {
    const scenario = scenarioCatalog.get('match-id-cliente', 1);

    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(scenario?.steps)).toBe(true);
    expect(Object.isFrozen(scenario?.steps[0].deliveryPolicy)).toBe(true);
    expect(() => {
      (
        scenario as unknown as {
          version: number;
        }
      ).version = 2;
    }).toThrow();
  });
});
