import type { ResultadoRun } from './engine.ts';
import { NOME_ASSERCAO_JOBS } from './verificacoes.ts';

/**
 * Pool de RUNs simultâneos do runbook. O runbook (§4.1.1) manda rodar em
 * sequência, então o padrão do runner continua 1; o pool é opcional.
 */

export const PARALELO_MAXIMO = 10;
/** Tentativas de um par TC×perfil que cai por falha de rede (a primeira + 2). */
export const TENTATIVAS_POR_QUEDA = 3;

/**
 * Executa `tarefa` para cada item com no máximo `limite` em andamento ao mesmo
 * tempo. Com `aguardarAntes`, cada item novo espera a liberação; se ela for
 * negada, o pool para de iniciar itens e devolve os que ficaram de fora.
 */
export async function executarEmPool<T>(
  itens: readonly T[],
  limite: number,
  tarefa: (item: T) => Promise<void>,
  opcoes: { aguardarAntes?: () => Promise<boolean> } = {},
): Promise<T[]> {
  let proximo = 0;
  let parado = false;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (!parado && proximo < itens.length) {
      if (opcoes.aguardarAntes !== undefined && !(await opcoes.aguardarAntes())) {
        parado = true;
        return;
      }
      // Outro trabalhador pode ter pegado o último item durante a espera.
      if (parado || proximo >= itens.length) return;
      const item = itens[proximo]!;
      proximo += 1;
      await tarefa(item);
    }
  });
  await Promise.all(trabalhadores);
  return itens.slice(proximo);
}

/**
 * Roda a fila no pool e refaz, em rodadas, os RUNs que caíram por falha de
 * rede (até `tentativas` por item). O resultado entregue a `concluir` traz as
 * quedas anteriores em `quedasDeRede`. Se a rede não voltar, o pool para:
 * quem já tinha caído é entregue com a última queda (um ERRO), e os itens
 * nunca iniciados voltam em `naoIniciados`, para a retomada.
 */
export async function processarFila<T>(
  itens: readonly T[],
  opcoes: {
    limite: number;
    tentativas?: number;
    executar: (item: T) => Promise<ResultadoRun>;
    liberado: () => Promise<boolean>;
    concluir: (item: T, resultado: ResultadoRun) => Promise<void>;
    aoReagendar?: (item: T, resultado: ResultadoRun) => void;
  },
): Promise<{ naoIniciados: T[] }> {
  const tentativas = opcoes.tentativas ?? TENTATIVAS_POR_QUEDA;
  type Tarefa = { item: T; quedas: ResultadoRun[] };
  const entregar = async ({ item, quedas }: Tarefa, resultado: ResultadoRun) => {
    if (quedas.length > 0) {
      resultado.quedasDeRede = quedas.map(({ run, falhaDeRede }) => ({
        run,
        causa: falhaDeRede ?? 'desconhecida',
      }));
    }
    await opcoes.concluir(item, resultado);
  };

  let fila: Tarefa[] = itens.map((item) => ({ item, quedas: [] }));
  while (fila.length > 0) {
    const caidas: Tarefa[] = [];
    const naoIniciadas = await executarEmPool(
      fila,
      opcoes.limite,
      async (tarefa) => {
        const resultado = await opcoes.executar(tarefa.item);
        if (resultado.falhaDeRede !== undefined && tarefa.quedas.length + 1 < tentativas) {
          caidas.push({ item: tarefa.item, quedas: [...tarefa.quedas, resultado] });
          opcoes.aoReagendar?.(tarefa.item, resultado);
          return;
        }
        await entregar(tarefa, resultado);
      },
      { aguardarAntes: opcoes.liberado },
    );
    if (naoIniciadas.length > 0) {
      // A rede não voltou a tempo.
      for (const tarefa of [...caidas, ...naoIniciadas]) {
        const ultima = tarefa.quedas.at(-1);
        if (ultima !== undefined) await entregar({ ...tarefa, quedas: tarefa.quedas.slice(0, -1) }, ultima);
      }
      return {
        naoIniciados: naoIniciadas.filter(({ quedas }) => quedas.length === 0).map(({ item }) => item),
      };
    }
    fila = caidas;
  }
  return { naoIniciados: [] };
}

/**
 * No pool, a correlação de jobs olha a janela da org e pode acusar o job com
 * erro de outro RUN simultâneo. Esse RUN é refeito em sequência antes de
 * virar divergência.
 */
export function precisaReexecucaoSequencial(resultado: ResultadoRun): boolean {
  return resultado.assercoes.some(({ nome, ok }) => nome === NOME_ASSERCAO_JOBS && !ok);
}

/** Grava as linhas do JSONL uma de cada vez, na ordem em que os RUNs terminam. */
export function criarGravadorSerial(gravar: (linha: string) => Promise<void>) {
  let fila: Promise<void> = Promise.resolve();
  return {
    gravar(linha: string): Promise<void> {
      fila = fila.then(() => gravar(linha));
      return fila;
    },
    concluir(): Promise<void> {
      return fila;
    },
  };
}
