import { describe, expect, it } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

describe('MaquinaEstado scenario definitions', () => {
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
      idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
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

  it('publishes a READY negative scenario for jornadausuario-insert sem Account prévia', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-insert-sem-cliente-falha',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-insert-sem-cliente-falha',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'ENSURE_ACCOUNT_ABSENT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        expectedHttpStatus: 400,
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'EVENT_REJECTED_WITHOUT_DML',
      checks: expect.arrayContaining([
        'OPPORTUNITY_NOT_CREATED',
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 0,
        },
      ]),
    });
  });

  it('publishes a READY recovery scenario for jornadausuario-insert após Account prévia', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-insert-apos-cliente-criado',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-insert-apos-cliente-criado',
      scope: 'EXTENDED',
      availability: 'READY',
    });
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

  it('renders the negative fixture with cliente.idCliente nulo and expected HTTP 400', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'maquina-estado-insert-sem-cliente-falha',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_maquina_b',
      eventStartAt: '2026-09-22T00:05:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(fixture.steps[0]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-insert',
      expectedHttpStatus: 400,
    });
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: null,
        idProspectSalesforce: fixture.identifiers.accountIdProspect,
      },
      id: expect.stringMatching(/^OPP-SIM-/),
      estado: 'SIMULACAO',
      idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
    });
    expect(fixture.cleanup).toEqual([
      expect.objectContaining({
        operation: 'DELETE_OWNED_RECORDS',
        target: 'OPPORTUNITY',
        ownership: {
          idExterno: expect.stringMatching(/^OPP-SIM-/),
        },
      }),
    ]);
  });

  it('publishes a READY update scenario that transitions the existing Opportunity to Documentação', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-update-transicao-estado',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-update-transicao-estado',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
      }),
      expect.objectContaining({
        key: 'maquina-estado-update-documentacao',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE',
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Qualificação de Documentos',
        },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 1,
        },
      ]),
    });
  });

  it('renders the update fixture reusing the same Opportunity external id across insert and update', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'maquina-estado-update-transicao-estado',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_maquina_update_a',
      eventStartAt: '2026-09-22T00:10:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(2);
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(eventGridEnvelopeSchema.parse(fixture.steps[1]!.envelope)).toEqual(
      fixture.steps[1]!.envelope,
    );
    expect(fixture.steps[0]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-insert',
    });
    expect(fixture.steps[1]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-update',
      delayMs: 3_000,
    });
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: fixture.identifiers.accountIdCliente,
        idProspectSalesforce: fixture.identifiers.accountIdProspect,
      },
      id: expect.stringMatching(/^OPP-SIM-/),
      estado: 'SIMULACAO',
      idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
    });
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      cliente: {
        idCliente: fixture.identifiers.accountIdCliente,
        idProspectSalesforce: fixture.identifiers.accountIdProspect,
      },
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'Documentacao',
      idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
    });
  });

  it('publishes a READY update scenario that preserves the current stage when estado is not recognized', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-update-estado-nao-reconhecido',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-update-estado-nao-reconhecido',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
      }),
      expect.objectContaining({
        key: 'maquina-estado-update-documentacao',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
      }),
      expect.objectContaining({
        key: 'maquina-estado-update-estado-nao-reconhecido',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 6_000,
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE',
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Qualificação de Documentos',
        },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 1,
        },
      ]),
    });
  });

  it('renders the unrecognized estado fixture keeping the same Opportunity id and a newer no-op update', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'maquina-estado-update-estado-nao-reconhecido',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_maquina_update_d',
      eventStartAt: '2026-09-22T00:25:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(3);
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(eventGridEnvelopeSchema.parse(fixture.steps[1]!.envelope)).toEqual(
      fixture.steps[1]!.envelope,
    );
    expect(eventGridEnvelopeSchema.parse(fixture.steps[2]!.envelope)).toEqual(
      fixture.steps[2]!.envelope,
    );
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^OPP-SIM-/),
      estado: 'SIMULACAO',
    });
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'Documentacao',
    });
    expect(fixture.steps[2]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-update',
      delayMs: 6_000,
    });
    expect(fixture.steps[2]!.envelope[0]!.data).toMatchObject({
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'SP',
      dataalteracao: fixture.steps[2]!.envelope[0]!.eventTime,
    });
    expect(Date.parse(fixture.steps[2]!.envelope[0]!.eventTime)).toBeGreaterThan(
      Date.parse(fixture.steps[1]!.envelope[0]!.eventTime),
    );
  });

  it('publishes a READY obsolete update scenario that silently keeps the newer Opportunity stage', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-update-evento-obsoleto',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-update-evento-obsoleto',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
      }),
      expect.objectContaining({
        key: 'maquina-estado-update-documentacao-atual',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
      }),
      expect.objectContaining({
        key: 'maquina-estado-update-contrato-obsoleto',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 6_000,
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE',
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Qualificação de Documentos',
        },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 1,
        },
      ]),
    });
  });

  it('renders the obsolete update fixture with a physically later but logically older final event', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'maquina-estado-update-evento-obsoleto',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_maquina_update_c',
      eventStartAt: '2026-09-22T00:20:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(3);
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(eventGridEnvelopeSchema.parse(fixture.steps[1]!.envelope)).toEqual(
      fixture.steps[1]!.envelope,
    );
    expect(eventGridEnvelopeSchema.parse(fixture.steps[2]!.envelope)).toEqual(
      fixture.steps[2]!.envelope,
    );
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^OPP-SIM-/),
      estado: 'SIMULACAO',
      dataalteracao: '2026-09-22T00:19:59.000Z',
    });
    expect(fixture.steps[0]!.envelope[0]!.eventTime).toBe(
      '2026-09-22T00:19:59.000Z',
    );
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'Documentacao',
      dataalteracao: '2026-09-22T00:20:03.000Z',
    });
    expect(fixture.steps[1]!.envelope[0]!.eventTime).toBe(
      '2026-09-22T00:20:03.000Z',
    );
    expect(fixture.steps[2]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-update',
      delayMs: 6_000,
    });
    expect(fixture.steps[2]!.envelope[0]!.data).toMatchObject({
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'CONTRATO',
      dataalteracao: '2026-09-22T00:20:00.000Z',
    });
    expect(fixture.steps[2]!.envelope[0]!.eventTime).toBe(
      '2026-09-22T00:20:00.000Z',
    );
    expect(Date.parse(fixture.steps[2]!.scheduledAt)).toBeGreaterThan(
      Date.parse(fixture.steps[1]!.scheduledAt),
    );
    expect(Date.parse(fixture.steps[2]!.envelope[0]!.eventTime)).toBeLessThan(
      Date.parse(fixture.steps[1]!.envelope[0]!.eventTime),
    );
  });

  it('publishes a READY update redelivery scenario for the same Event Grid envelope', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-update-reentrega-mesmo-evento',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-update-reentrega-mesmo-evento',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'CREATE_SYNTHETIC_ACCOUNT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
      }),
      expect.objectContaining({
        key: 'maquina-estado-update-documentacao-reentrega',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        deliveryPolicy: expect.objectContaining({ duplicateCount: 1 }),
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'OPPORTUNITY_CREATED_AND_LINKED',
      checks: expect.arrayContaining([
        'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE',
        'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
        {
          check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
          value: 'Qualificação de Documentos',
        },
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 1,
        },
      ]),
    });
  });

  it('renders the redelivery fixture reusing the same Opportunity id and marking the update for duplicate dispatch', () => {
    const fixture = renderScenarioFixture({
      scenarioKey: 'maquina-estado-update-reentrega-mesmo-evento',
      version: 1,
      seed: 'phase-seven-seed',
      runId: 'run_phase_seven_maquina_update_b',
      eventStartAt: '2026-09-22T00:15:00.000Z',
    });

    expect(() => renderedScenarioFixtureSchema.parse(fixture)).not.toThrow();
    expect(fixture.steps).toHaveLength(2);
    expect(eventGridEnvelopeSchema.parse(fixture.steps[0]!.envelope)).toEqual(
      fixture.steps[0]!.envelope,
    );
    expect(eventGridEnvelopeSchema.parse(fixture.steps[1]!.envelope)).toEqual(
      fixture.steps[1]!.envelope,
    );
    expect(fixture.steps[1]).toMatchObject({
      target: 'MAQUINA_ESTADO',
      eventType: 'jornadausuario-update',
      delayMs: 3_000,
      deliveryPolicy: {
        duplicateCount: 1,
        retryOn: [],
        maxAttempts: 1,
      },
    });
    expect(fixture.steps[0]!.envelope[0]!.data).toMatchObject({
      id: expect.stringMatching(/^OPP-SIM-/),
      estado: 'SIMULACAO',
    });
    expect(fixture.steps[1]!.envelope[0]!.data).toMatchObject({
      id: fixture.steps[0]!.envelope[0]!.data.id,
      estado: 'Documentacao',
      dataalteracao: fixture.steps[1]!.envelope[0]!.eventTime,
    });
  });

  it('publishes a READY negative update scenario without Account prévia', () => {
    const scenario = scenarioCatalog.get(
      'maquina-estado-update-sem-cliente-falha',
      1,
    );

    expect(scenario).toMatchObject({
      key: 'maquina-estado-update-sem-cliente-falha',
      scope: 'EXTENDED',
      availability: 'READY',
    });
    expect(scenario?.setup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'ENSURE_ACCOUNT_ABSENT' }),
      ]),
    );
    expect(scenario?.steps).toEqual([
      expect.objectContaining({
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        expectedHttpStatus: 400,
      }),
    ]);
    expect(scenario?.expectedOutcomes[0]).toMatchObject({
      result: 'EVENT_REJECTED_WITHOUT_DML',
      checks: expect.arrayContaining([
        'OPPORTUNITY_NOT_CREATED',
        {
          check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
          value: 0,
        },
      ]),
    });
  });
});
