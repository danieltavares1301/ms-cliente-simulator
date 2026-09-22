import type { ScenarioDefinition } from '../contracts/scenarios.ts';

type GeneratedValue =
  | 'EVENT_ID'
  | 'REDELIVERY_EVENT_ID'
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
  | 'CLEAN_CELULAR_X'
  | 'PAC_EMAIL'
  | 'PAC_CELULAR'
  | 'SYNTHETIC_EMAIL'
  | 'SYNTHETIC_EMAIL_X'
  | 'SYNTHETIC_STREET'
  | 'OPPORTUNITY_EXTERNAL_ID'
  | 'PAC_EXTERNAL_ID'
  | 'PROPONENTE_EXTERNAL_ID'
  | 'PROPONENTE_EXTERNAL_ID_X'
  | 'CONTESTACAO_EXTERNAL_ID';

const generated = <T extends GeneratedValue>(value: T) =>
  ({ source: 'GENERATED', value }) as const;

type PayloadTemplateValue =
  | string
  | number
  | boolean
  | null
  | ReturnType<typeof generated>
  | PayloadTemplateValue[]
  | { [key: string]: PayloadTemplateValue };

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

const MAQUINA_ESTADO_ACTIVE_PRODUCT_EXTERNAL_ID =
  '37dd20e6-4b3c-ea11-801d-005056856875';
const MAQUINA_ESTADO_TROCA_UNIDADE_PRODUCT_EXTERNAL_ID =
  '6eeda6b4-1ee9-48a2-a5db-123044783c25';

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

function pacPayload(
  eventType: 'pac-insert' | 'pac-update',
  options: {
    status?: string;
    dataAlteracao?: ReturnType<typeof generated>;
    proponentes?: Array<Record<string, PayloadTemplateValue>>;
  } = {},
): ScenarioDefinition['steps'][number]['payloadTemplate'] {
  const {
    status = 'EM_ANALISE_CREDITO',
    dataAlteracao = generated('EVENT_TIME'),
    proponentes,
  } = options;
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
        status,
        dataalteracao: dataAlteracao,
        ...(proponentes === undefined ? {} : { proponentes }),
      },
    },
  } as const;
}

function pacWithPrincipalProponentePayload(
  eventType: 'pac-insert' | 'pac-update',
  options: {
    status?: string;
    dataAlteracao?: ReturnType<typeof generated>;
    idCliente?: ReturnType<typeof generated>;
    cpf?: ReturnType<typeof generated>;
    personName?: ReturnType<typeof generated>;
    email?: ReturnType<typeof generated>;
    celular?: ReturnType<typeof generated>;
    idProponente?: ReturnType<typeof generated>;
    proponenteDataAlteracao?: ReturnType<typeof generated>;
    proponenteExternalId?: ReturnType<typeof generated>;
  } = {},
): ScenarioDefinition['steps'][number]['payloadTemplate'] {
  const {
    status = 'CREDITO_APROVADO_CONDICIONADO',
    dataAlteracao = generated('EVENT_TIME'),
    idCliente = generated('CLIENT_ID'),
    cpf = generated('CPF'),
    personName = generated('PERSON_NAME'),
    email = generated('SYNTHETIC_EMAIL'),
    celular = generated('CLEAN_CELULAR'),
    idProponente,
    proponenteDataAlteracao = generated('EVENT_TIME'),
    proponenteExternalId = generated('PROPONENTE_EXTERNAL_ID'),
  } = options;

  return pacPayload(eventType, {
    status,
    dataAlteracao,
    proponentes: [
      {
        id: proponenteExternalId,
        idPac: generated('PAC_EXTERNAL_ID'),
        idCliente,
        cpf,
        tipoClassificacao: 'Principal',
        dataAlteracao: proponenteDataAlteracao,
        nomeCompleto: personName,
        email,
        telefoneCelular: celular,
        ...(idProponente ? { idProponente } : {}),
      },
    ],
  });
}

function approvedPacWithPrincipalProponentePayload(
  options: Omit<
    Parameters<typeof pacWithPrincipalProponentePayload>[1],
    'status'
  > = {},
): ScenarioDefinition['steps'][number]['payloadTemplate'] {
  return pacWithPrincipalProponentePayload('pac-insert', options);
}

