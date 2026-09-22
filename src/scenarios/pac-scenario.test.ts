import { describe, expect, it } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
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
            proponentes: [
              {
                idCliente: fixture.identifiers.accountIdCliente,
                idExterno: expect.stringMatching(/^PROP-SIM-/),
              },
            ],
            pacIdExterno: expect.stringMatching(/^PAC-SIM-/),
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

  it('publishes a READY PAC update scenario that changes status and omits proponentes to exercise the real deletion branch', () => {
    const scenario = scenarioCatalog.get(
      'pac-update-altera-status-sem-proponentes',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'pac-update-altera-status-sem-proponentes',
      scope: 'EXTENDED',
      availability: 'READY',
      tags: [
        'fase-7',
        'pac-update',
        'regression',
        'sem-proponentes',
      ],
    });
    expect(scenario?.steps.map((step) => step.eventType)).toStrictEqual([
      'pac-insert',
      'pac-update',
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      checks: expect.arrayContaining([
        'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
        'PROPONENTE_NOT_PRESENT',
        {
          check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
          value: 'CREDITO_APROVADO_CONDICIONADO',
        },
      ]),
    });
  });

  it('renders the PAC update-without-proponentes fixture reusing the same PAC ids and dropping the array in the second step', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-update-altera-status-sem-proponentes',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_d',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(2);
    expect(fixture.steps.map((step) => step.eventType)).toStrictEqual([
      'pac-insert',
      'pac-update',
    ]);
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^PAC-SIM-/),
      idjornadapac: expect.stringMatching(/^OPP-SIM-/),
      status: 'EM_ANALISE_CREDITO',
      proponentes: [expect.objectContaining({ tipoClassificacao: 'Principal' })],
    });
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^PAC-SIM-/),
      idjornadapac: expect.stringMatching(/^OPP-SIM-/),
      status: 'CREDITO_APROVADO_CONDICIONADO',
    });
    expect(
      (fixture.steps[1]!.envelope[0]!.data as { proponentes?: unknown })
        .proponentes,
    ).toBeUndefined();
  });

  it('publishes a READY PAC update scenario that replays the principal proponente with new contacts', () => {
    const scenario = scenarioCatalog.get(
      'pac-update-reenviando-proponentes',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'pac-update-reenviando-proponentes',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.tags).toEqual(
      expect.arrayContaining([
        'fase-7',
        'pac-update',
        'regression',
        'reenvio-proponentes',
      ]),
    );
    expect(scenario?.steps.map((step) => step.eventType)).toStrictEqual([
      'pac-insert',
      'pac-update',
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      checks: expect.arrayContaining([
        'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
        'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE',
        'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
        {
          check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'PAC_EMAIL' },
        },
        {
          check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
          value: { source: 'GENERATED', value: 'PAC_CELULAR' },
        },
        {
          check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
          value: 'CREDITO_APROVADO_CONDICIONADO',
        },
      ]),
    });
  });

  it('renders the PAC update-with-proponentes fixture keeping one principal proponente id while changing email and celular in the second step', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-update-reenviando-proponentes',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_e',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(2);
    const insertData = fixture.steps[0]!.envelope[0]!.data as {
      id: string;
      proponentes: Array<{
        id: string;
        idPac: string;
        email?: string;
        telefoneCelular?: string;
      }>;
    };
    const updateData = fixture.steps[1]!.envelope[0]!.data as {
      id: string;
      status: string;
      proponentes: Array<{
        id: string;
        idPac: string;
        email?: string;
        telefoneCelular?: string;
      }>;
    };

    expect(updateData.id).toBe(insertData.id);
    expect(updateData.status).toBe('CREDITO_APROVADO_CONDICIONADO');
    expect(updateData.proponentes).toHaveLength(1);
    expect(updateData.proponentes[0]!.id).toBe(insertData.proponentes[0]!.id);
    expect(updateData.proponentes[0]!.idPac).toBe(insertData.id);
    expect(updateData.proponentes[0]!.email).not.toBe(
      insertData.proponentes[0]!.email,
    );
    expect(updateData.proponentes[0]!.telefoneCelular).not.toBe(
      insertData.proponentes[0]!.telefoneCelular,
    );
  });

  it('publishes a READY PAC update scenario that rejects the whole payload when the PAC dataalteracao is older than the persisted one', () => {
    const scenario = scenarioCatalog.get('pac-update-obsoleto-nivel-pac', 1);

    expect(scenario).toMatchObject({
      key: 'pac-update-obsoleto-nivel-pac',
      scope: 'EXTENDED',
      availability: 'READY',
      tags: expect.arrayContaining([
        'fase-7',
        'obsolescencia',
        'pac-update',
        'regression',
      ]),
    });
    expect(scenario?.steps.map((step) => step.eventType)).toStrictEqual([
      'pac-insert',
      'pac-update',
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
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
  });

  it('renders the PAC-level obsolescence fixture with an older PAC timestamp in the second step while keeping the same PAC and proponente ids', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-update-obsoleto-nivel-pac',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_f',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(2);
    const insertData = fixture.steps[0]!.envelope[0]!.data as {
      id: string;
      dataalteracao: string;
      proponentes: Array<{ id: string; dataAlteracao: string }>;
    };
    const obsoleteUpdateData = fixture.steps[1]!.envelope[0]!.data as {
      id: string;
      dataalteracao: string;
      proponentes: Array<{ id: string; dataAlteracao: string }>;
    };

    expect(obsoleteUpdateData.id).toBe(insertData.id);
    expect(obsoleteUpdateData.proponentes).toHaveLength(1);
    expect(obsoleteUpdateData.proponentes[0]!.id).toBe(
      insertData.proponentes[0]!.id,
    );
    expect(Date.parse(obsoleteUpdateData.dataalteracao)).toBeLessThan(
      Date.parse(insertData.dataalteracao),
    );
  });

  it('publishes a READY PAC update scenario that rejects only the obsolete proponente while updating the newer sibling in the same payload', () => {
    const scenario = scenarioCatalog.get(
      'pac-update-obsoleto-nivel-proponente',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'pac-update-obsoleto-nivel-proponente',
      scope: 'EXTENDED',
      availability: 'READY',
      tags: expect.arrayContaining([
        'fase-7',
        'obsolescencia',
        'pac-update',
        'regression',
      ]),
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'CREATE_SYNTHETIC_ACCOUNT',
          role: 'PRIMARY',
        }),
        expect.objectContaining({
          operation: 'CREATE_SYNTHETIC_ACCOUNT',
          role: 'CONTROL',
        }),
      ]),
    );
    expect(scenario?.steps.map((step) => step.eventType)).toStrictEqual([
      'pac-insert',
      'pac-update',
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
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
  });

  it('renders the per-proponente obsolescence fixture with two principal proponentes and diverging dataAlteracao values in the second step', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'pac-update-obsoleto-nivel-proponente',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_g',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(2);
    const insertData = fixture.steps[0]!.envelope[0]!.data as {
      id: string;
      proponentes: Array<{
        id: string;
        idCliente: string;
        dataAlteracao: string;
      }>;
    };
    const updateData = fixture.steps[1]!.envelope[0]!.data as {
      id: string;
      proponentes: Array<{
        id: string;
        idCliente: string;
        dataAlteracao: string;
      }>;
    };

    expect(insertData.proponentes).toHaveLength(2);
    expect(updateData.proponentes).toHaveLength(2);
    expect(updateData.id).toBe(insertData.id);
    expect(updateData.proponentes[0]!.id).toBe(insertData.proponentes[0]!.id);
    expect(updateData.proponentes[1]!.id).toBe(insertData.proponentes[1]!.id);
    expect(updateData.proponentes[0]!.idCliente).toBe(
      fixture.identifiers.accountIdCliente,
    );
    expect(updateData.proponentes[1]!.idCliente).toBe(
      fixture.identifiers.controlAccountIdCliente,
    );
    expect(Date.parse(updateData.proponentes[0]!.dataAlteracao)).toBeLessThan(
      Date.parse(insertData.proponentes[0]!.dataAlteracao),
    );
    expect(
      Date.parse(updateData.proponentes[1]!.dataAlteracao),
    ).toBeGreaterThan(Date.parse(insertData.proponentes[1]!.dataAlteracao));
  });

  it('publishes a READY O08 PAC retest scenario with the PAC proponente targeting Y after the cliente flow leaves it empty', () => {
    const scenario = scenarioCatalog.get(
      'cpf-divergente-identidade-antiga-pac-aprovada',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'cpf-divergente-identidade-antiga-pac-aprovada',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.tags).toEqual(
      expect.arrayContaining([
        'regression',
        'fase-7',
        'o08',
        'retest-pac',
        'pos-pac',
      ]),
    );
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'CREATE_SYNTHETIC_ACCOUNT',
          role: 'CONTROL',
        }),
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_OPPORTUNITY' }),
      ]),
    );
    expect(scenario?.steps.map((step) => step.key)).toStrictEqual([
      'contato-email-x',
      'contato-celular-x',
      'cliente-insert-y',
      'pac-insert-aprovada-y',
    ]);
    expect(scenario?.steps[3]).toMatchObject({
      target: 'PAC',
      eventType: 'pac-insert',
    });
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'PAC_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
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
      ]),
    });
  });

  it('renders the O08 PAC retest fixture with the Opportunity anchored on X and the principal proponente anchored on Y', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'cpf-divergente-identidade-antiga-pac-aprovada',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_c',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'CREATE_SYNTHETIC_OPPORTUNITY',
          opportunity: expect.objectContaining({
            accountId: fixture.identifiers.controlAccountIdCliente,
          }),
        }),
      ]),
    );
    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'contato-email-x',
      'contato-celular-x',
      'cliente-insert-y',
      'pac-insert-aprovada-y',
    ]);
    expect(fixture.steps[3]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^PAC-SIM-/),
      idjornadapac: expect.stringMatching(/^OPP-SIM-/),
      status: 'CREDITO_APROVADO_CONDICIONADO',
      proponentes: [
        expect.objectContaining({
          idCliente: fixture.identifiers.accountIdCliente,
          cpf: expect.stringMatching(/^\d{11}$/),
          tipoClassificacao: 'Principal',
          email: expect.stringMatching(/^pac\..+@simulador\.mrv\.invalid$/),
          telefoneCelular: expect.stringMatching(/^\d{11}$/),
        }),
      ],
    });
    expect(fixture.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'ACCOUNT' }),
        expect.objectContaining({ target: 'LEAD' }),
        expect.objectContaining({ target: 'PROPONENTE' }),
        expect.objectContaining({ target: 'OPPORTUNITY' }),
      ]),
    );
  });
});
