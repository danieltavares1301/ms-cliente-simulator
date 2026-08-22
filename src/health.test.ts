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
      'dependencies',
    ]);
    expect(Object.keys(response.dependencies)).toStrictEqual([
      'application',
      'configuration',
    ]);
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
