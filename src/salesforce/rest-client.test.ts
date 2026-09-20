import { describe, expect, it, vi } from 'vitest';

import {
  asAllowlistedQuery,
  createSalesforceRestClient,
  escapeSoqlLiteral,
  SalesforceRestError,
} from './rest-client';

describe('Salesforce REST client', () => {
  it('escapes quotes, backslashes and control characters in SOQL literals', () => {
    expect(escapeSoqlLiteral("a\\b'c\n\r\t\b\f\u0000\u001f\u007f\u0085")).toBe(
      "a\\\\b\\'c\\n\\r\\t\\b\\f\\u0000\\u001f\\u007f\\u0085",
    );
  });

  it('validates safety before every attempt and retries exactly once after 401', async () => {
    const oauthClient = {
      getAccess: vi.fn(),
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
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('{"private":"discard-me"}', {
          status: 401,
          statusText: 'Unauthorized',
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ totalSize: 0, done: true, records: [] }),
          { status: 200 },
        ),
      );
    const client = createSalesforceRestClient({
      oauthClient,
      safetyGuard,
      fetchFn,
    });

    await expect(
      client.query(
        asAllowlistedQuery('SELECT Id FROM Account WHERE Id__c = null LIMIT 1'),
      ),
    ).resolves.toMatchObject({ totalSize: 0, records: [] });

    expect(safetyGuard.validate).toHaveBeenCalledTimes(2);
    expect(oauthClient.invalidateToken).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/services/data/v61.0/query?'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: {
          authorization: ['Bear', 'er ', 'token-1'].join(''),
          'content-type': 'application/json',
        },
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: {
          authorization: ['Bear', 'er ', 'token-2'].join(''),
          'content-type': 'application/json',
        },
      }),
    );
  });

  it('throws a typed error without leaking response bodies or credentials', async () => {
    const client = createSalesforceRestClient({
      oauthClient: {
        getAccess: vi.fn(),
        invalidateToken: vi.fn(),
      },
      safetyGuard: {
        validate: vi.fn().mockResolvedValue({
          accessToken: 'do-not-leak-token',
          instanceUrl: 'https://example.my.salesforce.com',
        }),
      },
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(
        new Response('{"message":"do-not-leak-body"}', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      ),
    });

    const operation = client.query(
      asAllowlistedQuery('SELECT Id FROM Account LIMIT 1'),
    );

    await expect(operation).rejects.toBeInstanceOf(SalesforceRestError);
    await expect(operation).rejects.not.toThrow(/do-not-leak/);
  });

  it('sends only the fixed Account composite URL with allOrNone enabled', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ compositeResponse: [] }), {
        status: 200,
      }),
    );
    const client = createSalesforceRestClient({
      oauthClient: {
        getAccess: vi.fn(),
        invalidateToken: vi.fn(),
      },
      safetyGuard: {
        validate: vi.fn().mockResolvedValue({
          accessToken: 'token-1',
          instanceUrl: 'https://example.my.salesforce.com',
        }),
      },
      fetchFn,
    });

    await client.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Account',
        referenceId: 'createAccount',
        body: {
          RecordTypeId: '012000000000001AAA',
          LastName: 'Cliente Simulado',
          Id__c: 'CLI-SIM-owned',
          IdProspectSalesforce__c: 'PRO-SIM-owned',
          CPF__pc: '12345678901',
          DataAlteracaoEvento__c: '2026-09-20T16:30:00.000Z',
        },
      },
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/data/v61.0/composite',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        body: JSON.stringify({
          allOrNone: true,
          compositeRequest: [
            {
              method: 'POST',
              url: '/services/data/v61.0/sobjects/Account',
              referenceId: 'createAccount',
              body: {
                RecordTypeId: '012000000000001AAA',
                LastName: 'Cliente Simulado',
                Id__c: 'CLI-SIM-owned',
                IdProspectSalesforce__c: 'PRO-SIM-owned',
                CPF__pc: '12345678901',
                DataAlteracaoEvento__c: '2026-09-20T16:30:00.000Z',
              },
            },
          ],
        }),
      }),
    );
  });

  it('rejects a non-allowlisted delete target at runtime', async () => {
    const client = createSalesforceRestClient({
      oauthClient: {
        getAccess: vi.fn(),
        invalidateToken: vi.fn(),
      },
      safetyGuard: {
        validate: vi.fn(),
      },
      fetchFn: vi.fn<typeof fetch>(),
    });

    await expect(
      client.deleteRecord('Lead' as 'Account', '001000000000001AAA'),
    ).rejects.toMatchObject({ code: 'SALESFORCE_OPERATION_NOT_ALLOWED' });
  });
});
