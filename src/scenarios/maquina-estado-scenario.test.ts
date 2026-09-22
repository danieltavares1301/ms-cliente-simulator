import { describe, expect, it } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

describe('MaquinaEstado smoke scenario definition', () => {
  it('publishes a READY maquina-estado-insert-minimo smoke scenario', () => {
    const scenario = scenarioCatalog.get('maquina-estado-insert-minimo', 1);

    expect(scenario).toMatchObject({
      key: 'maquina-estado-insert-minimo',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.tags).toEqual(
      expect.arrayContaining([
        'regression',
        'fase-7',
        'maquina-estado',
        'smoke',
      ]),
    );
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE',
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

  it('renders a MaquinaEstado fixture with a synthetic Account and cleanup ownership', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'maquina-estado-insert-minimo',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_maquina_a',
      eventStartAt: '2026-09-22T00:00:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(fixture.steps[0]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-insert',
    });
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: fixture.identifiers.accountIdCliente,
        idProspectSalesforce: fixture.identifiers.accountIdProspect,
      },
      id: expect.stringMatching(/^OPP-SIM-/),
      estado: 'SIMULACAO',
      idunidade: '7d9261ee-c2b8-f011-8df6-80c16e075108',
    });
    expect(fixture.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'DELETE_OWNED_RECORDS',
          target: 'OPPORTUNITY',
          ownership: {
            idExterno: expect.stringMatching(/^OPP-SIM-/),
          },
        }),
        expect.objectContaining({
          operation: 'DELETE_OWNED_RECORDS',
          target: 'ACCOUNT',
          ownership: {
            idCliente: fixture.identifiers.accountIdCliente,
          },
        }),
      ]),
    );
  });
});
