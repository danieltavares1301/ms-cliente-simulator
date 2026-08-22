import { renderedScenarioFixtureSchema } from '../contracts/fixtures.ts';
import { isNonRealCpfForContractFixture } from '../synthetic/cpf.ts';
import { isCredentialKey, normalizeKey } from './credential-keys.ts';

export type SensitiveCategory =
  | 'CPF'
  | 'EMAIL'
  | 'PHONE'
  | 'NAME'
  | 'ADDRESS'
  | 'CREDENTIAL'
  | 'URL_CREDENTIALS'
  | 'SALESFORCE_ID';

export interface SensitiveFinding {
  path: string;
  category: SensitiveCategory;
  message: 'Possivel dado sensivel detectado.';
}

export interface ScanOptions {
  allowedValues?: readonly string[];
  allowedEmailDomains?: readonly string[];
}

const GENERIC_MESSAGE = 'Possivel dado sensivel detectado.' as const;
const SYNTHETIC_MARKER_PATTERNS = [
  /^(?:CLI|PRO|EVT)-SIM-[a-f0-9]{6,32}(?:-[a-f0-9]{6,32})?$/i,
  /^(?:TEL|END|CEP)-SIM-[a-f0-9]{6,32}$/i,
];

function approvedTestEmail(
  value: string,
  domains: ReadonlySet<string>,
): boolean {
  const match = value.trim().match(/^[^\s@]+@([^\s@]+)$/);
  if (match === null) return false;
  const candidate = match[1].toLowerCase();
  return [...domains].some(
    (domain) => candidate === domain || candidate.endsWith(`.${domain}`),
  );
}

function isApprovedValue(
  value: unknown,
  allowed: ReadonlySet<string>,
  emailDomains: ReadonlySet<string>,
): boolean {
  if (typeof value !== 'string') return value === null;
  if (allowed.has(value) && !containsCpf(value)) return true;
  if (isNonRealCpfForContractFixture(value)) return true;
  if (approvedTestEmail(value, emailDomains)) return true;
  if (/^(?:run_|step_)[a-zA-Z0-9_-]+$/.test(value)) return true;
  if (/^Cliente Simulado(?: Base)? [a-f0-9]{6,32}$/.test(value)) return true;
  return SYNTHETIC_MARKER_PATTERNS.some((pattern) => pattern.test(value));
}

function categoryForSensitiveKey(key: string): SensitiveCategory | undefined {
  const normalized = normalizeKey(key);
  if (/(?:^|numero)cpf|cadastronacional/.test(normalized)) return 'CPF';
  if (normalized.includes('email')) return 'EMAIL';
  if (/(?:phone|telefone|celular|whatsapp)/.test(normalized)) return 'PHONE';
  if (normalized.includes('nome')) return 'NAME';
  if (/(?:endereco|address|logradouro|cep|bairro)/.test(normalized))
    return 'ADDRESS';
  if (isCredentialKey(key)) return 'CREDENTIAL';
  return undefined;
}

function cpfIsValid(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculate = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10])
  );
}

function containsCpf(value: string): boolean {
  const candidates =
    value.match(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g) ?? [];
  return candidates.some(cpfIsValid);
}

function containsExternalEmail(
  value: string,
  emailDomains: ReadonlySet<string>,
): boolean {
  const candidates =
    value.match(
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g,
    ) ?? [];
  return candidates.some(
    (candidate) => !approvedTestEmail(candidate, emailDomains),
  );
}

function containsCredential(value: string): boolean {
  return (
    /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i.test(value) ||
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)
  );
}

function containsCredentialUrl(value: string): boolean {
  return /\b[a-z][a-z\d+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/i.test(value);
}

function containsSalesforceId(value: string): boolean {
  const candidates =
    value.match(
      /(?<![A-Za-z0-9])[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?(?![A-Za-z0-9])/g,
    ) ?? [];
  return candidates.some(
    (candidate) => /[A-Za-z]/.test(candidate) && /\d/.test(candidate),
  );
}

function containsBrazilianPhone(value: string): boolean {
  const candidates =
    value.match(
      /(?<!\d)(?:\+?55[\s().-]*)?\(?[1-9]\d\)?[\s.-]*(?:9\d{4}|[2-5]\d{3})[\s.-]?\d{4}(?!\d)/g,
    ) ?? [];

  return candidates.some((candidate) => {
    const compact = candidate.replace(/[\s().-]/g, '');
    const withoutCountry = compact.startsWith('+55')
      ? compact.slice(3)
      : compact.startsWith('55')
        ? compact.slice(2)
        : compact;
    if (!/^\d{10,11}$/.test(withoutCountry)) return false;
    const ddd = Number(withoutCountry.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    const subscriber = withoutCountry.slice(2);
    return subscriber.length === 9
      ? subscriber.startsWith('9')
      : /^[2-5]/.test(subscriber);
  });
}

function valueCategories(
  value: string,
  emailDomains: ReadonlySet<string>,
): SensitiveCategory[] {
  const categories: SensitiveCategory[] = [];
  if (containsCpf(value)) categories.push('CPF');
  if (containsExternalEmail(value, emailDomains)) categories.push('EMAIL');
  if (containsCredential(value)) categories.push('CREDENTIAL');
  if (containsCredentialUrl(value)) categories.push('URL_CREDENTIALS');
  if (containsSalesforceId(value)) categories.push('SALESFORCE_ID');
  if (containsBrazilianPhone(value)) categories.push('PHONE');
  return categories;
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function scanSensitiveDataInternal(
  input: unknown,
  options: ScanOptions,
): SensitiveFinding[] {
  const allowed = new Set(options.allowedValues ?? []);
  const emailDomains = new Set([
    'example.test',
    ...(options.allowedEmailDomains ?? []).map((domain) =>
      domain.toLowerCase(),
    ),
  ]);
  const findings: SensitiveFinding[] = [];
  const seen = new Set<string>();

  const add = (path: string, category: SensitiveCategory) => {
    const identity = `${path}\u0000${category}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    findings.push({ path, category, message: GENERIC_MESSAGE });
  };

  const visit = (value: unknown, path: string, key?: string) => {
    const detectedCategories =
      typeof value === 'string' ? valueCategories(value, emailDomains) : [];
    const approved =
      detectedCategories.length === 0 &&
      isApprovedValue(value, allowed, emailDomains);
    const credentialKey = key !== undefined && isCredentialKey(key);
    if (credentialKey) add(path, 'CREDENTIAL');
    if (key !== undefined && !credentialKey && !approved) {
      const keyCategory = categoryForSensitiveKey(key);
      const isAddressContainer =
        keyCategory === 'ADDRESS' &&
        value !== null &&
        typeof value === 'object';
      if (keyCategory && !isAddressContainer) add(path, keyCategory);
    }

    if (typeof value === 'string') {
      for (const category of detectedCategories) add(path, category);
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

export function scanSensitiveData(
  input: unknown,
  options: ScanOptions = {},
): SensitiveFinding[] {
  return scanSensitiveDataInternal(input, options);
}

export function scanRenderedFixtureSensitiveData(
  input: unknown,
): SensitiveFinding[] {
  const fixture = renderedScenarioFixtureSchema.parse(input);
  return scanSensitiveData(fixture);
}

export function assertNoSensitiveData(
  input: unknown,
  options: ScanOptions = {},
): void {
  const findings = scanSensitiveData(input, options);
  if (findings.length === 0) return;
  const summary = findings
    .map(({ category, path }) => `${category} em ${path}`)
    .join('; ');
  throw new Error(`Dados sensiveis detectados: ${summary}`);
}
