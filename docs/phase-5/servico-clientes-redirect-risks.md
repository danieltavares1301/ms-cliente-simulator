# Redirecionamento da Named Credential `ServicoClientes` para o simulador

## Decisão tomada

Após ser alertado de forma explícita sobre os riscos, o usuário decidiu
**redirecionar a Named Credential compartilhada `ServicoClientes` para o
simulador, somente na org `mrv-devDan`**, aceitando o impacto operacional nas
outras integrações que também dependem desse mesmo token OAuth real.

Essa decisão **não** redireciona apenas `VFlexMsClientes`. O redirecionamento
atinge a credencial compartilhada `ServicoClientes`, usada por um conjunto mais
amplo de consumidores Apex fora do MS Cliente. Uma busca completa por
`NotificacaoHelper.autenticacao()` / `NotificacaoHelper.getToken()` no
repositório Salesforce (único ponto de acesso a `callout:ServicoClientes`,
confirmado em `NotificacaoHelper.cls`) encontrou **27 classes** consumidoras.
Descontando as 5 diretamente relacionadas ao domínio MS Cliente
(`MSClienteService.cls`, `Ges_ClienteGraphQLHelper.cls`,
`VG_MSClienteCriarAlteraRelacInvocable.cls`,
`VG_MSClienteCriarAtualizarInvocable.cls`, `VG_MSClienteObterInvocable.cls`),
restam **22 classes fora do MS Cliente** afetadas pelo redirecionamento.

## Lista completa de consumidores confirmados (27 classes)

```
AS_ContratoCorretorService.cls
AtualizarCupomDesconto.cls
AtualizarDadosLeadController.cls
BoletoHelper.cls
CampanhasOportunidadeHandler.cls
ClienteIntegration.cls
ContestacaoTriggerHandler.cls
ContratoAvaliacaoEspecialistaService.cls
DAIntegracaoModeloCEI.cls
DocumentosPACController.cls
EnviaArquivosOportunidadeInvocable.cls
EnvioCupomDesconto.cls
GAK_ControleStatusLeadSchedulable.cls
Ges_ClienteGraphQLHelper.cls                    (domínio MS Cliente)
GestaoMotivosContestacaoSchedulable.cls
ImprimirContratoPDFController.cls
InterfaceEmpreendimentosController.cls
LeadService.cls
MSClienteService.cls                            (domínio MS Cliente)
ReenviarContratoController.cls
RegeracaoContratoController.cls
VendaGenericaChamaPlataforma.cls
VG_MSClienteCriarAlteraRelacInvocable.cls       (domínio MS Cliente)
VG_MSClienteCriarAtualizarInvocable.cls         (domínio MS Cliente)
VG_MSClienteObterInvocable.cls                  (domínio MS Cliente)
VG_PropostaFlexService.cls
VG_PropostaIntegracaoService.cls
```

## Consumidores confirmados que usam o mesmo token para outros serviços reais

Três exemplos verificados linha a linha, com seus destinos reais confirmados
no código:

- `BoletoHelper.cls`
  - `EndpointBoleto__c`
  - `EndpointGerarBoleto__c`
- `LeadService.cls`
  - `URLGraphl__c`
- `ContestacaoTriggerHandler.cls`
  - `Endpoints__c.ContestacaoInsert__c`
  - `Endpoints__c.ContestacaoComDocumentos__c`

Esses três são apenas exemplos verificados em detalhe; as demais 19 classes da
lista acima (fora do domínio MS Cliente) também consomem o mesmo token para
seus próprios destinos e devem ser consideradas igualmente afetadas até prova
em contrário.

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

### Efeito colateral real encontrado durante a aplicação

O PATCH via Tooling API no campo composto `Metadata` é **substituição completa**,
não atualização parcial. Como o valor de `password` nunca é exposto por
nenhuma consulta (mascarado por segurança), o primeiro PATCH foi enviado sem
esse campo — e isso **zerou o `client_secret` real** armazenado na
`ServicoClientes`. O sintoma foi o erro:

```
You don't have permission to view this data. Ask your administrator to set
up authentication for the external data source.
```

Como o endpoint já está redirecionado ao simulador (que ignora completamente
`client_id`/`client_secret` recebidos), a correção aplicada foi preencher o
campo `password` com um **valor placeholder não sensível**
(`simulador-dev-placeholder-nao-e-segredo-real`), apenas para satisfazer a
exigência do Salesforce de que uma Named Credential do tipo `Password` tenha
uma senha não vazia. Esse valor nunca é validado por ninguém.

**Importante para rollback:** o `client_secret` real do Azure AD para essa
credencial **foi perdido** neste processo. Reverter apenas o `endpoint` para
`https://identity.mrv.com.br/connect/token` **não é suficiente** para restaurar
o funcionamento real — será necessário também reconfigurar o `client_secret`
verdadeiro (obtido no registro do aplicativo no Azure AD/Azure Portal) antes de
qualquer teste real de Boletos, Contestações, Cupons, Documentos PAC, Lead
GraphQL ou qualquer uma das ~22 integrações listadas acima.

### Validação end-to-end confirmada (2026-09-21)

Uma chamada isolada via Execute Anonymous (`MSClienteService.atualizarCliente`
com uma Account sintética em memória, sem gravação em banco) confirmou o ciclo
completo funcionando na `mrv-devDan`:

```
LogIntegracao__c EventType__c=Token                          Status2__c=success
LogIntegracao__c EventType__c=MicroServicoCliente_ATUALIZAR_CLIENTE  Status2__c=success
```

O simulador emitiu o token fake (`Token-size: 64`, compatível com
`GRAPHQL_CALLBACK_SHARED_SECRET`) e validou esse mesmo token no callback
GraphQL usando o modo `SHARED_SECRET` (forte), confirmando que o ciclo
token → callback está corretamente encadeado.

### Como reverter

Para rollback completo:

1. Restaurar o `endpoint` original: `https://identity.mrv.com.br/connect/token`.
2. Reconfigurar o `client_secret` real (não recuperável a partir do estado
   atual; precisa ser obtido novamente na origem/Azure AD).
3. Confirmar `username`/`client_id` (`6fbd5c46-4343-4c57-834c-d8cd60a12ac5`),
   que permaneceu inalterado durante todo o processo.

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
