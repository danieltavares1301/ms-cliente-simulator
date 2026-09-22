# PAC aprovada sincroniza contatos — incremento 2

## Escopo deste incremento

Este incremento estende o contrato `/PAC` com `proponentes[]` e prova, contra a
org real `mrv-devDan`, o caminho de negócio em que uma PAC aprovada
(`status='CREDITO_APROVADO_CONDICIONADO'`) sincroniza os contatos da Account a
partir do Proponente principal do payload.

O reteste de O08 (`cpf-divergente-identidade-antiga`) continua **fora de
escopo** aqui e fica reservado ao incremento 3.

## Contrato implementado

- `pac-insert`/`pac-update` agora aceitam `proponentes?: Proponente[]`.
- No schema Zod, apenas `id`, `idPac`, `idCliente`, `cpf`,
  `tipoClassificacao` e `dataAlteracao` são obrigatórios no wrapper
  `Proponente`.
- O campo continua opcional no payload PAC, preservando retrocompatibilidade
  com `pac-insert-minimo`.

## Cenário publicado

- **Chave:** `pac-aprovada-sincroniza-contatos`
- **Escopo:** `EXTENDED`
- **Tags:** `regression`, `fase-7`, `pac-aprovada`, `sincronizacao-contatos`
- **Setup:** Account sintética primária sem email/celular + Opportunity
  sintética vinculada
- **Evento:** `pac-insert` com um único Proponente principal
- **Asserts:** vínculo PAC ↔ Opportunity, sincronização de
  `Account.PersonEmail`/`Account.Celular__c` e verificação forte do
  `Proponente__c` principal (`IdCliente__c`, `CpfProponente__c`,
  `TipoClassificacao__c`, `EmailAtualizado__c`, `Celular__c`), mantendo
  `NomeCompleto__c` apenas como evidência observada

## Execução real em `mrv-devDan`

### Revalidação pós-fix de FLS (`AcessoDeAPI`)

Execução final de revalidação:

- `runId`: `run_pac_restore_1790074026586`
- `accountIdCliente`: `CLI-SIM-1d07f79317-863dbcbe93`
- `opportunityIdExterno`: `OPP-SIM-1d07f79317-863dbcbe93`
- `pacIdExterno`: `PAC-SIM-1d07f79317-863dbcbe93`
- `proponenteIdExterno`: `PROP-SIM-1d07f79317-863dbcbe93`

### Resultado observado

- `setupResult.status = CREATED`
- `createdCount = 2`
- `dispatch /PAC = 200 OK`
- `verifyResult.passed = true`
- `cleanupResult.status = DELETED`
- `deletedCount = 4`
- query SOQL completa de `Proponente__c` executada com sucesso, **sem**
  `INVALID_FIELD`
- o check restaurado `PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC` passou
  usando novamente `IdCliente__c`, `CpfProponente__c`,
  `TipoClassificacao__c`, `EmailAtualizado__c` e `Celular__c`

### Registros observados

#### Account

- `Id`: `001HZ000011PtwIYAS`
- `LastName`: `Cliente Simulado Base 863dbcbe93`
- `PersonEmail`: `cliente.863dbcbe93@simulador.mrv.invalid`
- `PersonMobilePhone`: `5511959550398`
- `Celular__c`: `11959550398`

Conclusão: a org real **sincronizou email e celular na Account** exatamente com
os valores do payload do Proponente principal.

#### Opportunity

- `Id`: `006HZ00000Tz095YAB`
- `PACAtual__c`: `a0kHZ00000BLXc9YAH`

#### PropostaAnaliseCredito__c

- `Id`: `a0kHZ00000BLXc9YAH`
- `Id__c`: `PAC-SIM-1d07f79317-863dbcbe93`
- `Status__c`: `CREDITO_APROVADO_CONDICIONADO`

#### Proponente__c

- `Id`: `a0jHZ00000CFaqfYAD`
- `Id__c`: `PROP-SIM-1d07f79317-863dbcbe93`
- `Proponente__c`: `001HZ000011PtwIYAS`
- `PropostaAnaliseCredito__c`: `a0kHZ00000BLXc9YAH`
- `IdCliente__c`: `CLI-SIM-1d07f79317-863dbcbe93`
- `CpfProponente__c`: `43491111234`
- `TipoClassificacao__c`: `Principal`
- `EmailAtualizado__c`: `cliente.863dbcbe93@simulador.mrv.invalid`
- `Celular__c`: `11959550398`
- `DataAlteracaoEvento__c`: `2026-09-22T10:47:06.000Z`
- `NomeCompleto__c`: `Cliente Simulado Base 863dbcbe93`

Conclusão: o `Proponente__c` foi criado e vinculado corretamente à Account e à
PAC, e os campos restaurados no verificador forte bateram exatamente com o
payload enviado (`IdCliente__c`, `CpfProponente__c`, `TipoClassificacao__c`,
`EmailAtualizado__c`, `Celular__c` e também `DataAlteracaoEvento__c`).

## Causa raiz do `INVALID_FIELD` (corrigida fora deste repositório)

O erro **não** vinha de schema, metadata ausente nem divergência entre sandbox e
código Apex. Os campos de `Proponente__c` existem na org e o Apex real
(`NotificacaoPAC.cls`) já os utilizava normalmente. A causa raiz era FLS ausente
no Permission Set `AcessoDeAPI`, que é o Permission Set usado pelas integrações
reais dessa org e pelo usuário de teste da validação.

O usuário corrigiu isso **diretamente em `mrv-devDan`**, fora deste repositório,
adicionando FLS de leitura/edição para os campos necessários de
`Proponente__c`. Depois dessa correção, a query completa voltou a funcionar sem
`INVALID_FIELD` e o simulador pôde restaurar a verificação forte.

## Divergências reais vs teoria

### 1. `NomeCompleto__c` do Proponente continua não refletindo o payload

Na revalidação pós-fix, `NomeCompleto__c` continuou refletindo o nome vigente da
Account (`LastName = Cliente Simulado Base ...`), e **não** o
`nomeCompleto` enviado no payload do Proponente. Isso confirma novamente o
comportamento do Apex via `resolverNomeVigenteProponente`; por isso a
assertion forte permanece **sem** igualdade textual para esse campo.

### 2. `Opportunity.CloseDate` foi normalizado pela org

A Opportunity sintética é criada pelo simulador com `CloseDate` futuro fixo, mas
na execução observada a org retornou `CloseDate = 2026-09-30`. Isso não impediu
o vínculo PAC ↔ Opportunity nem a sincronização de contatos, então o cenário
não passou a depender desse valor.

## Limpeza real

Nenhum resíduo foi deixado em `mrv-devDan`. A limpeza final removeu:

- Account sintética
- Opportunity sintética
- PropostaAnaliseCredito__c
- Proponente__c

## Desfecho no incremento 3

O reteste pendente de O08 foi concluído na variante
`cpf-divergente-identidade-antiga-pac-aprovada`. Resultado real:

- Y continuou vazia após o `/Cliente`, confirmando novamente o comportamento
  isolado do O08 original;
- depois do `pac-insert` aprovado, Y recebeu `PersonEmail`/`Celular__c`
  diretamente do Proponente principal;
- o Lead novo de Y também recebeu os mesmos contatos via reconciliação
  pós-PAC;
- X permaneceu com os contatos antigos recebidos pelos `contato-insert`.

Ver `docs/phase-7/o08-retest-pac-aprovada.md` para a evidência completa e a
resposta definitiva da pergunta em aberto da sessão.
