import { readCliFlag } from '../stress-o10-concurrent-events-lib.ts';

/**
 * Etapas do plano da reescrita da 2.2 (`docs/plano-branch-reescrita-2.2.md`)
 * que rodam campanha. Cada campanha se grava em
 * `../campanhas-runbook/etapa-N-AAAA-MM-DD.jsonl`.
 */
export const ETAPAS: Readonly<Record<number, string>> = {
  2: 'ponto zero: a 1.3 mais a etapa 1',
  3: 'R1 e R2',
  4: 'R3',
  5: 'R4',
  6: 'R5',
};

/** Etapa que traz cada regra. Antes dela, o que a regra resolve falha por falta de código. */
export const ETAPA_DA_REGRA = { R1: 3, R3: 4, R4: 5, R5: 6 } as const;
export type Regra = keyof typeof ETAPA_DA_REGRA;

/**
 * Etapa da campanha pela flag ou, sem ela, pelo nome do arquivo
 * (`etapa-2-2026-10-21.jsonl`). Sem nenhum dos dois, a campanha é da 2.2.
 */
export function etapaDa(argv: readonly string[], flag: string, arquivo: string | undefined): number | undefined {
  const valor = readCliFlag(argv, flag) ?? /(?:^|\/)etapa-(\d+)-/.exec(arquivo ?? '')?.[1];
  if (valor === undefined) return undefined;
  const etapa = Number(valor);
  if (ETAPAS[etapa] === undefined) {
    throw new Error(`--${flag} precisa ser uma das etapas do plano: ${Object.keys(ETAPAS).join(', ')}.`);
  }
  return etapa;
}
