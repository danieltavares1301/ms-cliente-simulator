import { randomUUID } from 'node:crypto';

import {
  restErrorResponseSchema,
  type AtualizarClienteInput,
} from '../contracts';
import type { RunRepository } from '../db/run-repository';
import { hasValidAdminAuthorization } from '../runs/auth';
import {
  createGraphqlCorrelationHashes,
  DEFAULT_GRAPHQL_RESPONSE_POLICY,
  resolveGraphqlResponseDelayMs,
  resolveGraphqlResponsePolicy,
  summarizeCorrelation,
} from './correlation';
import {
  GraphqlRequestParseError,
  parseAtualizarClienteGraphqlRequest,
} from './parser';
import { buildGraphqlPolicyResponse } from './policy';

const REQUEST_BODY_LIMIT_BYTES = 16_384;
const actor = 'graphql-callback';

type GraphqlCallbackHandlerDependencies = {
  environment: Record<string, string | undefined>;
  repositoryFactory: () => RunRepository;
  now?: () => Date;
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

function emptyCorrelationHashes(pepper: string) {
  return createGraphqlCorrelationHashes({
    cliente: {
      id: undefined,
      idProspectSalesforce: undefined,
    },
    pepper,
  });
}

function requestFieldNames(cliente: AtualizarClienteInput): string[] {
  return Object.keys(cliente).sort();
}

export function createGraphqlCallbackHandler(
  dependencies: GraphqlCallbackHandlerDependencies,
): (request: Request) => Promise<Response> {
  const now = dependencies.now ?? (() => new Date());
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request): Promise<Response> => {
    if (dependencies.environment.ORCHESTRATION_ENABLED !== 'true') {
      return errorResponse(
        503,
        'ORCHESTRATION_DISABLED',
        'Orchestration is disabled',
        requestIdFactory(),
      );
    }
    if (dependencies.environment.GRAPHQL_CALLBACK_ENABLED !== 'true') {
      return errorResponse(
        503,
        'GRAPHQL_CALLBACK_DISABLED',
        'GraphQL callback is disabled',
        requestIdFactory(),
      );
    }

    const expectedToken =
      dependencies.environment.GRAPHQL_CALLBACK_SHARED_SECRET;
    if (expectedToken === undefined || expectedToken.length < 32) {
      return errorResponse(
        503,
        'GRAPHQL_CALLBACK_CONFIGURATION_ERROR',
        'GraphQL callback configuration is unavailable',
        requestIdFactory(),
      );
    }
    if (!hasValidAdminAuthorization(request.headers, expectedToken)) {
      return errorResponse(
        401,
        'UNAUTHORIZED',
        'Unauthorized',
        requestIdFactory(),
      );
    }

    const pepper = dependencies.environment.IDEMPOTENCY_HASH_PEPPER;
    if (pepper === undefined || pepper.length < 32) {
      return errorResponse(
        503,
        'GRAPHQL_CALLBACK_CONFIGURATION_ERROR',
        'GraphQL callback configuration is unavailable',
        requestIdFactory(),
      );
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(
        400,
        'INVALID_REQUEST',
        'Invalid GraphQL request',
        requestIdFactory(),
      );
    }

    if (
      rawBody.length === 0 ||
      new TextEncoder().encode(rawBody).byteLength > REQUEST_BODY_LIMIT_BYTES
    ) {
      return errorResponse(
        413,
        'INVALID_REQUEST',
        'Invalid GraphQL request',
        requestIdFactory(),
      );
    }

    const repository = dependencies.repositoryFactory();
    const startedAt = now();
    const requestId = requestIdFactory();

    try {
      const parsed = parseAtualizarClienteGraphqlRequest({
        contentType: request.headers.get('content-type'),
        body: rawBody,
      });
      const hashes = createGraphqlCorrelationHashes({
        cliente: parsed.operation.cliente,
        pepper,
      });
      const correlation = await repository.findCorrelatableRun({
        idClienteUpper: hashes.idClienteUpper,
        idProspectUpper: hashes.idProspectUpper,
        limit: 50,
      });
      const policy = resolveGraphqlResponsePolicy(correlation?.run);
      const delayMs = resolveGraphqlResponseDelayMs(correlation?.run);
      const response = await buildGraphqlPolicyResponse({
        policy,
        clienteId:
          parsed.operation.cliente.id ??
          hashes.idClienteUpper ??
          'GRAPHQL-CALLBACK-FALLBACK',
        delayedResponseMs: delayMs,
      });

      await repository.recordGraphqlCallback({
        runId: correlation?.run.id ?? null,
        requestId,
        operationName: parsed.operation.field,
        idClienteHash: hashes.idClienteHash,
        idProspectHash: hashes.idProspectHash,
        normalizedCorrelationKeyHash: hashes.normalizedCorrelationKeyHash,
        policy,
        httpStatus: response.response.status,
        requestRedacted: {
          source: parsed.source,
          fieldNames: requestFieldNames(parsed.operation.cliente),
          ...summarizeCorrelation(correlation),
        },
        responseRedacted: response.responseRedacted,
        durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
        actor,
        receivedAt: startedAt,
      });

      return response.response;
    } catch (error) {
      if (!(error instanceof GraphqlRequestParseError)) {
        return errorResponse(
          503,
          'GRAPHQL_CALLBACK_PERSISTENCE_FAILED',
          'GraphQL callback persistence failed',
          requestId,
        );
      }

      const hashes = emptyCorrelationHashes(pepper);
      try {
        await repository.recordGraphqlCallback({
          runId: null,
          requestId,
          operationName: 'INVALID',
          idClienteHash: hashes.idClienteHash,
          idProspectHash: hashes.idProspectHash,
          normalizedCorrelationKeyHash: hashes.normalizedCorrelationKeyHash,
          policy: DEFAULT_GRAPHQL_RESPONSE_POLICY,
          httpStatus: error.status,
          requestRedacted: {
            source:
              request.headers.get('content-type')?.split(';', 1)[0]?.trim() ??
              'unknown',
            errorCode: error.code,
          },
          responseRedacted: {
            kind: 'INVALID_REQUEST',
            status: error.status,
          },
          durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
          actor,
          receivedAt: startedAt,
        });
      } catch {
        return errorResponse(
          503,
          'GRAPHQL_CALLBACK_PERSISTENCE_FAILED',
          'GraphQL callback persistence failed',
          requestId,
        );
      }

      return errorResponse(
        error.status,
        'INVALID_REQUEST',
        'Invalid GraphQL request',
        requestId,
      );
    }
  };
}
