# Tarefa 7.2 — `/MaquinaEstado` (incremento 7: `estado='troca_unidade'`)

## Escopo deste incremento

Este incremento materializa os dois cenários derivados do achado real da seção
10 de [`docs/staging-logs-analysis.md`](../staging-logs-analysis.md):

- `maquina-estado-update-troca-unidade`
- `maquina-estado-insert-troca-unidade-falha`

Motivação objetiva do log real:

- amostra de **250** `jornadausuario-update`;
- `Estado='troca_unidade'` / `'TrocarUnidade'` em **6/250 (~2,4%)**;
- payload real inclui um **`IdUnidade`** explícito;
- o branch Apex é **dedicado** (não fallback), preserva `StageName` quando a
  `Opportunity` existe e deveria falhar explicitamente quando ela não existe.

## Contrato Apex confirmado antes da implementação

```apex
else if (valorJson == 'troca_unidade' || valorJson == 'TrocarUnidade') {
    if (oportunidadeExistente == null) {
        throw new NotificacaoException('Oportunidade não encontrada para troca de unidade');
    }
    return oportunidadeExistente.StageName;
}
```

Implicações esperadas pelo contrato:

1. `jornadausuario-update` com `estado='troca_unidade'` deve **preservar a fase
   atual** da `Opportunity`;
2. o campo `idunidade` continua sendo mapeado genericamente para
   `Unidade__r` / `Unidade__c`, então a unidade deveria ser trocada;
3. `jornadausuario-insert` com `estado='troca_unidade'` e sem `Opportunity`
   prévia deveria falhar de forma explícita.

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

## Product2 reais usados na tentativa de execução

As queries abaixo foram feitas em **modo somente leitura** contra `mrv-devDan`
antes da execução real.

### Product2 base já estável do smoke test

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

Ou seja: o segundo `Product2` é **ativo**, tem `PricebookEntry` ativa no
**Price Book padrão** e **não** reproduz o problema histórico de
`Cidade__c` inconsistente/inexistente.

---

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

### Resultado geral observado

As duas execuções reais ficaram **bloqueadas por um erro inesperado do Apex
antes mesmo de atingir a semântica específica de `troca_unidade`**:

- **HTTP 500 Internal Server Error**
- corpo real:

```json
{
  "value": [
    {
      "errorCode": "APEX_ERROR",
      "message": "System.NullPointerException: Attempt to de-reference a null object\n\nClass.NotificacaoMaquinaEstado.realizaPost: line 218, column 1"
    }
  ],
  "Count": 1
}
```

Isto aconteceu:

- no passo de `jornadausuario-insert` que deveria ser equivalente ao smoke test
  mínimo já validado em incrementos anteriores;
- no `update(Documentacao)`;
- no `update(troca_unidade)`;
- e também no `insert(troca_unidade)` negativo.

Portanto, **o bloqueio atual está antes da validação funcional específica deste
incremento**.

---

## Cenário A — `maquina-estado-update-troca-unidade`

### Fixture usada

- `runId = run_phase7_maquina_troca_unidade_20260922a`
- `seed = phase7-inc7-real-20260922a`
- `Account.Id__c = CLI-SIM-a2c6bde131-43e0bd82fb`
- `Account.IdProspectSalesforce__c = PRO-SIM-a2c6bde131-43e0bd82fb`
- `Opportunity.Id__c = OPP-SIM-a2c6bde131-43e0bd82fb`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a `Account`
  `001HZ000011RpTjYAK`.

### Passo 1 — `jornadausuario-insert` inicial

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-a2c6bde131-ecd8ffb2`
- `estado = SIMULACAO`
- `idunidade = 37dd20e6-4b3c-ea11-801d-005056856875`
- resultado real: **HTTP 500 Internal Server Error**

### Passo 2 — `jornadausuario-update` para Documentação

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-a2c6bde131-eeda6f4c`
- `estado = Documentacao`
- `idunidade = 37dd20e6-4b3c-ea11-801d-005056856875`
- resultado real: **HTTP 500 Internal Server Error**

### Query direta depois do passo 2

SOQL executada:

```sql
SELECT Id, Id__c, AccountId, StageName, EventTime__c, Pricebook2Id, RecordTypeId,
       Unidade__c, Unidade__r.Id__c, Unidade__r.Name, CidadeUnidade__c
FROM Opportunity
WHERE Id__c = 'OPP-SIM-a2c6bde131-43e0bd82fb'
```

Resultado observado:

- `totalSize = 0`
- nenhuma `Opportunity` criada
- nenhum `OpportunityLineItem` consultável, porque não houve `OpportunityId`

### Passo 3 — `jornadausuario-update` com `estado='troca_unidade'`

- endpoint: `/services/apexrest/MaquinaEstado`
- `Event Id = EVT-SIM-a2c6bde131-8a1c100b`
- `estado = troca_unidade`
- `idunidade = 6eeda6b4-1ee9-48a2-a5db-123044783c25`
- resultado real: **HTTP 500 Internal Server Error**

### Query direta depois do passo 3

Mesma SOQL do passo 2:

```sql
SELECT Id, Id__c, AccountId, StageName, EventTime__c, Pricebook2Id, RecordTypeId,
       Unidade__c, Unidade__r.Id__c, Unidade__r.Name, CidadeUnidade__c
FROM Opportunity
WHERE Id__c = 'OPP-SIM-a2c6bde131-43e0bd82fb'
```

