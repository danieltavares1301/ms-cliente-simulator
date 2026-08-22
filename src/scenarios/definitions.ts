import type { ScenarioDefinition } from '../contracts';

const variablesSchema: ScenarioDefinition['variablesSchema'] = {
  type: 'object',
  properties: {},
  required: [],
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

export const basicScenarioDefinitions = [
  {
    key: 'match-id-cliente',
    version: 1,
    name: 'Match por Id Cliente',
    description: 'Atualiza somente a Account encontrada pelo Id Cliente.',
    scope: 'CORE',
    tags: ['core', 'match', 'id-cliente'],
    availability: 'CONTRACT_ONLY',
    variablesSchema,
    setup: [{ operation: 'ENSURE_MATCHING_ACCOUNT' }],
    steps: [
      {
        key: 'cliente-update',
        target: 'CLIENTE',
        eventType: 'cliente-update',
        delayMs: 0,
        payloadTemplate: {
          kind: 'CONTRACT_ONLY',
          contract: 'EVENT_GRID',
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description: 'Somente a Account correta deve ser atualizada.',
      },
    ],
    asyncPolicy,
    cleanup: [{ operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' }],
  },
  {
    key: 'match-cpf-sem-id-cliente',
    version: 1,
    name: 'Match por CPF sem Id Cliente',
    description: 'Carimba o Id Cliente na Account sem criar duplicidade.',
    scope: 'CORE',
    tags: ['core', 'match', 'cpf'],
    availability: 'CONTRACT_ONLY',
    variablesSchema,
    setup: [{ operation: 'ENSURE_MATCHING_ACCOUNT' }],
    steps: [
      {
        key: 'cliente-update',
        target: 'CLIENTE',
        eventType: 'cliente-update',
        delayMs: 0,
        payloadTemplate: {
          kind: 'CONTRACT_ONLY',
          contract: 'EVENT_GRID',
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'CLIENT_ID_STAMPED_WITHOUT_DUPLICATE',
        description: 'O Id Cliente deve ser carimbado sem criar outra Account.',
      },
    ],
    asyncPolicy,
    cleanup: [{ operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' }],
  },
  {
    key: 'no-match-cliente-insert',
    version: 1,
    name: 'Cliente insert sem match',
    description: 'Cria uma Person Account quando nenhuma Account é encontrada.',
    scope: 'CORE',
    tags: ['core', 'no-match', 'insert'],
    availability: 'CONTRACT_ONLY',
    variablesSchema,
    setup: [{ operation: 'ENSURE_NO_MATCHING_ACCOUNT' }],
    steps: [
      {
        key: 'cliente-insert',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 0,
        payloadTemplate: {
          kind: 'CONTRACT_ONLY',
          contract: 'EVENT_GRID',
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description: 'Uma nova Person Account deve ser criada.',
      },
    ],
    asyncPolicy,
    cleanup: [{ operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' }],
  },
  {
    key: 'cliente-update-nova-estrutura',
    version: 1,
    name: 'Cliente update em nova estrutura',
    description: 'Cria ou completa a estrutura esperada para o cliente.',
    scope: 'CORE',
    tags: ['core', 'update', 'nova-estrutura'],
    availability: 'CONTRACT_ONLY',
    variablesSchema,
    setup: [{ operation: 'ENSURE_CLIENT_STRUCTURE_ABSENT' }],
    steps: [
      {
        key: 'cliente-update',
        target: 'CLIENTE',
        eventType: 'cliente-update',
        delayMs: 0,
        payloadTemplate: {
          kind: 'CONTRACT_ONLY',
          contract: 'EVENT_GRID',
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'CLIENT_STRUCTURE_CREATED_OR_COMPLETED',
        description: 'A estrutura esperada deve ser criada ou completada.',
      },
    ],
    asyncPolicy,
    cleanup: [
      { operation: 'DELETE_OWNED_RECORDS', target: 'CLIENT_STRUCTURE' },
    ],
  },
] as const satisfies readonly ScenarioDefinition[];
