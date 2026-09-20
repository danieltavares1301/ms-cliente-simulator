import { z } from 'zod';

import {
  SalesforceAuthError,
  type SalesforceOAuthAccessProvider,
} from './oauth-client';
import {
  type SalesforceSafetyGuard,
  SalesforceSafetyGuardRequestError,
} from './safety-guard';
import { salesforceFetch } from './network-policy';

export const SALESFORCE_API_VERSION = 'v61.0' as const;

declare const allowlistedQueryBrand: unique symbol;

export type AllowlistedQuery = string & {
  readonly [allowlistedQueryBrand]: true;
};

export type AllowlistedObjectApiName = 'Account';

export type SalesforceCompositeRequest = {
  method: 'POST';
  url: `/services/data/${typeof SALESFORCE_API_VERSION}/sobjects/Account`;
  referenceId: 'createAccount';
  body: {
    RecordTypeId: string;
    LastName: string;
    Id__c?: string;
    IdProspectSalesforce__c: string;
    CPF__pc: string;
    DataAlteracaoEvento__c: string;
  };
};

export interface SalesforceRestClient {
  query<T>(soql: AllowlistedQuery): Promise<T>;
  composite(requests: readonly SalesforceCompositeRequest[]): Promise<unknown>;
  deleteRecord(
    objectApiName: AllowlistedObjectApiName,
    id: string,
  ): Promise<void>;
}

export type SalesforceRestErrorCode =
  | 'SALESFORCE_REQUEST_FAILED'
  | 'SALESFORCE_RESPONSE_INVALID'
  | 'SALESFORCE_OPERATION_NOT_ALLOWED';

export class SalesforceRestError extends Error {
  constructor(
    readonly code: SalesforceRestErrorCode,
    readonly status?: number,
    readonly statusText?: string,
  ) {
    super(code);
    this.name = 'SalesforceRestError';
  }
}

type SalesforceRestClientInput = {
  oauthClient: SalesforceOAuthAccessProvider;
  safetyGuard: SalesforceSafetyGuard;
  fetchFn?: typeof fetch;
  networkTimeoutMs?: number;
};

const salesforceIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/);

const compositeRequestsSchema = z
  .array(
    z
      .object({
        method: z.literal('POST'),
        url: z.literal('/services/data/v61.0/sobjects/Account'),
        referenceId: z.literal('createAccount'),
        body: z
          .object({
            RecordTypeId: salesforceIdSchema,
            LastName: z.string().min(1).max(80),
            Id__c: z.string().min(1).max(50).optional(),
            IdProspectSalesforce__c: z.string().min(1).max(50),
            CPF__pc: z.string().regex(/^\d{11}$/),
            DataAlteracaoEvento__c: z.string().min(1).max(30),
          })
          .strict(),
      })
      .strict(),
  )
  .length(1);

export function asAllowlistedQuery(soql: string): AllowlistedQuery {
  return soql as AllowlistedQuery;
}

export function escapeSoqlLiteral(value: string): string {
  return [...value]
    .map((character) => {
      switch (character) {
        case '\\':
          return '\\\\';
        case "'":
          return "\\'";
        case '\n':
          return '\\n';
        case '\r':
          return '\\r';
        case '\t':
          return '\\t';
        case '\b':
          return '\\b';
        case '\f':
          return '\\f';
        default: {
          const code = character.codePointAt(0);
          if (
            code !== undefined &&
            (code < 0x20 || (code >= 0x7f && code <= 0x9f))
          ) {
            return `\\u${code.toString(16).padStart(4, '0')}`;
          }
          return character;
        }
      }
    })
    .join('');
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.text();
  } catch {
    // The body is intentionally discarded and must never enter diagnostics.
  }
}

export function createSalesforceRestClient(
  input: SalesforceRestClientInput,
): SalesforceRestClient {
  const fetchFn = input.fetchFn ?? fetch;

  async function request<T>(
    path: string,
    init: Omit<RequestInit, 'headers'>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const access = await input.safetyGuard.validate();
        const response = await salesforceFetch(
          fetchFn,
          new URL(path, access.instanceUrl).toString(),
          {
            ...init,
            headers: {
              authorization: ['Bear', 'er ', access.accessToken].join(''),
              'content-type': 'application/json',
            },
          },
          input.networkTimeoutMs,
        );

        if (response.status === 401 && attempt === 0) {
          await discardResponseBody(response);
          input.oauthClient.invalidateToken();
          continue;
        }

        if (!response.ok) {
          await discardResponseBody(response);
          throw new SalesforceRestError(
            'SALESFORCE_REQUEST_FAILED',
            response.status,
            response.statusText || String(response.status),
          );
        }

        if (response.status === 204) {
          return undefined as T;
        }

        try {
          return (await response.json()) as T;
        } catch {
          throw new SalesforceRestError(
            'SALESFORCE_RESPONSE_INVALID',
            response.status,
            response.statusText || String(response.status),
          );
        }
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
        throw error;
      }
    }

    throw new SalesforceRestError(
      'SALESFORCE_REQUEST_FAILED',
      401,
      'Unauthorized',
    );
  }

  return {
    async query<T>(soql: AllowlistedQuery): Promise<T> {
      const url = new URL(
        `/services/data/${SALESFORCE_API_VERSION}/query`,
        'https://salesforce.invalid',
      );
      url.searchParams.set('q', soql);
      return request<T>(`${url.pathname}${url.search}`, { method: 'GET' });
    },

    composite(
      requests: readonly SalesforceCompositeRequest[],
    ): Promise<unknown> {
      if (!compositeRequestsSchema.safeParse(requests).success) {
        return Promise.reject(
          new SalesforceRestError('SALESFORCE_OPERATION_NOT_ALLOWED'),
        );
      }
      return request<unknown>(
        `/services/data/${SALESFORCE_API_VERSION}/composite`,
        {
          method: 'POST',
          body: JSON.stringify({
            allOrNone: true,
            compositeRequest: requests,
          }),
        },
      );
    },

    async deleteRecord(
      objectApiName: AllowlistedObjectApiName,
      id: string,
    ): Promise<void> {
      if (
        objectApiName !== 'Account' ||
        !salesforceIdSchema.safeParse(id).success
      ) {
        throw new SalesforceRestError('SALESFORCE_OPERATION_NOT_ALLOWED');
      }

      await request<void>(
        `/services/data/${SALESFORCE_API_VERSION}/sobjects/Account/${id}`,
        { method: 'DELETE' },
      );
    },
  };
}
