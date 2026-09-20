import { parseServerEnvironment } from '../config/server-env';
import { createRunRepository } from '../db/runtime';
import { createSalesforceDispatchTarget } from '../salesforce/dispatch-target';
import { SalesforceOAuthClient } from '../salesforce/oauth-client';
import { createSalesforceSafetyGuard } from '../salesforce/safety-guard';
import {
  createDispatchHandler,
  type DispatchTarget,
  createQStashReceiver,
  FakeSalesforceDispatchTarget,
} from './dispatch';

export function createProductionDispatchTarget(
  environment: Record<string, string | undefined>,
) {
  let target: DispatchTarget | null = null;

  return {
    async dispatch(input: Parameters<DispatchTarget['dispatch']>[0]) {
      if (target === null) {
        const configuration = parseServerEnvironment(environment);
        if (!configuration.SALESFORCE_DISPATCH_ENABLED) {
          target = new FakeSalesforceDispatchTarget();
        } else {
          const oauthClient = new SalesforceOAuthClient({
            clientId: configuration.SALESFORCE_CLIENT_ID,
            clientSecret: configuration.SALESFORCE_CLIENT_SECRET,
            tokenUrl: configuration.SALESFORCE_TOKEN_URL,
          });

          target = createSalesforceDispatchTarget({
            oauthClient,
            safetyGuard: createSalesforceSafetyGuard({
              oauthClient,
              targetSalesforceBaseUrl: configuration.TARGET_SALESFORCE_BASE_URL,
              targetSalesforceOrgId: configuration.TARGET_SALESFORCE_ORG_ID,
            }),
          });
        }
      }

      return target.dispatch(input);
    },
  };
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
  target: createProductionDispatchTarget(process.env),
});
