import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  argumento,
  consultar,
  executarSf,
  exigirOrgPermitida,
  type Registro,
} from './lib.ts';

/**
 * Em que ponto dos branches da unificação está o código implantado numa org.
 * Sustenta `docs/estado-da-mrv-devDan.md`.
 *
 *   node scripts/analise-staging/versao-implantada.ts [--org mrv-devDan]
 *     [--repo ../com_salesforce_mrv] [--desde 2026-08-20] [--sem-metadados]
 *
 * Para cada arquivo que os branches mudaram, compara o que está na org com
 * as versões do arquivo no git: diz se é igual à ponta do branch, a qual
 * commit corresponde e quais commits faltam. Sem correspondência no branch,
 * procura a versão em todas as refs e na cópia de trabalho do checkout; sem
 * nenhuma igual, mostra a mais parecida e o tamanho da diferença.
 *
 * Somente leitura. Na org: SELECT pela Tooling API e retrieve de metadados
 * para uma pasta temporária. No repositório Salesforce: só comandos git de
 * leitura, sem trocar de branch e sem fetch. As pontas são as do último
 * fetch. Imprime só nomes, hashes, datas e contagens de linhas.
 */

const BRANCHES = [
  { nome: '2.2', ref: 'origin/GV_918914_UnificPosAprovPAC' },
  { nome: '2.1', ref: 'origin/feature/gv_918899_unificacao_clientes' },
  { nome: '1.3', ref: 'origin/GV_909649' },
] as const;
const PONTAS = ['origin/develop', 'origin/master'];
const RAIZ = 'force-app/main/default';

const org = argumento('org', 'mrv-devDan');
exigirOrgPermitida(org);
const repo = resolve(
  argumento(
    'repo',
    fileURLToPath(new URL('../../../com_salesforce_mrv', import.meta.url)),
  ),
);
const desde = argumento('desde', '2026-08-20');
if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
  throw new Error('--desde precisa ser uma data AAAA-MM-DD.');
}
const comMetadados = !process.argv.includes('--sem-metadados');

function git(...argumentos: string[]): string {
  return execFileSync('git', ['-C', repo, ...argumentos], {
    maxBuffer: 256 * 1024 * 1024,
  }).toString();
}

function versao(ref: string, caminho: string): string | null {
  try {
    return git('show', `${ref}:${caminho}`);
  } catch {
    return null;
  }
}

/**
 * Sem `\r`, sem espaço no fim das linhas e sem espaço antes e depois do
 * texto (a org guarda o corpo de algumas classes sem o recuo da 1ª linha).
 */
