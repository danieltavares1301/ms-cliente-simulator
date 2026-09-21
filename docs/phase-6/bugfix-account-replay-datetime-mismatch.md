# Bugfix: falso SETUP_CONFLICT por comparação bruta de datetime na replay de Account

## Contexto

Durante a validação end-to-end do cenário `cliente-insert-prospect-divergente`
(Fase 6, incremento 2) contra `mrv-devDan`, o run real falhou consistentemente
com `TEST_DATA_SETUP_FAILED` já no primeiro setup step (criação da Account de
controle).

## Causa raiz

Em `src/salesforce/test-data-adapter.ts`, a detecção de replay de
`CREATE_SYNTHETIC_ACCOUNT` comparava o campo `DataAlteracaoEvento__c` retornado
pela consulta SOQL com o valor declarado no fixture usando igualdade de string
bruta:

```ts
existing.DataAlteracaoEvento__c === account.dataAlteracao
```

O simulador renderiza o valor no formato `...Z` (ex.:
`2026-09-21T01:59:59.000Z`), mas o Salesforce **sempre retorna datetimes via
REST API com offset numérico** (`...+0000`), nunca com o sufixo `Z`. Como
consequência, essa comparação **nunca é verdadeira quando o registro já
existe**, mesmo que todos os demais campos coincidam perfeitamente.

Isso não quebra a criação inicial (quando nenhum registro existe ainda), mas
qualquer segunda tentativa de `setup()` para a **mesma identidade** (retry de
QStash, reentrega, ou uma nova invocação do lifecycle) encontra o registro já
criado, falha na comparação de data e lança `SETUP_CONFLICT` — um falso
positivo, já que o registro é idêntico em todo o resto.

Os 4 cenários originais (Fases 3–5) nunca expuseram esse bug porque os testes
unitários mockavam a resposta do Salesforce ecoando o **mesmo formato** que o
simulador envia (`...Z`), e nenhuma execução real anterior havia sofrido um
retry na etapa de setup até este incremento.

## Correção

Adicionado `sameInstant(a, b)` em `test-data-adapter.ts`, que compara os
valores via `Date.parse(...)` (comparando o instante, não a string), com
fallback seguro para `null`/`undefined`/valores não parseáveis. A comparação de
`DataAlteracaoEvento__c` na checagem de replay agora usa essa função.

## Evidência

- Reproduzido localmente chamando `createSalesforceTestDataAdapter(...).setup()`
  diretamente contra `mrv-devDan` (fora do Vercel) com uma sessão real: o
  primeiro `setup()` criou a Account de controle; o segundo (mesma identidade)
  reproduziu `SETUP_CONFLICT` de forma determinística.
- Teste de regressão adicionado em `test-data-adapter.test.ts`
  (`'returns REPLAY when Salesforce echoes DataAlteracaoEvento__c with a
  numeric offset instead of Z'`), mockando a resposta no formato real
  (`+0000`).
- Suíte completa: 414/414 testes passando; `npm run build` limpo.

## Escopo do impacto

Bug pré-existente, não introduzido por este incremento — afeta **qualquer**
cenário que usa `CREATE_SYNTHETIC_ACCOUNT` sempre que o setup é reexecutado
para a mesma identidade (replay legítimo). Corrigido de forma central para
beneficiar todos os cenários, não apenas o novo.
