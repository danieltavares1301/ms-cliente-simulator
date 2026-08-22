import { randomUUID } from 'node:crypto';

import { Receiver } from '@upstash/qstash';
import { z } from 'zod';

import { restErrorResponseSchema } from '../contracts';
import type { RunRepository } from '../db/run-repository';

const REQUEST_BODY_LIMIT_BYTES = 16_384;

const dispatchRequestSchema = z
  .object({
    runId: z.string().uuid(),
    stepId: z.string().uuid(),
    attemptNumber: z.number().int().positive().max(1_000),
  })
  .strict();

export type DispatchRequest = z.infer<typeof dispatchRequestSchema>;

export interface DispatchReceiver {
  verify(input: {
    signature: string;
    body: string;
    url?: string;
  }): Promise<boolean>;
}

export interface DispatchTarget {
  dispatch(input: DispatchRequest): Promise<{
    httpStatus: number;
    durationMs: number;
    responseRedacted: Record<string, unknown>;
  }>;
}

export class FakeSalesforceDispatchTarget implements DispatchTarget {
  async dispatch(): Promise<{
    httpStatus: number;
    durationMs: number;
    responseRedacted: Record<string, unknown>;
  }> {
    return {
      httpStatus: 200,
      durationMs: 0,
      responseRedacted: {
        transport: 'FAKE_SALESFORCE',
        network: false,
      },
    };
  }
}

export function createQStashReceiver(input: {
  currentSigningKey: string;
  nextSigningKey: string;
}): DispatchReceiver {
  return new Receiver(input);
}

type DispatchHandlerDependencies = {
  environment: Record<string, string | undefined>;
  repositoryFactory: () => RunRepository;
  receiverFactory: () => DispatchReceiver;
  target: DispatchTarget;
  now?: () => Date;
  requestIdFactory?: () => string;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  extraHeaders: HeadersInit = {},
): Response {
  return Response.json(
    restErrorResponseSchema.parse({
      error: { code, message, requestId: randomUUID() },
    }),
    {
      status,
      headers: { 'Cache-Control': 'no-store', ...extraHeaders },
    },
  );
}

export function createDispatchHandler(
  dependencies: DispatchHandlerDependencies,
): (request: Request) => Promise<Response> {
  const now = dependencies.now ?? (() => new Date());
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request): Promise<Response> => {
    if (dependencies.environment.ORCHESTRATION_ENABLED !== 'true') {
      return errorResponse(
        503,
        'ORCHESTRATION_DISABLED',
        'Orchestration is disabled',
      );
    }

    const signature = request.headers.get('upstash-signature');
    if (
      signature === null ||
      signature.length === 0 ||
      signature.includes(',')
    ) {
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    let verified = false;
    try {
      verified = await dependencies.receiverFactory().verify({
        signature,
        body: rawBody,
        url: request.url,
      });
    } catch {
      verified = false;
    }
    if (!verified) {
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    if (
      rawBody.length === 0 ||
      new TextEncoder().encode(rawBody).byteLength > REQUEST_BODY_LIMIT_BYTES
    ) {
      return errorResponse(413, 'INVALID_REQUEST', 'Invalid request body');
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid request body');
    }
    const parsed = dispatchRequestSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(422, 'INVALID_REQUEST', 'Invalid request body');
    }

    const repository = dependencies.repositoryFactory();
    const claimedAt = now();
    const claim = await repository.claimDispatch({
      ...parsed.data,
      claimedAt,
    });

    if (claim.outcome === 'TERMINAL') {
      return Response.json(
        { accepted: true, noop: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (claim.outcome === 'ALREADY_RUNNING') {
      return errorResponse(
        409,
        'DISPATCH_ALREADY_RUNNING',
        'Dispatch attempt is already running',
        { 'Retry-After': '1' },
      );
    }
    if (claim.outcome === 'OUT_OF_ORDER') {
      return errorResponse(
        409,
        'DISPATCH_OUT_OF_ORDER',
        'Prior dispatch step is not complete',
        { 'Retry-After': '1' },
      );
    }
    if (claim.outcome === 'NOT_FOUND') {
      return errorResponse(404, 'DISPATCH_NOT_FOUND', 'Dispatch not found');
    }
    if (claim.outcome === 'ATTEMPT_CONFLICT') {
      return errorResponse(
        409,
        'DISPATCH_ATTEMPT_CONFLICT',
        'Dispatch attempt conflict',
      );
    }

    const requestId = requestIdFactory();
    try {
      const result = await dependencies.target.dispatch(parsed.data);
      await repository.completeDispatch({
        ...parsed.data,
        requestId,
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
        responseRedacted: result.responseRedacted,
        errorCode: null,
        finishedAt: now(),
      });
      return Response.json(
        { accepted: true, noop: false },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch {
      await repository.completeDispatch({
        ...parsed.data,
        requestId,
        httpStatus: 500,
        durationMs: Math.max(0, now().getTime() - claimedAt.getTime()),
        responseRedacted: {
          transport: 'FAKE_SALESFORCE',
          network: false,
        },
        errorCode: 'DISPATCH_TARGET_FAILED',
        finishedAt: now(),
      });
      return errorResponse(
        503,
        'DISPATCH_TARGET_FAILED',
        'Dispatch target failed',
        { 'Retry-After': '1' },
      );
    }
  };
}
