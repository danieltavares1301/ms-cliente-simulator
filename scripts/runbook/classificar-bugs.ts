import { readFile, writeFile } from 'node:fs/promises';

import { TODOS_PERFIS, type Perfil, type ResultadoRun } from './engine.ts';
import { readCliFlag } from '../stress-o10-concurrent-events-lib.ts';

/**
 * Liga cada asserção que falhou numa campanha do runbook ao bug que a causa,
 * pelos critérios de `docs/bugs-pegos-pelo-runbook.md`, e monta a matriz
 * TC × perfil em Markdown.
 *
 *   npm run runbook:bugs -- --entrada resultados.jsonl [--comparar anterior.jsonl] [--saida matriz.md]
 *
 * Um par TC×perfil repetido no JSONL vale pela última execução. Falha sem
 * regra sai como "?" e precisa de análise antes de virar bug no catálogo.
 * Com `--comparar`, acrescenta o que mudou desde a campanha anterior.
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

/**
 * Quem grava em X: a contestação (B2), a pendência pelo Proponente que a PAC
 * em análise recusada deixou com os dados de X (B8) ou a pendência pelo
 * Proponente que a PAC em análise ligou a X com os dados de Y (B1).
 */
function bugDeXAlterada(resultado: ResultadoRun): string {
  if (resultado.perfil === 'C4') return 'B2';
  return resultado.eventos.some((evento) => evento.rejeicaoEsperada) ? 'B8' : 'B1';
}

/** Problemas de uma asserção que falhou, sem os valores do RUN: `celular 3198…` vira `celular`. */
function tiposDeProblema(resultado: ResultadoRun, nome: string): Set<string> {
  const assercao = resultado.assercoes.find((a) => a.nome === nome && !a.ok);
  const problemas: unknown[] = Array.isArray(assercao?.detalhe) ? assercao.detalhe : [];
  return new Set(
    problemas.map((problema) =>
      String(problema).replace(/^(e-mail|celular|CPF|DescricaoOrigem__c|contatos alterados:) (?!vazio$).+$/, '$1'),
    ),
  );
}

/** O Lead reutilizado é o certo, mas os contatos dele mudaram. */
function soContatosAlterados(resultado: ResultadoRun, nome: string): boolean {
  const tipos = tiposDeProblema(resultado, nome);
  return tipos.size === 1 && tipos.has('contatos alterados:');
}

/**
 * No FW, o que o AR do mesmo TC não tem na asserção do Lead novo vem da
 * repetição do WebJob (B6). O que o AR também tem é consequência de X ou de Z
 * alterados antes.
 */
function origensDoLeadNovo(
  resultado: ResultadoRun,
  ar: ResultadoRun | undefined,
  nome: string,
): { repeticao: boolean; consequencia: boolean } {
  if (resultado.perfil !== 'FW' || ar === undefined) return { repeticao: false, consequencia: true };
  if (!falhou(ar, nome)) return { repeticao: true, consequencia: false };
  const doAr = tiposDeProblema(ar, nome);
  const tipos = [...tiposDeProblema(resultado, nome)];
  const proprios = tipos.filter((tipo) => !doAr.has(tipo));
  return {
    repeticao: proprios.length > 0,
    consequencia: tipos.length === 0 || proprios.length < tipos.length,
  };
}

