import { appendFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CENARIOS, type Cenario } from './cenarios.ts';
import {
  Execucao,
  FalhaDeEvento,
  mensagem,
  PERFIS,
  resumirEstado,
  TODOS_PERFIS,
  type Perfil,
  type ResultadoRun,
} from './engine.ts';
import {
  criarGravadorSerial,
  PARALELO_MAXIMO,
  precisaReexecucaoSequencial,
  processarFila,
  TENTATIVAS_POR_QUEDA,
} from './pool.ts';
import {
  causaDeRede,
  criarPortaoDeRede,
  ehFalhaDeRede,
  LIMITE_QUEDA_MS,
  sondarRede,
  type OpcoesDeRede,
} from './rede.ts';
import { NOME_ASSERCAO_JOBS, Verificador } from './verificacoes.ts';
import {
  connectToTargetOrg,
  logStructured,
  parseCliArguments,
  readCliFlag,
  type TargetOrgConnection,
} from '../stress-o10-concurrent-events-lib.ts';

/**
 * Executa o recorte 2.2 dos TCs do runbook na `mrv-devDan`.
 *
 *   npm run runbook -- --tcs TC-005,TC-006 [--perfis PA,CA,ME]
 *   npm run runbook -- --todos [--saida resultados.jsonl]
 *   npm run runbook -- --tcs TC-001,TC-005 --perfis C1,C2,C3,C4
 *   npm run runbook -- --todos --paralelo 6
 *
 * Por padrão os RUNs rodam em sequência, como pede o runbook (§4.1.1).
 * `--paralelo N` (até 10) roda N ao mesmo tempo: é um desvio consciente do
 * runbook, e um RUN que acusa job com erro é refeito em sequência antes de
 * virar divergência. Cada resultado vai para um JSONL, que
 * `npm run runbook:relatorio` consolida. Sem `--perfis`, rodam só PA, CA e
 * ME; C1 a C4 (bug 4 do TC-001) são opcionais.
 *
 * Queda de rede: leituras e exclusões tentam de novo; a primeira falha fecha
 * o portão, e nenhum RUN novo começa até a org responder. Um RUN que caiu é
 * refeito (até 3 tentativas). Se a rede não voltar em 10 min, o runner para,
 * e a retomada com o mesmo `--saida` roda o que faltou e os pares com ERRO.
 */

type Opcoes = { timeoutRequisicaoMs: number; timeoutJobsMs: number };

function selecionarCenarios(argv: readonly string[]): readonly Cenario[] {
  if (argv.includes('--todos')) return CENARIOS;
  const pedido = readCliFlag(argv, 'tcs');
  if (pedido === undefined) {
    throw new Error('Informe --tcs TC-001,TC-002 ou --todos.');
  }
  const ids = pedido.split(',').map((valor) => {
    const numero = valor.trim().toUpperCase().replace(/\D/g, '');
    return `TC-${numero.padStart(3, '0')}`;
  });
  const desconhecidos = ids.filter((id) => !CENARIOS.some((c) => c.id === id));
  if (desconhecidos.length > 0) {
    throw new Error(
      `TCs não executáveis ou inexistentes: ${desconhecidos.join(', ')} (bloqueados ficam de fora).`,
    );
  }
  return CENARIOS.filter(({ id }) => ids.includes(id));
}

function selecionarPerfis(argv: readonly string[]): readonly Perfil[] {
  const pedido = readCliFlag(argv, 'perfis');
  if (pedido === undefined) return PERFIS;
  const perfis = pedido.split(',').map((valor) => valor.trim().toUpperCase());
  const invalidos = perfis.filter((perfil) => !TODOS_PERFIS.includes(perfil as Perfil));
  if (invalidos.length > 0) {
    throw new Error(`Perfis inválidos: ${invalidos.join(', ')}; use ${TODOS_PERFIS.join(', ')}.`);
  }
  return perfis as Perfil[];
}

function inteiroPositivo(valor: string | undefined, padrao: number, nome: string): number {
  if (valor === undefined) return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`--${nome} precisa ser inteiro positivo (recebido: ${valor}).`);
  }
  return numero;
}

