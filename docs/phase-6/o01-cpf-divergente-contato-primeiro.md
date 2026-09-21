# Fase 6 — `cpf-divergente-contato-primeiro`

## Objetivo

Documentar a execução real do perfil **O01 — Parciais antes** do catálogo de
ordens de eventos do MS Cliente no Pós-PAC:

```text
contato-insert(idcliente=IDCLI-Y, idprospectsalesforce=PROS-X, Email)
→ contato-insert(idcliente=IDCLI-Y, idprospectsalesforce=PROS-X, Celular)
→ cliente-insert(idcliente=IDCLI-Y, idprospectsalesforce=PROS-X, CPF Y, Nome Y)
```

Onde:

- **X** é uma Account sintética de controle pré-existente, já dona de `PROS-X`;
- **Y** não existe no início;
- os dois `contato-insert` chegam primeiro, com `IDCLI-Y` ainda inexistente e
  reaproveitando o prospect de **X**.

## Decisão de desenho fixada antes da execução real

Antes do teste ao vivo, o cenário foi publicado com `expectedOutcomes =
PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT`, assumindo a leitura mais provável
do Apex:

1. os dois `contato-insert` divergentes seriam descartados silenciosamente;
2. o `cliente-insert` final ainda criaria a estrutura **Y**;
3. como os contatos foram descartados antes, o Lead final de **Y** ficaria sem
   e-mail e sem celular.

Essa hipótese foi **confirmada integralmente** pela execução real descrita
abaixo; por isso os `expectedOutcomes` não precisaram ser alterados após o
teste.

## Evidência da execução real em `mrv-devDan`

### Ambiente e identificação

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **runId técnico**: `run_o01_1789991782008`
- **eventStartAt renderizado**: `2026-09-21T11:56:22.000Z`

### Fixture renderizada

- **Y / Account alvo**
  - `Id__c = CLI-SIM-1b796b038a-334f8ceaf7`
  - `CPF = 13780147319`
- **X / Account de controle**
  - `Id__c = CLI-SIM-X-1b796b038a-334f8ceaf7`
  - `IdProspectSalesforce__c = PRO-SIM-X-1b796b038a-334f8ceaf7`
  - `CPF = 50698141091`

### Respostas HTTP observadas

Todos os três dispatches reais para `/services/apexrest/Cliente` retornaram
**HTTP 200 OK**:

| Step | EventTime | Dispatch real | HTTP | Duração |
|---|---|---:|---:|---:|
| `contato-email` | `2026-09-21T11:56:22.000Z` | `2026-09-21T11:56:24.938Z` | 200 | 340 ms |
| `contato-celular` | `2026-09-21T11:56:23.000Z` | `2026-09-21T11:56:28.082Z` | 200 | 424 ms |
| `cliente-insert-final` | `2026-09-21T11:56:24.000Z` | `2026-09-21T11:56:31.337Z` | 200 | 777 ms |

### Estado antes/depois

#### Antes do setup

- nenhuma Account encontrada por `Id__c/CPF` de **X** ou **Y**;
- nenhum Lead encontrado por `CPF Y`, `PROS-X` ou `PROS-Y`.

#### Após o setup

- Account **X** criada com sucesso às `2026-09-21T11:56:23.000+0000`;
- nenhuma Account **Y**;
- nenhum Lead.

#### Após `contato-email`

Snapshot em `2026-09-21T11:56:27.072Z`:

- somente a Account **X** existia;
- **nenhuma** Account **Y** foi criada;
- **nenhum** Lead foi criado;
- Account **X** permaneceu intacta (`Id__c`, `CPF__pc`,
  `IdProspectSalesforce__c`, contatos todos inalterados/nulos).

#### Após `contato-celular`

Snapshot em `2026-09-21T11:56:30.327Z`:

- cenário idêntico ao anterior;
- novamente, apenas **X** existia;
- ainda não havia Account **Y** nem Lead;
- nenhum contato foi persistido.

#### Após `cliente-insert-final`

Snapshot em `2026-09-21T11:56:37.586Z`:

- Account **Y** criada:
  - `Id = 001HZ000011MOnTYAW`
  - `Id__c = CLI-SIM-1b796b038a-334f8ceaf7`
  - `CPF__pc = 13780147319`
  - `LastName = Cliente Simulado 334f8ceaf7`
  - `IdProspectSalesforce__c = a3b48ed2-bcae-d76d-b97c-911df64200bf`
  - `PersonEmail = null`
  - `PersonMobilePhone = null`
  - `Celular__c = null`
