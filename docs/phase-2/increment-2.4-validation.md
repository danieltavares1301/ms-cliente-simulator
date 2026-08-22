# Validação do incremento 2.4

## RED registrado

Em 2026-08-22, os testes do incremento foram escritos e executados antes da
implementação com:

`npm.cmd test -- src/scenarios/renderer.test.ts src/scenarios/fixture-validation.test.ts src/scenarios/catalog.test.ts src/scenarios/routes.test.ts`

O RED falhou como esperado: `src/scenarios/renderer.ts` ainda não existia,
`validateRenderedFixtures` não estava implementado e as quatro definições e
rotas ainda publicavam `CONTRACT_ONLY`. Resultado: 4 arquivos falharam, com
3 testes falhos, 10 aprovados e 1 suíte sem coleta.

## Fixtures entregues

- `match-id-cliente`: cria de forma declarativa uma Account sintética cujo
  `Id__c` é o `idcliente` do evento e verifica atualização exclusiva.
- `match-cpf-sem-id-cliente`: cria uma Account pelo CPF, sem Id Cliente, e
  verifica o carimbo do identificador sem duplicidade.
- `no-match-cliente-insert`: garante ausência pelas três chaves e espera apenas
  a Person Account criada. Sem flags do Apex, não exige Lead, Proponente ou
  callback.
- `cliente-update-nova-estrutura`: garante ausência e documenta o upsert real do
  Apex, que também cria Person Account para `cliente-update`; não promete
  estrutura assíncrona não disparada.

Cada fixture tem setup e cleanup allowlisted, um passo `CLIENTE`, outcomes
tipados e política assíncrona explícita. O renderer usa seed para valores
lógicos, `runId` para o namespace persistido, timestamps UTC e exatamente um
evento por envelope.

## GREEN e quality gates

- testes direcionados do incremento: 4 arquivos e 38 testes aprovados;
- suíte completa: 13 arquivos e 108 testes aprovados;
- `format` e `format:check`: verdes;
- `validate:scenarios`: 1 teste aprovado;
- `validate:fixtures`: 4 fixtures renderizadas, determinísticas, namespaced,
  válidas nos schemas e sem findings do scanner genérico, sem bypass por
  proveniência;
- `lint` e `typecheck`: verdes, sem warnings;
- `build`: verde, incluindo os dois validadores no `prebuild`;
- `db:generate`: executado duas vezes, sem alteração de schema ou migration;
- `db:check`: verde;
- `npm audit --audit-level=high`: exit code zero para high/critical. Permanecem
  quatro vulnerabilidades moderadas transitivas de `drizzle-kit`; a correção
  sugerida pelo npm exige downgrade incompatível e não foi aplicada.

## Endurecimento final

Sobre `bd832f6`, o renderer deixou de gerar CPF com checksum válido. A chave
contratual `numerocpf` continua presente, mas recebe um documento determinístico
de 11 dígitos, gerado em runtime e deliberadamente inválido segundo o checksum de
CPF. O scanner comum o aceita pelo formato de fixture não real, sem metadado de
origem ou bypass contextual. Se a org exigir checksum no E2E Salesforce da Fase
4, será necessário mapping de CPF de teste válido formalmente aprovado.
