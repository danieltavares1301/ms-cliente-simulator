import { randomUUID } from 'node:crypto';

import { restErrorResponseSchema } from '../contracts';

const REQUEST_BODY_LIMIT_BYTES = 2_048;

type AzureTokenSimulatorHandlerDependencies = {
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

function parseOAuthClientCredentialsForm(body: string): void {
  try {
    const form = new URLSearchParams(body);
    form.get('grant_type');
    form.get('client_id');
    form.get('client_secret');
  } catch {
    // Tolerante por design: client_id/client_secret são fake no fluxo de dev.
  }
}

export function createAzureTokenSimulatorHandler(
  dependencies: AzureTokenSimulatorHandlerDependencies,
): (request: Request) => Promise<Response> {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request): Promise<Response> => {
    // SECURITY WARNING:
    // This endpoint intentionally has no authentication beyond the feature flag.
    // While enabled, any public request that reaches it receives the current
    // GRAPHQL_CALLBACK_SHARED_SECRET, which makes that value effectively public
    // and reduces SHARED_SECRET callback mode to an operational toggle only.
    if (dependencies.environment.ORCHESTRATION_ENABLED !== 'true') {
      return errorResponse(
        503,
        'AZURE_TOKEN_SIMULATOR_DISABLED',
        'Azure token simulator is disabled',
        requestIdFactory(),
      );
    }

    if (dependencies.environment.AZURE_TOKEN_SIMULATOR_ENABLED !== 'true') {
      return errorResponse(
        503,
        'AZURE_TOKEN_SIMULATOR_DISABLED',
        'Azure token simulator is disabled',
        requestIdFactory(),
      );
    }

    const sharedSecret =
      dependencies.environment.GRAPHQL_CALLBACK_SHARED_SECRET;
    if (sharedSecret === undefined || sharedSecret.length < 32) {
      return errorResponse(
        503,
        'AZURE_TOKEN_SIMULATOR_CONFIGURATION_ERROR',
        'Azure token simulator configuration is unavailable',
        requestIdFactory(),
      );
    }

    let rawBody = '';
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    if (
      new TextEncoder().encode(rawBody).byteLength > REQUEST_BODY_LIMIT_BYTES
    ) {
      return errorResponse(
        413,
        'INVALID_REQUEST',
        'Invalid request body',
        requestIdFactory(),
      );
    }

    parseOAuthClientCredentialsForm(rawBody);

    return Response.json(
      {
        access_token: sharedSecret,
        token_type: 'Bearer',
        expires_in: 3600,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  };
}
