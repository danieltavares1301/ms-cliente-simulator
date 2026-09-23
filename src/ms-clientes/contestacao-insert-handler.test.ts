import { afterEach, describe, expect, it, vi } from 'vitest';

import { createContestacaoInsertCallbackHandler } from './contestacao-insert-handler';

const validEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: '******localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
  ORCHESTRATION_ENABLED: 'true',
  CONTESTACAO_INSERT_CALLBACK_ENABLED: 'true',
} as const;

const validBody = JSON.stringify({
  idPac: 'PAC-SIM-001',
  idMotivo: 'MOTIVO-01',
  descricao: 'Contestacao sintetica',
  usuarioSolucao: null,
});

function createRequest(body?: string, headers?: HeadersInit): Request {
  return new Request(
    'https://simulator.example.com/api/ms-clientes/contestacao-insert',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer contestacao-token-placeholder',
        'content-type': 'application/json',
        ...headers,
      },
      ...(body === undefined ? {} : { body }),
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createContestacaoInsertCallbackHandler', () => {
  it.each([
    {
      name: 'orchestration is disabled',
      environment: {
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'false',
      },
    },
    {
      name: 'the contestacao insert callback flag is disabled',
      environment: {
        ...validEnvironment,
        CONTESTACAO_INSERT_CALLBACK_ENABLED: 'false',
      },
    },
  ])('returns 503 when $name', async ({ environment }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createContestacaoInsertCallbackHandler({
      environment,
      requestIdFactory: () => 'request-disabled',
    });

    const response = await handler(createRequest(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'CONTESTACAO_INSERT_CALLBACK_DISABLED',
        message: 'Contestacao insert callback is disabled',
        requestId: 'request-disabled',
      },
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'the body is absent',
      request: createRequest(undefined),
    },
    {
      name: 'the body is not valid JSON',
      request: createRequest('{'),
    },
    {
      name: 'the body is larger than 4 KiB',
      request: createRequest(`{"payload":"${'x'.repeat(4_200)}"}`),
    },
  ])('returns 422 when $name', async ({ request }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createContestacaoInsertCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-invalid',
    });

    const response = await handler(request);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body',
        requestId: 'request-invalid',
      },
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('returns 422 when the JSON payload does not satisfy the contestacao insert contract', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createContestacaoInsertCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-schema',
    });

    const response = await handler(
      createRequest(
        JSON.stringify({
          descricao: 123,
        }),
      ),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body',
        requestId: 'request-schema',
      },
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'the authorization header is absent',
      request: new Request(createRequest().url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: validBody,
      }),
    },
    {
      name: 'the authorization header does not use the Bearer prefix',
      request: createRequest(validBody, {
        authorization: 'SharedAccessSignature sr=https%3A%2F%2Fexample',
      }),
    },
  ])('returns 401 when $name', async ({ request }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createContestacaoInsertCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-unauthorized',
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        requestId: 'request-unauthorized',
      },
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('returns 201 with a non-empty id and emits a structured log without leaking the bearer token or the free-text descricao', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createContestacaoInsertCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-success',
    });

    const response = await handler(createRequest(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({
      id: 'request-success',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);

    const [rawLog] = logSpy.mock.calls[0] ?? [];
    expect(typeof rawLog).toBe('string');
    expect(rawLog).not.toContain('Bearer');
    // Minimization: descricao is real free text submitted by end users
    // (e.g. "mudar de sexo de masculino para feminino", observed in real
    // mrv-staging traffic) and must never reach the plaintext log stream.
    expect(rawLog).not.toContain('Contestacao sintetica');

    const parsedLog = JSON.parse(String(rawLog)) as Record<string, unknown>;
    expect(parsedLog).toMatchObject({
      idPac: 'PAC-SIM-001',
      idMotivo: 'MOTIVO-01',
      usuarioSolucao: null,
      requestId: 'request-success',
      responseStatusCode: 201,
      contestacaoId: 'request-success',
      descricaoProvided: true,
    });
    expect(parsedLog).not.toHaveProperty('descricao');
    expect(typeof parsedLog.receivedAt).toBe('string');
    expect(new Date(String(parsedLog.receivedAt)).toString()).not.toBe(
      'Invalid Date',
    );
  });
});
