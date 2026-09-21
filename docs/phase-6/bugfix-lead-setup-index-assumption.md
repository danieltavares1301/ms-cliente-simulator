# Bugfix: leadLookupKeysForSetup ignorava a instrução de setup em processamento

## Contexto

Após corrigir o falso `SETUP_CONFLICT` (ver
`bugfix-account-replay-datetime-mismatch.md`), o run real de
`cliente-insert-prospect-divergente` voltou a falhar com `TEST_DATA_SETUP_FAILED`,
desta vez logo após a criação bem-sucedida da Account de controle.

## Causa raiz

`leadLookupKeysForSetup(fixture)` e `leadLookupQueryForSetup(fixture)` em
`src/salesforce/test-data-adapter.ts` sempre liam `fixture.setup[0]` — a
**primeira** instrução do array de setup — assumindo implicitamente que a
instrução relacionada a Lead (`CREATE_SYNTHETIC_LEAD` ou `ENSURE_LEAD_ABSENT`)
sempre ocupa essa posição. Essa suposição era válida para todos os cenários
anteriores (cada um com no máximo uma instrução de setup relacionada a Lead,
sempre no índice 0), mas quebra em `cliente-insert-prospect-divergente`, cujo
setup tem 3 instruções: `CREATE_SYNTHETIC_ACCOUNT` (CONTROL) no índice 0,
`ENSURE_ACCOUNT_ABSENT` no índice 1 e `ENSURE_LEAD_ABSENT` no índice 2.

Ao processar a instrução `ENSURE_LEAD_ABSENT` (índice 2) no laço principal de
`setup()`, o código chamava `leadLookupQueryForSetup(fixture)`, que internamente
voltava a ler `fixture.setup[0]` (a instrução de Account) em vez da instrução
`ENSURE_LEAD_ABSENT` atual. Como essa instrução de Account não tem os campos
`lead`/`keys` esperados, a função caía no `throw new
SalesforceTestDataAdapterError('INVALID_FIXTURE')` — abortando o `setup()`
inteiro.

## Correção

`leadLookupKeysForSetup` e `leadLookupQueryForSetup` agora recebem a instrução
de setup relevante como parâmetro explícito (o `instruction` já disponível no
laço `for (const instruction of fixture.setup)`), em vez de re-derivá-la a
partir de `fixture.setup[0]`. Isso elimina a dependência de posição no array.

## Evidência

- Reproduzido localmente chamando `adapter.setup()` com o fixture real
  renderizado do cenário: falhava com `INVALID_FIXTURE` antes da correção.
- Teste de regressão adicionado
  (`'resolves the ENSURE_LEAD_ABSENT keys from its own setup instruction, not
  from setup[0]'`), que roda `setup()` com as 3 instruções do fixture real do
  cenário e confirma que a query de ausência de Lead usa as chaves corretas
  (`idExterno`/`cpf` da própria instrução `ENSURE_LEAD_ABSENT`).
- Suíte completa: 416/416 testes passando; `npm run build` limpo.

## Escopo do impacto

Bug pré-existente desde a introdução do suporte a Lead no Test Data Adapter;
não é específico deste incremento, mas só se manifesta quando a instrução de
Lead não é a primeira do array de setup — cenário até então inédito.
