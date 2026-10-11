import {
  campo,
  consultar,
  contar,
  eventosDosLogs,
  inteiro,
  listar,
  porEvento,
} from './lib.ts';

/**
 * Eventos entregues mais de uma vez: intervalo entre a primeira e a segunda
 * entrega, erro que motivou a reentrega, resultado final e as duas formas de
 * envelope (com e sem `metadataVersion`). Sustenta as seções 6.1 e 6.3 de
 * `docs/origem-dos-eventos-no-salesforce.md`.
 *
 *   node scripts/analise-staging/reentregas.ts [--dias 7] [--limite 400]
 *
 * Somente leitura em `mrv-staging`; imprime só categorias e contagens. Com o
 * limite atingido, a amostra é a mais recente e serve como indício, não taxa.
 */

const TIPOS = [
  'cliente-insert',
  'contato-insert',
  'pac-update',
  'notificacaopendencia-insert',
];

const dias = inteiro('dias', 7);
const limite = inteiro('limite', 400);

function categoriaDoErro(resposta: string): string {
  if (/UNABLE_TO_LOCK_ROW/i.test(resposta)) return 'UNABLE_TO_LOCK_ROW';
  if (/Record Currently Unavailable/i.test(resposta))
    return 'Record Currently Unavailable';
  if (/DUPLICATE_VALUE/i.test(resposta)) return 'DUPLICATE_VALUE';
  if (/n[aã]o encontrad/i.test(resposta)) return 'não encontrado';
  if (/REQUIRED_FIELD_MISSING/i.test(resposta)) return 'REQUIRED_FIELD_MISSING';
  if (resposta.trim() === '') return '(resposta vazia)';
  return 'outro';
}

const comErro = (resposta: string) => /error|exception/i.test(resposta);

function faixa(segundos: number): string {
  if (segundos <= 1) return 'até 1 s';
  if (segundos <= 10) return '1 a 10 s';
  if (segundos <= 60) return '10 a 60 s';
  if (segundos <= 600) return '1 a 10 min';
  return 'mais de 10 min';
}

for (const tipo of TIPOS) {
  const registros = consultar(
    `SELECT BodyRequest__c, Response__c, CreatedDate FROM LogIntegracao__c WHERE EventType__c = '${tipo}' AND CreatedDate = LAST_N_DAYS:${dias} ORDER BY CreatedDate DESC LIMIT ${limite}`,
  );
  const grupos = porEvento(eventosDosLogs(registros).eventos);
  const intervalos = new Map<string, number>();
  const primeiroErro = new Map<string, number>();
  const resultadoFinal = new Map<string, number>();
  const extremos: number[] = [];
  let repetidos = 0;
  let duasFormas = 0;
  for (const entregas of grupos.values()) {
    if (entregas.length < 2) continue;
    repetidos += 1;
    entregas.sort((a, b) => a.criadoEm - b.criadoEm);
    const [primeira, segunda] = entregas;
    const ultima = entregas[entregas.length - 1];
    contar(intervalos, faixa((segunda.criadoEm - primeira.criadoEm) / 1000));
    extremos.push((ultima.criadoEm - primeira.criadoEm) / 1000);
    if (comErro(primeira.resposta)) {
      contar(primeiroErro, categoriaDoErro(primeira.resposta));
    } else {
      contar(primeiroErro, 'sem erro');
    }
    contar(
      resultadoFinal,
      comErro(ultima.resposta)
        ? `erro: ${categoriaDoErro(ultima.resposta)}`
        : 'sucesso',
    );
    const formas = new Set(
      entregas.map(({ envelope }) =>
        campo(envelope, 'metadataversion') === undefined ? 'sem' : 'com',
      ),
    );
    if (formas.size > 1) duasFormas += 1;
  }
  extremos.sort((a, b) => a - b);
  const mediana =
    extremos.length > 0 ? extremos[Math.floor(extremos.length / 2)] : null;
  console.log(
    `\n## ${tipo}: ${registros.length} logs em ${dias} dias, ${grupos.size} eventos distintos, ${repetidos} entregues duas vezes ou mais`,
  );
  console.log(`  intervalo entre a 1ª e a 2ª entrega: ${listar(intervalos)}`);
  console.log(`  1ª entrega:     ${listar(primeiroErro)}`);
  console.log(`  última entrega: ${listar(resultadoFinal)}`);
  console.log(`  chegaram com e sem metadataVersion: ${duasFormas}`);
  if (mediana !== null) {
    console.log(
      `  da 1ª à última entrega: mediana ${mediana} s, máximo ${extremos[extremos.length - 1]} s`,
    );
  }
}
