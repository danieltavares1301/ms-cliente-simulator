# Tarefa 7.2 — `/MaquinaEstado` (incremento 7: `estado='troca_unidade'`)

## Escopo deste incremento

Este incremento cobre o branch dedicado `troca_unidade` / `TrocarUnidade` em
`jornadausuario-update`, motivado pelo achado real documentado na seção 10 de
[`docs/staging-logs-analysis.md`](../staging-logs-analysis.md):

- amostra real de **250** `jornadausuario-update`;
- `Estado='troca_unidade'` / `'TrocarUnidade'` em **6/250 (~2,4%)**;
- payload real confirmado com `IdUnidade` explícito;
- contrato Apex com branch dedicado, preservando `StageName` da `Opportunity`
  existente e falhando explicitamente quando ela não existe.

Cenários publicados:

- `maquina-estado-update-troca-unidade`
- `maquina-estado-insert-troca-unidade-falha`

## Contrato Apex confirmado

```apex
else if (valorJson == 'troca_unidade' || valorJson == 'TrocarUnidade') {
    if (oportunidadeExistente == null) {
        throw new NotificacaoException('Oportunidade não encontrada para troca de unidade');
    }
    return oportunidadeExistente.StageName;
}
```

Implicações esperadas:

1. em `update`, `StageName` deve ser **preservado**;
2. `idunidade` continua sendo mapeado genericamente para `Unidade__c` /
   `Unidade__r`, então a unidade real deve ser trocada;
3. em `insert` sem `Opportunity` prévia, o resultado deve ser uma falha de
   negócio explícita.

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. o catálogo ainda não publicava os dois novos cenários;
2. a fixture ainda não renderizava a sequência
   `insert -> update(Documentacao) -> update(troca_unidade)` reutilizando o
   mesmo `Id__c` externo da `Opportunity`;
3. o adapter ainda não verificava a unidade final da `Opportunity` nem o
   `Product2` final do `OpportunityLineItem`.

Cobertura adicionada/ajustada:

- `src/scenarios/catalog.test.ts`
- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/fixture-validation.test.ts`
- `src/scenarios/maquina-estado-scenario.test.ts`
- `src/salesforce/test-data-adapter.maquina-estado.test.ts`

## Product2 reais usados

### Product2 base do smoke test

| Campo | Valor real |
| --- | --- |
| `Product2.Id` | `01t4T000002VELyQAO` |
| `Product2.Id__c` | `37dd20e6-4b3c-ea11-801d-005056856875` |
| `Product2.Name` | `Lavatório em granito Verde Ubatuba com cuba de embutir em louça` |
| `Product2.IsActive` | `true` |
| `Product2.Cidade__c` | `null` |
| `PricebookEntry.Id` | `01u4T0000047yxRQAQ` |
| `Pricebook2Id` | `01s4T000000c1bEQAQ` |
| `PricebookEntry.IsActive` | `true` |

### Segundo Product2 real selecionado para a troca

| Campo | Valor real |
| --- | --- |
| `Product2.Id` | `01tV200000AQbuDIAT` |
| `Product2.Id__c` | `6eeda6b4-1ee9-48a2-a5db-123044783c25` |
| `Product2.Name` | `Ponta Térreo e Tipo 3QSV - Flexibilização 4 - 2QSV com Closet, Banheiro Social Estendido, Home Office, Sala Integrada com Cozinha e Área de Serviço` |
| `Product2.IsActive` | `true` |
| `Product2.Cidade__c` | `null` |
| `PricebookEntry.Id` | `01uV2000002uywPIAQ` |
| `Pricebook2Id` | `01s4T000000c1bEQAQ` |
| `PricebookEntry.IsActive` | `true` |

Logo, o segundo `Product2` é **ativo**, possui `PricebookEntry` ativa no
**Price Book padrão** e não reproduz o problema histórico de `Cidade__c`
inconsistente/inexistente.

---

## Diagnóstico preciso do HTTP 500 observado inicialmente

### Conclusão final do diagnóstico

O **HTTP 500 inicial não era um bug funcional do branch `troca_unidade`**.

Ele foi causado por **dois defeitos no harness de diagnóstico/manual usado para
disparar os eventos**, e ambos foram **mascarados** por um bug secundário real
do Apex em `NotificacaoMaquinaEstado.realizaPost`.

### Evidência 1 — stack trace real do `ApexLog`

Reprodução com `TraceFlag` temporário (`APEX_CODE=FINEST`, `DB=FINEST`) contra
`mrv-devDan` e coleta via Tooling API:

```sql
SELECT Id, Operation, Status, StartTime, LogLength
FROM ApexLog
WHERE Operation = '/MaquinaEstado'
ORDER BY StartTime DESC
LIMIT 3
```

Log capturado: `07LHZ00000P0ulb2AB`

Trecho decisivo do log:

```text
19:57:21.0 (...)|VARIABLE_ASSIGNMENT|[217]|e|
"common.apex.runtime.impl.ExecutionException: Invalid conversion from runtime type Map<String,ANY> to List<ANY>"

