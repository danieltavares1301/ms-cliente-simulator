# Fase 6 — `cpf-divergente-identidade-antiga`

## Objetivo

Validar ao vivo o perfil **O08 — Parciais com identidade antiga (`IA`)** do
catálogo de referência:

```text
contato-insert(idcliente=IDCLI-X, idprospectsalesforce=PROS-X, Email=C)
→ contato-insert(idcliente=IDCLI-X, idprospectsalesforce=PROS-X, Celular=D)
→ cliente-insert(idcliente=IDCLI-Y, idprospectsalesforce=PROS-X, CPF Y, Nome Y)
```

Onde:

- **X** já existe e é dona de `PROS-X`;
- **Y** ainda não existe no início;
- os dois `contato-insert` usam deliberadamente a identidade **antiga** de X,
  não a identidade nova Y.

## Resultado real observado

O comportamento real do Apex **contradiz o assert do catálogo** ("X
permanece invariável; Y recebe C/D").

Na execução real contra `mrv-devDan`, ocorreu o seguinte:

1. `contato-email-x` atualizou **a própria Account X** com `PersonEmail = C`;
2. `contato-celular-x` atualizou **a própria Account X** com
   `PersonMobilePhone/Celular__c = D`;
3. `cliente-insert-y` criou a nova Person Account **Y** e um novo Lead de Y;
4. **Y permaneceu sem contatos**;
5. o **Lead novo de Y** também permaneceu sem contatos;
6. **X não voltou ao estado original** — ela continuou com C/D mesmo depois da
   criação de Y.

Portanto, o efeito observado foi:

- **X recebe C/D e mantém C/D**;
- **Y nasce sem C/D**;
- **Lead Y nasce sem C/D**.

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instance URL**:
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **runId técnico**: `run_o08_final_1789993246462`
- **eventStartAt renderizado**: `2026-09-21T12:20:46.000Z`

### Fixture renderizada

- **Y / Account alvo**
  - `Id__c = CLI-SIM-d0a4373a54-3eaceb1195`
  - `CPF = 10296511919`
- **X / Account de controle**
  - `Id__c = CLI-SIM-X-d0a4373a54-3eaceb1195`
  - `IdProspectSalesforce__c = PRO-SIM-X-d0a4373a54-3eaceb1195`
  - `CPF = 02070215890`
- **Contato C (email)**:
  `colisao.3eaceb1195@simulador.mrv.invalid`
- **Contato D (celular)**: `11979787267`

### Respostas HTTP observadas

Os três dispatches reais para `/services/apexrest/Cliente` retornaram
**HTTP 200 OK**:

| Step | EventTime | Dispatch real | HTTP | Duração |
|---|---|---:|---:|---:|
| `contato-email-x` | `2026-09-21T12:20:46.000Z` | `2026-09-21T12:20:49.544Z` | 200 | 794 ms |
| `contato-celular-x` | `2026-09-21T12:20:47.000Z` | `2026-09-21T12:20:53.131Z` | 200 | 667 ms |
| `cliente-insert-y` | `2026-09-21T12:20:48.000Z` | `2026-09-21T12:20:56.686Z` | 200 | 565 ms |

### Estado antes/depois

#### Antes do setup

- nenhuma Account encontrada por `Id__c/CPF` de X ou Y;
- nenhum Lead encontrado por `CPF Y`, `PROS-X` ou pelos contatos C/D.

#### Após o setup

- Account **X** criada com sucesso;
- **X** iniciou com `PersonEmail = null`, `PersonMobilePhone = null`,
  `Celular__c = null`;
- nenhuma Account **Y**;
- nenhum Lead.

#### Após `contato-email-x`

Snapshot em `2026-09-21T12:20:53.131Z`:

- somente a Account **X** existia;
- `X.PersonEmail = colisao.3eaceb1195@simulador.mrv.invalid`;
- nenhum Lead foi criado;
- nenhuma Account **Y** foi criada.

#### Após `contato-celular-x`

Snapshot em `2026-09-21T12:20:56.686Z`:

- somente a Account **X** existia;
- `X.PersonEmail` permaneceu com **C**;
- `X.PersonMobilePhone = 5511979787267`;
- `X.Celular__c = 11979787267`;
- nenhum Lead foi criado;
- nenhuma Account **Y** foi criada.

#### Após `cliente-insert-y`

Snapshot em `2026-09-21T12:21:00.083Z`:

- Account **Y** criada:
  - `Id = 001HZ000011MhV3YAK`
  - `Id__c = CLI-SIM-d0a4373a54-3eaceb1195`
  - `CPF__pc = 10296511919`
  - `LastName = Cliente Simulado 3eaceb1195`
  - `IdProspectSalesforce__c = 29b98c39-f2eb-8888-01db-910d6c33af71`
  - `PersonEmail = null`
  - `PersonMobilePhone = null`
  - `Celular__c = null`
- Lead novo de **Y** criado:
  - `Id = 00QHZ00000bbwvr2AA`
  - `Id__c = 29b98c39-f2eb-8888-01db-910d6c33af71`
  - `CPF__c = 10296511919`
  - `Email = null`
  - `MobilePhone = null`
  - `CelularSemFormatacao__c = null`
  - `DescricaoOrigem__c = InsertClientePAC`
- Account **X** continuou com os contatos de Y:
  - `PersonEmail = colisao.3eaceb1195@simulador.mrv.invalid`
  - `PersonMobilePhone = 5511979787267`
  - `Celular__c = 11979787267`

#### Após a espera final (~20s)

Snapshot em `2026-09-21T12:21:20.603Z`:

- **nenhuma convergência adicional aconteceu**;
- **X** continuou com C/D;
- **Y** continuou sem C/D;
- o **Lead de Y** continuou sem C/D.

### Verificação final automatizada

Com o cenário já ajustado para o comportamento observado, `verify()` retornou
**12/12 checks aprovados**:

- `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`
- `ACCOUNT_IS_PERSON_ACCOUNT`
- `ACCOUNT_NAME_EQUALS_EVENT`
- `ACCOUNT_CPF_EQUALS_EVENT`
- `ACCOUNT_EMAIL_EXCLUDED`
- `ACCOUNT_MOBILE_EXCLUDED`
- `CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED`
- `CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED`
- `LEAD_COUNT_BY_CPF_IS_ONE`
- `LEAD_CPF_EQUALS_EVENT`
- `LEAD_EMAIL_EXCLUDED`
- `LEAD_MOBILE_EXCLUDED`

Resultado final do adapter: **`passed = true`**.

### Cleanup real

- `cleanup()` removeu **3 registros** (`deletedCount = 3`);
- verificação residual final:
  - `accounts: []`
  - `leads: []`

Nenhum lixo foi deixado na org.

## Explicação técnica no Apex

O comportamento observado decorre diretamente da combinação de seis trechos:

### 1) `getClientePosPac` prioriza `ID_CLIENTE`

Em `ClienteService.cls`, o match Pós-PAC procura primeiro por `Id__c`:

```apex
if ( setIdCliente != null && !setIdCliente.isEmpty() )
{
    rb.cliente = selectorInstance.obterClientePorIdCliente( setIdCliente );
    if ( rb.cliente != null )
    {
        rb.matchedVia = 'ID_CLIENTE';
        return rb;
    }
}
```

Nos dois `contato-insert` de O08, o payload usa `idcliente = IDCLI-X`. Por
isso o Apex encontra **X diretamente por `Id__c`**, antes de considerar CPF ou
`IdProspect`.

### 2) `deveDescartarMatchPosPac` não descarta matches via `ID_CLIENTE`

Ainda em `ClienteService.cls`:

```apex
if ( resultadoBusca.matchedVia != 'ID_PROSPECT' )
{
    return false;
}
```

Como os `contato-insert` de O08 chegaram a **X via `ID_CLIENTE`**, esse guard
retorna `false` imediatamente. Portanto, **não** há `descartarEvento = true`
nesse ponto.

### 3) `prospectPertenceAOutraConta` também não barra o contato em X

O segundo guard relevante é:

```apex
if ( contaAtual == null || contaAtual.Id == null )
{
    return true;
}

return contaComProspect.Id != contaAtual.Id;
```

Em O08, `contaAtual` já é a própria **X** encontrada pelo passo anterior, e
`PROS-X` também pertence a **X**. Logo, `contaComProspect.Id != contaAtual.Id`
fica **false**, e o fluxo segue normalmente.

### 4) `validarIdentidadePayloadParcialContraAccount` só descarta se o
`IdProspect` divergir de fato

Em `NotificacaoCliente.cls`:

```apex
if ( String.isNotBlank( this.idProspectSalesforce )
     && String.isNotBlank( clienteExistente.IdProspectSalesforce__c )
     && !this.idProspectSalesforce.equalsIgnoreCase( clienteExistente.IdProspectSalesforce__c ) )
{
    this.motivoDescarteIdentidadePayloadParcial = 'ID_PROSPECT_DIVERGENTE';
    return false;
}
```

Nos dois eventos parciais de O08:

- `this.idProspectSalesforce = PROS-X`
- `clienteExistente.IdProspectSalesforce__c = PROS-X`

Como os valores são **iguais**, a validação retorna `true` e não descarta.

### 5) Com a Account já existente e o evento sendo `contato-*`, o Apex faz
`Database.update(...)`

Ainda em `NotificacaoCliente.executar()`:

```apex
if ( clienteExiste )
{
    if ( this.eventTypeContatoInsertOrContatoUpdate() ) {
        ...
        saveResultAccount = Database.update( clienteInsertOrUpdate );
    }
}
```

Esse é o passo que efetivamente grava **C/D em X**.

### 6) O `cliente-insert-y` final segue o ramo divergente clássico e cria Y

Quando o evento final chega com `idcliente = IDCLI-Y` e
`idprospectsalesforce = PROS-X`, o match por `ID_CLIENTE` não encontra Y, o
match por CPF também não, e o match por `ID_PROSPECT` resolve para **X**. Aí o
guard divergente volta a disparar:

```apex
if ( ClienteService.deveDescartarMatchPosPac( resultadoBusca, this.idExterno, cpf ) ) {
    if ( this.eventTypeClientInsertOrClientUpdate() ) {
        this.criarLeadDoCliente = true;
    } else {
        this.descartarEvento = true;
    }
    cliente = null;
}
```

Como agora o evento é **`cliente-insert`**, o Apex não descarta: ele liga
`criarLeadDoCliente = true`, zera `cliente`, faz o upsert de uma **nova
Account Y** e depois cria um **novo Lead de Y**. Só que os contatos que já
ficaram em X **não são transferidos**.

## Decisão final de `expectedOutcomes`

O cenário publicado foi ajustado para refletir exatamente o comportamento
observado:

- **Y existe** e é a Person Account correta (`ACCOUNT_*`);
- **Y continua sem contatos**
  (`ACCOUNT_EMAIL_EXCLUDED`, `ACCOUNT_MOBILE_EXCLUDED`);
- **X retém os contatos C/D**
  (`CONTROL_ACCOUNT_EMAIL_EQUALS_EXPECTED`,
  `CONTROL_ACCOUNT_MOBILE_EQUALS_EXPECTED`);
- **o novo Lead de Y existe, mas sem contatos**
  (`LEAD_COUNT_BY_CPF_IS_ONE`, `LEAD_CPF_EQUALS_EVENT`,
  `LEAD_EMAIL_EXCLUDED`, `LEAD_MOBILE_EXCLUDED`).

## Divergência explícita em relação ao catálogo

O catálogo O08 afirma:

> "todos os campos funcionais e timestamps de X permanecem invariantes; Y
> recebe C/D"

**Isso não foi o que o Apex atual fez em `mrv-devDan`.**

O comportamento real observado foi o oposto:

- **X foi alterada** pelos dois `contato-insert`;
- **Y não recebeu C/D**;
- o **Lead de Y** também não recebeu C/D.

O simulador passou a refletir o **comportamento real do Apex atual**, não o
texto esperado pelo catálogo.

## Hipótese sobre a origem da divergência: reconciliação via PAC (Fase 7)

Investigação adicional em `ClienteService.cls` encontrou um mecanismo que
provavelmente explica por que o catálogo descreve "Y recebe C/D": o método
`sincronizarContatosAprovadosPac` (`ClienteService.cls:747`).

Esse método é acionado quando um `Proponente__c` (vinculado a uma PAC) atinge
o status `CREDITO_APROVADO_CONDICIONADO`. Diferente do fluxo testado neste
cenário (que depende de `contato-insert` cru do `/Cliente`), ele:

1. Localiza a Account **diretamente pelo lookup `Proponente__c.Proponente__c`
   + `IdCliente__c`** — ou seja, a Account que tem o **Proponente Principal
   aprovado** vinculado a ela. No fluxo real completo, essa Account seria
   **Y** (a identidade definitiva aprovada na PAC), não X.
2. Copia `EmailAtualizado__c`/`Celular__c` do `Proponente__c` **diretamente**
   para essa Account (`PersonEmail`/`Celular__c`), com precedência por
   timestamp (`dataAlteracaoPAC`).
3. Ao final, dispara
   `ReconciliacaoContatosLeadQueueable.solicitarSePendente(...,
   OrigemReconciliacao.POS_PAC_APROVADA)` para refletir no Lead.

Ou seja: no fluxo real completo, os contatos "aprovados" não vêm dos eventos
crus `contato-insert` aplicados fisicamente a X — eles vêm do
`Proponente__c` da PAC, aplicados **diretamente** na Account que detém o
Proponente Principal (Y), por um caminho de dados totalmente diferente do
que testamos aqui. Isso é compatível com o catálogo descrever "Y recebe
C/D": ele provavelmente descreve o resultado da cadeia **completa**
(incluindo PAC), não o comportamento isolado do `/Cliente` reproduzido neste
incremento (MVP sem PAC).

**Este mecanismo está fora do escopo do MVP atual (Fase 6) e faz parte da
Fase 7 do plano** (`plano-api-simulador-ms-clientes-2.2.md`, "Extensão PAC,
Máquina de Estado e Opportunity", Tarefa 7.1 — contratos `/PAC`). Quando a
Fase 7 for implementada, este cenário (`cpf-divergente-identidade-antiga`)
deve ser revisitado com uma variante que inclua uma PAC aprovada
(`Proponente__c` com status `CREDITO_APROVADO_CONDICIONADO`) para confirmar
se, com esse mecanismo em ação, o resultado final passa a bater com o texto
original do catálogo (Y recebendo C/D via `sincronizarContatosAprovadosPac`,
em vez de X sendo alterada pelos `contato-insert` crus).

