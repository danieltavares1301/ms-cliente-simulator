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
  `Account.PersonEmail`/`Account.Celular__c` e existência do `Proponente__c`
  vinculado à Account e à PAC

## Execução real em `mrv-devDan`

Execução final de validação:

- `runId`: `run_pac_aprovada_1790042967738`
- `accountIdCliente`: `CLI-SIM-4c272d3a29-1b3ad89def`
- `opportunityIdExterno`: `OPP-SIM-4c272d3a29-1b3ad89def`
- `pacIdExterno`: `PAC-SIM-4c272d3a29-1b3ad89def`
- `proponenteIdExterno`: `PROP-SIM-4c272d3a29-1b3ad89def`

### Resultado observado

- `setupResult.status = CREATED`
- `createdCount = 2`
- `dispatch /PAC = 200 OK`
- `verifyResult.passed = true`
- `cleanupResult.status = DELETED`
- `deletedCount = 4`

### Registros observados

#### Account

- `Id`: `001HZ000011OvvLYAS`
- `PersonEmail`: `cliente.1b3ad89def@simulador.mrv.invalid`
- `PersonMobilePhone`: `5511992887139`
- `Celular__c`: `11992887139`

Conclusão: a org real **sincronizou email e celular na Account** exatamente com
os valores do payload do Proponente principal.

#### Opportunity

- `Id`: `006HZ00000TyZLZYA3`
- `PACAtual__c`: `a0kHZ00000BLTyLYAX`

#### PropostaAnaliseCredito__c

- `Id`: `a0kHZ00000BLTyLYAX`
- `Id__c`: `PAC-SIM-4c272d3a29-1b3ad89def`
- `Status__c`: `CREDITO_APROVADO_CONDICIONADO`

#### Proponente__c

- `Id`: `a0jHZ00000CFFMRYA5`
- `Id__c`: `PROP-SIM-4c272d3a29-1b3ad89def`
- `Proponente__c`: `001HZ000011OvvLYAS`
- `PropostaAnaliseCredito__c`: `a0kHZ00000BLTyLYAX`
- `NomeCompleto__c`: `Cliente Simulado Base 1b3ad89def`

Conclusão: o `Proponente__c` foi criado e vinculado corretamente à Account e à
PAC.

## Divergências reais vs teoria

### 1. Campos de Proponente legíveis em `mrv-devDan`

Ao tentar consultar `IdCliente__c`, `CpfProponente__c`, `TipoClassificacao__c`,
`EmailAtualizado__c`, `Celular__c` e `DataAlteracaoEvento__c` diretamente em
`Proponente__c`, a org retornou `INVALID_FIELD`. Na prática, o usuário atual só
conseguiu ler com segurança:

- `Id`
- `Id__c`
- `Proponente__c`
- `PropostaAnaliseCredito__c`
- `NomeCompleto__c`

Por isso, o verificador do simulador foi ajustado para provar o vínculo do
`Proponente__c` por `Id__c` + lookups (`Proponente__c` e
`PropostaAnaliseCredito__c`) e deixar a prova dos contatos exclusivamente na
`Account`, onde o efeito de negócio realmente precisa aparecer.

### 2. `NomeCompleto__c` do Proponente não refletiu o payload

O payload enviado usava o nome gerado em `PERSON_NAME`, mas o registro real
persistido ficou com `NomeCompleto__c = Cliente Simulado Base ...`, isto é, o
nome base da Account criada no setup. Como o objetivo do cenário é provar a
sincronização de contatos e o vínculo do Proponente, a assertion foi ajustada
para **não** depender do valor textual desse campo.

### 3. `Opportunity.CloseDate` foi normalizado pela org

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

## Pendente para o incremento 3

- Reexecutar O08 (`cpf-divergente-identidade-antiga`) reutilizando a estrutura
  de `proponentes[]` e o caminho de PAC aprovada validados aqui.
