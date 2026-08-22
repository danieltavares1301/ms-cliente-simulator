import { Client } from '@upstash/qstash';

import { parseServerEnvironment } from '../config/server-env';
import { createRunRepository } from '../db/runtime';
import type { RunRepository } from '../db/run-repository';
import { createRunApiHandlers } from './handlers';
import { QStashRunScheduler } from './qstash-scheduler';

function createProductionScheduler(repository: RunRepository) {
  const configuration = parseServerEnvironment(process.env);
  if (!configuration.ORCHESTRATION_ENABLED) {
    throw new Error('Orchestration is disabled');
  }
  return new QStashRunScheduler({
    repository,
    publicAppBaseUrl: configuration.PUBLIC_APP_BASE_URL,
    retries: 3,
    clientFactory: () =>
      new Client({
        token: configuration.QSTASH_TOKEN,
        baseUrl: configuration.QSTASH_URL,
      }),
  });
}

export const productionRunApiHandlers = createRunApiHandlers({
  environment: process.env,
  repositoryFactory: () => createRunRepository(process.env),
  schedulerFactory: createProductionScheduler,
});
