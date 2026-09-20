import { describe, expect, it, vi } from 'vitest';

import type {
  GraphqlCallbackRecord,
  Run,
  RunRepository,
} from '../db/run-repository';
import { createGraphqlCallbackHandler } from './handler';

const validEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
  ORCHESTRATION_ENABLED: 'true',
  GRAPHQL_CALLBACK_ENABLED: 'true',
  GRAPHQL_CALLBACK_SHARED_SECRET:
    'graphql-callback-secret-with-at-least-32-characters',
  IDEMPOTENCY_HASH_PEPPER:
    'idempotency-pepper-with-at-least-thirty-two-characters',
} as const;

const graphqlBody =
  'mutation{atualizarCliente(cliente:{id:"ABC123",idProspectSalesforce:"XYZ789",nomeCompleto:"Fulano"}){id}}';

function encodeJwtSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function createAzureBearerAuthorizationHeader(): string {
  const header = encodeJwtSegment({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeJwtSegment({
    exp: 1_885_000_000,
    iss: 'https://login.microsoftonline.com/example-tenant/v2.0',
  });
  const signature = Buffer.from('signature', 'utf8').toString('base64url');

  return `Bearer ${header}.${payload}.${signature}`;
}

function createRequest(body = graphqlBody, headers?: HeadersInit): Request {
  return new Request('https://simulator.example.com/api/ms-clientes/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${validEnvironment.GRAPHQL_CALLBACK_SHARED_SECRET}`,
      'content-type': 'application/graphql',
      ...headers,
    },
    body,
  });
}

function runWithPolicy(policy: string): Run {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    scenarioKey: 'match-id-cliente',
    scenarioVersion: 1,
    status: 'WAITING_ASYNC',
    idempotencyKeyHash: 'a'.repeat(64),
    requestFingerprint: 'b'.repeat(64),
    requestedBy: 'simulator-admin-api',
    seed: 1,
    variablesRedacted: { graphqlResponsePolicy: policy },
    fixtureSnapshot: null,
    dryRun: false,
    stopOnFailure: true,
    expectedCallbackMin: 1,
    expectedCallbackMax: 1,
    asyncWaitDeadline: new Date('2026-09-20T22:00:00.000Z'),
    cleanupPolicy: 'ALWAYS',
    dispatchMode: 'FAKE',
    testDataEnabled: false,
    createdAt: new Date('2026-09-20T21:00:00.000Z'),
    startedAt: null,
    finishedAt: null,
    retentionExpiresAt: new Date('2026-09-21T21:00:00.000Z'),
    schedulingKind: null,
    schedulingLeaseExpiresAt: null,
  };
}

