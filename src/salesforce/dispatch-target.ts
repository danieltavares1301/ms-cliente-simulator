import type { EventGridEnvelope } from '../contracts';
import type { DispatchRequest, DispatchTarget } from '../runs/dispatch';
import {
  SalesforceAuthError,
  type SalesforceOAuthAccessProvider,
} from './oauth-client';
import {
  type SalesforceSafetyGuard,
  SalesforceSafetyGuardRequestError,
  SafetyGuardViolationError,
} from './safety-guard';

type SalesforceDispatchTargetInput = {
  oauthClient: SalesforceOAuthAccessProvider;
  safetyGuard: SalesforceSafetyGuard;
  fetchFn?: typeof fetch;
  now?: () => Date;
};

type DispatchTargetPayload = DispatchRequest & {
  envelope: EventGridEnvelope;
};

function durationMs(startedAt: Date, now: () => Date): number {
  return Math.max(0, now().getTime() - startedAt.getTime());
}

function redactResponse(
  httpStatus: number,
  startedAt: Date,
  now: () => Date,
  statusText: string,
) {
  return {
    httpStatus,
    durationMs: durationMs(startedAt, now),
    responseRedacted: {
      transport: 'SALESFORCE_REST',
      statusText,
    },
  };
}

export function createSalesforceDispatchTarget(
  input: SalesforceDispatchTargetInput,
): DispatchTarget {
  const fetchFn = input.fetchFn ?? fetch;
  const now = input.now ?? (() => new Date());

  return {
    async dispatch(request: DispatchTargetPayload) {
      const startedAt = now();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const access = await input.safetyGuard.validate();
          const response = await fetchFn(
            new URL(
              '/services/apexrest/Cliente',
              access.instanceUrl,
            ).toString(),
            {
              method: 'POST',
              headers: {
                authorization: `Bearer ${access.accessToken}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify(request.envelope),
            },
          );

          if (response.status === 401 && attempt === 0) {
            input.oauthClient.invalidateToken();
            continue;
          }

          return redactResponse(
            response.status,
            startedAt,
            now,
            response.statusText || String(response.status),
          );
        } catch (error) {
          if (
            attempt === 0 &&
            ((error instanceof SalesforceAuthError && error.status === 401) ||
              (error instanceof SalesforceSafetyGuardRequestError &&
                error.status === 401))
          ) {
            input.oauthClient.invalidateToken();
            continue;
          }

          if (error instanceof SafetyGuardViolationError) {
            return redactResponse(412, startedAt, now, error.code);
          }
          if (error instanceof SalesforceAuthError) {
            return redactResponse(
              error.status,
              startedAt,
              now,
              error.statusText,
            );
          }
          if (error instanceof SalesforceSafetyGuardRequestError) {
            return redactResponse(
              error.status,
              startedAt,
              now,
              error.statusText,
            );
          }
          throw error;
        }
      }

      return redactResponse(401, startedAt, now, 'Unauthorized');
    },
  };
}
