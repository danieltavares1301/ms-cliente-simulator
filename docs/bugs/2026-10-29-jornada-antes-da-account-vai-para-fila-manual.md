# A jornada que chega antes da Account vai para a fila manual

- **Reportado por:** QA, em 29/10/2026, testando a unificação 1.3 e 2.2 no
  mesmo branch.
- **Ambiente:** `mrv-staging`, com o código do `develop`. Para as classes
  envolvidas, ele é igual ao `GV_909649_918914` (conferido em 29/10, pelo
  corpo das classes).
- **Status:** corrigido pelo mapeamento da seção 6. O registro
  `Cliente_Account_nao_encontrado` (500) entrou na staging e na `mrv-devDan`
  entre 29/10 e 31/10. Falta ver a jornada reentregue em vez de ir para a fila
  manual num caso real.
- **É regressão da unificação?** Não. O mesmo erro já aparecia na staging
  antes de o código da unificação chegar lá (seção 4).

## 1. O sintoma

Eventos `jornadausuario-insert` e `jornadausuario-update` da Plataforma BFF
vão para a fila manual com esta resposta:

```json
{ "Status": "Error", "Message": "Cliente(Account) não encontrado no Salesforce. clienteProspect.idClient: null. clienteProspect.idProspectSalesforce: 14104530-24d2-e276-2dbb-392520234368." }
```

O evento que a QA mandou, com os dados pessoais trocados por marcadores e só
os campos que importam:

```json
{
  "Id": "419dc33f-3b1b-4d73-8d1d-5342be8fef07",
  "EventType": "jornadausuario-update",
  "Subject": "jornadas",
  "EventTime": "2026-10-29T13:49:27.6034953+00:00",
  "Data": {
    "Id": "c03aea5e-5283-401e-baec-b40a62d70149",
    "Cliente": {
      "idCliente": null,
      "IdProspectSalesforce": "14104530-24d2-e276-2dbb-392520234368",
      "nomeCompleto": "<nome>",
      "contatos": [
        { "TipoContato": "EMAIL", "descricao": "<email>" },
        { "TipoContato": "CELULAR", "descricao": "<celular>" }
      ]
    },
    "JornadaLead": true,
    "Origem": "SALESFORCE",
    "TipoJornada": "JornadaFinanciamento",
    "Estado": "Unidades",
    "ProponenteCredito": null,
    "Pac": null
  }
}
```

É a jornada de financiamento que o Salesforce inicia a partir de um Lead
(`JornadaLead`, origem `SALESFORCE`), no estado "Unidades". Nesse ponto, o
evento ainda não traz o IdCliente nem o CPF (o `ProponenteCredito` vem
vazio), só o prospect do Lead.

## 2. A causa: uma corrida entre a BFF e o fluxo de tela

O `/MaquinaEstado` exige a Account da pessoa. Ele a procura pelo IdCliente,
pelo CPF ou pelo prospect (`ClienteService.getClientePosPac`). Sem Account, ele
lança "Cliente(Account) não encontrado"
(`NotificacaoMaquinaEstado.cls:69`, no `com_salesforce_mrv`).

Na staging, em 29/10 (horários em UTC):

| Hora | O que aconteceu |
|---|---|
| 13:48:05 | O gerente cria o Lead (cadastro manual, com CPF) e inicia a jornada |
| 13:49:14 | `jornadausuario-insert`: erro, ainda não há Account |
| **13:49:27** | **`jornadausuario-update` (o da QA): erro** |
| 13:49:28 | A Account é criada pelo fluxo de tela do gerente (perfil Gerente Vendas), já com o prospect do Lead, o IdCliente e o CPF |
| 13:49:34 | `pac-insert`: erro, "Oportunidade não encontrada" |
| 13:49:36 | A Opportunity da jornada é criada na Account |
| 13:49:40 | Mais um `jornadausuario-update` com erro |
| 13:49:57 em diante | Todos os eventos da jornada (`jornadausuario-update`, `pac-update`, `analiseproposta-update`) passam |

A BFF publica os primeiros eventos da jornada enquanto o fluxo de tela ainda
está criando a Account no Salesforce. Neste caso, a Account só existiu 14 s
depois do primeiro evento. Quem chega nessa janela falha.

**Registros na staging:** Lead `00QHZ00000dm0lq2AA`, Account
`001HZ000014VWQbYAO`, Opportunity `006HZ00000VCZBRYA5`, log do evento da QA
`a0dHZ00000PHp6MYAT`.

## 3. Por que vai para a fila manual, e os outros erros não

O status que cada endpoint devolve ao Event Grid decide se o evento é
reentregue. O Event Grid reentrega 500 e 503, mas não 400.

| Endpoint | Erro | Status | O que acontece |
|---|---|---|---|
| `/MaquinaEstado` | "Cliente(Account) não encontrado" | **400** | Sem reentrega: fila manual |
| `/PAC` | "Oportunidade não encontrada" | 503 | Reentregue; resolveu sozinho |
| `/Cliente` (`contato-*` e `endereco-*`) | "Parcial antes do cliente" | 500 | Reentregue e aplicado depois do `cliente-insert` |

