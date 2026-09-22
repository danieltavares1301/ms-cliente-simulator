# PAC insert mínimo — smoke test real

## Escopo deste incremento

Incremento deliberadamente pequeno da Tarefa 7.1: provar que o simulador já
consegue disparar `pac-insert` contra o Apex real (`NotificacaoPAC.cls`,
endpoint `/services/apexrest/PAC`) sem entrar ainda em `proponentes`,
`Proponente__c` ou Regra 6.6/O08.

## Decisões de contrato implementadas

- `pac-insert`/`pac-update` passaram a existir no contrato Event Grid do
  simulador.
- `renderedFixtureStepSchema` e o dispatch agora aceitam `target: 'PAC'` e
  roteiam corretamente para `/services/apexrest/PAC`.
- O schema **não inclui `proponentes` neste incremento**. A omissão foi
  intencional para manter o smoke test focado apenas no caminho mínimo:
  Opportunity sintética pré-existente -> `pac-insert` -> criação da
  `PropostaAnaliseCredito__c` -> callback assíncrono de crédito.

## Setup real executado em `mrv-devDan`

Fixture executada: `pac-insert-minimo@1`

- `runId`: `run_pac_diag_1790040794286`
- `pacIdExterno`: `PAC-SIM-4f400bccee-4f4ac77f3a`
- `oportunidadeExterna`: `OPP-SIM-4f400bccee-4f4ac77f3a`

### Opportunity sintética

O setup allowlisted criou a Opportunity com sucesso usando somente:

- `Name`
- `StageName = 'Simulação'`
- `CloseDate` futuro
- `Id__c`
- `AccountId`

Conclusões reais:

- `StageName='Aberta'` **não** existe nesta org; foi necessário usar um valor
  válido do picklist real (`Simulação`).
- `RecordTypeId` **não foi necessário** para a criação da Opportunity neste
  incremento.
- Não houve falha de validation rule nem erro de permissão para a criação da
  Opportunity com esse conjunto mínimo de campos.

## Resultado real observado

### Setup

- `setupResult.status = CREATED`
- `createdCount = 2`
- registros criados no setup:
  - Account: `001HZ000011OxInYAK`
  - Opportunity: `006HZ00000TyTstYAF`

### Dispatch `/PAC`

- `dispatchHttpStatus = 200`

### Verificação do outcome

- `verifyResult.passed = true`
- check executado:
  - `PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY = true`

Registro observado na verificação:

- `PropostaAnaliseCredito__c`: `a0kHZ00000BLRJqYAP`
- vínculo confirmado com a Opportunity sintética
- comportamento esperado também confirmado indiretamente:
  `Opportunity.PACAtual__c` passou a apontar para a PAC criada

### Callback do `EnvioPACCreditoQueue`

Consulta real a `LogIntegracao__c` para `EventType__c='EnvioPACCredito'`
retornou entradas recentes com `Status2__c='success'`. A mais nova associada ao
smoke test executado neste incremento foi:

- `Id`: `a0dHZ00000NanL8YAJ`
- `Status2__c`: `success`
- `CreatedDate`: `2026-09-22T01:33:21.000+0000`

Isso confirma que:

1. o insert da `PropostaAnaliseCredito__c` disparou o
   `PropostaAnaliseCreditoTrigger`;
2. o `EnvioPACCreditoQueue` executou;
3. o callback protegido da Tarefa 7.0 continuou funcionando no endpoint do
   simulador.

## Cleanup real

Cleanup allowlisted executado com sucesso ao final:

- `cleanupResult.status = DELETED`
- `deletedCount = 3`

Registros removidos:

- Account: `001HZ000011OxInYAK`
- Opportunity: `006HZ00000TyTstYAF`
- PropostaAnaliseCredito__c: `a0kHZ00000BLRJqYAP`

Nenhum registro do smoke test foi deixado órfão na org ao final da validação.

## Limitações conhecidas / próximo incremento

- `proponentes` continua fora do contrato desta fixture.
- Não há assert de `Proponente__c` neste incremento.
- A ordem relativa entre `/Cliente` e `/PAC` ainda não foi explorada.
- O reteste funcional completo de O08 / Regra 6.6 com PAC aprovada continua
  pendente para um incremento dedicado.
