import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventGridEnvelope } from '../contracts';
import { SalesforceOAuthClient } from './oauth-client';
import { createSalesforceDispatchTarget } from './dispatch-target';
import { createSalesforceSafetyGuard } from './safety-guard';

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

describe('Salesforce dispatch target', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts the persisted envelope to the Salesforce REST endpoint and redacts the response body', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'token-1',
            instance_url: 'https://example.my.salesforce.com',
            token_type: 'Bearer',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            totalSize: 1,
            done: true,
            records: [{ Id: '00DHZ000006mzDp', IsSandbox: true }],
          }),
          { status: 200, statusText: 'OK' },
        ),
      )
      .mockResolvedValueOnce(
        new Response('{"contains":"business-data"}', {
          status: 200,
          statusText: 'OK',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const oauthClient = new SalesforceOAuthClient({
      clientId: 'salesforce-client-id',
      clientSecret: 'salesforce-client-secret',
      tokenUrl: 'https://example.my.salesforce.com/services/oauth2/token',
    });
    const target = createSalesforceDispatchTarget({
      oauthClient,
      safetyGuard: createSalesforceSafetyGuard({
        oauthClient,
        targetSalesforceBaseUrl: 'https://example.my.salesforce.com',
        targetSalesforceOrgId: '00DHZ000006mzDp2AI',
      }),
      now: () => new Date('2026-08-22T12:00:01.000Z'),
    });

    const result = await target.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      envelope,
    });

    expect(result).toStrictEqual({
      httpStatus: 200,
      durationMs: 0,
      responseRedacted: { transport: 'SALESFORCE_REST', statusText: 'OK' },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://example.my.salesforce.com/services/apexrest/Cliente',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer token-1',
          'content-type': 'application/json',
        },
        body: JSON.stringify(envelope),
      }),
    );
  });

  it('returns sanitized 4xx/5xx Salesforce responses without exposing the response body', async () => {
    const oauthClient = {
      getAccess: vi.fn().mockResolvedValue({
        accessToken: 'token-1',
        instanceUrl: 'https://example.my.salesforce.com',
      }),
      invalidateToken: vi.fn(),
    };
    const safetyGuard = {
      validate: vi.fn().mockResolvedValue({
        accessToken: 'token-1',
        instanceUrl: 'https://example.my.salesforce.com',
      }),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{"secret":"should-not-leak"}', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
      ),
    );
    const target = createSalesforceDispatchTarget({
      oauthClient,
      safetyGuard,
      now: () => new Date('2026-08-22T12:00:01.000Z'),
    });

    const result = await target.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      envelope,
    });

    expect(result).toStrictEqual({
      httpStatus: 503,
      durationMs: 0,
      responseRedacted: {
        transport: 'SALESFORCE_REST',
        statusText: 'Service Unavailable',
      },
    });
  });

  it('invalidates the token cache and retries exactly once after a 401 response', async () => {
    const oauthClient = {
      getAccess: vi
        .fn()
        .mockResolvedValueOnce({
          accessToken: 'token-1',
          instanceUrl: 'https://example.my.salesforce.com',
        })
        .mockResolvedValueOnce({
          accessToken: 'token-2',
          instanceUrl: 'https://example.my.salesforce.com',
        }),
      invalidateToken: vi.fn(),
    };
    const safetyGuard = {
      validate: vi
        .fn()
        .mockResolvedValueOnce({
          accessToken: 'token-1',
          instanceUrl: 'https://example.my.salesforce.com',
        })
        .mockResolvedValueOnce({
          accessToken: 'token-2',
          instanceUrl: 'https://example.my.salesforce.com',
        }),
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response('', { status: 401, statusText: 'Unauthorized' }),
        )
        .mockResolvedValueOnce(
          new Response('', { status: 200, statusText: 'OK' }),
        ),
    );
    const target = createSalesforceDispatchTarget({
      oauthClient,
      safetyGuard,
      now: () => new Date('2026-08-22T12:00:01.000Z'),
    });

    const result = await target.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      envelope,
    });

    expect(result.httpStatus).toBe(200);
    expect(oauthClient.invalidateToken).toHaveBeenCalledTimes(1);
    expect(safetyGuard.validate).toHaveBeenCalledTimes(2);
  });
});
