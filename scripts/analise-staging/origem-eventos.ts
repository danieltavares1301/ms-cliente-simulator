import {
  campo,
  consultar,
  contar,
  eventosDosLogs,
  forma,
  inteiro,
  listar,
  mascarar,
  nomeTopico,
} from './lib.ts';

/**
 * Quem publica cada evento que chega ao Salesforce e em que formato: tópico,
 * subject, versões, chaves do envelope e formato das datas. Sustenta as
 * seções 1 e 4 de `docs/origem-dos-eventos-no-salesforce.md`.
 *
 *   node scripts/analise-staging/origem-eventos.ts [--limite 40]
 *
 * Somente leitura em `mrv-staging`; imprime só formatos e contagens.
 */

const TIPOS = [
  'cliente-insert',
  'cliente-update',
  'contato-insert',
  'contato-update',
  'endereco-insert',
  'endereco-update',
  'pac-insert',
  'pac-update',
  'notificacaopendencia-insert',
  'jornadausuario-insert',
  'jornadausuario-update',
];

const limite = inteiro('limite', 40);

for (const tipo of TIPOS) {
  const registros = consultar(
    `SELECT BodyRequest__c FROM LogIntegracao__c WHERE EventType__c = '${tipo}' ORDER BY CreatedDate DESC LIMIT ${limite}`,
  );
  const { eventos, semCorpo, naoJson } = eventosDosLogs(registros);
  const topicos = new Map<string, number>();
  const subjects = new Map<string, number>();
  const versoes = new Map<string, number>();
  const metadata = new Map<string, number>();
  const chaves = new Map<string, number>();
  const eventTime = new Map<string, number>();
  const dataAlteracao = new Map<string, number>();
  for (const { envelope } of eventos) {
    contar(topicos, nomeTopico(campo(envelope, 'topic')));
    contar(subjects, mascarar(campo(envelope, 'subject')));
    contar(versoes, JSON.stringify(campo(envelope, 'dataversion') ?? null));
    const versaoMetadata = campo(envelope, 'metadataversion');
    contar(
      metadata,
      versaoMetadata === undefined ? 'ausente' : JSON.stringify(versaoMetadata),
    );
    contar(chaves, Object.keys(envelope).join(','));
    contar(eventTime, forma(campo(envelope, 'eventtime')));
    contar(
      dataAlteracao,
      forma(campo(campo(envelope, 'data'), 'dataalteracao')),
    );
  }
  console.log(
    `\n## ${tipo}: ${registros.length} logs, ${eventos.length} eventos com corpo (sem corpo: ${semCorpo}; JSON inválido: ${naoJson})`,
  );
  console.log(`  tópico:             ${listar(topicos)}`);
  console.log(`  subject:            ${listar(subjects)}`);
  console.log(`  dataVersion:        ${listar(versoes)}`);
  console.log(`  metadataVersion:    ${listar(metadata)}`);
  console.log(`  chaves do envelope: ${listar(chaves)}`);
  console.log(`  eventTime:          ${listar(eventTime)}`);
  console.log(`  data.dataAlteracao: ${listar(dataAlteracao)}`);
}
