import { randomUUID } from 'node:crypto';

import {
  pacCreditoRequestSchema,
  restErrorResponseSchema,
} from '../contracts';

const REQUEST_BODY_LIMIT_BYTES = 4_096;
const sharedAccessSignaturePrefix = 'SharedAccessSignature';

type PacCreditoCallbackHandlerDependencies = {
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

function hasStructurallyValidSasAuthorization(
  authorizationHeaderValue: string | null,
): boolean {
  return (
    authorizationHeaderValue !== null &&
    authorizationHeaderValue.startsWith(sharedAccessSignaturePrefix)
  );
}

/**
 * Fire-and-forget callback used by Apex EnvioPACCreditoQueue: the Salesforce
 * side logs non-201 responses but does not treat them as critical failures.
 * The SAS validation here is intentionally structural, not cryptographic,
 * because the redirected dev-org credentials will be placeholders after the
 * change documented in docs/phase-7/pac-credito-callback-redirect-risks.md.
 */
export function createPacCreditoCallbackHandler(
  dependencies: PacCreditoCallbackHandlerDependencies,
): (request: Request) => Promise<Response> {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request): Promise<Response> => {
    if (dependencies.environment.ORCHESTRATION_ENABLED !== 'true') {
      return errorResponse(
        503,
        'PAC_CREDITO_CALLBACK_DISABLED',
        'PAC credito callback is disabled',
        requestIdFactory(),
      );
    }

    if (dependencies.environment.PAC_CREDITO_CALLBACK_ENABLED !== 'true') {
      return errorResponse(
        503,
        'PAC_CREDITO_CALLBACK_DISABLED',
        'PAC credito callback is disabled',
        requestIdFactory(),
      );
    }

    if (
      !hasStructurallyValidSasAuthorization(
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

    const parsed = pacCreditoRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(
        422,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    const requestId = requestIdFactory();
    console.log(
      JSON.stringify({
        event: 'pac-credito-callback.accepted',
        requestId,
        receivedAt: new Date().toISOString(),
        ...parsed.data,
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
