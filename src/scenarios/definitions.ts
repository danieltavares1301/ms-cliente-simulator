import type { ScenarioDefinition } from '../contracts/scenarios.ts';

type GeneratedValue =
  | 'EVENT_ID'
  | 'EVENT_TIME'
  | 'PINNED_EVENT_TIME'
  | 'BASELINE_TIME'
  | 'EARLIER_TIME'
  | 'CLIENT_ID'
  | 'CLIENT_ID_X'
  | 'PROSPECT_ID'
  | 'PROSPECT_ID_X'
  | 'CPF'
  | 'CPF_X'
  | 'PERSON_NAME'
  | 'BASE_PERSON_NAME'
  | 'COLLISION_LEAD_ID_EXTERNO'
  | 'COLLISION_CPF'
  | 'COLLISION_EMAIL'
  | 'CLEAN_CELULAR'
  | 'SYNTHETIC_EMAIL'
  | 'SYNTHETIC_STREET'
  | 'OPPORTUNITY_EXTERNAL_ID'
  | 'PAC_EXTERNAL_ID';

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

const graphqlCallbackAsyncPolicy: ScenarioDefinition['asyncPolicy'] = {
  expectedCallbacks: { min: 1, max: 1 },
  waitTimeoutMs: 30_000,
  missingCallbackResult: 'PARTIAL',
};

function clientPayload(
  eventType: 'cliente-insert' | 'cliente-update',
  includeProspect: boolean,
  options: {
    cpf?: ReturnType<typeof generated>;
    dataAlteracao?: ReturnType<typeof generated>;
    eventTime?: ReturnType<typeof generated>;
    personName?: ReturnType<typeof generated>;
  } = {},
) {
  const {
    cpf = generated('CPF'),
    dataAlteracao = generated('EVENT_TIME'),
    eventTime = generated('EVENT_TIME'),
    personName = generated('PERSON_NAME'),
  } = options;
  return {
    kind: 'DECLARATIVE',
    contract: 'EVENT_GRID',
    value: {
      id: generated('EVENT_ID'),
      subject: 'MS_Clientes',
      eventType,
      eventTime,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: generated('CLIENT_ID'),
        ...(includeProspect
          ? { idprospectsalesforce: generated('PROSPECT_ID') }
          : {}),
        numerocpf: cpf,
        dataalteracao: dataAlteracao,
        nomecompleto: personName,
      },
    },
  } as const;
}

function contatoPayload(
  tipoContato: 'Email' | 'Celular',
  descricao: ReturnType<typeof generated>,
  includeProspect: boolean,
  idCliente: ReturnType<typeof generated> = generated('CLIENT_ID'),
  options: {
    dataAlteracao?: ReturnType<typeof generated>;
    eventTime?: ReturnType<typeof generated>;
  } = {},
) {
  const {
    dataAlteracao = generated('EVENT_TIME'),
    eventTime = generated('EVENT_TIME'),
  } = options;
  return {
    kind: 'DECLARATIVE',
    contract: 'EVENT_GRID',
    value: {
      id: generated('EVENT_ID'),
      subject: 'MS_Clientes',
      eventType: 'contato-insert',
      eventTime,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: idCliente,
        ...(includeProspect
          ? { idprospectsalesforce: generated('PROSPECT_ID_X') }
          : {}),
        tipocontato: tipoContato,
        descricao,
        dataalteracao: dataAlteracao,
      },
    },
  } as const;
}

function enderecoPayload(
  descricaoLogradouro: ReturnType<typeof generated>,
  includeProspect: boolean,
  options: {
    dataAlteracao?: ReturnType<typeof generated>;
    eventTime?: ReturnType<typeof generated>;
  } = {},
) {
  const {
    dataAlteracao = generated('EVENT_TIME'),
    eventTime = generated('EVENT_TIME'),
  } = options;

  return {
    kind: 'DECLARATIVE',
    contract: 'EVENT_GRID',
    value: {
      id: generated('EVENT_ID'),
      subject: 'MS_Clientes',
      eventType: 'endereco-insert',
      eventTime,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: generated('CLIENT_ID'),
        ...(includeProspect
          ? { idprospectsalesforce: generated('PROSPECT_ID') }
          : {}),
        tipoendereco: 'COBRANCA',
        logradouro: descricaoLogradouro,
        numerocep: '30140071',
        bairro: 'Funcionarios',
        numero: '100',
        dataalteracao: dataAlteracao,
      },
    },
  } as const;
}

