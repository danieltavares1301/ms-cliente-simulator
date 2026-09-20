import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventGridEnvelope } from '../contracts';
import { createProductionDispatchTarget } from './production-dispatch';

const envelope: EventGridEnvelope = [
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
];

const dispatchInput = {
  runId: '11111111-1111-4111-8111-111111111111',
  stepId: '22222222-2222-4222-8222-222222222222',
  attemptNumber: 1,
  envelope,
};

const baseEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
} satisfies Record<string, string>;

function createOrchestrationEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    ...baseEnvironment,
    ORCHESTRATION_ENABLED: 'true',
    SIMULATOR_ADMIN_API_KEY:
      'admin-api-key-with-at-least-thirty-two-characters',
    IDEMPOTENCY_HASH_PEPPER:
      'idempotency-pepper-with-at-least-thirty-two-characters',
    PUBLIC_APP_BASE_URL: 'https://simulator.example.com',
    QSTASH_TOKEN: 'qstash-token-with-at-least-thirty-two-characters',
    QSTASH_CURRENT_SIGNING_KEY:
      'current-signing-key-with-at-least-thirty-two-characters',
    QSTASH_NEXT_SIGNING_KEY:
      'next-signing-key-with-at-least-thirty-two-characters',
    ...overrides,
  };
}

function createEnabledEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return createOrchestrationEnvironment({
    SALESFORCE_DISPATCH_ENABLED: 'true',
    SALESFORCE_CLIENT_ID: 'salesforce-client-id',
    SALESFORCE_CLIENT_SECRET: 'salesforce-client-secret',
    SALESFORCE_TOKEN_URL:
      'https://example.my.salesforce.com/services/oauth2/token',
    ...overrides,
  });
}

describe('createProductionDispatchTarget', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['when dispatch is explicitly disabled', 'false'],
    ['when the dispatch flag is omitted', undefined],
  ])(
    'returns the fake dispatch target %s',
    async (_description, salesforceDispatchEnabled) => {
      const fetchMock = vi.fn<typeof fetch>();
      vi.stubGlobal('fetch', fetchMock);
      const target = createProductionDispatchTarget(
        createOrchestrationEnvironment({
          SALESFORCE_DISPATCH_ENABLED: salesforceDispatchEnabled,
        }),
      );

      const result = await target.dispatch(dispatchInput);

      expect(result.responseRedacted).toMatchObject({
        transport: 'FAKE_SALESFORCE',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('composes the real Salesforce target and requests the configured token endpoint when enabled', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('token endpoint called'));
    vi.stubGlobal('fetch', fetchMock);
    const target = createProductionDispatchTarget(createEnabledEnvironment());

    await expect(target.dispatch(dispatchInput)).rejects.toThrow(
      'token endpoint called',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      }),
    );
  });

  it('keeps memoized dispatch targets isolated across factory instances with different flags', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('token endpoint called'));
    vi.stubGlobal('fetch', fetchMock);
    const fakeTarget = createProductionDispatchTarget(
      createOrchestrationEnvironment({
        SALESFORCE_DISPATCH_ENABLED: 'false',
      }),
    );
    const realTarget = createProductionDispatchTarget(createEnabledEnvironment());

    const fakeResult = await fakeTarget.dispatch(dispatchInput);
    await expect(realTarget.dispatch(dispatchInput)).rejects.toThrow(
      'token endpoint called',
    );
    const fakeResultAfterRealDispatch = await fakeTarget.dispatch(dispatchInput);

    expect(fakeResult.responseRedacted).toMatchObject({
      transport: 'FAKE_SALESFORCE',
    });
    expect(fakeResultAfterRealDispatch.responseRedacted).toMatchObject({
      transport: 'FAKE_SALESFORCE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
