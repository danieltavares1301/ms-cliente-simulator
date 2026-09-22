# Tarefa 7.2 — `/MaquinaEstado` (incremento 2: evento chega antes do `/Cliente`)

## Escopo deste incremento

Este incremento transforma em cenários reproduzíveis a corrida real confirmada
em `mrv-staging`: `jornadausuario-insert` chega pelo tópico `jornadas` antes de
o `/Cliente` correspondente, vindo do tópico `clientes`, ter criado a
`Account`.

Foram publicados dois cenários complementares:

- `maquina-estado-insert-sem-cliente-falha`
- `maquina-estado-insert-apos-cliente-criado`

## Decisão de design

### Onde modelar “esperamos HTTP 400”

O status HTTP esperado foi modelado **no próprio step de dispatch**, via
`expectedHttpStatus`, e não em `expectedOutcomes`.

Motivação:

1. **status HTTP é semântica de transporte**, não resultado de negócio;
2. `expectedOutcomes` continua reservado ao estado final em Salesforce;
3. cenários existentes continuaram com o comportamento implícito atual:
   `expectedHttpStatus = 200` quando a propriedade não é declarada.

Implementação:

- `scenarioStepSchema` / `renderedFixtureStepSchema` aceitam
  `expectedHttpStatus?: number`;
- `deriveSteps()` persiste esse valor em `requestRedacted`;
- `DrizzleRunRepository.completeDispatch()` agora considera o dispatch
  **bem-sucedido quando o HTTP real coincide com o HTTP esperado**;
- a verificação de negócio ganhou `OPPORTUNITY_NOT_CREATED`, usado no cenário
  negativo.

Assim, o cenário A consegue:

- exigir **HTTP 400** no dispatch;
- ainda executar `verify()`/`cleanup()`;
- provar que **nenhuma Opportunity** e **nenhum OpportunityLineItem** foram
  criados.

### Correção pós-revisão (achado real de revisão de código independente)

A implementação original de `deriveSteps()` persistia
`expectedHttpStatus: step.expectedHttpStatus ?? 200` para **todo** step,
incluindo os ~30 cenários pré-existentes que nunca declaram essa propriedade.
Combinado com `completeDispatch()` exigindo `attempt.httpStatus ===
expectedHttpStatus`, isso estreitava silenciosamente o critério implícito de
sucesso de "qualquer 2xx" (`>= 200 && <= 299`, comportamento original) para
"exatamente 200" — uma mudança de comportamento real no código compartilhado
por todo o catálogo, sem cobertura de teste de regressão.

Embora os três endpoints Apex reais já integrados (`/Cliente`, `/PAC`,
`/MaquinaEstado`) sempre retornem exatamente 200 em sucesso (confirmado lendo
`EventGrid.cls`, a classe base de `NotificacaoCliente`, e os próprios
`NotificacaoPAC`/`NotificacaoMaquinaEstado`), o risco era real para qualquer
endpoint futuro que retorne um 2xx diferente de 200.

**Correção aplicada** (commit `a3f099b`): `deriveSteps()` só persiste
`expectedHttpStatus` quando o step o declara explicitamente (omitido, não
`?? 200`, no caso padrão); `completeDispatch()` cai de volta na faixa 2xx
original quando a propriedade está ausente, e só exige correspondência exata
quando o step declara explicitamente uma expectativa (como este incremento).
Também foi adicionado o teste de divergência que faltava
(`expectedHttpStatus=400` declarado mas `httpStatus` real `200` recebido →
run deve terminar `FAILED`).

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. o contrato Event Grid rejeitava `cliente.idCliente = null` em
   `jornadausuario-*`;
2. o repositório tratava `HTTP 400` esperado como falha terminal do run;
3. o adapter não possuía um check explícito para “Opportunity não criada”;
4. o catálogo ainda não publicava os dois novos cenários.

Cobertura adicionada/ajustada:

- `src/contracts/api-contracts.test.ts`
- `src/db/run-repository.integration.test.ts`
- `src/scenarios/catalog.test.ts`
- `src/scenarios/catalog.validation.test.ts`
- `src/scenarios/maquina-estado-scenario.test.ts`
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

---

## Cenário A — `maquina-estado-insert-sem-cliente-falha`

### Setup real

- nenhum registro foi criado;
- `setupResult.status = READY`;
- a fixture garantiu ausência prévia da identidade sintética
  (`ENSURE_ACCOUNT_ABSENT`).

### Dispatch real

