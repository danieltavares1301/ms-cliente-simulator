# Fase 4 — Lifecycle do Test Data Adapter

## Gate e persistência

O lifecycle fica desligado por padrão. Ele só é executado em runs non-dry
quando `SALESFORCE_TEST_DATA_ENABLED=true`; a configuração exige também
orchestration e dispatch Salesforce reais. Com a feature desligada, `SETUP`,
`VERIFY` e `CLEANUP` permanecem `SKIPPED` e o comportamento da Fase 3 é
preservado.

A migration `0004_misty_serpent_society.sql` adiciona
`scenario_run.fixture_snapshot jsonb` nullable. Novos runs persistem a
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

Claims `RUNNING` de lifecycle podem ser retomados após 60 segundos. Um step
`SUCCEEDED` não chama o adapter novamente. Se o processo cair depois de
`completeDispatch` e antes de verify, a reentrega terminal retoma apenas o
lifecycle pendente e não reenvia o target. Duas reentregas concorrentes
convergem por CAS; somente a vencedora acessa Salesforce. Runs `CANCELLING` ou
`CANCELLED` nunca executam setup, verify ou cleanup.

Cada transição gera auditoria `SETUP_*`, `VERIFY_*` ou `CLEANUP_*` contendo
somente status, códigos e contagens técnicas. Tokens, secrets e respostas
Salesforce brutas não são persistidos.

## Limitações

- Os quatro cenários `CORE` cobrem somente `Account`.
- O lifecycle assíncrono após callbacks ainda não está implementado; os
  cenários atuais usam `expectedCallbacks.max = 0`.
- A validação automatizada usa PGlite e doubles de Salesforce/QStash; não há
  smoke test contra a org real.
