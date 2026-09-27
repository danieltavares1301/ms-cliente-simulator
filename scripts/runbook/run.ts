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
  type Perfil,
  type ResultadoRun,
} from './engine.ts';
import { Verificador } from './verificacoes.ts';
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
 *
 * Os RUNs rodam em sequência, nunca ao mesmo tempo (runbook §4.1.1). Cada
 * resultado vai para um JSONL, que `npm run runbook:relatorio` consolida.
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
  const invalidos = perfis.filter((perfil) => !PERFIS.includes(perfil as Perfil));
  if (invalidos.length > 0) {
    throw new Error(`Perfis inválidos: ${invalidos.join(', ')}; use PA, CA, ME.`);
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
): Promise<ResultadoRun> {
  const execucao = new Execucao(conexao, cenario.id, perfil, opcoes.timeoutRequisicaoMs);
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
  try {
    await execucao.preparar();
    await execucao.precheck();
    await cenario.massa(execucao);
    const aprovacao = cenario.aprovacao(execucao);
    const { intermediario, final, prospectY } = await execucao.executarCadeia(
      aprovacao,
      opcoes.timeoutJobsMs,
    );
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
    ];
    resultado.veredito = resultado.assercoes.every(({ ok }) => ok)
      ? 'CONFORME'
      : 'DIVERGENTE';
  } catch (error) {
    resultado.erro = mensagem(error);
    if (error instanceof FalhaDeEvento) {
      // Runbook §5: HTTP 4xx/5xx de um evento é falha do TC, não de infra.
      resultado.veredito = 'DIVERGENTE';
      resultado.assercoes.push({
        nome: 'Todos os eventos responderam HTTP 200',
        ok: false,
        detalhe: resultado.erro,
      });
    }
  } finally {
    resultado.cleanup = await execucao.limpar();
    resultado.fim = new Date().toISOString();
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

  // Retomada: pares TC×perfil já gravados no JSONL de saída não rodam de novo.
  const concluidos = new Set<string>();
  try {
    for (const linha of (await readFile(saida, 'utf8')).split('\n')) {
      if (linha.trim() === '') continue;
      const anterior = JSON.parse(linha) as Pick<ResultadoRun, 'tc' | 'perfil'>;
      concluidos.add(`${anterior.tc}:${anterior.perfil}`);
    }
  } catch {
    // Arquivo novo.
  }

  const conexao = await connectToTargetOrg(cli);
  logStructured('runbook-config', {
    instanceUrl: conexao.access.instanceUrl,
    tcs: cenarios.map(({ id }) => id),
    perfis,
    saida,
    jaConcluidos: concluidos.size,
  });

  const resultados: ResultadoRun[] = [];
  for (const cenario of cenarios) {
    for (const perfil of perfis) {
      if (concluidos.has(`${cenario.id}:${perfil}`)) continue;
      const resultado = await executarRun(conexao, cenario, perfil, opcoes);
      resultados.push(resultado);
      await appendFile(saida, `${JSON.stringify(resultado)}\n`, 'utf8');
      logStructured('runbook-run', {
        tc: resultado.tc,
        perfil: resultado.perfil,
        run: resultado.run,
        veredito: resultado.veredito,
        falhas: resultado.assercoes
          .filter(({ ok }) => !ok)
          .map(({ nome }) => nome),
        erro: resultado.erro,
        residuo: resultado.cleanup?.restantes,
        errosCleanup: resultado.cleanup?.erros.length ?? null,
      });
    }
  }

  const contagem = (veredito: ResultadoRun['veredito']) =>
    resultados.filter((resultado) => resultado.veredito === veredito).length;
  logStructured('runbook-resumo', {
    runs: resultados.length,
    conformes: contagem('CONFORME'),
    divergentes: contagem('DIVERGENTE'),
    erros: contagem('ERRO'),
    saida,
  });
  if (
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
