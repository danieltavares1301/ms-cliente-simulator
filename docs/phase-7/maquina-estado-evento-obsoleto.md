# Tarefa 7.2 — `/MaquinaEstado` (incremento 5: `jornadausuario-update` com evento obsoleto)

## Escopo deste incremento

Este incremento cobre o padrão real documentado na seção 8 de
[`docs/staging-logs-analysis.md`](../staging-logs-analysis.md): um
`jornadausuario-update` chega **fisicamente depois**, mas com `EventTime`
**mais antigo** do que o já persistido na `Opportunity`, e por isso precisa ser
**descartado silenciosamente**.

Cenário publicado:

- `maquina-estado-update-evento-obsoleto`

## Achado real que motivou o cenário

A análise real em `mrv-staging` (seção 8 de `docs/staging-logs-analysis.md`)
encontrou **4 casos em 200 logs com `Status2__c='success'` (2%)** em que o
Apex registrou `EVENTO OBSOLETO` e mesmo assim respondeu **HTTP 200** ao
chamador. O padrão observado foi:

- `EventTime` recebido **estritamente mais antigo** que o já salvo na
  `Opportunity`;
- nenhum update efetivo em `StageName` nem nos demais campos da `Opportunity`;
- sucesso aparente do ponto de vista do producer (`200 OK`).

Este incremento transforma esse achado em cenário automatizado e validação ao
vivo contra `mrv-devDan`.

## Contrato Apex confirmado

Antes de fixar o cenário, o contrato foi relido no Apex real
`NotificacaoMaquinaEstado.retornaValorFase` / `retornaValidacaoEventTime`:

- `DOCUMENTACAO -> 'Qualificação de Documentos'`
- `CONTRATO -> 'Assinatura do Contrato'`
- o descarte de obsolescência acontece apenas quando o `EventTime__c` já
  persistido é **estritamente maior** que o recebido (`>`);
- quando a validação falha, o bloco de `upsert` é pulado, mas a execução segue
  normalmente até o fim com **HTTP 200**.

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. o catálogo ainda não publicava `maquina-estado-update-evento-obsoleto`;
2. o renderer ainda não conseguia renderizar o passo final com ordem física
   posterior e `eventTime/dataalteracao` lógico mais antigo para
   `target: 'MAQUINA_ESTADO'`;
3. o adapter ainda não verificava o resultado de negócio em que o último evento
   recebido era `CONTRATO`, mas a `Opportunity` precisava permanecer em
   **`Qualificação de Documentos`**.

Cobertura exercitada/ajustada:

- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/catalog.test.ts`
- `src/scenarios/renderer.test.ts`
- `src/scenarios/maquina-estado-scenario.test.ts`
- `src/salesforce/test-data-adapter.maquina-estado.test.ts`

## Modelagem do cenário

### Setup

- `CREATE_SYNTHETIC_ACCOUNT` (PRIMARY, `ID_CLIENTE`)

### Passo 1 — insert inicial

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-insert'`
- `delayMs: 0`
- `eventTime = dataalteracao = generated('BASELINE_TIME')`
- `estado = 'SIMULACAO'`

### Passo 2 — update atual

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-update'`
- `delayMs: 3_000`
- mesmo `Data.Id` da `Opportunity`
- `eventTime = dataalteracao = generated('EVENT_TIME')`
- `estado = 'Documentacao'`

Resultado esperado: avançar a `Opportunity` para
**`Qualificação de Documentos`**.

### Passo 3 — update obsoleto

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-update'`
- `delayMs: 6_000` (despachado depois do passo 2)
- mesmo `Data.Id` da `Opportunity`
- `eventTime = dataalteracao = generated('PINNED_EVENT_TIME')`
- `estado = 'CONTRATO'`

Resultado esperado: o evento retorna **HTTP 200**, mas é descartado como
obsoleto e **não** altera a fase para `Assinatura do Contrato`.

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

### Identidade sintética usada

- `runId = run_phase7_maquina_obsoleto_real_20260922a`
- `seed = phase7-inc5-real-20260922a`
- `Account.Id__c = CLI-SIM-33abd149b1-e297fc029d`
- `Opportunity.Id__c = OPP-SIM-33abd149b1-e297fc029d`

## Cenário — `maquina-estado-update-evento-obsoleto`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a `Account`
  `001HZ000011RdSwYAK`;
- `setupResult.status = CREATED`.

### Passo 1 — criação inicial (`jornadausuario-insert`)

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-33abd149b1-ecd8ffb2`
- `EventTime = 2026-09-22T21:29:59.000Z`
- `estado = SIMULACAO`
- resultado real: **HTTP 200 OK**

### Passo 2 — update atual (`jornadausuario-update`)

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-33abd149b1-8092f439`
- `EventTime = 2026-09-22T21:30:03.000Z`
- `estado = Documentacao`
- resultado real: **HTTP 200 OK**

