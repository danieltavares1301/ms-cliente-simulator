import { z } from 'zod';

import type {
  SalesforceAccess,
  SalesforceOAuthAccessProvider,
} from './oauth-client';
import { salesforceFetch } from './network-policy';

export type SafetyGuardViolationCode =
  | 'SALESFORCE_HOST_MISMATCH'
  | 'SALESFORCE_ORG_ID_MISMATCH'
  | 'SALESFORCE_SANDBOX_REQUIRED';

export class SafetyGuardViolationError extends Error {
  constructor(readonly code: SafetyGuardViolationCode) {
    super(code);
    this.name = 'SafetyGuardViolationError';
  }
}

export class SalesforceSafetyGuardRequestError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super('SALESFORCE_SAFETY_GUARD_REQUEST_FAILED');
    this.name = 'SalesforceSafetyGuardRequestError';
  }
}

export interface SalesforceSafetyGuard {
  validate(): Promise<SalesforceAccess>;
}

const organizationQuerySchema = z
  .object({
    records: z
      .array(
        z
          .object({
            Id: z.string().regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/),
            IsSandbox: z.boolean(),
          })
          .passthrough(),
      )
      .length(1),
  })
  .passthrough();

type SalesforceSafetyGuardInput = {
  oauthClient: SalesforceOAuthAccessProvider;
  targetSalesforceBaseUrl: string;
  targetSalesforceOrgId: string;
  fetchFn?: typeof fetch;
  networkTimeoutMs?: number;
};

export function createSalesforceSafetyGuard(
  input: SalesforceSafetyGuardInput,
): SalesforceSafetyGuard {
  const fetchFn = input.fetchFn ?? fetch;
  const targetHost = new URL(input.targetSalesforceBaseUrl).host;
  const targetOrgId15 = input.targetSalesforceOrgId.slice(0, 15);

  return {
    async validate(): Promise<SalesforceAccess> {
      const access = await input.oauthClient.getAccess();
      const instanceHost = new URL(access.instanceUrl).host;

      if (instanceHost !== targetHost) {
        throw new SafetyGuardViolationError('SALESFORCE_HOST_MISMATCH');
      }

      const queryUrl = new URL(
        '/services/data/v61.0/query',
        access.instanceUrl,
      );
      queryUrl.searchParams.set('q', 'SELECT Id,IsSandbox FROM Organization');
      const response = await salesforceFetch(
        fetchFn,
        queryUrl.toString(),
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${access.accessToken}`,
            accept: 'application/json',
          },
        },
        input.networkTimeoutMs,
      );

      if (!response.ok) {
        throw new SalesforceSafetyGuardRequestError(
          response.status,
          response.statusText || String(response.status),
        );
      }

      const payload = organizationQuerySchema.parse(await response.json());
      const [organization] = payload.records;

      if (organization.Id.slice(0, 15) !== targetOrgId15) {
        throw new SafetyGuardViolationError('SALESFORCE_ORG_ID_MISMATCH');
      }
      if (!organization.IsSandbox) {
        throw new SafetyGuardViolationError('SALESFORCE_SANDBOX_REQUIRED');
      }

      return access;
    },
  };
}
