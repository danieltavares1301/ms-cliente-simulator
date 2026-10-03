import { describe, expect, it, vi } from 'vitest';

import type { ResultadoRun } from './engine.ts';
import {
  criarGravadorSerial,
  executarEmPool,
  precisaReexecucaoSequencial,
  processarFila,
} from './pool.ts';
import { NOME_ASSERCAO_JOBS } from './verificacoes.ts';

const espera = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

let sequencia = 0;
function resultadoDe(item: string, falhaDeRede?: string): ResultadoRun {
  sequencia += 1;
  return {
    tc: item,
    perfil: 'CA',
    run: `${item}-${sequencia}`,
    veredito: falhaDeRede === undefined ? 'CONFORME' : 'ERRO',
    assercoes: [],
    ...(falhaDeRede === undefined ? {} : { falhaDeRede, erro: `x: falha de rede (${falhaDeRede})` }),
  } as unknown as ResultadoRun;
}

describe('executarEmPool', () => {
  it('roda todos os itens sem passar do limite de simultâneos', async () => {
    let emAndamento = 0;
    let pico = 0;
    const feitos: number[] = [];
    await executarEmPool([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      emAndamento += 1;
      pico = Math.max(pico, emAndamento);
      await espera(5 + (item % 3) * 3);
      feitos.push(item);
      emAndamento -= 1;
    });
    expect(feitos.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pico).toBe(3);
  });

  it('com limite 1 roda em sequência, na ordem', async () => {
    const ordem: number[] = [];
    await executarEmPool([3, 1, 2], 1, async (item) => {
      await espera(item);
      ordem.push(item);
    });
    expect(ordem).toEqual([3, 1, 2]);
  });

  it('aceita lista vazia', async () => {
    await expect(executarEmPool([], 4, async () => undefined)).resolves.toEqual([]);
  });

  it('para de iniciar itens quando a liberação é negada e devolve os que ficaram', async () => {
    const iniciados: number[] = [];
    let liberacoes = 0;
    const restantes = await executarEmPool(
      [1, 2, 3, 4, 5, 6],
      2,
      async (item) => {
        iniciados.push(item);
        await espera(2);
      },
      { aguardarAntes: async () => (liberacoes += 1) <= 3 },
    );
    expect(iniciados).toEqual([1, 2, 3]);
    expect(restantes).toEqual([4, 5, 6]);
  });
});

describe('processarFila', () => {
  it('refaz o RUN que caiu por rede e entrega o resultado com a queda anterior', async () => {
    const quedas = new Set(['b']);
    const concluidos: ResultadoRun[] = [];
    const reagendados: string[] = [];
    const { naoIniciados } = await processarFila(['a', 'b', 'c'], {
      limite: 2,
      executar: async (item) => {
        if (quedas.delete(item)) return resultadoDe(item, 'SALESFORCE_NETWORK_ERROR');
        return resultadoDe(item);
      },
      liberado: async () => true,
      aoReagendar: (item) => reagendados.push(item),
      concluir: async (_item, resultado) => {
        concluidos.push(resultado);
      },
    });
    expect(naoIniciados).toEqual([]);
    expect(reagendados).toEqual(['b']);
    expect(concluidos.map(({ tc, veredito }) => [tc, veredito]).sort()).toEqual([
      ['a', 'CONFORME'],
      ['b', 'CONFORME'],
      ['c', 'CONFORME'],
    ]);
    const b = concluidos.find(({ tc }) => tc === 'b')!;
    expect(b.quedasDeRede).toEqual([{ run: expect.stringMatching(/^b-/), causa: 'SALESFORCE_NETWORK_ERROR' }]);
    expect(concluidos.find(({ tc }) => tc === 'a')!.quedasDeRede).toBeUndefined();
  });

  it('grava o ERRO depois de esgotar as tentativas', async () => {
    const concluidos: ResultadoRun[] = [];
    const executar = vi.fn(async (item: string) => resultadoDe(item, 'ECONNRESET'));
    await processarFila(['a'], {
      limite: 1,
      tentativas: 3,
      executar,
      liberado: async () => true,
      concluir: async (_item, resultado) => {
        concluidos.push(resultado);
      },
    });
    expect(executar).toHaveBeenCalledTimes(3);
    expect(concluidos).toHaveLength(1);
    expect(concluidos[0]!.veredito).toBe('ERRO');
    expect(concluidos[0]!.quedasDeRede).toHaveLength(2);
  });

  it('sem rede, entrega a última queda de quem caiu e devolve quem nunca rodou', async () => {
    let rodadaUm = true;
    const concluidos: ResultadoRun[] = [];
    const { naoIniciados } = await processarFila(['a', 'b', 'c', 'd'], {
      limite: 1,
      executar: async (item) => {
        // "b" cai; depois disso a rede não volta mais.
        if (item === 'b') {
          rodadaUm = false;
          return resultadoDe(item, 'ETIMEDOUT');
        }
        return resultadoDe(item);
      },
      liberado: async () => rodadaUm,
      concluir: async (_item, resultado) => {
        concluidos.push(resultado);
      },
    });
    expect(concluidos.map(({ tc, veredito }) => [tc, veredito])).toEqual([
      ['a', 'CONFORME'],
      ['b', 'ERRO'],
    ]);
    expect(concluidos[1]!.quedasDeRede).toBeUndefined();
    expect(naoIniciados).toEqual(['c', 'd']);
  });
});

describe('precisaReexecucaoSequencial', () => {
  const resultado = (assercoes: ResultadoRun['assercoes']) =>
    ({ assercoes }) as unknown as ResultadoRun;

  it('refaz só quando a asserção de jobs falhou', () => {
    expect(precisaReexecucaoSequencial(resultado([{ nome: NOME_ASSERCAO_JOBS, ok: false }]))).toBe(true);
    expect(precisaReexecucaoSequencial(resultado([{ nome: NOME_ASSERCAO_JOBS, ok: true }]))).toBe(false);
    expect(
      precisaReexecucaoSequencial(resultado([{ nome: 'Account X intacta', ok: false }])),
    ).toBe(false);
  });
});

describe('criarGravadorSerial', () => {
  it('grava uma linha de cada vez, na ordem pedida', async () => {
    const gravadas: string[] = [];
    let gravando = false;
    const gravador = criarGravadorSerial(async (linha) => {
      expect(gravando).toBe(false);
      gravando = true;
      await espera(linha === 'a' ? 10 : 1);
      gravadas.push(linha);
      gravando = false;
    });
    void gravador.gravar('a');
    void gravador.gravar('b');
    await gravador.gravar('c');
    await gravador.concluir();
    expect(gravadas).toEqual(['a', 'b', 'c']);
  });
});
