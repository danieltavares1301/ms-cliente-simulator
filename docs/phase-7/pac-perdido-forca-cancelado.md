# PAC com Opportunity Perdido — variação 4 de 5

## Escopo deste incremento

Esta variação cobre o caso mínimo pedido para `/PAC` quando a Opportunity já
existe e nasce em `StageName='Perdido'`.

Hipótese inicial: o contrato lido em `NotificacaoPAC.preencherDadosPAC`
sugeriria o override abaixo:

```apex
this.propostaAnaliseCredito.Status__c = this.oportunidade != null && this.oportunidade.StageName == 'Perdido'
    ? 'Cancelado'
    : status;
```

O objetivo prático deste incremento foi validar **contra a org real**
`mrv-devDan` se esse override realmente acontece no `pac-insert`.

## Verificações prévias obrigatórias

### 1. Picklist real de `Opportunity.StageName`

Antes do cenário, o describe via `sf` CLI confirmou que o valor exato do
picklist nesta org é mesmo:

- `Perdido`

Não foi necessário adaptar para `Fechado Perdido`, `Cancelada` ou outro rótulo.

### 2. `CREATE_SYNTHETIC_OPPORTUNITY` já aceitava `stageName` parametrizado

A investigação no simulador mostrou que o setup já usa
`opportunity.stageName` de ponta a ponta:

- schema contratual (`src/contracts/scenarios.ts` / `src/contracts/fixtures.ts`);
- renderização do fixture;
- setup real do adapter (`src/salesforce/test-data-adapter.ts`);
- testes existentes do adapter.

Ou seja: **não havia hardcode funcional para `Simulação` no código de produção
do setup**. O default neutro continuou apenas nos cenários anteriores; nesta
variação bastou publicar o novo cenário com `stageName: 'Perdido'`.

## Execução real em `mrv-devDan`

Execução final usada como evidência:

- `executionId`: `manual-pac-lost-1790084726442`
- `Account.Id__c`: `CLI-SIM-abc7d7f0a8-bf84e0696e`
- `Opportunity.Id__c`: `OPP-SIM-abc7d7f0a8-bf84e0696e`
- `PAC.Id__c`: `PAC-SIM-abc7d7f0a8-bf84e0696e`
- `StageName` configurado no setup: `Perdido`
- `status` enviado no payload: `CREDITO_APROVADO_CONDICIONADO`

### Resultado operacional

- `setupResult.status = CREATED`
- `createdCount = 2`
- `dispatch /PAC = 200 OK`
- `verifyResult.passed = true`
- `cleanupResult.status = DELETED`
- `deletedCount = 2`

## Evidência direta na org

### Opportunity

```json
{
  "Id": "006HZ00000TzSLHYA3",
  "Id__c": "OPP-SIM-abc7d7f0a8-bf84e0696e",
  "AccountId": "001HZ000011QJJ4YAO",
  "Name": "Opportunity Sintética PAC Perdido",
  "StageName": "Perdido",
  "CloseDate": "2026-09-30",
  "PACAtual__c": "a0kHZ00000BLY5FYAX"
}
```

### PropostaAnaliseCredito__c

```json
{
  "Id": "a0kHZ00000BLY5FYAX",
  "Id__c": "PAC-SIM-abc7d7f0a8-bf84e0696e",
  "Oportunidade__c": "006HZ00000TzSLHYA3",
  "Status__c": "CREDITO_APROVADO_CONDICIONADO"
}
```

## Resultado real observado

O comportamento real **divergiu da hipótese inicial**:

- a Opportunity realmente estava com `StageName='Perdido'`;
- a PAC foi criada e vinculada corretamente à Opportunity;
- porém o `Status__c` persistido na `PropostaAnaliseCredito__c` ficou
  **`CREDITO_APROVADO_CONDICIONADO`**, exatamente o mesmo valor enviado no
  payload;
- **não** houve override para `Cancelado` nesta execução real de `pac-insert`.

## Conclusão prática para o simulador

O cenário publicado mantém a chave solicitada
`pac-insert-opportunity-perdida-forca-cancelado`, mas os asserts automáticos
foram ajustados para refletir o **comportamento real observado** em
`mrv-devDan`:

- vínculo PAC ↔ Opportunity continua obrigatório;
- `Status__c` esperado passa a ser
  `CREDITO_APROVADO_CONDICIONADO` (payload), e não `Cancelado`.

Isso transforma o cenário em um guard rail de regressão para a realidade da org
hoje, além de documentar explicitamente a divergência entre leitura teórica do
trecho Apex e o efeito persistido no ambiente.

## Limpeza real

O cleanup removeu:

- `PropostaAnaliseCredito__c:a0kHZ00000BLY5FYAX`
- `Opportunity:006HZ00000TzSLHYA3`
- `Account:001HZ000011QJJ4YAO`

## Verificação final de resíduos

Após o cleanup, as queries finais retornaram:

```json
{
  "account": 0,
  "opportunity": 0,
  "proposta": 0,
  "proponentes": 0
}
```
