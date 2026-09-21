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

## Achado adicional durante a validação real: Remote Site Setting dedicado

O redirecionamento do custom setting sozinho **não bastou**. O Salesforce exige
que qualquer domínio de destino de um callout HTTP cru (sem Named Credential)
esteja autorizado por um **Remote Site Setting**. Encontrado um registro
dedicado a esta integração:

- **Nome**: `FilaChatterCCA`
- **`EndpointUrl` original**: `https://mrvqualidadecredito-servicebus-prd.servicebus.windows.net`
- **Consultado via Tooling API**: `SELECT SiteName, EndpointUrl FROM RemoteProxy` — confirmado que nenhuma outra classe usa esse Remote Site Setting (o raio de impacto é o mesmo já documentado acima).

Esse Remote Site Setting também foi redirecionado para
`https://ms-cliente-simulator.vercel.app`, usando o mesmo cuidado já aplicado ao
`NamedCredential` na Fase 5: o objeto `Metadata` compound (Tooling API,
`sobjects/RemoteProxy/{id}`) exige **substituição completa** no PATCH — o valor
original foi lido primeiro, só o campo `url` foi alterado, e os demais
(`disableProtocolSecurity`, `isActive`, `urls`, `description`) foram
reenviados inalterados para evitar o mesmo tipo de perda acidental de dados já
sofrida com o `ServicoClientes`.

## Achado adicional durante a validação real: schema de `DataCriacao` incompatível

A primeira tentativa de validação end-to-end (`EnvioPACCreditoQueue` real via
Execute Anonymous) retornou HTTP 422 do simulador, mesmo com a rede e a
autenticação corretas. Causa raiz: o endpoint reaproveitava
`apexCompatibleUtcDateTimeSchema` (que só aceita `.000` ou ausência de fração de
segundo), mas `DateTime.now()` do Apex real serializa com milissegundos
genuínos e arbitrários (ex.: `2026-09-21T23:36:05.153Z`). Corrigido em
`src/contracts/pac-credito.ts` com um schema dedicado
(`pacCreditoDataCriacaoSchema`) que aceita o formato exato produzido por
`JSON.serialize(DateTime)` do Apex — sem alterar `apexCompatibleUtcDateTimeSchema`,
que permanece correta para o envelope Event Grid que o próprio simulador gera
(commit `8af1cb4`).

## PENDENTE: preenchido apos o redirecionamento real na org e validacao end-to-end

- **Endpoint final configurado na org**: `EndpointChatterCCA__c` →
  `https://ms-cliente-simulator.vercel.app/api/ms-clientes/pac-credito`;
  Remote Site Setting `FilaChatterCCA` → `https://ms-cliente-simulator.vercel.app`.
- **Credenciais substituídas**: `URITokenCCA__c`, `KeyNameCCA__c`,
  `ChavePrimariaCCA__c` do custom setting `AzureServiceBus__c`
  (`Id=a184T000000HtGdQAK`) substituídos por placeholders de dev, não
  recuperáveis a partir desta sessão (mesma situação já registrada para o
  `client_secret` do `ServicoClientes` na Fase 5). Nenhum outro campo do custom
  setting foi tocado (`Endpoint__c`, usado por outra integração não
  relacionada, confirmado inalterado por consulta direta pós-deploy).
- **Data/hora do redirecionamento**: 2026-09-21, ~23:32–23:44 UTC.
- **Evidências de log Apex** (`LogIntegracao__c`, `EventType__c='EnvioPACCredito'`):
  - Primeira tentativa (antes do Remote Site Setting): `Status2__c=error`,
    `BodyRequest__c` já mostrava o endpoint correto do simulador (confirma que
    o custom setting foi lido corretamente, mas o callout foi bloqueado antes
    de sair da org).
  - Segunda tentativa (após redirecionar o Remote Site Setting, antes do fix de
    schema): `Status2__c=error` (a chamada saiu da org e chegou ao simulador,
    mas foi rejeitada com 422 pelo schema de data).
  - Terceira tentativa (após o fix de schema, `IdSalesforcePac=001HZ000011TESTE3`,
    `IdPac=PAC-DIAG-TESTE-003`): **`Status2__c=success`**.
- **Evidências de log do simulador** (`vercel logs`, ambiente `production`):
  request correlacionada por `requestId=2d114888-d21a-4bea-ac1a-fb3ac3ea4a11`,
  `responseStatusCode=201`, payload decodificado confirmando
  `IdSalesforcePac`, `IdPac`, `IdJornada` e `DataCriacao` (com milissegundos
  reais, `.922Z`) recebidos corretamente.
- **Resultado do teste ponta a ponta**: ✅ sucesso completo — Apex real
  (`EnvioPACCreditoQueue`, disparado via `System.enqueueJob` em Execute
  Anonymous) → Remote Site Setting redirecionado → custom setting
  redirecionado (endpoint + credenciais falsas) → simulador aceita (201) →
  Apex registra `LogIntegracao__c` com `Status2__c=success`. Nenhum dado real
  chegou ao Azure Service Bus de produção durante a validação.
