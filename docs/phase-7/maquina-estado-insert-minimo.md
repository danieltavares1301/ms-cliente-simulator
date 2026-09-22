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
- Status HTTP observado pelo simulador: **400 Bad Request**
- Reprodução direta via REST, capturando o corpo sem redaction:

```json
{
  "Status": "Error",
  "Message": "Cliente(Account) não encontrado no Salesforce. clienteProspect.idClient: CLI-SIM-bce7213a22-5aa56b80d1. clienteProspect.idProspectSalesforce: PRO-SIM-bce7213a22-5aa56b80d1."
}
```

### Efeito funcional

- **Nenhuma `Opportunity` foi criada**.
- **Nenhum `OpportunityLineItem` foi criado**.
- As verificações do cenário falharam com:
  - `OPPORTUNITY_COUNT_BY_ID_EXTERNO_IS_ONE = 0`
  - `OPPORTUNITY_LINE_ITEM_COUNT_EQUALS_EXPECTED = 0`

## Cleanup real

- O cleanup removeu a Account sintética criada no setup.
- Estado final pós-cleanup:
  - `Account`: 0 registros
  - `Opportunity`: 0 registros
  - `OpportunityLineItem`: 0 registros

## Interpretação

O simulador agora cobre corretamente o contrato mínimo, o roteamento e o
cleanup de `OpportunityLineItem`. O bloqueio remanescente está no comportamento
real do Apex em `mrv-devDan`: mesmo com a Account sintética existente e
confirmada por query direta antes do dispatch, `NotificacaoMaquinaEstado`
retorna `Cliente(Account) não encontrado`.

## Próximo passo sugerido

Investigar por que `ClienteService.getClientePosPac(...)` não localiza a
Account criada pelo adapter neste fluxo específico de `/MaquinaEstado`
(diferença de lookup pós-PAC / requisitos adicionais do setup), antes de ampliar
os cenários de Tarefa 7.2.
