import { describe, expect, it, vi } from 'vitest';

import {
  asAllowlistedQuery,
  createSalesforceRestClient,
  escapeSoqlLiteral,
  getLeadGestaoVendasRecordTypeId,
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

  it('sends only the fixed Lead composite URL with the allowlisted body', async () => {
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
        url: '/services/data/v61.0/sobjects/Lead',
        referenceId: 'createLead',
        body: {
          Id__c: 'LEAD-SIM-owned',
          FirstName: 'Cliente',
          LastName: 'Simulado',
          CPF__c: '12345678901',
          MobilePhone: '31999990000',
          CelularSemFormatacao__c: '31999990000',
          Email: 'lead@example.com',
          CidadeInteresse__c: 'Belo Horizonte',
          Marca__c: '1',
          RecordTypeId: '012000000000002AAA',
          ManipularFase__c: true,
          Status: 'Pendente de Distribuição',
          PermitirCriarLead__c: true,
          DescricaoOrigem__c: 'InsertClientePAC',
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
              url: '/services/data/v61.0/sobjects/Lead',
              referenceId: 'createLead',
              body: {
                Id__c: 'LEAD-SIM-owned',
                FirstName: 'Cliente',
                LastName: 'Simulado',
                CPF__c: '12345678901',
                MobilePhone: '31999990000',
                CelularSemFormatacao__c: '31999990000',
                Email: 'lead@example.com',
                CidadeInteresse__c: 'Belo Horizonte',
                Marca__c: '1',
                RecordTypeId: '012000000000002AAA',
                ManipularFase__c: true,
                Status: 'Pendente de Distribuição',
                PermitirCriarLead__c: true,
                DescricaoOrigem__c: 'InsertClientePAC',
              },
            },
          ],
        }),
      }),
    );
  });

  it('sends only the fixed Opportunity composite URL with the allowlisted body', async () => {
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
        url: '/services/data/v61.0/sobjects/Opportunity',
        referenceId: 'createOpportunity',
        body: {
          Name: 'Opportunity Sintética',
          StageName: 'Simulação',
          CloseDate: '2026-09-30',
          Id__c: 'OPP-SIM-owned',
          AccountId: '001000000000001AAA',
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
              url: '/services/data/v61.0/sobjects/Opportunity',
              referenceId: 'createOpportunity',
              body: {
                Name: 'Opportunity Sintética',
                StageName: 'Simulação',
                CloseDate: '2026-09-30',
                Id__c: 'OPP-SIM-owned',
                AccountId: '001000000000001AAA',
              },
            },
          ],
        }),
      }),
    );
  });

  it('deletes Lead records through the allowlist', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204,
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

    await expect(
      client.deleteRecord('Lead', '00Q000000000001AAA'),
    ).resolves.toBeUndefined();

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/data/v61.0/sobjects/Lead/00Q000000000001AAA',
      expect.objectContaining({
        method: 'DELETE',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('deletes Opportunity records through the allowlist', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204,
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

    await expect(
      client.deleteRecord('Opportunity', '006000000000001AAA'),
    ).resolves.toBeUndefined();

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/data/v61.0/sobjects/Opportunity/006000000000001AAA',
      expect.objectContaining({
        method: 'DELETE',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('deletes OpportunityLineItem records through the allowlist', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204,
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

    await expect(
      client.deleteRecord('OpportunityLineItem', '00k000000000001AAA'),
    ).resolves.toBeUndefined();

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/data/v61.0/sobjects/OpportunityLineItem/00k000000000001AAA',
      expect.objectContaining({
        method: 'DELETE',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('caches the GestaoVendas Lead record type lookup independently', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000002AAA' }],
      })
      .mockResolvedValueOnce({
        totalSize: 1,
        done: true,
        records: [{ Id: '012000000000003AAA' }],
      });
    const restClient = { query } as never;

    await expect(getLeadGestaoVendasRecordTypeId(restClient)).resolves.toBe(
      '012000000000002AAA',
    );
    await expect(getLeadGestaoVendasRecordTypeId(restClient)).resolves.toBe(
      '012000000000002AAA',
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain(
      "SobjectType = 'Lead' AND DeveloperName = 'GestaoVendas'",
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
      client.deleteRecord('Contact' as 'Account', '001000000000001AAA'),
    ).rejects.toMatchObject({ code: 'SALESFORCE_OPERATION_NOT_ALLOWED' });
  });
});
