import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSalesforceSafetyGuard } from './safety-guard';

describe('Salesforce safety guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function oauthClient(instanceUrl = 'https://example.my.salesforce.com') {
    return {
      getAccess: vi.fn().mockResolvedValue({
        accessToken: 'token-1',
        instanceUrl,
      }),
      invalidateToken: vi.fn(),
    };
  }

  function mockOrganizationQuery(
    body: Record<string, unknown> = {
      totalSize: 1,
      done: true,
      records: [{ Id: '00DHZ000006mzDp', IsSandbox: true }],
    },
  ) {
    return vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(body), { status: 200, statusText: 'OK' }),
      );
  }

  it('accepts only the authorized sandbox organization on the configured host', async () => {
    const client = oauthClient();
    const fetchMock = mockOrganizationQuery();
    vi.stubGlobal('fetch', fetchMock);
    const guard = createSalesforceSafetyGuard({
      oauthClient: client,
      targetSalesforceBaseUrl: 'https://example.my.salesforce.com',
      targetSalesforceOrgId: '00DHZ000006mzDp2AI',
    });

    const validated = await guard.validate();

    expect(validated).toStrictEqual({
      accessToken: 'token-1',
      instanceUrl: 'https://example.my.salesforce.com',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/data/v61.0/query?q=SELECT+Id%2CIsSandbox+FROM+Organization',
      expect.objectContaining({
        method: 'GET',
        headers: {
          authorization: 'Bearer token-1',
          accept: 'application/json',
        },
      }),
    );
  });

  it('rejects a different organization id even when Salesforce responds successfully', async () => {
    vi.stubGlobal(
      'fetch',
      mockOrganizationQuery({
        totalSize: 1,
        done: true,
        records: [{ Id: '00D000000000000', IsSandbox: true }],
      }),
    );
    const guard = createSalesforceSafetyGuard({
      oauthClient: oauthClient(),
      targetSalesforceBaseUrl: 'https://example.my.salesforce.com',
      targetSalesforceOrgId: '00DHZ000006mzDp2AI',
    });

    await expect(guard.validate()).rejects.toMatchObject({
      name: 'SafetyGuardViolationError',
      code: 'SALESFORCE_ORG_ID_MISMATCH',
    });
  });

  it('rejects a non-sandbox organization', async () => {
    vi.stubGlobal(
      'fetch',
      mockOrganizationQuery({
        totalSize: 1,
        done: true,
        records: [{ Id: '00DHZ000006mzDp', IsSandbox: false }],
      }),
    );
    const guard = createSalesforceSafetyGuard({
      oauthClient: oauthClient(),
      targetSalesforceBaseUrl: 'https://example.my.salesforce.com',
      targetSalesforceOrgId: '00DHZ000006mzDp2AI',
    });

    await expect(guard.validate()).rejects.toMatchObject({
      name: 'SafetyGuardViolationError',
      code: 'SALESFORCE_SANDBOX_REQUIRED',
    });
  });

  it('rejects an instance host that diverges from the configured target host', async () => {
    const guard = createSalesforceSafetyGuard({
      oauthClient: oauthClient('https://unexpected.my.salesforce.com'),
      targetSalesforceBaseUrl: 'https://example.my.salesforce.com',
      targetSalesforceOrgId: '00DHZ000006mzDp2AI',
    });

    await expect(guard.validate()).rejects.toMatchObject({
      name: 'SafetyGuardViolationError',
      code: 'SALESFORCE_HOST_MISMATCH',
    });
  });
});