Resultado observado:

- `totalSize = 0`
- nenhuma `Opportunity` criada
- nenhuma `Unidade__c` para inspecionar
- nenhum `OpportunityLineItem` criado

### Conclusão objetiva do cenário A

O comportamento esperado do incremento (**preservar `StageName='Qualificação de
Documentos'` e trocar `Unidade__c` para o segundo `Product2`**) **não pôde ser
validado**, porque o endpoint falhou antes da criação da `Opportunity` já no
primeiro passo, com o mesmo `NullPointerException` em todos os três dispatches.

Como o passo 1 é funcionalmente equivalente ao smoke test mínimo já consolidado,
o bloqueio observado indica uma **regressão externa na org / no Apex atual de
`mrv-devDan`**, e não um problema específico do branch `troca_unidade` em si.

### Cleanup real

- a `Account` sintética foi removida manualmente ao final;
- contagem final pós-cleanup:
  - `Account = 0`
  - `Opportunity = 0`

---

## Cenário B — `maquina-estado-insert-troca-unidade-falha`

### Fixture usada

- `runId = run_phase7_maquina_insert_troca_unidade_20260922b`
- `seed = phase7-inc7-real-20260922b`
- `Account.Id__c = CLI-SIM-97b2c9a0cc-10e343f68d`
- `Account.IdProspectSalesforce__c = PRO-SIM-97b2c9a0cc-10e343f68d`
- `Opportunity.Id__c = OPP-SIM-97b2c9a0cc-10e343f68d`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a `Account`
  `001HZ000011RVlZYAW`.

### Dispatch real

- endpoint: `/services/apexrest/MaquinaEstado`
- evento: `jornadausuario-insert`
- `estado = troca_unidade`
- `idunidade = 37dd20e6-4b3c-ea11-801d-005056856875`
- resultado real observado: **HTTP 500 Internal Server Error**

Corpo real observado:

```json
{
  "value": [
    {
      "errorCode": "APEX_ERROR",
      "message": "System.NullPointerException: Attempt to de-reference a null object\n\nClass.NotificacaoMaquinaEstado.realizaPost: line 218, column 1"
    }
  ],
  "Count": 1
}
```

### Query direta depois do dispatch

SOQL executada:

```sql
SELECT Id, Id__c, AccountId, StageName, EventTime__c, Pricebook2Id, RecordTypeId,
       Unidade__c, Unidade__r.Id__c, Unidade__r.Name, CidadeUnidade__c
FROM Opportunity
WHERE Id__c = 'OPP-SIM-97b2c9a0cc-10e343f68d'
```

Resultado observado:

- `totalSize = 0`
- nenhuma `Opportunity` criada
- nenhum `OpportunityLineItem` criado

### Conclusão objetiva do cenário B

O resultado real **divergiu da teoria de contrato**:

- esperado pelo branch dedicado: falha explícita de negócio (ex.: HTTP 400 /
  `NotificacaoException` “Oportunidade não encontrada para troca de unidade”);
- observado na prática: **HTTP 500** por
  `System.NullPointerException` em `Class.NotificacaoMaquinaEstado.realizaPost`
  **antes** da criação de qualquer `Opportunity`.

Ainda assim, ficou confirmado por query que **nenhuma `Opportunity` foi criada**.

### Cleanup real

- a `Account` sintética foi removida manualmente ao final;
- contagem final pós-cleanup:
  - `Account = 0`
  - `Opportunity = 0`

---

## Conclusão final deste incremento

### O que ficou implementado no simulador

- cenário `maquina-estado-update-troca-unidade`;
- cenário `maquina-estado-insert-troca-unidade-falha`;
- checks automatizados para:
  - `OPPORTUNITY_UNIDADE_EXTERNAL_ID_EQUALS_EXPECTED`
  - `OPPORTUNITY_LINE_ITEM_PRODUCT_EXTERNAL_ID_EQUALS_EXPECTED`

### O que a execução real provou

- o segundo `Product2` real selecionado é válido para teste (ativo, com
  `PricebookEntry` ativa e `Cidade__c = null`);
- **o endpoint `/MaquinaEstado` em `mrv-devDan` está atualmente bloqueado por
  um `NullPointerException` na linha 218 de
  `NotificacaoMaquinaEstado.realizaPost`**, inclusive no caminho inicial de
  `jornadausuario-insert` que deveria reproduzir o smoke já consolidado;
- por isso, **a semântica funcional específica de `troca_unidade` não pôde ser
  confirmada ao vivo nesta rodada**.

### Bloqueio que precisa de atenção externa

Antes de reexecutar este incremento com expectativa de sucesso funcional, é
necessário corrigir/investigar no lado Salesforce:

1. a regressão atual de `/MaquinaEstado` em `mrv-devDan` (NPE na linha 218);
2. por consequência, o desvio do cenário B, que hoje responde **500** em vez de
   materializar a falha explícita de negócio esperada pelo contrato do branch
   `troca_unidade`.

**Nenhum Permission Set foi alterado e nenhum arquivo do repositório Salesforce
foi tocado nesta tarefa.**
