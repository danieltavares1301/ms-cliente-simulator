import packageJson from '../package.json';
import type { HealthResponse } from './contracts';
import { parseServerEnvironment } from './config/server-env';

export type { HealthResponse } from './contracts';

export function createHealthResponse(
  environment: Record<string, string | undefined>,
): HealthResponse {
  const configuration = parseServerEnvironment(environment);

  return {
    status: 'ok',
    version: packageJson.version,
    orchestration: configuration.ORCHESTRATION_ENABLED
      ? 'configured'
      : 'disabled',
    dependencies: {
      application: 'ok',
      configuration: 'ok',
    },
  };
}
