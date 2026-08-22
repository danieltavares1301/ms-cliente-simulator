# Checkpoint preliminar da Fase 3

| Critério | Estado | Evidência |
|---|---|---|
| Persistência e idempotência | Concluído | Repository PostgreSQL/PGlite com updates condicionais e constraints. |
| API de runs e paginação | Concluído | Criação, listagem, detalhe e steps permanecem compatíveis. |
| QStash e dispatch fake | Concluído | Scheduler/receiver oficiais; target determinístico sem rede Salesforce. |
| Cancelamento administrativo | Concluído preliminar | Cancel pending via `messages.cancel`, replay e falha auditável. |
| Retry administrativo | Concluído preliminar | Somente `FAILED`, tentativa incrementada e histórico preservado. |
| Máquina de estados e auditoria | Concluído preliminar | Transições puras tabeladas e metadata técnica sanitizada. |
| Callback/verifier | Pendente | Fora do incremento 3.3. |

O checkpoint é preliminar porque callback/verifier, smoke Neon/QStash autorizado
e encerramento integral da Fase 3 permanecem pendentes.