async function executarRun(
  conexao: TargetOrgConnection,
  cenario: Cenario,
  perfil: Perfil,
  opcoes: Opcoes,
  rede: OpcoesDeRede,
): Promise<ResultadoRun> {
  const execucao = new Execucao(conexao, cenario.id, perfil, opcoes.timeoutRequisicaoMs, rede);
  const resultado: ResultadoRun = {
    tc: cenario.id,
    titulo: cenario.titulo,
    perfil,
    run: execucao.run,
    inicio: new Date().toISOString(),
    fim: '',
    veredito: 'ERRO',
    assercoes: [],
    eventos: execucao.eventos,
    prospectY: null,
    jobsComErro: [],
    logsComErro: [],
    erro: null,
    cleanup: null,
  };
  const inicio = Date.now();
  const marcas = { massa: inicio, cadeia: inicio, verificacao: inicio, cleanup: inicio };
  try {
    await execucao.preparar();
    await execucao.precheck();
    await cenario.massa(execucao);
    marcas.massa = Date.now();
    const aprovacao = cenario.aprovacao(execucao);
    const { intermediario, final, prospectY, evidencia } = await execucao.executarCadeia(
      aprovacao,
      opcoes.timeoutJobsMs,
    );
    marcas.cadeia = Date.now();
    resultado.prospectY = prospectY;
    resultado.estadoFinal = resumirEstado(final);
    const erros = await execucao.errosCorrelacionados(final);
    resultado.jobsComErro = erros.jobs;
    resultado.logsComErro = erros.logs;
    const verificador = new Verificador(
      execucao,
      aprovacao,
      final,
      intermediario,
      prospectY,
    );
    resultado.assercoes = [
      ...cenario.esperado(verificador, execucao),
      ...verificador.comuns({
        xAlteravel: cenario.xAlteravel ?? false,
        jobs: erros.jobs,
        logs: erros.logs,
      }),
      ...verificador.evidenciasDoPerfil(perfil, evidencia, cenario.xAlteravel ?? false),
    ];
    resultado.veredito = resultado.assercoes.every(({ ok }) => ok)
      ? 'CONFORME'
      : 'DIVERGENTE';
    marcas.verificacao = Date.now();
  } catch (error) {
    resultado.erro = mensagem(error);
    if (ehFalhaDeRede(error)) {
      // Sem veredito: o runner refaz o RUN depois que a rede voltar.
      resultado.falhaDeRede = causaDeRede(error);
    } else if (error instanceof FalhaDeEvento) {
      // Runbook §5: HTTP 4xx/5xx de um evento é falha do TC, não de infra.
      resultado.veredito = 'DIVERGENTE';
      resultado.assercoes.push({
        nome: 'Todos os eventos responderam HTTP 200',
        ok: false,
        detalhe: resultado.erro,
      });
    }
  } finally {
    marcas.cleanup = Date.now();
    // A espera de jobs do próprio cleanup (cadeia interrompida) conta no cleanup.
    const esperaJobsMs = execucao.tempos.esperaJobsMs;
    resultado.cleanup = await execucao.limpar(opcoes.timeoutJobsMs);
    const fim = Date.now();
    resultado.fim = new Date(fim).toISOString();
    // Fases interrompidas por erro ficam com zero; o total continua certo.
    const duracao = (de: number, ate: number) => Math.max(0, ate - de);
    resultado.tempos = {
      massaMs: duracao(inicio, marcas.massa),
      cadeiaMs: duracao(marcas.massa, marcas.cadeia),
      esperaJobsMs,
      verificacaoMs: duracao(marcas.cadeia, marcas.verificacao),
      cleanupMs: fim - marcas.cleanup,
      totalMs: fim - inicio,
    };
  }
  return resultado;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cenarios = selecionarCenarios(argv);
  const perfis = selecionarPerfis(argv);
  const saida =
    readCliFlag(argv, 'saida') ??
    join(tmpdir(), `runbook-resultados-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
  const cli = parseCliArguments(argv);
  const opcoes: Opcoes = {
    timeoutRequisicaoMs: cli.requestTimeoutMs,
    timeoutJobsMs: inteiroPositivo(readCliFlag(argv, 'timeout-jobs-ms'), 90_000, 'timeout-jobs-ms'),
  };
  const paralelo = inteiroPositivo(readCliFlag(argv, 'paralelo'), 1, 'paralelo');
  if (paralelo > PARALELO_MAXIMO) {
    throw new Error(`--paralelo aceita até ${PARALELO_MAXIMO} RUNs simultâneos (recebido: ${paralelo}).`);
  }

  // Retomada: um par cujo último resultado no JSONL tem veredito não roda de
  // novo; um que terminou em ERRO (rede, precheck...) roda.
  const ultimos = new Map<string, ResultadoRun['veredito']>();
  try {
    for (const linha of (await readFile(saida, 'utf8')).split('\n')) {
      if (linha.trim() === '') continue;
      const anterior = JSON.parse(linha) as Pick<ResultadoRun, 'tc' | 'perfil' | 'veredito'>;
      ultimos.set(`${anterior.tc}:${anterior.perfil}`, anterior.veredito);
    }
  } catch {
    // Arquivo novo.
  }
  const concluidos = new Set(
    [...ultimos].filter(([, veredito]) => veredito !== 'ERRO').map(([par]) => par),
  );

  const conexao = await connectToTargetOrg(cli);
  logStructured('runbook-config', {
    instanceUrl: conexao.access.instanceUrl,
    tcs: cenarios.map(({ id }) => id),
    perfis,
    saida,
    jaConcluidos: concluidos.size,
    refeitosPorErro: ultimos.size - concluidos.size,
    paralelo,
  });

  // Portão de rede: na primeira falha, nenhum RUN novo começa até a org responder.
  const portao = criarPortaoDeRede({
    sondar: () => sondarRede(conexao.access.instanceUrl),
    aoMudar: ({ tipo, ...dados }) => logStructured(`runbook-rede-${tipo}`, dados),
  });
  const rede: OpcoesDeRede = { aoFalhar: (causa) => portao.acusarQueda(causa) };
  const executar = async ({ cenario, perfil }: { cenario: Cenario; perfil: Perfil }) => {
    const resultado = await executarRun(conexao, cenario, perfil, opcoes, rede);
    if (resultado.falhaDeRede !== undefined) portao.acusarQueda(resultado.falhaDeRede);
    return resultado;
  };
  const reagendarPorQueda = (_item: unknown, resultado: ResultadoRun) =>
    logStructured('runbook-reexecucao-agendada', {
      tc: resultado.tc,
      perfil: resultado.perfil,
      run: resultado.run,
      motivo: `falha de rede (${resultado.falhaDeRede})`,
    });

  const pendentes = cenarios.flatMap((cenario) =>
    perfis
      .filter((perfil) => !concluidos.has(`${cenario.id}:${perfil}`))
      .map((perfil) => ({ cenario, perfil })),
  );
  const gravador = criarGravadorSerial((linha) => appendFile(saida, linha, 'utf8'));
  const resultados: ResultadoRun[] = [];
  const registrar = async (resultado: ResultadoRun, modo: string) => {
    resultados.push(resultado);
    await gravador.gravar(`${JSON.stringify(resultado)}\n`);
    logStructured('runbook-run', {
      tc: resultado.tc,
      perfil: resultado.perfil,
      run: resultado.run,
      modo,
      veredito: resultado.veredito,
      falhas: resultado.assercoes
        .filter(({ ok }) => !ok)
        .map(({ nome }) => nome),
      erro: resultado.erro,
      falhaDeRede: resultado.falhaDeRede,
      quedasDeRede: resultado.quedasDeRede?.length ?? 0,
      residuo: resultado.cleanup?.restantes,
      errosCleanup: resultado.cleanup?.erros.length ?? null,
      tempos: resultado.tempos,
    });
  };

  // No pool, um RUN que acusa job com erro pode estar vendo o job de outro RUN
  // simultâneo: ele só é gravado depois de refeito em sequência.
  const paraRefazer: Array<{ cenario: Cenario; perfil: Perfil; tentativa: ResultadoRun }> = [];
  const principal = await processarFila(pendentes, {
    limite: paralelo,
    executar,
    liberado: () => portao.liberado(),
    aoReagendar: reagendarPorQueda,
    concluir: async ({ cenario, perfil }, resultado) => {
      if (paralelo > 1 && precisaReexecucaoSequencial(resultado)) {
        paraRefazer.push({ cenario, perfil, tentativa: resultado });
        logStructured('runbook-reexecucao-agendada', {
          tc: resultado.tc,
          perfil: resultado.perfil,
          run: resultado.run,
          motivo: NOME_ASSERCAO_JOBS,
        });
        return;
      }
      await registrar(resultado, paralelo > 1 ? 'paralelo' : 'sequencial');
    },
  });
  // Se a rede não voltou, as reexecuções em sequência também ficam para a retomada.
  const emSequencia =
    principal.naoIniciados.length > 0
      ? { naoIniciados: paraRefazer }
      : await processarFila(paraRefazer, {
          limite: 1,
          executar,
          liberado: () => portao.liberado(),
          aoReagendar: reagendarPorQueda,
          concluir: async ({ tentativa }, resultado) => {
            resultado.tentativaParalela = {
              run: tentativa.run,
              falhas: tentativa.assercoes.filter(({ ok }) => !ok).map(({ nome }) => nome),
            };
            await registrar(resultado, 'reexecucao-sequencial');
          },
        });
  await gravador.concluir();

  const semResultado = [...principal.naoIniciados, ...emSequencia.naoIniciados].map(
    ({ cenario, perfil }) => `${cenario.id}:${perfil}`,
  );
  if (semResultado.length > 0) {
    logStructured('runbook-interrompido', {
      motivo: `rede fora do ar por mais de ${LIMITE_QUEDA_MS / 60_000} min`,
      semResultado,
      retomada: 'rode de novo com o mesmo --saida',
    });
  }
  const contagem = (veredito: ResultadoRun['veredito']) =>
    resultados.filter((resultado) => resultado.veredito === veredito).length;
  logStructured('runbook-resumo', {
    runs: resultados.length,
    conformes: contagem('CONFORME'),
    divergentes: contagem('DIVERGENTE'),
    erros: contagem('ERRO'),
    reexecutadosEmSequencia: resultados.filter(({ tentativaParalela }) => tentativaParalela).length,
    refeitosPorQueda: resultados.filter(({ quedasDeRede }) => quedasDeRede).length,
    residuoNaoVerificado: resultados.filter(({ cleanup }) => cleanup?.restantes === null).length,
    semResultado: semResultado.length,
    tentativasPorQueda: TENTATIVAS_POR_QUEDA,
    paralelo,
    saida,
  });
  if (
    semResultado.length > 0 ||
    resultados.some(
      (resultado) =>
        resultado.veredito === 'ERRO' ||
        resultado.cleanup?.restantes !== 0 ||
        (resultado.cleanup?.erros.length ?? 0) > 0,
    )
  ) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logStructured('runbook-fatal-error', { message: mensagem(error) });
  process.exitCode = 1;
});
