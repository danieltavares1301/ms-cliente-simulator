import { execFileSync, execSync } from 'node:child_process';

/**
 * Base das consultas da análise de origem dos eventos
 * (`docs/origem-dos-eventos-no-salesforce.md`).
 *
 * Tudo aqui é SOMENTE LEITURA: `consultar` só aceita SELECT, roda pela
 * Salesforce CLI autenticada e só fala com as orgs permitidas. Os scripts
 * imprimem metadados do envelope, formatos e contagens; nenhum valor de
 * negócio sai da org.
 */

export const ORG_STAGING = 'mrv-staging';
const ORGS_PERMITIDAS = [ORG_STAGING, 'mrv-devDan'];

export type Registro = Record<string, unknown>;

export function consultar(
  soql: string,
  opcoes: { org?: string; tooling?: boolean } = {},
): Registro[] {
  if (!/^\s*select\s/i.test(soql)) {
    throw new Error('Só consultas SELECT são permitidas.');
  }
  if (soql.includes('"')) {
    throw new Error('A consulta não pode ter aspas duplas.');
  }
  const org = opcoes.org ?? ORG_STAGING;
  if (!ORGS_PERMITIDAS.includes(org)) {
    throw new Error(
      `Org não permitida: ${org} (use ${ORGS_PERMITIDAS.join(' ou ')}).`,
    );
  }
  const argumentos = ['data', 'query', '-o', org, '--json', '-q', soql];
  if (opcoes.tooling) argumentos.push('--use-tooling-api');
  const configuracao = { maxBuffer: 1024 * 1024 * 1024 };
  // No Windows a CLI é um .cmd, que só roda por um shell.
  const saida =
    process.platform === 'win32'
      ? execSync(
          `sf ${argumentos.map((a) => (a === soql ? `"${a}"` : a)).join(' ')}`,
          configuracao,
        )
      : execFileSync('sf', argumentos, configuracao);
  const resposta = JSON.parse(saida.toString()) as {
    result?: { records?: Registro[] };
  };
  return resposta.result?.records ?? [];
}

/** Lê `--nome valor` da linha de comando. */
export function argumento(nome: string, padrao: string): string {
  const indice = process.argv.indexOf(`--${nome}`);
  const valor = indice === -1 ? undefined : process.argv[indice + 1];
  return valor === undefined || valor.startsWith('--') ? padrao : valor;
}

/** Lê `--nome N` como inteiro positivo. */
export function inteiro(nome: string, padrao: number): number {
  const valor = Number(argumento(nome, String(padrao)));
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`--${nome} precisa ser inteiro positivo.`);
  }
  return valor;
}

export function contar(mapa: Map<string, number>, chave: string): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
}

/** Contagens em ordem decrescente, numa linha. */
export function listar(mapa: Map<string, number>, limite = 20): string {
  return (
    [...mapa]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite)
      .map(([chave, total]) => `${chave} ×${total}`)
      .join(' | ') || '-'
  );
}

/** Lê uma chave sem diferenciar maiúsculas, como o Apex faz. */
export function campo(objeto: unknown, nome: string): unknown {
  if (objeto === null || typeof objeto !== 'object') return undefined;
  const alvo = nome.toLowerCase();
  const chave = Object.keys(objeto).find((k) => k.toLowerCase() === alvo);
  return chave === undefined
    ? undefined
    : (objeto as Record<string, unknown>)[chave];
}

/** Formato de um valor, sem o valor: dígitos viram 9 e letras viram x. */
export function forma(valor: unknown): string {
  if (valor === null || valor === undefined) return String(valor);
  if (typeof valor !== 'string') return typeof valor;
  return valor
    .replace(/[0-9]/g, '9')
    .replace(/[A-Za-zÀ-ÿ]/g, 'x')
    .replace(/x{3,}/g, 'x…');
}

export const GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Troca identificadores e valores com cara de dado pessoal por marcadores. */
export function mascarar(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return `(${valor === '' ? 'vazio' : String(valor)})`;
  }
  const texto = String(valor);
  if (texto.includes('@')) return '<email>';
  if (GUID.test(texto)) return '<guid>';
  if (/^\d+$/.test(texto)) return '<número>';
  if (/\s/.test(texto) && texto.length > 3) return '<texto com espaço>';
  if (/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(texto) && /\d/.test(texto)) {
    return '<id Salesforce?>';
  }
  return texto
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '<guid>',
    )
    .replace(/\d{5,}/g, '<n>')
    .slice(0, 60);
}

/** Nome do tópico a partir do caminho completo do recurso no Azure. */
export function nomeTopico(topico: unknown): string {
  if (typeof topico !== 'string') return `(${typeof topico})`;
  return topico.match(/\/topics\/([^/]+)/i)?.[1] ?? mascarar(topico);
}

export type EventoDoLog = {
  envelope: Record<string, unknown>;
  criadoEm: number;
  resposta: string;
};

/** Eventos de cada log com corpo; logs sem corpo ou com JSON quebrado são contados à parte. */
export function eventosDosLogs(registros: Registro[]): {
  eventos: EventoDoLog[];
  semCorpo: number;
  naoJson: number;
} {
  const eventos: EventoDoLog[] = [];
  let semCorpo = 0;
  let naoJson = 0;
  for (const registro of registros) {
    const corpo = registro.BodyRequest__c;
    if (typeof corpo !== 'string' || corpo === '') {
      semCorpo += 1;
      continue;
    }
    let conteudo: unknown;
    try {
      conteudo = JSON.parse(corpo);
    } catch {
      naoJson += 1;
      continue;
    }
    for (const envelope of Array.isArray(conteudo) ? conteudo : [conteudo]) {
      if (envelope === null || typeof envelope !== 'object') continue;
      eventos.push({
        envelope: envelope as Record<string, unknown>,
        criadoEm: Date.parse(String(registro.CreatedDate ?? '')),
        resposta: String(registro.Response__c ?? ''),
      });
    }
  }
  return { eventos, semCorpo, naoJson };
}

/** Agrupa as entregas pelo `id` do envelope (o mesmo evento reentregue). */
export function porEvento(eventos: EventoDoLog[]): Map<string, EventoDoLog[]> {
  const grupos = new Map<string, EventoDoLog[]>();
  for (const evento of eventos) {
    const id = String(campo(evento.envelope, 'id'));
    const entregas = grupos.get(id);
    if (entregas) entregas.push(evento);
    else grupos.set(id, [evento]);
  }
  return grupos;
}
