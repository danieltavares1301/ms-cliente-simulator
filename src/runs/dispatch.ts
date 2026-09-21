import { randomUUID } from 'node:crypto';

import { Receiver } from '@upstash/qstash';
import { z } from 'zod';

import type { EventGridEnvelope } from '../contracts';
import { restErrorResponseSchema } from '../contracts';
import type { RunRepository } from '../db/run-repository';
import type { SalesforceTestDataAdapter } from '../salesforce/test-data-adapter';
import {
  createSalesforceLifecycleService,
  type PostDispatchLifecycleResult,
} from './salesforce-lifecycle';

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
  dispatch(input: DispatchRequest & { envelope: EventGridEnvelope }): Promise<{
    httpStatus: number;
    durationMs: number;
    responseRedacted: Record<string, unknown>;
  }>;
}

export class FakeSalesforceDispatchTarget implements DispatchTarget {
  async dispatch(
    input: DispatchRequest & { envelope: EventGridEnvelope },
  ): Promise<{
    httpStatus: number;
    durationMs: number;
    responseRedacted: Record<string, unknown>;
  }> {
    void input;
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
  target?: DispatchTarget;
  fakeTarget?: DispatchTarget;
  salesforceTarget?: DispatchTarget;
  testDataAdapter?: SalesforceTestDataAdapter;
  lifecycleServiceFactory?: (dependencies: {
    repository: RunRepository;
    adapter: SalesforceTestDataAdapter;
    actor: string;
    now: () => Date;
  }) => {
    afterDispatch(runId: string): Promise<PostDispatchLifecycleResult>;
    compensate?(runId: string): Promise<{
      outcome: 'SUCCEEDED' | 'FAILED' | 'NOT_FOUND';
    }>;
  };
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
    let run;
    try {
      run = await repository.findRun(parsed.data.runId);
    } catch {
      return errorResponse(
        503,
        'DISPATCH_PERSISTENCE_FAILED',
        'Dispatch state persistence failed',
        { 'Retry-After': '1' },
      );
    }
    if (run === null) {
      return errorResponse(404, 'DISPATCH_NOT_FOUND', 'Dispatch not found');
    }
    if (
      run.dispatchMode === 'SALESFORCE' &&
      dependencies.environment.SALESFORCE_DISPATCH_ENABLED !== 'true'
    ) {
      return errorResponse(
        503,
        'SALESFORCE_DISPATCH_DISABLED',
        'Salesforce dispatch is temporarily disabled',
        { 'Retry-After': '60' },
      );
    }
    if (
      run.testDataEnabled &&
      dependencies.environment.SALESFORCE_TEST_DATA_ENABLED !== 'true'
    ) {
      return errorResponse(
        503,
        'SALESFORCE_TEST_DATA_DISABLED',
        'Salesforce test data lifecycle is temporarily disabled',
        { 'Retry-After': '60' },
      );
    }
    const target =
      run.dispatchMode === 'SALESFORCE'
        ? (dependencies.salesforceTarget ?? dependencies.target)
        : (dependencies.fakeTarget ?? dependencies.target);
    if (target === undefined) {
      return errorResponse(
        503,
        'DISPATCH_TARGET_NOT_CONFIGURED',
        'Dispatch target is not configured',
        { 'Retry-After': '60' },
      );
    }
    const resumeLifecycle =
      async (): Promise<PostDispatchLifecycleResult | null> => {
        if (!run.testDataEnabled) {
          return null;
        }
        if (dependencies.testDataAdapter === undefined) {
          throw new Error('Salesforce test data adapter is not configured');
        }
        const factory =
          dependencies.lifecycleServiceFactory ??
          createSalesforceLifecycleService;
        return factory({
          repository,
          adapter: dependencies.testDataAdapter,
          actor: 'qstash-dispatch',
          now,
        }).afterDispatch(parsed.data.runId);
      };
    const lifecycleRetryResponse = (
      lifecycle: PostDispatchLifecycleResult | null,
    ): Response | null => {
      if (
        lifecycle?.outcome === 'IN_PROGRESS' ||
        lifecycle?.outcome === 'NOT_READY' ||
        lifecycle?.outcome === 'STALE'
      ) {
        return errorResponse(
          409,
          'LIFECYCLE_IN_PROGRESS',
          'Salesforce test data lifecycle is still running',
          { 'Retry-After': '60' },
        );
      }
      if (lifecycle?.outcome === 'NOT_FOUND') {
        return errorResponse(
          503,
          'LIFECYCLE_PERSISTENCE_FAILED',
          'Salesforce test data lifecycle persistence failed',
          { 'Retry-After': '1' },
        );
      }
      return null;
    };
    const claimedAt = now();
    let claim: Awaited<ReturnType<RunRepository['claimDispatch']>>;
    try {
      claim = await repository.claimDispatch({
        ...parsed.data,
        claimedAt,
      });
    } catch {
      return errorResponse(
        503,
        'DISPATCH_PERSISTENCE_FAILED',
        'Dispatch state persistence failed',
        { 'Retry-After': '1' },
      );
    }

    if (claim.outcome === 'TERMINAL') {
      try {
        const retry = lifecycleRetryResponse(await resumeLifecycle());
        if (retry !== null) return retry;
      } catch {
        return errorResponse(
          503,
          'LIFECYCLE_PERSISTENCE_FAILED',
          'Salesforce test data lifecycle persistence failed',
          { 'Retry-After': '1' },
        );
      }
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
    let envelope: EventGridEnvelope | null;
    try {
      envelope = await repository.getDispatchPayload({
        runId: parsed.data.runId,
        stepId: parsed.data.stepId,
      });
    } catch {
      return errorResponse(
        503,
        'DISPATCH_PERSISTENCE_FAILED',
        'Dispatch payload persistence failed',
        { 'Retry-After': '1' },
      );
    }
    if (envelope === null) {
      return errorResponse(
        503,
        'DISPATCH_PERSISTENCE_FAILED',
        'Dispatch payload persistence failed',
        { 'Retry-After': '1' },
      );
    }

    let targetFailed = false;
    let result: Awaited<ReturnType<DispatchTarget['dispatch']>>;
    try {
      result = await target.dispatch({
        ...parsed.data,
        envelope,
      });
    } catch {
      targetFailed = true;
      result = {
        httpStatus: 500,
        durationMs: Math.max(0, now().getTime() - claimedAt.getTime()),
        responseRedacted: {
          transport: 'FAKE_SALESFORCE',
          network: false,
        },
      };
    }

    let completion: Awaited<ReturnType<RunRepository['completeDispatch']>>;
    try {
      completion = await repository.completeDispatch({
        ...parsed.data,
        requestId,
        httpStatus: result.httpStatus,
        durationMs: result.durationMs,
        responseRedacted: result.responseRedacted,
        errorCode: targetFailed ? 'DISPATCH_TARGET_FAILED' : null,
        finishedAt: now(),
      });
    } catch {
      return errorResponse(
        503,
        'DISPATCH_PERSISTENCE_FAILED',
        'Dispatch result persistence failed',
        { 'Retry-After': '1' },
      );
    }

    if (completion.runStatus === 'VERIFYING') {
      try {
        const retry = lifecycleRetryResponse(await resumeLifecycle());
        if (retry !== null) return retry;
      } catch {
        return errorResponse(
          503,
          'LIFECYCLE_PERSISTENCE_FAILED',
          'Salesforce test data lifecycle persistence failed',
          { 'Retry-After': '1' },
        );
      }
    } else if (
      run.testDataEnabled &&
      (completion.runStatus === 'FAILED' || completion.runStatus === 'PARTIAL')
    ) {
      try {
        if (dependencies.testDataAdapter === undefined) {
          throw new Error('Salesforce test data adapter is not configured');
        }
        const factory =
          dependencies.lifecycleServiceFactory ??
          createSalesforceLifecycleService;
        const compensation = await factory({
          repository,
          adapter: dependencies.testDataAdapter,
          actor: 'qstash-dispatch',
          now,
        }).compensate?.(parsed.data.runId);
        if (compensation?.outcome === 'FAILED') {
          return errorResponse(
            503,
            'LIFECYCLE_CLEANUP_FAILED',
            'Salesforce test data cleanup failed',
            { 'Retry-After': '60' },
          );
        }
      } catch {
        return errorResponse(
          503,
          'LIFECYCLE_PERSISTENCE_FAILED',
          'Salesforce test data lifecycle persistence failed',
          { 'Retry-After': '1' },
        );
      }
    }

    if (targetFailed) {
      return errorResponse(
        503,
        'DISPATCH_TARGET_FAILED',
        'Dispatch target failed',
        { 'Retry-After': '1' },
      );
    }

    return Response.json(
      { accepted: true, noop: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  };
}
