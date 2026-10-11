import {
  argumento,
  campo,
  consultar,
  contar,
  eventosDosLogs,
  inteiro,
  listar,
  nomeTopico,
} from './lib.ts';

/**
 * `Estado` da raiz do `data` em `jornadausuario-*`, por dia e sem reentregas,
 * comparado com o primeiro `"Estado"` do texto do JSON, que é o que uma busca
 * textual encontra. Mostra de onde vem a sigla de UF que a análise antiga
 * tomou como `Estado` (seção 5 de `docs/origem-dos-eventos-no-salesforce.md`).
 *
 *   node scripts/analise-staging/estado-jornada.ts [--tipo jornadausuario-update] [--dias 45] [--por-dia 40]
 *
 * Somente leitura em `mrv-staging`; imprime só valores de enum, caminhos e
 * contagens.
 */

const TIPOS_PERMITIDOS = ['jornadausuario-insert', 'jornadausuario-update'];
const tipo = argumento('tipo', 'jornadausuario-update');
if (!TIPOS_PERMITIDOS.includes(tipo)) {
  throw new Error(`--tipo precisa ser ${TIPOS_PERMITIDOS.join(' ou ')}.`);
}
const dias = inteiro('dias', 45);
const porDia = inteiro('por-dia', 40);
const UF = /^[A-Z]{2}$/;

/** Caminhos de chaves "Estado" aninhadas cujo valor é uma sigla de UF. */
function caminhosComUf(
  valor: unknown,
  caminho: string,
  achados: Set<string>,
): void {
  if (Array.isArray(valor)) {
    for (const item of valor) caminhosComUf(item, `${caminho}[]`, achados);
    return;
  }
  if (valor === null || typeof valor !== 'object') return;
  for (const [chave, filho] of Object.entries(valor)) {
    const atual = `${caminho}.${chave}`;
    if (
      caminho !== 'data' &&
      chave.toLowerCase() === 'estado' &&
      UF.test(String(filho))
    ) {
      achados.add(atual);
    }
    caminhosComUf(filho, atual, achados);
  }
}

const vistos = new Set<string>();
const topicos = new Map<string, number>();
const raiz = new Map<string, number>();
const primeiroNoTexto = new Map<string, number>();
const caminhos = new Map<string, number>();
let reentregas = 0;
let diasComLog = 0;
let logs = 0;
const hoje = new Date();
const fimDoDia = Date.UTC(
  hoje.getUTCFullYear(),
  hoje.getUTCMonth(),
  hoje.getUTCDate() + 1,
);

for (let dia = 0; dia < dias; dia += 1) {
  const fim = new Date(fimDoDia - dia * 86_400_000);
  const inicio = new Date(fim.getTime() - 86_400_000);
  const iso = (data: Date) => data.toISOString().replace('.000Z', 'Z');
  // BodyRequest__c é texto longo e não pode entrar no WHERE: o filtro é feito aqui.
  const registros = consultar(
    `SELECT BodyRequest__c FROM LogIntegracao__c WHERE EventType__c = '${tipo}' AND CreatedDate >= ${iso(inicio)} AND CreatedDate < ${iso(fim)} ORDER BY CreatedDate DESC LIMIT ${porDia * 2}`,
  )
    .filter(
      (registro) =>
        typeof registro.BodyRequest__c === 'string' &&
        registro.BodyRequest__c !== '',
    )
    .slice(0, porDia);
  if (registros.length === 0) continue;
  diasComLog += 1;
  logs += registros.length;
  for (const registro of registros) {
    const primeiro = String(registro.BodyRequest__c).match(
      /"Estado"\s*:\s*"([^"]*)"/i,
    );
    contar(
      primeiroNoTexto,
      primeiro === null
        ? '(nenhum)'
        : UF.test(primeiro[1])
          ? 'UF'
          : primeiro[1],
    );
  }
  for (const { envelope } of eventosDosLogs(registros).eventos) {
    const id = String(campo(envelope, 'id'));
    if (vistos.has(id)) {
      reentregas += 1;
      continue;
    }
    vistos.add(id);
    contar(topicos, nomeTopico(campo(envelope, 'topic')));
    const data = campo(envelope, 'data');
    const estado = campo(data, 'estado');
    contar(raiz, UF.test(String(estado)) ? 'UF' : String(estado));
    const achados = new Set<string>();
    caminhosComUf(data, 'data', achados);
    for (const caminho of achados) contar(caminhos, caminho);
  }
}

console.log(
  `${tipo}: ${vistos.size} eventos distintos (+${reentregas} reentregas descartadas) em ${diasComLog} dias com log; ${logs} logs lidos (até ${porDia} por dia, últimos ${dias} dias)`,
);
console.log(`  tópico: ${listar(topicos)}`);
console.log(`  Estado na RAIZ do data (o que o Apex lê): ${listar(raiz)}`);
console.log(
  `  primeiro "Estado" no texto do JSON, por log: ${listar(primeiroNoTexto)}`,
);
console.log(`  chaves "Estado" aninhadas com UF: ${listar(caminhos)}`);
