# Fase 6 ? falhas GraphQL e echo de prospect

## Objetivo

Concluir os quatro cen?rios pendentes da Tarefa 6.3 / se??o 11.5 do plano:

- `graphql-erro-500`
- `graphql-resposta-invalida`
- `graphql-timeout`
- `id-prospect-igual-id-cliente`

O princ?pio seguido aqui foi o mesmo dos incrementos O01/O03/O08/O10: n?o
assumir o resultado do run nem o efeito do callback por leitura est?tica. O
cat?logo foi implementado localmente, os eventos de neg?cio foram executados de
verdade em `mrv-devDan` e os resultados observados foram registrados como
conhecimento adquirido ? inclusive quando divergiram da hip?tese original do
plano.

## Estrat?gia de valida??o real adotada

Sem `git push` e sem deploy, a valida??o combinou duas camadas:

1. **Salesforce real (`mrv-devDan`)** para `setup` ? dispatch em
   `/services/apexrest/Cliente` ? espera do DML ass?ncrono ? verifica??o do
   estado final de Account/Lead ? cleanup.
2. **Orquestra??o local da branch** (reposit?rio PGlite ef?mero) para medir o
   estado do run, a persist?ncia do `graphql_callback` e a rea??o do simulador
   ?s pol?ticas `HTTP_500`, `INVALID_JSON_200` e `DELAYED_RESPONSE`.

Como deploy/redirect da Named Credential ficaram explicitamente fora de escopo,
os tr?s cen?rios GraphQL o callback foi **reinjetado localmente** no handler
`/api/ms-clientes/graphql` usando os identificadores reais observados na org
(`Id Cliente` + `IdProspectSalesforce__c` final de Y). Isso preservou o trecho
importante da valida??o: o DML e a cria??o do Lead aconteceram em
`mrv-devDan`, enquanto a contagem de callback e o status final do run foram
medidos pela implementa??o nova desta branch.

## Wiring adotado para a pol?tica GraphQL por cen?rio

Foi adicionada uma configura??o opcional aditiva no contrato interno do
cat?logo:

```ts
graphqlResponse?: {
  policy: GraphqlResponsePolicy;
  delayMs?: number;
}
```

Decis?o de design:

- a defini??o do cen?rio declara a inten??o de resposta do callback;
- o renderer copia isso para `fixture.graphqlResponse`;
- `createRun()` propaga para `run.variablesRedacted.graphqlResponsePolicy` e
  `run.variablesRedacted.graphqlResponseDelayMs`;
- cen?rios sem essa configura??o continuam persistindo apenas
  `variablesRedacted: { keys: [...] }`, preservando retrocompatibilidade total.

Essa escolha fecha a lacuna j? sugerida por `src/graphql/correlation.ts` e pelos
testes de `src/graphql/handler.test.ts`, sem abrir payload bruto nem informa??o
sens?vel adicional no run.

## Decis?o de timeout (`DELAYED_RESPONSE`)

O plano original falava em ?12 segundos do Apex?, mas o projeto n?o tinha
`maxDuration` expl?cito na rota GraphQL e ainda limitava o atraso simulado a
`4_000ms`. A decis?o implementada foi:

- `MAX_DELAYED_RESPONSE_MS = 8_000`;
- `export const maxDuration = 15;` em `app/api/ms-clientes/graphql/route.ts`.

Motivo:

- **8s** continua representando um callback materialmente atrasado;
- evita depender literalmente de 12s num runtime serverless sem margem;
- **15s** d? folga suficiente para o handler concluir o delay e ainda responder
  sem flertar com timeout do host.

Portanto, `graphql-timeout` deve ser lido como **aproxima??o consciente do
conceito de timeout** do fluxo Apex/orquestra??o, n?o como reprodu??o literal do
limite de 12s.

## Resultados observados em `mrv-devDan`

### Resumo executivo

