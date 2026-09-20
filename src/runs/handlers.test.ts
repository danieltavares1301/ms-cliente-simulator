import { describe, expect, it, vi } from 'vitest';

import { restErrorResponseSchema } from '../contracts';
import type { RunRepository } from '../db/run-repository';
import { RunAdministrationError } from './administration';
import { createRunApiHandlers } from './handlers';
import type { Scheduler } from './scheduler';

const adminKey = 'admin-key-that-is-at-least-32-chars';
const enabledEnvironment = {
  ORCHESTRATION_ENABLED: 'true',
  SIMULATOR_ADMIN_API_KEY: adminKey,
  IDEMPOTENCY_HASH_PEPPER: 'pepper-that-is-at-least-32-characters',
};
const validBody = {
  scenarioKey: 'match-id-cliente',
  scenarioVersion: 1,
  variables: {
    seed: 'TC001-A',
    eventStartAt: '2026-08-21T10:00:00Z',
  },
  execution: { dryRun: true, speed: 1, stopOnFailure: true },
};

function request(
  url: string,
  init: RequestInit = {},
  key: string | null = adminKey,
): Request {
  const headers = new Headers(init.headers);
  if (key !== null) headers.set('authorization', `Bearer ${key}`);
  return new Request(url, { ...init, headers });
}

