import { describe, expect, it } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

describe('cross-endpoint scenario definitions', () => {
  it('publishes a READY scenario that keeps the Opportunity on the approved Account after PAC', () => {
    const scenario = scenarioCatalog.get(
      'e2e-opportunity-permanece-conta-aprovada',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'e2e-opportunity-permanece-conta-aprovada',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'CREATE_SYNTHETIC_ACCOUNT',
          role: 'CONTROL',
        }),
      ]),
    );
    expect(scenario?.steps.map((step) => step.key)).toStrictEqual([
      'maquina-estado-insert-conta-antiga',
      'cliente-insert-conta-aprovada',
      'pac-insert-aprovado',
      'maquina-estado-update-identidade-antiga',
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'PAC_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Qualificação de Documentos',
        },
      ]),
    });
  });

  it('renders the approved-account fixture keeping the PAC on Y while the final MaquinaEstado update still points to the legacy prospect', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'e2e-opportunity-permanece-conta-aprovada',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_cross_a',
      eventStartAt: '2026-09-22T22:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'maquina-estado-insert-conta-antiga',
      'cliente-insert-conta-aprovada',
      'pac-insert-aprovado',
      'maquina-estado-update-identidade-antiga',
    ]);
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: fixture.identifiers.controlAccountIdCliente,
        idProspectSalesforce: fixture.identifiers.controlAccountIdProspect,
      },
      estado: 'SIMULACAO',
    });
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      idcliente: fixture.identifiers.accountIdCliente,
      idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
    });
    expect(fixture.steps[2]!.envelope[0]!.data).toMatchObject({
      idjornadapac: fixture.steps[0]!.envelope[0]!.data.id,
      status: 'CREDITO_APROVADO_CONDICIONADO',
      proponentes: [
        expect.objectContaining({
          idCliente: fixture.identifiers.accountIdCliente,
        }),
      ],
    });
    expect(fixture.steps[3]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: null,
        idProspectSalesforce: fixture.identifiers.controlAccountIdProspect,
      },
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'Documentacao',
    });
  });

  it('publishes a READY scenario that ignores an obsolete MaquinaEstado update without cliente match', () => {
    const scenario = scenarioCatalog.get(
      'e2e-evento-obsoleto-sem-cliente-ignorado',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'e2e-evento-obsoleto-sem-cliente-ignorado',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.steps.map((step) => step.key)).toStrictEqual([
      'maquina-estado-insert-inicial',
      'maquina-estado-update-documentacao-atual',
      'maquina-estado-update-obsoleto-sem-cliente',
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Qualificação de Documentos',
        },
      ]),
    });
  });

  it('renders the obsolete-without-client fixture with a later physical dispatch but earlier logical EventTime', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'e2e-evento-obsoleto-sem-cliente-ignorado',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_cross_b',
      eventStartAt: '2026-09-22T22:10:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(3);
    expect(fixture.steps[2]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: expect.stringMatching(/^CLI-SIM-X-/),
        idProspectSalesforce: expect.stringMatching(/^PRO-SIM-X-/),
      },
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'CONTRATO',
    });
    expect(Date.parse(fixture.steps[2]!.scheduledAt)).toBeGreaterThan(
      Date.parse(fixture.steps[1]!.scheduledAt),
    );
    expect(Date.parse(fixture.steps[2]!.envelope[0]!.eventTime)).toBeLessThan(
      Date.parse(fixture.steps[1]!.envelope[0]!.eventTime),
    );
  });

  it('publishes a READY scenario that succeeds after cliente-insert plus cliente-update carimba o prospect', () => {
    const scenario = scenarioCatalog.get(
      'e2e-evento-atual-reentregue-apos-cliente-insert',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'e2e-evento-atual-reentregue-apos-cliente-insert',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'ENSURE_ACCOUNT_ABSENT' }),
      ]),
    );
    expect(scenario?.steps.map((step) => step.key)).toStrictEqual([
      'maquina-estado-insert-sem-cliente',
      'cliente-insert-cria-account',
      'cliente-update-carimba-prospect',
      'maquina-estado-insert-reentregue',
    ]);
    expect(scenario?.steps[0]).toMatchObject({
      expectedHttpStatus: 400,
    });
    expect(scenario?.steps[2]).toMatchObject({
      target: 'CLIENTE',
      eventType: 'cliente-update',
    });
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        {
          check: 'ACCOUNT_PROSPECT_ID_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'PROSPECT_ID' },
        },
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Simulação',
        },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 1,
        },
      ]),
    });
  });

  it('renders the replay-after-client fixture with an intermediate cliente-update and identical original/replayed MaquinaEstado envelopes', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'e2e-evento-atual-reentregue-apos-cliente-insert',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_cross_c',
      eventStartAt: '2026-09-22T22:20:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(4);
    expect(fixture.steps[0]).toMatchObject({
      expectedHttpStatus: 400,
    });
    expect(fixture.steps[2]!.envelope[0]!.eventType).toBe('cliente-update');
    expect(fixture.steps[2]!.envelope[0]!.data).toMatchObject({
      idcliente: fixture.identifiers.accountIdCliente,
      idprospectsalesforce: fixture.identifiers.accountIdProspect,
    });
    expect(fixture.steps[0]!.envelope).toStrictEqual(fixture.steps[3]!.envelope);
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      idcliente: fixture.identifiers.accountIdCliente,
      idprospectsalesforce: fixture.identifiers.accountIdProspect,
    });
    expect(Date.parse(fixture.steps[3]!.scheduledAt)).toBeGreaterThan(
      Date.parse(fixture.steps[2]!.scheduledAt),
    );
  });
});
