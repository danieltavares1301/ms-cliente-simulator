# Tarefa 7.2 — `/MaquinaEstado` (incremento 4: reentrega real do mesmo evento)

## Escopo deste incremento

Este incremento cobre o padrão real identificado na seção 7 de
`docs/staging-logs-analysis.md`: **o mesmo envelope Event Grid** de
`jornadausuario-update` sendo entregue duas vezes depois de uma primeira
tentativa malsucedida por contenção transitória.

O simulador não reproduz a contenção de lock em si. O objetivo aqui é validar
o comportamento convergente da reentrega: publicar o mesmo update duas vezes
com **mesmo `id` do evento**, **mesmo `eventTime`** e **mesmo payload** e
confirmar que o estado final continua correto e sem duplicações.

Cenário publicado:

- `maquina-estado-update-reentrega-mesmo-evento`

## Achado real que motivou o cenário

Na amostra de **400 logs reais** de `jornadausuario-insert` +
`jornadausuario-update` analisados em `mrv-staging`, a comparação pelo `Id`
do **envelope** (não `Data.Id`) encontrou **2 reentregas genuínas** do mesmo
evento:

| Event Id | 1ª tentativa | 2ª tentativa | Intervalo |
| --- | --- | --- | --- |
| `e203ddcd-3379-4835-a04d-9d18249ddde9` | `error` (`19:33:59`) | `success` (`19:34:12`) | ≈13s |
| `981a453d-5fc7-409b-9fe3-e0a6819d72a9` | `error` (`13:08:17`) | `success` (`13:08:30`) | ≈13s |

Ou seja: não é apenas “evento duplicado após sucesso” (padrão já coberto no
O14 para `/Cliente`), e sim **reentrega do mesmo update após falha
transitória**. Este documento implementa exatamente esse recorte funcional no
simulador.

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. o catálogo ainda não publicava
   `maquina-estado-update-reentrega-mesmo-evento`;
2. o renderer ainda não expunha o cenário com `duplicateCount: 1` no step de
   update;
3. a orquestração ainda não tinha um teste dedicado provando que
   `duplicateCount` também expande reentregas físicas para
   `target: 'MAQUINA_ESTADO'`.

Cobertura adicionada/ajustada:

- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/catalog.test.ts`
- `src/scenarios/renderer.test.ts`
- `src/scenarios/maquina-estado-scenario.test.ts`
- `src/runs/orchestration.test.ts`

## Modelagem do cenário

### Setup

- `CREATE_SYNTHETIC_ACCOUNT` (PRIMARY, `ID_CLIENTE`)

### Passo 1

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-insert'`
- `delayMs: 0`
- payload mínimo já validado no incremento 1

Resultado esperado: criar a `Opportunity` inicial em **`Simulação`**.

### Passo 2

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-update'`
- `delayMs: 3_000`
- mesmo `Data.Id`/`idjornadapac` da `Opportunity`
- `estado = 'Documentacao'`
- `deliveryPolicy.duplicateCount = 1`

Na orquestração, isso gera **duas entregas físicas** do mesmo envelope:

1. `maquina-estado-update-documentacao-reentrega`
2. `maquina-estado-update-documentacao-reentrega-redelivery-1`

Ambas carregam o **mesmo**:

- `eventId`
- `eventTime`
- `dataalteracao`
- `data`

apenas com `scheduledAt` físico avançando em `+500 ms` para a reentrega.

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

### Identidade sintética usada

- `runId = run_phase7_maquina_reentrega_real_20260922a`
- `seed = phase7-inc4-real-20260922a`
- `Account.Id__c = CLI-SIM-ca1d0d4451-962bf54e09`
- `Opportunity.Id__c = OPP-SIM-ca1d0d4451-962bf54e09`

Envelope do update reenviado:

- `Event Id = EVT-SIM-ca1d0d4451-0a81f2bc`
- `EventTime = 2026-09-22T21:00:03.000Z`
- `duplicateCount = 1`

---

## Cenário — `maquina-estado-update-reentrega-mesmo-evento`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a `Account`
  `001HZ000011RgIGYA0`;
- `setupResult.status = CREATED`.

### Passo 1 — criação inicial (`jornadausuario-insert`)

- endpoint: `/services/apexrest/MaquinaEstado`
- resultado real: **HTTP 200 OK**

### Query direta ANTES da reentrega do update

Estado observado após o insert e antes do update:

- `Opportunity.Id = 006HZ00000U0AvmYAF`
- `Id__c = OPP-SIM-ca1d0d4451-962bf54e09`
- `AccountId = 001HZ000011RgIGYA0`
- `StageName = Simulação`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` presente antes do update:

- `Id = 00kHZ00000BM7ULYA1`
- `OpportunityId = 006HZ00000U0AvmYAF`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Passo 2 — update original (`jornadausuario-update`)

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-ca1d0d4451-0a81f2bc`
- `EventTime = 2026-09-22T21:00:03.000Z`
- resultado real: **HTTP 200 OK**

### Passo 2b — reentrega do MESMO envelope

- endpoint: `/services/apexrest/MaquinaEstado`
- **mesmo `Event Id`**
- **mesmo `EventTime`**
- **mesmo `dataalteracao`**
- **mesmo payload `data`**
- resultado real: **HTTP 200 OK**

### Query direta DEPOIS do update + reentrega

Estado observado depois das duas entregas físicas do mesmo update:

- `Opportunity.Id = 006HZ00000U0AvmYAF`
- `Id__c = OPP-SIM-ca1d0d4451-962bf54e09`
- `AccountId = 001HZ000011RgIGYA0`
- `StageName = Qualificação de Documentos`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` depois da reentrega:

- `Id = 00kHZ00000BM7VxYAL`
- `OpportunityId = 006HZ00000U0AvmYAF`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Conclusão objetiva observada ao vivo

- a `Opportunity` permaneceu **única** (`totalSize = 1` por `Id__c`);
- a **mesma `Opportunity` Salesforce real** foi reaproveitada
  (`006HZ00000U0AvmYAF` antes e depois);
- a fase final ficou corretamente em
  **`Qualificação de Documentos`**;
- o total de `OpportunityLineItem` permaneceu **1**;
- as **duas entregas físicas** do mesmo update retornaram **HTTP 200 OK**.

> Observação real: assim como no incremento 3, o `OpportunityLineItem`
> consultado antes e depois apareceu com `Id` diferente, mas a contagem
> permaneceu `1`. O cenário automatizado continua fixando o requisito que
> interessa ao comportamento de negócio: **ausência de duplicação**.

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

Este incremento implementa diretamente o achado da seção 7 de
`docs/staging-logs-analysis.md`:

- base real analisada: **400 logs** combinando `jornadausuario-insert` +
  `jornadausuario-update`;
- reentregas genuínas detectadas: **2 casos reais**;
- padrão observado: **mesmo Event Id**, primeira tentativa `error`,
  segunda tentativa `success`, com intervalo de **≈13 segundos** em ambos os
  casos.

O simulador agora cobre esse padrão sem tentar fabricar a contenção de lock:
reenvia o **mesmo envelope** e confirma que o resultado final permanece
convergente e sem duplicação em `Opportunity` e `OpportunityLineItem`.
