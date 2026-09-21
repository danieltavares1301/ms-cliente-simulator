# Fase 6 — `cliente-insert` com prospect divergente

## Objetivo

Registrar o comportamento atual do Apex quando um evento
`cliente-insert`/`cliente-update` reutiliza um `idprospectsalesforce` que já
pertence a outra Account.

O simulador agora publica o cenário READY
`cliente-insert-prospect-divergente`, cobrindo o caso em que:

- a Account **X** já existe e continua dona legítima do prospect divergente;
- o evento cria uma nova Account **Y**;
- o Apex cria um **Lead novo** para Y;
- o callback GraphQL de saída é esperado como evidência assíncrona do fluxo.

## Regra de negócio replicada

O comportamento modelado segue o fluxo validado no Apex:

1. a busca encontra ou pode encontrar a Account dona do prospect divergente;
2. como o prospect já pertence a outra Account, a Account candidata do evento é
   descartada para atualização;
3. o Apex cria uma **nova Person Account Y**;
4. Y **não herda** `IdProspectSalesforce__c` de X;
5. `insertLeadQueueable` cria um **Lead novo** com GUID real/imprevisível;
6. a Account Y recebe no fim o `Id__c` desse Lead;
7. a Account X permanece intacta.

## Extensões de contrato

### Valores gerados

Foram adicionados os `GeneratedValue`:

- `CLIENT_ID_X`
- `PROSPECT_ID_X`
- `CPF_X`

Eles são determinísticos por `(seed, runId)`, mas sempre distintos dos
identificadores primários de Y.

### Setup

`CREATE_SYNTHETIC_ACCOUNT` aceita `role: 'PRIMARY' | 'CONTROL'`.

- `PRIMARY` continua sendo o padrão implícito para retrocompatibilidade;
- no máximo uma conta `PRIMARY` e uma `CONTROL` são aceitas por fixture.

### Identifiers renderizados

Quando existe uma conta `CONTROL`, a fixture renderizada também expõe:

- `controlAccountIdCliente`
- `controlAccountIdProspect`

### Verificações novas

- `CONTROL_ACCOUNT_UNCHANGED`
  - relê a Account X por `Id__c`;
  - exige igualdade de `CPF__pc`, `LastName` e
    `IdProspectSalesforce__c` contra o setup CONTROL.
- `LEAD_COUNT_BY_CPF_IS_ONE`
  - reutiliza a busca allowlisted de Lead da verificação;
  - garante exatamente um Lead para o CPF de Y.

### Resultado novo

`expectedOutcome.result` ganhou o valor aditivo
`PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT`.

## Cenário publicado

`cliente-insert-prospect-divergente@1`

- **scope**: `EXTENDED`
- **tags**: `regression`, `prospect-divergente`, `lead`, `pos-pac`
- **callback esperado**: `min=1`, `max=1`

## Política assíncrona

O cenário espera um callback GraphQL real.

Decisões adotadas:

- `expectedCallbacks: { min: 1, max: 1 }`
- `waitTimeoutMs: 30000`
- `missingCallbackResult: 'PARTIAL'`

Justificativa:

- `findCorrelatableRun()` correlaciona callbacks principalmente pelos
  identificadores persistidos da fixture (`accountIdCliente` e
  `accountIdProspect`);
- neste fluxo, o `idProspectSalesforce` final de Y vira um GUID real do Lead,
  então a correlação prática tende a depender de `idCliente`;
- `30000ms` fica alinhado ao timeout de rede do Salesforce
  (`SALESFORCE_NETWORK_TIMEOUT_MS = 30000`) e folgado em relação ao máximo de
  atraso simulado do callback (`MAX_DELAYED_RESPONSE_MS = 8000`);
- ausência do callback não prova que a criação falhou, então o resultado
  escolhido é `PARTIAL`, não `FAILED`.

## Cleanup e ownership

O cleanup de `ACCOUNT` agora aceita ownership explícito da conta primária e da
conta de controle.

O cleanup de `LEAD` continua fail-closed:

- só remove registros encontrados por Salesforce Id explícito já persistido;
- aceita `Id__c` com prefixo `LEAD-SIM-` para Leads sintéticos do setup;
- para Leads criados pelo Apex com GUID real, exige CPF compatível ao revalidar
  o registro allowlisted antes do delete.

## Limitações conhecidas

- o cenário **não** afirma o valor final de `IdProspectSalesforce__c` em Y,
  porque o Lead criado pelo Apex usa GUID real e imprevisível;
- a correlação do callback depende, na prática, de `idCliente` quando o
  prospect final deixa de ser o identificador sintético da fixture;
- o check de imutabilidade da conta X observa apenas os campos relevantes para a
  regressão atual (`CPF__pc`, `LastName`, `IdProspectSalesforce__c`).