### Query direta DEPOIS do passo 2 e ANTES do passo 3

Estado observado na `Opportunity` depois do update atual:

- `Opportunity.Id = 006HZ00000U0JhJYAV`
- `Id__c = OPP-SIM-33abd149b1-e297fc029d`
- `AccountId = 001HZ000011RdSwYAK`
- `StageName = Qualificação de Documentos`
- `EventTime__c = 2026-09-22T21:30:03.000+0000`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` depois do passo 2:

- `Id = 00kHZ00000BM8AHYA1`
- `OpportunityId = 006HZ00000U0JhJYAV`
- `Id__c = 006HZ00000U0JhJYAV1`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Passo 3 — update obsoleto (`jornadausuario-update`)

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-33abd149b1-492926ec`
- `EventTime = 2026-09-22T21:30:00.000Z`
- `dataalteracao = 2026-09-22T21:30:00.000Z`
- `estado = CONTRATO`
- resultado real: **HTTP 200 OK**

### Query direta DEPOIS do passo 3

Estado observado na `Opportunity` depois do evento obsoleto:

- `Opportunity.Id = 006HZ00000U0JhJYAV`
- `Id__c = OPP-SIM-33abd149b1-e297fc029d`
- `AccountId = 001HZ000011RdSwYAK`
- `StageName = Qualificação de Documentos`
- `EventTime__c = 2026-09-22T21:30:03.000+0000`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` depois do passo 3:

- `Id = 00kHZ00000BM8AHYA1`
- `OpportunityId = 006HZ00000U0JhJYAV`
- `Id__c = 006HZ00000U0JhJYAV1`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Evidência adicional em `LogIntegracao__c`

Foi feita uma consulta direta aos logs do mesmo intervalo, filtrando os três
`Event Id`s e o `Id__c` sintético da `Opportunity`. O registro do passo 3 foi
persistido com:

- `EventType__c = jornadausuario-update`
- `Status2__c = success`
- `StackTrace__c` contendo:

```text
EVENTO OBSOLETO - EventTime recebido: 2026-09-22 18:30:00
                 - EventTime registrado na Oportunidade: 2026-09-22 18:30:03
```

Ou seja: em `mrv-devDan`, o comportamento real ficou **alinhado exatamente** ao
achado documentado em `docs/staging-logs-analysis.md` (seção 8): sucesso de
transporte (`200` / `success`) com descarte silencioso do update obsoleto.

### Conclusão objetiva observada ao vivo

- os **três dispatches** retornaram **HTTP 200 OK**;
- o passo 2 avançou a `Opportunity` para
  **`Qualificação de Documentos`**;
- o passo 3 chegou com `estado = CONTRATO`, mas `EventTime` mais antigo;
- a `Opportunity` permaneceu com a mesma fase do passo 2,
  **não** foi alterada para `Assinatura do Contrato`;
- `EventTime__c` persistido permaneceu no valor do evento mais novo
  (`2026-09-22T21:30:03.000+0000`);
- a `Opportunity` permaneceu **única** (`totalSize = 1` por `Id__c`);
- o total de `OpportunityLineItem` permaneceu **1**.

### Verificação automatizada

`verify()` passou com **4/4 checks**:

- `OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE`
- `OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT`
- `OPPORTUNITY_STAGE_EQUALS_EXPECTED`
- `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 1`

### Cleanup real

- `cleanupResult.status = DELETED`
- `deletedCount = 3`

Registros removidos:

- 1 `Account`
- 1 `Opportunity`
- 1 `OpportunityLineItem`

Estado final pós-cleanup:

- `Account`: `0`
- `Opportunity`: `0`
- `OpportunityLineItem`: `0`

## Rastreabilidade com a análise de logs reais

Este incremento fecha o recorte que faltava da Tarefa 7.2 e se conecta
explicitamente à seção 8 de `docs/staging-logs-analysis.md`:

- base real analisada em staging: **200 logs `success`**;
- casos reais de obsolescência: **4/200 (2%)**;
- padrão confirmado nas duas bases (`mrv-staging` e `mrv-devDan`):
  `jornadausuario-update` obsoleto retorna **sucesso aparente** ao chamador,
  mas **não altera** `StageName` nem o `EventTime__c` já persistido quando a
  `Opportunity` já carrega um evento mais novo.

Com isso, o simulador agora cobre também o descarte silencioso de evento
obsoleto em `/MaquinaEstado`, além do smoke test de insert, da dependência real
`/Cliente ↔ /MaquinaEstado`, do update básico e da reentrega do mesmo evento.