describe('createGraphqlCallbackHandler', () => {
  it('returns 503 when the feature flag is disabled and does not touch persistence', async () => {
    const repositoryFactory = vi.fn();
    const handler = createGraphqlCallbackHandler({
      environment: {
        ...validEnvironment,
        GRAPHQL_CALLBACK_ENABLED: 'false',
      },
      repositoryFactory: repositoryFactory as unknown as () => RunRepository,
    });

    const response = await handler(createRequest());

    expect(response.status).toBe(503);
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('returns the same 401 for missing or invalid auth without touching persistence', async () => {
    const repositoryFactory = vi.fn();
    const handler = createGraphqlCallbackHandler({
      environment: validEnvironment,
      repositoryFactory: repositoryFactory as unknown as () => RunRepository,
      requestIdFactory: () => 'request-401',
    });

    const missing = await handler(
      new Request(createRequest().url, {
        method: 'POST',
        headers: { 'content-type': 'application/graphql' },
        body: graphqlBody,
      }),
    );
    const invalid = await handler(
      createRequest(graphqlBody, { authorization: 'Bearer wrong-secret' }),
    );

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(await missing.clone().json()).toStrictEqual(
      await invalid.clone().json(),
    );
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('accepts a structurally valid Azure bearer token without persisting the raw token', async () => {
    const recordGraphqlCallback = vi.fn().mockResolvedValue({
      callback: { id: 'cb-1' } as GraphqlCallbackRecord,
      runStatus: null,
    });
    const repository = {
      findCorrelatableRun: vi.fn().mockResolvedValue(null),
      recordGraphqlCallback,
    } as unknown as RunRepository;
    const authorization = createAzureBearerAuthorizationHeader();
    const handler = createGraphqlCallbackHandler({
      environment: {
        ...validEnvironment,
        GRAPHQL_CALLBACK_AUTH_MODE: 'AZURE_BEARER_STRUCTURAL',
        GRAPHQL_CALLBACK_SHARED_SECRET: undefined,
      },
      repositoryFactory: () => repository,
      requestIdFactory: () => 'request-azure',
    });

    const response = await handler(
      createRequest(graphqlBody, { authorization }),
    );

    expect(response.status).toBe(200);
    expect(await response.clone().json()).toStrictEqual({
      data: { atualizarCliente: { id: 'ABC123' } },
    });

    const persisted = recordGraphqlCallback.mock.calls[0]?.[0];
    const persistedJson = JSON.stringify(persisted);
    expect(persisted).toMatchObject({
      requestId: 'request-azure',
      operationName: 'atualizarCliente',
      httpStatus: 200,
    });
    expect(persistedJson).not.toContain(authorization);
    expect(persistedJson).not.toContain('microsoftonline.com');
    expect(persistedJson).not.toContain('Fulano');
  });

  it('returns the same 401 for invalid Azure bearer tokens without touching persistence', async () => {
    const repositoryFactory = vi.fn();
    const handler = createGraphqlCallbackHandler({
      environment: {
        ...validEnvironment,
        GRAPHQL_CALLBACK_AUTH_MODE: 'AZURE_BEARER_STRUCTURAL',
        GRAPHQL_CALLBACK_SHARED_SECRET: undefined,
      },
      repositoryFactory: repositoryFactory as unknown as () => RunRepository,
      requestIdFactory: () => 'request-azure-401',
    });

    const missing = await handler(
      new Request(createRequest().url, {
        method: 'POST',
        headers: { 'content-type': 'application/graphql' },
        body: graphqlBody,
      }),
    );
    const invalid = await handler(
      createRequest(graphqlBody, { authorization: 'Bearer not-a-jwt' }),
    );

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(await missing.clone().json()).toStrictEqual(
      await invalid.clone().json(),
    );
    expect(JSON.stringify(await invalid.clone().json())).not.toContain(
      'not-a-jwt',
    );
    expect(repositoryFactory).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies with the same limit used by dispatch-style handlers', async () => {
    const repository: Pick<
      RunRepository,
      'findCorrelatableRun' | 'recordGraphqlCallback'
    > = {
      findCorrelatableRun: vi.fn().mockResolvedValue(null),
      recordGraphqlCallback: vi.fn().mockResolvedValue({
        callback: { id: 'cb-1' } as GraphqlCallbackRecord,
        runStatus: null,
      }),
    };
    const handler = createGraphqlCallbackHandler({
      environment: validEnvironment,
      repositoryFactory: () => repository as unknown as RunRepository,
    });

    const response = await handler(
      createRequest(`mutation{${'x'.repeat(17_000)}}`),
    );

    expect(response.status).toBe(413);
  });

  it('accepts both application/graphql and application/json and persists only sanitized metadata', async () => {
    const recordGraphqlCallback = vi.fn().mockResolvedValue({
      callback: { id: 'cb-1' } as GraphqlCallbackRecord,
      runStatus: null,
    });
    const repository = {
      findCorrelatableRun: vi.fn().mockResolvedValue(null),
      recordGraphqlCallback,
    } as unknown as RunRepository;
    const handler = createGraphqlCallbackHandler({
      environment: validEnvironment,
      repositoryFactory: () => repository,
      requestIdFactory: () => 'request-123',
    });

    const graphResponse = await handler(createRequest());
    const jsonResponse = await handler(
      createRequest(JSON.stringify({ query: graphqlBody }), {
        'content-type': 'application/json',
      }),
    );

    expect(graphResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(await graphResponse.clone().json()).toStrictEqual({
      data: { atualizarCliente: { id: 'ABC123' } },
    });
    expect(await jsonResponse.clone().json()).toStrictEqual({
      data: { atualizarCliente: { id: 'ABC123' } },
    });

    const persisted = recordGraphqlCallback.mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      requestId: 'request-123',
      operationName: 'atualizarCliente',
      runId: null,
      policy: 'SUCCESS_200',
      httpStatus: 200,
    });
    const persistedJson = JSON.stringify(persisted);
    expect(persistedJson).not.toContain(
      validEnvironment.GRAPHQL_CALLBACK_SHARED_SECRET,
    );
    expect(persistedJson).not.toContain('Fulano');
    expect(persistedJson).not.toContain(graphqlBody);
    expect(persisted.requestRedacted).toMatchObject({
      source: 'application/graphql',
      fieldNames: ['id', 'idProspectSalesforce', 'nomeCompleto'],
    });
  });

  it('uses the correlated run policy when available and keeps invalid requests sanitized', async () => {
    const recordGraphqlCallback = vi.fn().mockResolvedValue({
      callback: { id: 'cb-1' } as GraphqlCallbackRecord,
      runStatus: 'VERIFYING',
    });
    const repository = {
      findCorrelatableRun: vi.fn().mockResolvedValue({
        run: runWithPolicy('HTTP_401'),
        matchedBy: 'both',
      }),
      recordGraphqlCallback,
    } as unknown as RunRepository;
    const handler = createGraphqlCallbackHandler({
      environment: validEnvironment,
      repositoryFactory: () => repository,
    });

    const correlated = await handler(createRequest());
    const invalid = await handler(
      createRequest(
        'mutation{atualizarCliente(cliente:{id:"ABC123"}){id nomeCompleto}}',
      ),
    );

    expect(correlated.status).toBe(401);
    expect(invalid.status).toBe(422);
    expect(recordGraphqlCallback).toHaveBeenCalledTimes(2);
    expect(recordGraphqlCallback.mock.calls[0]?.[0]).toMatchObject({
      runId: runWithPolicy('HTTP_401').id,
      policy: 'HTTP_401',
      httpStatus: 401,
    });
    expect(recordGraphqlCallback.mock.calls[1]?.[0]).toMatchObject({
      operationName: 'INVALID',
      runId: null,
      policy: 'SUCCESS_200',
      httpStatus: 422,
    });
    expect(
      JSON.stringify(recordGraphqlCallback.mock.calls[1]?.[0]),
    ).not.toContain('nomeCompleto');
  });
});
