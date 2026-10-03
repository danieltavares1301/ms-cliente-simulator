import { readFile, writeFile } from 'node:fs/promises';

import { CENARIOS } from './cenarios.ts';
import { NOMES_PERFIS, PERFIS, PERFIS_IDENTIDADE, TODOS_PERFIS, type ResultadoRun } from './engine.ts';
import { readCliFlag } from '../stress-o10-concurrent-events-lib.ts';

/**
 * Consolida os JSONL do `npm run runbook` num relatório Markdown.
 *
 *   npm run runbook:relatorio -- --entrada resultados.jsonl --saida docs/x.md
 *
 * Um par TC×perfil repetido no JSONL vale pela última execução.
 */

const SIMBOLO: Record<ResultadoRun['veredito'], string> = {
  CONFORME: '✅ conforme',
  DIVERGENTE: '❌ diverge',
  ERRO: '⚠️ erro',
};

function resumo(detalhe: unknown): string {
  if (detalhe === undefined) return '';
  const texto = typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe);
  return texto.length > 220 ? `${texto.slice(0, 220)}…` : texto;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const entrada = readCliFlag(argv, 'entrada');
  const saida = readCliFlag(argv, 'saida');
  if (entrada === undefined || saida === undefined) {
    throw new Error('Use --entrada <resultados.jsonl> --saida <relatorio.md>.');
  }
  const porPar = new Map<string, ResultadoRun>();
  for (const linha of (await readFile(entrada, 'utf8')).split('\n')) {
    if (linha.trim() === '') continue;
    const resultado = JSON.parse(linha) as ResultadoRun;
    porPar.set(`${resultado.tc}:${resultado.perfil}`, resultado);
  }
  const resultados = [...porPar.values()];
  const presentes = TODOS_PERFIS.filter((perfil) => resultados.some((resultado) => resultado.perfil === perfil));
  const perfis = presentes.length > 0 ? presentes : PERFIS;
  const contar = (veredito: ResultadoRun['veredito']) =>
    resultados.filter((resultado) => resultado.veredito === veredito).length;
  const inicio = resultados.map(({ inicio }) => inicio).sort()[0] ?? '';
  const fim = resultados.map(({ fim }) => fim).sort().at(-1) ?? '';

  const linhas: string[] = [
    '# Resultado do runbook da Unificação 2.2 — recorte 2.2 na `mrv-devDan`',
    '',
    `Execução de ${inicio} a ${fim} (UTC), por \`npm run runbook\`.`,
    '',
    '> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2',
    '> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem',
    '> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e',
    '> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3',
    '> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook',
    '> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.',
    '',
    `**${resultados.length} RUNs:** ${contar('CONFORME')} conformes, ${contar('DIVERGENTE')} divergentes, ${contar('ERRO')} com erro de execução.`,
    '',
    ...(perfis.some((perfil) => PERFIS_IDENTIDADE.includes(perfil))
      ? [
          '> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os',
          '> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em',
          '> que o caminho alcança X, "Account X intacta" diverge até os guards de',
          '> identidade serem implantados. Veja `docs/handoff-investigacao-tc001-bug4.md`.',
          '',
        ]
      : []),
    '## Resumo por TC',
    '',
    `| TC | Cenário | ${perfis.map((perfil) => `${perfil} (${NOMES_PERFIS[perfil]})`).join(' | ')} |`,
    `|---|---|${perfis.map(() => '---').join('|')}|`,
  ];
  for (const cenario of CENARIOS) {
    const celulas = perfis.map((perfil) => {
      const resultado = porPar.get(`${cenario.id}:${perfil}`);
      return resultado === undefined ? '—' : SIMBOLO[resultado.veredito];
    });
    if (celulas.every((celula) => celula === '—')) continue;
    linhas.push(`| ${cenario.id} | ${cenario.titulo} | ${celulas.join(' | ')} |`);
  }

  const comProblema = CENARIOS.filter((cenario) =>
    perfis.some((perfil) => {
      const resultado = porPar.get(`${cenario.id}:${perfil}`);
      return resultado !== undefined && resultado.veredito !== 'CONFORME';
    }),
  );
  if (comProblema.length > 0) {
    linhas.push('', '## Divergências e erros', '');
    for (const cenario of comProblema) {
      linhas.push(`### ${cenario.id} — ${cenario.titulo}`, '');
      if (cenario.observacao) linhas.push(`_Observação:_ ${cenario.observacao}`, '');
      for (const perfil of perfis) {
        const resultado = porPar.get(`${cenario.id}:${perfil}`);
        if (resultado === undefined || resultado.veredito === 'CONFORME') continue;
        linhas.push(`**${perfil}** (\`${resultado.run}\`, ${SIMBOLO[resultado.veredito]}):`, '');
        if (resultado.erro) linhas.push(`- Erro: ${resumo(resultado.erro)}`);
        for (const assercao of resultado.assercoes.filter(({ ok }) => !ok)) {
          linhas.push(
            `- ${assercao.nome}${assercao.detalhe === undefined ? '' : `: \`${resumo(assercao.detalhe)}\``}`,
          );
        }
        linhas.push('');
      }
    }
  }

  const observacoes = CENARIOS.filter(
    (cenario) =>
      cenario.observacao && !comProblema.includes(cenario) &&
      perfis.some((perfil) => porPar.has(`${cenario.id}:${perfil}`)),
  );
  if (observacoes.length > 0) {
    linhas.push('## Adaptações registradas', '');
    for (const cenario of observacoes) {
      linhas.push(`- **${cenario.id}:** ${cenario.observacao}`);
    }
    linhas.push('');
  }

  const comTempos = resultados.flatMap(({ tempos }) => (tempos ? [tempos] : []));
  if (comTempos.length > 0) {
    const media = (campo: keyof (typeof comTempos)[number]) =>
      (comTempos.reduce((soma, tempos) => soma + tempos[campo], 0) / comTempos.length / 1_000).toFixed(1);
    const refeitos = resultados.filter(({ tentativaParalela }) => tentativaParalela !== undefined);
    const quedas = resultados.filter(({ quedasDeRede }) => quedasDeRede !== undefined);
    linhas.push(
      '## Tempos',
      '',
      `Média de ${comTempos.length} RUNs, em segundos: total ${media('totalMs')}; massa ${media('massaMs')}; cadeia ${media('cadeiaMs')} (dos quais ${media('esperaJobsMs')} esperando jobs); verificação ${media('verificacaoMs')}; cleanup ${media('cleanupMs')}.`,
      '',
      ...(refeitos.length > 0
        ? [
            `Refeitos em sequência depois de acusar job com erro no pool paralelo: ${refeitos.map(({ tc, perfil }) => `${tc}/${perfil}`).join(', ')}.`,
            '',
          ]
        : []),
      ...(quedas.length > 0
        ? [
            `Refeitos depois de queda de rede: ${quedas.map(({ tc, perfil, quedasDeRede }) => `${tc}/${perfil} (${quedasDeRede!.length} ${quedasDeRede!.length === 1 ? 'queda' : 'quedas'})`).join(', ')}.`,
            '',
          ]
        : []),
    );
  }

  const residuos = resultados.filter(
    ({ cleanup }) => cleanup === null || cleanup.restantes !== 0 || cleanup.erros.length > 0,
  );
  linhas.push('## Limpeza', '');
  linhas.push(
    residuos.length === 0
      ? 'Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).'
      : `RUNs com resíduo ou erro de limpeza: ${residuos
          .map(({ tc, perfil, cleanup }) => {
            const restantes =
              cleanup === null
                ? 'sem limpeza'
                : cleanup.restantes === null
                  ? 'resíduo não verificado'
                  : `${cleanup.restantes} restantes`;
            return `${tc}/${perfil} (${restantes}; ${cleanup?.erros.join('; ') ?? ''})`;
          })
          .join(', ')}`,
    '',
  );

  await writeFile(saida, `${linhas.join('\n')}\n`, 'utf8');
  console.log(`Relatório gravado em ${saida} (${resultados.length} RUNs).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
