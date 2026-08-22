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

function cpfChecksumIsValid(candidate: string): boolean {
  if (!/^\d{11}$/.test(candidate) || /^(\d)\1{10}$/.test(candidate))
    return false;
  const first = checkDigit(candidate.slice(0, 9), 10);
  return (
    first === Number(candidate[9]) &&
    checkDigit(`${candidate.slice(0, 9)}${first}`, 11) === Number(candidate[10])
  );
}

export function isNonRealCpfForContractFixture(value: string): boolean {
  return /^000\d{8}$/.test(value) && !cpfChecksumIsValid(value);
}

export function generateNonRealCpfForContractFixture(
  seed: string,
  runId: string,
): string {
  const source = digest(`contract-document-v2|${seed}|${runId}`);
  const namespaceDigits = [...source.slice(0, 6)]
    .map((character) => Number.parseInt(character, 16) % 10)
    .join('');
  const base = `000${namespaceDigits}`;
  const first = checkDigit(base, 10);
  const deliberatelyWrongSecond = (checkDigit(`${base}${first}`, 11) + 1) % 10;
  return `${base}${first}${deliberatelyWrongSecond}`;
}
