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
    expect(parseServerEnvironment(validEnvironment)).toStrictEqual(
      validEnvironment,
    );
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
