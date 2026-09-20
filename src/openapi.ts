import { z } from 'zod';

import packageJson from '../package.json';
import {
  atualizarClienteInputSchema,
  cancelRunRequestSchema,
  createRunRequestSchema,
  createRunResponseSchema,
  dryRunPreviewSchema,
  eventGridEnvelopeSchema,
  graphqlErrorResponseSchema,
  graphqlResponsePolicySchema,
  graphqlSuccessResponseSchema,
  healthResponseSchema,
  paginationMetadataSchema,
  retryRunRequestSchema,
  runActionResponseSchema,
  runListResponseSchema,
  runResponseSchema,
  runStepListResponseSchema,
  runStepResponseSchema,
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

const runErrorResponses = {
  '401': errorResponses['401'],
  '422': errorResponses['422'],
  '503': response(
    'Orquestração, scheduler ou kill switch Salesforce indisponível; a operação é recuperável.',
    'RestErrorResponse',
  ),
  '500': errorResponses['500'],
};

const runActionErrorResponses = {
  '401': errorResponses['401'],
  '404': response('Execução não encontrada.', 'RestErrorResponse'),
  '409': response('Conflito de estado da execução.', 'RestErrorResponse'),
  '422': response('Corpo estrito inválido.', 'RestErrorResponse'),
  '503': response(
    'Orquestração, QStash ou cleanup Salesforce indisponível; a operação permanece recuperável.',
    'RestErrorResponse',
  ),
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
    version: packageJson.version,
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
      description: 'Criação idempotente e consulta protegida de execuções.',
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
          'Lista execuções com paginação limitada e filtros por status, cenário e datas.',
        operationId: 'listRuns',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'implemented',
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
          ...runErrorResponses,
        },
      },
      post: {
        summary: 'Criar execução',
        description:
          'Cria ou reproduz uma execução idempotente. Non-dry agenda dispatches no QStash; dryRun renderiza e persiste somente auditoria técnica, sem publicação externa.',
        operationId: 'createRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'implemented',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
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
          ...runErrorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}': {
      get: {
        summary: 'Consultar execução',
        description: 'Retorna o estado consolidado sanitizado da execução.',
        operationId: 'getRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'implemented',
        parameters: [runIdParameter],
        responses: {
          '200': response('Estado consolidado da execução.', 'Run'),
          '404': response('Execução não encontrada.', 'RestErrorResponse'),
          ...runErrorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}/steps': {
      get: {
        summary: 'Listar passos da execução',
        description:
          'Lista passos sanitizados em ordem de execução e com paginação limitada.',
        operationId: 'listRunSteps',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'implemented',
        parameters: [runIdParameter, ...paginationParameters],
        responses: {
          '200': response(
            'Página de passos sanitizados.',
            'RunStepListResponse',
          ),
          '404': response('Execução não encontrada.', 'RestErrorResponse'),
          ...runErrorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}/cancellations': {
      post: {
        summary: 'Solicitar cancelamento',
        description:
          'Inicia cancelamento idempotente. Mensagens pendentes são canceladas no QStash; passos em processamento podem concluir sem reabrir a execução.',
        operationId: 'cancelRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'implemented',
        parameters: [runIdParameter],
        requestBody: {
          required: false,
          content: jsonContent('CancelRunRequest'),
        },
        responses: {
          '200': response(
            'Replay de uma execução já cancelada.',
            'RunActionResponse',
          ),
          '202': response('Cancelamento solicitado.', 'RunActionResponse'),
          ...runActionErrorResponses,
        },
      },
    },
    '/api/v1/runs/{runId}/retries': {
      post: {
        summary: 'Repetir passos elegíveis',
        description:
          'Reserva e agenda novas tentativas somente para passos FAILED, sem apagar a trilha original.',
        operationId: 'retryRun',
        tags: ['Runs'],
        security: bearerSecurity,
        'x-implementation-status': 'implemented',
        parameters: [runIdParameter],
        requestBody: {
          required: false,
          content: jsonContent('RetryRunRequest'),
        },
        responses: {
          '202': response('Retry aceito.', 'RunActionResponse'),
          ...runActionErrorResponses,
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
      CreateRunRequest: toComponentSchema(
        'CreateRunRequest',
        createRunRequestSchema,
      ),
      DryRunPreview: toComponentSchema('DryRunPreview', dryRunPreviewSchema),
      Run: toComponentSchema('Run', runResponseSchema),
      CreateRunResponse: toComponentSchema(
        'CreateRunResponse',
        createRunResponseSchema,
      ),
      RunListResponse: toComponentSchema(
        'RunListResponse',
        runListResponseSchema,
      ),
      RunStep: toComponentSchema('RunStep', runStepResponseSchema),
      RunStepListResponse: toComponentSchema(
        'RunStepListResponse',
        runStepListResponseSchema,
      ),
      CancelRunRequest: toComponentSchema(
        'CancelRunRequest',
        cancelRunRequestSchema,
      ),
      RetryRunRequest: toComponentSchema(
        'RetryRunRequest',
        retryRunRequestSchema,
      ),
      RunActionResponse: toComponentSchema(
        'RunActionResponse',
        runActionResponseSchema,
      ),
    },
  },
};
