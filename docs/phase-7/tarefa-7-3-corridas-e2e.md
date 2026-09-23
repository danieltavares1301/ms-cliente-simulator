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

### Divergência real prioritária

Este foi o único critério cuja **teoria não bateu com o observado em
`mrv-devDan`**.

### Identidade sintética

- `runId = run_phase7_task73_redelivery_20260922a`
- Account criada no passo 2:
  `CLI-SIM-ff10caedd1-c690c2b69a` → `001HZ000011Rh80YAC`
- Opportunity esperada:
  `OPP-SIM-ff10caedd1-c690c2b69a`

### Sequência real observada

1. `maquina-estado-insert-sem-cliente` → **HTTP 400**
2. `cliente-insert-cria-account` → **HTTP 200**
3. `maquina-estado-insert-reentregue` (mesmo envelope do passo 1) →
   **HTTP 400**

Corpo real do erro no passo 1 **e** no passo 3:

```json
{
  "Status": "Error",
  "Message": "Cliente(Account) não encontrado no Salesforce. clienteProspect.idClient: null. clienteProspect.idProspectSalesforce: PRO-SIM-ff10caedd1-c690c2b69a."
}
```

### Query direta após o passo 2

- `Account` foi criada:
  - `Id = 001HZ000011Rm01YAC`
  - `Id__c = CLI-SIM-dbba0baded-6f705ae03f`
- **Mas** `IdProspectSalesforce__c` permaneceu **em branco**:
  - `IdProspectSalesforce__c = null`

### Investigação adicional de timing (polling real antes da reentrega)

Hipótese investigada: o campo `IdProspectSalesforce__c` poderia estar sendo
carimbado de forma **assíncrona** pelo `Queueable` `insertLeadQueueable`, e o
teste original talvez estivesse reentregando cedo demais.

Para validar isso, o cenário foi reexecutado do zero e, após o
`cliente-insert`, foi feito polling direto na `Account` a cada ~2,5–3,5
segundos por cerca de **28 segundos** antes de disparar a reentrega:

| Tentativa | Timestamp UTC | Elapsed | `IdProspectSalesforce__c` | `Opportunity` | `Lead` |
|---|---|---:|---|---:|---:|
| 1 | `2026-09-23T00:00:39.907Z` | 0.939s | `null` | 0 | 0 |
| 2 | `2026-09-23T00:00:43.349Z` | 4.362s | `null` | 0 | 0 |
| 3 | `2026-09-23T00:00:46.769Z` | 7.771s | `null` | 0 | 0 |
| 4 | `2026-09-23T00:00:50.184Z` | 11.114s | `null` | 0 | 0 |
| 5 | `2026-09-23T00:00:53.526Z` | 14.464s | `null` | 0 | 0 |
| 6 | `2026-09-23T00:00:56.880Z` | 17.843s | `null` | 0 | 0 |
| 7 | `2026-09-23T00:01:00.262Z` | 21.225s | `null` | 0 | 0 |
| 8 | `2026-09-23T00:01:03.643Z` | 24.642s | `null` | 0 | 0 |
| 9 | `2026-09-23T00:01:07.061Z` | 27.999s | `null` | 0 | 0 |

Observações reais durante o polling:

- a `Account` já existia desde a primeira tentativa;
- `IdProspectSalesforce__c` permaneceu `null` em **todas** as tentativas;
- nenhum `Lead` foi criado nesse intervalo (`leadCount = 0`);
- nenhuma `Opportunity` apareceu nesse intervalo (`opportunityCount = 0`).

A reentrega só foi enviada depois disso, às `2026-09-23T00:01:10.806Z`, ainda
assim retornando **HTTP 400** com a mesma mensagem de
`Cliente(Account) não encontrado`.

### Query direta após o passo 3

- `Account` continuava existente:
  - `Id = 001HZ000011Rm01YAC`
  - `IdProspectSalesforce__c = null`
- `Opportunity WHERE Id__c = 'OPP-SIM-dbba0baded-6f705ae03f'`:
  - `totalSize = 0`
- `OpportunityLineItem` associado:
  - `totalSize = 0`

### Conclusão objetiva

O simulador reproduziu uma divergência real importante:

- o `/Cliente` criou a Account;
- porém **não** carimbou `IdProspectSalesforce__c`;
- por isso a reentrega exata do mesmo `jornadausuario-insert` com
  `idCliente = null` continuou falhando com **HTTP 400**;
- **nenhuma `Opportunity` foi criada**.

**Conclusão definitiva da investigação adicional:** a hipótese de **timing**
foi **refutada**. Mesmo aguardando ~28 segundos com polling direto na org real,
`IdProspectSalesforce__c` continuou `null`, então o comportamento observado não
é apenas “o teste esperou pouco”; trata-se de uma divergência real reproduzível
em `mrv-devDan`.

Ou seja: em `mrv-devDan`, o critério “o mesmo evento atual pode ser
reentregue após `cliente-insert`” **não se confirmou** no formato mais forte
pedido aqui.

### Verificação automatizada

O cenário foi ajustado para registrar o comportamento real observado, e
`verify()` passou com **5/5 checks**:

- `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`
- `ACCOUNT_IS_PERSON_ACCOUNT`
- `ACCOUNT_PROSPECT_ID_NOT_STAMPED`
- `OPPORTUNITY_NOT_CREATED`
- `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 0`

### Cleanup real

- `cleanupResult.status = DELETED`
- `deletedCount = 1`
- estado final pós-cleanup:
  - `Account = 0`
  - `Opportunity = 0`
  - `Lead = 0`

---

## Resumo final da tarefa

- **Critério 1**: confirmado ao vivo.
- **Critério 2**: confirmado ao vivo.
- **Critério 3**: **divergiu da teoria**; o comportamento real observado foi
  documentado e os asserts foram ajustados para refletir `mrv-devDan`.

Nenhum bloqueio de permissão ocorreu e nenhum resíduo foi deixado na org ao
final das execuções.
