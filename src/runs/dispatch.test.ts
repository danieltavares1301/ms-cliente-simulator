import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { RunRepository } from '../db/run-repository';
import {
  createDispatchHandler,
  createQStashReceiver,
  FakeSalesforceDispatchTarget,
} from './dispatch';

const currentSigningKey = 'current-signing-key-with-at-least-32-characters';
const nextSigningKey = 'next-signing-key-with-at-least-32-characters';
const url = 'https://simulator.example.com/api/v1/internal/dispatches';
const payload = {
  runId: '11111111-1111-4111-8111-111111111111',
  stepId: '22222222-2222-4222-8222-222222222222',
  attemptNumber: 1,
};

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(body: string, key = currentSigningKey): string {
  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: 'Upstash',
      sub: url,
      iat: now,
      exp: now + 60,
      body: createHash('sha256').update(body).digest('base64url'),
    }),
  );
  const unsigned = `${header}.${claims}`;
  return `${unsigned}.${createHmac('sha256', key).update(unsigned).digest('base64url')}`;
}

function request(body: string, signature?: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: signature ? { 'Upstash-Signature': signature } : undefined,
    body,
  });
}

function dependencies(repository: Partial<RunRepository>) {
  return {
    environment: { ORCHESTRATION_ENABLED: 'true' },
    repositoryFactory: vi.fn(
      () =>
        ({
          findRun: vi.fn().mockResolvedValue({
            dispatchMode: 'FAKE',
            testDataEnabled: false,
          }),
          ...repository,
        }) as RunRepository,
    ),
    receiverFactory: () =>
      createQStashReceiver({ currentSigningKey, nextSigningKey }),
    target: new FakeSalesforceDispatchTarget(),
  };
}

const eventEnvelope = [
  {
    id: 'evt-1',
    subject: 'cliente/evt-1',
    eventType: 'cliente-update',
    eventTime: '2026-08-21T10:00:00Z',
    dataVersion: '1.0',
    metadataVersion: '1',
    topic: '/subscriptions/test/topics/clientes',
    data: {
      idcliente: 'cli-1',
      id: 'cli-1',
      numerocpf: '12345678901',
      dataalteracao: '2026-08-21T10:00:00Z',
    },
  },
] as const;

