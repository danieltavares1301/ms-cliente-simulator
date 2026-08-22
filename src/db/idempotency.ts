import { createHash, createHmac } from 'node:crypto';

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

export function createIdempotencyKeyHash(
  idempotencyKey: string,
  pepper: string,
): string {
  return createHmac('sha256', pepper).update(idempotencyKey).digest('hex');
}

export function createRequestFingerprint(body: unknown): string {
  return createHash('sha256').update(canonicalize(body)).digest('hex');
}