- Lead novo de **Y** criado:
  - `Id = 00QHZ00000bbnB52AI`
  - `Id__c = a3b48ed2-bcae-d76d-b97c-911df64200bf`
  - `CPF__c = 13780147319`
  - `Email = null`
  - `MobilePhone = null`
  - `CelularSemFormatacao__c = null`
  - `DescricaoOrigem__c = InsertClientePAC`
- Account **X** permaneceu intacta:
  - `Id = 001HZ000011MNUoYAO`
  - `Id__c = CLI-SIM-X-1b796b038a-334f8ceaf7`
  - `IdProspectSalesforce__c = PRO-SIM-X-1b796b038a-334f8ceaf7`
  - `CPF__pc = 50698141091`

#### Após a espera final

Snapshot em `2026-09-21T11:57:03.115Z`:

- nenhum estado adicional apareceu;
- **Y** e seu Lead permaneceram sem e-mail/celular;
- **X** seguiu intacta.

### Verificação final automatizada

`verify()` retornou **9/9 checks aprovados**:

- `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`
- `ACCOUNT_IS_PERSON_ACCOUNT`
- `ACCOUNT_NAME_EQUALS_EVENT`
- `ACCOUNT_CPF_EQUALS_EVENT`
- `CONTROL_ACCOUNT_UNCHANGED`
- `LEAD_COUNT_BY_CPF_IS_ONE`
- `LEAD_CPF_EQUALS_EVENT`
- `LEAD_EMAIL_EXCLUDED`
- `LEAD_MOBILE_EXCLUDED`

Resultado final do adapter: **`passed = true`**.

### Cleanup real

- `cleanup()` removeu **3 registros** (`deletedCount = 3`);
- uma consulta residual pós-cleanup confirmou:
  - `accounts: []`
  - `leads: []`

Nenhum lixo foi deixado na org.

## Explicação técnica no Apex

O comportamento observado bate exatamente com o guard documentado na referência
da skill para a Unificação 2.2:

> Se um evento resolver para conta divergente:
> - `cliente-insert` → `criarLeadDoCliente = true` (cria a estrutura do CPF Y).
> - `contato-*` / `endereco-*` → `descartarEvento = true` → **early-return em
>   `executar()` antes de qualquer DML**.

Fonte: `references/unificacao-2.2-pos-pac.md`, seção **Bug 2 — Sobrescrita de
Account/Lead do CPF X (Work Item #918914)**.

Na mesma referência, o critério do descarte é descrito assim:

> `deveDescartarMatchPosPac` só descarta o match quando **todas** as condições
> valem:
> 1. o match foi feito **via `ID_PROSPECT`**,
> 2. o `Id__c` da conta já está **preenchido**,
> 3. esse `Id__c` é **divergente** do `idExterno` do evento.

Aplicando isso ao cenário:

1. os dois `contato-insert` chegaram com `idprospectsalesforce = PROS-X`;
2. `PROS-X` já pertencia à Account **X**;
3. o `idcliente` do payload era **Y**, diferente de `X`;
4. portanto, o Apex marcou `descartarEvento = true` e retornou **200 sem DML**;
5. quando o `cliente-insert-final` chegou, ele seguiu o ramo divergente normal:
   preservou **X**, criou a nova Account **Y** e enfileirou a criação de um
   novo Lead para `CPF Y`.

## Decisão final de `expectedOutcomes`

Como a execução real **confirmou** a hipótese inicial, o cenário permaneceu com
o resultado:

- `result = PERSON_ACCOUNT_CREATED_PROSPECT_DIVERGENT`

e com os checks que documentam o estado final observado:

- **X intacta** (`CONTROL_ACCOUNT_UNCHANGED`);
- **Y criada** (`ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`, `ACCOUNT_*`);
- **Lead Y criado** (`LEAD_COUNT_BY_CPF_IS_ONE`, `LEAD_CPF_EQUALS_EVENT`);
- **contatos parciais perdidos** (`LEAD_EMAIL_EXCLUDED`,
  `LEAD_MOBILE_EXCLUDED`).

O check novo `ACCOUNT_NOT_CREATED` foi adicionado ao contrato/adapter durante
este incremento como alternativa explícita para cenários futuros em que a
hipótese de descarte total se confirme, mas ele **não** foi necessário neste
caso porque o `cliente-insert-final` realmente criou a estrutura **Y**.
