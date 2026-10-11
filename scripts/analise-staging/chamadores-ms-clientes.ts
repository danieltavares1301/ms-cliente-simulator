import {
  campo,
  consultar,
  contar,
  eventosDosLogs,
  GUID,
  inteiro,
  listar,
  mascarar,
} from './lib.ts';

/**
 * Quem disparou cada evento do MS Clientes. O `data.UsuarioAlteracao` traz o
 * header `idUsuario` do chamador ou, sem ele, o `client_id` do token; a
 * `OrigemAlteracao` 2 marca a sincronização com o CRM. Sustenta a seção 3.5
 * de `docs/origem-dos-eventos-no-salesforce.md`.
 *
 *   node scripts/analise-staging/chamadores-ms-clientes.ts [--dias 30] [--limite 600]
 *
 * Somente leitura em `mrv-staging`. GUIDs viram `GUID#n` (numerados por tipo)
 * e valores com cara de dado pessoal são mascarados antes de contar.
 */

const TIPOS = [
  'cliente-insert',
  'cliente-update',
  'contato-insert',
  'contato-update',
  'endereco-insert',
  'endereco-update',
];

const dias = inteiro('dias', 30);
const limite = inteiro('limite', 600);

for (const tipo of TIPOS) {
  const registros = consultar(
    `SELECT BodyRequest__c FROM LogIntegracao__c WHERE EventType__c = '${tipo}' AND CreatedDate = LAST_N_DAYS:${dias} ORDER BY CreatedDate DESC LIMIT ${limite}`,
  );
  const vistos = new Set<string>();
  const guids = new Map<string, number>();
  const chamadores = new Map<string, number>();
  const origens = new Map<string, number>();
  const cruzamento = new Map<string, number>();
  for (const { envelope } of eventosDosLogs(registros).eventos) {
    const id = String(campo(envelope, 'id'));
    if (vistos.has(id)) continue;
    vistos.add(id);
    const data = campo(envelope, 'data');
    const usuario = campo(data, 'usuarioalteracao');
    let chamador = mascarar(usuario);
    if (typeof usuario === 'string' && GUID.test(usuario)) {
      if (!guids.has(usuario)) guids.set(usuario, guids.size);
      chamador = `GUID#${guids.get(usuario)}`;
    }
    contar(chamadores, chamador);
    contar(origens, String(campo(data, 'origemalteracao')));
    if (tipo.startsWith('cliente')) {
      contar(
        cruzamento,
        `${chamador} × SistemaOrigem=${mascarar(campo(data, 'sistemaorigem'))}`,
      );
    }
  }
  console.log(
    `\n## ${tipo}: ${vistos.size} eventos distintos (últimos ${dias} dias, até ${limite} logs)`,
  );
  console.log(`  UsuarioAlteracao: ${listar(chamadores)}`);
  console.log(`  OrigemAlteracao:  ${listar(origens)}`);
  if (cruzamento.size > 0) {
    console.log(`  chamador × SistemaOrigem: ${listar(cruzamento, 12)}`);
  }
}
