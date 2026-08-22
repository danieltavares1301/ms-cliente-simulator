import { isCredentialKey } from './credential-keys.ts';
import { assertNoSecrets } from './scanner.ts';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const CREDENTIAL_URL_PATTERN = /\b([a-z][a-z\d+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi;

function ensurePlainJson(value: unknown): asserts value is JsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value))
    return;
  if (Array.isArray(value)) {
    value.forEach(ensurePlainJson);
    return;
  }
  if (
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error('A sanitizacao aceita somente JSON controlado.');
  }
  Object.values(value).forEach(ensurePlainJson);
}

function sanitizeString(value: string): string {
  return value
    .replace(CREDENTIAL_URL_PATTERN, '$1[REDACTED]@')
    .replace(BEARER_PATTERN, '[REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED]');
}

function sanitizeValue(
  value: JsonValue,
  sourceKey?: string,
): JsonValue | undefined {
  if (sourceKey !== undefined && isCredentialKey(sourceKey)) return undefined;
  if (Array.isArray(value))
    return value.map((item) => sanitizeValue(item) as JsonValue);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeValue(childValue, childKey);
      if (sanitized !== undefined) result[childKey] = sanitized;
    }
    return result;
  }
  return typeof value === 'string' ? sanitizeString(value) : value;
}

export function sanitizeSecrets(input: unknown): JsonValue {
  ensurePlainJson(input);
  const sanitized = sanitizeValue(input);
  if (sanitized === undefined)
    throw new Error('O JSON controlado nao pode ser removido integralmente.');
  assertNoSecrets(sanitized);
  return sanitized;
}
