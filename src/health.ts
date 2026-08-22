import packageJson from '../package.json';
import { parseServerEnvironment } from './config/server-env';

export type HealthResponse = {
  status: 'ok';
  version: string;
  dependencies: {
    application: 'ok';
    configuration: 'ok';
  };
};

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
