import { describe, expect, it } from 'vitest';

import { scanSensitiveData } from '../redaction/scanner';
import { generateNonRealCpfForContractFixture } from './cpf';

function hasValidCpfChecksum(candidate: string): boolean {
  if (!/^\d{11}$/.test(candidate) || /^(\d)\1{10}$/.test(candidate))
    return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(candidate[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return (
    digit(9) === Number(candidate[9]) && digit(10) === Number(candidate[10])
  );
}

describe('generateNonRealCpfForContractFixture', () => {
  it('generates deterministic varied 11-digit test documents with deliberately invalid CPF checksums', () => {
    const values = Array.from({ length: 64 }, (_, index) =>
      generateNonRealCpfForContractFixture(
        `contract-seed-${index}`,
        `run_contract_${index}`,
      ),
    );

    expect(new Set(values).size).toBeGreaterThan(56);
    for (const value of values) {
      expect(value).toMatch(/^\d{11}$/);
      expect(hasValidCpfChecksum(value)).toBe(false);
    }
    expect(generateNonRealCpfForContractFixture('same', 'run_same')).toBe(
      generateNonRealCpfForContractFixture('same', 'run_same'),
    );
  });

  it('is accepted under the contract key by the generic scanner without provenance', () => {
    const numerocpf = generateNonRealCpfForContractFixture(
      'scanner-seed',
      'run_scanner',
    );

    expect(scanSensitiveData({ data: { numerocpf } })).toEqual([]);
  });
});
