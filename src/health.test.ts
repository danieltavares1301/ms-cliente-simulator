import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';
import { createHealthResponse } from './health';

describe('createHealthResponse', () => {
  it('returns the exact basic health contract', () => {
    const response = createHealthResponse();

    expect(response).toStrictEqual({
      status: 'ok',
      version: packageJson.version,
      dependencies: {
        application: 'ok',
      },
    });
  });

  it('obtains the reported version from package.json', () => {
    const response = createHealthResponse();

    expect(response.version).toBe(packageJson.version);
  });

  it('does not expose unexpected fields or dependencies', () => {
    const response = createHealthResponse();

    expect(Object.keys(response)).toStrictEqual([
      'status',
      'version',
      'dependencies',
    ]);
    expect(Object.keys(response.dependencies)).toStrictEqual(['application']);
  });
});
