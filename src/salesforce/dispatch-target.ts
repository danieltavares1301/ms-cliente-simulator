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
import { SalesforceNetworkError, salesforceFetch } from './network-policy';

type SalesforceDispatchTargetInput = {
  oauthClient: SalesforceOAuthAccessProvider;
  safetyGuard: SalesforceSafetyGuard;
  fetchFn?: typeof fetch;
  now?: () => Date;
  networkTimeoutMs?: number;
};

type DispatchTargetPayload = DispatchRequest & {
  target: string;
  envelope: EventGridEnvelope;
};

function apexRestPath(
  target: string,
): '/services/apexrest/Cliente' | '/services/apexrest/PAC' | '/services/apexrest/MaquinaEstado' {
  switch (target) {
    case 'CLIENTE':
      return '/services/apexrest/Cliente';
    case 'PAC':
      return '/services/apexrest/PAC';
    case 'MAQUINA_ESTADO':
      return '/services/apexrest/MaquinaEstado';
    default:
      throw new Error(`Unsupported Salesforce dispatch target: ${target}`);
  }
}

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
          const response = await salesforceFetch(
            fetchFn,
            new URL(apexRestPath(request.target), access.instanceUrl).toString(),
            {
              method: 'POST',
              headers: {
                authorization: `Bearer ${access.accessToken}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify(request.envelope),
            },
            input.networkTimeoutMs,
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
          if (error instanceof SalesforceNetworkError) {
            return redactResponse(
              error.code === 'SALESFORCE_REQUEST_TIMEOUT' ? 504 : 503,
              startedAt,
              now,
              error.code,
            );
          }
          throw error;
        }
      }

      return redactResponse(401, startedAt, now, 'Unauthorized');
    },
  };
}
