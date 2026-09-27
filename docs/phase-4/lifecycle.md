# Fase 4 — Lifecycle do Test Data Adapter

## Gate e persistência

O lifecycle fica desligado por padrão. Ele só é executado em runs non-dry
quando `SALESFORCE_TEST_DATA_ENABLED=true`; a configuração exige também
orchestration e dispatch Salesforce reais. Com a feature desligada, `SETUP`,
`VERIFY` e `CLEANUP` permanecem `SKIPPED` e o comportamento da Fase 3 é
preservado.

A migration `0004_misty_serpent_society.sql` adiciona
`scenario_run.fixture_snapshot jsonb` nullable. A migration incremental
`0005_clumsy_cammi.sql` adiciona `dispatch_mode`, `test_data_enabled` e
`scenario_run_step.lifecycle_claim_id`. Novos runs persistem a
`RenderedScenarioFixture` completa. A coluna nullable mantém leitura de runs
antigos; ao tentar executar lifecycle sem snapshot, o run falha fechado e o
erro técnico `FIXTURE_SNAPSHOT_MISSING` é auditado. Responses públicas não
incluem o snapshot nem o `event_envelope`.

## Sequência

1. A criação adquire a lease de scheduling e faz claim CAS de `SETUP`.
2. O adapter executa setup antes de qualquer publicação QStash.
3. Setup bem-sucedido libera o scheduler; falha marca step e run como `FAILED`
   e publica zero mensagens.
4. O último dispatch bem-sucedido move o run para `VERIFYING`.
5. `VERIFY` é adquirido por CAS. Resultado negativo marca o step `FAILED`.
6. Para a política atual `ALWAYS`, `CLEANUP` executa mesmo após verify negativo.
7. A finalização deriva `SUCCEEDED`, `FAILED` ou `PARTIAL` dos steps duráveis.

| Dispatch | Verify | Cleanup | Run final |
|---|---|---|---|
| sucesso | sucesso | sucesso | `SUCCEEDED` |
| sucesso | falha | sucesso | `FAILED` |
| sucesso | sucesso/falha | falha | `PARTIAL` |

## Recovery e concorrência

Claims `RUNNING` de lifecycle podem ser retomados após 60 segundos e recebem
um UUID novo a cada aquisição. A conclusão usa CAS com esse UUID e com o
estado não terminal do run; um worker expirado não pode concluir o claim do
sucessor. Requests Salesforce abortam após 30 segundos e não seguem redirects.
`STALE` representa perda de ownership e nunca dispara cleanup destrutivo: os
IDs retornados por `CREATED` ou `REPLAY` são persistidos somente pelo worker
que vence o fencing e permanecem disponíveis para o cleanup terminal. Um step
`SUCCEEDED` não chama o adapter novamente. Se o processo cair depois de
`completeDispatch` e antes de verify, a reentrega terminal retoma apenas o
lifecycle pendente e não reenvia o target. Duas reentregas concorrentes
convergem por CAS; somente a vencedora acessa Salesforce.

Cancelamento é distinto de `STALE`. Ao concluir durante `CANCELLING` ou
`CANCELLED`, o repository confirma por CAS que o UUID ainda é o claim
persistido, grava os IDs retornados e somente então responde `CANCELLED`.
Assim, apenas o worker ainda proprietário pode compensar imediatamente; um
worker expirado retorna `STALE`. O serviço de cancelamento continua responsável
pelo cleanup dos IDs duráveis e o cleanup terminal permanece idempotente.

`dispatch_mode` e `test_data_enabled` são snapshots da criação. Flags atuais
atuam somente como kill switches: desligá-las retorna `503` recuperável sem
trocar Salesforce por fake nem pular lifecycle.

Cada transição gera auditoria `SETUP_*`, `VERIFY_*` ou `CLEANUP_*` contendo
somente status, códigos e contagens técnicas. Tokens, secrets e respostas
Salesforce brutas não são persistidos.

## Correções de recuperação (2026-09-27)

Uma revisão reproduziu, com PGlite e doubles, falhas que deixavam registros
órfãos na org ou runs presos. Cada uma tem teste de regressão, a maioria em
`src/db/run-recovery.integration.test.ts`. A reentrega do dispatch está em
`src/runs/dispatch.test.ts`, e o kill switch em `src/graphql/handler.test.ts`.

- **Cleanup que falha é retentado.** Antes, a reentrega depois do
  `503 LIFECYCLE_CLEANUP_FAILED` respondia `noop`. O recálculo pelos steps de
  dispatch ainda rebaixava o run de `PARTIAL` para `FAILED`, e `FAILED` não é
  cancelável, então a massa ficava sem caminho de recuperação. Agora
  `completeDispatch` não recalcula `FAILED`/`PARTIAL` de run com massa de
  teste, e a reentrega repete a compensação enquanto o cleanup não passar.
  Isso também cobre um crash entre concluir o dispatch e compensar.
- **Retry de run com massa de teste é recusado** (`409 RETRY_NOT_SUPPORTED`).
  O retry reenviava só os steps `FAILED` contra uma massa já apagada, e o
  `CLEANUP`, já concluído, não apagava o que o `VERIFY` achava depois.
- **Setup parcial é compensado.** Uma instrução que falha depois de outras
  terem criado registros lança `SalesforceTestDataPartialSetupError` com
  esses IDs, que ficam no step `SETUP` e entram na compensação. Antes, o
  cleanup recebia lista vazia.
- **`VERIFY` concluído depois do cancelamento limpa o que achou,** como o
  `SETUP` já fazia.
- **A compensação descobre registros criados pelo Apex.** Ela roda a mesma
  consulta do `VERIFY`, que só encontra registros com os identificadores do
  run (derivados do `runId`), e o cleanup continua conferindo a propriedade
  de cada ID. Antes, uma falha de dispatch ou um cancelamento anterior ao
  `VERIFY` deixava para trás os Leads e Accounts criados pelo Apex. A
  descoberta é o melhor esforço: se a consulta falhar, segue com os IDs já
  conhecidos.
- **O kill switch vale no callback GraphQL.** Com
  `SALESFORCE_TEST_DATA_ENABLED` desligada, a retomada pelo callback não roda
  para runs com massa de teste, e o run fica em `VERIFYING` com a massa
  intacta. Antes, verify e cleanup falhavam e o run terminava `PARTIAL` com a
  massa na org.

## Limitações

- Os quatro cenários `CORE` cobrem somente `Account`.
- O lifecycle assíncrono após callbacks ainda não está implementado; os
  cenários atuais usam `expectedCallbacks.max = 0`.
- Se Salesforce confirmar DML mas a conexão cair antes da resposta, existe
  uma janela residual inevitável até a próxima compensação. Perda de fencing
  não autoriza apagar IDs; cancelamento explícito compensa apenas o claim
  corrente e o fluxo terminal usa os IDs persistidos pelo vencedor.
- A validação automatizada usa PGlite e doubles de Salesforce/QStash; não há
  smoke test contra a org real.
