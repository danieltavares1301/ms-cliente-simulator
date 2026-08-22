# Matriz de contratos da Fase 0

## Evidência e limites

Contrato levantado por leitura de `EventGrid.cls`, `NotificacaoCliente.cls`, `MSClienteService.cls`, `GraphQLCreator.cls`, `NotificacaoClienteTest.cls` e `MSClienteServiceTest.cls` no repositório Salesforce, usado somente como fonte. Os seis eventos entram por `POST /Cliente`; o callback sai do Salesforce como GraphQL. A matriz descreve o comportamento existente, inclusive diferenças entre validação explícita e campos necessários para produzir efeito.

## Envelope Event Grid

O Apex desserializa um array, normaliza as **chaves** para minúsculas e percorre todos os itens. Para o simulador, o contrato fica restrito a exatamente um item por request.

| Campo | Tipo observado | Obrigatoriedade real | Uso no Apex |
|---|---|---|---|
| `id` | string | Requerido pelo simulador; não validado pelo Apex | Identificador do evento para rastreio; não identifica a Account. |
| `subject` | string | Não validado | Apenas parte do envelope tipado. |
| `data` | objeto | Obrigatório | Convertido para mapa; ausência ou tipo inválido causa erro. |
| `eventType` | string | Obrigatório | Seleciona um dos seis mapeamentos de metadata e a regra de processamento. |
| `eventTime` | datetime ISO 8601 | Obrigatório | Formatado para logging; não decide obsolescência. |
| `dataVersion` | string | Não validado | Desserializado, sem regra de negócio. |
| `metadataVersion` | string | Não validado | Desserializado, sem regra de negócio. |
| `topic` | string | Não validado | Desserializado, sem regra de negócio. |

`data.IdCliente` é o identificador de negócio obrigatório. O código tenta primeiro `data.id` e usa `data.idcliente` quando o primeiro está em branco; por segurança, fixtures não devem enviar valores divergentes nesses dois campos. `data.IdProspectSalesforce` e `data.NumeroCPF` participam da resolução de Account/Lead em todos os tipos, mas não têm validação explícita de presença.

## Campos por evento

`insert` e `update` de cada família executam o mesmo ramo. Campo “condicional” significa que o Apex aceita sua ausência; “necessário para efeito” significa que a request pode retornar `200` sem alterar o atributo pretendido quando ele falta.

| `eventType` | Campos de `data` efetivamente lidos | Obrigatoriedade e efeito |
|---|---|---|
| `cliente-insert` | `id`, `IdCliente`, `IdProspectSalesforce`, `NumeroCPF`, `DataAlteracao`, `Categoria`, `CodSAP`, `DataNascimento`, `Escolaridade`, `EstadoCivil`, `Naturalidade`, `NomeCompleto`, `NomeMae`, `NomePai`, `NumeroPIS`, `NumeroDocumento`, `OrgaoEmissorDocumento`, `Profissao`, `SistemaOrigem`, `TipoPessoa`, `TituloEleitor`, `Sexo` | Apenas `IdCliente` é explicitamente obrigatório. Os demais são condicionais. Para criar Person Account válida no cenário normal, a fixture deve fornecer os campos exigidos pela configuração Salesforce, especialmente o nome; isso será fechado pela matriz FLS/metadata antes do E2E. |
| `cliente-update` | Mesmos campos de `cliente-insert` | Mesma validação e mesmo mapeamento. Não há semântica distinta de patch além do upsert/update encontrado. |
| `contato-insert` | `id`, `IdCliente`, `IdProspectSalesforce`, `NumeroCPF`, `DataAlteracao`, `TipoContato`, `Descricao` | `IdCliente` é explicitamente obrigatório. `TipoContato` + `Descricao` são necessários para efeito. Valores tratados: `Email`, `Celular`, `Telefone`. |
| `contato-update` | Mesmos campos de `contato-insert` | Mesmo ramo e mesmos valores de `TipoContato`. |
| `endereco-insert` | `id`, `IdCliente`, `IdProspectSalesforce`, `NumeroCPF`, `DataAlteracao`, `TipoEndereco`, `IdCidade`, `Logradouro`, `NumeroCEP`, `Bairro`, `Numero` | `IdCliente` é explicitamente obrigatório. Só há efeito de endereço quando `TipoEndereco` é exatamente `COBRANCA`; os demais campos são condicionais. `IdCidade` resolve `Cidade__c` e deriva cidade/UF; país vira `Brasil` se ausente. |
| `endereco-update` | Mesmos campos de `endereco-insert` | Mesmo ramo e mesma comparação temporal. |

Observações de fidelidade:

- Campos presentes em amostras de teste mas não lidos pelo código não fazem parte deste contrato.
- `SistemaOrigem` é lido, porém a atribuição existente é condicionada indevidamente à presença de `Profissao`; o simulador deve preservar o payload, não corrigir silenciosamente a regra Apex.
- Há amostra antiga de teste com `TipoEndereco: "Cobranca"`, mas a implementação atual compara `COBRANCA`; as fixtures novas usarão o valor exato do código.
- Eventos de contato/endereço recebidos antes do cliente podem resultar em descarte, registro parcial ou erro conforme os dados de correlação e regras da org. Ordem invertida deve ser um cenário explícito, não o caminho nominal.

