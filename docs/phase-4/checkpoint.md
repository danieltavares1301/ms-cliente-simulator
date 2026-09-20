# Checkpoint parcial da Fase 4

| Critério | Estado | Evidência |
|---|---|---|
| Fixture durável | Concluído | Migration 0004 e repository PGlite persistem `fixture_snapshot`; runs antigos continuam listáveis. |
| Setup pré-QStash | Concluído | Claim CAS recuperável, adapter idempotente e bloqueio de publicação em falha. |
| Verify e cleanup | Concluído para CORE | Dispatch terminal retoma lifecycle; política `ALWAYS` é aplicada. |
| Concorrência e recovery | Concluído | Claims com recuperação temporal impedem execução simultânea e retomam crashes. |
| Composition root | Concluído | OAuth, Safety Guard, REST client, target e adapter são lazy e compartilhados por processo. |
| Callback assíncrono | Pendente | Fora do incremento 0.4.2. |
| Objetos além de Account | Pendente | Lead, Proponente, PAC e Opportunity seguem fora do escopo. |

O checkpoint permanece parcial até a integração de callbacks e a expansão
controlada do allowlist. O caminho fake da Fase 3 e `dryRun` permanecem sem
efeitos Salesforce/QStash.
