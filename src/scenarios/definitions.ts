import type { ScenarioDefinition } from '../contracts/scenarios.ts';

type GeneratedValue =
  | 'EVENT_ID'
  | 'EVENT_TIME'
  | 'BASELINE_TIME'
  | 'CLIENT_ID'
  | 'PROSPECT_ID'
  | 'CPF'
  | 'PERSON_NAME'
  | 'BASE_PERSON_NAME';

const generated = <T extends GeneratedValue>(value: T) =>
  ({ source: 'GENERATED', value }) as const;

const variablesSchema: ScenarioDefinition['variablesSchema'] = {
  type: 'object',
  properties: {
    seed: {
      type: 'string',
      description: 'Semente técnica determinística da execução.',
      minLength: 1,
      maxLength: 64,
    },
    eventStartAt: {
      type: 'string',
      description: 'Instante UTC inicial dos eventos renderizados.',
      minLength: 20,
      maxLength: 24,
    },
  },
  required: ['seed', 'eventStartAt'],
  additionalProperties: false,
};

const deliveryPolicy: ScenarioDefinition['steps'][number]['deliveryPolicy'] = {
  duplicateCount: 0,
  retryOn: [],
  maxAttempts: 1,
};

const asyncPolicy: ScenarioDefinition['asyncPolicy'] = {
  expectedCallbacks: { min: 0, max: 0 },
  waitTimeoutMs: 0,
  missingCallbackResult: 'SUCCESS',
};

function clientPayload(
  eventType: 'cliente-insert' | 'cliente-update',
  includeProspect: boolean,
) {
  return {
    kind: 'DECLARATIVE',
    contract: 'EVENT_GRID',
    value: {
      id: generated('EVENT_ID'),
      subject: 'MS_Clientes',
      eventType,
      eventTime: generated('EVENT_TIME'),
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: generated('CLIENT_ID'),
        ...(includeProspect
          ? { idprospectsalesforce: generated('PROSPECT_ID') }
          : {}),
        numerocpf: generated('CPF'),
        dataalteracao: generated('EVENT_TIME'),
        nomecompleto: generated('PERSON_NAME'),
      },
    },
  } as const;
}

const cleanup: ScenarioDefinition['cleanup'] = [
  { operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' },
];

export const basicScenarioDefinitions = [
  {
    key: 'match-id-cliente',
    version: 1,
    name: 'Match por Id Cliente',
    description: 'Atualiza somente a Account encontrada pelo Id Cliente.',
    scope: 'CORE',
    tags: ['core', 'match', 'id-cliente'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
    ],
    steps: [
      {
        key: 'cliente-update',
        target: 'CLIENTE',
        eventType: 'cliente-update',
        delayMs: 0,
        payloadTemplate: clientPayload('cliente-update', true),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description: 'Somente a Account correta deve ser atualizada.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'NO_OTHER_ACCOUNT_UPDATED',
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'match-cpf-sem-id-cliente',
    version: 1,
    name: 'Match por CPF sem Id Cliente',
    description: 'Carimba o Id Cliente na Account sem criar duplicidade.',
    scope: 'CORE',
    tags: ['core', 'match', 'cpf'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        matchBy: 'CPF',
        account: {
          idCliente: null,
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
    ],
    steps: [
      {
        key: 'cliente-update',
        target: 'CLIENTE',
        eventType: 'cliente-update',
        delayMs: 1_000,
        payloadTemplate: clientPayload('cliente-update', true),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'CLIENT_ID_STAMPED_WITHOUT_DUPLICATE',
        description: 'O Id Cliente deve ser carimbado sem criar outra Account.',
        checks: [
          'ACCOUNT_COUNT_BY_CPF_IS_ONE',
          'ACCOUNT_CLIENT_ID_EQUALS_EVENT',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'no-match-cliente-insert',
    version: 1,
    name: 'Cliente insert sem match',
    description: 'Cria uma Person Account quando nenhuma Account é encontrada.',
    scope: 'CORE',
    tags: ['core', 'no-match', 'insert'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'ENSURE_ACCOUNT_ABSENT',
        keys: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'cliente-insert',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 2_000,
        payloadTemplate: clientPayload('cliente-insert', false),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description:
          'Cria a Person Account; sem flags de divergência ou vínculo, Lead e Proponente não são exigidos.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'LEAD_NOT_REQUIRED',
          'PROPONENTE_NOT_REQUIRED',
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'cliente-update-nova-estrutura',
    version: 1,
    name: 'Cliente update em nova estrutura',
    description:
      'Cria uma Person Account no update sem estrutura prévia, como o Apex atual.',
    scope: 'CORE',
    tags: ['core', 'update', 'nova-estrutura'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'ENSURE_ACCOUNT_ABSENT',
        keys: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'cliente-update',
        target: 'CLIENTE',
        eventType: 'cliente-update',
        delayMs: 3_000,
        payloadTemplate: clientPayload('cliente-update', false),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description:
          'Cliente update segue o mesmo upsert do insert; sem flags, não promete Lead ou Proponente.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'LEAD_NOT_REQUIRED',
          'PROPONENTE_NOT_REQUIRED',
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
] as const satisfies readonly ScenarioDefinition[];