## Semântica temporal, ordem e assíncrono

- `data.DataAlteracao`, e não `eventTime`, controla obsolescência.
- O parser existente espera datetime UTC em formato compatível com `yyyy-MM-ddTHH:mm:ss[.000]Z`; amostras contêm frações maiores, mas o parser remove apenas `.000Z`. A Fase 1 deve normalizar fixtures para o formato comprovadamente aceito e cobrir frações em teste de contrato.
- Se `DataAlteracao` estiver ausente, o Apex permite processamento e não atualiza o marcador temporal. Portanto ela é opcional no código, mas obrigatória nas fixtures temporais.
- Evento só altera o registro quando a data recebida é posterior ao marcador aplicável: cliente, endereço ou o marcador específico de `Email`, `Celular` ou `Telefone`. Data igual/mais antiga é tratada como sucesso sem alteração.
- O Apex aceita lotes e os processa em sequência, mas compartilha estado na instância. O MVP envia um evento por request e persiste a ordem dos passos.
- O `200` do `/Cliente` confirma apenas o processamento síncrono. Criação/vínculo de Lead, sincronização do Proponente principal e callback podem ocorrer depois em Queueable/Future; assertions finais devem aguardar.

## Respostas do `/Cliente`

| Situação | Resposta observada |
|---|---|
| Evento mapeado processado ou obsoleto | HTTP `200`; sem corpo de sucesso definido. |
| `eventType` não mapeado | Corpo `{ "Status": "Error", "Message": "EventType não mapeado!" }`; o teste legado espera `503` para tipo alheio aos eventos de cliente. |
| Erro em um dos seis tipos, inclusive `IdCliente` ausente | HTTP padrão `400`, passível de remapeamento por `Error_Response_Mapping__mdt`; corpo no formato `{ "Status": "Error", "Message": "..." }`. |
| Subscription validation | HTTP `200` com `ValidationResponse` quando `validationCode` existe; não integra o MVP funcional. |

O simulador deve considerar payload truncado/malformado inválido antes do envio. Não deve reproduzir exposição de exception/stack no corpo nem registrar payload bruto.

## Callback GraphQL `atualizarCliente`

O Salesforce envia `POST` com `Content-Type: application/graphql`, timeout de 12 segundos e mutation `atualizarCliente(cliente: {...}) { id }`.

| Campo de `cliente` | Origem Account | Emissão |
|---|---|---|
| `id` | `Id__c` | Condicional; convertido para uppercase. |
| `nomeCompleto` | `LastName` | Condicional. |
| `dataNascimento` | `PersonBirthdate` | Condicional; `Date` serializado pelo `JSON.serialize` do Apex. |
| `cadastroNacional` | `CPF__pc` | Condicional. |
| `numeroDocumento` | `NumeroRG__pc` | Condicional. |
| `dataEmissaoDocumento` | `DataEmissaoDocumento__pc` | Condicional; `Date` serializado pelo Apex. |
| `estadoEmissorDocumento` | `EstadoEmissorDocumento__pc` | Condicional. |
| `naturalidade` | `Naturalidade__pc` | Condicional. |
| `escolaridade` | `Escolaridade__pc` | Condicional. |
| `nomeMae` | `NomeMae__pc` | Condicional. |
| `renda` | `RendaPessoal__pc` | Condicional. |
| `orgaoEmissorDocumento` | `OrgaoEmissor__pc` | Condicional; convertido para enum GraphQL. |
| `nacionalidade` | `Nacionalidade__pc` | Condicional; convertido para enum GraphQL. |
| `sexo` | `Sexo__c` | Condicional; convertido para enum GraphQL. |
| `estadoCivil` | `EstadoCivil__pc` | Condicional; convertido para enum GraphQL. |
| `idProspectSalesforce` | `IdProspectSalesforce__c` | Condicional; convertido para uppercase. |

Nenhum campo é validado como obrigatório por `preencherParametrosAtualizar`. No fluxo efetivo disparado por `NotificacaoCliente.callMSClienteFuture`, a Account transitória contém somente `Id__c` e `IdProspectSalesforce__c`; esses são, portanto, os dois campos esperados no callback pós-vínculo.

Resposta de sucesso aceita pelo Apex: HTTP `200` ou `201` e JSON com `data.atualizarCliente.id`. Outros status, JSON inválido, corpo vazio ou `errors` sem `data.atualizarCliente` são tratados como falha interna de integração, sem desfazer o vínculo local e sem propagar exceção ao chamador Future.

## Segurança

- Não versionar exports brutos, IDs de usuários, hosts, tokens ou payloads de
  logs. Dados de negócio seguem autorização, minimização e LGPD; a API não
  classifica procedência real/fake.
- Vercel → Salesforce usa identidade exclusiva e acesso apenas a `/Cliente` e REST/Composite allowlisted.
- Salesforce → Vercel usa Named Credential/External Credential dedicados; não repassa token do serviço real.
- Correlacionar por IDs sintéticos namespaced por `runId`; redigir payloads antes do logging.
- Rejeitar corpo inválido, mais de um evento, `eventType` fora da allowlist e destino fora do Safety Guard antes de chamar Salesforce.
