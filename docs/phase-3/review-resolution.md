# Resolução dos bloqueantes da revisão da Fase 3

## Persistência compatível com Neon HTTP

O repository de runtime não usa mais transações interativas. A conclusão de um
dispatch é uma sequência recuperável de operações condicionais:

1. valida o step `DISPATCH`, a tentativa esperada e o estado `RUNNING` (ou um
   estado terminal que precise de reconciliação);
2. grava `delivery_attempt` por `(step_id, attempt_number)`, preenchendo apenas
   reservas de retry ainda sem resultado e preservando um resultado já
   persistido;
3. conclui condicionalmente somente o step `RUNNING` da tentativa esperada;
4. deriva o estado do run dos steps persistidos e o atualiza com compare-and-set,
   sem alterar `CANCELLING` ou `CANCELLED`.

Se a sequência parar após a tentativa ou após o step, a reentrega usa o estado
durável para terminar a reconciliação. Uma tentativa sem resultado só pode ser
reclamada após o lease curto; isso evita `ALREADY_RUNNING` permanente. Falhas de
claim/reconciliação ou de persistência após o target retornam
`DISPATCH_PERSISTENCE_FAILED` (503, retriable). Falha do target permanece
`DISPATCH_TARGET_FAILED` e não inclui uma segunda chamada ao target na mesma
entrega.

## Limite de idempotência do efeito externo

As constraints e operações condicionais impedem duplicação lógica de attempts e
transições no simulador. Ainda existe uma janela inevitável se o efeito externo
for aceito e a primeira gravação do resultado falhar: uma reentrega sem evidência
durável pode repetir o efeito. O target fake determinístico e sem rede torna essa
janela segura na Fase 3. A integração Salesforce real da Fase 4 deverá enviar uma
idempotency key/correlation estável e exigir deduplicação no destino.

## Recovery de agendamento inicial

O replay da mesma `POST /runs`, com a mesma chave e fingerprint, recupera runs
`FAILED`, `PARTIAL` ou `SCHEDULED` que ainda tenham dispatches `PENDING` sem
`qstashMessageId`. Um compare-and-set do run para `PROVISIONING` concede uma
única reserva de agendamento; replays concorrentes apenas observam a reserva.
Somente os steps `PENDING` sem message ID são publicados. Steps que já tenham
message ID ou estejam `SCHEDULED`, `RUNNING` ou em estado terminal nunca são
republicados. IDs persistidos antes de uma falha parcial são preservados.

O recovery grava `RUN_SCHEDULING_RECOVERY_STARTED` apenas com status anterior e
quantidade pendente, sem payload. Após a última publicação, o run volta a
`SCHEDULED`; uma entrega que já tenha avançado o run para `RUNNING` não é
rebaixada.

Existe uma janela entre o aceite de `publishJSON` e a persistência do message
ID. Nessa janela, a falha deixa o run recuperável e o replay usa o mesmo
`deduplicationId` (`runId:stepId:attemptNumber`). A deduplicação do QStash dura
10 minutos: o procedimento de resolução é repetir imediatamente a mesma POST.
Se a indisponibilidade ultrapassar essa janela, deve-se reconciliar a mensagem
no QStash antes do replay; sem essa reconciliação permanece o risco residual de
uma segunda entrega, que continua protegida pela idempotência do dispatch.

## Recovery de cancelamento

Um replay enquanto o run está `CANCELLING` não retorna mais cedo: ele relê os
steps ainda `PENDING`/`SCHEDULED`, tenta cancelar somente seus message IDs e
finaliza os steps restantes e o run como `CANCELLED`. O adapter cancela cada
mensagem separadamente e trata repetição como operação idempotente. Sucessos
parciais são persistidos imediatamente; assim, o replay seguinte tenta somente
as mensagens restantes quando há evidência durável.

Replays concorrentes podem repetir um cancel no provedor, mas updates
condicionais tornam o progresso e a finalização idempotentes. Falhas parciais
geram `RUN_CANCELLATION_PROGRESS` e `RUN_CANCELLATION_FAILED` somente com
contagens e código técnico. Dispatch tardio de step já cancelado permanece
no-op, e a finalização não reabre `CANCELLED`.

## Cobertura

Os testes exercitam adapter que rejeita `transaction`, resultado persistido com
step ainda `RUNNING`, step concluído sem attempt, retry reservado, run em
cancelamento, late dispatch, falha de persistência após target, reentrega sem
repetição do target e preservação de um único attempt lógico. Também cobrem
falha/replay do agendamento inicial, publicação parcial, claim concorrente sem
duplicação, cancelamento parcial, dois replays concorrentes, auditoria sanitizada
e convergência de run/steps para `CANCELLED`.
