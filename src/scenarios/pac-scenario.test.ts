import { describe, expect, it } from 'vitest';

import { eventGridEnvelopeSchema, renderedScenarioFixtureSchema } from '../contracts';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

describe('PAC smoke scenario definition', () => {
  it('publishes a READY pac-insert smoke scenario', () => {
    const scenario = scenarioCatalog.get('pac-insert-minimo', 1);

    expect(scenario).toMatchObject({
      key: 'pac-insert-minimo',
      scope: 'EXTENDED',
      availability: 'READY',
      tags: ['fase-7', 'pac-minimo', 'regression'],
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_OPPORTUNITY' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        target: 'PAC',
        eventType: 'pac-insert',
      }),
    ]);
  });

  it('renders a PAC fixture with a synthetic Opportunity and cleanup ownership', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-insert-minimo',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_a',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(fixture.steps[0]).toMatchObject({
      target: 'PAC',
      eventType: 'pac-insert',
    });
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^PAC-SIM-/),
      idjornadapac: expect.stringMatching(/^OPP-SIM-/),
      status: 'EM_ANALISE_CREDITO',
    });
    expect(fixture.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'OPPORTUNITY',
          ownership: {
            idExterno: expect.stringMatching(/^OPP-SIM-/),
            pacIdExterno: expect.stringMatching(/^PAC-SIM-/),
          },
        }),
      ]),
    );
  });

  it('publishes a READY PAC approved scenario that synchronizes Account contacts from the principal proponente', () => {
    const scenario = scenarioCatalog.get('pac-aprovada-sincroniza-contatos', 1);

    expect(scenario).toMatchObject({
      key: 'pac-aprovada-sincroniza-contatos',
      scope: 'EXTENDED',
      availability: 'READY',
      tags: ['fase-7', 'pac-aprovada', 'regression', 'sincronizacao-contatos'],
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_OPPORTUNITY' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        target: 'PAC',
        eventType: 'pac-insert',
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'PAC_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
        { check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED', value: { source: 'GENERATED', value: 'SYNTHETIC_EMAIL' } },
        { check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED', value: { source: 'GENERATED', value: 'CLEAN_CELULAR' } },
        'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
      ]),
    });
  });

  it('renders a PAC approved fixture with one principal proponente bound to the same PAC external id', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-aprovada-sincroniza-contatos',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_b',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^PAC-SIM-/),
      idjornadapac: expect.stringMatching(/^OPP-SIM-/),
      status: 'CREDITO_APROVADO_CONDICIONADO',
      proponentes: [
        expect.objectContaining({
          id: expect.stringMatching(/^PROP-SIM-/),
          idPac: expect.stringMatching(/^PAC-SIM-/),
          idCliente: fixture.identifiers.accountIdCliente,
          cpf: expect.stringMatching(/^\d{11}$/),
          tipoClassificacao: 'Principal',
          email: expect.stringContaining('@simulador.mrv.invalid'),
          telefoneCelular: expect.stringMatching(/^\d{11}$/),
        }),
      ],
    });
    const proponente = (
      fixture.steps[0]!.envelope[0]!.data as {
        id: string;
        proponentes: Array<{ idPac: string }>;
      }
    ).proponentes[0]!;
    expect(proponente.idPac).toBe(
      (fixture.steps[0]!.envelope[0]!.data as { id: string }).id,
    );
    expect(fixture.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'DELETE_OWNED_RECORDS',
          target: 'PROPONENTE',
          ownership: {
            idCliente: fixture.identifiers.accountIdCliente,
            pacIdExterno: expect.stringMatching(/^PAC-SIM-/),
            idExterno: expect.stringMatching(/^PROP-SIM-/),
          },
        }),
        expect.objectContaining({
          operation: 'DELETE_OWNED_RECORDS',
          target: 'OPPORTUNITY',
          ownership: {
            idExterno: expect.stringMatching(/^OPP-SIM-/),
            pacIdExterno: expect.stringMatching(/^PAC-SIM-/),
          },
        }),
      ]),
    );
  });
});
