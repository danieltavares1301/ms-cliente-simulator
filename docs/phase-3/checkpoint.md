# Checkpoint preliminar da Fase 3

| Critério | Estado | Evidência |
|---|---|---|
| Persistência e idempotência | Concluído | Repository PostgreSQL/PGlite com updates condicionais e constraints. |
| API de runs e paginação | Concluído | Criação, listagem, detalhe e steps permanecem compatíveis. |
| QStash e dispatch fake | Concluído | Scheduler/receiver oficiais; recovery da criação publica somente `PENDING` sem message ID, com claim concorrente e dedup determinístico. |
| Cancelamento administrativo | Concluído | Replay de `CANCELLING` retoma mensagens restantes, persiste progresso parcial e finaliza run/steps idempotentemente. |
| Retry administrativo | Concluído preliminar | Somente `FAILED`, tentativa incrementada e histórico preservado. |
| Máquina de estados e auditoria | Concluído preliminar | Transições puras tabeladas e metadata técnica sanitizada. |
| Callback/verifier | Pendente | Fora do incremento 3.3. |

O checkpoint é preliminar porque callback/verifier, smoke Neon/QStash autorizado
e encerramento integral da Fase 3 permanecem pendentes.

Os dois bloqueadores de recovery foram encerrados por testes RED/GREEN:
agendamento inicial parcial recuperável pela mesma POST idempotente e
cancelamento parcial/concorrente convergindo para `CANCELLED`, com auditoria
somente técnica. A janela publish-before-messageId usa dedup QStash por 10
minutos e exige reconciliação operacional se o replay ultrapassar esse prazo.
