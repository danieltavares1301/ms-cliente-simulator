import { z } from 'zod';

import {
  atualizarClienteInputSchema,
  eventGridEnvelopeSchema,
  graphqlErrorResponseSchema,
  graphqlResponsePolicySchema,
  graphqlSuccessResponseSchema,
  healthResponseSchema,
  paginationMetadataSchema,
  scenarioDetailSchema,
  scenarioListResponseSchema,
  scenarioMetadataSchema,
} from './contracts';

export type ImplementationStatus = 'implemented' | 'phase-2' | 'future';

type JsonSchemaObject = Record<string, unknown> & {
  additionalProperties?: boolean;
  minItems?: number;
  maxItems?: number;
};

type OpenApiOperation = {
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters?: unknown[];
  requestBody?: unknown;
  security?: unknown[];
  responses: Record<string, unknown>;
  'x-implementation-status': ImplementationStatus;
};

type OpenApiPathItem = {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
};

export type OpenApiDocument = {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, OpenApiPathItem>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, JsonSchemaObject>;
  };
};

function rewriteLocalDefinitions(
  value: unknown,
  componentName: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteLocalDefinitions(item, componentName));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (
          key === '$ref' &&
          typeof item === 'string' &&
          item.startsWith('#/$defs/')
        ) {
          return [
            key,
            `#/components/schemas/${componentName}/${item.slice(2)}`,
          ];
        }
        return [key, rewriteLocalDefinitions(item, componentName)];
      }),
    );
  }

  return value;
}

function toComponentSchema(
  componentName: string,
  schema: z.ZodType,
): JsonSchemaObject {
  const generated = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    reused: 'inline',
  }) as JsonSchemaObject & { $schema?: string };
  const component = { ...generated };
  delete component.$schema;
  return rewriteLocalDefinitions(component, componentName) as JsonSchemaObject;
}

const jsonContent = (schemaRef: string) => ({
  'application/json': {
    schema: { $ref: `#/components/schemas/${schemaRef}` },
  },
});

const response = (description: string, schemaRef?: string) => ({
  description,
  ...(schemaRef ? { content: jsonContent(schemaRef) } : {}),
});

const responseWithExample = (
  description: string,
  schemaRef: string,
  example: unknown,
) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: `#/components/schemas/${schemaRef}` },
      example,
    },
  },
});

const errorResponses = {
  '400': response('Requisição inválida e sanitizada.', 'RestErrorResponse'),
  '401': response('Autenticação ausente ou inválida.', 'RestErrorResponse'),
  '403': response('Operação não autorizada.', 'RestErrorResponse'),
  '422': response(
    'Parâmetros de consulta inválidos e sanitizados.',
    'RestErrorResponse',
  ),
  '500': response(
    'Falha interna sem diagnóstico sensível.',
    'RestErrorResponse',
  ),
};

const publicScenarioErrorResponses = {
  '400': errorResponses['400'],
  '422': errorResponses['422'],
  '500': errorResponses['500'],
};

const bearerSecurity = [{ bearerAuth: [] }];

const scenarioKeyParameter = {
  name: 'scenarioKey',
  in: 'path',
  required: true,
  description: 'Chave estável do cenário versionado.',
  schema: {
    type: 'string',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  },
};

const runIdParameter = {
  name: 'runId',
  in: 'path',
  required: true,
  description: 'Identificador técnico da execução.',
  schema: { type: 'string', minLength: 1 },
};

const paginationParameters = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  {
    name: 'pageSize',
    in: 'query',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
    },
  },
];

const runStatusValues = [
  'CREATED',
  'PROVISIONING',
  'SCHEDULED',
  'RUNNING',
  'WAITING_ASYNC',
  'VERIFYING',
  'SUCCEEDED',
  'FAILED',
  'PARTIAL',
  'CANCELLING',
  'CANCELLED',
];