describe('internal QStash dispatch handler', () => {
  it('returns the same 401 for a missing or invalid signature without accessing the database', async () => {
    const repositoryFactory = vi.fn();
    const handler = createDispatchHandler({
      environment: { ORCHESTRATION_ENABLED: 'true' },
      repositoryFactory,
      receiverFactory: () =>
        createQStashReceiver({ currentSigningKey, nextSigningKey }),
      target: new FakeSalesforceDispatchTarget(),
    });
    const raw = JSON.stringify(payload);

    const missing = await handler(request(raw));
    const invalid = await handler(request(raw, 'invalid'));

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(await missing.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    expect(await invalid.json()).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('verifies the raw body with the SDK before parsing JSON or creating the repository', async () => {
    const repositoryFactory = vi.fn();
    const verify = vi.fn().mockResolvedValue(false);
    const handler = createDispatchHandler({
      environment: { ORCHESTRATION_ENABLED: 'true' },
      repositoryFactory,
      receiverFactory: () => ({ verify }),
      target: new FakeSalesforceDispatchTarget(),
    });

    const response = await handler(request('{not-json', 'invalid'));

    expect(response.status).toBe(401);
    expect(verify).toHaveBeenCalledWith({
      signature: 'invalid',
      body: '{not-json',
      url,
    });
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('accepts a valid current-key SDK signature and returns uniform 400/422 body errors', async () => {
    const invalidJson = '{not-json';
    const invalidShape = JSON.stringify({ ...payload, unexpected: 'blocked' });
    const handler = createDispatchHandler(
      dependencies({ claimDispatch: vi.fn() }),
    );

    const malformed = await handler(
      request(invalidJson, sign(invalidJson, nextSigningKey)),
    );
    const strict = await handler(request(invalidShape, sign(invalidShape)));

    expect(malformed.status).toBe(400);
    expect(strict.status).toBe(422);
    expect(await malformed.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    });
    expect(await strict.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    });
  });

  it('rejects an oversized signed body before database access', async () => {
    const body = JSON.stringify({ ...payload, padding: 'x'.repeat(17_000) });
    const deps = dependencies({});
    const handler = createDispatchHandler(deps);

    const response = await handler(request(body, sign(body)));

    expect(response.status).toBe(413);
    expect(deps.repositoryFactory).not.toHaveBeenCalled();
  });

  it('returns an idempotent 200 no-op for a terminal delivery', async () => {
    const claimDispatch = vi.fn().mockResolvedValue({ outcome: 'TERMINAL' });
    const completeDispatch = vi.fn();
    const target = { dispatch: vi.fn() };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({ claimDispatch, completeDispatch }),
      target,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      accepted: true,
      noop: true,
    });
    expect(target.dispatch).not.toHaveBeenCalled();
    expect(completeDispatch).not.toHaveBeenCalled();
  });

  it('keeps a persisted FAKE run on the fake target after the global flag is enabled', async () => {
    const fakeTarget = {
      dispatch: vi.fn().mockResolvedValue({
        httpStatus: 200,
        durationMs: 0,
        responseRedacted: { transport: 'FAKE_SALESFORCE' },
      }),
    };
    const salesforceTarget = { dispatch: vi.fn() };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'FAKE',
          testDataEnabled: false,
        }),
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }),
        getDispatchPayload: vi
          .fn()
          .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope }),
        completeDispatch: vi.fn().mockResolvedValue({ runStatus: 'RUNNING' }),
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'true',
      },
      fakeTarget,
      salesforceTarget,
      target: undefined,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(fakeTarget.dispatch).toHaveBeenCalledOnce();
    expect(salesforceTarget.dispatch).not.toHaveBeenCalled();
  });

  it('returns a retriable 503 without using fake when a persisted SALESFORCE run is killed by flag', async () => {
    const fakeTarget = { dispatch: vi.fn() };
    const salesforceTarget = { dispatch: vi.fn() };
    const claimDispatch = vi.fn();
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'SALESFORCE',
          testDataEnabled: false,
        }),
        claimDispatch,
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'false',
      },
      fakeTarget,
      salesforceTarget,
      target: undefined,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({
      error: { code: 'SALESFORCE_DISPATCH_DISABLED' },
    });
    expect(claimDispatch).not.toHaveBeenCalled();
    expect(fakeTarget.dispatch).not.toHaveBeenCalled();
    expect(salesforceTarget.dispatch).not.toHaveBeenCalled();
  });

  it('keeps persisted lifecycle work recoverable when the test-data kill switch is off', async () => {
    const claimDispatch = vi.fn();
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'SALESFORCE',
          testDataEnabled: true,
        }),
        claimDispatch,
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'true',
        SALESFORCE_TEST_DATA_ENABLED: 'false',
      },
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({
      error: { code: 'SALESFORCE_TEST_DATA_DISABLED' },
    });
    expect(claimDispatch).not.toHaveBeenCalled();
  });

  it('resumes an incomplete post-dispatch lifecycle on terminal redelivery', async () => {
    const claimDispatch = vi.fn().mockResolvedValue({ outcome: 'TERMINAL' });
    const afterDispatch = vi
      .fn()
      .mockResolvedValue({ outcome: 'COMPLETED', status: 'SUCCEEDED' });
    const target = { dispatch: vi.fn() };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'FAKE',
          testDataEnabled: true,
        }),
        claimDispatch,
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_TEST_DATA_ENABLED: 'true',
      },
      target,
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({ afterDispatch }),
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(afterDispatch).toHaveBeenCalledWith(payload.runId);
    expect(target.dispatch).not.toHaveBeenCalled();
  });

  it('asks QStash to redeliver while another lifecycle claim is running', async () => {
    const afterDispatch = vi.fn().mockResolvedValue({ outcome: 'IN_PROGRESS' });
    const target = { dispatch: vi.fn() };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'FAKE',
          testDataEnabled: true,
        }),
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'TERMINAL' }),
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_TEST_DATA_ENABLED: 'true',
      },
      target,
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({ afterDispatch }),
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(409);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(target.dispatch).not.toHaveBeenCalled();
  });

  it('does not duplicate a running attempt and asks QStash to redeliver', async () => {
    const completeDispatch = vi.fn();
    const target = { dispatch: vi.fn() };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        claimDispatch: vi
          .fn()
          .mockResolvedValue({ outcome: 'ALREADY_RUNNING' }),
        completeDispatch,
      }),
      target,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(409);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(target.dispatch).not.toHaveBeenCalled();
    expect(completeDispatch).not.toHaveBeenCalled();
  });

  it('returns a retryable conflict when a prior step has not reached successful terminal state', async () => {
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler(
      dependencies({
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'OUT_OF_ORDER' }),
      }),
    );

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(409);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(await response.json()).toMatchObject({
      error: { code: 'DISPATCH_OUT_OF_ORDER' },
    });
  });

  it('executes the deterministic fake target once and records only sanitized result metadata', async () => {
    const claimDispatch = vi.fn().mockResolvedValue({ outcome: 'CLAIMED' });
    const getDispatchPayload = vi.fn().mockResolvedValue({
      target: 'PAC',
      envelope: eventEnvelope,
    });
    const completeDispatch = vi.fn().mockResolvedValue({
      runStatus: 'VERIFYING',
    });
    const target = { dispatch: vi.fn().mockResolvedValue({
      httpStatus: 200,
      durationMs: 0,
      responseRedacted: {
        transport: 'FAKE_SALESFORCE',
        network: false,
      },
    }) };

    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({ claimDispatch, completeDispatch, getDispatchPayload }),
      target,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(getDispatchPayload).toHaveBeenCalledWith({
      runId: payload.runId,
      stepId: payload.stepId,
    });
    expect(target.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        target: 'PAC',
        envelope: eventEnvelope,
      }),
    );
    expect(completeDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        requestId: expect.any(String),
        httpStatus: 200,
        durationMs: 0,
        responseRedacted: {
          transport: 'FAKE_SALESFORCE',
          network: false,
        },
        errorCode: null,
      }),
    );
    expect(JSON.stringify(completeDispatch.mock.calls)).not.toContain(
      'numerocpf',
    );
  });

  it('executes verify and cleanup after the last successful dispatch', async () => {
    const afterDispatch = vi
      .fn()
      .mockResolvedValue({ outcome: 'COMPLETED', status: 'SUCCEEDED' });
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'FAKE',
          testDataEnabled: true,
        }),
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }),
        getDispatchPayload: vi
          .fn()
          .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope }),
        completeDispatch: vi.fn().mockResolvedValue({
          runStatus: 'VERIFYING',
        }),
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_TEST_DATA_ENABLED: 'true',
      },
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({ afterDispatch }),
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(afterDispatch).toHaveBeenCalledWith(payload.runId);
  });

  it('keeps persisted test data intact while waiting for async callbacks', async () => {
    const compensate = vi.fn().mockResolvedValue({ outcome: 'SUCCEEDED' });
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'FAKE',
          testDataEnabled: true,
        }),
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }),
        getDispatchPayload: vi
          .fn()
          .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope }),
        completeDispatch: vi
          .fn()
          .mockResolvedValue({ runStatus: 'WAITING_ASYNC' }),
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_TEST_DATA_ENABLED: 'true',
      },
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({
        afterDispatch: vi.fn(),
        compensate,
      }),
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      accepted: true,
      noop: false,
    });
    expect(compensate).not.toHaveBeenCalled();
  });

  it.each(['FAILED', 'PARTIAL'] as const)(
    'still compensates persisted test data when dispatch finishes as %s',
    async (runStatus) => {
    const compensate = vi.fn().mockResolvedValue({ outcome: 'SUCCEEDED' });
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        findRun: vi.fn().mockResolvedValue({
          dispatchMode: 'FAKE',
          testDataEnabled: true,
        }),
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }),
        getDispatchPayload: vi
          .fn()
          .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope }),
        completeDispatch: vi.fn().mockResolvedValue({ runStatus }),
      }),
      environment: {
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_TEST_DATA_ENABLED: 'true',
      },
      testDataAdapter: {
        setup: vi.fn(),
        verify: vi.fn(),
        cleanup: vi.fn(),
      },
      lifecycleServiceFactory: () => ({
        afterDispatch: vi.fn(),
        compensate,
      }),
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(200);
    expect(compensate).toHaveBeenCalledWith(payload.runId);
    },
  );

  it('reports a persistence failure after a successful target without relabeling or repeating the target', async () => {
    const claimDispatch = vi.fn().mockResolvedValue({ outcome: 'CLAIMED' });
    const getDispatchPayload = vi
      .fn()
      .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope });
    const completeDispatch = vi
      .fn()
      .mockRejectedValue(new Error('database unavailable'));
    const target = {
      dispatch: vi.fn().mockResolvedValue({
        httpStatus: 200,
        durationMs: 4,
        responseRedacted: { transport: 'FAKE_SALESFORCE', network: false },
      }),
    };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({ claimDispatch, completeDispatch, getDispatchPayload }),
      target,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'DISPATCH_PERSISTENCE_FAILED' },
    });
    expect(target.dispatch).toHaveBeenCalledTimes(1);
    expect(completeDispatch).toHaveBeenCalledTimes(1);
    expect(completeDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: null, httpStatus: 200 }),
    );
  });

  it('labels only a target failure as DISPATCH_TARGET_FAILED', async () => {
    const getDispatchPayload = vi
      .fn()
      .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope });
    const completeDispatch = vi.fn().mockResolvedValue({
      runStatus: 'FAILED',
    });
    const target = {
      dispatch: vi.fn().mockRejectedValue(new Error('target unavailable')),
    };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        claimDispatch: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }),
        completeDispatch,
        getDispatchPayload,
      }),
      target,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'DISPATCH_TARGET_FAILED' },
    });
    expect(target.dispatch).toHaveBeenCalledTimes(1);
    expect(completeDispatch).toHaveBeenCalledTimes(1);
    expect(completeDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'DISPATCH_TARGET_FAILED' }),
    );
  });

  it('returns a retriable persistence error when claim recovery fails before target execution', async () => {
    const target = { dispatch: vi.fn() };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({
        claimDispatch: vi
          .fn()
          .mockRejectedValue(new Error('reconciliation unavailable')),
      }),
      target,
    });

    const response = await handler(request(raw, sign(raw)));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(await response.json()).toMatchObject({
      error: { code: 'DISPATCH_PERSISTENCE_FAILED' },
    });
    expect(target.dispatch).not.toHaveBeenCalled();
  });

  it('does not repeat the target when redelivery finds a reconciled persisted result', async () => {
    const claimDispatch = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'CLAIMED' })
      .mockResolvedValueOnce({ outcome: 'TERMINAL' });
    const getDispatchPayload = vi
      .fn()
      .mockResolvedValue({ target: 'CLIENTE', envelope: eventEnvelope });
    const completeDispatch = vi
      .fn()
      .mockRejectedValueOnce(new Error('partial persistence failure'));
    const target = {
      dispatch: vi.fn().mockResolvedValue({
        httpStatus: 200,
        durationMs: 1,
        responseRedacted: { transport: 'FAKE_SALESFORCE', network: false },
      }),
    };
    const raw = JSON.stringify(payload);
    const handler = createDispatchHandler({
      ...dependencies({ claimDispatch, completeDispatch, getDispatchPayload }),
      target,
    });

    const first = await handler(request(raw, sign(raw)));
    const redelivery = await handler(request(raw, sign(raw)));

    expect(first.status).toBe(503);
    expect(redelivery.status).toBe(200);
    expect(await redelivery.json()).toStrictEqual({
      accepted: true,
      noop: true,
    });
    expect(target.dispatch).toHaveBeenCalledTimes(1);
    expect(completeDispatch).toHaveBeenCalledTimes(1);
  });
});
