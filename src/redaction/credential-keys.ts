const CREDENTIAL_KEY_SUFFIXES = [
  'password',
  'senha',
  'passphrase',
  'apikey',
  'secret',
  'secretkey',
  'clientsecret',
  'credential',
  'credentials',
  'privatekey',
  'accesskey',
  'token',
  'tokens',
] as const;

const CREDENTIAL_KEYS = new Set([
  'authorization',
  'authorizationheader',
  'connectionstring',
  'cookie',
  'session',
  'setcookie',
  'signingkey',
  'subscriptionkey',
]);

const SAFE_TECHNICAL_HASH_KEYS = new Set([
  'idempotencykeyhash',
  'idclientehash',
  'idprospecthash',
  'normalizedcorrelationkeyhash',
]);

export function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export function isCredentialKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SAFE_TECHNICAL_HASH_KEYS.has(normalized)) return false;
  const withoutOpaqueSuffix = normalized.replace(/(?:hash|digest)$/, '');
  return (
    CREDENTIAL_KEYS.has(normalized) ||
    CREDENTIAL_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix)) ||
    CREDENTIAL_KEYS.has(withoutOpaqueSuffix) ||
    CREDENTIAL_KEY_SUFFIXES.some((suffix) =>
      withoutOpaqueSuffix.endsWith(suffix),
    )
  );
}

export function isSafeTechnicalHashKey(key: string): boolean {
  return SAFE_TECHNICAL_HASH_KEYS.has(normalizeKey(key));
}
