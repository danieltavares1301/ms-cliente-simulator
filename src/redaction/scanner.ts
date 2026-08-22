import { renderedScenarioFixtureSchema } from '../contracts/fixtures.ts';
import { isCredentialKey } from './credential-keys.ts';

export type SecretCategory = 'CREDENTIAL' | 'URL_CREDENTIALS';

export interface SecretFinding {
  path: string;
  category: SecretCategory;
  message: 'Possivel credencial tecnica detectada.';
}

const GENERIC_MESSAGE = 'Possivel credencial tecnica detectada.' as const;

function containsCredential(value: string): boolean {
  return (
    /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i.test(value) ||
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)
  );
}

function containsCredentialUrl(value: string): boolean {
  return /\b[a-z][a-z\d+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/i.test(value);
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

export function scanSecrets(input: unknown): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();

  const add = (path: string, category: SecretCategory) => {
    const identity = `${path}\u0000${category}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    findings.push({ path, category, message: GENERIC_MESSAGE });
  };

  const visit = (value: unknown, path: string, key?: string) => {
    if (key !== undefined && isCredentialKey(key)) add(path, 'CREDENTIAL');

    if (typeof value === 'string') {
      if (containsCredential(value)) add(path, 'CREDENTIAL');
      if (containsCredentialUrl(value)) add(path, 'URL_CREDENTIALS');
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value))
        visit(child, childPath(path, childKey), childKey);
    }
  };

  visit(input, '$');
  return findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.category.localeCompare(right.category),
  );
}

export function scanRenderedFixtureSecrets(input: unknown): SecretFinding[] {
  return scanSecrets(renderedScenarioFixtureSchema.parse(input));
}

export function assertNoSecrets(input: unknown): void {
  const findings = scanSecrets(input);
  if (findings.length === 0) return;
  const summary = findings
    .map(({ category, path }) => `${category} em ${path}`)
    .join('; ');
  throw new Error(`Segredos tecnicos detectados: ${summary}`);
}
