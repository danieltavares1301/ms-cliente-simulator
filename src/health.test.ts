import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';
import { createHealthResponse } from './health';

const validEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: 'postgresql://app:secret@localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
};

describe('createHealthResponse', () => {
  it('returns the exact health contract with a non-sensitive configuration summary', () => {
    const response = createHealthResponse(validEnvironment);

    expect(response).toStrictEqual({
      status: 'ok',
      version: packageJson.version,
      orchestration: 'disabled',
      testData: 'disabled',
      dependencies: {
        application: 'ok',
        configuration: 'ok',
      },
    });
  });

  it('obtains the reported version from package.json', () => {
    const response = createHealthResponse(validEnvironment);

    expect(response.version).toBe(packageJson.version);
  });

  it('does not expose unexpected fields or dependencies', () => {
    const response = createHealthResponse(validEnvironment);

    expect(Object.keys(response)).toStrictEqual([
      'status',
      'version',
      'orchestration',
      'testData',
      'dependencies',
    ]);
    expect(Object.keys(response.dependencies)).toStrictEqual([
      'application',
      'configuration',
    ]);
  });

  it('reports configured orchestration without probing external dependencies', () => {
    const response = createHealthResponse({
      ...validEnvironment,
      ORCHESTRATION_ENABLED: 'true',
      SIMULATOR_ADMIN_API_KEY:
        'admin-api-key-with-at-least-thirty-two-characters',
      IDEMPOTENCY_HASH_PEPPER:
        'idempotency-pepper-with-at-least-thirty-two-characters',
      PUBLIC_APP_BASE_URL: 'https://simulator.example.com',
      QSTASH_TOKEN: 'qstash-token-with-at-least-thirty-two-characters',
      QSTASH_CURRENT_SIGNING_KEY:
        'current-signing-key-with-at-least-thirty-two-characters',
      QSTASH_NEXT_SIGNING_KEY:
        'next-signing-key-with-at-least-thirty-two-characters',
    });

    expect(response.orchestration).toBe('configured');
    expect(response.testData).toBe('disabled');
    expect(JSON.stringify(response)).not.toContain('admin-api-key');
    expect(JSON.stringify(response)).not.toContain('qstash-token');
  });

  it('reports configured test data without probing Salesforce', () => {
    const response = createHealthResponse({
      ...validEnvironment,
      ORCHESTRATION_ENABLED: 'true',
      SALESFORCE_DISPATCH_ENABLED: 'true',
      SALESFORCE_TEST_DATA_ENABLED: 'true',
      SIMULATOR_ADMIN_API_KEY:
        'admin-api-key-with-at-least-thirty-two-characters',
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
    });

    expect(response.testData).toBe('configured');
    expect(JSON.stringify(response)).not.toContain('salesforce-client');
  });

  it('fails closed without returning environment values', () => {
    const sensitiveValue =
      'https://user:do-not-disclose@example.my.salesforce.com';

    expect(() =>
      createHealthResponse({
        ...validEnvironment,
        TARGET_SALESFORCE_BASE_URL: sensitiveValue,
      }),
    ).toThrowError('TARGET_SALESFORCE_BASE_URL');

    try {
      createHealthResponse({
        ...validEnvironment,
        TARGET_SALESFORCE_BASE_URL: sensitiveValue,
      });
    } catch (error: unknown) {
      expect(String(error)).not.toContain(sensitiveValue);
      expect(String(error)).not.toContain('do-not-disclose');
    }
  });
});
