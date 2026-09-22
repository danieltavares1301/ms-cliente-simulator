import { randomUUID } from 'node:crypto';

import {
  contestacaoInsertRequestSchema,
  restErrorResponseSchema,
} from '../contracts';

const REQUEST_BODY_LIMIT_BYTES = 4_096;
const bearerAuthorizationPrefix = 'Bearer ';

type ContestacaoInsertCallbackHandlerDependencies = {
  environment: Record<string, string | undefined>;
  requestIdFactory?: () => string;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response {
  return Response.json(
    restErrorResponseSchema.parse({
      error: { code, message, requestId },
    }),
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

function hasStructurallyValidBearerAuthorization(
  authorizationHeaderValue: string | null,
): boolean {
  return (
    authorizationHeaderValue !== null &&
    authorizationHeaderValue.startsWith(bearerAuthorizationPrefix) &&
    authorizationHeaderValue.length > bearerAuthorizationPrefix.length
  );
}

export function createContestacaoInsertCallbackHandler(
  dependencies: ContestacaoInsertCallbackHandlerDependencies,
): (request: Request) => Promise<Response> {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request): Promise<Response> => {
    if (dependencies.environment.ORCHESTRATION_ENABLED !== 'true') {
      return errorResponse(
        503,
        'CONTESTACAO_INSERT_CALLBACK_DISABLED',
        'Contestacao insert callback is disabled',
        requestIdFactory(),
      );
    }

    if (
      dependencies.environment.CONTESTACAO_INSERT_CALLBACK_ENABLED !== 'true'
    ) {
      return errorResponse(
        503,
        'CONTESTACAO_INSERT_CALLBACK_DISABLED',
        'Contestacao insert callback is disabled',
        requestIdFactory(),
      );
    }

    if (
      !hasStructurallyValidBearerAuthorization(
        request.headers.get('authorization'),
      )
    ) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        'Unauthorized',
        requestIdFactory(),
      );
    }

    let rawBody = '';
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(
        422,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    if (
      rawBody.length === 0 ||
      new TextEncoder().encode(rawBody).byteLength > REQUEST_BODY_LIMIT_BYTES
    ) {
      return errorResponse(
        422,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return errorResponse(
        422,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    const parsed = contestacaoInsertRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(
        422,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    const requestId = requestIdFactory();
    const contestacaoId = requestId;
    console.log(
      JSON.stringify({
        event: 'contestacao-insert-callback.accepted',
        requestId,
        contestacaoId,
        receivedAt: new Date().toISOString(),
        responseStatusCode: 201,
        ...parsed.data,
      }),
    );

    return Response.json(
      {
        id: contestacaoId,
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  };
}
