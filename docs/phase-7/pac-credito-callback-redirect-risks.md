# Redirecionamento do callback PAC Crédito para o simulador

## Contrato real confirmado em produção

O Apex `EnvioPACCreditoQueue.cls` faz um callout `POST` para um endpoint externo
com:

- `Content-Type: application/json`
- `Authorization: SharedAccessSignature ...`
- body JSON serializado via `JSON.serialize(new Requisicao(...))`

Payload confirmado:

```json
{
  "IdSalesforcePac": "string",
  "IdPac": "string",
  "IdJornada": "string",
  "DataCriacao": "2026-01-01T00:00:00.000Z"
}
```

No fluxo atual do Apex, `201` significa sucesso. Qualquer resposta diferente é
apenas logada como falha operacional; a classe **não lança exceção** e trata o
callback como integração fire-and-forget.

## Motivo do redirecionamento

Foi identificado que, mesmo na org pessoal de desenvolvimento `mrv-devDan`, a
integração PAC Crédito estava apontando por legado/configuração indevida para um
Azure Service Bus de **produção**:

`mrvqualidadecredito-servicebus-prd.servicebus.windows.net`

O objetivo desta fase é preparar no simulador um endpoint compatível para que o
operador humano redirecione a org de dev sem tocar em produção.

## Raio de impacto confirmado

O uso dos campos `URITokenCCA__c`, `KeyNameCCA__c` e `ChavePrimariaCCA__c` do
custom setting `AzureServiceBus__c` está restrito ao fluxo PAC Crédito:

- `EnvioPACCreditoQueue.cls`
- `EnvioPACCreditoQueueTest.cls`

Nenhuma outra classe conhecida consome esses campos. Portanto, o redirecionamento
do endpoint e a troca das credenciais por placeholders afetam apenas essa
integração específica.

## Decisão de credenciais falsas

Assim como já foi aceito no precedente
[`docs/phase-5/servico-clientes-redirect-risks.md`](../phase-5/servico-clientes-redirect-risks.md),
esta integração usará credenciais deliberadamente falsas na org de dev após o
redirecionamento:

- `URITokenCCA__c`
- `KeyNameCCA__c`
- `ChavePrimariaCCA__c`

Consequência prática:

- o Apex continuará gerando um header no formato
  `SharedAccessSignature sr=...&sig=...&se=...&skn=...`;
- esse token **não** precisará ser válido contra o Azure real;
- o simulador fará somente validação estrutural leve do prefixo literal
  `SharedAccessSignature`, sem verificação criptográfica da assinatura.

Essa escolha reduz trabalho desnecessário e evita qualquer dependência do Azure
real durante os testes da sandbox.

## Endpoint preparado no simulador

O simulador expõe `POST /api/ms-clientes/pac-credito`, protegido por feature
flag e com as seguintes regras:

- exige `ORCHESTRATION_ENABLED=true`;
- exige `PAC_CREDITO_CALLBACK_ENABLED=true`;
- exige header `Authorization` começando com `SharedAccessSignature`;
- valida o payload JSON com schema estrito;
- responde `201` com `{ "accepted": true, "requestId": "..." }` quando aceito;
- registra log estruturado sem persistir nem exibir o SAS token recebido.

## PENDENTE: preenchido apos o redirecionamento real na org e validacao end-to-end

- endpoint final configurado na org:
- data/hora do redirecionamento:
- evidencias de log Apex:
- evidencias de log do simulador:
- resultado do teste ponta a ponta:
