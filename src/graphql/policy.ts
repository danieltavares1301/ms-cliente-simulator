import {
  graphqlErrorResponseSchema,
  graphqlSuccessResponseSchema,
  type GraphqlResponsePolicy,
} from '../contracts';
import {
  DEFAULT_DELAYED_RESPONSE_MS,
  DEFAULT_GRAPHQL_RESPONSE_POLICY,
} from './correlation';

export { DEFAULT_DELAYED_RESPONSE_MS, DEFAULT_GRAPHQL_RESPONSE_POLICY };

export const MAX_DELAYED_RESPONSE_MS = 4_000;

type GraphqlPolicyResult = {
  response: Response;
  responseRedacted: Record<string, unknown>;
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function createGraphqlPolicyResponse(input: {
  policy: GraphqlResponsePolicy;
  clienteId: string;
  delayedResponseMs?: number;
}): Promise<Response> {
  const result = await buildGraphqlPolicyResponse(input);
  return result.response;
}

export async function buildGraphqlPolicyResponse(input: {
  policy: GraphqlResponsePolicy;
  clienteId: string;
  delayedResponseMs?: number;
}): Promise<GraphqlPolicyResult> {
  switch (input.policy) {
    case 'SUCCESS_200':
    case 'SUCCESS_201': {
      const body = graphqlSuccessResponseSchema.parse({
        data: { atualizarCliente: { id: input.clienteId } },
      });
      const status = input.policy === 'SUCCESS_200' ? 200 : 201;
      return {
        response: Response.json(body, { status }),
        responseRedacted: {
          kind: 'GRAPHQL_SUCCESS',
          bodyKind: 'json',
        },
      };
    }
    case 'GRAPHQL_ERROR_200': {
      const body = graphqlErrorResponseSchema.parse({
        errors: [{ message: 'Simulated GraphQL callback failure' }],
      });
      return {
        response: Response.json(body, { status: 200 }),
        responseRedacted: {
          kind: 'GRAPHQL_ERROR',
          bodyKind: 'json',
        },
      };
    }
    case 'HTTP_400':
    case 'HTTP_401':
    case 'HTTP_429':
    case 'HTTP_500': {
      const status = Number.parseInt(input.policy.slice(5), 10);
      return {
        response: Response.json(
          { error: 'Simulated callback failure' },
          { status },
        ),
        responseRedacted: {
          kind: 'HTTP_ERROR',
          bodyKind: 'json',
        },
      };
    }
    case 'INVALID_JSON_200':
      return {
        response: new Response('{"data":', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        responseRedacted: {
          kind: 'INVALID_JSON',
          bodyKind: 'invalid-json',
        },
      };
    case 'EMPTY_BODY_200':
      return {
        response: new Response(null, { status: 200 }),
        responseRedacted: {
          kind: 'EMPTY_BODY',
          bodyKind: 'empty',
        },
      };
    case 'DELAYED_RESPONSE': {
      const delayMs = Math.min(
        Math.max(input.delayedResponseMs ?? DEFAULT_DELAYED_RESPONSE_MS, 0),
        MAX_DELAYED_RESPONSE_MS,
      );
      await sleep(delayMs);
      const body = graphqlSuccessResponseSchema.parse({
        data: { atualizarCliente: { id: input.clienteId } },
      });
      return {
        response: Response.json(body, { status: 200 }),
        responseRedacted: {
          kind: 'DELAYED_SUCCESS',
          bodyKind: 'json',
          delayedMs: delayMs,
        },
      };
    }
    default: {
      const exhaustive: never = input.policy;
      return exhaustive;
    }
  }
}