function pacPayload(eventType: 'pac-insert' | 'pac-update') {
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
        id: generated('PAC_EXTERNAL_ID'),
        idjornadapac: generated('OPPORTUNITY_EXTERNAL_ID'),
        status: 'EM_ANALISE_CREDITO',
        dataalteracao: generated('EVENT_TIME'),
      },
    },
  } as const;
}

const cleanup: ScenarioDefinition['cleanup'] = [
  { operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' },
];

const cleanupWithLead: ScenarioDefinition['cleanup'] = [
  { operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'LEAD' },
];

const cleanupWithOpportunity: ScenarioDefinition['cleanup'] = [
  { operation: 'DELETE_OWNED_RECORDS', target: 'OPPORTUNITY' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' },
];

function prospectDivergenteSetup(): NonNullable<ScenarioDefinition['setup']> {
  return [
    {
      operation: 'CREATE_SYNTHETIC_ACCOUNT',
      role: 'CONTROL',
      matchBy: 'ID_CLIENTE',
      account: {
        idCliente: generated('CLIENT_ID_X'),
        idProspect: generated('PROSPECT_ID_X'),
        cpf: generated('CPF_X'),
        name: generated('BASE_PERSON_NAME'),
        dataAlteracao: generated('BASELINE_TIME'),
      },
    },
    {
      operation: 'ENSURE_ACCOUNT_ABSENT',
      keys: {
        idCliente: generated('CLIENT_ID'),
        idProspect: generated('PROSPECT_ID'),
        cpf: generated('CPF'),
      },
    },
    {
      operation: 'ENSURE_LEAD_ABSENT',
      keys: {
        idExterno: generated('PROSPECT_ID_X'),
        cpf: generated('CPF'),
      },
    },
  ];
}

function prospectDivergenteSteps(): ScenarioDefinition['steps'] {
  return [
    {
      key: 'cliente-insert-divergente',
      target: 'CLIENTE',
      eventType: 'cliente-insert',
      delayMs: 0,
      payloadTemplate: {
        kind: 'DECLARATIVE',
        contract: 'EVENT_GRID',
        value: {
          id: generated('EVENT_ID'),
          subject: 'MS_Clientes',
          eventType: 'cliente-insert',
          eventTime: generated('EVENT_TIME'),
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: generated('CLIENT_ID'),
            idprospectsalesforce: generated('PROSPECT_ID_X'),
            numerocpf: generated('CPF'),
            dataalteracao: generated('EVENT_TIME'),
            nomecompleto: generated('PERSON_NAME'),
          },
        },
      },
      deliveryPolicy,
    },
  ];
}

function prospectDivergenteExpectedOutcomes(): ScenarioDefinition['expectedOutcomes'] {
  return [
    {
      kind: 'BUSINESS_RESULT',
      result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
      description:
        'A Account Y ? criada sem herdar o prospect da conta X, um Lead novo ? criado pelo CPF de Y e a Account de controle permanece intacta.',
      checks: [
        'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
        'ACCOUNT_IS_PERSON_ACCOUNT',
        'ACCOUNT_NAME_EQUALS_EVENT',
        'ACCOUNT_CPF_EQUALS_EVENT',
        'CONTROL_ACCOUNT_UNCHANGED',
        'LEAD_COUNT_BY_CPF_IS_ONE',
        'LEAD_CPF_EQUALS_EVENT',
      ],
    },
  ];
}

function createProspectDivergenteGraphqlScenario(input: {
  key: string;
  name: string;
  description: string;
  graphqlResponse: NonNullable<ScenarioDefinition['graphqlResponse']>;
}): ScenarioDefinition {
  return {
    key: input.key,
    version: 1,
    name: input.name,
    description: input.description,
    scope: 'EXTENDED',
    tags: ['regression', 'prospect-divergente', 'lead', 'pos-pac', 'graphql'],
    availability: 'READY',
    variablesSchema,
    setup: prospectDivergenteSetup(),
    steps: prospectDivergenteSteps(),
    expectedOutcomes: prospectDivergenteExpectedOutcomes(),
    asyncPolicy: graphqlCallbackAsyncPolicy,
    graphqlResponse: input.graphqlResponse,
    cleanup: cleanupWithLead,
  };
}

export const basicScenarioDefinitions = [
  {
    key: 'contato-antes-cliente-colisao',
    version: 1,
    name: 'Contato após cliente divergente com colisão parcial',
    description:
      'Cliente-insert cria a Account Y com prospect divergente e dispara a criação assíncrona do Lead; os contatos que chegam logo em seguida (padrão O02) são reconciliados no Lead, respeitando a colisão de e-mail (Regra 6.6) e preservando o celular limpo.',
    scope: 'EXTENDED',
    tags: ['regression', 'o02', 'regra-6-6', 'lead', 'colisao'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'CONTROL',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID_X'),
          idProspect: generated('PROSPECT_ID_X'),
          cpf: generated('CPF_X'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
      {
        operation: 'ENSURE_ACCOUNT_ABSENT',
        keys: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
      {
        operation: 'CREATE_SYNTHETIC_LEAD',
        role: 'COLLISION',
        lead: {
          idExterno: generated('COLLISION_LEAD_ID_EXTERNO'),
          cpf: generated('COLLISION_CPF'),
          lastName: 'Terceiro Colidente',
          email: generated('COLLISION_EMAIL'),
          status: 'Pendente de Distribuição',
        },
      },
      {
        operation: 'ENSURE_LEAD_ABSENT',
        keys: {
          idExterno: generated('PROSPECT_ID_X'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'cliente-insert-divergente',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 0,
        payloadTemplate: {
          kind: 'DECLARATIVE',
          contract: 'EVENT_GRID',
          value: {
            id: generated('EVENT_ID'),
            subject: 'MS_Clientes',
            eventType: 'cliente-insert',
            eventTime: generated('EVENT_TIME'),
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              idcliente: generated('CLIENT_ID'),
              idprospectsalesforce: generated('PROSPECT_ID_X'),
              numerocpf: generated('CPF'),
              dataalteracao: generated('EVENT_TIME'),
              nomecompleto: generated('PERSON_NAME'),
            },
          },
        },
        deliveryPolicy,
      },
      {
        key: 'contato-email',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 3_000,
        payloadTemplate: contatoPayload(
          'Email',
          generated('COLLISION_EMAIL'),
          false,
        ),
        deliveryPolicy,
      },
      {
        key: 'contato-celular',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 5_000,
        payloadTemplate: contatoPayload(
          'Celular',
          generated('CLEAN_CELULAR'),
          false,
        ),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
        description:
          'A sequência O02 + Regra 6.6: cliente-insert cria a Account Y (sem herdar o prospect de X) e dispara a criação assíncrona do Lead; os contatos que chegam logo em seguida atualizam a Account e são reconciliados no Lead, respeitando a colisão de e-mail com outro Lead (Regra 6.6) e preservando o celular limpo. A Account X permanece intacta.',
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
            value: generated('CLEAN_CELULAR'),
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithLead,
  },
  {
    key: 'ordem-mesmo-eventtime-cliente-primeiro',
    version: 1,
    name: 'Mesmo eventTime com cliente primeiro',
    description:
      'Executa O03 com cliente, contatos e endereco compartilhando o mesmo eventTime logico, enquanto o dispatch fisico ocorre em instantes diferentes com cliente primeiro.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'o03',
      'mesmo-eventtime',
      'cliente-primeiro',
    ],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'PRIMARY',
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
        key: 'cliente-insert',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 0,
        payloadTemplate: clientPayload('cliente-insert', false, {
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
      {
        key: 'contato-email',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 1_000,
        payloadTemplate: contatoPayload(
          'Email',
          generated('SYNTHETIC_EMAIL'),
          false,
          generated('CLIENT_ID'),
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
      {
        key: 'contato-celular',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 2_000,
        payloadTemplate: contatoPayload(
          'Celular',
          generated('CLEAN_CELULAR'),
          false,
          generated('CLIENT_ID'),
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
      {
        key: 'endereco-insert',
        target: 'CLIENTE',
        eventType: 'endereco-insert',
        delayMs: 3_000,
        payloadTemplate: enderecoPayload(
          generated('SYNTHETIC_STREET'),
          false,
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'Com o mesmo eventTime logico, a Account final deve convergir para os campos do cliente, contato e endereco sem depender da ordem fisica do dispatch.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          {
            check: 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_STREET'),
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'ordem-mesmo-eventtime-contato-primeiro',
    version: 1,
    name: 'Mesmo eventTime com contato primeiro',
    description:
      'Executa O03 com contato-email primeiro, preservando o mesmo eventTime logico nos quatro eventos e mudando apenas a ordem fisica do dispatch.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'o03',
      'mesmo-eventtime',
      'contato-primeiro',
    ],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'PRIMARY',
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
        key: 'contato-email',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 0,
        payloadTemplate: contatoPayload(
          'Email',
          generated('SYNTHETIC_EMAIL'),
          false,
          generated('CLIENT_ID'),
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
      {
        key: 'cliente-insert',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 1_000,
        payloadTemplate: clientPayload('cliente-insert', false, {
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
      {
        key: 'endereco-insert',
        target: 'CLIENTE',
        eventType: 'endereco-insert',
        delayMs: 2_000,
        payloadTemplate: enderecoPayload(
          generated('SYNTHETIC_STREET'),
          false,
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
      {
        key: 'contato-celular',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 3_000,
        payloadTemplate: contatoPayload(
          'Celular',
          generated('CLEAN_CELULAR'),
          false,
          generated('CLIENT_ID'),
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'Mesmo com contato-email chegando primeiro, a Account final deve convergir para email, celular, logradouro, nome e CPF quando todos os eventos compartilham o mesmo eventTime logico.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          {
            check: 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_STREET'),
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'ordem-mesmo-eventtime-endereco-primeiro',
    version: 1,
    name: 'Mesmo eventTime com endereco primeiro',
    description:
      'Executa O03 com endereco primeiro e os demais eventos em ordem fisica diferente, mantendo o mesmo eventTime logico em toda a permutacao.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'o03',
      'mesmo-eventtime',
      'endereco-primeiro',
    ],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'PRIMARY',
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
        key: 'endereco-insert',
        target: 'CLIENTE',
        eventType: 'endereco-insert',
        delayMs: 0,
        payloadTemplate: enderecoPayload(
          generated('SYNTHETIC_STREET'),
          false,
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
      {
        key: 'contato-celular',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 1_000,
        payloadTemplate: contatoPayload(
          'Celular',
          generated('CLEAN_CELULAR'),
          false,
          generated('CLIENT_ID'),
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
      {
        key: 'cliente-insert',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 2_000,
        payloadTemplate: clientPayload('cliente-insert', false, {
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
      {
        key: 'contato-email',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 3_000,
        payloadTemplate: contatoPayload(
          'Email',
          generated('SYNTHETIC_EMAIL'),
          false,
          generated('CLIENT_ID'),
          {
            dataAlteracao: generated('PINNED_EVENT_TIME'),
            eventTime: generated('PINNED_EVENT_TIME'),
          },
        ),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'Mesmo com endereco primeiro, a Account final deve convergir para o mesmo estado canônico quando todos os eventos compartilham o mesmo eventTime logico.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          {
            check: 'ACCOUNT_BILLING_STREET_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_STREET'),
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'cliente-insert-prospect-divergente',
    version: 1,
    name: 'Cliente insert com prospect divergente',
    description:
      'Cria uma nova Person Account, preserva a conta dona do prospect divergente e aguarda o callback GraphQL.',
    scope: 'EXTENDED',
    tags: ['regression', 'prospect-divergente', 'lead', 'pos-pac'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'CONTROL',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID_X'),
          idProspect: generated('PROSPECT_ID_X'),
          cpf: generated('CPF_X'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
      {
        operation: 'ENSURE_ACCOUNT_ABSENT',
        keys: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
      {
        operation: 'ENSURE_LEAD_ABSENT',
        keys: {
          idExterno: generated('PROSPECT_ID_X'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'cliente-insert-divergente',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 0,
        payloadTemplate: {
          kind: 'DECLARATIVE',
          contract: 'EVENT_GRID',
          value: {
            id: generated('EVENT_ID'),
            subject: 'MS_Clientes',
            eventType: 'cliente-insert',
            eventTime: generated('EVENT_TIME'),
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              idcliente: generated('CLIENT_ID'),
              idprospectsalesforce: generated('PROSPECT_ID_X'),
              numerocpf: generated('CPF'),
              dataalteracao: generated('EVENT_TIME'),
              nomecompleto: generated('PERSON_NAME'),
            },
          },
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
        description:
          'A Account Y é criada sem herdar o prospect da conta X, um Lead novo é criado pelo CPF de Y e a Account de controle permanece intacta.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'CONTROL_ACCOUNT_UNCHANGED',
          'LEAD_COUNT_BY_CPF_IS_ONE',
          'LEAD_CPF_EQUALS_EVENT',
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithLead,
  },
  createProspectDivergenteGraphqlScenario({
    key: 'graphql-erro-500',
    name: 'Cliente insert com callback GraphQL HTTP 500',
    description:
      'Reexecuta o fluxo de prospect divergente, mas for?a o callback GraphQL do Apex a receber HTTP 500 para comprovar o comportamento real do v?nculo local e do status final do run.',
    graphqlResponse: { policy: 'HTTP_500' },
  }),
  createProspectDivergenteGraphqlScenario({
    key: 'graphql-resposta-invalida',
    name: 'Cliente insert com callback GraphQL inv?lido',
    description:
      'Reexecuta o fluxo de prospect divergente, mas responde com JSON inv?lido para medir a rea??o atual do Apex e do orquestrador ao callback ass?ncrono quebrado.',
    graphqlResponse: { policy: 'INVALID_JSON_200' },
  }),
  createProspectDivergenteGraphqlScenario({
    key: 'graphql-timeout',
    name: 'Cliente insert com callback GraphQL atrasado',
    description:
      'Reexecuta o fluxo de prospect divergente com atraso deliberado no callback GraphQL para simular o timeout ass?ncrono observado no Apex sem exceder o or?amento do runtime local.',
    graphqlResponse: {
      policy: 'DELAYED_RESPONSE',
      delayMs: 8_000,
    },
  }),
  {
    key: 'id-prospect-igual-id-cliente',
    version: 1,
    name: 'Cliente insert com echo de prospect igual ao cliente',
    description:
      'Publica um cliente-insert cujo identificador de prospect replica o identificador do cliente para comprovar que o Apex cria a Person Account, mas n?o carimba esse eco inv?lido no campo final de prospect.',
    scope: 'EXTENDED',
    tags: ['regression', 'prospect', 'echo', 'id-cliente'],
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
        delayMs: 0,
        payloadTemplate: {
          kind: 'DECLARATIVE',
          contract: 'EVENT_GRID',
          value: {
            id: generated('EVENT_ID'),
            subject: 'MS_Clientes',
            eventType: 'cliente-insert',
            eventTime: generated('EVENT_TIME'),
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              idcliente: generated('CLIENT_ID'),
              idprospectsalesforce: generated('CLIENT_ID'),
              numerocpf: generated('CPF'),
              dataalteracao: generated('EVENT_TIME'),
              nomecompleto: generated('PERSON_NAME'),
            },
          },
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED',
        description:
          'A Person Account nasce com os dados do evento, mas o Apex n?o deve gravar o valor ecoado quando o identificador de prospect repete o Id Cliente.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'ACCOUNT_PROSPECT_ID_NOT_STAMPED',
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
  {
    key: 'cpf-divergente-contato-primeiro',
    version: 1,
    name: 'CPF divergente com contato antes do cliente',
    description:
      'Perfil O01 genuíno validado contra mrv-devDan: os dois contatos divergentes chegam primeiro com a identidade nova Y e o prospect PROS-X da conta de controle, são descartados sem DML e o cliente-insert final cria a estrutura Y com Lead novo sem contatos.',
    scope: 'EXTENDED',
    tags: ['o01', 'parciais-antes', 'lead', 'pos-pac', 'prospect-divergente'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'CONTROL',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID_X'),
          idProspect: generated('PROSPECT_ID_X'),
          cpf: generated('CPF_X'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
      {
        operation: 'ENSURE_ACCOUNT_ABSENT',
        keys: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
      {
        operation: 'ENSURE_LEAD_ABSENT',
        keys: {
          idExterno: generated('PROSPECT_ID_X'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'contato-email',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 0,
        payloadTemplate: contatoPayload(
          'Email',
          generated('COLLISION_EMAIL'),
          true,
        ),
        deliveryPolicy,
      },
      {
        key: 'contato-celular',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 1_000,
        payloadTemplate: contatoPayload(
          'Celular',
          generated('CLEAN_CELULAR'),
          true,
        ),
        deliveryPolicy,
      },
      {
        key: 'cliente-insert-final',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 2_000,
        payloadTemplate: {
          kind: 'DECLARATIVE',
          contract: 'EVENT_GRID',
          value: {
            id: generated('EVENT_ID'),
            subject: 'MS_Clientes',
            eventType: 'cliente-insert',
            eventTime: generated('EVENT_TIME'),
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              idcliente: generated('CLIENT_ID'),
              idprospectsalesforce: generated('PROSPECT_ID_X'),
              numerocpf: generated('CPF'),
              dataalteracao: generated('EVENT_TIME'),
              nomecompleto: generated('PERSON_NAME'),
            },
          },
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
        description:
          'Resultado observado em execução real: os contatos antecipados com PROS-X não contaminam X nem sobrevivem em Y; o cliente-insert final preserva X intacta, cria a Person Account Y e cria um Lead novo sem contatos.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'CONTROL_ACCOUNT_UNCHANGED',
          'LEAD_COUNT_BY_CPF_IS_ONE',
          'LEAD_CPF_EQUALS_EVENT',
          'LEAD_EMAIL_EXCLUDED',
          'LEAD_MOBILE_EXCLUDED',
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithLead,
  },
  {
    key: 'cpf-divergente-identidade-antiga',
    version: 1,
    name: 'CPF divergente com identidade antiga nos contatos',
    description:
      'Perfil O08 validado contra mrv-devDan: os dois contatos com a identidade antiga X (IDCLI-X/PROS-X) atualizam a própria conta de controle X; o cliente-insert final ainda cria Y, mas Y e o Lead novo permanecem sem contatos.',
    scope: 'EXTENDED',
    tags: ['o08', 'parciais-identidade-antiga', 'lead', 'pos-pac'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'CONTROL',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID_X'),
          idProspect: generated('PROSPECT_ID_X'),
          cpf: generated('CPF_X'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
      {
        operation: 'ENSURE_ACCOUNT_ABSENT',
        keys: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
      {
        operation: 'ENSURE_LEAD_ABSENT',
        keys: {
          idExterno: generated('PROSPECT_ID_X'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'contato-email-x',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 0,
        payloadTemplate: contatoPayload(
          'Email',
          generated('COLLISION_EMAIL'),
          true,
          generated('CLIENT_ID_X'),
        ),
        deliveryPolicy,
      },
      {
        key: 'contato-celular-x',
        target: 'CLIENTE',
        eventType: 'contato-insert',
        delayMs: 1_000,
        payloadTemplate: contatoPayload(
          'Celular',
          generated('CLEAN_CELULAR'),
          true,
          generated('CLIENT_ID_X'),
        ),
        deliveryPolicy,
      },
      {
        key: 'cliente-insert-y',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 2_000,
        payloadTemplate: {
          kind: 'DECLARATIVE',
          contract: 'EVENT_GRID',
          value: {
            id: generated('EVENT_ID'),
            subject: 'MS_Clientes',
            eventType: 'cliente-insert',
            eventTime: generated('EVENT_TIME'),
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              idcliente: generated('CLIENT_ID'),
              idprospectsalesforce: generated('PROSPECT_ID_X'),
              numerocpf: generated('CPF'),
              dataalteracao: generated('EVENT_TIME'),
              nomecompleto: generated('PERSON_NAME'),
            },
          },
        },
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT',
        description:
          'Resultado observado ao vivo: os contatos parciais ficam em X, Y nasce sem e-mail/celular e o Lead novo de Y também permanece sem contatos.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_EVENT',
          'ACCOUNT_CPF_EQUALS_EVENT',
          'ACCOUNT_EMAIL_EXCLUDED',
          'ACCOUNT_MOBILE_EXCLUDED',
          {
            check: 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('COLLISION_EMAIL'),
          },
          {
            check: 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          'LEAD_COUNT_BY_CPF_IS_ONE',
          'LEAD_CPF_EQUALS_EVENT',
          'LEAD_EMAIL_EXCLUDED',
          'LEAD_MOBILE_EXCLUDED',
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithLead,
  },
  {
    key: 'evento-duplicado',
    version: 1,
    name: 'Reentrega genérica do mesmo evento',
    description:
      'Publica o mesmo cliente-update duas vezes com o mesmo envelope Event Grid para medir a idempotência real do Apex.',
    scope: 'EXTENDED',
    tags: ['regression', 'o14', 'idempotencia', 'reentrega'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'PRIMARY',
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
        deliveryPolicy: {
          duplicateCount: 1,
          retryOn: [],
          maxAttempts: 1,
        },
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'O mesmo envelope deve poder ser reentregue sem criar duplicidade nem corromper a Account já encontrada por Id Cliente.',
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
    key: 'evento-obsoleto',
    version: 1,
    name: 'Evento com dataalteracao obsoleta',
    description:
      'Publica um cliente-update com dataalteracao anterior ao setup persistido para confirmar que o Apex preserva o estado mais novo.',
    scope: 'EXTENDED',
    tags: ['regression', 'obsolescencia'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'PRIMARY',
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
        payloadTemplate: clientPayload('cliente-update', true, {
          cpf: generated('CPF_X'),
          dataAlteracao: generated('EARLIER_TIME'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'ACCOUNT_UPDATED_ONLY',
        description:
          'Se o evento chegar com dataalteracao mais antiga que a persistida, a Account deve permanecer com os dados do setup original.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_NAME_EQUALS_SETUP',
          'ACCOUNT_CPF_EQUALS_SETUP',
        ],
      },
    ],
    asyncPolicy,
    cleanup,
  },
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
        role: 'PRIMARY',
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
        role: 'PRIMARY',
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
  {
    key: 'pac-insert-minimo',
    version: 1,
    name: 'PAC insert mínimo',
    description:
      'Smoke test mínimo do contrato /PAC com Opportunity sintética e callback protegido.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'pac-minimo'],
    availability: 'READY',
    variablesSchema,
    setup: [
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'PRIMARY',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID'),
          idProspect: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
          name: generated('BASE_PERSON_NAME'),
          dataAlteracao: generated('BASELINE_TIME'),
        },
      },
      {
        operation: 'CREATE_SYNTHETIC_OPPORTUNITY',
        opportunity: {
          idExterno: generated('OPPORTUNITY_EXTERNAL_ID'),
          accountId: generated('CLIENT_ID'),
          name: 'Opportunity Sintética PAC',
          stageName: 'Simulação',
          closeDate: '2027-12-31',
        },
      },
    ],
    steps: [
      {
        key: 'pac-insert',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacPayload('pac-insert'),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC deve ser criada com o Id externo esperado e vinculada à Opportunity sintética.',
        checks: ['PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY'],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
] as const satisfies readonly ScenarioDefinition[];
