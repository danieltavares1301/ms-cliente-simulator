import { createRunRepository } from '../db/runtime';

import { createGraphqlCallbackHandler } from './handler';

export const productionGraphqlCallbackHandler = createGraphqlCallbackHandler({
  environment: process.env,
  repositoryFactory: () => createRunRepository(process.env),
});
