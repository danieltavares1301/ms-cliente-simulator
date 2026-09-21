import { describe, expect, it } from 'vitest';

import {
  eventGridEnvelopeSchema,
  renderedScenarioFixtureSchema,
} from '../contracts';
import { scanRenderedFixtureSecrets, scanSecrets } from '../redaction/scanner';
import { scenarioCatalog } from './catalog';
import { renderScenarioFixture } from './renderer';

const scenarioKeys = [
  'contato-antes-cliente-colisao',
  'cliente-insert-prospect-divergente',
  'match-id-cliente',
  'match-cpf-sem-id-cliente',
  'no-match-cliente-insert',
  'cliente-update-nova-estrutura',
] as const;

const expectedStepCountByScenario = {
  'contato-antes-cliente-colisao': 3,
  'cliente-insert-prospect-divergente': 1,
  'match-id-cliente': 1,
  'match-cpf-sem-id-cliente': 1,
  'no-match-cliente-insert': 1,
  'cliente-update-nova-estrutura': 1,
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
    'never emits data.id inside the Event Grid payload for %s',
    (scenarioKey) => {
      const fixture = renderScenarioFixture({ ...input, scenarioKey });

      for (const step of fixture.steps) {
        expect(step.envelope[0].data).not.toHaveProperty('id');
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
      for (const step of fixture.steps) {
        const expectedTime = new Date(
          Date.parse(input.eventStartAt) + step.delayMs,
        ).toISOString();

        expect(step.scheduledAt).toBe(expectedTime);
        expect(step.envelope[0].eventTime).toBe(expectedTime);
        expect(step.envelope[0].data.dataalteracao).toBe(expectedTime);
      }
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
    expect(contatoAntesCliente.identifiers.collisionLeadIdExterno).toBeDefined();
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
    expect(fixture.steps[0].envelope[0].data.idprospectsalesforce).toBe(
      fixture.identifiers.controlAccountIdProspect,
    );
  });

  it('renders the combined O01 + Regra 6.6 scenario with dynamic mobile expectation', () => {
    const fixture = renderScenarioFixture({
      ...input,
      scenarioKey: 'contato-antes-cliente-colisao',
    });

    expect(fixture.identifiers.collisionLeadIdExterno).toMatch(/^LEAD-SIM-/);
    expect(fixture.steps.map((step) => step.key)).toStrictEqual([
      'contato-email',
      'contato-celular',
      'cliente-insert-divergente',
    ]);
    expect(fixture.steps[0]?.eventType).toBe('contato-insert');
    expect(fixture.steps[1]?.eventType).toBe('contato-insert');
    expect(fixture.steps[2]?.eventType).toBe('cliente-insert');
    expect(fixture.steps[0]?.envelope[0].data).toMatchObject({
      idprospectsalesforce: fixture.identifiers.controlAccountIdProspect,
      tipocontato: 'Email',
      descricao: expect.stringContaining('@simulador.mrv.invalid'),
    });
    expect(fixture.steps[1]?.envelope[0].data).toMatchObject({
      tipocontato: 'Celular',
      descricao: expect.stringMatching(/^\d{11}$/),
    });
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