19:57:21.0 (...)|FATAL_ERROR|System.NullPointerException: Attempt to de-reference a null object

Class.NotificacaoMaquinaEstado.realizaPost: line 218, column 1
```

### Evidência 2 — código real lido da org

#### `NotificacaoMaquinaEstado.realizaPost`

```apex
13: Opportunity sObjOportunidade = null;
14: NotificacaoHelper notificacao = null;
...
18: RestResponse res = RestContext.response;
19: notificacao = new NotificacaoHelper();
...
216: catch ( Exception e )
217: {
218:     responderErroEPublicarLogIntegracao(
            e,
            String.valueOf(notificacao.mapData.get('EventType')),
            sObjOportunidade != null ? sObjOportunidade : null
        );
219: }
```

#### `NotificacaoHelper.<init>`

```apex
24: Object objResponse = JSON.deserializeUntyped(this.req.requestBody.toString());
27: List<Object> mapTemp = (List<Object>) objResponse;
28: this.mapResponse = Conversor.converterMinusculo((Map<String, Object>) mapTemp[0]);
```

### Causa raiz REAL do primeiro 500

No primeiro rerun com log detalhado, o request body que o harness enviou era um
**objeto JSON simples** (`{ ... }`) em vez do **array Event Grid**
(`[{ ... }]`).

Isso provocou a exceção original:

```text
common.apex.runtime.impl.ExecutionException:
Invalid conversion from runtime type Map<String,ANY> to List<ANY>
```

em `NotificacaoHelper`, porque:

- `JSON.deserializeUntyped(...)` devolveu um **`Map<String, Object>`**;
- a linha 27 faz cast cego para **`List<Object>`**.

### Causa raiz REAL do segundo 500 durante o diagnóstico

Ao corrigir a cardinalidade, um segundo erro do harness apareceu: o payload
salvo em arquivo com `Set-Content -Encoding utf8` saiu com **BOM UTF-8**
(`U+FEFF`) e foi enviado assim ao Apex.

Trecho real do segundo `ApexLog` (`07LHZ00000P0vmT2AR`):

```text
19:59:59.6 (...)|VARIABLE_ASSIGNMENT|[217]|e|
"common.apex.runtime.impl.ExecutionException:
Unexpected character ('﻿' (code 65279 / 0xfeff)):
expected a valid value (number, String, array, object, 'true', 'false' or 'null')
at input location [1,2]"
```

Ou seja: o segundo 500 também foi disparado **antes** da regra de negócio de
`troca_unidade`, por um JSON inválido gerado pelo harness.

### Bug REAL no Apex confirmado por este diagnóstico

Embora o 500 inicial não fosse causado pelo branch `troca_unidade`, o
diagnóstico confirmou um **bug real no Apex**:

- `NotificacaoMaquinaEstado.realizaPost` captura a exceção original;
- em seguida, a linha 218 tenta acessar `notificacao.mapData.get('EventType')`;
- quando `NotificacaoHelper` falha antes de popular `mapData`, o catch produz
  uma **segunda exceção** (`System.NullPointerException`) e **mascara a causa
  real**.

Em outras palavras:

1. **erro primário real** = parse/deserialização do request body;
2. **erro secundário real do Apex** = o catch da linha 218 quebra ao tentar
   montar o log de erro e apaga o contexto da falha original.

Portanto, existe sim um **bug de robustez/observabilidade no Apex**,
independente do branch `troca_unidade`.

---

## Execução real CORRETA após corrigir o harness

Depois de corrigir o dispatch manual para:

- enviar **array Event Grid real** (`[{ ... }]`);
- gravar o JSON **sem BOM**;

os cenários foram reexecutados com sucesso funcional esperado.

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

---

## Cenário A — `maquina-estado-update-troca-unidade`

### Fixture usada

- `runId = run_phase7_maquina_troca_unidade_20260922a`
- `seed = phase7-inc7-real-20260922a`
- `Account.Id__c = CLI-SIM-a2c6bde131-43e0bd82fb`
- `Account.IdProspectSalesforce__c = PRO-SIM-a2c6bde131-43e0bd82fb`
- `Opportunity.Id__c = OPP-SIM-a2c6bde131-43e0bd82fb`

### Setup real

- `Account.Id = 001HZ000011Rw21YAC`

### Passo 1 — `jornadausuario-insert`

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-a2c6bde131-ecd8ffb2`
- `estado = SIMULACAO`
- `idunidade = 37dd20e6-4b3c-ea11-801d-005056856875`
- resultado real: **HTTP 200**

