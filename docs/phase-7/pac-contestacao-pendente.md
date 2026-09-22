# PAC update com contestação pendente sincroniza contatos

## Escopo deste incremento

Esta última variação do universo `/PAC` prova, contra a org real
`mrv-devDan`, o caminho paralelo de **contestação pendente**: quando existe
`Contestacao__c` aberta para a mesma `PropostaAnaliseCredito__c`, o payload do
`pac-update` sincroniza `Account.PersonEmail` e `Account.Celular__c` mesmo sem
`tipoClassificacao='Principal'`.

## Decisão de desenho

Para evitar o problema de ordenação entre PAC e Contestação, o simulador não
cria a PAC via um `pac-insert` prévio. Em vez disso, o setup allowlisted cria
diretamente:

1. `Account`
2. `Opportunity`
3. `PropostaAnaliseCredito__c`
4. `Contestacao__c`

Só depois disso o cenário dispara o `pac-update` real. Assim, a
`Contestacao__c` já nasce apontando para o **Id real Salesforce** da PAC, sem
alterar a arquitetura do motor de runs.

## Cenário publicado

- **Chave:** `pac-update-com-contestacao-pendente-sincroniza-contatos`
- **Setup:** Account sintética sem contatos + Opportunity sintética + PAC
  sintética (`Status__c='ANALISE_CREDITO_INICIADA'`) + Contestação sintética
  pendente (`DataSolucao__c = null`)
- **Evento:** `pac-update`
- **Proponente:** único item com
  `tipoClassificacao='Coobrigado'` (deliberadamente não Principal)
- **Asserts:** vínculo `PropostaAnaliseCredito__c -> Opportunity`,
  existência do `Proponente__c` e sincronização de email/celular na Account

## Execução real em `mrv-devDan`

- `runId`: `run_phase_seven_contestacao_1790087819262`
- `accountIdCliente`: `CLI-SIM-4fe4404f03-7ed31e7c9c`
- `opportunityIdExterno`: `OPP-SIM-4fe4404f03-7ed31e7c9c`
- `pacIdExterno`: `PAC-SIM-4fe4404f03-7ed31e7c9c`
- `contestacaoIdExterno`: `CONT-SIM-4fe4404f03-7ed31e7c9c`
- `proponenteIdExterno`: `PROP-SIM-4fe4404f03-7ed31e7c9c`

### Resultado observado

- `setupResult.status = CREATED`
- `createdCount = 4`
- `dispatch /PAC = 200 OK`
- `verifyResult.passed = true`
- `cleanupResult.status = DELETED`
- `deletedCount = 5`

## Evidência antes/depois

### Antes do `pac-update`

- `Account.PersonEmail = null`
- `Account.PersonMobilePhone = null`
- `Account.Celular__c = null`
- `Opportunity.PACAtual__c = null`
- `PropostaAnaliseCredito__c.Status__c = 'ANALISE_CREDITO_INICIADA'`
- `Contestacao__c.DataSolucao__c = null`
- `Contestacao__c.Solucionada__c = false`
- `Proponente__c` ainda inexistente

### Depois do `pac-update`

#### Account

- `Id`: `001HZ000011QWWJYA4`
- `PersonEmail`: `pac.7ed31e7c9c@simulador.mrv.invalid`
- `PersonMobilePhone`: `5511942085347`
- `Celular__c`: `11942085347`

#### Opportunity

- `Id`: `006HZ00000TzXO9YAN`
- `PACAtual__c`: `a0kHZ00000BLgiqYAD`

#### PropostaAnaliseCredito__c

- `Id`: `a0kHZ00000BLgiqYAD`
- `Id__c`: `PAC-SIM-4fe4404f03-7ed31e7c9c`
- `Status__c`: `ANALISE_CREDITO_INICIADA`
- `Oportunidade__c`: `006HZ00000TzXO9YAN`

#### Contestacao__c

- `Id`: `a1kHZ00001ncaYnYAI`
- `Id__c`: `CONT-SIM-4fe4404f03-7ed31e7c9c`
- `PAC__c`: `a0kHZ00000BLgiqYAD`
- `DataSolucao__c`: `null`
- `Solucionada__c`: `false`

#### Proponente__c

- `Id`: `a0jHZ00000CFjxBYAT`
- `Id__c`: `PROP-SIM-4fe4404f03-7ed31e7c9c`
- `Proponente__c`: `001HZ000011QWWJYA4`
- `PropostaAnaliseCredito__c`: `a0kHZ00000BLgiqYAD`
- `IdCliente__c`: `CLI-SIM-4fe4404f03-7ed31e7c9c`
- `CpfProponente__c`: `20123158958`
- `TipoClassificacao__c`: `Coobrigado`
- `EmailAtualizado__c`: `pac.7ed31e7c9c@simulador.mrv.invalid`
- `Celular__c`: `11942085347`

## Conclusão

O comportamento real confirmou a hipótese principal: **contestação pendente faz
o payload vencer e sincronizar os contatos da Account mesmo quando o proponente
não é Principal**.

Também ficou confirmado que, mantendo o status neutro
`ANALISE_CREDITO_INICIADA`, o cenário isola apenas a sincronização por
contestação: a `Contestacao__c` permaneceu pendente (`DataSolucao__c = null`,
`Solucionada__c = false`) e não entrou no ramo de resolução automática.

## Limpeza real

Nenhum resíduo foi deixado em `mrv-devDan`. O cleanup final removeu:

- `Account`
- `Opportunity`
- `PropostaAnaliseCredito__c`
- `Contestacao__c`
- `Proponente__c`
