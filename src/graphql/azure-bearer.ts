/**
 * Validação estrutural/heurística para tokens Bearer do Azure AD reaproveitados
 * pelo callback GraphQL. Esta checagem NÃO valida assinatura, audience, tenant
 * nem JWKS e, portanto, não equivale à verificação criptográfica completa.
 *
 * Se o cenário voltar a permitir uma Named Credential dedicada para o callback,
 * o modo SHARED_SECRET continua sendo a opção mais segura para isolamento entre
 * integrações, especialmente em orgs compartilhadas por mais pessoas.
 */
const bearerPattern = /^Bearer ([^ ]+)$/i;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

type AzureJwtPayload = {
  exp?: unknown;
  iss?: unknown;
};

function hasOnlyBase64UrlCharacters(segment: string): boolean {
  return segment.length > 0 && base64UrlPattern.test(segment);
}

function isAzureJwtPayload(value: unknown): value is AzureJwtPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStructurallyValidAzureBearerToken(
  authorizationHeaderValue: string | null,
): boolean {
  try {
    if (authorizationHeaderValue === null || authorizationHeaderValue === '') {
      return false;
    }

    const match = bearerPattern.exec(authorizationHeaderValue);
    if (match === null) {
      return false;
    }

    const token = match[1];
    if (token === undefined || token.length === 0) {
      return false;
    }

    const segments = token.split('.');
    if (
      segments.length !== 3 ||
      segments.some((segment) => !hasOnlyBase64UrlCharacters(segment))
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    ) as unknown;

    if (!isAzureJwtPayload(payload) || typeof payload.exp !== 'number') {
      return false;
    }

    if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) {
      return false;
    }

    if (typeof payload.iss !== 'string') {
      return false;
    }

    const issuer = payload.iss.toLowerCase();
    return (
      issuer.includes('microsoftonline.com') ||
      issuer.includes('sts.windows.net')
    );
  } catch {
    return false;
  }
}
