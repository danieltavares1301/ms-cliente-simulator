# Fase 6 — `evento-duplicado` e `evento-obsoleto`

## Objetivo

Cobrir dois cenários de regressão da seção 11.5 do plano:

- **`evento-duplicado`**: reentrega física do mesmo `cliente-update` com o
  mesmo envelope Event Grid (`id`, `eventTime` e payload idênticos);
- **`evento-obsoleto`**: `cliente-update` com `dataalteracao` mais antiga que o
  valor já persistido na Account.

O princípio seguido neste incremento foi o mesmo do catálogo de referência:
**não antecipar o comportamento do Apex**. O simulador passou a publicar os
eventos exatamente como modelados, e o resultado observado em `mrv-devDan` foi
 documentado sem ajustes prévios por análise estática.

## Implementação

### `duplicateCount` agora gera reentregas físicas na orquestração

A implementação ficou **inteiramente em `src/runs/orchestration.ts`**.

Decisão de design:

- o fixture continua representando os **eventos lógicos** do cenário;
- a orquestração expande esses eventos em **deliveries físicos** no momento em
  que deriva os `RunStep`s.

Com isso:

1. `deriveSteps()` passa a expandir cada step de dispatch em:
   - o dispatch original; e
   - `N` reentregas adicionais (`${step.key}-redelivery-${n}`) quando
     `deliveryPolicy.duplicateCount > 0`;
2. cada reentrega usa **o mesmo envelope** do evento original, preservando:
   - `id`
   - `eventTime`
   - `data`
3. apenas o `scheduledAt` físico da execução avança em **+500 ms** por
   reentrega;
4. o preview dry-run passou a refletir a mesma expansão física.

Retrocompatibilidade preservada:

- cenários com `duplicateCount: 0` continuam gerando exatamente a mesma agenda
  de steps de antes.

### Novo `GeneratedValue`: `EARLIER_TIME`

Para o cenário obsoleto, o renderer agora expõe:

- `BASELINE_TIME = eventStartAt - 1s`
- `EARLIER_TIME = eventStartAt - 6s`

Isso permite modelar um evento cujo:

- `eventTime` continua sendo o instante normal de publicação/entrega; mas
- `dataalteracao` fica deliberadamente **anterior** ao estado persistido.

Também foi removida a restrição indevida que forçava
`event.data.dataalteracao === scheduledAt` na fixture renderizada. O vínculo
obrigatório continua sendo apenas:

- `event.eventTime === scheduledAt`

### Novos checks de verificação

Foram adicionados ao adapter de teste Salesforce:

- `ACCOUNT_NAME_EQUALS_SETUP`
- `ACCOUNT_CPF_EQUALS_SETUP`

Eles existem para expressar corretamente o caso em que o evento **não deveria
ter efeito**. Reutilizar `ACCOUNT_*_EQUALS_EVENT` aqui distorceria a semântica
do cenário, porque esses checks significam explicitamente “o payload venceu”.

## Cenários adicionados

### `evento-duplicado`

- `key`: `evento-duplicado`
- `version`: `1`
- `scope`: `EXTENDED`
- `tags`: `regression`, `o14`, `idempotencia`, `reentrega`

Setup:

- cria uma Person Account sintética primária com match por `ID_CLIENTE`.

Step lógico:

- `cliente-update`
- `deliveryPolicy: { duplicateCount: 1, retryOn: [], maxAttempts: 1 }`

Resultado esperado:

- continua existindo **uma** única Account para o `Id__c`;
- nome e CPF seguem os valores do evento;
- a segunda entrega não cria duplicidade nem corrompe o registro.

### `evento-obsoleto`

- `key`: `evento-obsoleto`
- `version`: `1`
- `scope`: `EXTENDED`
- `tags`: `regression`, `obsolescencia`

Setup:

- cria uma Person Account sintética primária com `dataAlteracao =
  BASELINE_TIME`.

Step:

- `cliente-update`
- `eventTime = EVENT_TIME`
- `dataalteracao = EARLIER_TIME`
- `numerocpf = CPF_X` (deliberadamente diferente do setup)
- `nomecompleto = PERSON_NAME` (também diferente do setup)

