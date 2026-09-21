import { createRunRepository } from '../db/runtime';
import { productionSalesforceServices } from '../salesforce/production';

import { createGraphqlCallbackHandler } from './handler';

export const productionGraphqlCallbackHandler = createGraphqlCallbackHandler({
  environment: process.env,
  repositoryFactory: () => createRunRepository(process.env),
  testDataAdapter: productionSalesforceServices.testDataAdapter,
});