describe('protected runs API handlers', () => {
  it('returns 503 before creating repository dependencies when the feature is off', async () => {
    const repositoryFactory = vi.fn();
    const handlers = createRunApiHandlers({
      environment: { ORCHESTRATION_ENABLED: 'false' },
      repositoryFactory,
    });

    const response = await handlers.listRuns(
      new Request('http://localhost/api/v1/runs'),
    );

    expect(response.status).toBe(503);
    expect(repositoryFactory).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      error: { code: 'ORCHESTRATION_DISABLED' },
    });
  });

  it.each<[string | null, HeadersInit | undefined]>([
    [null, undefined],
    ['wrong-key-that-is-at-least-32-chars', undefined],
    [null, [['authorization', `Bearer ${adminKey}, Bearer ${adminKey}`]]],
    [null, [['authorization', `Basic ${adminKey}`]]],
  ])(
    'returns the same 401 for absent, invalid, duplicate or malformed auth',
    async (key, rawHeaders) => {
      const repositoryFactory = vi.fn();
      const handlers = createRunApiHandlers({
        environment: enabledEnvironment,
        repositoryFactory,
      });
      const response = await handlers.listRuns(
        request(
          'http://localhost/api/v1/runs',
          rawHeaders ? { headers: rawHeaders } : {},
          key,
        ),
      );
      const body: unknown = await response.json();

      expect(response.status).toBe(401);
      expect(restErrorResponseSchema.parse(body)).toStrictEqual(body);
      expect(body).toMatchObject({
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      });
      expect(JSON.stringify(body)).not.toContain(adminKey);
      expect(repositoryFactory).not.toHaveBeenCalled();
    },
  );

  it('returns 422 for a strict invalid body and never reflects the request', async () => {
    const repositoryFactory = vi.fn();
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory,
    });
    const response = await handlers.createRun(
      request('http://localhost/api/v1/runs', {
        method: 'POST',
        headers: { 'idempotency-key': '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({ ...validBody, unexpected: adminKey }),
      }),
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(422);
    expect(serialized).not.toContain(adminKey);
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key to be a UUID as defined by the API plan', async () => {
    const repositoryFactory = vi.fn();
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory,
    });
    const response = await handlers.createRun(
      request('http://localhost/api/v1/runs', {
        method: 'POST',
        headers: { 'idempotency-key': 'not-a-uuid' },
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(422);
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('fails closed for non-dry creation before opening the repository', async () => {
    const repositoryFactory = vi.fn();
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory,
    });
    const response = await handlers.createRun(
      request('http://localhost/api/v1/runs', {
        method: 'POST',
        headers: { 'idempotency-key': '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({
          ...validBody,
          execution: { ...validBody.execution, dryRun: false },
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'SCHEDULER_NOT_CONFIGURED' },
    });
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('returns 202 for creation and replay and 409 for an idempotency conflict', async () => {
    const run = {
      id: '11111111-1111-4111-8111-111111111111',
      scenarioKey: 'match-id-cliente',
      scenarioVersion: 1,
      status: 'CREATED',
      dryRun: true,
      createdAt: new Date('2026-08-22T12:00:00.000Z'),
      fixtureSnapshot: { privateMarker: 'fixture-must-not-be-public' },
    };
    const createRun = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'CREATED', run, preview: undefined })
      .mockResolvedValueOnce({ outcome: 'REPLAY', run, preview: undefined })
      .mockRejectedValueOnce({ code: 'IDEMPOTENCY_CONFLICT' });
    const repositoryFactory = vi.fn(() => ({}) as RunRepository);
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory,
      serviceFactory: () => ({ createRun }),
    });
    const makeRequest = () =>
      request('http://localhost/api/v1/runs', {
        method: 'POST',
        headers: { 'idempotency-key': '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify(validBody),
      });

    const createdResponse = await handlers.createRun(makeRequest());
    expect(createdResponse.status).toBe(202);
    const createdBody = await createdResponse.json();
    expect(JSON.stringify(createdBody)).not.toContain(adminKey);
    expect(JSON.stringify(createdBody)).not.toContain(
      'fixture-must-not-be-public',
    );
    expect((await handlers.createRun(makeRequest())).status).toBe(202);
    expect((await handlers.createRun(makeRequest())).status).toBe(409);
  });

  it('passes safe pagination and filters to the repository', async () => {
    const listRuns = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      hasMore: false,
    });
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory: () => ({ listRuns }) as unknown as RunRepository,
    });
    const response = await handlers.listRuns(
      request(
        'http://localhost/api/v1/runs?page=2&pageSize=100&status=FAILED&scenarioKey=match-id-cliente&createdFrom=2026-08-01T00%3A00%3A00Z&createdTo=2026-08-31T23%3A59%3A59Z',
      ),
    );

    expect(response.status).toBe(200);
    expect(listRuns).toHaveBeenCalledWith({
      limit: 100,
      offset: 100,
      filters: {
        status: 'FAILED',
        scenarioKey: 'match-id-cliente',
        createdFrom: new Date('2026-08-01T00:00:00Z'),
        createdTo: new Date('2026-08-31T23:59:59Z'),
      },
    });
  });

  it('validates list filters and returns not found for run detail and steps', async () => {
    const repository = {
      listRuns: vi.fn(),
      findRun: vi.fn().mockResolvedValue(null),
      listSteps: vi.fn(),
    } as unknown as RunRepository;
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory: () => repository,
    });

    const invalid = await handlers.listRuns(
      request('http://localhost/api/v1/runs?pageSize=101'),
    );
    const detail = await handlers.getRun(
      request(
        'http://localhost/api/v1/runs/11111111-1111-4111-8111-111111111111',
      ),
      '11111111-1111-4111-8111-111111111111',
    );
    const steps = await handlers.listRunSteps(
      request(
        'http://localhost/api/v1/runs/11111111-1111-4111-8111-111111111111/steps',
      ),
      '11111111-1111-4111-8111-111111111111',
    );

    expect(invalid.status).toBe(422);
    expect(repository.listRuns).not.toHaveBeenCalled();
    expect(detail.status).toBe(404);
    expect(steps.status).toBe(404);
    expect(repository.listSteps).not.toHaveBeenCalled();
  });

  it('protects cancellation and retry with the same feature gate and bearer auth', async () => {
    const repositoryFactory = vi.fn();
    const scheduler = {} as Scheduler;
    const disabled = createRunApiHandlers({
      environment: { ORCHESTRATION_ENABLED: 'false' },
      repositoryFactory,
      scheduler,
    });
    const enabled = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory,
      scheduler,
    });
    const runId = '11111111-1111-4111-8111-111111111111';

    expect(
      (
        await disabled.cancelRun(
          new Request(`http://localhost/api/v1/runs/${runId}/cancellations`, {
            method: 'POST',
          }),
          runId,
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await enabled.retryRun(
          new Request(`http://localhost/api/v1/runs/${runId}/retries`, {
            method: 'POST',
          }),
          runId,
        )
      ).status,
    ).toBe(401);
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('rejects free text and unknown fields in administrative bodies without reflecting secrets', async () => {
    const repositoryFactory = vi.fn();
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory,
      scheduler: {} as Scheduler,
    });
    const runId = '11111111-1111-4111-8111-111111111111';
    const response = await handlers.cancelRun(
      request(`http://localhost/api/v1/runs/${runId}/cancellations`, {
        method: 'POST',
        body: JSON.stringify({ reason: adminKey }),
      }),
      runId,
    );

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).not.toContain(adminKey);
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('returns 202 for cancellation, 200 for CANCELLED replay, and 202 for retry', async () => {
    const cancelRun = vi
      .fn()
      .mockResolvedValueOnce({
        runId: '11111111-1111-4111-8111-111111111111',
        status: 'CANCELLED',
        affectedStepCount: 2,
        replayed: false,
      })
      .mockResolvedValueOnce({
        runId: '11111111-1111-4111-8111-111111111111',
        status: 'CANCELLED',
        affectedStepCount: 2,
        replayed: true,
      });
    const retryRun = vi.fn().mockResolvedValue({
      runId: '11111111-1111-4111-8111-111111111111',
      status: 'SCHEDULED',
      affectedStepCount: 1,
      replayed: false,
    });
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory: () => ({}) as RunRepository,
      scheduler: {} as Scheduler,
      administrationServiceFactory: () => ({ cancelRun, retryRun }),
    });
    const runId = '11111111-1111-4111-8111-111111111111';
    const cancellation = () =>
      request(`http://localhost/api/v1/runs/${runId}/cancellations`, {
        method: 'POST',
        body: JSON.stringify({ reasonCode: 'OPERATOR_REQUEST' }),
      });
    const retry = request(`http://localhost/api/v1/runs/${runId}/retries`, {
      method: 'POST',
      body: JSON.stringify({ stepKeys: ['cliente-update'] }),
    });

    expect((await handlers.cancelRun(cancellation(), runId)).status).toBe(202);
    expect((await handlers.cancelRun(cancellation(), runId)).status).toBe(200);
    const retryResponse = await handlers.retryRun(retry, runId);
    expect(retryResponse.status).toBe(202);
    expect(await retryResponse.json()).toMatchObject({
      data: { status: 'SCHEDULED', affectedStepCount: 1 },
      replayed: false,
    });
  });

  it.each([
    ['RUN_NOT_FOUND', 404],
    ['RUN_NOT_CANCELLABLE', 409],
    ['NO_ELIGIBLE_STEPS', 409],
    ['CANCELLATION_FAILED', 503],
  ] as const)('maps administrative error %s to %i', async (code, status) => {
    const action = vi
      .fn()
      .mockRejectedValue(new RunAdministrationError(code, 'private detail'));
    const handlers = createRunApiHandlers({
      environment: enabledEnvironment,
      repositoryFactory: () => ({}) as RunRepository,
      scheduler: {} as Scheduler,
      administrationServiceFactory: () => ({
        cancelRun: action,
        retryRun: action,
      }),
    });
    const runId = '11111111-1111-4111-8111-111111111111';
    const response =
      code === 'NO_ELIGIBLE_STEPS'
        ? await handlers.retryRun(
            request(`http://localhost/api/v1/runs/${runId}/retries`, {
              method: 'POST',
            }),
            runId,
          )
        : await handlers.cancelRun(
            request(`http://localhost/api/v1/runs/${runId}/cancellations`, {
              method: 'POST',
            }),
            runId,
          );

    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain(
      'private detail',
    );
  });
});
