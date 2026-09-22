import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPacCreditoCallbackHandler } from './pac-credito-handler';

const validEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: '******localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
  ORCHESTRATION_ENABLED: 'true',
  PAC_CREDITO_CALLBACK_ENABLED: 'true',
} as const;

const validBody = JSON.stringify({
  IdSalesforcePac: 'a0BHZ0000001234',
  IdPac: 'PAC-001',
  IdJornada: null,
  DataCriacao: '2026-01-01T00:00:00.000Z',
});

function createRequest(body?: string, headers?: HeadersInit): Request {
  return new Request(
    'https://simulator.example.com/api/ms-clientes/pac-credito',
    {
      method: 'POST',
      headers: {
        authorization:
          'SharedAccessSignature sr=https%3A%2F%2Fexample&sig=fake&se=123&skn=RootManageSharedAccessKey',
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

describe('createPacCreditoCallbackHandler', () => {
  it.each([
    {
      name: 'orchestration is disabled',
      environment: {
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'false',
      },
    },
    {
      name: 'the PAC callback flag is disabled',
      environment: {
        ...validEnvironment,
        PAC_CREDITO_CALLBACK_ENABLED: 'false',
      },
    },
  ])('returns 503 when $name', async ({ environment }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createPacCreditoCallbackHandler({
      environment,
      requestIdFactory: () => 'request-disabled',
    });

    const response = await handler(createRequest(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: 'PAC_CREDITO_CALLBACK_DISABLED',
        message: 'PAC credito callback is disabled',
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
    const handler = createPacCreditoCallbackHandler({
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

  it('returns 422 when the JSON payload does not satisfy the PAC credito contract', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createPacCreditoCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-schema',
    });

    const response = await handler(
      createRequest(
        JSON.stringify({
          IdSalesforcePac: 'a0BHZ0000001234',
          DataCriacao: '2026-01-01T00:00:00.000Z',
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
      name: 'the authorization header does not use SharedAccessSignature',
      request: createRequest(validBody, {
        authorization: 'Bearer not-a-sas-token',
      }),
    },
  ])('returns 401 when $name', async ({ request }) => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createPacCreditoCallbackHandler({
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

  it('returns 201 and emits a structured log without leaking the SAS token', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createPacCreditoCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-success',
    });

    const response = await handler(createRequest(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({
      accepted: true,
      requestId: 'request-success',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);

    const [rawLog] = logSpy.mock.calls[0] ?? [];
    expect(typeof rawLog).toBe('string');
    expect(rawLog).not.toContain('SharedAccessSignature');

    const parsedLog = JSON.parse(String(rawLog)) as Record<string, unknown>;
    expect(parsedLog).toMatchObject({
      IdSalesforcePac: 'a0BHZ0000001234',
      IdPac: 'PAC-001',
      IdJornada: null,
      DataCriacao: '2026-01-01T00:00:00.000Z',
      requestId: 'request-success',
    });
    expect(typeof parsedLog.receivedAt).toBe('string');
    expect(new Date(String(parsedLog.receivedAt)).toString()).not.toBe(
      'Invalid Date',
    );
  });

  it('accepts a real Apex DateTime.now() serialization with non-zero milliseconds', async () => {
    // Regression: found via execução real do EnvioPACCreditoQueue contra
    // mrv-devDan (Fase 7) — o Apex serializa DateTime.now() com milissegundos
    // reais e arbitrários (ex.: "2026-09-21T23:36:05.153Z"), nunca ".000".
    // O schema original reaproveitava apexCompatibleUtcDateTimeSchema (que so
    // aceita ".000" ou ausencia de fracao, adequado para o envelope EVENT_GRID
    // que O PROPRIO simulador gera), rejeitando com 422 qualquer timestamp
    // real vindo do Apex.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createPacCreditoCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-real-apex-timestamp',
    });

    const response = await handler(
      createRequest(
        JSON.stringify({
          IdSalesforcePac: 'a0BHZ0000001234',
          IdPac: 'PAC-001',
          IdJornada: null,
          DataCriacao: '2026-09-21T23:36:05.153Z',
        }),
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({
      accepted: true,
      requestId: 'request-real-apex-timestamp',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('tolerates unknown extra fields sent by a newer Apex version (e.g. CodigoPAC observed in mrv-staging)', async () => {
    // Regression: análise de LogIntegracao__c real em mrv-staging (Fase 7)
    // mostrou um payload real de EnvioPACCreditoQueue com um campo extra
    // "CodigoPAC" que não existe no wrapper interno da classe atualmente
    // deployada em mrv-devDan/no repositório com_salesforce_mrv — evidência
    // de drift de versão entre ambientes. O schema usava .strict(), que
    // rejeitaria com 422 qualquer payload real contendo esse (ou outro)
    // campo desconhecido, mesmo sendo um payload legítimo do ponto de vista
    // do Apex real.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = createPacCreditoCallbackHandler({
      environment: validEnvironment,
      requestIdFactory: () => 'request-extra-field',
    });

    const response = await handler(
      createRequest(
        JSON.stringify({
          IdSalesforcePac: 'a0BHZ0000001234',
          IdPac: 'PAC-001',
          IdJornada: null,
          DataCriacao: '2026-01-01T00:00:00.000Z',
          CodigoPAC: 'PAC-751122',
        }),
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({
      accepted: true,
      requestId: 'request-extra-field',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
