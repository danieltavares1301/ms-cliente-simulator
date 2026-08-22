import { createHash, timingSafeEqual } from 'node:crypto';

const bearerPattern = /^Bearer ([^\s,]+)$/;

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function hasValidAdminAuthorization(
  headers: Headers,
  expectedToken: string,
): boolean {
  const authorization = headers.get('authorization');
  const match =
    authorization === null ? null : bearerPattern.exec(authorization);
  const candidate = match?.[1] ?? '';
  const equal = timingSafeEqual(digest(candidate), digest(expectedToken));
  return match !== null && expectedToken.length > 0 && equal;
}
