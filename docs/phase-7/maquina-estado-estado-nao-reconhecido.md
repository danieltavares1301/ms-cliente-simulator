# Tarefa 7.2 — `/MaquinaEstado` (incremento 6: `Estado` não reconhecido em `jornadausuario-update`)

## Escopo deste incremento

Este incremento cobre o padrão real majoritário documentado na seção 9 de
[`docs/staging-logs-analysis.md`](../staging-logs-analysis.md): updates de
`/MaquinaEstado` chegando com `Estado` em formato de **sigla de UF** (`SP`,
`MG`, `MT`), valor que **não corresponde a nenhum branch conhecido** de
`NotificacaoMaquinaEstado.retornaValorFase`.

Cenário publicado:

- `maquina-estado-update-estado-nao-reconhecido`

## Achado real que motivou o cenário

A análise real em `mrv-staging` (seção 9 de
`docs/staging-logs-analysis.md`) encontrou, em uma amostra de **150 eventos
bem-sucedidos** de `jornadausuario-*`, a seguinte distribuição de `Estado`:

| Valor real de `Estado` | Ocorrências | Participação |
| --- | ---: | ---: |
| `SP` | 68 | 45% |
| `Documentacao` | 64 | 43% |
| `MG` | 13 | 9% |
| `Proposta` | 3 | 2% |
| `MT` | 1 | <1% |
| `PropostaGenericaFinalizada` | 1 | <1% |

Ou seja: **`SP` + `MG` + `MT` = 82/150 ≈ 55%** da amostra usa um valor de
`Estado` **não mapeado** pelo Apex. Na amostra separada de **30
`jornadausuario-insert`**, **100%** usaram `Estado="Unidades"` — portanto as
siglas de UF aparecem, na prática observada, **somente em `update`**.

## Contrato Apex confirmado

Antes de fixar o cenário, a lógica foi relida no Apex real
`NotificacaoMaquinaEstado.retornaValorFase` / `preencherEstado`:

- `DOCUMENTACAO -> 'Qualificação de Documentos'`
- quando `valorJson` **não** bate com nenhum branch conhecido, a função cai no
  fallback final:

```apex
return oportunidadeExistente != null ? oportunidadeExistente.StageName : null;
```

- em `preencherEstado`, o `put()` do campo de fase ocorre se
  `String.isNotBlank(valorFase)`.

Portanto, para um `jornadausuario-update` com Opportunity já existente e
`Estado='SP'`, o comportamento esperado pelo contrato é:

1. `retornaValorFase('SP', oportunidadeExistente, ehUnidade)` devolve o
   **`StageName` atual** da Opportunity;
2. o `put()` acontece normalmente, mas escrevendo **o mesmo valor já
   persistido**;
3. o resultado líquido é um **"no-op" de estágio**, ainda com **HTTP 200** no
   dispatch.

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. o catálogo ainda não publicava
   `maquina-estado-update-estado-nao-reconhecido`;
2. a fixture ainda não renderizava a sequência
   `insert -> update(Documentacao) -> update(SP)` reutilizando o mesmo
   `Id__c` externo da Opportunity;
3. a verificação do adapter ainda não cobria o resultado de negócio em que o
   update final retorna `HTTP 200`, mas a `Opportunity` precisa permanecer em
   **`Qualificação de Documentos`**.

Cobertura adicionada/ajustada:

- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/catalog.test.ts`
- `src/scenarios/maquina-estado-scenario.test.ts`
- `src/salesforce/test-data-adapter.maquina-estado.test.ts`

## Modelagem do cenário

### Setup

- `CREATE_SYNTHETIC_ACCOUNT` (PRIMARY, `ID_CLIENTE`)

### Passo 1 — insert inicial

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-insert'`
- `delayMs: 0`
- `estado = 'SIMULACAO'`

Resultado esperado: criar a Opportunity inicial em **`Simulação`**.

### Passo 2 — update conhecido

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-update'`
- `delayMs: 3_000`
- mesmo `Data.Id` da Opportunity
- `estado = 'Documentacao'`

Resultado esperado: mover a Opportunity para
**`Qualificação de Documentos`**.

### Passo 3 — update com valor real não reconhecido

- `target: 'MAQUINA_ESTADO'`
- `eventType: 'jornadausuario-update'`
- `delayMs: 6_000`
- mesmo `Data.Id` da Opportunity
- `estado = 'SP'`
- `eventTime = dataalteracao = 2026-09-22T22:10:06.000Z`
  (**mais novo** que o do passo 2)

Resultado esperado: o dispatch retorna **HTTP 200**, o evento é aceito, mas a
fase permanece **`Qualificação de Documentos`**.

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

### Identidade sintética usada

- `runId = run_phase7_maquina_estado_uf_20260922a`
- `seed = phase7-inc6-real-20260922a`
- `Account.Id__c = CLI-SIM-b50986abbc-23c09350ab`
- `Account.IdProspectSalesforce__c = PRO-SIM-b50986abbc-23c09350ab`
- `Opportunity.Id__c = OPP-SIM-b50986abbc-23c09350ab`

---

