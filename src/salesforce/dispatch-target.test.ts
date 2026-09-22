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
      target: 'CLIENTE',
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
        redirect: 'error',
        signal: expect.any(AbortSignal),
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
      target: 'CLIENTE',
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

  it('returns a typed redacted timeout without exposing the request body', async () => {
    const target = createSalesforceDispatchTarget({
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
      fetchFn: vi.fn<typeof fetch>(
        (_request, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(init.signal?.reason),
            );
          }),
      ),
      networkTimeoutMs: 1,
      now: () => new Date('2026-08-22T12:00:01.000Z'),
    });

    const result = await target.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      target: 'CLIENTE',
      envelope,
    });

    expect(result).toMatchObject({
      httpStatus: 504,
      responseRedacted: { statusText: 'SALESFORCE_REQUEST_TIMEOUT' },
    });
    expect(JSON.stringify(result)).not.toContain('12345678901');
    expect(JSON.stringify(result)).not.toContain('do-not-leak-token');
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
      target: 'CLIENTE',
      envelope,
    });

    expect(result.httpStatus).toBe(200);
    expect(oauthClient.invalidateToken).toHaveBeenCalledTimes(1);
    expect(safetyGuard.validate).toHaveBeenCalledTimes(2);
  });

  it('routes PAC steps to the /PAC Apex REST endpoint', async () => {
    const oauthClient = {
      getAccess: vi.fn(),
      invalidateToken: vi.fn(),
    };
    const safetyGuard = {
      validate: vi.fn().mockResolvedValue({
        accessToken: 'token-1',
        instanceUrl: 'https://example.my.salesforce.com',
      }),
    };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', { status: 200, statusText: 'OK' }),
    );
    const target = createSalesforceDispatchTarget({
      oauthClient,
      safetyGuard,
      fetchFn,
      now: () => new Date('2026-08-22T12:00:01.000Z'),
    });

    const result = await target.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      target: 'PAC',
      envelope: [
        {
          id: 'evt-pac-1',
          subject: 'pac/evt-pac-1',
          eventType: 'pac-insert',
          eventTime: '2026-08-21T10:00:00Z',
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/subscriptions/test/topics/pac',
          data: {
            id: 'PAC-SIM-001',
            idjornadapac: 'OPP-SIM-001',
            dataalteracao: '2026-08-21T10:00:00Z',
          },
        },
      ],
    });

    expect(result.httpStatus).toBe(200);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/apexrest/PAC',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('routes MAQUINA_ESTADO steps to the /MaquinaEstado Apex REST endpoint', async () => {
    const oauthClient = {
      getAccess: vi.fn(),
      invalidateToken: vi.fn(),
    };
    const safetyGuard = {
      validate: vi.fn().mockResolvedValue({
        accessToken: 'token-1',
        instanceUrl: 'https://example.my.salesforce.com',
      }),
    };
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', { status: 200, statusText: 'OK' }),
    );
    const target = createSalesforceDispatchTarget({
      oauthClient,
      safetyGuard,
      fetchFn,
      now: () => new Date('2026-08-22T12:00:01.000Z'),
    });

    const result = await target.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      target: 'MAQUINA_ESTADO',
      envelope: [
        {
          id: 'evt-journey-1',
          subject: 'jornada/evt-journey-1',
          eventType: 'jornadausuario-insert',
          eventTime: '2026-08-21T10:00:00.000Z',
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/subscriptions/test/topics/jornada',
          data: {
            cliente: {
              idCliente: 'CLI-SIM-001',
              idProspectSalesforce: 'PRO-SIM-001',
            },
            id: 'OPP-SIM-001',
            dataalteracao: '2026-08-21T10:00:00.000Z',
            estado: 'SIMULACAO',
            idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
          },
        },
      ],
    });

    expect(result.httpStatus).toBe(200);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.my.salesforce.com/services/apexrest/MaquinaEstado',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
