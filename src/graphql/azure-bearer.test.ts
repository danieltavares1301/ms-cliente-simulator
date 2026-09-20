import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isStructurallyValidAzureBearerToken } from './azure-bearer';

function encodeJwtSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function createAuthorizationHeader(
  payloadOverrides: Record<string, unknown> = {},
): string {
  const header = encodeJwtSegment({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeJwtSegment({
    exp: Math.floor(Date.now() / 1000) + 300,
    iss: 'https://login.microsoftonline.com/example-tenant/v2.0',
    ...payloadOverrides,
  });
  const signature = Buffer.from('signature', 'utf8').toString('base64url');

  return `Bearer ${header}.${payload}.${signature}`;
}

describe('isStructurallyValidAzureBearerToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T21:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a well-formed Azure AD JWT bearer token', () => {
    expect(
      isStructurallyValidAzureBearerToken(createAuthorizationHeader()),
    ).toBe(true);
    expect(
      isStructurallyValidAzureBearerToken(
        createAuthorizationHeader({
          iss: 'https://sts.windows.net/example-tenant/',
        }).replace('Bearer ', 'bEaReR '),
      ),
    ).toBe(true);
  });

  it.each([null, '', 'token', 'Bearer', 'Bearer  token', 'Basic abc'])(
    'rejects missing or malformed bearer headers: %s',
    (headerValue) => {
      expect(isStructurallyValidAzureBearerToken(headerValue)).toBe(false);
    },
  );

  it.each([
    'Bearer only-two.segments',
    'Bearer too.many.segments.here',
    'Bearer a..c',
    'Bearer aa+bb.cc.dd',
  ])('rejects malformed JWT segments: %s', (headerValue) => {
    expect(isStructurallyValidAzureBearerToken(headerValue)).toBe(false);
  });

  it('rejects payloads that are not valid JSON objects', () => {
    const header = encodeJwtSegment({ alg: 'RS256', typ: 'JWT' });
    const invalidJsonPayload = Buffer.from('{not-json', 'utf8').toString(
      'base64url',
    );
    const arrayPayload = encodeJwtSegment(['not', 'an', 'object']);
    const signature = Buffer.from('signature', 'utf8').toString('base64url');

    expect(
      isStructurallyValidAzureBearerToken(
        `Bearer ${header}.${invalidJsonPayload}.${signature}`,
      ),
    ).toBe(false);
    expect(
      isStructurallyValidAzureBearerToken(
        `Bearer ${header}.${arrayPayload}.${signature}`,
      ),
    ).toBe(false);
  });

  it('rejects missing, invalid, or expired exp claims', () => {
    expect(
      isStructurallyValidAzureBearerToken(
        createAuthorizationHeader({ exp: undefined }),
      ),
    ).toBe(false);
    expect(
      isStructurallyValidAzureBearerToken(
        createAuthorizationHeader({ exp: '9999999999' }),
      ),
    ).toBe(false);
    expect(
      isStructurallyValidAzureBearerToken(
        createAuthorizationHeader({
          exp: Math.floor(Date.now() / 1000) - 1,
        }),
      ),
    ).toBe(false);
  });

  it('rejects missing or unexpected issuer claims', () => {
    expect(
      isStructurallyValidAzureBearerToken(
        createAuthorizationHeader({ iss: undefined }),
      ),
    ).toBe(false);
    expect(
      isStructurallyValidAzureBearerToken(
        createAuthorizationHeader({ iss: 'https://example.com/issuer' }),
      ),
    ).toBe(false);
  });

  it('never throws for malformed or fuzzed inputs', () => {
    const longGarbage = `Bearer ${'あ'.repeat(2048)}`;
    const fuzzedValues = [
      'Bearer .',
      'Bearer ..',
      'Bearer not-a-jwt',
      'Bearer header.payload.signature.extra',
      longGarbage,
      '\u0000Bearer token',
    ];

    for (const headerValue of fuzzedValues) {
      expect(() =>
        isStructurallyValidAzureBearerToken(headerValue),
      ).not.toThrow();
      expect(isStructurallyValidAzureBearerToken(headerValue)).toBe(false);
    }
  });
});
