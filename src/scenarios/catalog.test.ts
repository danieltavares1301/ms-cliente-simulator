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
});

describe('versioned scenario catalog', () => {
  it('loads the ready scenarios with deterministic ordering', () => {
    expect(scenarioCatalog.listActive()).toHaveLength(5);
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
      basicScenarioDefinitions.find(({ key }) => key === 'match-cpf-sem-id-cliente')!,
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
