import { afterEach, describe, expect, it, vi } from 'vitest';

import { SalesforceOAuthClient } from './oauth-client';

describe('SalesforceOAuthClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
