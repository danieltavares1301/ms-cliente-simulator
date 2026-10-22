import { readFile, writeFile } from 'node:fs/promises';

import { CENARIOS } from './cenarios.ts';
import { TODOS_PERFIS, type Perfil, type ResultadoRun } from './engine.ts';
import { ETAPA_DA_REGRA, etapaDa, type Regra } from './etapas.ts';
import { readCliFlag } from '../stress-o10-concurrent-events-lib.ts';

/**
 * Liga cada asserção que falhou numa campanha do runbook ao bug que a causa,
 * pelos critérios de `docs/bugs-pegos-pelo-runbook.md`, e monta a matriz
 * TC × perfil em Markdown.
 *
 *   npm run runbook:bugs -- --entrada resultados.jsonl [--etapa N]
 *     [--comparar anterior.jsonl] [--etapa-anterior N] [--saida matriz.md]
 *
 * Um par TC×perfil repetido no JSONL vale pela última execução. Falha sem
 * regra sai como "?" e precisa de análise antes de virar bug no catálogo.
 * Com `--comparar`, acrescenta o que mudou desde a campanha anterior, por
 * célula e por asserção.
 *
 * A etapa do plano da reescrita vem da flag ou do nome do arquivo
 * (`etapa-2-….jsonl`). Antes da etapa que traz uma regra, o que ela resolve
 * sai como "pendente" dela: "pendente R1", "pendente R3", "pendente R4" ou
 * "pendente R5" (plano, seção 3.3). Da etapa da regra em diante, a mesma
 * falha sai como "?". Sem etapa, a campanha é da 2.2.
 */

/** TCs em que o Lead candidato sem CPF não é reutilizado em nenhum perfil desde 27/09. */
const TCS_K2 = new Set(['TC-045', 'TC-046', 'TC-049']);

const VENDA_GENERICA = new Set(CENARIOS.filter(({ fluxo }) => fluxo === 'VENDA_GENERICA').map(({ id }) => id));

const LEAD_NOVO = 'Lead novo vinculado';
const LEADS_DO_CPF = /^(\d+) Lead\(s\) com o CPF aprovado$/;

/** "Account X intacta" e "Lead X intacto", também nas variantes de um perfil (`PA: Account X intacta …`). */
const X_INTACTO = /^(?:[A-Z][A-Z0-9]: )?(?:Account X intacta|Lead X intacto)/;

/** O que falha porque X virou a Account de Y: Y é achada em X, e o CPF de Y aparece em X e no Lead X. */
const CONSEQUENCIA_DA_TROCA = /^(?:Account aprovada é |\d+ (?:Account|Lead)\(s\) com o CPF aprovado$|Caso C: )/;

const CONTATO_ATRASADO = 'RC: contato-update atrasado';

function falhou(resultado: ResultadoRun | undefined, prefixo: string): boolean {
  return (resultado?.assercoes ?? []).some(({ nome, ok }) => !ok && nome.startsWith(prefixo));
}

function detalheDaFalha(resultado: ResultadoRun, nome: string): unknown {
  return resultado.assercoes.find((a) => a.nome === nome && !a.ok)?.detalhe;
}

/**
 * X ficou com o IdCliente ou o CPF de outra pessoa: o `cliente-insert` de Y
 * com o PROS-X a achou pelo prospect e a sobrescreveu, o bug que o
 * `3f4b3f0906` corrigiu na 2.2. O reflexo da 1.3 leva a troca ao Lead X.
 */
function identidadeDeXTrocada(resultado: ResultadoRun, nome: string): boolean {
  const detalhe = detalheDaFalha(resultado, nome);
  const diferencas: unknown[] = Array.isArray(detalhe) ? detalhe : [];
  return diferencas.some((diferenca) =>
    ['Id__c', 'CPF__pc', 'CPF__c'].includes(String((diferenca as { campo?: unknown } | null)?.campo)),
  );
}

/** Mais Leads com o CPF de Y do que o TC espera, e pelo menos dois (B7). */
function leadDuplicado(resultado: ResultadoRun, nome: string): boolean {
  const esperado = LEADS_DO_CPF.exec(nome)?.[1];
  if (esperado === undefined) return false;
  const encontrados = (detalheDaFalha(resultado, nome) as { encontrados?: unknown[] } | undefined)?.encontrados;
  const quantos = Array.isArray(encontrados) ? encontrados.length : 0;
  return quantos >= 2 && quantos > Number(esperado);
}

