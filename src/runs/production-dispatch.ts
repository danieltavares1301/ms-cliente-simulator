import { parseServerEnvironment } from '../config/server-env';
import { createRunRepository } from '../db/runtime';
import {
  createSalesforceProductionServices,
  productionSalesforceServices,
} from '../salesforce/production';
import { createDispatchHandler, createQStashReceiver } from './dispatch';

export function createProductionDispatchTarget(
  environment: Record<string, string | undefined>,
) {
  return createSalesforceProductionServices(environment).dispatchTarget;
}

export const productionDispatchHandler = createDispatchHandler({
  environment: process.env,
  repositoryFactory: () => createRunRepository(process.env),
  receiverFactory: () => {
    const configuration = parseServerEnvironment(process.env);
    if (!configuration.ORCHESTRATION_ENABLED) {
      throw new Error('Orchestration is disabled');
    }
    return createQStashReceiver({
      currentSigningKey: configuration.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: configuration.QSTASH_NEXT_SIGNING_KEY,
    });
  },
  target: productionSalesforceServices.dispatchTarget,
  testDataAdapter: productionSalesforceServices.testDataAdapter,
});
