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
  fakeDispatchTarget: DispatchTarget;
  salesforceDispatchTarget: DispatchTarget;
  testDataAdapter: SalesforceTestDataAdapter;
};

export function createSalesforceProductionServices(
  environment: Record<string, string | undefined>,
  options: ProductionOptions = {},
): InitializedServices {
  const fakeDispatchTarget = new FakeSalesforceDispatchTarget();
  let initializedReal: Pick<
    InitializedServices,
    'salesforceDispatchTarget' | 'testDataAdapter'
  > | null = null;

  function realServices() {
    if (initializedReal !== null) return initializedReal;
    const configuration = parseServerEnvironment(environment);
    if (!configuration.SALESFORCE_DISPATCH_ENABLED) {
      throw new Error('Salesforce dispatch is disabled');
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
    initializedReal = {
      salesforceDispatchTarget: createSalesforceDispatchTarget({
        oauthClient,
        safetyGuard,
        ...(options.fetchFn === undefined ? {} : { fetchFn: options.fetchFn }),
      }),
      testDataAdapter: createSalesforceTestDataAdapter({ restClient }),
    };
    return initializedReal;
  }

  function testDataAdapter(): SalesforceTestDataAdapter {
    if (environment.SALESFORCE_TEST_DATA_ENABLED !== 'true') {
      throw new Error('Salesforce test data is disabled');
    }
    return realServices().testDataAdapter;
  }

  return {
    fakeDispatchTarget,
    dispatchTarget: {
      dispatch: (input) =>
        environment.SALESFORCE_DISPATCH_ENABLED === 'true'
          ? realServices().salesforceDispatchTarget.dispatch(input)
          : fakeDispatchTarget.dispatch(input),
    },
    salesforceDispatchTarget: {
      dispatch: (input) =>
        realServices().salesforceDispatchTarget.dispatch(input),
    },
    testDataAdapter: {
      setup: (input) => testDataAdapter().setup(input),
      verify: (input) => testDataAdapter().verify(input),
      cleanup: (input, ownedRecordIds) =>
        testDataAdapter().cleanup(input, ownedRecordIds),
    },
  };
}

export const productionSalesforceServices = createSalesforceProductionServices(
  process.env,
);
