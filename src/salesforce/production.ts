import { parseServerEnvironment } from '../config/server-env';
import {
  FakeSalesforceDispatchTarget,
  type DispatchTarget,
} from '../runs/dispatch';
import { createSalesforceDispatchTarget } from './dispatch-target';
import { SalesforceOAuthClient } from './oauth-client';
import { createSalesforceRestClient } from './rest-client';
import { createSalesforceSafetyGuard } from './safety-guard';
import {
  createSalesforceTestDataAdapter,
  type SalesforceTestDataAdapter,
} from './test-data-adapter';

type ProductionOptions = {
  fetchFn?: typeof fetch;
};

type InitializedServices = {
  dispatchTarget: DispatchTarget;
  testDataAdapter: SalesforceTestDataAdapter;
};

function disabledAdapter(): SalesforceTestDataAdapter {
  const disabled = () =>
    Promise.reject(new Error('Salesforce test data is disabled'));
  return { setup: disabled, verify: disabled, cleanup: disabled };
}

export function createSalesforceProductionServices(
  environment: Record<string, string | undefined>,
  options: ProductionOptions = {},
): InitializedServices {
  let initialized: InitializedServices | null = null;

  function services(): InitializedServices {
    if (initialized !== null) return initialized;
    const configuration = parseServerEnvironment(environment);
    if (!configuration.SALESFORCE_DISPATCH_ENABLED) {
      initialized = {
        dispatchTarget: new FakeSalesforceDispatchTarget(),
        testDataAdapter: disabledAdapter(),
      };
      return initialized;
    }

    const oauthClient = new SalesforceOAuthClient({
      clientId: configuration.SALESFORCE_CLIENT_ID,
      clientSecret: configuration.SALESFORCE_CLIENT_SECRET,
      tokenUrl: configuration.SALESFORCE_TOKEN_URL,
      ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
    });
    const safetyGuard = createSalesforceSafetyGuard({
      oauthClient,
      targetSalesforceBaseUrl: configuration.TARGET_SALESFORCE_BASE_URL,
      targetSalesforceOrgId: configuration.TARGET_SALESFORCE_ORG_ID,
      ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
    });
    const restClient = createSalesforceRestClient({
      oauthClient,
      safetyGuard,
      ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
    });
    initialized = {
      dispatchTarget: createSalesforceDispatchTarget({
        oauthClient,
        safetyGuard,
        ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
      }),
      testDataAdapter: createSalesforceTestDataAdapter({ restClient }),
    };
    return initialized;
  }

  return {
    dispatchTarget: {
      dispatch: (input) => services().dispatchTarget.dispatch(input),
    },
    testDataAdapter: {
      setup: (input) => services().testDataAdapter.setup(input),
      verify: (input) => services().testDataAdapter.verify(input),
      cleanup: (input) => services().testDataAdapter.cleanup(input),
    },
  };
}

export const productionSalesforceServices = createSalesforceProductionServices(
  process.env,
);
