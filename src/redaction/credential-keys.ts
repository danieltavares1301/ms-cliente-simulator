const CREDENTIAL_KEY_SUFFIXES = [
  'password',
  'senha',
  'passphrase',
  'apikey',
  'authorizationheader',
  'subscriptionkey',
  'connectionstring',
  'signingkey',
  'privatekey',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'clientsecret',
  'webhooksecret',
  'setcookie',
  'cookie',
  'secret',
  'secretkey',
  'credential',
  'credentials',
  'accesskey',
  'token',
  'tokens',
] as const;

const CREDENTIAL_KEYS = new Set(['authorization', 'session']);

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

// Nomes de API Salesforce terminam em `__c`, `__pc`, `__s` etc. Sem remover
// esse sufixo, `XApiKey__c` normaliza para `xapikeyc` e escapa dos testes.
const SALESFORCE_API_NAME_SUFFIX = /__[a-z]+$/i;

// Termos compostos específicos o bastante para valer em qualquer posição do
// nome (ex.: `XApiKeySensia__c`, `ChavePrimariaCCA__c`). Os genéricos
// (`token`, `secret`, `senha`...) seguem valendo só como sufixo, para não
// classificar dado de negócio como credencial.
const CREDENTIAL_KEY_FRAGMENTS = [
  'apikey',
  'clientsecret',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'privatekey',
  'signingkey',
  'subscriptionkey',
  'connectionstring',
  'password',
  'passphrase',
  'chaveprimaria',
  'chavesecundaria',
] as const;

export function isCredentialKey(key: string): boolean {
  const normalized = normalizeKey(key.replace(SALESFORCE_API_NAME_SUFFIX, ''));
  if (SAFE_TECHNICAL_HASH_KEYS.has(normalized)) return false;
  const withoutOpaqueSuffix = normalized.replace(/(?:hash|digest)$/, '');
  return (
    CREDENTIAL_KEYS.has(normalized) ||
    CREDENTIAL_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment)) ||
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
