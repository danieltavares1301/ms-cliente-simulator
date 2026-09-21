# Bugfix: cenários com múltiplas instruções de setup/cleanup travavam para sempre

## Contexto

Após corrigir os dois bugs anteriores (replay de Account com datetime e
`leadLookupKeysForSetup` por índice fixo), o run real de
`cliente-insert-prospect-divergente` deixou de falhar, mas também nunca
progredia: ficava com `status: "SCHEDULED"` indefinidamente, com o step de
dispatch preso em `SCHEDULED`/`attemptCount: 0` por vários minutos.

## Causa raiz

`deriveSteps` (`src/runs/orchestration.ts`) criava **uma linha de step por
instrução** de `fixture.setup` e de `fixture.cleanup` (`setup-1`, `setup-2`,
`setup-3`, `cleanup-1`, `cleanup-2`, ...), todas com o mesmo `stepKind`
(`'SETUP'` ou `'CLEANUP'`).

Só que `claimLifecycleStep` (`src/db/drizzle-run-repository.ts`) sempre
reivindica **apenas a linha de menor `ordinal`** para um dado `stepKind`
(`ORDER BY ordinal ASC LIMIT 1`). Como `dependencies.adapter.setup()` e
`dependencies.adapter.cleanup()` processam **todo o array de instruções em uma
única chamada atômica**, apenas a primeira linha (`setup-1`) é reivindicada e
concluída; as demais (`setup-2`, `setup-3`, ...) permanecem `PENDING` para
sempre.

O step de `DISPATCH` só pode ser reivindicado (`claimDispatch`) quando **todos
os steps de ordinal menor** estão `SUCCEEDED`/`SKIPPED` (guarda
`OUT_OF_ORDER`). Com `setup-2`/`setup-3` presos em `PENDING`, o dispatch é
bloqueado permanentemente — a run nunca sai de `SCHEDULED`, mesmo com o QStash
reentregando a mensagem indefinidamente (sempre recebendo `409
DISPATCH_OUT_OF_ORDER`).

Os 4 cenários originais nunca expuseram esse bug porque cada um tinha **no
máximo uma** instrução de setup e uma de cleanup — a suposição implícita de
"uma instrução = um step" nunca foi violada até `cliente-insert-prospect-
divergente` (3 instruções de setup, 2 de cleanup).

## Correção

`deriveSteps` agora cria **exatamente uma linha de step** para toda a fase de
setup e **exatamente uma linha** para toda a fase de cleanup, independentemente
de quantas instruções o fixture declara — refletindo fielmente o modelo de
execução real (uma chamada atômica ao adapter). O campo `requestRedacted`
passou a listar todas as operações agregadas (`operations: [...]`) em vez de
uma única `operation`, preservando observabilidade sem recriar o bug.

Nenhuma mudança foi necessária no adapter, no repositório ou na camada de
lifecycle — o fix é inteiramente local a `deriveSteps`.

## Evidência

- Reproduzido ao vivo contra `mrv-devDan`: a run ficou presa em `SCHEDULED`
  por mais de 5 minutos antes da correção; após o fix e um novo deploy, a run
  avançou imediatamente para `DISPATCH`/`VERIFY`/`CLEANUP`.
- Teste de regressão adicionado em `orchestration.test.ts`
  (`'derives exactly one SETUP and one CLEANUP step regardless of how many
  setup/cleanup instructions the fixture declares'`), usando o cenário real
  `cliente-insert-prospect-divergente` (3 instruções de setup, 2 de cleanup) e
  confirmando que exatamente 1 step de cada kind é persistido.
- Suíte completa: 416/416 testes passando; `npm run build` limpo.

## Escopo do impacto

Bug pré-existente desde a introdução do array de setup/cleanup com múltiplas
instruções (contrato já preparado desde antes, mas nunca exercitado por um
cenário real com mais de uma instrução por fase). Corrigido de forma central
para beneficiar todo cenário futuro com múltiplas instruções de setup/cleanup,
não apenas o novo.
