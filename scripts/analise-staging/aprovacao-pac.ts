import { argumento, campo, consultar, eventosDosLogs } from './lib.ts';

/**
 * Sequência real dos eventos de uma PAC numa janela de tempo: `pac-insert`,
 * `pac-update` e `notificacaopendencia-insert`. Mostra a ordem da aprovação
 * descrita nas seções 3.6 e 6.2 de `docs/origem-dos-eventos-no-salesforce.md`:
 * a pendência sai na hora, e a PAC aprovada só sai quando os proponentes têm
 * IdCliente.
 *
 *   node scripts/analise-staging/aprovacao-pac.ts --pac <Id Salesforce da PAC> --de <UTC> --ate <UTC>
 *
 * Exemplo, com a PAC do bug 4 (passagem de contexto, seção 4):
 *
 *   node scripts/analise-staging/aprovacao-pac.ts --pac a0kHZ00000BDELNYA5 --de 2026-09-08T17:45:00Z --ate 2026-09-08T17:56:00Z
 *
 * Somente leitura em `mrv-staging`. Imprime horários, tipos, status, tipo de
 * notificação e quantos proponentes têm IdCliente; nunca nomes, CPF ou
 * contatos.
 */

const pac = argumento('pac', '');
const de = argumento('de', '');
const ate = argumento('ate', '');
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
if (
  !/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(pac) ||
  !UTC.test(de) ||
  !UTC.test(ate)
) {
  throw new Error(
    'Informe --pac <Id Salesforce da PAC> --de <aaaa-mm-ddThh:mm:ssZ> --ate <aaaa-mm-ddThh:mm:ssZ>.',
  );
}

const [registroPac] = consultar(
  `SELECT Id__c FROM PropostaAnaliseCredito__c WHERE Id = '${pac}'`,
);
if (registroPac === undefined || typeof registroPac.Id__c !== 'string') {
  throw new Error(`PAC ${pac} não encontrada em mrv-staging.`);
}
const idExterno = registroPac.Id__c.toLowerCase();

const registros = consultar(
  `SELECT EventType__c, CreatedDate, BodyRequest__c FROM LogIntegracao__c WHERE EventType__c IN ('pac-insert', 'pac-update', 'notificacaopendencia-insert') AND CreatedDate >= ${de} AND CreatedDate <= ${ate} ORDER BY CreatedDate ASC LIMIT 2000`,
).filter(
  (registro) =>
    typeof registro.BodyRequest__c === 'string' &&
    registro.BodyRequest__c.toLowerCase().includes(idExterno),
);

const vistos = new Set<string>();
for (const { envelope, criadoEm } of eventosDosLogs(registros).eventos) {
  const id = String(campo(envelope, 'id'));
  const reentrega = vistos.has(id) ? ' (mesmo evento de novo)' : '';
  vistos.add(id);
  const tipo = String(campo(envelope, 'eventtype'));
  const data = campo(envelope, 'data');
  const gravado = new Date(criadoEm).toISOString().slice(11, 19);
  const eventTime = String(campo(envelope, 'eventtime')).slice(11, 22);
  const rota = campo(envelope, 'metadataversion') === undefined ? 'sem' : 'com';
  let detalhe: string;
  if (tipo.startsWith('pac')) {
    const proponentes = campo(data, 'proponentes');
    const lista = Array.isArray(proponentes) ? proponentes : [];
    const comIdCliente = lista.filter((p) =>
      Boolean(campo(p, 'idcliente')),
    ).length;
    detalhe = `status=${String(campo(data, 'status'))}, proponentes com IdCliente: ${comIdCliente} de ${lista.length}`;
  } else {
    detalhe = `tipoNotificacao=${String(campo(data, 'tiponotificacao') ?? '(ausente)')}`;
  }
  console.log(
    `${gravado} UTC (eventTime ${eventTime})  ${tipo}${reentrega}  ${detalhe}  [${rota} metadataVersion]`,
  );
}
if (vistos.size === 0) console.log('Nenhum evento dessa PAC na janela.');
