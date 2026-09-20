import { z } from 'zod';

import { salesforceFetch } from './network-policy';

export interface SalesforceAccess {
  accessToken: string;
  instanceUrl: string;
}

export interface SalesforceOAuthAccessProvider {
  getAccess(): Promise<SalesforceAccess>;
  invalidateToken(): void;
}

export type SalesforceAuthErrorCode = 'SALESFORCE_AUTH_REJECTED';

export class SalesforceAuthError extends Error {
  constructor(
    readonly code: SalesforceAuthErrorCode,
    readonly status: 400 | 401,
    readonly statusText: string,
  ) {
    super(code);
    this.name = 'SalesforceAuthError';
  }
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function normalizeSecureUrl(value: string): string | undefined {
  const url = parseUrl(value);

  if (
    url === undefined ||
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    return undefined;
  }

  return url.toString().replace(/\/+$/, '');
}

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    instance_url: z.string().min(1),
    token_type: z.string().min(1),
  })
  .passthrough();

type SalesforceOAuthClientInput = {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fetchFn?: typeof fetch;
  networkTimeoutMs?: number;
};

export class SalesforceOAuthClient implements SalesforceOAuthAccessProvider {
  private cachedAccess: SalesforceAccess | null = null;

  private inflightAccess: Promise<SalesforceAccess> | null = null;

  private readonly fetchFn: typeof fetch;

  constructor(private readonly input: SalesforceOAuthClientInput) {
    this.fetchFn = input.fetchFn ?? fetch;
  }

  /**
   * Salesforce client-credentials responses do not reliably include expires_in.
   * We therefore keep the token in-memory until the caller explicitly invalidates
   * it after a 401 challenge.
   */
  async getAccess(): Promise<SalesforceAccess> {
    if (this.cachedAccess !== null) {
      return this.cachedAccess;
    }
    if (this.inflightAccess !== null) {
      return this.inflightAccess;
    }

    const pending = this.fetchAccess();
    this.inflightAccess = pending;
    try {
      return await pending;
    } finally {
      if (this.inflightAccess === pending) {
        this.inflightAccess = null;
      }
    }
  }

  invalidateToken(): void {
    this.cachedAccess = null;
  }

  private async fetchAccess(): Promise<SalesforceAccess> {
    const response = await salesforceFetch(
      this.fetchFn,
      this.input.tokenUrl,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.input.clientId,
          client_secret: this.input.clientSecret,
        }),
      },
      this.input.networkTimeoutMs,
    );

    if (response.status === 400 || response.status === 401) {
      throw new SalesforceAuthError(
        'SALESFORCE_AUTH_REJECTED',
        response.status,
        response.statusText || 'Unauthorized',
      );
    }

    if (!response.ok) {
      throw new Error(
        `Salesforce token request failed with status ${response.status}`,
      );
    }

    const payload = tokenResponseSchema.parse(await response.json());
    const instanceUrl = normalizeSecureUrl(payload.instance_url);
    if (instanceUrl === undefined) {
      throw new Error('Salesforce token response is invalid');
    }

    const access = {
      accessToken: payload.access_token,
      instanceUrl,
    };
    this.cachedAccess = access;
    return access;
  }
}
