import {
  campo,
  consultar,
  contar,
  eventosDosLogs,
  inteiro,
  listar,
} from './lib.ts';

/**
 * Quanto o `eventTime` de cada origem se afasta do momento em que o
 * Salesforce gravou o log da primeira entrega, e com que sufixo de fuso ele
 * chega. Mostra que o MS de crédito manda horário de Brasília rotulado como
 * UTC (seções 4 e 6.4 de `docs/origem-dos-eventos-no-salesforce.md`).
 *
 *   node scripts/analise-staging/relogios.ts [--limite 60]
 *
 * Somente leitura em `mrv-staging`; imprime só sufixos e diferenças em horas.
 * Reentregas tardias aparecem como diferenças grandes; por isso só conta a
 * primeira entrega de cada evento da amostra.
 */

const TIPOS = [
  'cliente-insert',
  'contato-insert',
  'pac-update',
  'notificacaopendencia-insert',
  'jornadausuario-insert',
];

const limite = inteiro('limite', 60);

for (const tipo of TIPOS) {
  const registros = consultar(
    `SELECT CreatedDate, BodyRequest__c FROM LogIntegracao__c WHERE EventType__c = '${tipo}' ORDER BY CreatedDate DESC LIMIT ${limite}`,
  );
  const primeiraEntrega = new Map<
    string,
    { gravadoEm: number; eventTime: string }
  >();
  for (const { envelope, criadoEm } of eventosDosLogs(registros).eventos) {
    const id = String(campo(envelope, 'id'));
    const anterior = primeiraEntrega.get(id);
    if (anterior === undefined || criadoEm < anterior.gravadoEm) {
      primeiraEntrega.set(id, {
        gravadoEm: criadoEm,
        eventTime: String(campo(envelope, 'eventtime')),
      });
    }
  }
  const sufixos = new Map<string, number>();
  const diferencas = new Map<string, number>();
  for (const { gravadoEm, eventTime } of primeiraEntrega.values()) {
    const sufixo = eventTime.match(/(?:Z|[+-]\d\d:\d\d)$/)?.[0];
    contar(sufixos, sufixo ?? '(sem fuso)');
    // Sem fuso, lê como UTC, que é o que o Apex faz.
    const instante = Date.parse(
      sufixo === undefined ? `${eventTime}Z` : eventTime,
    );
    const horas = Math.round((gravadoEm - instante) / 3_600_000);
    contar(diferencas, `${horas} h`);
  }
  console.log(
    `${tipo.padEnd(28)} ${primeiraEntrega.size} eventos | sufixo do eventTime: ${listar(sufixos)} | gravação do log − eventTime: ${listar(diferencas)}`,
  );
}