Estado após o passo 1:

- `Opportunity.Id = 006HZ00000U0Q2sYAF`
- `StageName = Simulação`
- `EventTime__c = 2026-09-22T23:00:00.000+0000`
- `Unidade__c = 01t4T000002VELyQAO`
- `Unidade__r.Id__c = 37dd20e6-4b3c-ea11-801d-005056856875`

### Passo 2 — `jornadausuario-update` para Documentação

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-a2c6bde131-eeda6f4c`
- `estado = Documentacao`
- `idunidade = 37dd20e6-4b3c-ea11-801d-005056856875`
- resultado real: **HTTP 200**

Query direta depois do passo 2:

- `Opportunity.Id = 006HZ00000U0Q2sYAF`
- `StageName = Qualificação de Documentos`
- `EventTime__c = 2026-09-22T23:00:03.000+0000`
- `Unidade__c = 01t4T000002VELyQAO`
- `Unidade__r.Id__c = 37dd20e6-4b3c-ea11-801d-005056856875`
- `OpportunityLineItem.Id = 00kHZ00000BM9uLYAT`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Product2.Id__c = 37dd20e6-4b3c-ea11-801d-005056856875`

### Passo 3 — `jornadausuario-update` com `estado='troca_unidade'`

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-a2c6bde131-8a1c100b`
- `estado = troca_unidade`
- `idunidade = 6eeda6b4-1ee9-48a2-a5db-123044783c25`
- resultado real: **HTTP 200**

Query direta depois do passo 3:

- `Opportunity.Id = 006HZ00000U0Q2sYAF`
- `StageName = Qualificação de Documentos`
- `EventTime__c = 2026-09-22T23:00:06.000+0000`
- `Unidade__c = 01tV200000AQbuDIAT`
- `Unidade__r.Id__c = 6eeda6b4-1ee9-48a2-a5db-123044783c25`
- `OpportunityLineItem.Id = 00kHZ00000BM9vxYAD`
- `PricebookEntryId = 01uV2000002uywPIAQ`
- `Product2Id = 01tV200000AQbuDIAT`
- `Product2.Id__c = 6eeda6b4-1ee9-48a2-a5db-123044783c25`

### Conclusão objetiva do cenário A

Com o payload correto:

- o cenário inteiro retornou **200 / 200 / 200**;
- a `Opportunity` permaneceu **a mesma** (`006HZ00000U0Q2sYAF`);
- `StageName` foi preservado em
  **`Qualificação de Documentos`** no passo 3;
- `Unidade__c` foi trocada para o **segundo `Product2` real**;
- o `OpportunityLineItem` final também passou a apontar para o **segundo
  `Product2` / `PricebookEntry` real**.

Isto confirma o comportamento funcional esperado do branch
`troca_unidade`.

---

## Cenário B — `maquina-estado-insert-troca-unidade-falha`

### Fixture usada

- `runId = run_phase7_maquina_insert_troca_unidade_20260922b`
- `seed = phase7-inc7-real-20260922b`
- `Account.Id__c = CLI-SIM-97b2c9a0cc-10e343f68d`
- `Account.IdProspectSalesforce__c = PRO-SIM-97b2c9a0cc-10e343f68d`
- `Opportunity.Id__c = OPP-SIM-97b2c9a0cc-10e343f68d`

### Setup real

- `Account.Id = 001HZ000011RbwyYAC`

### Dispatch real

- endpoint: `/services/apexrest/MaquinaEstado`
- evento: `jornadausuario-insert`
- `estado = troca_unidade`
- `idunidade = 37dd20e6-4b3c-ea11-801d-005056856875`
- resultado real: **HTTP 400**

Corpo real observado:

```json
{ "Status": "Error", "Message": "Oportunidade não encontrada para troca de unidade" }
```

### Query direta depois do dispatch

- `Opportunity WHERE Id__c = 'OPP-SIM-97b2c9a0cc-10e343f68d'` →
  `totalSize = 0`
- `OpportunityLineItem` vinculado → `totalSize = 0`

### Conclusão objetiva do cenário B

Com o payload correto, o comportamento ficou **100% alinhado ao contrato**:

- o Apex retornou **HTTP 400**;
- a mensagem de negócio foi explícita:
  **`Oportunidade não encontrada para troca de unidade`**;
- nenhuma `Opportunity` foi criada.

---

## Limpeza final

Ao final da rodada de diagnóstico:

- `Account` residual do cenário A: `0`
- `Opportunity` residual do cenário A: `0`
- `Account` residual do cenário B: `0`
- `Opportunity` residual do cenário B: `0`
- `TraceFlag` temporária removida
- `DebugLevel` temporária removida

---

## Conclusão final

### O que estava errado

Os `HTTP 500` inicialmente documentados neste incremento **não eram prova de um
bug funcional do branch `troca_unidade`**. Eles foram causados pelo harness de
diagnóstico/manual:

1. primeiro enviando **objeto** em vez de **array Event Grid**;
2. depois enviando JSON com **BOM UTF-8**.

### O que o ApexLog provou

O `ApexLog` com `TraceFlag` detalhada confirmou, com evidência primária:

- a exceção original do primeiro caso:
  `Invalid conversion from runtime type Map<String,ANY> to List<ANY>`;
- a exceção original do segundo caso:
  `Unexpected character ('﻿' code 65279 / 0xfeff)`;
- e o bug secundário real do Apex:
  o catch em `NotificacaoMaquinaEstado.realizaPost` linha **218** mascara o
  erro original com um `System.NullPointerException`.

### O que ficou confirmado funcionalmente

Depois de corrigir o harness:

- **Cenário A**: sucesso completo, com preservação de `StageName` e troca real
  de `Unidade__c` / `OpportunityLineItem.Product2Id`;
- **Cenário B**: falha explícita correta com **HTTP 400** e sem criação de
  `Opportunity`.

Portanto:

- **não há bug funcional confirmado no branch `troca_unidade`**;
- **há um bug real de tratamento de erro no Apex** que mascara falhas de parse
  do request body.
