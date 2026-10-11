import { argumento, consultar } from './lib.ts';

/**
 * Confere, no código implantado, se o sync de contatos da PAC compara a data
 * da PAC com os marcadores de contato da Account, a comparação afetada pelos
 * relógios diferentes (seção 6.4 de `docs/origem-dos-eventos-no-salesforce.md`).
 *
 *   node scripts/analise-staging/classes-implantadas.ts [--org mrv-staging|mrv-devDan]
 *
 * Somente leitura: lê o corpo das classes pela Tooling API e imprime só se
 * cada padrão aparece.
 */

const org = argumento('org', 'mrv-staging');

const PADROES: Array<[string, RegExp]> = [
  [
    'tem sincronizarContatosAprovadosPac',
    /sincronizarContatosAprovadosPac\s*\(/,
  ],
  [
    'compara a data da PAC com o marcador de contato',
    /dataAlteracaoPAC\s*>=\s*acc\.DataAlteracaoEventoContato/,
  ],
  [
    'passa DataAlteracaoEvento__c da PAC para o sync',
    /sincronizarContatos(?:AprovadosPac|Contestacao)\s*\([^;]*DataAlteracaoEvento__c/,
  ],
  [
    'soma 3h à data da PAC sem fuso (horário de Brasília)',
    /override\s+DateTime\s+parseDateTime[\s\S]*?addHours\(\s*3\s*\)/,
  ],
];

const classes = consultar(
  `SELECT Name, LastModifiedDate, Body FROM ApexClass WHERE Name IN ('ClienteService', 'NotificacaoPAC')`,
  { org, tooling: true },
);

for (const classe of classes) {
  const corpo = String(classe.Body ?? '');
  const achados = PADROES.map(
    ([descricao, padrao]) =>
      `${descricao}: ${padrao.test(corpo) ? 'sim' : 'não'}`,
  );
  console.log(
    `${org} ${String(classe.Name)} (alterada em ${String(classe.LastModifiedDate)})`,
  );
  for (const achado of achados) console.log(`  ${achado}`);
}
