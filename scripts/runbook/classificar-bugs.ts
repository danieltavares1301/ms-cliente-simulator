import { readFile, writeFile } from 'node:fs/promises';

import { TODOS_PERFIS, type Perfil, type ResultadoRun } from './engine.ts';
import { readCliFlag } from '../stress-o10-concurrent-events-lib.ts';

/**
 * Liga cada asserção que falhou numa campanha do runbook ao bug que a causa,
 * pelos critérios de `docs/bugs-pegos-pelo-runbook.md`, e monta a matriz
 * TC × perfil em Markdown.
 *
 *   npm run runbook:bugs -- --entrada resultados.jsonl [--saida matriz.md]
 *
 * Um par TC×perfil repetido no JSONL vale pela última execução. Falha sem
 * regra sai como "?" e precisa de análise antes de virar bug no catálogo.
 */

/** TCs em que o Lead candidato sem CPF não é reutilizado em nenhum perfil desde 27/09. */
const TCS_K2 = new Set(['TC-045', 'TC-046', 'TC-049']);

const LEAD_NOVO = 'Lead novo vinculado';

function falhou(resultado: ResultadoRun | undefined, prefixo: string): boolean {
  return (resultado?.assercoes ?? []).some(({ nome, ok }) => !ok && nome.startsWith(prefixo));
}

function xAlterada(resultado: ResultadoRun): boolean {
  return resultado.assercoes.some(
    ({ nome, ok }) => !ok && /^(Account X intacta|Lead X intacto)/.test(nome),
  );
}

/** Bugs de um RUN divergente, cada um com as asserções que ele explica. */
export function bugsDoRun(
  resultado: ResultadoRun,
  porPar: ReadonlyMap<string, ResultadoRun>,
): Map<string, string[]> {
  const bugs = new Map<string, string[]>();
  const anotar = (id: string, nome: string) => bugs.set(id, [...(bugs.get(id) ?? []), nome]);
  const ar = porPar.get(`${resultado.tc}:AR`);
  const recusada = resultado.eventos.some((evento) => evento.rejeicaoEsperada);
  for (const { nome, ok } of resultado.assercoes) {
    if (ok) continue;
    if (nome === 'Todos os eventos responderam HTTP 200') {
      // Os perfis C não tratam como esperada a recusa da PAC em análise de
      // quem ainda não existe: o RUN para nela (mesma causa do B8).
      const pacRecusada = /Cliente\(Account\) n\S{1,4}o encontrado/.test(resultado.erro ?? '');
      const k1 = resultado.tc === 'TC-040' && ['PA', 'ME'].includes(resultado.perfil);
      anotar(k1 ? 'K1' : pacRecusada ? 'B8' : '?', nome);
    } else if (/^(Account X intacta|Lead X intacto)/.test(nome)) {
      anotar(resultado.perfil === 'C4' ? 'B2' : recusada ? 'B8' : 'B1', nome);
    } else if (nome.startsWith('Account Y2 intacta')) {
      anotar('B3', nome);
    } else if (nome.startsWith('Lead Z intacto')) {
      anotar('B4', nome);
    } else if (nome.startsWith('Lead leadCandidato reutilizado')) {
      anotar(TCS_K2.has(resultado.tc) ? 'K2' : 'B5', nome);
    } else if (nome === '1 Lead(s) com o CPF aprovado' && resultado.perfil === 'FW') {
      anotar('B7', nome);
    } else if (nome.startsWith(LEAD_NOVO)) {
      // No FW, se o AR do mesmo TC passa nesta asserção, a falha vem da repetição
      // do WebJob; senão, é consequência de X ou de Z alterados antes.
      if (resultado.perfil === 'FW' && ar !== undefined && !falhou(ar, nome)) anotar('B6', nome);
      else if (xAlterada(resultado)) anotar(resultado.perfil === 'C4' ? 'B2' : 'B1', `${nome} (consequência)`);
      else if (falhou(resultado, 'Lead Z intacto')) anotar('B4', `${nome} (consequência)`);
      else anotar('?', nome);
    } else {
      anotar('?', nome);
    }
  }
  return bugs;
}

