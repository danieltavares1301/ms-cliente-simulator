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
});