- **No `/MaquinaEstado`:** o `responderErroEPublicarLogIntegracao` começa com
  400 e só troca o status se a mensagem casar com um registro do
  `Error_Response_Mapping__mdt` (`NotificacaoMaquinaEstado.cls:758`). A staging
  tem 27 registros (26 ativos), e nenhum casa com "Cliente(Account) não
  encontrado".
- **No `/PAC`:** ele herda o `EventGrid`, que responde 503 a qualquer exceção
  fora do `/Cliente`.
- **No `/Cliente`:** o "Parcial antes do cliente" tem o registro
  `Parcial_antes_do_cliente` (500), ativo na staging. Desde 27/10 foram 60
  casos, todos aplicados na reentrega, de 10 a 36 s depois.

## 4. Não é regressão da unificação

Erros de `jornadausuario-*` por "Cliente(Account) não encontrado" na staging,
por semana. A busca para em 2.000 logs de erro por semana, então a semana de
06/10 pode ter mais.

| Semana de | Erros de jornada | Por "Cliente(Account) não encontrado" |
|---|---:|---:|
| 29/09 | 1.178 | 15 |
| 06/10 | 2.000 | 71 |
| 13/10 | 360 | 134 |
| 20/10 | 370 | 133 |
| 27/10 (até 29/10) | 88 | 19 |

O erro já existia antes de o código da unificação chegar à staging. A
unificação não mudou essa regra: a jornada sempre exigiu a Account. No caso da
QA, a busca teria achado a Account pelo prospect se ela já existisse.

## 5. Impacto

- **Na fila manual:** os eventos que chegam antes da Account (neste caso, 3).
- **No estado final:** nenhum. Os eventos seguintes trazem o estado completo
  da jornada e passam. A Opportunity foi criada, e a jornada seguiu.
- **Na operação:** quem trata a fila manual recebe eventos que já foram
  superados. Eles podem ser descartados depois de conferir que a jornada
  andou.

## 6. Correção proposta (decisão do time)

**Aplicada:** em 31/10, a staging e a `mrv-devDan` já têm o registro
`Cliente_Account_nao_encontrado` (padrão "Cliente(Account) não encontrado",
500, ativo). Em 29/10, a staging tinha 27 registros, sem ele; em 31/10, 28.

A proposta era acrescentar um registro ao `Error_Response_Mapping__mdt` que mapeie
"Cliente(Account) não encontrado" para 500. É o que já se faz para
"Oportunidade não encontrada" e para "Parcial antes do cliente". O Event Grid
reentregaria o evento em 10 a 30 s, quando a Account já existe, como acontece
hoje com os contatos.

- **Prós:** o caso comum, a corrida de alguns segundos, se resolve sozinho e
  some da fila manual. Não muda código, só um registro de metadado.
- **Contras:** quando a Account nunca vier, o evento é reentregue até esgotar
  a política da assinatura (até 24 h no padrão do Event Grid) e só então vai
  para a fila manual. Chega lá mais tarde, mas chega.
- **Cuidado com o padrão:** o mapeamento casa pelo texto da mensagem com o
  stack trace, em minúsculas e em todos os endpoints que usam o mapeamento.
  No código do branch, só o `/MaquinaEstado` lança esse texto.
- **O que não se sabe:** a política de reentrega da assinatura do
  `/MaquinaEstado` na MRV (tentativas e tempo até a fila manual).

## 7. Relacionado: duplicado em contato e endereço sai 400

Em 27/10, às 18:30, 2 `contato-update` e 2 `endereco-update` deram
`DUPLICATE_VALUE` num campo único que não é o `Id__c`. O mapeamento
`Erro_de_Duplicate` (500) só casa com "valor duplicado encontrado: id__c
duplica o valor". Por isso esses saíram 400 e foram para a fila manual. Ainda
não foi investigado qual campo é nem por que duplicou.

## 8. Como conferir de novo

Todas as consultas são só de leitura, na `mrv-staging`:

```sql
-- O Lead e a Account do prospect, com a hora de criação
SELECT Id, CreatedDate, Status FROM Lead WHERE Id__c = '14104530-24d2-e276-2dbb-392520234368'
SELECT Id, CreatedDate, CreatedBy.Name FROM Account WHERE IdProspectSalesforce__c = '14104530-24d2-e276-2dbb-392520234368'

-- Os mapeamentos de erro ativos
SELECT DeveloperName, Error_Pattern__c, HTTP_Status_Code__c, IsActive__c FROM Error_Response_Mapping__mdt

-- Os erros de jornada de uma semana; filtrar o StackTrace__c fora do SOQL
-- (campo longo) por "Cliente(Account) não encontrado"
SELECT CreatedDate, EventType__c, StackTrace__c FROM LogIntegracao__c
WHERE EventType__c IN ('jornadausuario-insert', 'jornadausuario-update') AND Status2__c = 'error'
AND CreatedDate >= 2026-10-27T00:00:00Z
```

**No simulador:** o harness do runbook não reproduz essa corrida, porque cria
a Account antes da jornada. Para reproduzir, basta mandar um
`jornadausuario-insert` com `JornadaLead`, sem IdCliente e com o prospect de um
Lead sem Account, e só depois criar a Account com esse prospect.