Resultado esperado:

- a Account continua com o **nome e CPF do setup**;
- o evento obsoleto não sobrescreve o estado mais novo.

## TDD executado

Antes da implementação, foram adicionados testes que falhavam para comprovar:

1. `duplicateCount` não expandia reentregas físicas no preview nem nos
   `RunStep`s;
2. a fixture renderizada rejeitava `dataalteracao` anterior ao `scheduledAt`;
3. o adapter não reconhecia checks baseados no estado do setup.

Cobertura adicionada:

- `src/runs/orchestration.test.ts`
- `src/scenarios/renderer.test.ts`
- `src/scenarios/catalog.test.ts`
- `src/salesforce/test-data-adapter.test.ts`

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`

### `evento-duplicado`

Execução real:

- setup criou **1** Account sintética;
- o simulador publicou **2** dispatches físicos:
  - `cliente-update`
  - `cliente-update-redelivery-1`
- ambos carregaram o mesmo:
  - `eventId = EVT-SIM-d3446f3acd-c1df11fb`
  - `eventTime = 2026-09-21T12:00:00.000Z`
  - `dataalteracao = 2026-09-21T12:00:00.000Z`
- ambos retornaram **HTTP 200 OK**.

Resultado observado:

- `verify()` aprovou **5/5 checks**;
- permaneceu **1** Person Account;
- `LastName` e `CPF__pc` ficaram iguais ao evento;
- **nenhum Lead** foi criado;
- cleanup removeu **1** registro.

Conclusão observada ao vivo:

> A reentrega genérica do mesmo `cliente-update` se comportou como
> **idempotente** neste recorte: a segunda entrega não duplicou nem corrompeu a
> Account.

### `evento-obsoleto`

Execução real:

- setup criou **1** Account sintética;
- o dispatch publicou:
  - `eventTime = 2026-09-21T12:05:00.000Z`
  - `dataalteracao = 2026-09-21T12:04:54.000Z`
- o setup havia persistido:
  - `DataAlteracaoEvento__c = 2026-09-21T12:04:59.000+0000`
- a chamada retornou **HTTP 200 OK**.

Estado final observado:

- `Id__c` permaneceu único;
- `LastName` permaneceu como **`Cliente Simulado Base 4f0426875f`** (setup);
- `CPF__pc` permaneceu como **`23801401030`** (setup);
- `DataAlteracaoEvento__c` permaneceu em
  **`2026-09-21T12:04:59.000+0000`**;
- **nenhum Lead** foi criado;
- cleanup removeu **1** registro.

Resultado automatizado:

- `verify()` aprovou **4/4 checks**:
  - `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`
  - `ACCOUNT_IS_PERSON_ACCOUNT`
  - `ACCOUNT_NAME_EQUALS_SETUP`
  - `ACCOUNT_CPF_EQUALS_SETUP`

Conclusão observada ao vivo:

> O evento com `dataalteracao` mais antiga foi **ignorado para fins de
> sobrescrita**, preservando o estado mais novo já persistido na Account.

## Decisões de design tomadas neste incremento

1. **Expandir reentregas em `deriveSteps`, não no renderer**  
   Mantém a separação entre:
   - fixture = “quais eventos lógicos o cenário descreve”
   - orquestração = “quantas entregas físicas serão publicadas”

2. **Criar checks baseados no setup em vez de reinterpretar os checks do
   evento**  
   Evita sobrecarregar `ACCOUNT_NAME_EQUALS_EVENT` e
   `ACCOUNT_CPF_EQUALS_EVENT` com uma semântica oposta.

3. **Manter `eventTime` e `dataalteracao` independentes**  
   Necessário para reproduzir obsolescência real; `scheduledAt` continua
   representando apenas a agenda física do dispatch.

## Resumo

- `duplicateCount` agora tem efeito funcional real;
- `evento-duplicado` foi implementado e validado ao vivo como **idempotente**;
- `evento-obsoleto` foi implementado e validado ao vivo como **não
  sobrescritor**;
- os registros criados em `mrv-devDan` foram removidos com sucesso ao final das
  execuções.
