# Redirecionamento da Named Credential `ServicoClientes` para o simulador

## Decisão tomada

Após ser alertado de forma explícita sobre os riscos, o usuário decidiu
**redirecionar a Named Credential compartilhada `ServicoClientes` para o
simulador, somente na org `mrv-devDan`**, aceitando o impacto operacional nas
outras integrações que também dependem desse mesmo token OAuth real.

Essa decisão **não** redireciona apenas `VFlexMsClientes`. O redirecionamento
atinge a credencial compartilhada `ServicoClientes`, usada por um conjunto mais
amplo de consumidores Apex fora do MS Cliente. A investigação da sessão
identificou aproximadamente **19 classes** consumidoras de
`NotificacaoHelper.autenticacao()` / `callout:ServicoClientes`.

## Consumidores confirmados que usam o mesmo token para outros serviços reais

Classes confirmadas na investigação e seus destinos reais:

- `BoletoHelper.cls`
  - `EndpointBoleto__c`
  - `EndpointGerarBoleto__c`
- `LeadService.cls`
  - `URLGraphl__c`
- `ContestacaoTriggerHandler.cls`
  - `Endpoints__c.ContestacaoInsert__c`
  - `Endpoints__c.ContestacaoComDocumentos__c`

Esses exemplos demonstram que a credencial é compartilhada por integrações
reais **não relacionadas** ao MS Cliente. A lista completa dos consumidores
levantados na sessão é mais ampla (~19 classes).

## Efeito concreto enquanto o redirecionamento estiver ativo

Enquanto `ServicoClientes` apontar para o simulador em `mrv-devDan`:

- o Apex continuará chamando `NotificacaoHelper.getToken()` / `callout:ServicoClientes`;
- o simulador devolverá um token fake para desenvolvimento;
- as integrações reais que usam esse token contra seus serviços verdadeiros
  passarão a falhar por autenticação inválida, tipicamente com **401**.

Em termos práticos, isso significa quebra temporária e intencional das outras
integrações reais da sandbox enquanto o redirecionamento permanecer ativo.

## Risco de exposição do `GRAPHQL_CALLBACK_SHARED_SECRET`

O endpoint fake `POST /api/ms-clientes/token` **não possui autenticação própria
além da feature flag** `AZURE_TOKEN_SIMULATOR_ENABLED`.

Consequência direta:

- qualquer requisição pública que acertar esse endpoint recebe de volta o valor
  atual de `GRAPHQL_CALLBACK_SHARED_SECRET` como `access_token`;
- durante esse período, o valor deixa de funcionar como segredo real;
- portanto, no callback GraphQL, o modo `SHARED_SECRET` passa a ser apenas uma
  trava operacional/liga-desliga, e **não** uma proteção robusta de segredo.

Esse comportamento é intencional neste fluxo de desenvolvimento, mas deve ser
tratado como risco aceito somente na sandbox pessoal `mrv-devDan`.

## Dados para rollback

Configuração original relevante da Named Credential compartilhada:

- **endpoint original:** `https://identity.mrv.com.br/connect/token`
- **protocol:** `Password`
- **principalType:** `NamedUser`
- **username / client_id:** preservado e **inalterado**

Neste fluxo, **somente o endpoint é alterado** para apontar ao simulador.
Nenhuma outra configuração da Named Credential precisa ser mexida.

### Como reverter

Para rollback, basta restaurar o `endpoint` original:

`https://identity.mrv.com.br/connect/token`

Nenhuma outra propriedade precisa ser revertida.

## Escopo restrito à org pessoal

Este redirecionamento é **exclusivo da org `mrv-devDan`** (sandbox pessoal).

- **Nunca** replicar em staging.
- **Nunca** replicar em produção.
- A configuração não é versionada neste repositório do simulador.
- A configuração também não está versionada no repositório Salesforce, porque
  Named Credentials estão fora do versionamento daquele projeto (`.forceignore`).

Em resumo: trata-se de uma mudança operacional local/temporária da sandbox
pessoal, deliberadamente fora de versionamento, com impacto colateral aceito
apenas para desenvolvimento.