export const openApiDocument: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'API Simuladora do MS Clientes',
    version: '0.2.1',
    description:
      'Contrato público contract-first para a Unificação 2.2. A extensão x-implementation-status distingue operações disponíveis de contratos planejados.',
  },
  servers: [
    {
      url: '/',
      description: 'Origem atual do deploy ou ambiente local.',
    },
  ],
  tags: [
    { name: 'System', description: 'Saúde e documentação da API.' },
    {
      name: 'Scenarios',
      description: 'Catálogo versionado de cenários.',
    },
    {
      name: 'Runs',
      description: 'Orquestração futura de execuções.',
    },
    {
      name: 'GraphQL callback',
      description:
        'Contrato futuro do callback application/graphql atualizarCliente.',
    },
  ],
  paths: {
    '/api/v1/health': {
      get: {
        summary: 'Consultar saúde da aplicação',
        description:
          'Valida a configuração sem realizar DML nem disparar eventos.',
        operationId: 'getHealth',
        tags: ['System'],
        'x-implementation-status': 'implemented',
        responses: {
          '200': response(
            'Aplicação e configuração disponíveis.',
            'HealthResponse',
          ),
          '500': response(
            'Configuração inválida, sem exposição de valores.',
            'RestErrorResponse',
          ),
        },
      },
    },
    '/api/v1/openapi': {
      get: {
        summary: 'Obter o documento OpenAPI',
        description:
          'Retorna este documento OpenAPI 3.1 diretamente da memória da aplicação.',
        operationId: 'getOpenApi',
        tags: ['System'],
        'x-implementation-status': 'implemented',
        responses: {
          '200': response('Documento OpenAPI 3.1.', 'OpenApiDocument'),
        },
      },
    },
    '/api/v1/scenarios': {
      get: {
        summary: 'Listar cenários',
        description:
          'Lista a versão ativa de cada cenário sem payloads renderizados ou campos de negócio.',
        operationId: 'listScenarios',
        tags: ['Scenarios'],
        'x-implementation-status': 'implemented',
        parameters: [
          ...paginationParameters,
          {
            name: 'tag',
            in: 'query',
            schema: { type: 'string', minLength: 1 },
          },
          {
            name: 'scope',
            in: 'query',
            schema: { type: 'string', enum: ['CORE', 'EXTENDED'] },
          },
        ],
        responses: {
          '200': responseWithExample(
            'Página de metadados de cenários.',
            'ScenarioListResponse',
            {
              data: [
                {
                  key: 'match-id-cliente',
                  version: 1,
                  name: 'Match por Id Cliente',
                  description:
                    'Atualiza somente a Account encontrada pelo Id Cliente.',
                  scope: 'CORE',
                  tags: ['core', 'id-cliente', 'match'],
                  availability: 'READY',
                },
              ],
              pagination: {
                page: 1,
                pageSize: 20,
                total: 4,
                totalPages: 1,
              },
            },
          ),
          ...publicScenarioErrorResponses,
        },
      },
    },
    '/api/v1/scenarios/{scenarioKey}': {
      get: {
        summary: 'Consultar cenário',
        description:
          'Retorna a versão ativa, variáveis declarativas e passos sanitizados sem payload templates.',
        operationId: 'getScenario',
        tags: ['Scenarios'],
        'x-implementation-status': 'implemented',
        parameters: [scenarioKeyParameter],
        responses: {
          '200': responseWithExample(
            'Detalhe público do cenário.',
            'ScenarioDetail',
            {
              key: 'match-id-cliente',
              version: 1,
              name: 'Match por Id Cliente',
              description:
                'Atualiza somente a Account encontrada pelo Id Cliente.',
              scope: 'CORE',
              tags: ['core', 'id-cliente', 'match'],
              availability: 'READY',
              variablesSchema: {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false,
              },
              steps: [
                {
                  key: 'cliente-update',
                  target: 'CLIENTE',
                  eventType: 'cliente-update',
                  delayMs: 0,
                  deliveryPolicy: {
                    duplicateCount: 0,
                    retryOn: [],
                    maxAttempts: 1,
                  },
                },
              ],
            },
          ),
          '404': response('Cenário não encontrado.', 'RestErrorResponse'),
          ...publicScenarioErrorResponses,
        },
      },
    },
    '/api/v1/runs': {
      get: {
        summary: 'Listar execuções',
        description:
          'Contrato futuro de paginação e filtros por status, cenário e datas.',
        operationId: 'listRuns',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        parameters: [
          ...paginationParameters,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: runStatusValues },
          },
          {
            name: 'scenarioKey',
            in: 'query',
            schema: { type: 'string', minLength: 1 },
          },
          {
            name: 'createdFrom',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'createdTo',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
        ],
        responses: {
          '200': response('Página de execuções.', 'RunListResponse'),
          ...errorResponses,
        },
      },
      post: {
        summary: 'Criar execução',
        description:
          'Contrato futuro. A mesma chave de idempotência e o mesmo corpo devem identificar a mesma execução.',
        operationId: 'createRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent('CreateRunRequest'),
        },
        responses: {
          '202': response(
            'Execução aceita para processamento.',
            'CreateRunResponse',
          ),
          '409': response('Conflito de idempotência.', 'RestErrorResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}': {
      get: {
        summary: 'Consultar execução',
        description: 'Contrato futuro do estado consolidado da execução.',
        operationId: 'getRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        parameters: [runIdParameter],
        responses: {
          '200': response('Estado consolidado da execução.', 'Run'),
          '404': response('Execução não encontrada.', 'RestErrorResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}/steps': {
      get: {
        summary: 'Listar passos da execução',
        description:
          'Contrato futuro para passos, tentativas e respostas sanitizadas.',
        operationId: 'listRunSteps',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        parameters: [runIdParameter, ...paginationParameters],
        responses: {
          '200': response(
            'Página de passos sanitizados.',
            'RunStepListResponse',
          ),
          '404': response('Execução não encontrada.', 'RestErrorResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}/cancellations': {
      post: {
        summary: 'Solicitar cancelamento',
        description: 'Contrato futuro; passos em processamento podem concluir.',
        operationId: 'cancelRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        parameters: [runIdParameter],
        responses: {
          '202': response('Cancelamento solicitado.', 'RunActionAccepted'),
          '404': response('Execução não encontrada.', 'RestErrorResponse'),
          '409': response(
            'Execução não pode ser cancelada.',
            'RestErrorResponse',
          ),
          ...errorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}/retries': {
      post: {
        summary: 'Repetir passos elegíveis',
        description:
          'Contrato futuro; cria novas tentativas sem apagar a trilha original.',
        operationId: 'retryRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        parameters: [runIdParameter],
        responses: {
          '202': response('Retry aceito.', 'RunActionAccepted'),
          '404': response('Execução não encontrada.', 'RestErrorResponse'),
          '409': response('Não há passos elegíveis.', 'RestErrorResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/ms-clientes/graphql': {
      post: {
        summary: 'Receber callback atualizarCliente',
        description:
          'Somente contrato futuro. O request chega como texto GraphQL; parser, autenticação, correlação e políticas ainda não estão implementados.',
        operationId: 'atualizarClienteCallback',
        tags: ['GraphQL callback'],
        security: bearerSecurity,
        'x-implementation-status': 'future',
        requestBody: {
          required: true,
          content: {
            'application/graphql': {
              schema: {
                type: 'string',
                minLength: 1,
                description:
                  'Mutation atualizarCliente(cliente: {...}) { id }.',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sucesso ou erro GraphQL simulado.',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      $ref: '#/components/schemas/GraphqlSuccessResponse',
                    },
                    { $ref: '#/components/schemas/GraphqlErrorResponse' },
                  ],
                },
              },
            },
          },
          '201': response(
            'Sucesso alternativo aceito pelo Apex.',
            'GraphqlSuccessResponse',
          ),
          '400': response('Falha simulada HTTP 400.', 'RestErrorResponse'),
          '401': response('Falha simulada HTTP 401.', 'RestErrorResponse'),
          '429': response('Falha simulada HTTP 429.', 'RestErrorResponse'),
          '500': response('Falha simulada HTTP 500.', 'RestErrorResponse'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Credencial dedicada ao simulador; tokens do MS Clientes real não são aceitos.',
      },
    },
    schemas: {
      RestErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string', minLength: 1 },
              message: { type: 'string', minLength: 1 },
              requestId: { type: 'string', minLength: 1 },
              details: {
                type: 'object',
                description:
                  'Diagnóstico sanitizado; stack, payload e token são proibidos em qualquer nível.',
                additionalProperties: true,
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      HealthResponse: toComponentSchema('HealthResponse', healthResponseSchema),
      EventGridEnvelope: toComponentSchema(
        'EventGridEnvelope',
        eventGridEnvelopeSchema,
      ),
      AtualizarClienteInput: toComponentSchema(
        'AtualizarClienteInput',
        atualizarClienteInputSchema,
      ),
      GraphqlSuccessResponse: toComponentSchema(
        'GraphqlSuccessResponse',
        graphqlSuccessResponseSchema,
      ),
      GraphqlErrorResponse: toComponentSchema(
        'GraphqlErrorResponse',
        graphqlErrorResponseSchema,
      ),
      GraphqlResponsePolicy: toComponentSchema(
        'GraphqlResponsePolicy',
        graphqlResponsePolicySchema,
      ),
      ScenarioMetadata: toComponentSchema(
        'ScenarioMetadata',
        scenarioMetadataSchema,
      ),
      ScenarioListResponse: toComponentSchema(
        'ScenarioListResponse',
        scenarioListResponseSchema,
      ),
      ScenarioDetail: toComponentSchema('ScenarioDetail', scenarioDetailSchema),
      PaginationMetadata: toComponentSchema(
        'PaginationMetadata',
        paginationMetadataSchema,
      ),
      OpenApiDocument: {
        type: 'object',
        required: ['openapi', 'info', 'paths', 'components'],
        properties: {
          openapi: { type: 'string', const: '3.1.0' },
          info: { type: 'object' },
          paths: { type: 'object' },
          components: { type: 'object' },
        },
        additionalProperties: true,
      },
      CreateRunRequest: {
        type: 'object',
        required: ['scenarioKey', 'scenarioVersion', 'variables', 'execution'],
        properties: {
          scenarioKey: { type: 'string', minLength: 1 },
          scenarioVersion: { type: 'integer', minimum: 1 },
          variables: {
            type: 'object',
            required: ['seed', 'eventStartAt'],
            properties: {
              seed: { type: 'string', minLength: 1 },
              eventStartAt: { type: 'string', format: 'date-time' },
            },
            additionalProperties: false,
          },
          execution: {
            type: 'object',
            required: ['dryRun', 'speed', 'stopOnFailure'],
            properties: {
              dryRun: { type: 'boolean' },
              speed: { type: 'number', exclusiveMinimum: 0 },
              stopOnFailure: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      Run: {
        type: 'object',
        required: [
          'runId',
          'status',
          'scenarioKey',
          'scenarioVersion',
          'createdAt',
        ],
        properties: {
          runId: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: runStatusValues },
          scenarioKey: { type: 'string', minLength: 1 },
          scenarioVersion: { type: 'integer', minimum: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          stepsUrl: { type: 'string', format: 'uri-reference' },
        },
        additionalProperties: false,
      },
      CreateRunResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { $ref: '#/components/schemas/Run' },
        },
        additionalProperties: false,
      },
      RunListResponse: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Run' },
          },
          pagination: {
            $ref: '#/components/schemas/PaginationMetadata',
          },
        },
        additionalProperties: false,
      },
      RunStep: {
        type: 'object',
        required: ['stepId', 'key', 'status', 'attempts'],
        properties: {
          stepId: { type: 'string', minLength: 1 },
          key: { type: 'string', minLength: 1 },
          status: { type: 'string', minLength: 1 },
          attempts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['attempt', 'status'],
              properties: {
                attempt: { type: 'integer', minimum: 1 },
                status: { type: 'string', minLength: 1 },
                httpStatus: {
                  type: ['integer', 'null'],
                  minimum: 100,
                  maximum: 599,
                },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      RunStepListResponse: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/RunStep' },
          },
          pagination: {
            $ref: '#/components/schemas/PaginationMetadata',
          },
        },
        additionalProperties: false,
      },
      RunActionAccepted: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['runId', 'status'],
            properties: {
              runId: { type: 'string', minLength: 1 },
              status: { type: 'string', enum: runStatusValues },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
  },
};
