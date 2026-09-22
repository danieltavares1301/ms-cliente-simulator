# Tarefa 7.2 — `/MaquinaEstado` (incremento 1: smoke test mínimo)

## Escopo deste incremento

Primeiro corte deliberadamente mínimo para `/MaquinaEstado`, no mesmo espírito de
`pac-insert-minimo`:

- contrato Event Grid para `jornadausuario-insert`/`jornadausuario-update`;
- roteamento real para `/services/apexrest/MaquinaEstado`;
- cenário `maquina-estado-insert-minimo`;
- verificação/cleanup da `Opportunity` criada pelo evento;
- cleanup fail-closed de `OpportunityLineItem`, já que `criaProdutoDaOportunidade`
  é chamado sempre após o `upsert` bem-sucedido.

## Pré-condições lidas na org `mrv-devDan`

| Item | Resultado real |
| --- | --- |
| `Opportunity` RecordType `Unidade` | `0124T000000YRR4QAO` |
| Price Book padrão ativo | `01s4T000000c1bEQAQ` (`Standard Price Book`) |
| `UsuarioPadraoClientes__c` org default | `IdUsuario__c = 0054T000001RSQLQA4` |
| Usuário fallback | `0054T000001RSQLQA4` — `COM_Salesforce_MRV_PRD MRV_PRD` (`IsActive=true`) |
| `PricebookEntry` ativo escolhido | `01uV2000002wmeDIAQ` |
| `Product2` escolhido | `01tV200000AVSn3IAH` |
| `Product2.Id__c` usado no payload | `7d9261ee-c2b8-f011-8df6-80c16e075108` |
| `Product2.Name` | `PARQUE MARISTA - BLOCO 01 - 2 Q - APTO 107` |

Também foi confirmada a leitura do metadata de mapeamento:

- `MapaOportunidade__mdt.estado -> StageName`
- `MapaOportunidade__mdt.idunidade -> Unidade__r` (`Lookup` para `Product2`)

## Payload usado no smoke test

```json
{
  "cliente": {
    "idCliente": "CLI-SIM-bce7213a22-5aa56b80d1",
    "idProspectSalesforce": "PRO-SIM-bce7213a22-5aa56b80d1"
  },
  "id": "OPP-SIM-bce7213a22-5aa56b80d1",
  "dataalteracao": "2026-09-22T17:45:00.000Z",
  "estado": "SIMULACAO",
  "idunidade": "7d9261ee-c2b8-f011-8df6-80c16e075108"
}
```

## Resultado real observado

### Setup

- `CREATE_SYNTHETIC_ACCOUNT` criou a Account sintética
  `001HZ000011QarkYAC`.
- Query direta pré-dispatch confirmou a existência da Account com:
  - `Id__c = CLI-SIM-bce7213a22-5aa56b80d1`
  - `IdProspectSalesforce__c = PRO-SIM-bce7213a22-5aa56b80d1`

### Dispatch real

- Endpoint chamado: `/services/apexrest/MaquinaEstado`
- Primeira execução real: **400 Bad Request**
- Segunda execução real (repetindo o mesmo payload, mas com `idCliente`
  copiado exatamente da Account persistida): **400 Bad Request**
- Corpo devolvido nas duas execuções:

```json
{
  "Status": "Error",
  "Message": "Upsert failed. First exception on row 0; first error: INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY, insufficient access rights on cross-reference id: a0S4T000000hBf7: []"
}
```

### Efeito funcional

- **Nenhuma `Opportunity` foi criada**.
- **Nenhum `OpportunityLineItem` foi criado**.
- As verificações do cenário falharam com:
  - `OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE = 0`
  - `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 0`

## Rodada diagnóstica adicional (com Debug Log real)

Foi executada uma rodada diagnóstica dedicada contra `mrv-devDan`, mantendo a
Account viva até a coleta completa da evidência.

### Evidência objetiva coletada

- `Account.Id__c` continua configurado com `externalId=true` e `unique=true`.
- A Account sintética da rodada diagnóstica foi criada como
  `001HZ000011QqNZYA0`.
- Query direta **antes** do dispatch encontrou a Account com:
  - `Id__c = CLI-SIM-0130d92390-9e01dbc74f`
  - `IdProspectSalesforce__c = PRO-SIM-0130d92390-9e01dbc74f`
- Query direta **depois** da falha encontrou a mesma Account, sem alteração do
  `Id__c`.
