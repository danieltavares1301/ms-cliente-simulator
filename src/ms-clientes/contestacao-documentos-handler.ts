import { randomUUID } from 'node:crypto';

import {
  contestacaoDocumentosRequestSchema,
  restErrorResponseSchema,
} from '../contracts';

const REQUEST_BODY_LIMIT_BYTES = 4_096;
const bearerAuthorizationPrefix = 'Bearer ';

type ContestacaoDocumentosCallbackHandlerDependencies = {
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

export function createContestacaoDocumentosCallbackHandler(
  dependencies: ContestacaoDocumentosCallbackHandlerDependencies,
): (request: Request) => Promise<Response> {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request): Promise<Response> => {
    if (dependencies.environment.ORCHESTRATION_ENABLED !== 'true') {
      return errorResponse(
        503,
        'CONTESTACAO_DOCUMENTOS_CALLBACK_DISABLED',
        'Contestacao documentos callback is disabled',
        requestIdFactory(),
      );
    }

    if (
      dependencies.environment.CONTESTACAO_DOCUMENTOS_CALLBACK_ENABLED !==
      'true'
    ) {
      return errorResponse(
        503,
        'CONTESTACAO_DOCUMENTOS_CALLBACK_DISABLED',
        'Contestacao documentos callback is disabled',
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

    const parsed = contestacaoDocumentosRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(
        422,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    const requestId = requestIdFactory();
    // Minimization: MotivoContestacao is real free text submitted by end
    // users and must never reach the plaintext log stream. Only a boolean
    // presence flag is logged for observability.
    const { MotivoContestacao, ...loggableFields } = parsed.data;
    console.log(
      JSON.stringify({
        event: 'contestacao-documentos-callback.accepted',
        requestId,
        receivedAt: new Date().toISOString(),
        responseStatusCode: 201,
        ...loggableFields,
        motivoContestacaoProvided:
          typeof MotivoContestacao === 'string' &&
          MotivoContestacao.length > 0,
      }),
    );

    return Response.json(
      {
        accepted: true,
        requestId,
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  };
}
