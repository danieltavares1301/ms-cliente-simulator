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

## Cobertura

Os testes exercitam adapter que rejeita `transaction`, resultado persistido com
step ainda `RUNNING`, step concluído sem attempt, retry reservado, run em
cancelamento, late dispatch, falha de persistência após target, reentrega sem
repetição do target e preservação de um único attempt lógico.