/** Bugs de um RUN divergente, cada um com as asserções que ele explica. */
export function bugsDoRun(
  resultado: ResultadoRun,
  porPar: ReadonlyMap<string, ResultadoRun>,
): Map<string, string[]> {
  const bugs = new Map<string, string[]>();
  const anotar = (id: string, nome: string) => bugs.set(id, [...(bugs.get(id) ?? []), nome]);
  const ar = porPar.get(`${resultado.tc}:AR`);
  for (const { nome, ok } of resultado.assercoes) {
    if (ok) continue;
    if (nome === 'Todos os eventos responderam HTTP 200') {
      // Os perfis C não tratam como esperada a recusa da PAC em análise de
      // quem ainda não existe: o RUN para nela (mesma causa do B8).
      const pacRecusada = /Cliente\(Account\) n\S{1,4}o encontrado/.test(resultado.erro ?? '');
      const k1 = resultado.tc === 'TC-040' && ['PA', 'ME'].includes(resultado.perfil);
      anotar(k1 ? 'K1' : pacRecusada ? 'B8' : '?', nome);
    } else if (/^(Account X intacta|Lead X intacto)/.test(nome)) {
      anotar(bugDeXAlterada(resultado), nome);
    } else if (nome.startsWith('Account Y2 intacta')) {
      anotar('B3', nome);
    } else if (nome.startsWith('Lead Z intacto')) {
      anotar('B4', nome);
    } else if (nome.startsWith('Lead leadCandidato reutilizado')) {
      anotar(TCS_K2.has(resultado.tc) ? 'K2' : 'B5', nome);
    } else if (nome.startsWith('Lead leadY reutilizado') && soContatosAlterados(resultado, nome)) {
      anotar('B9', nome);
    } else if (nome === '1 Lead(s) com o CPF aprovado' && resultado.perfil === 'FW') {
      anotar('B7', nome);
    } else if (nome.startsWith(LEAD_NOVO)) {
      const { repeticao, consequencia } = origensDoLeadNovo(resultado, ar, nome);
      if (repeticao) anotar('B6', nome);
      if (!consequencia) continue;
      if (xAlterada(resultado)) anotar(bugDeXAlterada(resultado), `${nome} (consequência)`);
      else if (falhou(resultado, 'Lead Z intacto')) anotar('B4', `${nome} (consequência)`);
      else anotar('?', nome);
    } else {
      anotar('?', nome);
    }
  }
  return bugs;
}

type Matriz = ReturnType<typeof matrizDeBugs>;

/** Pares agrupados por perfil, com o número do TC: `AR → ['001', '002']`. */
type ParesPorPerfil = Map<Perfil, string[]>;

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

/** Célula do par na matriz: `ok`, `ERRO`, os bugs do RUN divergente ou `—` se o par não rodou. */
function celula({ porPar, bugs }: Matriz, par: string): string {
  const resultado = porPar.get(par);
  if (resultado === undefined) return '—';
  if (resultado.veredito === 'CONFORME') return 'ok';
  if (resultado.veredito === 'ERRO') return 'ERRO';
  return [...bugs.get(par)!.keys()].sort().join(' ');
}

function acrescentar(grupos: Map<string, ParesPorPerfil>, chave: string, par: string): void {
  const [tc, perfil] = par.split(':') as [string, Perfil];
  const porPerfil = grupos.get(chave) ?? new Map<Perfil, string[]>();
  porPerfil.set(perfil, [...(porPerfil.get(perfil) ?? []), tc.replace('TC-', '')]);
  grupos.set(chave, porPerfil);
}

function paresPorBug({ bugs }: Matriz): Map<string, ParesPorPerfil> {
  const porBug = new Map<string, ParesPorPerfil>();
  for (const [par, ids] of bugs) for (const id of ids.keys()) acrescentar(porBug, id, par);
  return porBug;
}

const total = (porPerfil: ParesPorPerfil | undefined) =>
  [...(porPerfil?.values() ?? [])].reduce((soma, tcs) => soma + tcs.length, 0);

const onde = (porPerfil: ParesPorPerfil) =>
  TODOS_PERFIS.filter((perfil) => porPerfil.has(perfil))
    .map((perfil) => `${perfil}: ${porPerfil.get(perfil)!.sort().join(', ')}`)
    .join('; ');

const ordenadas = <T>(grupos: Map<string, T>) => [...grupos].sort(([a], [b]) => a.localeCompare(b));

