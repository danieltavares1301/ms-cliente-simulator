import packageJson from '../package.json';

export type HealthResponse = {
  status: 'ok';
  version: string;
  dependencies: {
    application: 'ok';
  };
};

export function createHealthResponse(): HealthResponse {
  return {
    status: 'ok',
    version: packageJson.version,
    dependencies: {
      application: 'ok',
    },
  };
}
