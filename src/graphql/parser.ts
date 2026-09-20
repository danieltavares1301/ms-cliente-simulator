import {
  parse,
  type ObjectFieldNode,
  type SelectionNode,
  type ValueNode,
} from 'graphql';
import { z } from 'zod';

import {
  atualizarClienteInputSchema,
  type AtualizarClienteOperation,
} from '../contracts';

const jsonGraphqlBodySchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

export type GraphqlRequestSource = 'application/graphql' | 'application/json';

export class GraphqlRequestParseError extends Error {
  constructor(
    readonly code:
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'INVALID_JSON_BODY'
      | 'GRAPHQL_PARSE_FAILED'
      | 'INVALID_GRAPHQL_OPERATION'
      | 'INVALID_GRAPHQL_ARGUMENTS'
      | 'INVALID_GRAPHQL_SELECTION',
    readonly status: 400 | 415 | 422,
  ) {
    super('Invalid GraphQL request');
    this.name = 'GraphqlRequestParseError';
  }
}

function determineSource(contentType: string | null): GraphqlRequestSource {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === 'application/graphql') {
    return 'application/graphql';
  }
  if (normalized === 'application/json') {
    return 'application/json';
  }
  throw new GraphqlRequestParseError('UNSUPPORTED_MEDIA_TYPE', 415);
}

function readGraphqlQuery(source: GraphqlRequestSource, body: string): string {
  if (source === 'application/graphql') {
    return body;
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    throw new GraphqlRequestParseError('INVALID_JSON_BODY', 400);
  }

  const parsed = jsonGraphqlBodySchema.safeParse(parsedBody);
  if (!parsed.success) {
    throw new GraphqlRequestParseError('INVALID_JSON_BODY', 422);
  }

  return parsed.data.query;
}

function expectSingleSelection(selections: readonly SelectionNode[]) {
  if (selections.length !== 1 || selections[0]?.kind !== 'Field') {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_OPERATION', 422);
  }
  return selections[0];
}

function fieldMap(fields: readonly ObjectFieldNode[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    values[field.name.value] = extractLiteral(field.value);
  }

  return values;
}

function extractLiteral(value: ValueNode): unknown {
  switch (value.kind) {
    case 'StringValue':
      return value.value;
    case 'IntValue':
      return Number.parseInt(value.value, 10);
    case 'FloatValue':
      return Number.parseFloat(value.value);
    case 'EnumValue':
      return value.value;
    default:
      throw new GraphqlRequestParseError('INVALID_GRAPHQL_ARGUMENTS', 422);
  }
}

export function parseAtualizarClienteGraphqlRequest(input: {
  contentType: string | null;
  body: string;
}): { source: GraphqlRequestSource; operation: AtualizarClienteOperation } {
  const source = determineSource(input.contentType);
  const query = readGraphqlQuery(source, input.body);

  let document;
  try {
    document = parse(query, { noLocation: true });
  } catch {
    throw new GraphqlRequestParseError('GRAPHQL_PARSE_FAILED', 400);
  }

  if (document.definitions.length !== 1) {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_OPERATION', 422);
  }

  const definition = document.definitions[0];
  if (
    definition?.kind !== 'OperationDefinition' ||
    definition.operation !== 'mutation' ||
    definition.name !== undefined ||
    (definition.variableDefinitions?.length ?? 0) > 0 ||
    (definition.directives?.length ?? 0) > 0
  ) {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_OPERATION', 422);
  }

  const field = expectSingleSelection(definition.selectionSet.selections);
  const fieldArguments = field.arguments ?? [];
  if (
    field.name.value !== 'atualizarCliente' ||
    field.alias !== undefined ||
    (field.directives?.length ?? 0) > 0
  ) {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_OPERATION', 422);
  }

  if (
    fieldArguments.length !== 1 ||
    fieldArguments[0]?.name.value !== 'cliente' ||
    fieldArguments[0].value.kind !== 'ObjectValue'
  ) {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_ARGUMENTS', 422);
  }

  const selection = field.selectionSet?.selections;
  if (
    selection === undefined ||
    selection.length !== 1 ||
    selection[0]?.kind !== 'Field' ||
    selection[0].name.value !== 'id' ||
    selection[0].alias !== undefined
  ) {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_SELECTION', 422);
  }

  const cliente = atualizarClienteInputSchema.safeParse(
    fieldMap(fieldArguments[0].value.fields),
  );
  if (!cliente.success) {
    throw new GraphqlRequestParseError('INVALID_GRAPHQL_ARGUMENTS', 422);
  }

  return {
    source,
    operation: {
      operation: 'mutation',
      field: 'atualizarCliente',
      cliente: cliente.data,
      selection: ['id'],
    },
  };
}