/** Asserções de Lead que só passam com a política única de Lead da R4 (plano, seção 3.3). */
function assercaoDeLead(nome: string): boolean {
  return (
    LEADS_DO_CPF.test(nome) ||
    nome === 'Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c)' ||
    nome.startsWith(LEAD_NOVO) ||
    /^Lead \S+ reutilizado e vinculado/.test(nome) ||
    nome === 'Proponente principal na Account aprovada com PROS-Y'
  );
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

/**
 * Bugs de um RUN divergente, cada um com as asserções que ele explica. Com a
 * etapa do plano, o que uma regra ainda não implantada resolve sai como
 * pendente dela.
 */
export function bugsDoRun(
  resultado: ResultadoRun,
  porPar: ReadonlyMap<string, ResultadoRun>,
  etapa?: number,
): Map<string, string[]> {
  const bugs = new Map<string, string[]>();
  const anotar = (id: string, nome: string) => bugs.set(id, [...(bugs.get(id) ?? []), nome]);
  const antesDa = (regra: Regra) => etapa !== undefined && etapa < ETAPA_DA_REGRA[regra];
  const pendente = (regra: Regra) => (antesDa(regra) ? `pendente ${regra}` : '?');
  const ar = porPar.get(`${resultado.tc}:AR`);
  const xTrocada = resultado.assercoes.some(
    ({ nome, ok }) => !ok && X_INTACTO.test(nome) && identidadeDeXTrocada(resultado, nome),
  );
  const eventoQueFalhou = resultado.eventos.find((evento) => !evento.ok && !evento.rejeicaoEsperada);
  const falhaDoEvento = `${resultado.erro ?? ''} ${eventoQueFalhou?.resposta ?? ''}`;
  for (const { nome, ok } of resultado.assercoes) {
    if (ok) continue;
    if (nome === 'Todos os eventos responderam HTTP 200') {
      const pacRecusada = /Cliente\(Account\) n\S{1,4}o encontrado/.test(falhaDoEvento);
      if (resultado.tc === 'TC-040' && ['PA', 'ME'].includes(resultado.perfil)) {
        anotar('K1', nome);
      } else if (pacRecusada && eventoQueFalhou?.rotulo.startsWith('pac-insert-x')) {
        // A PAC da própria X não acha X: sem a busca por CPF do
        // `getClientePosPac`, que a R1 liga na `NotificacaoPAC`.
        anotar(pendente('R1'), nome);
      } else if (pacRecusada) {
        // Os perfis C não tratam como esperada a recusa da PAC em análise de
        // quem ainda não existe: o RUN para nela (mesma causa do B8).
        anotar('B8', nome);
      } else if (/DUPLICATE_VALUE.*IdProspectSalesforce__c/.test(falhaDoEvento)) {
        // O evento de Y com o PROS-X grava esse prospect na Account Y, e o
        // campo é único. Na reescrita, as lacunas 2 e 6 da R1 só gravam o
        // prospect da mesma pessoa (decisão de 21/10; na 2.2, `b372038f43`).
        anotar(pendente('R1'), nome);
      } else {
        anotar('?', nome);
      }
    } else if (X_INTACTO.test(nome) && identidadeDeXTrocada(resultado, nome)) {
      anotar(pendente('R1'), nome);
    } else if (/^(Account X intacta|Lead X intacto)/.test(nome)) {
      anotar(bugDeXAlterada(resultado), nome);
    } else if (xTrocada && CONSEQUENCIA_DA_TROCA.test(nome)) {
      anotar(pendente('R1'), `${nome} (consequência)`);
    } else if (nome === 'Opportunity na Account aprovada' && VENDA_GENERICA.has(resultado.tc) && antesDa('R1')) {
      // Lacuna 8: sem evento de máquina, a PAC aprovada da 1.3 não move a Opportunity.
      anotar(pendente('R1'), nome);
    } else if (
      nome.startsWith(CONTATO_ATRASADO) ||
      (nome === 'Account aprovada com os contatos da PAC' && falhou(resultado, CONTATO_ATRASADO))
    ) {
      // A PAC aprovada não grava os contatos com a data dela, e o contato
      // atrasado vence: o `sincronizarContatosAprovadosPac` da R3.
      anotar(pendente('R3'), nome);
    } else if (nome.startsWith('Account Y2 intacta')) {
      anotar('B3', nome);
    } else if (nome.startsWith('Lead Z intacto')) {
      anotar('B4', nome);
    } else if (leadDuplicado(resultado, nome)) {
      anotar('B7', nome);
    } else if (antesDa('R4') && assercaoDeLead(nome)) {
      anotar(pendente('R4'), nome);
    } else if (nome.startsWith('Lead leadCandidato reutilizado')) {
      anotar(TCS_K2.has(resultado.tc) ? 'K2' : 'B5', nome);
    } else if (nome.startsWith('Lead leadY2 reutilizado') && soContatosAlterados(resultado, nome)) {
      anotar('B10', nome);
    } else if (nome.startsWith('Lead leadY reutilizado') && soContatosAlterados(resultado, nome)) {
      anotar('B9', nome);
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

export function matrizDeBugs(
  resultados: readonly ResultadoRun[],
  etapa?: number,
): {
  porPar: Map<string, ResultadoRun>;
  bugs: Map<string, Map<string, string[]>>;
} {
  const porPar = new Map<string, ResultadoRun>();
  for (const resultado of resultados) porPar.set(`${resultado.tc}:${resultado.perfil}`, resultado);
  const bugs = new Map<string, Map<string, string[]>>();
  for (const [par, resultado] of porPar) {
    if (resultado.veredito === 'DIVERGENTE') bugs.set(par, bugsDoRun(resultado, porPar, etapa));
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

function markdown(resultados: readonly ResultadoRun[], etapa?: number): string {
  const matriz = matrizDeBugs(resultados, etapa);
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

/** Rótulo de cada asserção do par: `ok` ou os bugs que explicam a falha. */
function rotulosDasAssercoes({ porPar, bugs }: Matriz, par: string): Map<string, string> {
  const porNome = new Map<string, Set<string>>();
  for (const [id, nomes] of bugs.get(par) ?? []) {
    for (const nome of nomes) {
      const semSufixo = nome.replace(/ \(consequência\)$/, '');
      porNome.set(semSufixo, (porNome.get(semSufixo) ?? new Set<string>()).add(id));
    }
  }
  return new Map(
    porPar.get(par)!.assercoes.map(({ nome, ok }) => [
      nome,
      ok ? 'ok' : [...(porNome.get(nome) ?? ['?'])].sort().join(' '),
    ]),
  );
}

/**
 * Mudanças TC × perfil × asserção entre as campanhas. Pega o que a célula
 * esconde: um bug que some de um par que segue divergente por outro motivo.
 * Pares com erro de execução em alguma das campanhas ficam de fora.
 */
function mudancasPorAssercao(
  antes: Matriz,
  depois: Matriz,
): { grupos: Map<string, ParesPorPerfil>; soNumaCampanha: number } {
  const grupos = new Map<string, ParesPorPerfil>();
  let soNumaCampanha = 0;
  const comuns = [...antes.porPar.keys()].filter((par) => depois.porPar.has(par)).sort();
  for (const par of comuns) {
    if ([antes, depois].some(({ porPar }) => porPar.get(par)!.veredito === 'ERRO')) continue;
    const de = rotulosDasAssercoes(antes, par);
    const para = rotulosDasAssercoes(depois, par);
    for (const nome of new Set([...de.keys(), ...para.keys()])) {
      const rotuloAntes = de.get(nome);
      const rotuloDepois = para.get(nome);
      if (rotuloAntes === undefined || rotuloDepois === undefined) soNumaCampanha += 1;
      else if (rotuloAntes !== rotuloDepois) acrescentar(grupos, [nome, rotuloAntes, rotuloDepois].join('\t'), par);
    }
  }
  return { grupos, soNumaCampanha };
}

function tabelaDeAssercoes(titulo: string, grupos: [string, ParesPorPerfil][]): string[] {
  if (grupos.length === 0) return ['', `${titulo}: nenhuma.`];
  return [
    '',
    `${titulo}:`,
    '',
    '| Asserção | Antes | Depois | Pares | Onde |',
    '|---|---|---|---:|---|',
    ...grupos.map(([chave, porPerfil]) => {
      const [nome, de, para] = chave.split('\t') as [string, string, string];
      return `| ${nome.replace(/\|/g, '\\|')} | ${de} | ${para} | ${total(porPerfil)} | ${onde(porPerfil)} |`;
    }),
  ];
}

/**
 * Compara a campanha atual com uma anterior: conformes por perfil, pares de
 * cada bug, para cada par cuja célula mudou a passagem de uma célula a outra,
 * agrupada, e as mudanças por asserção. Cada campanha é classificada pela
 * própria etapa.
 */
export function comparacao(
  anteriores: readonly ResultadoRun[],
  atuais: readonly ResultadoRun[],
  etapas: { antes?: number; depois?: number } = {},
): string {
  const antes = matrizDeBugs(anteriores, etapas.antes);
  const depois = matrizDeBugs(atuais, etapas.depois);
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
  const { grupos, soNumaCampanha } = mudancasPorAssercao(antes, depois);
  const porAssercao = ordenadas(grupos);
  const rotulos = (chave: string) => chave.split('\t').slice(1) as [string, string];
  linhas.push(
    ...tabelaDeAssercoes(
      'Asserções que passavam e agora falham',
      porAssercao.filter(([chave]) => rotulos(chave)[0] === 'ok'),
    ),
    ...tabelaDeAssercoes(
      'Asserções que falhavam e agora passam',
      porAssercao.filter(([chave]) => rotulos(chave)[1] === 'ok'),
    ),
    ...tabelaDeAssercoes(
      'Asserções que seguem falhando com outro rótulo',
      porAssercao.filter(([chave]) => !rotulos(chave).includes('ok')),
    ),
  );
  if (soNumaCampanha > 0) {
    linhas.push(
      '',
      `${soNumaCampanha} asserções aparecem só numa das campanhas: RUN que parou antes ou asserção que mudou de nome.`,
    );
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
    throw new Error(
      'Use --entrada <resultados.jsonl> [--etapa N] [--comparar anterior.jsonl] [--etapa-anterior N] [--saida matriz.md].',
    );
  }
  const resultados = await lerResultados(entrada);
  const etapa = etapaDa(argv, 'etapa', entrada);
  const anterior = readCliFlag(argv, 'comparar');
  const texto =
    anterior === undefined
      ? markdown(resultados, etapa)
      : `${markdown(resultados, etapa)}\n${comparacao(await lerResultados(anterior), resultados, {
          antes: etapaDa(argv, 'etapa-anterior', anterior),
          depois: etapa,
        })}`;
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
