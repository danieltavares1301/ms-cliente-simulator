import { afterEach, describe, expect, it, vi } from 'vitest';

import { SalesforceNetworkError } from './network-policy';
import { SALESFORCE_NETWORK_TIMEOUT_MS } from './network-policy';
import { DEFAULT_LIFECYCLE_CLAIM_RECOVERY_MS } from '../db/drizzle-run-repository';
import { SalesforceOAuthClient } from './oauth-client';

describe('SalesforceOAuthClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses a network timeout shorter than the lifecycle claim lease', () => {
    expect(SALESFORCE_NETWORK_TIMEOUT_MS).toBeLessThan(
      DEFAULT_LIFECYCLE_CLAIM_RECOVERY_MS,
    );
  });

  it('requests a client-credentials token and reuses the in-memory cache', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-1',
          instance_url: 'https://example.my.salesforce.com',
          token_type: 'Bearer',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new SalesforceOAuthClient({
      clientId: 'salesforce-client-id',
      clientSecret: 'salesforce-client-secret',
      tokenUrl: 'https://example.my.salesforce.com/services/oauth2/token',
    });

    const first = await client.getAccess();
    const second = await client.getAccess();

    expect(first).toStrictEqual({
      accessToken: 'token-1',
      instanceUrl: 'https://example.my.salesforce.com',
    });
    expect(second).toStrictEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: expect.any(URLSearchParams),
      }),
    );
    const [, options] = fetchMock.mock.calls[0];
    expect(String(options?.body)).toBe(
      'grant_type=client_credentials&client_id=salesforce-client-id&client_secret=salesforce-client-secret',
    );
  });

  it.each([301, 302, 307, 308])(
    'does not follow an OAuth redirect or resend credentials (%s)',
    async (status) => {
      const bodies: string[] = [];
      const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
        bodies.push(String(init?.body));
        expect(init?.redirect).toBe('error');
        throw new TypeError(`redirect ${status} blocked`);
      });
      const client = new SalesforceOAuthClient({
        clientId: 'salesforce-client-id',
        clientSecret: 'salesforce-client-secret',
        tokenUrl: 'https://example.my.salesforce.com/services/oauth2/token',
        fetchFn: fetchMock,
      });

      await expect(client.getAccess()).rejects.toBeInstanceOf(
        SalesforceNetworkError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(bodies).toStrictEqual([
        'grant_type=client_credentials&client_id=salesforce-client-id&client_secret=salesforce-client-secret',
      ]);
    },
  );

  it('returns a typed redacted timeout without credential material', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      (_request, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const client = new SalesforceOAuthClient({
      clientId: 'do-not-leak-client',
      clientSecret: 'do-not-leak-secret',
      tokenUrl: 'https://example.my.salesforce.com/services/oauth2/token',
      fetchFn,
      networkTimeoutMs: 1,
    });

    const operation = client.getAccess();
    await expect(operation).rejects.toMatchObject({
      name: 'SalesforceNetworkError',
      code: 'SALESFORCE_REQUEST_TIMEOUT',
    });
    await expect(operation).rejects.not.toThrow(/do-not-leak/);
  });

  it('invalidates the cached token on demand', async () => {
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
            access_token: 'token-2',
            instance_url: 'https://example.my.salesforce.com',
            token_type: 'Bearer',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new SalesforceOAuthClient({
      clientId: 'salesforce-client-id',
      clientSecret: 'salesforce-client-secret',
      tokenUrl: 'https://example.my.salesforce.com/services/oauth2/token',
    });

    await client.getAccess();
    client.invalidateToken();
    const refreshed = await client.getAccess();

    expect(refreshed.accessToken).toBe('token-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401])(
    'throws a typed auth error when Salesforce rejects the client credentials (%s)',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response('denied', {
            status,
            statusText: status === 400 ? 'Bad Request' : 'Unauthorized',
          }),
        ),
      );
      const client = new SalesforceOAuthClient({
        clientId: 'salesforce-client-id',
        clientSecret: 'salesforce-client-secret',
        tokenUrl: 'https://example.my.salesforce.com/services/oauth2/token',
      });

      await expect(client.getAccess()).rejects.toMatchObject({
        name: 'SalesforceAuthError',
        code: 'SALESFORCE_AUTH_REJECTED',
        status,
      });
    },
  );
});
