import { createHash } from 'node:crypto';

import { isCredentialKey, normalizeKey } from './credential-keys.ts';
import { assertNoSensitiveData } from './scanner.ts';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AnonymizeOptions {
  seed: string;
}

const FREE_TEXT_KEYS = new Set([
  'message',
  'mensagem',
  'description',
  'descricao',
  'stack',
  'stacktrace',
  'freetext',
  'observacao',
  'observacoes',
  'bodytext',
]);

function token(seed: string, category: string, value: string): string {
  return createHash('sha256')
    .update(`${seed}\u0000${category}\u0000${value}`)
    .digest('hex')
    .slice(0, 12);
}

function ensurePlainJson(value: unknown): asserts value is JsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value))
    return;
  if (Array.isArray(value)) {
    value.forEach(ensurePlainJson);
    return;
  }
  if (
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error('A anonimizacao aceita somente JSON controlado.');
  }
  Object.values(value).forEach(ensurePlainJson);
}

function isCpfKey(key: string): boolean {
  return /(?:cpf|cadastronacional)/.test(key);
}

function isTechnicalIdKey(sourceKey: string, normalizedKey: string): boolean {
  const asciiKey = sourceKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    asciiKey === 'id' ||
    /^(?:id[A-Z]|id_)/.test(asciiKey) ||
    /(?:Id|ID|_id)$/.test(asciiKey) ||
    /^(?:idcliente|idprospect|idproponente|idsalesforce)$/.test(normalizedKey)
  );
}

function idPrefix(key: string): string {
  if (key.includes('event')) return 'EVT-SIM-';
  if (key.includes('proponente') || key.includes('prospect')) return 'PRO-SIM-';
  return 'CLI-SIM-';
}

function anonymizeValue(
  value: JsonValue,
  seed: string,
  path: string,
  sourceKey?: string,
): JsonValue | undefined {
  const key = normalizeKey(sourceKey ?? '');
  if (sourceKey !== undefined && (isCredentialKey(sourceKey) || isCpfKey(key)))
    return undefined;
  if (sourceKey !== undefined && FREE_TEXT_KEYS.has(key)) {
    throw new Error(
      `Campo ${path}: remova o campo de texto livre antes da anonimizacao.`,
    );
  }

  if (Array.isArray(value)) {
    return value.map(
      (item, index) =>
        anonymizeValue(item, seed, `${path}[${index}]`) as JsonValue,
    );
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const transformed = anonymizeValue(
        childValue,
        seed,
        `${path}.${childKey}`,
        childKey,
      );
      if (transformed !== undefined) result[childKey] = transformed;
    }
    return result;
  }
  if (typeof value !== 'string') return value;
  if (/\bError\s*:|\n\s*at\s+|\bat\s+[^\s]+\s*\([^\n]+:\d+:\d+\)/.test(value)) {
    throw new Error(
      `Campo ${path}: remova o campo de texto livre antes da anonimizacao.`,
    );
  }

  const stable = (category: string) => token(seed, category, value);
  if (key.includes('email')) return `cliente+${stable('email')}@example.test`;
  if (/(?:telefone|celular|phone|whatsapp)/.test(key))
    return `TEL-SIM-${stable('phone')}`;
  if (/(?:nome|name)/.test(key)) return `Cliente Simulado ${stable('name')}`;
  if (/(?:logradouro|endereco|address|bairro)/.test(key))
    return `END-SIM-${stable('address')}`;
  if (key.includes('cep')) return `CEP-SIM-${stable('postal-code')}`;
  if (key === 'runid') return `run_${stable('run-id')}`;
  if (key === 'stepid') return `step_${stable('step-id')}`;
  if (sourceKey !== undefined && isTechnicalIdKey(sourceKey, key))
    return `${idPrefix(key)}${stable('technical-id')}`;
  return value;
}

export function anonymizeJson(
  input: unknown,
  options: AnonymizeOptions,
): JsonValue {
  if (options.seed.trim() === '')
    throw new Error('Uma seed nao vazia e obrigatoria.');
  ensurePlainJson(input);
  const transformed = anonymizeValue(input, options.seed, '$');
  if (transformed === undefined)
    throw new Error('O JSON controlado nao pode ser removido integralmente.');
  assertNoSensitiveData(transformed);
  return transformed;
}
