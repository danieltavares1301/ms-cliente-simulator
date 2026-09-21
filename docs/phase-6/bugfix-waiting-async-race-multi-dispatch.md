# Bugfix: run preso em WAITING_ASYNC quando o callback chega antes do último dispatch terminar

## Contexto

Ao validar de ponta a ponta o cenário `contato-antes-cliente-colisao` (3 steps
de DISPATCH: `cliente-insert`, `contato-email`, `contato-celular`, com
`asyncPolicy.expectedCallbacks: {min:1, max:1}`) via API pública do simulador
contra `mrv-devDan`, o run ficou preso em `WAITING_ASYNC` indefinidamente,
mesmo com todos os 3 steps de DISPATCH concluídos com sucesso.

Consulta direta ao Neon confirmou que o callback GraphQL **chegou e foi
corretamente correlacionado** ao run certo (`policy: SUCCESS_200`, dentro do
`asyncWaitDeadline`), mas nenhum evento de auditoria
`GRAPHQL_CALLBACK_THRESHOLD_REACHED` foi registrado — ou seja, o callback foi
persistido, mas nunca usado para promover o run de `WAITING_ASYNC` para
`VERIFYING`.

## Causa raiz

`recordGraphqlCallback` (`src/db/drizzle-run-repository.ts`) só promove
`WAITING_ASYNC -> VERIFYING` quando o run **já está** em `WAITING_ASYNC` no
exato momento em que o callback chega:

```ts
if (
  currentRun.status === 'WAITING_ASYNC' &&
  currentRun.expectedCallbackMin > 0 &&
  withinDeadline
) { ... }
```

Só que `deriveDispatchRunStatus` só retorna `WAITING_ASYNC` quando **todos**
os steps de DISPATCH atingem um status terminal
(`allTerminal`). Com múltiplos steps de dispatch escalonados por `delayMs`
(neste cenário: `0ms`, `3_000ms`, `5_000ms`), o `insertLeadQueueable`
disparado pelo primeiro dispatch (`cliente-insert`) pode enviar o callback
GraphQL **antes** do último dispatch (`contato-celular`, agendado para +5s)
sequer começar a ser processado — ou seja, antes do run alcançar
`WAITING_ASYNC`. Nesse momento o run ainda está `RUNNING`, a condição acima é
falsa, e o callback é simplesmente persistido sem qualquer efeito.

Quando o run finalmente completa o último dispatch e transiciona para
`WAITING_ASYNC` (via `completeDispatch`), **nada reavalia** se já havia
callbacks suficientes registrados anteriormente — a única reavaliação
acontece reativamente, quando um **novo** callback chega. Como não há mais
nenhum callback esperado (`min=1, max=1` já satisfeito), o run nunca mais é
reavaliado e fica preso para sempre.

Este bug é distinto e mais sutil que os anteriores desta fase: não é uma
condição de contrato/validação, mas uma corrida real entre a chegada
assíncrona do callback (tempo de execução do Apex) e a conclusão de todos os
dispatches HTTP síncronos escalonados pelo simulador.

## Correção

Extraída a lógica de "promover `WAITING_ASYNC -> VERIFYING` se já houver
`expectedCallbackMin` callbacks persistidos" para um método privado
compartilhado, `promoteWaitingAsyncIfCallbacksAlreadyMet`. Esse método agora é
chamado em dois pontos:

1. `recordGraphqlCallback` — quando um callback chega e o run **já está**
   `WAITING_ASYNC` (fluxo original, inalterado em comportamento).
2. `completeDispatch` — logo depois que a atualização de status do run
   resulta em `WAITING_ASYNC` (fluxo novo), fechando a corrida descrita acima.

A contagem de callbacks já persistidos usa a mesma tabela e filtro por `runId`
que o fluxo original, e também respeita `asyncWaitDeadline`: um callback
persistido após o prazo não conta para o `expectedCallbackMin`, mantendo a
mesma semântica de deadline usada por `recordGraphqlCallback` — evitando uma
assimetria entre os dois caminhos de promoção.

## Evidência

- Reproduzido com um teste de integração real (PGlite, migrações reais) que
  cria um run com 2 steps de DISPATCH e `expectedCallbackMin: 1`, insere o
  callback GraphQL **entre** a conclusão do primeiro e do segundo dispatch
  (run ainda `RUNNING` no momento do callback) e confirma que, ao completar o
  segundo dispatch, o run vai diretamente para `VERIFYING` (não fica preso em
  `WAITING_ASYNC`).
- Segundo teste de regressão cobre o caso do callback chegar **após** o
  `asyncWaitDeadline`: confirma que o run permanece em `WAITING_ASYNC` (não é
  promovido), preservando a mesma semântica de deadline do fluxo original.
- Suíte completa: 439/439 testes passando (`run-repository.integration.test.ts`
  isolado: 48/48); `npm run build` limpo.
- Cenário original que expôs o bug (`contato-antes-cliente-colisao`) validado
  novamente ao vivo contra `mrv-devDan` após o fix, via API pública
  (`POST /api/v1/runs`, run real).

## Escopo do impacto

Afeta qualquer cenário com **mais de um step de DISPATCH** e
`asyncPolicy.expectedCallbacks.min > 0` cujo callback assíncrono possa chegar
antes de todos os dispatches concluírem — um padrão inédito até este
incremento (os únicos dois cenários anteriores com callback esperado tinham
exatamente 1 step de DISPATCH). Corrigido de forma central para beneficiar
qualquer cenário futuro com múltiplos dispatches + callback assíncrono.
