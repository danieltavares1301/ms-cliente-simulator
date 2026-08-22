# Validação do incremento 2.1

## RED registrado

Em 2026-08-22, os testes de contrato foram escritos antes da implementação e
executados com `npm.cmd test`. O Vitest falhou como esperado:

- `src/contracts/api-contracts.test.ts`: módulo `./index` inexistente;
- `src/openapi.test.ts`: rota `app/api/v1/openapi/route.ts` inexistente;
- resultado: 2 suites falharam, enquanto as 3 suites preexistentes e seus 30
  testes permaneceram verdes.

O RED comprova que os schemas, o documento OpenAPI e o endpoint ainda não
existiam antes da implementação.

## Limites de fidelidade

O código Apex e seus testes prevalecem sobre exemplos antigos. Por isso:

- o simulador aceita exatamente um evento por envelope, embora `EventGrid`
  percorra lotes;
- `idcliente` é obrigatório e `data.id`, quando enviado, deve ter o mesmo valor;
- `dataalteracao` permanece opcional como no Apex, mas, quando presente, usa UTC
  sem fração ou com `.000`; outras frações não são prometidas;
- contato usa somente `Email`, `Celular` ou `Telefone`, com `descricao`;
- endereço público usa `COBRANCA` e somente os campos lidos por
  `NotificacaoCliente`;
- o callback `atualizarCliente` possui apenas contrato de request/response e
  políticas; não existe parser ou handler neste incremento.

Nenhum contrato Salesforce foi alterado.

## GREEN e quality gates

Após a implementação:

- `npm.cmd run format` e `npm.cmd run format:check`: verdes;
- `npm.cmd test`: 5 arquivos e 51 testes aprovados;
- `npm.cmd run lint`: verde, sem warnings;
- `npm.cmd run typecheck`: verde;
- `npm.cmd run build`: verde; rotas `health` e `openapi` presentes;
- `npm.cmd audit --audit-level=high`: verde para high/critical; permanecem
  quatro vulnerabilidades moderadas transitivas do `drizzle-kit`, cuja correção
  automática exigiria downgrade com breaking change;
- `npm.cmd run db:generate`, executado duas vezes: nenhuma alteração de schema;
- `npm.cmd run db:check`: verde;
- probes do build de produção: `health` 200 JSON e `openapi` 200 JSON com versão
  `3.1.0`.
