# Checkpoint parcial da Fase 4

| Critério | Estado | Evidência |
|---|---|---|
| Fixture e modo duráveis | Concluído | Migrations 0004/0005 persistem `fixture_snapshot`, `dispatch_mode`, `test_data_enabled` e fencing UUID; runs antigos usam defaults seguros. |
| Setup pré-QStash | Concluído | Claim CAS recuperável, adapter idempotente e bloqueio de publicação em falha. |
| Verify e cleanup | Concluído para CORE | Dispatch terminal retoma lifecycle; política `ALWAYS` é aplicada. |
| Concorrência e recovery | Concluído | Claims UUID com CAS impedem completion obsoleta; compensação `ALWAYS` cobre falhas e cancelamento. |
| Composition root | Concluído | OAuth, Safety Guard, REST client, target e adapter são lazy e compartilhados por processo. |
| Callback assíncrono | Pendente | Fora do incremento 0.4.3. |
| Objetos além de Account | Pendente | Lead, Proponente, PAC e Opportunity seguem fora do escopo. |

O checkpoint permanece parcial até a integração de callbacks e a expansão
controlada do allowlist. O caminho fake da Fase 3 e `dryRun` permanecem sem
efeitos Salesforce/QStash.
