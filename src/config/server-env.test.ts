import { describe, expect, it } from 'vitest';

import { ServerEnvironmentError, parseServerEnvironment } from './server-env';

const validEnvironment = {
  APP_ENV: 'test',
  TARGET_ENV: 'mrv-devDan',
  TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
  TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
  DATABASE_URL: 'postgresql://app:secret@localhost:5432/ms_clientes',
  QSTASH_URL: 'https://qstash.example.com',
};

describe('parseServerEnvironment', () => {
  it('returns a validated server configuration', () => {
    expect(parseServerEnvironment(validEnvironment)).toStrictEqual({
      ...validEnvironment,
      ORCHESTRATION_ENABLED: false,
      SALESFORCE_DISPATCH_ENABLED: false,
      SALESFORCE_TEST_DATA_ENABLED: false,
    });
  });

  it('keeps orchestration disabled by default without requiring new secrets', () => {
    const configuration = parseServerEnvironment(validEnvironment);

    expect(configuration.ORCHESTRATION_ENABLED).toBe(false);
    expect(configuration.SALESFORCE_DISPATCH_ENABLED).toBe(false);
    expect(configuration.SALESFORCE_TEST_DATA_ENABLED).toBe(false);
    expect(configuration).not.toHaveProperty('SIMULATOR_ADMIN_API_KEY');
    expect(configuration).not.toHaveProperty('IDEMPOTENCY_HASH_PEPPER');
    expect(configuration).not.toHaveProperty('QSTASH_TOKEN');
    expect(configuration).not.toHaveProperty('SALESFORCE_CLIENT_ID');
  });

  it('ignores empty orchestration-only placeholders while disabled', () => {
    expect(
      parseServerEnvironment({
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'false',
        SIMULATOR_ADMIN_API_KEY: '',
        IDEMPOTENCY_HASH_PEPPER: '',
        PUBLIC_APP_BASE_URL: '',
        QSTASH_TOKEN: '',
        QSTASH_CURRENT_SIGNING_KEY: '',
        QSTASH_NEXT_SIGNING_KEY: '',
      }),
    ).toStrictEqual({
      ...validEnvironment,
      ORCHESTRATION_ENABLED: false,
      SALESFORCE_DISPATCH_ENABLED: false,
      SALESFORCE_TEST_DATA_ENABLED: false,
    });
  });

  it('requires and validates orchestration-only configuration when enabled', () => {
    expect(
      parseServerEnvironment({
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
      }),
    ).toMatchObject({
      ORCHESTRATION_ENABLED: true,
      SALESFORCE_DISPATCH_ENABLED: false,
      PUBLIC_APP_BASE_URL: 'https://simulator.example.com',
    });
  });

  it('requires orchestration when real Salesforce dispatch is enabled', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        SALESFORCE_DISPATCH_ENABLED: 'true',
      }),
    ).toThrowError('SALESFORCE_DISPATCH_ENABLED');
  });

  it('requires orchestration and real dispatch when Salesforce test data is enabled', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        SALESFORCE_TEST_DATA_ENABLED: 'true',
      }),
    ).toThrowError('SALESFORCE_TEST_DATA_ENABLED');

    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'true',
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
      }),
    ).toThrowError('SALESFORCE_TEST_DATA_ENABLED');
  });

  it('reuses dispatch OAuth configuration when Salesforce test data is enabled', () => {
    expect(
      parseServerEnvironment({
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
      }),
    ).toMatchObject({
      ORCHESTRATION_ENABLED: true,
      SALESFORCE_DISPATCH_ENABLED: true,
      SALESFORCE_TEST_DATA_ENABLED: true,
    });
  });

  it('requires Salesforce client credentials only when real dispatch is enabled', () => {
    expect(
      parseServerEnvironment({
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'true',
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
      }),
    ).toMatchObject({
      ORCHESTRATION_ENABLED: true,
      SALESFORCE_DISPATCH_ENABLED: true,
      SALESFORCE_TOKEN_URL:
        'https://example.my.salesforce.com/services/oauth2/token',
    });
  });

  it.each([
    'SALESFORCE_CLIENT_ID',
    'SALESFORCE_CLIENT_SECRET',
    'SALESFORCE_TOKEN_URL',
  ] as const)(
    'fails closed when real Salesforce dispatch is enabled without %s',
    (variableName) => {
      const enabledEnvironment: Record<string, string | undefined> = {
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'true',
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
      };
      delete enabledEnvironment[variableName];

      expect(() => parseServerEnvironment(enabledEnvironment)).toThrowError(
        variableName,
      );
    },
  );

  it.each([
    'http://example.my.salesforce.com/services/oauth2/token',
    'https://user:pass@example.my.salesforce.com/services/oauth2/token',
    'https://example.my.salesforce.com/services/oauth2/token?secret=1',
    'https://example.my.salesforce.com/services/oauth2/token#fragment',
    'https://example.my.salesforce.com/services/oauth2/authorize',
    'https://example.my.salesforce.com/services/oauth2/token/',
    'https://evil.example.com/services/oauth2/token',
  ])('rejects an unsafe Salesforce token URL when enabled: %s', (url) => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'true',
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
        SALESFORCE_TOKEN_URL: url,
      }),
    ).toThrowError('SALESFORCE_TOKEN_URL');
  });

  it.each([
    'https://example.my.salesforce.com/services/oauth2/token',
    'https://test.salesforce.com/services/oauth2/token',
  ])('accepts an OAuth token URL on an authorized host: %s', (url) => {
    expect(
      parseServerEnvironment({
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'true',
        SALESFORCE_DISPATCH_ENABLED: 'true',
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
        SALESFORCE_TOKEN_URL: url,
      }),
    ).toMatchObject({ SALESFORCE_TOKEN_URL: url });
  });

  it.each([
    'SIMULATOR_ADMIN_API_KEY',
    'IDEMPOTENCY_HASH_PEPPER',
    'PUBLIC_APP_BASE_URL',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
  ] as const)(
    'fails closed when orchestration is enabled without %s',
    (variableName) => {
      const enabledEnvironment: Record<string, string | undefined> = {
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
      };
      delete enabledEnvironment[variableName];

      expect(() => parseServerEnvironment(enabledEnvironment)).toThrowError(
        variableName,
      );
    },
  );

  it.each([
    'http://simulator.example.com',
    'https://user:password@simulator.example.com',
    'https://simulator.example.com?token=secret',
    'https://simulator.example.com#fragment',
  ])('rejects an unsafe public app URL when enabled', (url) => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        ORCHESTRATION_ENABLED: 'true',
        SIMULATOR_ADMIN_API_KEY:
          'admin-api-key-with-at-least-thirty-two-characters',
        IDEMPOTENCY_HASH_PEPPER:
          'idempotency-pepper-with-at-least-thirty-two-characters',
        PUBLIC_APP_BASE_URL: url,
        QSTASH_TOKEN: 'qstash-token-with-at-least-thirty-two-characters',
        QSTASH_CURRENT_SIGNING_KEY:
          'current-signing-key-with-at-least-thirty-two-characters',
        QSTASH_NEXT_SIGNING_KEY:
          'next-signing-key-with-at-least-thirty-two-characters',
      }),
    ).toThrowError('PUBLIC_APP_BASE_URL');
  });

  it('defaults only APP_ENV to development', () => {
    const environmentWithoutAppEnvironment = {
      TARGET_ENV: validEnvironment.TARGET_ENV,
      TARGET_SALESFORCE_BASE_URL: validEnvironment.TARGET_SALESFORCE_BASE_URL,
      TARGET_SALESFORCE_ORG_ID: validEnvironment.TARGET_SALESFORCE_ORG_ID,
      DATABASE_URL: validEnvironment.DATABASE_URL,
      QSTASH_URL: validEnvironment.QSTASH_URL,
    };

    expect(
      parseServerEnvironment(environmentWithoutAppEnvironment).APP_ENV,
    ).toBe('development');
  });

  it('fails closed when a required variable is absent', () => {
    const environmentWithoutDatabaseUrl = {
      APP_ENV: validEnvironment.APP_ENV,
      TARGET_ENV: validEnvironment.TARGET_ENV,
      TARGET_SALESFORCE_BASE_URL: validEnvironment.TARGET_SALESFORCE_BASE_URL,
      TARGET_SALESFORCE_ORG_ID: validEnvironment.TARGET_SALESFORCE_ORG_ID,
      QSTASH_URL: validEnvironment.QSTASH_URL,
    };

    expect(() =>
      parseServerEnvironment(environmentWithoutDatabaseUrl),
    ).toThrowError(ServerEnvironmentError);
    expect(() =>
      parseServerEnvironment(environmentWithoutDatabaseUrl),
    ).toThrowError('DATABASE_URL');
  });

  it('rejects a target other than the authorized sandbox', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        TARGET_ENV: 'production',
      }),
    ).toThrowError('TARGET_ENV');
  });

  it('rejects an organization other than the authorized organization', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        TARGET_SALESFORCE_ORG_ID: '00D000000000000000',
      }),
    ).toThrowError('TARGET_SALESFORCE_ORG_ID');
  });

  it('rejects an HTTP Salesforce URL', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        TARGET_SALESFORCE_BASE_URL: 'http://example.my.salesforce.com',
      }),
    ).toThrowError('TARGET_SALESFORCE_BASE_URL');
  });

  it.each([
    'https://user:password@example.my.salesforce.com',
    'https://example.my.salesforce.com?token=sensitive',
    'https://example.my.salesforce.com?',
    'https://example.my.salesforce.com#sensitive',
    'https://example.my.salesforce.com#',
  ])('rejects a Salesforce URL with unsafe URL components', (url) => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        TARGET_SALESFORCE_BASE_URL: url,
      }),
    ).toThrowError('TARGET_SALESFORCE_BASE_URL');
  });

  it('rejects a database URL with an unsupported protocol', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: 'mysql://app:secret@localhost:3306/ms_clientes',
      }),
    ).toThrowError('DATABASE_URL');
  });

  it('rejects a database URL with an empty password', () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: 'postgresql://app:@localhost:5432/ms_clientes',
      }),
    ).toThrowError('DATABASE_URL');
  });

  it.each([
    'http://qstash.example.com',
    'https://user:password@qstash.example.com',
    'https://qstash.example.com?token=sensitive',
    'https://qstash.example.com?',
    'https://qstash.example.com#sensitive',
    'https://qstash.example.com#',
  ])('rejects an insecure QStash URL', (url) => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        QSTASH_URL: url,
      }),
    ).toThrowError('QSTASH_URL');
  });

  it('normalizes trailing slashes without changing other configuration', () => {
    const configuration = parseServerEnvironment({
      ...validEnvironment,
      TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com/',
      QSTASH_URL: 'https://qstash.example.com/',
    });

    expect(configuration.TARGET_SALESFORCE_BASE_URL).toBe(
      'https://example.my.salesforce.com',
    );
    expect(configuration.QSTASH_URL).toBe('https://qstash.example.com');
  });

  it('reports only invalid variable names and never their values', () => {
    const sensitiveValue =
      'https://user:do-not-disclose@example.com?token=secret';

    try {
      parseServerEnvironment({
        ...validEnvironment,
        TARGET_SALESFORCE_BASE_URL: sensitiveValue,
      });
      throw new Error('Expected validation to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ServerEnvironmentError);
      expect(error).toHaveProperty('invalidVariables', [
        'TARGET_SALESFORCE_BASE_URL',
      ]);
      expect(String(error)).not.toContain(sensitiveValue);
      expect(String(error)).not.toContain('do-not-disclose');
      expect(String(error)).not.toContain('secret');
    }
  });
});
