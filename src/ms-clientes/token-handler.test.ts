import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAzureTokenSimulatorHandler } from './token-handler';

const validEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: '******localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
  ORCHESTRATION_ENABLED: 'true',
  AZURE_TOKEN_SIMULATOR_ENABLED: 'true',
  GRAPHQL_CALLBACK_SHARED_SECRET:
    'graphql-callback-secret-with-at-least-32-characters',
} as const;

function createRequest(body?: string, headers?: HeadersInit): Request {
  return new Request('https://simulator.example.com/api/ms-clientes/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    ...(body === undefined ? {} : { body }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAzureTokenSimulatorHandler', () => {
  it('returns the shared secret as an OAuth-style access token when enabled', async () => {
    const handler = createAzureTokenSimulatorHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-success',
    });

    const response = await handler(
      createRequest(
        'grant_type=client_credentials&client_id=fake-client&client_secret=fake-secret',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toStrictEqual({
      access_token: validEnvironment.GRAPHQL_CALLBACK_SHARED_SECRET,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  });

  it('returns 503 when the simulator is disabled', async () => {
    const handler = createAzureTokenSimulatorHandler({
      environment: {
        ...validEnvironment,
        AZURE_TOKEN_SIMULATOR_ENABLED: 'false',
      },
      requestIdFactory: () => 'request-disabled',
    });

    const response = await handler(createRequest('client_secret=ignored'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'AZURE_TOKEN_SIMULATOR_DISABLED',
        message: 'Azure token simulator is disabled',
        requestId: 'request-disabled',
      },
    });
  });

  it('tolerates an absent or partial form body without returning 500', async () => {
    const handler = createAzureTokenSimulatorHandler({
      environment: validEnvironment,
    });

    const emptyResponse = await handler(createRequest());
    const partialResponse = await handler(
      createRequest('grant_type=client_credentials&client_id='),
    );

    expect(emptyResponse.status).toBe(200);
    await expect(emptyResponse.clone().json()).resolves.toMatchObject({
      access_token: validEnvironment.GRAPHQL_CALLBACK_SHARED_SECRET,
    });
    expect(partialResponse.status).toBe(200);
    await expect(partialResponse.clone().json()).resolves.toMatchObject({
      access_token: validEnvironment.GRAPHQL_CALLBACK_SHARED_SECRET,
    });
  });

  it('rejects a body larger than 2 KiB', async () => {
    const handler = createAzureTokenSimulatorHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-too-large',
    });

    const response = await handler(
      createRequest(`client_secret=${'x'.repeat(2_049)}`),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body',
        requestId: 'request-too-large',
      },
    });
  });

  it('never logs the request body contents', async () => {
    const requestBody =
      'grant_type=client_credentials&client_id=fake-client&client_secret=do-not-log-this-secret';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createAzureTokenSimulatorHandler({
      environment: validEnvironment,
    });

    const response = await handler(createRequest(requestBody));

    expect(response.status).toBe(200);
    for (const spy of [logSpy, infoSpy, warnSpy, errorSpy]) {
      expect(spy).not.toHaveBeenCalled();
      expect(JSON.stringify(spy.mock.calls)).not.toContain(
        'do-not-log-this-secret',
      );
    }
  });
});
