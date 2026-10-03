import { SalesforceNetworkError } from '../../src/salesforce/network-policy.ts';
import { sleep } from '../stress-o10-concurrent-events-lib.ts';

/**
 * Falhas de rede no runbook. Uma requisição sem resposta HTTP é falha de
 * infraestrutura, nunca veredito: leituras e exclusões tentam de novo, e uma
 * queda fecha o portão do pool até a org voltar a responder.
 */

/** Esperas entre tentativas de uma leitura ou exclusão (~1 min no total). */
export const ESPERAS_REDE: readonly number[] = [2_000, 5_000, 10_000, 20_000, 30_000];
/** Sem rede por mais que isto, o runner para de iniciar RUNs. */
export const LIMITE_QUEDA_MS = 10 * 60_000;

/** Requisição sem resposta HTTP. A causa vem do `fetch` quando ele a informa. */
export class FalhaDeRede extends Error {
  constructor(
    readonly operacao: string,
    readonly causa: string,
  ) {
    super(`${operacao}: falha de rede (${causa})`);
    this.name = 'FalhaDeRede';
  }
}

export function ehFalhaDeRede(error: unknown): boolean {
  if (error instanceof FalhaDeRede || error instanceof SalesforceNetworkError) return true;
  // fetch direto: o undici rejeita com TypeError('fetch failed'), e o
  // AbortSignal.timeout, com TimeoutError.
  if (error instanceof TypeError && error.message === 'fetch failed') return true;
  return error instanceof Error && error.name === 'TimeoutError';
}

/**
 * Descrição curta da falha. O rest client do projeto descarta a causa e só
 * informa o código; no `fetch` direto aparece o código do sistema (ex.:
 * `ECONNRESET`, `SELF_SIGNED_CERT_IN_CHAIN`).
 */
export function causaDeRede(error: unknown): string {
  if (error instanceof FalhaDeRede) return error.causa;
  if (error instanceof SalesforceNetworkError) return error.code;
  if (!(error instanceof Error)) return 'desconhecida';
  const causa: unknown = error.cause;
  if (typeof causa === 'object' && causa !== null) {
    const { code, message } = causa as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && code !== '') return code;
    if (typeof message === 'string' && message !== '') return message.slice(0, 120);
  }
  if (error.name === 'TimeoutError') return 'TIMEOUT';
  return error.message.slice(0, 120);
}

export type OpcoesDeRede = {
  /** Esperas entre as tentativas; `[]` desliga a repetição. */
  esperas?: readonly number[];
  /** Chamado a cada falha de rede, antes de tentar de novo. */
  aoFalhar?: (causa: string) => void;
};

/**
 * Repete `operacao` enquanto ela falhar por rede. Só serve para operações que
 * podem rodar de novo sem efeito duplicado (leituras e exclusões); outros
 * erros sobem na hora.
 */
export async function comRetentativas<T>(
  operacao: () => Promise<T>,
  opcoes: OpcoesDeRede & { dormir?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const esperas = opcoes.esperas ?? ESPERAS_REDE;
  const dormir = opcoes.dormir ?? sleep;
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      return await operacao();
    } catch (error) {
      if (!ehFalhaDeRede(error)) throw error;
      opcoes.aoFalhar?.(causaDeRede(error));
      const espera = esperas[tentativa];
      if (espera === undefined) throw error;
      await dormir(espera);
    }
  }
}

export type EventoDeRede =
  | { tipo: 'queda'; causa: string }
  | { tipo: 'sondagem'; tentativa: number; causa: string }
  | { tipo: 'volta'; foraDoArMs: number; sondagens: number }
  | { tipo: 'desistencia'; foraDoArMs: number; sondagens: number };

/**
 * Portão do pool: a primeira falha de rede o fecha, e uma sondagem com espera
 * crescente o reabre quando a org volta a responder. Fechado, nenhum RUN novo
 * começa; os que estão no meio seguem com as próprias retentativas.
 */
export function criarPortaoDeRede(opcoes: {
  sondar: () => Promise<void>;
  esperas?: readonly number[];
  limiteMs?: number;
  aoMudar?: (evento: EventoDeRede) => void;
  agora?: () => number;
  dormir?: (ms: number) => Promise<void>;
}) {
  const esperas = opcoes.esperas ?? ESPERAS_REDE;
  const limiteMs = opcoes.limiteMs ?? LIMITE_QUEDA_MS;
  const agora = opcoes.agora ?? Date.now;
  const dormir = opcoes.dormir ?? sleep;
  // null: aberto. Fechado, guarda a sondagem em curso.
  let reabertura: Promise<boolean> | null = null;
  let desistiu = false;

  async function sondarAteVoltar(): Promise<boolean> {
    const inicio = agora();
    for (let tentativa = 1; ; tentativa += 1) {
      await dormir(esperas[Math.min(tentativa - 1, esperas.length - 1)] ?? 0);
      try {
        await opcoes.sondar();
        opcoes.aoMudar?.({ tipo: 'volta', foraDoArMs: agora() - inicio, sondagens: tentativa });
        return true;
      } catch (error) {
        opcoes.aoMudar?.({ tipo: 'sondagem', tentativa, causa: causaDeRede(error) });
        if (agora() - inicio >= limiteMs) {
          opcoes.aoMudar?.({ tipo: 'desistencia', foraDoArMs: agora() - inicio, sondagens: tentativa });
          return false;
        }
      }
    }
  }

  return {
    /** Fecha o portão (se estiver aberto) e começa a sondar a org. */
    acusarQueda(causa: string): void {
      if (reabertura !== null || desistiu) return;
      opcoes.aoMudar?.({ tipo: 'queda', causa });
      reabertura = sondarAteVoltar().then((voltou) => {
        if (voltou) reabertura = null;
        else desistiu = true;
        return voltou;
      });
    },
    /** `true` com a rede no ar (espera a sondagem, se for o caso); `false` se ela não voltou a tempo. */
    async liberado(): Promise<boolean> {
      if (desistiu) return false;
      return reabertura ?? true;
    },
  };
}

export type PortaoDeRede = ReturnType<typeof criarPortaoDeRede>;

/**
 * Sondagem leve da org: qualquer resposta HTTP de `/services/data/` (público,
 * sem token) mostra que a rede voltou. Usa `fetch` direto para registrar a
 * causa da falha.
 */
export async function sondarRede(instanceUrl: string, timeoutMs = 10_000): Promise<void> {
  try {
    const resposta = await fetch(new URL('/services/data/', instanceUrl), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await resposta.arrayBuffer();
  } catch (error) {
    throw new FalhaDeRede('sondagem', causaDeRede(error));
  }
}
