import { describe, expect, it } from 'vitest';

import {
  createIdempotencyKeyHash,
  createRequestFingerprint,
} from './idempotency';

describe('run idempotency hashing', () => {
  it('uses HMAC-SHA256 without leaking the key or pepper', () => {
    const key = 'customer-visible-idempotency-key';
    const pepper = 'server-only-pepper-with-enough-entropy';
    const hash = createIdempotencyKeyHash(key, pepper);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(key);
    expect(hash).not.toContain(pepper);
  });

  it('canonicalizes object properties for request fingerprints', () => {
    expect(
      createRequestFingerprint({
        scenarioKey: 'match-id-cliente',
        options: { dryRun: false, seed: 42 },
      }),
    ).toBe(
      createRequestFingerprint({
        options: { seed: 42, dryRun: false },
        scenarioKey: 'match-id-cliente',
      }),
    );
  });

  it('preserves array order in request fingerprints', () => {
    expect(createRequestFingerprint({ steps: ['setup', 'dispatch'] })).not.toBe(
      createRequestFingerprint({ steps: ['dispatch', 'setup'] }),
    );
  });

  it('returns only an opaque hash and does not leak body values', () => {
    const sensitiveMarker = 'body-value-must-not-leak';
    const fingerprint = createRequestFingerprint({ marker: sensitiveMarker });

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain(sensitiveMarker);
  });
});