## Cenário — `maquina-estado-update-estado-nao-reconhecido`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a `Account`
  `001HZ000011RgpHYAS`;
- `setupResult.status = CREATED`.

### Passo 1 — criação inicial (`jornadausuario-insert`)

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-b50986abbc-ecd8ffb2`
- `EventTime = 2026-09-22T22:10:00.000Z`
- `estado = SIMULACAO`
- resultado real: **HTTP 200 OK**

### Passo 2 — update conhecido (`jornadausuario-update`)

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-b50986abbc-eeda6f4c`
- `EventTime = 2026-09-22T22:10:03.000Z`
- `estado = Documentacao`
- resultado real: **HTTP 200 OK**

### Query direta DEPOIS do passo 2 e ANTES do passo 3

SOQL usada para a Opportunity:

```sql
SELECT Id, Id__c, AccountId, StageName, EventTime__c, Pricebook2Id,
       RecordTypeId, Unidade__c, CidadeUnidade__c
FROM Opportunity
WHERE Id__c = 'OPP-SIM-b50986abbc-23c09350ab'
```

SOQL usada para o item:

```sql
SELECT Id, OpportunityId, Id__c, PricebookEntryId, Product2Id, Quantity, UnitPrice
FROM OpportunityLineItem
WHERE OpportunityId = '006HZ00000U0GUxYAN'
```

Estado observado após o passo 2:

- `Opportunity.Id = 006HZ00000U0GUxYAN`
- `AccountId = 001HZ000011RgpHYAS`
- `StageName = Qualificação de Documentos`
- `EventTime__c = 2026-09-22T22:10:03.000+0000`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` após o passo 2:

- `Id = 00kHZ00000BM3XfYAL`
- `OpportunityId = 006HZ00000U0GUxYAN`
- `Id__c = 006HZ00000U0GUxYAN1`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Passo 3 — update com `estado='SP'`

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-b50986abbc-b0643d10`
- `EventTime = 2026-09-22T22:10:06.000Z`
- `dataalteracao = 2026-09-22T22:10:06.000Z`
- `estado = SP`
- resultado real: **HTTP 200 OK**

### Query direta DEPOIS do passo 3

SOQL da Opportunity (mesma query do passo 2):

```sql
SELECT Id, Id__c, AccountId, StageName, EventTime__c, Pricebook2Id,
       RecordTypeId, Unidade__c, CidadeUnidade__c
FROM Opportunity
WHERE Id__c = 'OPP-SIM-b50986abbc-23c09350ab'
```

SOQL do item (mesma query funcional, com o mesmo `OpportunityId`):

```sql
SELECT Id, OpportunityId, Id__c, PricebookEntryId, Product2Id, Quantity, UnitPrice
FROM OpportunityLineItem
WHERE OpportunityId = '006HZ00000U0GUxYAN'
```

Estado observado após o passo 3:

- `Opportunity.Id = 006HZ00000U0GUxYAN`
- `AccountId = 001HZ000011RgpHYAS`
- `StageName = Qualificação de Documentos`
- `EventTime__c = 2026-09-22T22:10:06.000+0000`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` após o passo 3:

- `Id = 00kHZ00000BM9EPYA1`
- `OpportunityId = 006HZ00000U0GUxYAN`
- `Id__c = 006HZ00000U0GUxYAN1`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Resultado real observado

O comportamento real em `mrv-devDan` ficou **alinhado ao contrato teórico**
para o que este incremento realmente valida:

- o passo 3 com `estado = SP` retornou **HTTP 200 OK**;
- a **mesma Opportunity** foi preservada (`006HZ00000U0GUxYAN`);
- o `StageName` **não mudou** após o passo 3 e permaneceu em
  **`Qualificação de Documentos`**;
- a Opportunity continuou **única** (`count = 1` por `Id__c`);
- o total de `OpportunityLineItem` permaneceu **1**.

Observação real adicional importante: o update com `estado='SP'` **não** foi um
no-op total. Embora a fase tenha sido preservada, o `EventTime__c` avançou de
`22:10:03` para `22:10:06`, e o `OpportunityLineItem` observado após o passo 3
veio com `Id` físico diferente do item visto após o passo 2. Ou seja: o Apex
tolera o valor de `Estado` desconhecido **sem alterar a fase**, mas ainda
processa normalmente o restante do evento.

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

- 1 `OpportunityLineItem`
- 1 `Opportunity`
- 1 `Account`

Estado final pós-cleanup:

- `Account`: `0`
- `Opportunity`: `0`
- `OpportunityLineItem`: `0`

## Rastreabilidade com os logs reais

Este incremento implementa diretamente o achado da **seção 9** de
`docs/staging-logs-analysis.md`: **≈55%** da amostra real de sucesso em
`jornadausuario-*` usa `Estado` em sigla de UF (`SP`/`MG`/`MT`), enquanto uma
amostra separada de `insert` mostrou **100% `Estado="Unidades"`**. O cenário
`maquina-estado-update-estado-nao-reconhecido` fixa exatamente esse padrão
real majoritário em `update` e comprova ao vivo, em `mrv-devDan`, que o
resultado líquido esperado é **preservação do `StageName` atual com HTTP 200**.
