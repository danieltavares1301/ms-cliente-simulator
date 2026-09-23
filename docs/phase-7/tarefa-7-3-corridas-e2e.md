# Tarefa 7.3 — Corridas end-to-end cross-endpoint

## Escopo

Esta tarefa adiciona 3 cenários **cross-endpoint** combinando `/Cliente`,
`/PAC` e `/MaquinaEstado`:

- `e2e-opportunity-permanece-conta-aprovada`
- `e2e-evento-obsoleto-sem-cliente-ignorado`
- `e2e-evento-atual-reentregue-apos-cliente-insert`

## Decisão de modelagem

Para o critério **“Opportunity permanece na Account aprovada”** não foi
necessário criar um check novo. A Account **aprovada** foi modelada como
`PRIMARY` e a identidade antiga como `CONTROL`; assim, o critério fica provado
reaproveitando o check existente
`OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT`.

## TDD executado

Antes da implementação foram adicionados testes que falhavam cobrindo:

- publicação das 3 novas definições no catálogo;
- renderização determinística das fixtures cross-endpoint;
- compatibilidade do `SalesforceTestDataAdapter` com:
  - `/MaquinaEstado` apontando para identidade `CONTROL`;
  - `/MaquinaEstado` com identidade sintética “X” sem Account real;
  - `/PAC` referenciando uma Opportunity criada por step anterior de
    `/MaquinaEstado` (sem `CREATE_SYNTHETIC_OPPORTUNITY` no setup).

Cobertura exercitada:

