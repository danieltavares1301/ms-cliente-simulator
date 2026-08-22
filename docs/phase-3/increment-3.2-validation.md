# Validação do incremento 3.2

## RED registrado

Em 2026-08-22, os testes foram escritos e executados antes da implementação:

```bash
npm test -- src/runs/qstash-scheduler.test.ts src/runs/dispatch.test.ts src/db/run-repository.integration.test.ts
```

O RED teve duas suítes sem coleta porque `qstash-scheduler` e `dispatch` ainda
não existiam. A integração PGlite falhou porque `claimDispatch` ainda não estava
implementado. Esse RED cobre publisher, assinatura, idempotência, concorrência e
ordem antes do GREEN.

## Fontes oficiais e pacote

- SDK oficial: <https://github.com/upstash/sdk-qstash-ts>;
- documentação QStash: <https://upstash.com/docs/qstash>;
- publicação: `Client.publishJSON` com `url`, `body`, `delay` em segundos,
  `retries` e `deduplicationId`;
- recepção: `Receiver.verify` recebe o body bruto e `Upstash-Signature`;
- QStash entrega **at least once**, portanto o claim condicional no PostgreSQL é
  a fronteira idempotente, não a quantidade de chamadas ao handler.

Foi instalado em runtime, via `npm.cmd`, `@upstash/qstash@^2.11.3`.

## Agendamento e recuperação

`QStashRunScheduler` publica somente passos `DISPATCH`, em ordem de `ordinal`,
para a URL fixa
`PUBLIC_APP_BASE_URL + /api/v1/internal/dispatches`. A request administrativa
não pode escolher o destino. O body contém exclusivamente `runId`, `stepId` e
`attemptNumber`; fixtures, PII, envelopes e tokens não são publicados.

O `delayMs` declarativo é relativo ao início lógico do cenário, ajustado por
`speed`, e convertido com `Math.ceil(delayMs / 1000)`. Delays sub-second podem
compartilhar o mesmo segundo; a ordem continua garantida pelo `ordinal` e pelo
claim no repository, que rejeita um passo enquanto qualquer anterior não estiver
`SUCCEEDED` ou `SKIPPED`.

O identificador de deduplicação é
`<runId>:<stepId>:<attemptNumber>`, com três retries controlados. Cada
`messageId` retornado é persistido no passo. Falha antes da primeira publicação
marca o run `FAILED`; falha após uma ou mais publicações marca `PARTIAL`. O
evento `RUN_SCHEDULING_FAILED` registra apenas IDs técnicos, quantidade
publicada e `recoveryRequired`. Mensagens já aceitas pelo QStash não são
canceladas nem tratadas como rollback.

## Receiver e dispatch

O endpoint interno lê `request.text()` uma vez e verifica a assinatura sobre o
body bruto antes de JSON, Zod ou banco. Assinatura ausente/inválida retorna o
mesmo `401`; o body tem limite de 16 KiB e schema strict. O endpoint não usa o
Bearer administrativo e não integra o OpenAPI público.

O claim `PENDING|SCHEDULED -> RUNNING` é um update condicional atômico. Entregas
concorrentes da mesma tentativa resultam em um executor; estados terminais
retornam `200` no-op. `RUNNING` duplicado e entrega fora de ordem retornam `409`
com `Retry-After: 1`, sem executar novamente e permitindo reentrega. O resultado
cria `delivery_attempt` e atualiza passo/run na mesma transação.

Nesta fase, `SETUP`, `VERIFY` e `CLEANUP` ficam `SKIPPED`. O único
`DispatchTarget` de produção é `FakeSalesforceDispatchTarget`: determinístico,
sem rede, retorna 200 e persiste apenas duração/status/metadados sanitizados.
Isso não é `dryRun`: `dryRun` não publica mensagem alguma. Ao concluir todos os
dispatches, o run vai para `WAITING_ASYNC` quando espera callback e para
`VERIFYING` caso contrário.

## Limitações

- nenhum Salesforce real é chamado;
- callback/verifier ainda não são executados, então `WAITING_ASYNC` pode ser
  estável;
- cancelamento e retry administrativo não foram implementados;
- recovery de `PARTIAL/FAILED` é auditável, mas sua ação administrativa fica
  para incremento futuro;
- PGlite valida concorrência e SQL PostgreSQL local, não Neon ou QStash em rede.

## GREEN e gates

- testes direcionados: 6 arquivos e 43 testes aprovados;
- suíte completa: 21 arquivos e 176 testes aprovados;
- `npm run lint`, `npm run typecheck` e `npm run format:check`: aprovados;
- `npm run build`: aprovado, incluindo a rota interna sem exigir configuração
  real ou acessar QStash/Salesforce;
- `validate:scenarios`, `validate:fixtures`, `db:generate`, `db:check` e
  `db:migrate:check`: aprovados; nenhuma migration nova foi necessária;
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades runtime;
- `npm audit --audit-level=high`: gate aprovado; permanecem quatro avisos
  moderados transitivos de tooling do `drizzle-kit`, sem high/critical.
