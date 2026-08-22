import { createHash } from 'node:crypto';

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function checkDigit(digits: string, factor: number): number {
  let total = 0;
  for (const digit of digits) total += Number(digit) * factor--;
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function generateSyntheticCpf(seed: string, runId: string): string {
  const source = digest(`synthetic-cpf-v1|${seed}|${runId}`);
  let base = [...source.slice(0, 9)]
    .map((character) => Number.parseInt(character, 16) % 10)
    .join('');
  if (/^(\d)\1{8}$/.test(base))
    base = `${base.slice(0, 8)}${(Number(base[8]) + 1) % 10}`;
  const first = checkDigit(base, 10);
  return `${base}${first}${checkDigit(`${base}${first}`, 11)}`;
}
