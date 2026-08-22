import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  createRunRequestSchema,
  createRunResponseSchema,
  idempotencyKeySchema,
  restErrorResponseSchema,
  runListQuerySchema,
  runListResponseSchema,
  runResponseSchema,
  runStepListResponseSchema,
  runStepsQuerySchema,
} from '../contracts';
import type { Run, RunRepository, RunStep } from '../db/run-repository';
import type { Scheduler } from './scheduler';
import { hasValidAdminAuthorization } from './auth';
import {
  createRunOrchestrationService,
  RunServiceError,
  type CreateRunServiceResult,
} from './orchestration';

const REQUEST_BODY_LIMIT = 16_384;
const requestedBy = 'simulator-admin-api';

type RunService = {
  createRun(input: {
    idempotencyKey: string;
    request: z.infer<typeof createRunRequestSchema>;
  }): Promise<CreateRunServiceResult>;
};

type HandlerDependencies = {
  environment: Record<string, string | undefined>;
  repositoryFactory: () => RunRepository;
  scheduler?: Scheduler;
  serviceFactory?: (dependencies: {
    repository: RunRepository;
    scheduler?: Scheduler;
    idempotencyPepper: string;
    requestedBy: string;
  }) => RunService;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    restErrorResponseSchema.parse({
      error: { code, message, requestId: randomUUID() },
    }),
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function guard(
  request: Request,
  environment: Record<string, string | undefined>,
): Response | null {
  if (environment.ORCHESTRATION_ENABLED !== 'true') {
    return errorResponse(
      503,
      'ORCHESTRATION_DISABLED',
      'Orchestration is disabled',
    );
  }
  const key = environment.SIMULATOR_ADMIN_API_KEY;
  if (key === undefined || !hasValidAdminAuthorization(request.headers, key)) {
    return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
  }
  return null;
}

function parseQuery(
  request: Request,
  schema: z.ZodType,
): { success: true; data: unknown } | { success: false } {
  const entries = new URL(request.url).searchParams;
  const unique = new Map<string, string>();
  for (const [key, value] of entries) {
    if (unique.has(key)) return { success: false };
    unique.set(key, value);
  }
  const result = schema.safeParse(Object.fromEntries(unique));
  return result.success
    ? { success: true, data: result.data }
    : { success: false };
}

function toRunResponse(run: Run) {
  return runResponseSchema.parse({
    runId: run.id,
    status: run.status,
    scenarioKey: run.scenarioKey,
    scenarioVersion: run.scenarioVersion,
    dryRun: run.dryRun,
    createdAt: run.createdAt.toISOString(),
    stepsUrl: `/api/v1/runs/${run.id}/steps`,
  });
}

function toStepResponse(step: RunStep) {
  return {
    stepId: step.id,
    key: step.stepKey,
    ordinal: step.ordinal,
    kind: step.stepKind,
    target: step.target,
    eventType: step.eventType,
    status: step.status,
    scheduledAt: step.scheduledAt?.toISOString() ?? null,
    attemptCount: step.attemptCount,
  };
}

function pagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function createRunApiHandlers(dependencies: HandlerDependencies) {
  const getRepository = () => dependencies.repositoryFactory();

  return {
    async createRun(request: Request): Promise<Response> {
      const blocked = guard(request, dependencies.environment);
      if (blocked) return blocked;

      const idempotencyHeader = request.headers.get('idempotency-key');
      const idempotency = idempotencyKeySchema.safeParse(idempotencyHeader);
      if (!idempotency.success) {
        return errorResponse(
          422,
          'INVALID_REQUEST',
          'Invalid request parameters',
        );
      }

      let text: string;
      try {
        text = await request.text();
      } catch {
        return errorResponse(422, 'INVALID_REQUEST', 'Invalid request body');
      }
      if (text.length === 0 || text.length > REQUEST_BODY_LIMIT) {
        return errorResponse(422, 'INVALID_REQUEST', 'Invalid request body');
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return errorResponse(422, 'INVALID_REQUEST', 'Invalid request body');
      }
      const parsed = createRunRequestSchema.safeParse(json);
      if (!parsed.success) {
        return errorResponse(422, 'INVALID_REQUEST', 'Invalid request body');
      }
      if (
        !parsed.data.execution.dryRun &&
        dependencies.scheduler === undefined
      ) {
        return errorResponse(
          503,
          'SCHEDULER_NOT_CONFIGURED',
          'Scheduler is not configured',
        );
      }

      const pepper = dependencies.environment.IDEMPOTENCY_HASH_PEPPER;
      if (pepper === undefined || pepper.length < 32) {
        return errorResponse(
          503,
          'ORCHESTRATION_CONFIGURATION_ERROR',
          'Orchestration configuration is unavailable',
        );
      }

      try {
        const repository = getRepository();
        const factory =
          dependencies.serviceFactory ?? createRunOrchestrationService;
        const service = factory({
          repository,
          scheduler: dependencies.scheduler,
          idempotencyPepper: pepper,
          requestedBy,
        });
        const result = await service.createRun({
          idempotencyKey: idempotency.data,
          request: parsed.data,
        });
        return Response.json(
          createRunResponseSchema.parse({
            data: toRunResponse(result.run),
            replayed: result.outcome === 'REPLAY',
            ...(result.preview ? { preview: result.preview } : {}),
          }),
          { status: 202, headers: { 'Cache-Control': 'no-store' } },
        );
      } catch (error) {
        if (
          error instanceof RunServiceError ||
          (typeof error === 'object' && error !== null && 'code' in error)
        ) {
          const code = String((error as { code: unknown }).code);
          if (code === 'IDEMPOTENCY_CONFLICT') {
            return errorResponse(409, code, 'Idempotency conflict');
          }
          if (code === 'SCHEDULER_NOT_CONFIGURED') {
            return errorResponse(503, code, 'Scheduler is not configured');
          }
          if (code === 'SCENARIO_NOT_READY' || code === 'INVALID_VARIABLES') {
            return errorResponse(422, code, 'Run request is not valid');
          }
        }
        return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
      }
    },

    async listRuns(request: Request): Promise<Response> {
      const blocked = guard(request, dependencies.environment);
      if (blocked) return blocked;
      const parsed = parseQuery(request, runListQuerySchema);
      if (!parsed.success) {
        return errorResponse(422, 'INVALID_QUERY', 'Invalid query parameters');
      }
      const query = parsed.data as z.infer<typeof runListQuerySchema>;
      try {
        const result = await getRepository().listRuns({
          limit: query.pageSize,
          offset: (query.page - 1) * query.pageSize,
          filters: {
            ...(query.status ? { status: query.status } : {}),
            ...(query.scenarioKey ? { scenarioKey: query.scenarioKey } : {}),
            ...(query.createdFrom
              ? { createdFrom: new Date(query.createdFrom) }
              : {}),
            ...(query.createdTo
              ? { createdTo: new Date(query.createdTo) }
              : {}),
          },
        });
        return Response.json(
          runListResponseSchema.parse({
            data: result.items.map(toRunResponse),
            pagination: pagination(query.page, query.pageSize, result.total),
          }),
          { headers: { 'Cache-Control': 'no-store' } },
        );
      } catch {
        return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
      }
    },

    async getRun(request: Request, runId: string): Promise<Response> {
      const blocked = guard(request, dependencies.environment);
      if (blocked) return blocked;
      if (!z.string().uuid().safeParse(runId).success) {
        return errorResponse(404, 'RUN_NOT_FOUND', 'Run not found');
      }
      try {
        const run = await getRepository().findRun(runId);
        return run === null
          ? errorResponse(404, 'RUN_NOT_FOUND', 'Run not found')
          : Response.json(toRunResponse(run), {
              headers: { 'Cache-Control': 'no-store' },
            });
      } catch {
        return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
      }
    },

    async listRunSteps(request: Request, runId: string): Promise<Response> {
      const blocked = guard(request, dependencies.environment);
      if (blocked) return blocked;
      if (!z.string().uuid().safeParse(runId).success) {
        return errorResponse(404, 'RUN_NOT_FOUND', 'Run not found');
      }
      const parsed = parseQuery(request, runStepsQuerySchema);
      if (!parsed.success) {
        return errorResponse(422, 'INVALID_QUERY', 'Invalid query parameters');
      }
      const query = parsed.data as z.infer<typeof runStepsQuerySchema>;
      try {
        const repository = getRepository();
        const run = await repository.findRun(runId);
        if (run === null) {
          return errorResponse(404, 'RUN_NOT_FOUND', 'Run not found');
        }
        const result = await repository.listSteps(runId, {
          limit: query.pageSize,
          offset: (query.page - 1) * query.pageSize,
        });
        return Response.json(
          runStepListResponseSchema.parse({
            data: result.items.map(toStepResponse),
            pagination: pagination(query.page, query.pageSize, result.total),
          }),
          { headers: { 'Cache-Control': 'no-store' } },
        );
      } catch {
        return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
      }
    },
  };
}