- `src/scenarios/cross-endpoint-scenario.test.ts`
- `src/scenarios/catalog.test.ts`
- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/fixture-validation.test.ts`
- `src/scenarios/renderer.test.ts`
- `src/salesforce/test-data-adapter.maquina-estado.test.ts`

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Usuário autenticado**:
  `tavares.daniel@parceiro.mrv.com.br.danieldev`

Todas as queries abaixo foram feitas diretamente na org real via REST/SOQL
durante a execução. Ao final de cada cenário, o cleanup removeu os registros e
as queries finais retornaram `0` resíduos.

---

## Cenário 1 — `e2e-opportunity-permanece-conta-aprovada`

### Identidade sintética

- `runId = run_phase7_task73_keep_account_20260922a`
- Account antiga (**CONTROL**):
  `CLI-SIM-X-fbcf43488d-4f13937070` → `001HZ000011RuSvYAK`
- Account aprovada (**PRIMARY**):
  `CLI-SIM-fbcf43488d-4f13937070` → `001HZ000011S1zPYAS`
- Opportunity:
  `OPP-SIM-fbcf43488d-4f13937070` → `006HZ00000U0UT3YAN`
- PAC:
  `PAC-SIM-fbcf43488d-4f13937070` → `a0kHZ00000BMASDYA5`

### Sequência real observada

1. `maquina-estado-insert-conta-antiga` → **HTTP 200**
2. `cliente-insert-conta-aprovada` → **HTTP 200**
3. `pac-insert-aprovado` → **HTTP 200**
4. `maquina-estado-update-identidade-antiga` → **HTTP 200**

### Query direta após o passo 1

- `Account` antiga:
  - `Id = 001HZ000011RuSvYAK`
  - `Id__c = CLI-SIM-X-fbcf43488d-4f13937070`
  - `IdProspectSalesforce__c = PRO-SIM-X-fbcf43488d-4f13937070`
- `Opportunity`:
  - `Id = 006HZ00000U0UT3YAN`
  - `AccountId = 001HZ000011RuSvYAK`
  - `StageName = Simulação`
  - `EventTime__c = 2026-09-22T23:10:00.000+0000`
- `OpportunityLineItem`:
  - `Id = 00kHZ00000BMATpYAP`
  - `Product2.Id__c = 37dd20e6-4b3c-ea11-801d-005056856875`

### Query direta após o passo 2 (`cliente-insert`)

- `Account` nova criada:
  - `Id = 001HZ000011S1zPYAS`
  - `Id__c = CLI-SIM-fbcf43488d-4f13937070`
  - `IdProspectSalesforce__c = null`
  - `PersonEmail = null`
  - `Celular__c = null`
- `Lead` novo criado:
  - `Id = 00QHZ00000bgsJj2AI`
  - `Id__c = afffaea8-3dc7-b998-4f0b-8da8e77779f3`
  - `Email = null`
  - `MobilePhone = null`
- `Opportunity` ainda permanecia na Account antiga:
  - `AccountId = 001HZ000011RuSvYAK`

### Query direta após o passo 3 (`pac-insert`)

- `Opportunity` foi reassociada para a Account aprovada:
  - `AccountId = 001HZ000011S1zPYAS`
  - `PACAtual__c = a0kHZ00000BMASDYA5`
- `PAC`:
  - `Id = a0kHZ00000BMASDYA5`
  - `Status__c = CREDITO_APROVADO_CONDICIONADO`
- `Proponente` principal:
  - `Id = a0jHZ00000CG4YdYAL`
  - `Id__c = PROP-SIM-fbcf43488d-4f13937070`
  - `Proponente__c = 001HZ000011S1zPYAS`
- `Account` aprovada passou a ter os contatos sincronizados:
  - `IdProspectSalesforce__c = afffaea8-3dc7-b998-4f0b-8da8e77779f3`
  - `PersonEmail = pac.4f13937070@simulador.mrv.invalid`
  - `Celular__c = 11905298738`
- `Lead` novo também foi sincronizado:
  - `Email = pac.4f13937070@simulador.mrv.invalid`
  - `MobilePhone = 11905298738`

### Query direta após o passo 4 (`/MaquinaEstado` com identidade antiga)

- `Opportunity` final:
  - `Id = 006HZ00000U0UT3YAN`
  - `AccountId = 001HZ000011S1zPYAS` **(permaneceu na Account aprovada)**
  - `StageName = Qualificação de Documentos`
  - `EventTime__c = 2026-09-22T23:10:04.000+0000`
  - `PACAtual__c = a0kHZ00000BMASDYA5`
- `OpportunityLineItem` final:
  - `Id = 00kHZ00000BMATpYAP`
  - `OpportunityId = 006HZ00000U0UT3YAN`
  - `Product2.Id__c = 37dd20e6-4b3c-ea11-801d-005056856875`

### Conclusão objetiva

O comportamento real confirmou o contrato Apex: mesmo com o último
`jornadausuario-update` chegando com `idCliente = null` e só o prospect antigo,
a `Opportunity` **não** voltou para a Account antiga. Ela permaneceu na
Account aprovada (`PRIMARY`) e ainda aplicou a transição de fase normalmente.

### Verificação automatizada

`verify()` passou com **10/10 checks**, incluindo:

- `PROPOSTA_ANALISE_CREDITO_LINKED_TO_OPPORTUNITY`
- `PROPONENTE_PRINCIPAL_LINKED_TO_ACCOUNT_AND_PAC`
- `LEAD_EMAIL_EQUALS_EXPECTED`
- `LEAD_MOBILE_EQUALS_EXPECTED`
- `OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT`
- `OPPORTUNITY_STAGE_EQUALS_EXPECTED`

### Cleanup real

- `cleanupResult.status = DELETED`
- `deletedCount = 7`
- estado final pós-cleanup:
  - `Account = 0`
  - `Opportunity = 0`
  - `Lead = 0`
  - `PAC = 0`
  - `Proponente = 0`

---

## Cenário 2 — `e2e-evento-obsoleto-sem-cliente-ignorado`

### Identidade sintética

- `runId = run_phase7_task73_obsoleto_20260922a`
- Account:
  `CLI-SIM-e1874fbbd2-3b2f87f06c` → `001HZ000011S0M5YAK`
- Opportunity:
  `OPP-SIM-e1874fbbd2-3b2f87f06c` → `006HZ00000U0UUgYAN`

### Sequência real observada

1. `maquina-estado-insert-inicial` → **HTTP 200**
2. `maquina-estado-update-documentacao-atual` → **HTTP 200**
3. `maquina-estado-update-obsoleto-sem-cliente` → **HTTP 200**

### Query direta após o passo 2

- `Opportunity`:
  - `Id = 006HZ00000U0UUgYAN`
  - `AccountId = 001HZ000011S0M5YAK`
  - `StageName = Qualificação de Documentos`
  - `EventTime__c = 2026-09-22T23:20:03.000+0000`
- `OpportunityLineItem`:
  - `Id = 00kHZ00000BMAX3YAP`
  - `OpportunityId = 006HZ00000U0UUgYAN`
  - `Product2.Id__c = 37dd20e6-4b3c-ea11-801d-005056856875`

### Query direta após o passo 3 (evento obsoleto sem cliente)

- `Opportunity` permaneceu:
  - `Id = 006HZ00000U0UUgYAN`
  - `AccountId = 001HZ000011S0M5YAK`
  - `StageName = Qualificação de Documentos`
  - `EventTime__c = 2026-09-22T23:20:03.000+0000`
- `OpportunityLineItem` permaneceu o mesmo:
  - `Id = 00kHZ00000BMAX3YAP`
  - `OpportunityId = 006HZ00000U0UUgYAN`

### Conclusão objetiva

O comportamento real ficou alinhado ao contrato Apex:

- o passo obsoleto sem cliente retornou **HTTP 200**;
- a `Opportunity` **não** mudou para contrato;
- o `EventTime__c` persistido continuou no valor do evento atual;
- não houve duplicação de `Opportunity` nem de `OpportunityLineItem`.

### Verificação automatizada

`verify()` passou com **4/4 checks**:

- `OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE`
- `OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT`
- `OPPORTUNITY_STAGE_EQUALS_EXPECTED`
- `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 1`

### Cleanup real

- `cleanupResult.status = DELETED`
- `deletedCount = 3`
- estado final pós-cleanup:
  - `Account = 0`
  - `Opportunity = 0`
  - `Lead = 0`

---

## Cenário 3 — `e2e-evento-atual-reentregue-apos-cliente-insert`

### Causa raiz definitiva no Apex real

A leitura final do Apex em `NotificacaoCliente.preencherAtributosAccount`
explicou o comportamento observado:

- `cliente-insert` **de primeira vez** cria a `Account`, mas **não** carimba
  `IdProspectSalesforce__c`;
- esse campo só é atribuído quando a mesma identidade volta via
  `cliente-update` e a `Account` **já existe**.

Portanto, a sequência real correta para destravar a reentrega não é apenas
`cliente-insert` → reentrega, e sim:

1. `jornadausuario-insert` original falha sem Account;
2. `cliente-insert` cria a Account;
3. `cliente-update` subsequente carimba `IdProspectSalesforce__c`;
4. a reentrega do mesmo `jornadausuario-insert` finalmente passa.

### Evidência intermediária: timing sozinho não resolvia

Antes de encontrar a causa raiz acima, o cenário foi reexecutado com polling
direto na `Account` por ~28s depois de **apenas** `cliente-insert`, sem
`cliente-update`. Em todas as 9 tentativas, `IdProspectSalesforce__c` ficou
`null`, com `Opportunity = 0` e `Lead = 0`.

Isso provou que **não** era um problema de “esperar mais tempo” após o
`cliente-insert` isolado.

### Diagnóstico confirmatório com `cliente-update`

Foi então executada uma corrida diagnóstica adicionando `cliente-update`
imediatamente após o `cliente-insert`:

- `runId = run_phase7_task73_redelivery_update_20260922a`
- `Account.Id__c = CLI-SIM-70e1269a76-59061e00ab`
- `Account.Id = 001HZ000011SEJwYAO`
- `Opportunity.Id__c = OPP-SIM-70e1269a76-59061e00ab`

Sequência observada:

1. `maquina-estado-insert-sem-cliente` → **HTTP 400**
2. `cliente-insert-cria-account` → **HTTP 200**
3. `cliente-update-carimba-prospect` → **HTTP 200**
4. `maquina-estado-insert-reentregue-pos-update` → **HTTP 200**

Polling direto após o `cliente-update`:

| Tentativa | Timestamp UTC | Elapsed | `IdProspectSalesforce__c` | `Opportunity` | `Lead` |
|---|---|---:|---|---:|---:|
| 1 | `2026-09-23T01:56:12.161Z` | 0.881s | `PRO-SIM-70e1269a76-59061e00ab` | 0 | 0 |

Ou seja: o `cliente-update` carimbou o prospect **imediatamente**, antes da
reentrega.

### Execução final do cenário corrigido

Com a definição do cenário atualizada para incluir esse `cliente-update`, foi
feita uma execução E2E final do próprio cenário:

- `runId = run_phase7_task73_redelivery_final_20260922a`
- `Account.Id__c = CLI-SIM-406aaf41cb-c8d1d7947f`
- `Account.Id = 001HZ000011S6noYAC`
- `Opportunity.Id__c = OPP-SIM-406aaf41cb-c8d1d7947f`
- `Opportunity.Id = 006HZ00000U0YlCYAV`

Sequência real observada:

1. `maquina-estado-insert-sem-cliente` → **HTTP 400**
2. `cliente-insert-cria-account` → **HTTP 200**
3. `cliente-update-carimba-prospect` → **HTTP 200**
4. `maquina-estado-insert-reentregue` → **HTTP 200**

### Query direta antes do `verify()`

- `Account`:
  - `Id = 001HZ000011S6noYAC`
  - `Id__c = CLI-SIM-406aaf41cb-c8d1d7947f`
  - `IdProspectSalesforce__c = PRO-SIM-406aaf41cb-c8d1d7947f`
- `Opportunity`:
  - `Id = 006HZ00000U0YlCYAV`
  - `Id__c = OPP-SIM-406aaf41cb-c8d1d7947f`
  - `AccountId = 001HZ000011S6noYAC`
  - `StageName = Simulação`
  - `EventTime__c = 2026-09-23T02:05:00.000+0000`
- `Lead`:
  - `totalSize = 0`

### Conclusão objetiva

O critério foi finalmente confirmado ao vivo, mas com a **sequência correta**:

- `cliente-insert` sozinho **não** basta;
- `cliente-update` subsequente é o passo que carimba
  `IdProspectSalesforce__c`;
- depois disso, a reentrega **idêntica** do mesmo `jornadausuario-insert`
  funciona e cria a `Opportunity` normalmente.

### Verificação automatizada

Com o cenário corrigido, `verify()` passou com **7/7 checks**:

- `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`
- `ACCOUNT_IS_PERSON_ACCOUNT`
- `ACCOUNT_PROSPECT_ID_EQUALS_EXPECTED`
- `OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE`
- `OPPORTUNITY_ACCOUNT_LINKED_TO_PRIMARY_ACCOUNT`
- `OPPORTUNITY_STAGE_EQUALS_EXPECTED`
- `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 1`

### Cleanup real

- `cleanupResult.status = DELETED`
- `deletedCount = 3`
- estado final pós-cleanup:
  - `Account = 0`
  - `Opportunity = 0`
  - `Lead = 0`

---

## Resumo final da tarefa

- **Critério 1**: confirmado ao vivo.
- **Critério 2**: confirmado ao vivo.
- **Critério 3**: confirmado ao vivo com a sequência correta
  `cliente-insert` + `cliente-update` + reentrega.

Nenhum bloqueio de permissão ocorreu e nenhum resíduo foi deixado na org ao
final das execuções.
