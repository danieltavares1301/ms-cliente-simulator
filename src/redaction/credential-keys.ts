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
  'session',
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
  if (normalized.endsWith('hash') || normalized.endsWith('digest'))
    return false;
  return (
    CREDENTIAL_KEYS.has(normalized) ||
    CREDENTIAL_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}