function maquinaEstadoPayload(
  eventType: 'jornadausuario-insert' | 'jornadausuario-update',
  options: {
    envelopeId?: ReturnType<typeof generated>;
    idCliente?: ReturnType<typeof generated> | null;
    idProspectSalesforce?: ReturnType<typeof generated>;
    estado?: string;
    dataAlteracao?: ReturnType<typeof generated>;
    eventTime?: ReturnType<typeof generated>;
    idUnidade?: string;
  } = {},
): ScenarioDefinition['steps'][number]['payloadTemplate'] {
  const {
    envelopeId = generated('EVENT_ID'),
    idCliente = generated('CLIENT_ID'),
    idProspectSalesforce = generated('PROSPECT_ID'),
    estado = 'SIMULACAO',
    dataAlteracao = generated('EVENT_TIME'),
    eventTime = generated('EVENT_TIME'),
    idUnidade = MAQUINA_ESTADO_ACTIVE_PRODUCT_EXTERNAL_ID,
  } = options;

  return {
    kind: 'DECLARATIVE',
    contract: 'EVENT_GRID',
    value: {
      id: envelopeId,
      subject: 'MS_Clientes',
      eventType,
      eventTime,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        cliente: {
          idCliente,
          idProspectSalesforce,
        },
        id: generated('OPPORTUNITY_EXTERNAL_ID'),
        dataalteracao: dataAlteracao,
        estado,
        idunidade: idUnidade,
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

const cleanupWithProponenteAndOpportunity: ScenarioDefinition['cleanup'] = [
  { operation: 'DELETE_OWNED_RECORDS', target: 'PROPONENTE' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'OPPORTUNITY' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' },
];

const cleanupWithLeadProponenteAndOpportunity: ScenarioDefinition['cleanup'] = [
  { operation: 'DELETE_OWNED_RECORDS', target: 'PROPONENTE' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'OPPORTUNITY' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'ACCOUNT' },
  { operation: 'DELETE_OWNED_RECORDS', target: 'LEAD' },
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
    tags: ['regression', 'o03', 'mesmo-eventtime', 'cliente-primeiro'],
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
        payloadTemplate: enderecoPayload(generated('SYNTHETIC_STREET'), false, {
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
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
    tags: ['regression', 'o03', 'mesmo-eventtime', 'contato-primeiro'],
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
        payloadTemplate: enderecoPayload(generated('SYNTHETIC_STREET'), false, {
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
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
    tags: ['regression', 'o03', 'mesmo-eventtime', 'endereco-primeiro'],
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
        payloadTemplate: enderecoPayload(generated('SYNTHETIC_STREET'), false, {
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
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
    key: 'cpf-divergente-identidade-antiga-pac-aprovada',
    version: 1,
    name: 'CPF divergente com identidade antiga e PAC aprovada',
    description:
      'Retesta o perfil O08 adicionando uma PAC aprovada para medir se a sincronização pós-PAC consegue preencher os contatos de Y depois que o fluxo /Cliente a deixou vazia.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'o08', 'retest-pac', 'pos-pac'],
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
      {
        operation: 'CREATE_SYNTHETIC_OPPORTUNITY',
        opportunity: {
          idExterno: generated('OPPORTUNITY_EXTERNAL_ID'),
          accountId: generated('CLIENT_ID_X'),
          name: 'Opportunity Sintética PAC',
          stageName: 'Simulação',
          closeDate: '2027-12-31',
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
      {
        key: 'pac-insert-aprovada-y',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 3_000,
        payloadTemplate: approvedPacWithPrincipalProponentePayload({
          idCliente: generated('CLIENT_ID'),
          cpf: generated('CPF'),
          personName: generated('PERSON_NAME'),
          email: generated('PAC_EMAIL'),
          celular: generated('PAC_CELULAR'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'Resultado observado ao vivo: Y nasce sem contatos após o fluxo /Cliente; a PAC aprovada cria o Proponente principal, preserva X com os contatos antigos e sincroniza email/celular aprovados em Y e no Lead novo.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          {
            check: 'CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('COLLISION_EMAIL'),
          },
          {
            check: 'CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('PAC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('PAC_CELULAR'),
          },
          {
            check: 'LEAD_EMAIL_EQUALS_EXPECTED',
            value: generated('PAC_EMAIL'),
          },
          {
            check: 'LEAD_MOBILE_EQUALS_EXPECTED',
            value: generated('PAC_CELULAR'),
          },
          'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithLeadProponenteAndOpportunity,
  },
  {
    key: 'e2e-opportunity-permanece-conta-aprovada',
    version: 1,
    name: 'Cross-endpoint mantém Opportunity na Account aprovada',
    description:
      'Combina /MaquinaEstado, /Cliente e /PAC para confirmar que um jornadausuario-update posterior, resolvendo a identidade antiga apenas por prospect, não reassocia a Opportunity depois que a PAC aprovada já a moveu para a Account nova.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'cross-endpoint', 'o08', 'pac', 'maquina-estado'],
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
        key: 'maquina-estado-insert-conta-antiga',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          idCliente: generated('CLIENT_ID_X'),
          idProspectSalesforce: generated('PROSPECT_ID_X'),
        }),
        deliveryPolicy,
      },
      {
        key: 'cliente-insert-conta-aprovada',
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
      {
        key: 'pac-insert-aprovado',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 3_000,
        payloadTemplate: approvedPacWithPrincipalProponentePayload({
          idCliente: generated('CLIENT_ID'),
          cpf: generated('CPF'),
          personName: generated('PERSON_NAME'),
          email: generated('PAC_EMAIL'),
          celular: generated('PAC_CELULAR'),
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-identidade-antiga',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 4_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          idCliente: null,
          idProspectSalesforce: generated('PROSPECT_ID_X'),
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC aprovada reassocia a Opportunity para a Account PRIMARY; quando um jornadausuario-update posterior volta a resolver a identidade antiga apenas por `ID_PROSPECT`, a Opportunity deve permanecer na Account aprovada e ainda aceitar a transição de fase.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'CREDITO_APROVADO_CONDICIONADO',
          },
          'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
          'LEAD_COUNT_BY_CPF_IS_ONE',
          {
            check: 'LEAD_EMAIL_EQUALS_EXPECTED',
            value: generated('PAC_EMAIL'),
          },
          {
            check: 'LEAD_MOBILE_EQUALS_EXPECTED',
            value: generated('PAC_CELULAR'),
          },
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
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithLeadProponenteAndOpportunity,
  },
  {
    key: 'e2e-evento-obsoleto-sem-cliente-ignorado',
    version: 1,
    name: 'Cross-endpoint ignora evento obsoleto sem cliente',
    description:
      'Cria a Opportunity, avança a fase com um update atual e em seguida envia um jornadausuario-update mais antigo, sem qualquer Account resolvível, para comprovar o retorno HTTP 200 com descarte silencioso.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'cross-endpoint', 'maquina-estado', 'obsoleto'],
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
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          estado: 'SIMULACAO',
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-documentacao-atual',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-obsoleto-sem-cliente',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 6_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          idCliente: generated('CLIENT_ID_X'),
          idProspectSalesforce: generated('PROSPECT_ID_X'),
          estado: 'CONTRATO',
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'O update atual move a Opportunity para Qualificação de Documentos; um update posterior, mais antigo e sem cliente resolvível, deve retornar sucesso de transporte e deixar a Opportunity intacta, sem fila manual.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'e2e-evento-atual-reentregue-apos-cliente-insert',
    version: 1,
    name: 'Cross-endpoint reentrega evento atual após cliente-insert',
    description:
      'Reenvia exatamente o mesmo jornadausuario-insert após um /Cliente criar a Account correspondente, registrando o comportamento real observado em mrv-devDan para essa reentrega cross-endpoint.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'cross-endpoint', 'maquina-estado', 'reentrega'],
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
      {
        operation: 'ENSURE_LEAD_ABSENT',
        keys: {
          idExterno: generated('PROSPECT_ID'),
          cpf: generated('CPF'),
        },
      },
    ],
    steps: [
      {
        key: 'maquina-estado-insert-sem-cliente',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        expectedHttpStatus: 400,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          envelopeId: generated('REDELIVERY_EVENT_ID'),
          idCliente: null,
          idProspectSalesforce: generated('PROSPECT_ID'),
          estado: 'SIMULACAO',
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
      {
        key: 'cliente-insert-cria-account',
        target: 'CLIENTE',
        eventType: 'cliente-insert',
        delayMs: 2_000,
        payloadTemplate: clientPayload('cliente-insert', true),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-insert-reentregue',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 4_000,
        expectedHttpStatus: 400,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          envelopeId: generated('REDELIVERY_EVENT_ID'),
          idCliente: null,
          idProspectSalesforce: generated('PROSPECT_ID'),
          estado: 'SIMULACAO',
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'EVENT_REJECTED_WITHOUT_DML',
        description:
          'Divergência real observada em mrv-devDan: o /Cliente cria a Account, mas não carimba `IdProspectSalesforce__c`; por isso a reentrega exata do mesmo jornadausuario-insert continua falhando com `Cliente(Account) não encontrado`, sem criar Opportunity.',
        checks: [
          'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE',
          'ACCOUNT_IS_PERSON_ACCOUNT',
          'ACCOUNT_PROSPECT_ID_NOT_STAMPED',
          'OPPORTUNITY_NOT_CREATED',
          {
            check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
            value: 0,
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithOpportunity,
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
    key: 'maquina-estado-insert-apos-cliente-criado',
    version: 1,
    name: 'MaquinaEstado insert após cliente criado',
    description:
      'Reproduz a recuperação real: o /Cliente já criou a Account antes do jornadausuario-insert, então a Opportunity nasce normalmente.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'ordering'],
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
        key: 'maquina-estado-insert',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert'),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'Com a Account já criada previamente pelo fluxo /Cliente, o mesmo jornadausuario-insert volta a criar a Opportunity, vinculá-la à Account e inserir um OpportunityLineItem.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-insert-minimo',
    version: 1,
    name: 'MaquinaEstado insert mínimo',
    description:
      'Smoke test mínimo do contrato /MaquinaEstado criando a Opportunity pela primeira vez com unidade real ativa em mrv-devDan.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'smoke'],
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
        key: 'maquina-estado-insert',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert'),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'A Opportunity deve ser criada pelo /MaquinaEstado com a Account sintética, a fase Simulação e exatamente um OpportunityLineItem sintético.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-insert-sem-cliente-falha',
    version: 1,
    name: 'MaquinaEstado insert sem cliente falha',
    description:
      'Reproduz o erro real mais frequente em staging: jornadausuario-insert chega antes do /Cliente correspondente, sem Account existente para o prospect.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'ordering', 'negative'],
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
        key: 'maquina-estado-insert',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        expectedHttpStatus: 400,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          idCliente: null,
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'EVENT_REJECTED_WITHOUT_DML',
        description:
          'Sem Account correspondente, o Apex rejeita o dispatch com HTTP 400 e não cria nem Opportunity nem OpportunityLineItem.',
        checks: [
          'OPPORTUNITY_NOT_CREATED',
          {
            check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
            value: 0,
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup: [{ operation: 'DELETE_OWNED_RECORDS', target: 'OPPORTUNITY' }],
  },
  {
    key: 'maquina-estado-insert-troca-unidade-falha',
    version: 1,
    name: 'MaquinaEstado insert troca_unidade falha sem Opportunity prévia',
    description:
      'Mantém uma Account sintética válida, mas envia jornadausuario-insert com estado troca_unidade como primeiro evento da Opportunity, exercitando o branch dedicado que falha explicitamente quando a Opportunity ainda não existe.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'fase-7',
      'maquina-estado',
      'negative',
      'troca-unidade',
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
        key: 'maquina-estado-insert-troca-unidade',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        expectedHttpStatus: 400,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          estado: 'troca_unidade',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'EVENT_REJECTED_WITHOUT_DML',
        description:
          'Com a Account existente, mas sem Opportunity prévia, o branch troca_unidade deve falhar explicitamente e não criar Opportunity nem OpportunityLineItem.',
        checks: [
          'OPPORTUNITY_NOT_CREATED',
          {
            check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
            value: 0,
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-update-transicao-estado',
    version: 1,
    name: 'MaquinaEstado update transição de estado',
    description:
      'Cria a Opportunity via jornadausuario-insert e depois reproduz um jornadausuario-update real avançando a mesma Opportunity existente para Documentação.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'update'],
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
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert'),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-documentacao',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'O jornadausuario-update deve reutilizar a mesma Opportunity externa criada no passo anterior, mantendo apenas um OpportunityLineItem e avançando a fase para Qualificação de Documentos.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-update-troca-unidade',
    version: 1,
    name: 'MaquinaEstado update troca_unidade preserva stage',
    description:
      'Cria a Opportunity, avança para Documentação e depois executa o branch dedicado troca_unidade para comprovar que o StageName permanece em Qualificação de Documentos enquanto a unidade é trocada para um segundo Product2 real.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'update', 'troca-unidade'],
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
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert'),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-documentacao',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-troca-unidade',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 6_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'troca_unidade',
          idUnidade: MAQUINA_ESTADO_TROCA_UNIDADE_PRODUCT_EXTERNAL_ID,
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'O jornadausuario-update com estado troca_unidade deve reaproveitar a Opportunity existente, preservar a fase Qualificação de Documentos e trocar a unidade/line item para o segundo Product2 real.',
        checks: [
          'OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE',
          'OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT',
          {
            check: 'OPPORTUNITY_STAGE_EQUALS_EXPECTED',
            value: 'Qualificação de Documentos',
          },
          {
            check: 'OPPORTUNITY_UNIDADE_EXTERNAL_ID_EQUALS_EXPECTED',
            value: MAQUINA_ESTADO_TROCA_UNIDADE_PRODUCT_EXTERNAL_ID,
          },
          {
            check: 'OPPORTUNITY_LINE_ITEM_PRODUCT_EXTERNAL_ID_EQUALS_EXPECTED',
            value: MAQUINA_ESTADO_TROCA_UNIDADE_PRODUCT_EXTERNAL_ID,
          },
          {
            check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
            value: 1,
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-update-estado-nao-reconhecido',
    version: 1,
    name: 'MaquinaEstado update com estado não reconhecido',
    description:
      'Cria a Opportunity, fixa a fase em Qualificação de Documentos e depois reproduz um jornadausuario-update real com estado de UF (SP), comprovando que o Apex preserva o StageName atual e ainda responde HTTP 200.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'fase-7',
      'maquina-estado',
      'update',
      'estado-nao-reconhecido',
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
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert'),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-documentacao',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-estado-nao-reconhecido',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 6_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'SP',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'O jornadausuario-update final com estado SP deve ser tolerado como no-op: a mesma Opportunity externa permanece única, segue vinculada à Account sintética e conserva a fase Qualificação de Documentos estabelecida no passo 2.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-update-evento-obsoleto',
    version: 1,
    name: 'MaquinaEstado update com evento obsoleto',
    description:
      'Cria a Opportunity, aplica um update atual para Documenta??o e depois despacha um update f?sico posterior com EventTime mais antigo para comprovar o descarte silencioso do evento obsoleto.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'update', 'obsolescencia'],
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
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert', {
          dataAlteracao: generated('BASELINE_TIME'),
          eventTime: generated('BASELINE_TIME'),
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-documentacao-atual',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-contrato-obsoleto',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 6_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'CONTRATO',
          dataAlteracao: generated('PINNED_EVENT_TIME'),
          eventTime: generated('PINNED_EVENT_TIME'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'Depois de um update atual mover a Opportunity para Qualificação de Documentos, um jornadausuario-update fisicamente posterior com EventTime mais antigo deve ser descartado silenciosamente, mantendo a fase do passo 2 e sem duplicar Opportunity nem OpportunityLineItem.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-update-reentrega-mesmo-evento',
    version: 1,
    name: 'MaquinaEstado update com reentrega do mesmo evento',
    description:
      'Cria a Opportunity via jornadausuario-insert e depois reenfileira o mesmo envelope de jornadausuario-update para confirmar que o upsert por Id__c converge sem duplicar Opportunity nem OpportunityLineItem.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'update', 'reentrega'],
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
        key: 'maquina-estado-insert-inicial',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-insert',
        delayMs: 0,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-insert'),
        deliveryPolicy,
      },
      {
        key: 'maquina-estado-update-documentacao-reentrega',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 3_000,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          estado: 'Documentacao',
        }),
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
        result: 'OPPORTUNITY_CREATED_AND_LINKED',
        description:
          'A reentrega física do mesmo jornadausuario-update deve reexecutar o upsert idempotente sobre a mesma Opportunity externa, mantendo apenas um OpportunityLineItem e a fase final em Qualificação de Documentos.',
        checks: [
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
        ],
      },
    ],
    asyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'maquina-estado-update-sem-cliente-falha',
    version: 1,
    name: 'MaquinaEstado update sem cliente falha',
    description:
      'Reexecuta o erro real de Cliente(Account) não encontrado agora com jornadausuario-update, sem Account prévia para o prospect.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'maquina-estado', 'update', 'negative'],
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
        key: 'maquina-estado-update',
        target: 'MAQUINA_ESTADO',
        eventType: 'jornadausuario-update',
        delayMs: 0,
        expectedHttpStatus: 400,
        payloadTemplate: maquinaEstadoPayload('jornadausuario-update', {
          idCliente: null,
          estado: 'Documentacao',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'EVENT_REJECTED_WITHOUT_DML',
        description:
          'Sem Account correspondente, o Apex deve rejeitar o jornadausuario-update com HTTP 400, sem criar Opportunity nem OpportunityLineItem.',
        checks: [
          'OPPORTUNITY_NOT_CREATED',
          {
            check: 'OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED',
            value: 0,
          },
        ],
      },
    ],
    asyncPolicy,
    cleanup: [{ operation: 'DELETE_OWNED_RECORDS', target: 'OPPORTUNITY' }],
  },
  {
    key: 'pac-aprovada-sincroniza-contatos',
    version: 1,
    name: 'PAC aprovada sincroniza contatos',
    description:
      'Valida o fluxo real em que a PAC aprovada sincroniza email e celular da Account a partir do Proponente principal.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'pac-aprovada', 'sincronizacao-contatos'],
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
        key: 'pac-insert-aprovada',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: approvedPacWithPrincipalProponentePayload(),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC aprovada deve criar o Proponente principal, vinculá-lo à PAC e sincronizar email/celular aprovados na Account.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
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
  {
    key: 'pac-insert-opportunity-perdida-forca-cancelado',
    version: 1,
    name: 'PAC insert com Opportunity Perdido mantém status observado',
    description:
      'Registra o comportamento observado em mrv-devDan quando a Opportunity sintética já nasce com StageName Perdido: apesar da hipótese de override para Cancelado, o pac-insert persiste o mesmo status enviado no payload.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'fase-7',
      'pac-insert',
      'opportunity-perdida',
      'status-override',
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
      {
        operation: 'CREATE_SYNTHETIC_OPPORTUNITY',
        opportunity: {
          idExterno: generated('OPPORTUNITY_EXTERNAL_ID'),
          accountId: generated('CLIENT_ID'),
          name: 'Opportunity Sintética PAC Perdido',
          stageName: 'Perdido',
          closeDate: '2027-12-31',
        },
      },
    ],
    steps: [
      {
        key: 'pac-insert-opportunity-perdida',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacPayload('pac-insert', {
          status: 'CREDITO_APROVADO_CONDICIONADO',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC deve ser criada e vinculada à Opportunity sintética perdida, mantendo o Status__c exatamente como veio no payload segundo o comportamento real observado em mrv-devDan.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'CREDITO_APROVADO_CONDICIONADO',
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithOpportunity,
  },
  {
    key: 'pac-update-com-contestacao-pendente-sincroniza-contatos',
    version: 1,
    name: 'PAC update com contestação pendente sincroniza contatos',
    description:
      'Exercita o caminho paralelo em que uma contestação pendente faz o payload sincronizar email e celular da Account mesmo sem Proponente principal.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'fase-7',
      'pac-update',
      'contestacao',
      'sincronizacao-contatos',
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
      {
        operation: 'CREATE_SYNTHETIC_OPPORTUNITY',
        opportunity: {
          idExterno: generated('OPPORTUNITY_EXTERNAL_ID'),
          accountId: generated('CLIENT_ID'),
          name: 'Opportunity Sintética PAC Contestação',
          stageName: 'Simulação',
          closeDate: '2027-12-31',
        },
      },
      {
        operation: 'CREATE_SYNTHETIC_PROPOSTA_ANALISE_CREDITO',
        propostaAnaliseCredito: {
          idExterno: generated('PAC_EXTERNAL_ID'),
          opportunityIdExterno: generated('OPPORTUNITY_EXTERNAL_ID'),
          status: 'ANALISE_CREDITO_INICIADA',
        },
      },
      {
        operation: 'CREATE_SYNTHETIC_CONTESTACAO',
        contestacao: {
          idExterno: generated('CONTESTACAO_EXTERNAL_ID'),
          pacIdExterno: generated('PAC_EXTERNAL_ID'),
        },
      },
    ],
    steps: [
      {
        key: 'pac-update-com-contestacao-pendente',
        target: 'PAC',
        eventType: 'pac-update',
        delayMs: 0,
        payloadTemplate: pacPayload('pac-update', {
          status: 'ANALISE_CREDITO_INICIADA',
          proponentes: [
            {
              id: generated('PROPONENTE_EXTERNAL_ID'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID'),
              cpf: generated('CPF'),
              tipoClassificacao: 'Coobrigado',
              dataAlteracao: generated('EVENT_TIME'),
              nomeCompleto: generated('PERSON_NAME'),
              email: generated('PAC_EMAIL'),
              telefoneCelular: generated('PAC_CELULAR'),
            },
          ],
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A contestação pendente deve permitir que um Proponente não principal sincronize email e celular na Account, mantendo a PAC vinculada à Opportunity.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE',
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('PAC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('PAC_CELULAR'),
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
  },
  {
    key: 'pac-conflito-proponentes-principais',
    version: 1,
    name: 'PAC conflito de proponentes principais',
    description:
      'Exercita o bloqueio real de sincronização de contatos quando a PAC aprovada envia dois Proponentes principais distintos para a mesma Account com dados divergentes.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'fase-7',
      'pac-conflito',
      'principal',
      'sincronizacao-bloqueada',
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
        key: 'pac-insert-conflito-principais',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacPayload('pac-insert', {
          status: 'CREDITO_APROVADO_CONDICIONADO',
          proponentes: [
            {
              id: generated('PROPONENTE_EXTERNAL_ID'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID'),
              cpf: generated('CPF'),
              tipoClassificacao: 'Principal',
              dataAlteracao: generated('EVENT_TIME'),
              nomeCompleto: generated('PERSON_NAME'),
              email: generated('SYNTHETIC_EMAIL'),
              telefoneCelular: generated('CLEAN_CELULAR'),
            },
            {
              id: generated('PROPONENTE_EXTERNAL_ID_X'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID'),
              cpf: generated('CPF'),
              tipoClassificacao: 'Principal',
              dataAlteracao: generated('EVENT_TIME'),
              nomeCompleto: generated('PERSON_NAME'),
              email: generated('PAC_EMAIL'),
              telefoneCelular: generated('PAC_CELULAR'),
            },
          ],
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC aprovada deve permanecer vinculada à Opportunity, criar os dois Proponentes principais distintos e manter a Account sem sincronização de contatos por conflito.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          'ACCOUNT_EMAIL_EXCLUDED',
          'ACCOUNT_MOBILE_EXCLUDED',
          {
            check: 'PROPONENTE_COUNT_EQUALS_EXPECTED',
            value: 2,
          },
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'CREDITO_APROVADO_CONDICIONADO',
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
  },
  {
    key: 'pac-update-altera-status-sem-proponentes',
    version: 1,
    name: 'PAC update altera status sem proponentes',
    description:
      'Exercita o comportamento real em que um pac-update sem proponentes[] atualiza a PAC e apaga o Proponente principal já existente.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'pac-update', 'sem-proponentes'],
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
        key: 'pac-insert-com-proponente',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacWithPrincipalProponentePayload('pac-insert', {
          status: 'EM_ANALISE_CREDITO',
        }),
        deliveryPolicy,
      },
      {
        key: 'pac-update-sem-proponentes',
        target: 'PAC',
        eventType: 'pac-update',
        delayMs: 5_000,
        payloadTemplate: pacPayload('pac-update', {
          status: 'CREDITO_APROVADO_CONDICIONADO',
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC deve permanecer vinculada à Opportunity, atualizar o Status__c e refletir a deleção real do Proponente principal quando o update omite proponentes[].',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          'PROPONENTE_NOT_PRESENT',
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'CREDITO_APROVADO_CONDICIONADO',
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
  },
  {
    key: 'pac-update-reenviando-proponentes',
    version: 1,
    name: 'PAC update reenviando proponentes',
    description:
      'Exercita o comportamento real em que um pac-update reaproveita o mesmo Proponente principal, atualiza seus contatos e sincroniza a Account aprovada.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'pac-update', 'reenvio-proponentes'],
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
        key: 'pac-insert-com-proponente',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacWithPrincipalProponentePayload('pac-insert', {
          status: 'EM_ANALISE_CREDITO',
        }),
        deliveryPolicy,
      },
      {
        key: 'pac-update-reenviando-proponente',
        target: 'PAC',
        eventType: 'pac-update',
        delayMs: 5_000,
        payloadTemplate: pacWithPrincipalProponentePayload('pac-update', {
          status: 'CREDITO_APROVADO_CONDICIONADO',
          email: generated('PAC_EMAIL'),
          celular: generated('PAC_CELULAR'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC deve permanecer vinculada à Opportunity, manter um único Proponente principal via upsert e sincronizar os novos contatos aprovados na Account.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'CREDITO_APROVADO_CONDICIONADO',
          },
          'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE',
          'PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC',
          {
            check: 'ACCOUNT_EMAIL_EQUALS_EXPECTED',
            value: generated('PAC_EMAIL'),
          },
          {
            check: 'ACCOUNT_MOBILE_EQUALS_EXPECTED',
            value: generated('PAC_CELULAR'),
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
  },
  {
    key: 'pac-update-obsoleto-nivel-pac',
    version: 1,
    name: 'PAC update obsoleto no nível da PAC',
    description:
      'Confirma o descarte silencioso de um pac-update cujo dataalteracao da PAC é mais antigo do que o já persistido.',
    scope: 'EXTENDED',
    tags: ['regression', 'fase-7', 'pac-update', 'obsolescencia', 'pac'],
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
        key: 'pac-insert-baseline',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacWithPrincipalProponentePayload('pac-insert', {
          status: 'EM_ANALISE_CREDITO',
          dataAlteracao: generated('BASELINE_TIME'),
          proponenteDataAlteracao: generated('BASELINE_TIME'),
        }),
        deliveryPolicy,
      },
      {
        key: 'pac-update-obsoleto',
        target: 'PAC',
        eventType: 'pac-update',
        delayMs: 5_000,
        payloadTemplate: pacWithPrincipalProponentePayload('pac-update', {
          status: 'CREDITO_APROVADO_CONDICIONADO',
          dataAlteracao: generated('EARLIER_TIME'),
          proponenteDataAlteracao: generated('EARLIER_TIME'),
          email: generated('PAC_EMAIL'),
          celular: generated('PAC_CELULAR'),
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'A PAC deve manter o status do insert baseline e deixar a Account sem sincronização de contatos, comprovando o descarte do update obsoleto no nível da PAC.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          'PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE',
          'ACCOUNT_EMAIL_EXCLUDED',
          'ACCOUNT_MOBILE_EXCLUDED',
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'EM_ANALISE_CREDITO',
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
  },
  {
    key: 'pac-update-obsoleto-nivel-proponente',
    version: 1,
    name: 'PAC update obsoleto por proponente',
    description:
      'Confirma que a obsolescência em pac-update é avaliada por id do Proponente, permitindo atualizar um Principal enquanto outro é descartado no mesmo payload.',
    scope: 'EXTENDED',
    tags: [
      'regression',
      'fase-7',
      'pac-update',
      'obsolescencia',
      'proponente',
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
      {
        operation: 'CREATE_SYNTHETIC_ACCOUNT',
        role: 'CONTROL',
        matchBy: 'ID_CLIENTE',
        account: {
          idCliente: generated('CLIENT_ID_X'),
          idProspect: generated('PROSPECT_ID_X'),
          cpf: generated('CPF_X'),
          name: generated('PERSON_NAME'),
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
        key: 'pac-insert-dois-proponentes',
        target: 'PAC',
        eventType: 'pac-insert',
        delayMs: 0,
        payloadTemplate: pacPayload('pac-insert', {
          status: 'EM_ANALISE_CREDITO',
          dataAlteracao: generated('BASELINE_TIME'),
          proponentes: [
            {
              id: generated('PROPONENTE_EXTERNAL_ID'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID'),
              cpf: generated('CPF'),
              tipoClassificacao: 'Principal',
              dataAlteracao: generated('BASELINE_TIME'),
              nomeCompleto: generated('BASE_PERSON_NAME'),
              email: generated('SYNTHETIC_EMAIL'),
              telefoneCelular: generated('CLEAN_CELULAR'),
            },
            {
              id: generated('PROPONENTE_EXTERNAL_ID_X'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID_X'),
              cpf: generated('CPF_X'),
              tipoClassificacao: 'Principal',
              dataAlteracao: generated('BASELINE_TIME'),
              nomeCompleto: generated('PERSON_NAME'),
              email: generated('SYNTHETIC_EMAIL_X'),
              telefoneCelular: generated('CLEAN_CELULAR_X'),
            },
          ],
        }),
        deliveryPolicy,
      },
      {
        key: 'pac-update-misto-obsoleto-valido',
        target: 'PAC',
        eventType: 'pac-update',
        delayMs: 5_000,
        payloadTemplate: pacPayload('pac-update', {
          status: 'EM_ANALISE_CREDITO',
          dataAlteracao: generated('EVENT_TIME'),
          proponentes: [
            {
              id: generated('PROPONENTE_EXTERNAL_ID'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID'),
              cpf: generated('CPF'),
              tipoClassificacao: 'Principal',
              dataAlteracao: generated('EARLIER_TIME'),
              nomeCompleto: generated('BASE_PERSON_NAME'),
              email: generated('PAC_EMAIL'),
              telefoneCelular: generated('PAC_CELULAR'),
            },
            {
              id: generated('PROPONENTE_EXTERNAL_ID_X'),
              idPac: generated('PAC_EXTERNAL_ID'),
              idCliente: generated('CLIENT_ID_X'),
              cpf: generated('CPF_X'),
              tipoClassificacao: 'Principal',
              dataAlteracao: generated('EVENT_TIME'),
              nomeCompleto: generated('PERSON_NAME'),
              email: generated('PAC_EMAIL'),
              telefoneCelular: generated('PAC_CELULAR'),
            },
          ],
        }),
        deliveryPolicy,
      },
    ],
    expectedOutcomes: [
      {
        kind: 'BUSINESS_RESULT',
        result: 'PAC_CREATED_AND_LINKED',
        description:
          'O Proponente principal da Account PRIMARY deve manter os contatos do step 1, enquanto o Principal da CONTROL assume os contatos do step 2, provando a obsolescência individual por Proponente.',
        checks: [
          'PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY',
          {
            check: 'PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED',
            value: 'EM_ANALISE_CREDITO',
          },
          {
            check: 'PRIMARY_PROPONENTE_EMAIL_EQUALS_EXPECTED',
            value: generated('SYNTHETIC_EMAIL'),
          },
          {
            check: 'PRIMARY_PROPONENTE_MOBILE_EQUALS_EXPECTED',
            value: generated('CLEAN_CELULAR'),
          },
          {
            check: 'CONTROL_PROPONENTE_EMAIL_EQUALS_EXPECTED',
            value: generated('PAC_EMAIL'),
          },
          {
            check: 'CONTROL_PROPONENTE_MOBILE_EQUALS_EXPECTED',
            value: generated('PAC_CELULAR'),
          },
        ],
      },
    ],
    asyncPolicy: graphqlCallbackAsyncPolicy,
    cleanup: cleanupWithProponenteAndOpportunity,
  },
] as const satisfies readonly ScenarioDefinition[];