- Comparação programática payload × registro persistido:
  - `payloadEqualsAccountId = true`
  - `payloadLength = 29`
  - `accountLength = 29`
  - `payloadHex = 434c492d53494d2d303133306439323339302d39653031646263373466`
  - `accountHex = 434c492d53494d2d303133306439323339302d39653031646263373466`
- Segunda tentativa reaproveitou o `idCliente` lido diretamente da Account
  persistida; o valor copiado era byte-a-byte idêntico ao original e a falha
  foi exatamente a mesma.

### O que o Debug Log provou

O Debug Log elimina a hipótese de que o `/MaquinaEstado` não esteja encontrando
o cliente:

- `ClienteService.getClientePosPacComOrigem(...)` foi chamado.
- `ClienteSelector.obterClientePorIdCliente(...)` foi chamado.
- A SOQL executada foi:

```sql
SELECT Id, Id__c, CPF__pc, IdProspectSalesforce__c, PersonEmail, Celular__c,
       CelularSemFormatacao__c, PersonMobilePhone, PersonHomePhone,
       RendaFamiliar__c, Name, LastName, LastModifiedDate, BillingCountry,
       DataAlteracaoEventoContatoCelular__c, DataAlteracaoEventoContatoEmail__c,
       DataAlteracaoEvento__c, DataAlteracaoEventoEndereco__c,
       DataAlteracaoEventoContatoTelefone__c, CPFSemFormatacao__c
FROM Account
WHERE Id__c = :tmpVar1
ORDER BY LastModifiedDate DESC NULLS FIRST
LIMIT 1
```

- Resultado da query: `Rows:1`.
- O log mostra `this.cliente` preenchido com a Account sintética
  `001HZ000011QqNZYA0`.

Portanto, o erro observado na primeira rodada (`Cliente(Account) não
encontrado`) não se reproduziu sob inspeção controlada. O lookup do cliente
funciona.

### Nova causa raiz observada

Na mesma execução, o log mostra a `Opportunity` sendo montada assim antes do
`upsert`:

- `AccountId = 001HZ000011QqNZYA0`
- `StageName = Simulação`
- `Pricebook2Id = 01s4T000000c1bEQAQ`
- `RecordTypeId = 0124T000000YRR4QAO`
- `CidadeUnidade__c = a0S4T000000hBf7UAE`

Também foi confirmado por query que o `Product2` escolhido
(`01tV200000AVSn3IAH`) referencia exatamente:

- `Cidade__c = a0S4T000000hBf7UAE`

O `upsert` então falha com:

```text
INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY
insufficient access rights on cross-reference id: a0S4T000000hBf7
```

Consultas adicionais mostraram:

- Prefixo `a0S` resolve para o objeto `Cidade__c`.
- `Opportunity.CidadeUnidade__c` é um `Lookup(Cidade)`.
- `Product2.Cidade__c` também é um `Lookup(Cidade)`.
- Query direta em `Cidade__c` para `a0S4T000000hBf7UAE` retornou **0 linhas**,
  inclusive com `--all-rows`, embora o `Product2` continue apontando para esse
  Id.

### Interpretação da rodada diagnóstica

O bloqueio real desta tarefa **não está no match da Account** nem em erro de
serialização do `idCliente`. O bloqueio atual está no dado/permissão associado
ao `Product2` real escolhido:

- o Apex encontra a Account;
- herda `Cidade__c` do `Product2` para `Opportunity.CidadeUnidade__c`;
- o `upsert` da `Opportunity` quebra ao referenciar `a0S4T000000hBf7UAE`
  (`Cidade__c`).

Na prática, o `Product2` ativo usado no smoke test carrega um lookup de cidade
que está inacessível ou inconsistente para esta operação.

## Cleanup real

- O cleanup removeu a Account sintética criada no setup/diagnóstico.
- Estado final pós-cleanup:
  - `Account`: 0 registros
  - `Opportunity`: 0 registros
  - `OpportunityLineItem`: 0 registros

## Interpretação

O simulador agora cobre corretamente o contrato mínimo, o roteamento e o
cleanup de `OpportunityLineItem`. O bloqueio remanescente está no comportamento
real da org `mrv-devDan`: o fluxo encontra a Account corretamente, mas falha no
`upsert` da `Opportunity` ao tentar gravar `CidadeUnidade__c` com o Id
`a0S4T000000hBf7UAE` herdado do `Product2` selecionado.

## Próximo passo sugerido

Validar no Salesforce qual `Product2`/`Cidade__c` real pode ser usado sem
gerar `INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY`, ou corrigir a
consistência/permissão do lookup `Cidade__c` na org antes de ampliar os
cenários de Tarefa 7.2.