| Cen?rio | Dispatch real para Apex | Callback persistido | Estado de neg?cio antes do cleanup | Status final do run |
| --- | --- | --- | --- | --- |
| `graphql-erro-500` | `HTTP 200` | `policy=HTTP_500`, `http_status=500` | `1` Account Y, `1` Lead por CPF, Account X intacta | `SUCCEEDED` |
| `graphql-resposta-invalida` | `HTTP 200` | `policy=INVALID_JSON_200`, `http_status=200`, body `{"data":` | `1` Account Y, `1` Lead por CPF, Account X intacta | `SUCCEEDED` |
| `graphql-timeout` | `HTTP 200` | `policy=DELAYED_RESPONSE`, `http_status=200` | `1` Account Y, `1` Lead por CPF, Account X intacta | `SUCCEEDED` |
| `id-prospect-igual-id-cliente` | `HTTP 200` | n?o aplic?vel | `1` Account criada, `IdProspectSalesforce__c = null`, `0` Lead por CPF | `SUCCEEDED` |

### `graphql-erro-500`

Observado na execu??o real:

- o dispatch do `cliente-insert` retornou `HTTP 200`;
- antes do cleanup, o adapter confirmou todos os checks de neg?cio do perfil
  `cliente-insert-prospect-divergente`;
- a Account Y existia por `Id Cliente`;
- o Lead novo do CPF de Y j? existia;
- a Account X de controle permaneceu intacta;
- o callback foi persistido no banco local da execu??o com
  `policy = HTTP_500` e `http_status = 500`;
- o status final do run foi **`SUCCEEDED`**.

### `graphql-resposta-invalida`

Observado na execu??o real:

- o dispatch tamb?m retornou `HTTP 200`;
- a estrutura Y e o Lead novo j? estavam ?ntegros antes do cleanup;
- o callback foi persistido com `policy = INVALID_JSON_200`;
- o body retornado pelo handler ficou literalmente truncado como `{"data":`;
- ainda assim o run terminou **`SUCCEEDED`**.

### `graphql-timeout`

Observado na execu??o real:

- o dispatch retornou `HTTP 200`;
- os checks de neg?cio passaram antes do callback;
- o handler atrasou a resposta com `DELAYED_RESPONSE` dentro do teto de `8s`;
- o callback foi persistido com `policy = DELAYED_RESPONSE`;
- o run terminou **`SUCCEEDED`**.

### `id-prospect-igual-id-cliente`

Observado na execu??o real:

- o dispatch retornou `HTTP 200`;
- a Person Account foi criada normalmente;
- `IdProspectSalesforce__c` permaneceu **`null`**;
- nenhum Lead novo foi observado para o CPF sint?tico desse cen?rio;
- o run terminou **`SUCCEEDED`** ap?s verify/cleanup.

## Diverg?ncia importante em rela??o ao plano original

A hip?tese original do plano era que os tr?s cen?rios de falha GraphQL fariam o
run terminar `PARTIAL`. Isso **n?o corresponde** ao comportamento atual da
orquestra??o.

Explica??o t?cnica precisa:

- `recordGraphqlCallback()` promove `WAITING_ASYNC -> VERIFYING` assim que a
  quantidade de callbacks persistidos atinge `expectedCallbackMin`, desde que o
  callback tenha chegado dentro de `asyncWaitDeadline`;
- essa promo??o **n?o** depende de `httpStatus` ser `2xx`, nem do body ser JSON
  v?lido;
- `deriveDispatchRunStatus()` j? havia deixado o run em `WAITING_ASYNC` porque o
  dispatch HTTP para o Apex foi bem-sucedido;
- como `verify` e `cleanup` passaram nos tr?s casos, o run convergiu para
  **`SUCCEEDED`**.

Em outras palavras: para a implementa??o atual do simulador, ?callback
recebido/persistido? ? o crit?rio que satisfaz o threshold ass?ncrono. A falha
remota do callback continua observ?vel no registro do `graphql_callback`, mas
n?o degrada automaticamente o status final do run.

## Cleanup real

Ap?s cada execu??o:

- o cleanup do lifecycle j? havia removido os registros owned do cen?rio;
- uma varredura manual adicional foi executada por `Id Cliente` / CPF / Lead e
  retornou **0 Accounts** e **0 Leads** residuais nos quatro cen?rios.

Os contadores `cleanupDeletedAccounts` / `cleanupDeletedLeads` ficaram `0`
justamente porque a limpeza autom?tica da pr?pria execu??o j? havia conclu?do
antes da varredura manual confirmat?ria.
