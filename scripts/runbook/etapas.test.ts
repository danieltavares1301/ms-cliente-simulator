import { describe, expect, it } from 'vitest';

import { etapaDa } from './etapas.ts';

describe('etapaDa', () => {
  it('lê a etapa da flag ou, sem ela, do nome do arquivo da campanha', () => {
    expect(etapaDa([], 'etapa', '../campanhas-runbook/etapa-2-2026-10-21.jsonl')).toBe(2);
    expect(etapaDa([], 'etapa', '../campanhas-runbook/etapa-2-fumaca-2026-10-21.jsonl')).toBe(2);
    expect(etapaDa(['--etapa', '3'], 'etapa', 'etapa-2-2026-10-21.jsonl')).toBe(3);
    expect(etapaDa([], 'etapa', 'campanha-alinhada-2026-10-12.jsonl')).toBeUndefined();
  });

  it('recusa etapa que não roda campanha', () => {
    expect(() => etapaDa(['--etapa', '1'], 'etapa', undefined)).toThrow(/etapas do plano: 2, 3, 4, 5, 6/);
  });
});
