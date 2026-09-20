export const SALESFORCE_NETWORK_TIMEOUT_MS = 30_000;

export type SalesforceNetworkErrorCode =
  'SALESFORCE_REQUEST_TIMEOUT' | 'SALESFORCE_NETWORK_ERROR';

export class SalesforceNetworkError extends Error {
  constructor(readonly code: SalesforceNetworkErrorCode) {
    super(code);
    this.name = 'SalesforceNetworkError';
  }
}

export async function salesforceFetch(
  fetchFn: typeof fetch,
  input: string | URL,
  init: RequestInit,
  timeoutMs = SALESFORCE_NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal =
    init.signal === undefined || init.signal === null
      ? timeoutSignal
      : AbortSignal.any([init.signal, timeoutSignal]);

  try {
    return await fetchFn(input, {
      ...init,
      redirect: 'error',
      signal,
    });
  } catch {
    throw new SalesforceNetworkError(
      timeoutSignal.aborted
        ? 'SALESFORCE_REQUEST_TIMEOUT'
        : 'SALESFORCE_NETWORK_ERROR',
    );
  }
}
