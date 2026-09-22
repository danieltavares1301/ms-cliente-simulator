# Tarefa 7.2 — `/MaquinaEstado` (incremento 3: `jornadausuario-update`)

## Escopo deste incremento

Este incremento cobre o caminho básico de `jornadausuario-update` já observado
em produção real:

- uma `Opportunity` já existente recebe atualização de estado;
- a mesma `Opportunity` deve ser reaproveitada, sem duplicação;
- o erro real `Cliente(Account) não encontrado` é retestado agora em `update`.

Foram publicados dois cenários:

- `maquina-estado-update-transicao-estado`
- `maquina-estado-update-sem-cliente-falha`

## Confirmação do mapeamento Apex

Antes de fixar o assert de fase, a lógica foi relida no Apex real
`NotificacaoMaquinaEstado.cls`:

- branch: `valorJson == 'DOCUMENTACAO'`
- retorno: `StageName = 'Qualificação de Documentos'`

O payload do passo de update usa o valor real observado nos logs:
`estado = 'Documentacao'`. Em Apex, `==` entre `String` é case-insensitive, então
o branch `DOCUMENTACAO` continua sendo atingido.

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. o catálogo ainda não publicava os dois cenários de update;
2. a fixture ainda não renderizava o par insert→update reutilizando o mesmo
   `Id__c` externo da `Opportunity`;
3. o adapter ainda não verificava o estado final do cenário de update.

Cobertura exercitada:

- `src/scenarios/catalog.test.ts`
- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/maquina-estado-scenario.test.ts`
- `src/salesforce/test-data-adapter.maquina-estado.test.ts`

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

---

## Cenário A — `maquina-estado-update-transicao-estado`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a `Account`
  `001HZ000011RRRIYA4`;
- `setupResult.status = CREATED`.

Identidade sintética criada:

- `Account.Id__c = CLI-SIM-bb40c6651d-74c539723d`
- `Account.IdProspectSalesforce__c = PRO-SIM-bb40c6651d-74c539723d`

### Passo 1 — criação inicial (`jornadausuario-insert`)

- endpoint: `/services/apexrest/MaquinaEstado`
- resultado real: **HTTP 200 OK**

### Query direta ANTES do passo 2

Chave externa da `Opportunity`:

- `Id__c = OPP-SIM-bb40c6651d-74c539723d`

Estado observado após o insert e antes do update:

- `Opportunity.Id = 006HZ00000U08AqYAJ`
- `AccountId = 001HZ000011RRRIYA4`
- `StageName = Simulação`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` presente antes do update:

- `Id = 00kHZ00000BM5FdYAL`
- `OpportunityId = 006HZ00000U08AqYAJ`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Passo 2 — update real (`jornadausuario-update`)

- endpoint: `/services/apexrest/MaquinaEstado`
- payload real usado no campo `estado`: `Documentacao`
- resultado real: **HTTP 200 OK**

### Query direta DEPOIS do passo 2

Estado observado após o update:

- `Opportunity.Id = 006HZ00000U08AqYAJ`
- `AccountId = 001HZ000011RRRIYA4`
- `StageName = Qualificação de Documentos`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` após o update:

- `Id = 00kHZ00000BM5IrYAL`
- `OpportunityId = 006HZ00000U08AqYAJ`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

### Conclusão objetiva do cenário A

- a **mesma `Opportunity` real** foi reaproveitada
  (`006HZ00000U08AqYAJ` antes e depois);
- não houve duplicação de `Opportunity` (`totalSize = 1` por `Id__c`);
- a fase foi atualizada de **`Simulação`** para
  **`Qualificação de Documentos`**;
- o total de `OpportunityLineItem` permaneceu **1**.

> Observação real: o `OpportunityLineItem` consultado antes e depois do update
> apareceu com `Id` diferente, mas a `Opportunity` permaneceu a mesma e a
> contagem ficou em `1`. O cenário automatizado portanto fixa apenas a ausência
> de duplicação (`count = 1`), não a estabilidade do `Id` do item.

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

---

## Cenário B — `maquina-estado-update-sem-cliente-falha`

### Setup real

- nenhum registro foi criado;
- `setupResult.status = READY`;
- a fixture confirmou ausência prévia da identidade sintética.

### Dispatch real

- endpoint: `/services/apexrest/MaquinaEstado`
- evento: `jornadausuario-update`
- `expectedHttpStatus = 400`
- resultado real: **HTTP 400 Bad Request**

Corpo real observado:

```json
{
  "Status": "Error",
  "Message": "Cliente(Account) não encontrado no Salesforce. clienteProspect.idClient: null. clienteProspect.idProspectSalesforce: PRO-SIM-b48711e8d5-3683bb5dd1."
}
```

### Evidência por query direta

Chave externa da `Opportunity`:

- `Id__c = OPP-SIM-b48711e8d5-3683bb5dd1`

Estado observado depois do dispatch e antes do cleanup:

- `Opportunity WHERE Id__c = 'OPP-SIM-b48711e8d5-3683bb5dd1'` →
  `totalSize = 0`
- `OpportunityLineItem WHERE Opportunity.Id__c = 'OPP-SIM-b48711e8d5-3683bb5dd1'`
  → `totalSize = 0`

### Verificação automatizada

`verify()` passou com **2/2 checks**:

- `OPPORTUNITY_NOT_CREATED`
- `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 0`

### Cleanup real

- `cleanupResult.status = NO_OP`
- `deletedCount = 0`

Estado final pós-cleanup:

- `Account`: `0`
- `Opportunity`: `0`
- `OpportunityLineItem`: `0`

### Conclusão observada

> O reteste em `update` reproduziu o mesmo erro funcional já confirmado em
> `insert`: sem `Account` prévia para o prospect, o Apex devolve
> **HTTP 400** com mensagem consistente de **`Cliente(Account) não encontrado`**
> e não cria nenhum registro de `Opportunity`/`OpportunityLineItem`.

## Resumo do incremento

- o catálogo agora cobre o happy path básico de `jornadausuario-update`;
- ficou comprovado por query direta que o update reutiliza a **mesma
  `Opportunity` real**, em vez de criar uma nova;
- o erro 400 real sem `Account` foi retestado com `eventType =
  jornadausuario-update`;
- o cleanup manual/automatizado não deixou resíduos em `mrv-devDan`.