function normalizar(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((linha) => linha.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim();
}

/**
 * XML de metadados sem indentação e sem linhas vazias. Tira também o que o
 * retrieve acrescenta aos flows e o repositório não guarda: estilo dos
 * campos de tela, `nameSegment` e `areMetricsLoggedToDataCloud`.
 */
function normalizarXml(texto: string): string {
  return normalizar(
    texto.replace(/<styleProperties>[\s\S]*?<\/styleProperties>/g, ''),
  )
    .split('\n')
    .map((linha) => linha.trim())
    .filter(
      (linha) =>
        linha !== '' &&
        !linha.startsWith('<areMetricsLoggedToDataCloud>') &&
        !linha.startsWith('<nameSegment>'),
    )
    .join('\n');
}

const pasta = mkdtempSync(join(tmpdir(), 'versao-implantada-'));

/** Linhas que só existem em um dos dois textos, pelo `git diff`. */
function diferenca(
  naOrg: string,
  noGit: string,
): { soNaOrg: number; soNoGit: number } {
  const arquivoOrg = join(pasta, 'org.txt');
  const arquivoGit = join(pasta, 'git.txt');
  writeFileSync(arquivoOrg, `${naOrg}\n`);
  writeFileSync(arquivoGit, `${noGit}\n`);
  let saida: string;
  try {
    saida = execFileSync('git', [
      'diff',
      '--no-index',
      '--numstat',
      arquivoOrg,
      arquivoGit,
    ]).toString();
  } catch (erro) {
    // O git sai com 1 quando os arquivos diferem.
    saida = String((erro as { stdout?: Buffer }).stdout ?? '');
  }
  const [soNoGit, soNaOrg] = saida.trim().split(/\s+/).map(Number);
  return { soNaOrg: soNaOrg || 0, soNoGit: soNoGit || 0 };
}

type Commit = { hash: string; curto: string; data: string; assunto: string };

function commits(...intervalo: string[]): (caminho: string) => Commit[] {
  return (caminho) =>
    git('log', '--format=%H|%h|%cs|%s', ...intervalo, '--', caminho)
      .split('\n')
      .filter(Boolean)
      .map((linha) => {
        const [hash, curto, data, ...assunto] = linha.split('|');
        return {
          hash: hash!,
          curto: curto!,
          data: data!,
          assunto: assunto.join('|'),
        };
      });
}

function descrever(commit: Commit): string {
  return `${commit.curto} ${commit.data} ${commit.assunto.slice(0, 100)}`;
}

/** Até três refs que contêm o commit, para dizer de onde ele veio. */
function refsCom(hash: string): string {
  const refs = git(
    'branch',
    '-a',
    '--contains',
    hash,
    '--format=%(refname:short)',
  )
    .split('\n')
    .filter((ref) => ref && !ref.endsWith('/HEAD'));
  return refs.length === 0
    ? 'nenhuma ref'
    : `${refs.slice(0, 3).join(', ')}${refs.length > 3 ? ` e mais ${refs.length - 3}` : ''}`;
}

const bases = new Map(
  BRANCHES.map(({ ref }) => [
    ref,
    git('merge-base', ref, 'origin/develop').trim(),
  ]),
);
const mudados = new Map(
  BRANCHES.map(({ ref }) => [
    ref,
    git('diff', '--name-only', bases.get(ref)!, ref, '--', RAIZ)
      .split('\n')
      .filter(Boolean),
  ]),
);
// Fora dos branches, a busca vai até a base mais antiga deles.
const inicioDaBusca = [...bases.values()]
  .map((base) => git('log', '-1', '--format=%cs', base).trim())
  .sort()[0]!;
const checkout = git('branch', '--show-current').trim() || '(detached)';

// 1. Referências.
const fetch = join(repo, '.git', 'FETCH_HEAD');
console.log(`Org: ${org}`);
console.log(`Repositório: ${repo}`);
console.log(`  checkout em ${checkout}; só lido com git show`);
console.log(
  `  último fetch: ${existsSync(fetch) ? statSync(fetch).mtime.toISOString() : 'nunca'}`,
);
for (const { nome, ref } of BRANCHES) {
  const base = bases.get(ref)!;
  console.log(
    `  ${nome} ${ref}: ponta ${git('log', '-1', '--format=%h %cs', ref).trim()}, base ${git('log', '-1', '--format=%h %cs', base).trim()}, ${mudados.get(ref)!.length} arquivos mudados`,
  );
}
for (const ref of PONTAS) {
  console.log(`  ${ref}: ${git('log', '-1', '--format=%h %cs', ref).trim()}`);
}

// 2. Ondas de deploy de Apex.
console.log(`\n## Apex alterado na org desde ${desde}, por minuto (UTC)`);
for (const objeto of ['ApexClass', 'ApexTrigger']) {
  const ondas = new Map<string, { codigo: string[]; testes: number }>();
  for (const registro of consultar(
    `SELECT Name, LastModifiedDate FROM ${objeto} WHERE LastModifiedDate >= ${desde}T00:00:00Z ORDER BY LastModifiedDate`,
    { org, tooling: true },
  )) {
    const minuto = String(registro.LastModifiedDate).slice(0, 16);
    const onda = ondas.get(minuto) ?? { codigo: [], testes: 0 };
    const nome = String(registro.Name);
    if (/^test|tests?e?$/i.test(nome)) onda.testes += 1;
    else onda.codigo.push(nome);
    ondas.set(minuto, onda);
  }
  for (const [minuto, { codigo, testes }] of ondas) {
    console.log(
      `  ${objeto} ${minuto}: ${codigo.join(', ') || '-'}${testes ? ` (+${testes} de teste)` : ''}`,
    );
  }
}

/** Situação de um texto da org diante do histórico do arquivo no git. */
function situacao(
  caminho: string,
  naOrg: string,
  normalizacao: (texto: string) => string,
): string[] {
  const linhas: string[] = [];
  const candidatos = new Map<string, string>();
  let achou = false;
  for (const { nome, ref } of BRANCHES) {
    if (!mudados.get(ref)!.includes(caminho)) continue;
    const doBranch = commits(`${bases.get(ref)!}..${ref}`)(caminho);
    const textos = doBranch.map((commit) => {
      const texto = versao(commit.hash, caminho);
      return texto === null ? null : normalizacao(texto);
    });
    doBranch.forEach((commit, i) => {
      if (textos[i] !== null)
        candidatos.set(`${nome} ${descrever(commit)}`, textos[i]!);
    });
    const ponta = versao(ref, caminho);
    if (ponta !== null && normalizacao(ponta) === naOrg) {
      linhas.push(`${nome}: igual à ponta`);
      achou = true;
      continue;
    }
    const indice = textos.findIndex((texto) => texto === naOrg);
    if (indice === -1) {
      linhas.push(`${nome}: não bate com nenhuma versão do branch`);
      continue;
    }
    achou = true;
    const faltam = doBranch.slice(0, indice).reverse();
    linhas.push(
      `${nome}: igual a ${descrever(doBranch[indice]!)}; faltam ${faltam.length}:`,
      ...faltam.map((commit) => `    ${descrever(commit)}`),
    );
  }
  if (achou) return linhas;

  // Fora dos branches: cópia de trabalho do checkout e todas as refs.
  const local = join(repo, caminho);
  if (
    existsSync(local) &&
    normalizacao(readFileSync(local, 'utf8')) === naOrg
  ) {
    linhas.push(`igual à cópia de trabalho do checkout (${checkout})`);
    return linhas;
  }
  for (const commit of commits('--all', `--since=${inicioDaBusca}`)(caminho)) {
    const texto = versao(commit.hash, caminho);
    if (texto === null) continue;
    const normalizado = normalizacao(texto);
    if (normalizado === naOrg) {
      linhas.push(
        `igual a ${descrever(commit)}, que está em: ${refsCom(commit.hash)}`,
      );
      return linhas;
    }
    candidatos.set(descrever(commit), normalizado);
  }
  for (const { nome, ref } of BRANCHES) {
    const texto = versao(bases.get(ref)!, caminho);
    if (texto !== null) candidatos.set(`base do ${nome}`, normalizacao(texto));
  }
  for (const ref of PONTAS) {
    const texto = versao(ref, caminho);
    if (texto !== null)
      candidatos.set(
        `ponta do ${ref.replace('origin/', '')}`,
        normalizacao(texto),
      );
  }
  const vistos = new Set<string>();
  const maisParecido = [...candidatos]
    .filter(([, texto]) =>
      vistos.has(texto) ? false : (vistos.add(texto), true),
    )
    .map(([rotulo, texto]) => ({ rotulo, ...diferenca(naOrg, texto) }))
    .sort((a, b) => a.soNaOrg + a.soNoGit - (b.soNaOrg + b.soNoGit))[0];
  linhas.push(
    maisParecido
      ? `nenhuma versão igual no git; mais parecida: ${maisParecido.rotulo} (linhas só na org: ${maisParecido.soNaOrg}; só no git: ${maisParecido.soNoGit})`
      : 'nenhuma versão no git',
  );
  return linhas;
}

// 3. Apex que os branches mudaram.
type Arquivo = {
  caminho: string;
  objeto: 'ApexClass' | 'ApexTrigger';
  nome: string;
};
const apex = new Map<string, Arquivo>();
for (const caminho of new Set([...mudados.values()].flat())) {
  const classe = caminho.match(/\/classes\/([^/]+)\.cls$/);
  const trigger = caminho.match(/\/triggers\/([^/]+)\.trigger$/);
  if (classe && !/Test$/.test(classe[1]!)) {
    apex.set(caminho, { caminho, objeto: 'ApexClass', nome: classe[1]! });
  } else if (trigger) {
    apex.set(caminho, { caminho, objeto: 'ApexTrigger', nome: trigger[1]! });
  }
}
const implantados = new Map<string, Registro>();
for (const objeto of ['ApexClass', 'ApexTrigger'] as const) {
  const nomes = [...apex.values()]
    .filter((a) => a.objeto === objeto)
    .map((a) => `'${a.nome}'`);
  if (nomes.length === 0) continue;
  for (const registro of consultar(
    `SELECT Name, LastModifiedDate, Body FROM ${objeto} WHERE Name IN (${nomes.join(', ')})`,
    { org, tooling: true },
  )) {
    implantados.set(`${objeto}:${String(registro.Name)}`, registro);
  }
}

console.log('\n## Apex que os branches mudaram (sem classes de teste)');
for (const arquivo of [...apex.values()].sort((a, b) =>
  a.nome.localeCompare(b.nome),
)) {
  const registro = implantados.get(`${arquivo.objeto}:${arquivo.nome}`);
  if (registro === undefined) {
    console.log(`\n${arquivo.nome}: não existe na org`);
    continue;
  }
  console.log(
    `\n${arquivo.nome} (na org desde ${String(registro.LastModifiedDate)})`,
  );
  for (const linha of situacao(
    arquivo.caminho,
    normalizar(String(registro.Body ?? '')),
    normalizar,
  )) {
    console.log(`  ${linha}`);
  }
}

// 4. Metadados que não são Apex.
if (comMetadados) {
  type Metadado = {
    caminho: string;
    membro: string;
    naOrg: (dir: string) => string;
  };
  const metadados: Metadado[] = [];
  const semSuporte: string[] = [];
  for (const caminho of [...new Set([...mudados.values()].flat())].sort()) {
    if (/\/(classes|triggers)\//.test(caminho)) continue;
    const relativo = caminho.slice(RAIZ.length + 1);
    const flow = relativo.match(/^flows\/([^/]+)\.flow-meta\.xml$/);
    const regra = relativo.match(
      /^objects\/([^/]+)\/validationRules\/([^/]+)\.validationRule-meta\.xml$/,
    );
    const lwc = relativo.match(/^lwc\/([^/]+)\/([^/]+)$/);
    if (flow) {
      metadados.push({
        caminho,
        membro: `Flow:${flow[1]}`,
        naOrg: (dir) =>
          readFileSync(join(dir, 'flows', `${flow[1]}.flow`), 'utf8'),
      });
    } else if (regra) {
      const [, objeto, nome] = regra;
      metadados.push({
        caminho,
        membro: `ValidationRule:${objeto}.${nome}`,
        naOrg: (dir) => {
          const bloco = readFileSync(
            join(dir, 'objects', `${objeto}.object`),
            'utf8',
          ).match(
            new RegExp(
              `<validationRules>\\s*<fullName>${nome}</fullName>[\\s\\S]*?</validationRules>`,
            ),
          );
          if (!bloco) throw new Error(`regra ${nome} ausente no retrieve`);
          return bloco[0];
        },
      });
    } else if (lwc) {
      metadados.push({
        caminho,
        membro: `LightningComponentBundle:${lwc[1]}`,
        naOrg: (dir) =>
          readFileSync(join(dir, 'lwc', lwc[1]!, lwc[2]!), 'utf8'),
      });
    } else {
      semSuporte.push(relativo);
    }
  }

  // Regra de validação: mesmo conteúdo, sem o envelope de cada formato.
  const semEnvelopeDaRegra = (texto: string) =>
    texto
      .replace(/<\?xml[^>]*>/, '')
      .replace(
        /<\/?validationRules>|<ValidationRule[^>]*>|<\/ValidationRule>/g,
        '',
      )
      .replace(/<fullName>[^<]*<\/fullName>/, '');
  const normalizacaoDe = (caminho: string): ((texto: string) => string) =>
    caminho.includes('/validationRules/')
      ? (texto) => normalizarXml(semEnvelopeDaRegra(texto))
      : /\.(js|html|css)$/.test(caminho)
        ? normalizar
        : normalizarXml;

  console.log('\n## Metadados que os branches mudaram (fora do Apex)');
  const membros = [...new Set(metadados.map((m) => m.membro))];
  const destino = join(pasta, 'retrieve');
  let retrieve: string | null = null;
  if (membros.length > 0) {
    try {
      const resposta = JSON.parse(
        executarSf(
          [
            'project',
            'retrieve',
            'start',
            '--target-org',
            org,
            '--target-metadata-dir',
            destino,
            '--unzip',
            '--json',
            ...membros.flatMap((membro) => ['--metadata', membro]),
          ],
          { cwd: pasta },
        ),
      ) as { result?: { status?: string } };
      if (resposta.result?.status === 'Succeeded') {
        retrieve = join(destino, 'unpackaged', 'unpackaged');
      } else {
        console.log(
          `  retrieve terminou como ${resposta.result?.status ?? 'desconhecido'}`,
        );
      }
    } catch (erro) {
      console.log(
        `  retrieve falhou: ${erro instanceof Error ? erro.message.split('\n')[0] : 'erro desconhecido'}`,
      );
    }
  }
  if (retrieve !== null) {
    const datas = datasNaOrg(membros);
    for (const metadado of metadados) {
      const relativo = metadado.caminho.slice(RAIZ.length + 1);
      let naOrg: string;
      try {
        naOrg = metadado.naOrg(retrieve);
      } catch (erro) {
        console.log(
          `\n${relativo}: ${erro instanceof Error ? erro.message : 'não lido'}`,
        );
        continue;
      }
      const normalizacao = normalizacaoDe(metadado.caminho);
      const data = datas.get(metadado.membro);
      console.log(`\n${relativo}${data ? ` (na org: ${data})` : ''}`);
      for (const linha of situacao(
        metadado.caminho,
        normalizacao(naOrg),
        normalizacao,
      )) {
        console.log(`  ${linha}`);
      }
    }
  }
  if (semSuporte.length > 0) {
    console.log(
      `\nNão conferidos (tipo sem suporte no script): ${semSuporte.join(', ')}`,
    );
  }
}

rmSync(pasta, { recursive: true, force: true });

/** Desde quando cada metadado está na org (flows: a versão ativa), pela Tooling API. */
function datasNaOrg(membros: string[]): Map<string, string> {
  const datas = new Map<string, string>();
  const nomes = (tipo: string) =>
    membros
      .filter((membro) => membro.startsWith(`${tipo}:`))
      .map(
        (membro) =>
          `'${membro
            .slice(tipo.length + 1)
            .split('.')
            .at(-1)}'`,
      )
      .join(', ');
  if (nomes('Flow')) {
    for (const registro of consultar(
      `SELECT Definition.DeveloperName, VersionNumber, LastModifiedDate FROM Flow WHERE Status = 'Active' AND Definition.DeveloperName IN (${nomes('Flow')})`,
      { org, tooling: true },
    )) {
      const definicao = registro.Definition as
        { DeveloperName?: string } | undefined;
      datas.set(
        `Flow:${String(definicao?.DeveloperName)}`,
        `versão ativa v${String(registro.VersionNumber)}, de ${String(registro.LastModifiedDate)}`,
      );
    }
  }
  if (nomes('LightningComponentBundle')) {
    for (const registro of consultar(
      `SELECT DeveloperName, LastModifiedDate FROM LightningComponentBundle WHERE DeveloperName IN (${nomes('LightningComponentBundle')})`,
      { org, tooling: true },
    )) {
      datas.set(
        `LightningComponentBundle:${String(registro.DeveloperName)}`,
        `de ${String(registro.LastModifiedDate)}`,
      );
    }
  }
  if (nomes('ValidationRule')) {
    for (const registro of consultar(
      `SELECT ValidationName, EntityDefinition.DeveloperName, LastModifiedDate FROM ValidationRule WHERE ValidationName IN (${nomes('ValidationRule')})`,
      { org, tooling: true },
    )) {
      const objeto = (
        registro.EntityDefinition as { DeveloperName?: string } | undefined
      )?.DeveloperName;
      datas.set(
        `ValidationRule:${String(objeto)}.${String(registro.ValidationName)}`,
        `de ${String(registro.LastModifiedDate)}`,
      );
    }
  }
  return datas;
}
