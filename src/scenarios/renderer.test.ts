import { describe, expect, it } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
import { scanRenderedFixtureSecrets, scanSecrets } from '../redaction/scanner';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

const scenarioKeys = [
  'match-id-cliente',
  'match-cpf-sem-id-cliente',
  'no-match-cliente-insert',
  'cliente-update-nova-estrutura',
] as const;

const input = {
  version: 1,
  seed: 'phase-two-seed',
  runId: 'run_phase_two_a',
  eventStartAt: '2026-08-22T15:00:00.000Z',
} as const;

describe('basic scenario fixture definitions', () => {
  it.each(scenarioKeys)(
    'publishes complete READY fixture %s',
    (scenarioKey) => {
      const definition = scenarioCatalog.get(scenarioKey, 1);

      expect(definition).toBeDefined();
      expect(definition?.availability).toBe('READY');
      expect(definition?.setup?.length).toBeGreaterThan(0);
      expect(definition?.steps).toHaveLength(1);
      expect(definition?.steps[0].target).toBe('CLIENTE');
      expect(definition?.steps[0].payloadTemplate.kind).toBe('DECLARATIVE');
      expect(definition?.expectedOutcomes.length).toBeGreaterThan(0);
      expect(definition?.expectedOutcomes[0].checks.length).toBeGreaterThan(0);
      expect(definition?.asyncPolicy).toBeDefined();
      expect(definition?.cleanup?.length).toBeGreaterThan(0);
    },
  );

  it('models only Apex behavior actually triggered by each core event', () => {
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
});

describe('renderScenarioFixture', () => {
  it.each(scenarioKeys)(
    'renders %s as one strict Event Grid envelope without placeholders',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });

      expect(renderedScenarioFixtureSchema.parse(fixture)).toStrictEqual(
        fixture,
      );
      expect(fixture.steps).toHaveLength(1);
      expect(fixture.steps[0].envelope).toHaveLength(1);
      expect(
        eventGridEnvelopeSchema.parse(fixture.steps[0].envelope),
      ).toStrictEqual(fixture.steps[0].envelope);
      expect(JSON.stringify(fixture)).not.toMatch(
        /\{\{|\$\{|VARIABLE|GENERATED|CONTRACT_ONLY/,
      );
    },
  );

  it.each(scenarioKeys)(
    'never emits data.id inside the Event Grid payload for %s',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });

      expect(fixture.steps[0].envelope[0].data).not.toHaveProperty('id');
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

    expect(second.identifiers).not.toStrictEqual(first.identifiers);
    expect(second.setup[0]).not.toStrictEqual(first.setup[0]);
    expect(second.steps[0].envelope[0].data.idcliente).not.toBe(
      first.steps[0].envelope[0].data.idcliente,
    );
    expect(second.steps[0].envelope[0].data.numerocpf).not.toBe(
      first.steps[0].envelope[0].data.numerocpf,
    );
    expect(second.steps[0].envelope[0].data.nomecompleto).toBe(
      first.steps[0].envelope[0].data.nomecompleto,
    );
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
      const expectedTime = new Date(
        Date.parse(input.eventStartAt) + fixture.steps[0].delayMs,
      ).toISOString();

      expect(fixture.steps[0].scheduledAt).toBe(expectedTime);
      expect(fixture.steps[0].envelope[0].eventTime).toBe(expectedTime);
      expect(fixture.steps[0].envelope[0].data.dataalteracao).toBe(
        expectedTime,
      );
    },
  );

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