- endpoint: `/services/apexrest/MaquinaEstado`
- evento: `jornadausuario-insert`
- `expectedHttpStatus = 400`
- resultado real: **HTTP 400 Bad Request**

Corpo real observado:

```json
{
  "Status": "Error",
  "Message": "Cliente(Account) não encontrado no Salesforce. clienteProspect.idClient: null. clienteProspect.idProspectSalesforce: PRO-SIM-4f60abf731-43ca734f82."
}
```

### Evidência por query direta

Chave externa da Opportunity usada no cenário:

- `Id__c = OPP-SIM-4f60abf731-43ca734f82`

Estado observado **depois do dispatch e antes do cleanup**:

- `Opportunity WHERE Id__c = 'OPP-SIM-4f60abf731-43ca734f82'` →
  `totalSize = 0`
- `OpportunityLineItem` vinculado à Opportunity → `totalSize = 0`

### Verificação automatizada

`verify()` passou com **2/2 checks**:

- `OPPORTUNITY_NOT_CREATED`
- `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 0`

### Cleanup real

- `cleanupResult.status = NO_OP`
- `deletedCount = 0`

Estado final pós-cleanup:

- `Opportunity` residual: `0`
- `OpportunityLineItem` residual: `0`

### Conclusão observada

> O cenário negativo reproduz exatamente a falha real dominante observada em
> `mrv-staging`: sem `Account` prévia para o prospect, o Apex responde
> **HTTP 400** e não faz DML em `Opportunity` nem em `OpportunityLineItem`.

### Rastreabilidade com a análise de logs reais

Este cenário implementa diretamente o achado da seção 1
("`/MaquinaEstado` — Tarefa 7.2") de `docs/staging-logs-analysis.md`:
amostra real de `jornadausuario-insert` em `mrv-staging` com **208 sucesso
vs. 1.147 erro (≈85% de taxa de erro real)**, causa raiz confirmada via
`StackTrace__c` real como `Cliente(Account) não encontrado no Salesforce.
clienteProspect.idClient: null. clienteProspect.idProspectSalesforce: ...`
— a mesma mensagem (mesmo prefixo textual, apenas os identificadores
variam) reproduzida ao vivo em `mrv-devDan` neste incremento.

---

## Cenário B — `maquina-estado-insert-apos-cliente-criado`

### Setup real

- `CREATE_SYNTHETIC_ACCOUNT` criou a Account sintética
  `001HZ000011RAf0YAG`;
- `setupResult.status = CREATED`.

### Dispatch real

- endpoint: `/services/apexrest/MaquinaEstado`
- evento: `jornadausuario-insert`
- `expectedHttpStatus = 200`
- resultado real: **HTTP 200 OK**

### Evidência por query direta

Chave externa da Opportunity usada no cenário:

- `Id__c = OPP-SIM-dcb786b69a-8073cf4f89`

Estado observado **depois do dispatch e antes do cleanup**:

- `Opportunity.Id = 006HZ00000TzoGwYAJ`
- `AccountId = 001HZ000011RAf0YAG`
- `StageName = Simulação`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `Unidade__c = 01t4T000002VELyQAO`
- `CidadeUnidade__c = null`

`OpportunityLineItem` criado:

- `Id = 00kHZ00000BM0xVYAT`
- `OpportunityId = 006HZ00000TzoGwYAJ`
- `PricebookEntryId = 01u4T0000047yxRQAQ`
- `Product2Id = 01t4T000002VELyQAO`
- `Quantity = 1`
- `UnitPrice = 0`

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

- `Opportunity` residual: `0`
- `OpportunityLineItem` residual: `0`

### Conclusão observada

> Assim que a `Account` já existe na org, o mesmo padrão de
> `jornadausuario-insert` volta a funcionar normalmente: **HTTP 200**,
> `Opportunity` criada, vinculada à `Account`, com `StageName = Simulação` e
> um `OpportunityLineItem` sintético.

## Resumo

- o simulador agora cobre a corrida real `/MaquinaEstado` → `/Cliente`;
- o cenário A reproduz a falha real mais frequente com **HTTP 400 sem DML**;
- o cenário B prova a recuperação real com **HTTP 200 e criação da
  Opportunity**;
- o contrato passou a aceitar `cliente.idCliente = null`;
- a expectativa de erro HTTP ficou modelada no **step de dispatch**, preservando
  `expectedOutcomes` como contrato de negócio;
- nenhum resíduo foi deixado em `mrv-devDan` ao final das execuções.
