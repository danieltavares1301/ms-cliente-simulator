# Bugfix: callback assíncrono não deve limpar cedo nem travar em VERIFYING

## Contexto

O cenário `cliente-insert-prospect-divergente` foi o primeiro a exigir
`expectedCallbacks: { min: 1, max: 1 }`, expondo dois problemas encadeados no
fluxo assíncrono do simulador:

1. o dispatch limpava a massa de teste cedo demais ao receber
   `runStatus = WAITING_ASYNC`;
2. quando o callback GraphQL finalmente chegava e fazia a transição do run para
   `VERIFYING`, nada retomava a lifecycle de verificação.

## Bug A — cleanup indevido enquanto o run ainda estava em andamento

Em `src/runs/dispatch.ts`, o retorno de `repository.completeDispatch()` já traz
o `runStatus` derivado pela máquina de estados.

Antes deste ajuste, qualquer status diferente de `VERIFYING` caía no caminho de
compensação quando `run.testDataEnabled === true`. Isso incluía
`WAITING_ASYNC`, `RUNNING`, `SCHEDULED` e `PROVISIONING`, que são estados
legítimos de continuidade — não falhas terminais.

### Correção

O dispatch agora só chama `compensate()` quando o run termina esse trecho em:

- `FAILED`; ou
- `PARTIAL`.

Para `WAITING_ASYNC` (e demais estados ainda em progresso), o handler retorna
`{ accepted: true, noop: false }` e deixa o run seguir normalmente, sem tocar
na massa de teste.

### Impacto

Os cenários antigos permanecem retrocompatíveis: nesse ponto do fluxo eles já
produziam apenas `VERIFYING` ou `FAILED`, então o comportamento efetivo não
muda para eles.

## Bug B — callback promovia o run para VERIFYING, mas não retomava a lifecycle

`repository.recordGraphqlCallback()` já sabe promover
`WAITING_ASYNC -> VERIFYING` quando a contagem mínima de callbacks é atingida.
O problema era que `src/graphql/handler.ts` ignorava o `runStatus` retornado,
persistia o callback e respondia ao Salesforce sem disparar a continuação do
fluxo.

Com isso, o run ficava preso em `VERIFYING`, com `verify-1` ainda `PENDING`.

### Correção

O handler GraphQL agora:

- captura o retorno de `recordGraphqlCallback()` nos dois pontos de gravação;
- verifica se o repositório devolveu `runStatus === 'VERIFYING'`;
- exige `callback.runId` válido;
- se houver `testDataAdapter`, chama
  `createSalesforceLifecycleService(...).afterDispatch(runId)`.

Esse disparo é **best-effort**:

- roda em `try/catch`;
- não altera a resposta HTTP já construída para o Salesforce;
- apenas registra erro em `console.error` se a retomada falhar.

## Injeção de produção

`src/graphql/production.ts` agora injeta
`productionSalesforceServices.testDataAdapter`, permitindo que o callback
GraphQL de produção retome a lifecycle usando o mesmo adapter já empregado pelos
fluxos de dispatch/orquestração.

## Evidência de regressão

Foram adicionados testes cobrindo:

- `dispatch.test.ts`
  - **não** compensar quando `completeDispatch()` retorna `WAITING_ASYNC`;
  - continuar compensando para `FAILED` e `PARTIAL`.
- `handler.test.ts`
  - chamar `afterDispatch(runId)` quando o callback promove o run para
    `VERIFYING`;
  - manter a resposta HTTP do callback mesmo se `afterDispatch()` lançar erro.

## Fora de escopo

O caminho de **timeout sem callback** continua pendente:
`missingCallbackResult` ainda não agenda uma retomada automática ao atingir
`asyncWaitDeadline`.

Esse caso deve ser tratado em incremento futuro com um mecanismo explícito de
agendamento/reentrada (por exemplo, QStash disparando a checagem no deadline).
