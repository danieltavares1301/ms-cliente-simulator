import { describe, expect, it, vi } from 'vitest';

import { renderScenarioFixture } from '../scenarios/renderer';
import { createSalesforceProductionServices } from './production';

const environment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: [
    'postgresql://test-user',
    'test-password@localhost:5432/ms_clientes',
  ].join(':'),
  QSTASH_URL: 'https://qstash.example.com',
  ORCHESTRATION_ENABLED: 'true',
  SALESFORCE_DISPATCH_ENABLED: 'true',
  SALESFORCE_TEST_DATA_ENABLED: 'true',
  SIMULATOR_ADMIN_API_KEY: 'admin-api-key-with-at-least-thirty-two-characters',
  IDEMPOTENCY_HASH_PEPPER:
    'idempotency-pepper-with-at-least-thirty-two-characters',
  PUBLIC_APP_BASE_URL: 'https://simulator.example.com',
  QSTASH_TOKEN: 'qstash-token-with-at-least-thirty-two-characters',
  QSTASH_CURRENT_SIGNING_KEY:
    'current-signing-key-with-at-least-thirty-two-characters',
  QSTASH_NEXT_SIGNING_KEY:
    'next-signing-key-with-at-least-thirty-two-characters',
  SALESFORCE_CLIENT_ID: 'salesforce-client-id',
  SALESFORCE_CLIENT_SECRET: 'salesforce-client-secret',
  SALESFORCE_TOKEN_URL:
    'https://example.my.salesforce.com/services/oauth2/token',
} satisfies Record<string, string>;

describe('Salesforce production composition', () => {
  it('is lazy and shares one OAuth token across adapter and dispatch target', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (request) => {
      const url = String(request);
      if (url.endsWith('/services/oauth2/token')) {
        return Response.json({
          access_token: 'test-access-token',
          instance_url: 'https://example.my.salesforce.com',
          token_type: 'Bearer',
        });
      }
      if (url.includes('FROM+Organization')) {
        return Response.json({
          totalSize: 1,
          done: true,
          records: [{ Id: '00DHZ000006mzDp2AI', IsSandbox: true }],
        });
      }
      if (url.includes('/query?')) {
        return Response.json({ totalSize: 0, done: true, records: [] });
      }
      return new Response(null, { status: 200, statusText: 'OK' });
    });
    const services = createSalesforceProductionServices(environment, {
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();

    const fixture = renderScenarioFixture({
      scenarioKey: 'no-match-cliente-insert',
      version: 1,
      seed: 'shared-oauth',
      runId: 'run_11111111111141118111111111111111',
      eventStartAt: '2026-09-20T15:00:00.000Z',
    });
    await services.testDataAdapter.setup({
      runId: fixture.runId,
      scenarioKey: 'no-match-cliente-insert',
      fixture,
    });
    await services.dispatchTarget.dispatch({
      runId: '11111111-1111-4111-8111-111111111111',
      stepId: '22222222-2222-4222-8222-222222222222',
      attemptNumber: 1,
      envelope: fixture.steps[0]!.envelope,
    });

    expect(
      fetchFn.mock.calls.filter(([request]) =>
        String(request).endsWith('/services/oauth2/token'),
      ),
    ).toHaveLength(1);
  });
});
