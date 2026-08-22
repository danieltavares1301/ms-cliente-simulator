import { createHash } from 'node:crypto';

export const SYNTHETIC_CPF_GENERATOR = 'DETERMINISTIC_CPF_V1' as const;

export interface SyntheticCpf {
  value: string;
  origin: {
    generator: typeof SYNTHETIC_CPF_GENERATOR;
    proof: string;
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function checkDigit(digits: string, factor: number): number {
  let total = 0;
  for (const digit of digits) total += Number(digit) * factor--;
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

function proofFor(seed: string, runId: string, value: string): string {
  return digest(`fixture-cpf-v1|${seed}|${runId}|${value}`).slice(0, 32);
}

export function generateSyntheticCpf(
  seed: string,
  runId: string,
): SyntheticCpf {
  const source = digest(`fixture-cpf-digits-v1|${seed}|${runId}`);
  let base = [...source.slice(0, 9)]
    .map((character) => Number.parseInt(character, 16) % 10)
    .join('');
  if (/^(\d)\1{8}$/.test(base)) base = `${base.slice(0, 8)}7`;
  const first = checkDigit(base, 10);
  const value = `${base}${first}${checkDigit(`${base}${first}`, 11)}`;

  return {
    value,
    origin: {
      generator: SYNTHETIC_CPF_GENERATOR,
      proof: proofFor(seed, runId, value),
    },
  };
}

export function verifySyntheticCpf(
  seed: string,
  runId: string,
  value: string,
  proof: string,
): boolean {
  const generated = generateSyntheticCpf(seed, runId);
  return generated.value === value && generated.origin.proof === proof;
}
