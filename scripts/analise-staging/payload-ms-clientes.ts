import {
  campo,
  consultar,
  contar,
  eventosDosLogs,
  forma,
  inteiro,
  listar,
} from './lib.ts';

/**
 * Chaves do `data` dos eventos do MS Clientes e o formato dos campos que o
 * simulador trata diferente: datas, telefone (número nacional e DDI em
 * `Complemento`), tipo de contato e tipo de endereço. Sustenta a segunda
 * tabela da seção 4 de `docs/origem-dos-eventos-no-salesforce.md`.
 *
 *   node scripts/analise-staging/payload-ms-clientes.ts [--dias 30] [--limite 300]
 *
 * Somente leitura em `mrv-staging`; imprime nomes de chaves, valores de enum e
 * formatos (dígitos viram 9, letras viram x), nunca os valores.
 */

const TIPOS = ['cliente-insert', 'contato-insert', 'endereco-insert'];

const dias = inteiro('dias', 30);
const limite = inteiro('limite', 300);

for (const tipo of TIPOS) {
  const registros = consultar(
    `SELECT BodyRequest__c FROM LogIntegracao__c WHERE EventType__c = '${tipo}' AND CreatedDate = LAST_N_DAYS:${dias} ORDER BY CreatedDate DESC LIMIT ${limite}`,
  );
  const vistos = new Set<string>();
  const chaves = new Map<string, number>();
  const formatos = new Map<string, number>();
  for (const { envelope } of eventosDosLogs(registros).eventos) {
    const id = String(campo(envelope, 'id'));
    if (vistos.has(id)) continue;
    vistos.add(id);
    const data = campo(envelope, 'data');
    if (data === null || typeof data !== 'object') continue;
    for (const chave of Object.keys(data)) contar(chaves, chave);
    if (tipo === 'cliente-insert') {
      contar(formatos, `DataAlteracao=${forma(campo(data, 'dataalteracao'))}`);
      contar(
        formatos,
        `DataNascimento=${forma(campo(data, 'datanascimento'))}`,
      );
    }
    if (tipo === 'contato-insert') {
      const tipoContato = String(campo(data, 'tipocontato'));
      contar(formatos, `TipoContato=${tipoContato}`);
      if (/celular|telefone/i.test(tipoContato)) {
        contar(
          formatos,
          `telefone: Descricao=${forma(campo(data, 'descricao'))}`,
        );
        contar(
          formatos,
          `telefone: Complemento=${forma(campo(data, 'complemento'))}`,
        );
      }
    }
    if (tipo === 'endereco-insert') {
      contar(formatos, `TipoEndereco=${String(campo(data, 'tipoendereco'))}`);
    }
  }
  const lista = [...chaves]
    .map(([chave, total]) =>
      total === vistos.size ? chave : `${chave} (${total})`,
    )
    .join(', ');
  console.log(
    `\n## ${tipo}: ${vistos.size} eventos distintos (últimos ${dias} dias, até ${limite} logs)`,
  );
  console.log(
    `  chaves do data (${chaves.size}; entre parênteses, quando nem todo evento tem): ${lista}`,
  );
  console.log(`  formatos e enums: ${listar(formatos, 30)}`);
}
