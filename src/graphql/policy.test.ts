import { describe, expect, it, vi } from 'vitest';

import {
  graphqlErrorResponseSchema,
  graphqlResponseSchema,
} from '../contracts';
import {
  DEFAULT_GRAPHQL_RESPONSE_POLICY,
  MAX_DELAYED_RESPONSE_MS,
  createGraphqlPolicyResponse,
} from './policy';

describe('createGraphqlPolicyResponse', () => {
  it('uses a documented deterministic default when no correlated run defines a policy', async () => {
    const response = await createGraphqlPolicyResponse({
      policy: DEFAULT_GRAPHQL_RESPONSE_POLICY,
      clienteId: 'CLI-SIM-001',
    });

    expect(response.status).toBe(200);
    expect(
      graphqlResponseSchema.parse(await response.clone().json()),
    ).toStrictEqual({
      data: { atualizarCliente: { id: 'CLI-SIM-001' } },
    });
  });

  it('returns the expected status and response shape for every supported policy', async () => {
    const cases = [
      { policy: 'SUCCESS_200', status: 200, kind: 'success' },
      { policy: 'SUCCESS_201', status: 201, kind: 'success' },
      { policy: 'GRAPHQL_ERROR_200', status: 200, kind: 'graphql-error' },
      { policy: 'HTTP_400', status: 400, kind: 'http-error' },
      { policy: 'HTTP_401', status: 401, kind: 'http-error' },
      { policy: 'HTTP_429', status: 429, kind: 'http-error' },
      { policy: 'HTTP_500', status: 500, kind: 'http-error' },
      { policy: 'INVALID_JSON_200', status: 200, kind: 'invalid-json' },
      { policy: 'EMPTY_BODY_200', status: 200, kind: 'empty' },
    ] as const;

    for (const testCase of cases) {
      const response = await createGraphqlPolicyResponse({
        policy: testCase.policy,
        clienteId: 'CLI-SIM-001',
      });
      const bodyText = await response.clone().text();

      expect(response.status).toBe(testCase.status);

      if (testCase.kind === 'success') {
        expect(graphqlResponseSchema.parse(JSON.parse(bodyText))).toStrictEqual(
          {
            data: { atualizarCliente: { id: 'CLI-SIM-001' } },
          },
        );
      } else if (testCase.kind === 'graphql-error') {
        expect(
          graphqlErrorResponseSchema.parse(JSON.parse(bodyText)),
        ).toStrictEqual({
          errors: [{ message: 'Simulated GraphQL callback failure' }],
        });
      } else if (testCase.kind === 'http-error') {
        expect(bodyText).toContain('error');
        expect(bodyText).not.toContain('CLI-SIM-001');
      } else if (testCase.kind === 'invalid-json') {
        expect(() => JSON.parse(bodyText)).toThrow();
      } else {
        expect(bodyText).toBe('');
      }
    }
  });

  it('documents the delayed-response cap used by timeout scenarios', () => {
    expect(MAX_DELAYED_RESPONSE_MS).toBe(8_000);
  });

  it('caps delayed responses below the Apex timeout and Vercel budget', async () => {
    vi.useFakeTimers();

    const responsePromise = createGraphqlPolicyResponse({
      policy: 'DELAYED_RESPONSE',
      clienteId: 'CLI-SIM-001',
      delayedResponseMs: MAX_DELAYED_RESPONSE_MS + 1_000,
    });

    await vi.advanceTimersByTimeAsync(MAX_DELAYED_RESPONSE_MS - 1);
    let settled = false;
    void responsePromise.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const response = await responsePromise;

    expect(settled).toBe(true);
    expect(response.status).toBe(200);
    expect(
      graphqlResponseSchema.parse(await response.clone().json()),
    ).toStrictEqual({
      data: { atualizarCliente: { id: 'CLI-SIM-001' } },
    });

    vi.useRealTimers();
  });
});