export function matrizDeBugs(resultados: readonly ResultadoRun[]): {
  porPar: Map<string, ResultadoRun>;
  bugs: Map<string, Map<string, string[]>>;
} {
  const porPar = new Map<string, ResultadoRun>();
  for (const resultado of resultados) porPar.set(`${resultado.tc}:${resultado.perfil}`, resultado);
  const bugs = new Map<string, Map<string, string[]>>();
  for (const [par, resultado] of porPar) {
    if (resultado.veredito === 'DIVERGENTE') bugs.set(par, bugsDoRun(resultado, porPar));
  }
  return { porPar, bugs };
}

function markdown(resultados: readonly ResultadoRun[]): string {
  const { porPar, bugs } = matrizDeBugs(resultados);
  const perfis = TODOS_PERFIS.filter((perfil) => [...porPar.values()].some((r) => r.perfil === perfil));
  const tcs = [...new Set([...porPar.values()].map(({ tc }) => tc))].sort();
  const celula = (tc: string, perfil: Perfil) => {
    const resultado = porPar.get(`${tc}:${perfil}`);
    if (resultado === undefined) return '—';
    if (resultado.veredito === 'CONFORME') return 'ok';
    if (resultado.veredito === 'ERRO') return 'ERRO';
    return [...bugs.get(`${tc}:${perfil}`)!.keys()].sort().join(' ');
  };
  const linhas = [
    `| TC | ${perfis.join(' | ')} |`,
    `|---|${perfis.map(() => '---').join('|')}|`,
    ...tcs
      .map((tc) => perfis.map((perfil) => celula(tc, perfil)))
      .map((celulas, i) => ({ tc: tcs[i]!, celulas }))
      .filter(({ celulas }) => celulas.some((c) => c !== 'ok' && c !== '—'))
      .map(({ tc, celulas }) => `| ${tc} | ${celulas.join(' | ')} |`),
    '',
  ];
  const porBug = new Map<string, Map<Perfil, string[]>>();
  for (const [par, ids] of bugs) {
    const [tc, perfil] = par.split(':') as [string, Perfil];
    for (const id of ids.keys()) {
      const perfisDoBug = porBug.get(id) ?? new Map<Perfil, string[]>();
      perfisDoBug.set(perfil, [...(perfisDoBug.get(perfil) ?? []), tc.replace('TC-', '')]);
      porBug.set(id, perfisDoBug);
    }
  }
  linhas.push('| Bug | Pares | Onde |', '|---|---:|---|');
  for (const [id, perfisDoBug] of [...porBug].sort(([a], [b]) => a.localeCompare(b))) {
    const total = [...perfisDoBug.values()].reduce((soma, tcsDoPerfil) => soma + tcsDoPerfil.length, 0);
    const onde = TODOS_PERFIS.filter((perfil) => perfisDoBug.has(perfil))
      .map((perfil) => `${perfil}: ${perfisDoBug.get(perfil)!.sort().join(', ')}`)
      .join('; ');
    linhas.push(`| ${id} | ${total} | ${onde} |`);
  }
  return `${linhas.join('\n')}\n`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const entrada = readCliFlag(argv, 'entrada');
  if (entrada === undefined) throw new Error('Use --entrada <resultados.jsonl> [--saida matriz.md].');
  const resultados = (await readFile(entrada, 'utf8'))
    .split('\n')
    .filter((linha) => linha.trim() !== '')
    .map((linha) => JSON.parse(linha) as ResultadoRun);
  const texto = markdown(resultados);
  const saida = readCliFlag(argv, 'saida');
  if (saida === undefined) process.stdout.write(texto);
  else await writeFile(saida, texto, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