function markdown(resultados: readonly ResultadoRun[]): string {
  const matriz = matrizDeBugs(resultados);
  const { porPar } = matriz;
  const perfis = TODOS_PERFIS.filter((perfil) => [...porPar.values()].some((r) => r.perfil === perfil));
  const tcs = [...new Set([...porPar.values()].map(({ tc }) => tc))].sort();
  const linhas = [
    `| TC | ${perfis.join(' | ')} |`,
    `|---|${perfis.map(() => '---').join('|')}|`,
    ...tcs
      .map((tc) => perfis.map((perfil) => celula(matriz, `${tc}:${perfil}`)))
      .map((celulas, i) => ({ tc: tcs[i]!, celulas }))
      .filter(({ celulas }) => celulas.some((c) => c !== 'ok' && c !== '—'))
      .map(({ tc, celulas }) => `| ${tc} | ${celulas.join(' | ')} |`),
    '',
  ];
  linhas.push('| Bug | Pares | Onde |', '|---|---:|---|');
  for (const [id, porPerfil] of ordenadas(paresPorBug(matriz))) {
    linhas.push(`| ${id} | ${total(porPerfil)} | ${onde(porPerfil)} |`);
  }
  return `${linhas.join('\n')}\n`;
}

/**
 * Compara a campanha atual com uma anterior: conformes por perfil, pares de
 * cada bug e, para cada par cuja célula mudou, a passagem de uma célula a
 * outra, agrupada.
 */
export function comparacao(anteriores: readonly ResultadoRun[], atuais: readonly ResultadoRun[]): string {
  const antes = matrizDeBugs(anteriores);
  const depois = matrizDeBugs(atuais);
  const todos = [...antes.porPar.values(), ...depois.porPar.values()];
  const perfis = TODOS_PERFIS.filter((perfil) => todos.some((r) => r.perfil === perfil));
  const conformes = ({ porPar }: Matriz, perfil: Perfil) => {
    const doPerfil = [...porPar.values()].filter((r) => r.perfil === perfil);
    return `${doPerfil.filter((r) => r.veredito === 'CONFORME').length} de ${doPerfil.length}`;
  };
  const linhas = [
    '| Perfil | Conformes antes | Conformes depois |',
    '|---|---:|---:|',
    ...perfis.map((perfil) => `| ${perfil} | ${conformes(antes, perfil)} | ${conformes(depois, perfil)} |`),
    '',
    '| Bug | Pares antes | Pares depois |',
    '|---|---:|---:|',
  ];
  const bugsAntes = paresPorBug(antes);
  const bugsDepois = paresPorBug(depois);
  for (const id of [...new Set([...bugsAntes.keys(), ...bugsDepois.keys()])].sort()) {
    linhas.push(`| ${id} | ${total(bugsAntes.get(id))} | ${total(bugsDepois.get(id))} |`);
  }
  const mudancas = new Map<string, ParesPorPerfil>();
  for (const par of [...new Set([...antes.porPar.keys(), ...depois.porPar.keys()])].sort()) {
    const de = celula(antes, par);
    const para = celula(depois, par);
    if (de !== para) acrescentar(mudancas, `${de} | ${para}`, par);
  }
  linhas.push('', '| Antes | Depois | Pares | Onde |', '|---|---|---:|---|');
  for (const [chave, porPerfil] of ordenadas(mudancas)) {
    linhas.push(`| ${chave} | ${total(porPerfil)} | ${onde(porPerfil)} |`);
  }
  return `${linhas.join('\n')}\n`;
}

async function lerResultados(caminho: string): Promise<ResultadoRun[]> {
  return (await readFile(caminho, 'utf8'))
    .split('\n')
    .filter((linha) => linha.trim() !== '')
    .map((linha) => JSON.parse(linha) as ResultadoRun);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const entrada = readCliFlag(argv, 'entrada');
  if (entrada === undefined) {
    throw new Error('Use --entrada <resultados.jsonl> [--comparar anterior.jsonl] [--saida matriz.md].');
  }
  const resultados = await lerResultados(entrada);
  const anterior = readCliFlag(argv, 'comparar');
  const texto =
    anterior === undefined
      ? markdown(resultados)
      : `${markdown(resultados)}\n${comparacao(await lerResultados(anterior), resultados)}`;
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
