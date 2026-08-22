import packageJson from '../package.json';
import type { HealthResponse } from './contracts';
import { parseServerEnvironment } from './config/server-env';

export type { HealthResponse } from './contracts';

export function createHealthResponse(
  environment: Record<string, string | undefined>,
): HealthResponse {
  parseServerEnvironment(environment);

  return {
    status: 'ok',
    version: packageJson.version,
    dependencies: {
      application: 'ok',
      configuration: 'ok',
    },
  };
}
