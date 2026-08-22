# Validação do incremento 3.3

## RED registrado

Em 2026-08-22, antes da implementação:

```powershell
npm.cmd test -- src/runs/state-machine.test.ts src/runs/administration.test.ts src/runs/qstash-scheduler.test.ts
```

Resultado RED: 3 arquivos falharam. `administration.ts` e `state-machine.ts` não
existiam, e `QStashRunScheduler.cancelPending` não era função. Quatro testes
legados do scheduler passaram e um teste novo falhou.

## Contratos e estados

- `POST /api/v1/runs/{runId}/cancellations`: admin Bearer + feature gate; corpo
  vazio ou strict `reasonCode` técnico; retorna `202`, ou `200` no replay
  `CANCELLED`.
- `POST /api/v1/runs/{runId}/retries`: mesma proteção; corpo vazio ou
  `stepKeys` únicos/allowlisted; retorna `202`; sem elegíveis retorna `409`.
- ambos documentam `401/404/409/422/503` no OpenAPI.

As tabelas puras `runTransitions` e `stepTransitions` centralizam todas as
transições. `FAILED|PARTIAL -> SCHEDULED|RUNNING` permite recovery; apenas step
`FAILED -> PENDING|SCHEDULED` permite retry. `CANCELLED` não reabre. Dispatch
atrasado durante/depois do cancelamento é no-op; um step já `RUNNING` pode
concluir, mas o update do run exclui `CANCELLING/CANCELLED`.

## QStash, persistência e concorrência

Cancelamento chama a API oficial
`client.messages.cancel(messageId|string[])`; não usa `delete`. Somente
`PENDING|SCHEDULED` com `qstashMessageId` entra na chamada. Falha mantém o run
`CANCELLING` e grava `RUN_CANCELLATION_FAILED` com código técnico.

Fontes oficiais:

- <https://upstash.com/docs/qstash/sdks/ts/examples/messages>
- <https://upstash.com/docs/qstash/api-reference/messages/cancel-a-message>

O begin cancel é `UPDATE ... WHERE status IN (...)`; só um concorrente vence.
Retry seleciona apenas dispatches `FAILED`, reserva por update condicional,
insere marcador único `(step_id, attempt_number)` e publica dedup
`runId:stepId:attemptNumber`. Tentativas antigas são preservadas.

`neon-http` não possui transação interativa: begin/finalize e reserva/publicação
são fases recuperáveis. Constraints, conditional updates e deduplicação QStash
impedem duplicação. Falha após reserva devolve os steps ainda não executados a
`FAILED`, preserva o marcador da tentativa e registra erro técnico, permitindo
novo recovery; não há promessa de rollback distribuído. PGlite cobre a semântica
PostgreSQL, não uma corrida real Neon/QStash.

Auditoria usa actor técnico, action, resource e metadata sanitizada
(`reasonCode`, `count`, `status`, `errorCode`). Token, payload e texto de exceção
do provedor não são persistidos.

## Limitações

- sem Salesforce real, callback ou verifier;
- sem chamada QStash de rede nos testes; clients são fakes;
- `CANCELLING` após falha exige replay/recuperação operacional;
- retry é elegível somente para `FAILED` em run `FAILED|PARTIAL`;
- PGlite não substitui smoke test Neon/QStash autorizado.

## Gates

- RED: 3 arquivos falharam; módulos/abstração ainda ausentes.
- direcionados do incremento: aprovados;
- suíte completa: 23 arquivos e 199 testes aprovados;
- `lint`, `typecheck` e `format:check`: aprovados;
- build Next.js: aprovado com as duas novas rotas;
- `validate:scenarios`, `validate:fixtures`, `db:generate`, `db:check` e
  `db:migrate:check`: aprovados; nenhuma migration nova;
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades;
- `npm audit --audit-level=high`: aprovado; quatro avisos moderados transitivos
  do tooling `drizzle-kit`, sem high/critical.
