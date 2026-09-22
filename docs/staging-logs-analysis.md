# Análise de logs reais (`LogIntegracao__c`) em `mrv-staging`

## Contexto e motivação

Até este ponto da sessão, o contrato de cada endpoint simulado (`/Cliente`,
`/PAC`, `/MaquinaEstado`, `EnvioPACCredito`, contestação) foi derivado
**exclusivamente da leitura do código Apex** (classes, wrappers internos,
Custom Metadata) e validado por **execução ao vivo contra `mrv-devDan`** com
payloads sintéticos que nós mesmos desenhamos.

Nunca havíamos analisado tráfego real. Por pedido explícito do usuário, esta
análise consulta diretamente `LogIntegracao__c` em `mrv-staging`
(`tavares.daniel@parceiro.mrv.com.br.staging`), que registra `BodyRequest__c`,
`Response__c` e `StackTrace__c` de eventos reais processados por essa org —
uma fonte de verdade que o código sozinho não revela (ex.: quais campos o MS
Cliente real realmente envia, com que frequência falhas acontecem, e o
formato exato de respostas de sistemas externos reais).

**Regra seguida nesta análise: somente leitura.** Nenhuma escrita foi feita em
`mrv-staging` — apenas SOQL via REST API.

## Volume de dados real disponível (contexto de escala)

```
pac-insert              1.271.182
pac-update                452.936
contato-update            406.556
cliente-update            211.335
jornadausuario-update     125.477
endereco-update            83.845
endereco-insert             11.717
contato-insert               6.927
EnvioPACCredito               6.405
cliente-insert                4.396
jornadausuario-insert          1.355
paccontestacao-insert            546
contestar-pac-documento          420
```

## Metodologia desta análise

Mais de 60 registros de `LogIntegracao__c` foram lidos integralmente
(`BodyRequest__c`, `Response__c`, `StackTrace__c`) distribuídos em:

- `jornadausuario-insert`: 25 (10 recentes + 5 com sucesso + 10 com erro)
- `pac-insert`: 5 (sucesso)
- `pac-update`: 5 (sucesso)
- `paccontestacao-insert`: 8 + 3 stacktraces de sucesso
- `contestar-pac-documento`: 8
- `EnvioPACCredito`: 16 (8 + 8, com `Endpoint__c` preenchido)
- `cliente-insert`: 3 (sucesso)

## Achados por endpoint

### 1. `/MaquinaEstado` (`jornadausuario-insert`/`jornadausuario-update`) — Tarefa 7.2, recém-iniciada

**Taxa de erro real é alta**: no sample de `jornadausuario-insert`,
**208 sucesso vs. 1.147 erro** (≈85% de falha). A causa raiz do erro,
confirmada via `StackTrace__c` real, é:

```
Cliente(Account) não encontrado no Salesforce. clienteProspect.idClient: null.
clienteProspect.idProspectSalesforce: b805b781-...
```

**Isto é exatamente o mesmo erro que o nosso smoke test capturou na primeira
tentativa** (antes de descobrirmos que aquele caso específico era outro
problema, de `Cidade__c`) — só que aqui é o comportamento **normal e frequente
do sistema real**: eventos `jornadausuario-insert` chegam com `idCliente=null`
e um `idProspectSalesforce` que ainda não tem Account correspondente,
porque o evento `/MaquinaEstado` chega **antes** do `/Cliente` correspondente
ter sido processado (condição de corrida real entre os dois tópicos do Event
Grid, `clientes` e `jornadas`).

**Implicação para a Tarefa 7.2**: este é um cenário real e frequente, não uma
condição de borda teórica — deveria ser modelado como um cenário dedicado
(`jornadausuario-insert` disparado antes do `/Cliente` correspondente,
confirmando o erro 400/`NotificacaoException` esperado e depois testando o
reprocessamento após o `/Cliente` chegar). Isto também generaliza o item já
deferido no Checkpoint 7.1 ("ordem relativa entre `/Cliente` e `/PAC`") — a
mesma classe de problema existe entre `/Cliente` e `/MaquinaEstado`, e os
logs reais prova que é um caso **comum**, não raro.

**Payload real é estruturalmente diferente do que implementamos.** O
`data` real de `jornadausuario-insert` tem o formato (chaves em PascalCase,
minusculizadas pelo Apex antes do processamento — `Conversor.converterMinusculo`):

```json
{
  "Id": "<guid>",
  "Cliente": {
    "idJornada": null,
    "idCliente": null,
    "IdProspectSalesforce": "<guid>",
    "nomeCompleto": "Caroline Oliveira",
    "contatos": [
      {"idCliente": null, "TipoContato": "EMAIL", "descricao": "..."},
      {"idCliente": null, "TipoContato": "CELULAR", "descricao": "..."}
    ],
    "renda": 4500.0,
    "fatorSocial": false,
    "dataNascimento": null,
    "dataNascimentoFormatada": ""
  },
  "IdEmpreendimento": "<guid>",
  "IdUnidade": null,
  "IdCorretor": "<Id Salesforce>",
  "JornadaLead": true,
  "IdImob": null,
  "Ativo": true,
  "Pendencias": false,
  "ContestacaoDocumental": false,
  "TipoJornada": "JornadaFinanciamento",
  "Estado": "Unidades",
  "PacValida": true,
  "DataCriacao": "...",
  "DataAlteracao": "...",
  "Origem": "SALESFORCE",
  "Marca": "MRV",
  "...": "e mais ~30 campos não modelados"
}
```

Divergências concretas do que construímos no incremento 1 (`maquina-estado.ts`):

- **Não existe um campo `id` "solto" apontando para a Opportunity externa no
  nível raiz de `Cliente`** — o `Id` da Opportunity fica no nível raiz de
  `data` (`data.Id`), e `Cliente` é um objeto aninhado com `IdProspectSalesforce`
  (não `idCliente`/`idProspectSalesforce` soltos como assumimos).
- **`Estado` real observado é `"Unidades"`** (com essa capitalização exata),
  não `"UNIDADES"`/`"SIMULACAO"` como usamos no smoke test. Como
  `retornaValorFase` compara com `==` contra strings em CAIXA ALTA
  (`'UNIDADES'`, `'SIMULACAO'`, `'CONTRATO'`, etc.), e o Apex faz
  `Conversor.converterMinusculo` só nas CHAVES (não nos valores), **o valor
  real `"Unidades"` provavelmente NÃO bate com nenhum branch de
  `retornaValorFase`** — isso pode significar que, na prática, `StageName`
  quase nunca é setado por este campo para Opportunities novas, ou que existe
  alguma normalização de valor que não localizamos ainda. **Precisa ser
  investigado antes do próximo incremento da Tarefa 7.2** — não usar
  `'SIMULACAO'`/`'UNIDADES'` (maiúsculas) como valor de teste sem antes
  confirmar contra um log real com `Status2__c=success` E `StageName`
  preenchido de fato.
- **`Cliente.contatos[]`** (array aninhado com `TipoContato`/`descricao`)
  nunca foi modelado — o contrato atual do simulador não tem esse campo.
- Payload real tem ~30 campos adicionais nunca modelados
  (`ContestacaoDocumental`, `PendenciaRepasse`, `PropostaFlex`, `TipoJornada`,
  `PacSimplificada`, `ReaproveitamentoPac`, `FgtsAprovado`, `Marca`, etc.) —
  a maioria provavelmente ignorada pelo Apex quando ausente do payload
  mínimo (comportamento tolerante, já confirmado para `/PAC`), mas vale
  registrar para futura expansão de realismo.

### 2. `/PAC` (`pac-insert`/`pac-update`) — Tarefa 7.1, já concluída

O contrato que implementamos (~19 campos no nível raiz de `data`, mais
`proponentes[]` com ~30 campos) está **funcionalmente correto** — os nomes de
campo batem (Apex faz deserialize case-insensitive), e o Apex ignora
silenciosamente campos desconhecidos.

Porém o payload real é **muito mais rico**:

- Nível raiz da PAC tem ~60 campos reais (vs. ~10 que cobrimos):
  `idOportunidade`, `diasValidade`, `idTipoOcupacaoApurado`,
  `idFatorSocialApurado`, `valorSubsidioLiberado`, `valorHabiteSeguro`,
  `valorSubsidioPcva`, `idResultado`, `numeroAgencia`, `descricaoAgencia`,
  `idCentral`, `dataVigenciaCadSICAQ`, `grupoCorrespondente`,
  `grupoQualidade`, `idProcessoAtual`, `valorLimiteCidade*` (4 variantes),
  `grupoRegional`, `isPagamentoFlex`, `usaFgts`, `idPlanoFinanciamento`,
  `aplicaInteresseSocial`, `marca`, `simplificada`, `aprovadoComPendencia`,
  `pacInteresseSocial[]` (array aninhado), entre outros. Todos com
  `correlationIdCriacao`/`idUsuarioCriacao`/`correlationIdAlteracao`/
  `idUsuarioAlteracao` (campos de auditoria nunca modelados).
- `proponentes[]` real tem ~25 campos adicionais não modelados:
  `estadoCivilCrm`, `tipoOcupacao`, `tipoResidencia`, `ufDocumento`,
  `dataEmissaoDocumento`, `nacionalidade`, `nacionalidadeCrm`, `naturalidade`,
  `ufNaturalidade`, `numeroPis`, `numeroDocumento`, `orgaoEmissorDocumento`,
  `orgaoEmissorDocumentoCrm`, `nomePai`, `nomeMae`, `genero`, `generoCrm`,
  `telefoneResidencial`, `profissaoPrincipal`, `idTipoClassificacao`,
  `dataCriacao`, `nomeReceita`, `isValidoNomeReceita`, `antiFraude`, e um
  objeto **`endereco` aninhado** (`cep`, `logradouro`, `numero`, `bairro`,
  `tipoImovelId`, `ocupacaoImovelId`, `idUf`, `idMunicipio`, etc.) — nunca
  modelado.
- `status` real observado inclui `"ANALISE_NAO_INICIADA"` (já tratado
  explicitamente no Apex) e `"EM_ANALISE_CREDITO"` (já usado em nossos
  cenários).

**Conclusão para `/PAC`**: nenhuma correção obrigatória — o Apex tolera os
campos ausentes. Mas se quisermos cenários mais realistas no futuro
(ex.: um cenário de "PAC completa" espelhando 100% do payload real), esses
campos estão documentados aqui como referência.

### 3. Callback `EnvioPACCredito` (Tarefa 7.0) — **bug real encontrado no simulador**

O payload real capturado em `mrv-staging` (`Sentido__c='Entrada'`,
`Endpoint__c` apontando para
`mrvqualidadecredito-servicebus-qas.servicebus.windows.net`, ambiente QAS,
distinto do `-prd` encontrado por engano em `mrv-devDan` na Tarefa 7.0):

```json
{
  "IdSalesforcePac": "a0kHZ00000BLyAvYAL",
  "IdPac": "ac56eae1-785b-4533-a90f-0d040eb4d666",
  "IdJornada": "637dbb60-c2df-424b-be05-80fa2e65afc8",
  "DataCriacao": "2026-09-22T18:23:22.000Z",
  "CodigoPAC": "PAC-751122"
}
```

**Há um campo `CodigoPAC` que o nosso schema `pacCreditoRequestSchema`
(`src/contracts/pac-credito.ts`) NÃO conhece.** Ao investigar
`EnvioPACCreditoQueue.cls` no repositório `com_salesforce_mrv` (que reflete
`mrv-devDan`), a classe wrapper interna só tem 4 campos
(`IdSalesforcePac`, `IdPac`, `IdJornada`, `DataCriacao`) — **sem
`CodigoPAC`**. Ou seja: `mrv-staging` está rodando uma versão da classe
diferente da que está em `mrv-devDan`/no repositório compartilhado (drift de
ambiente, já visto outras vezes nesta sessão com metadados de campo).

**O problema real**: `pacCreditoRequestSchema` usa `.strict()` (confirmado em
`src/contracts/pac-credito.ts:30`), o que significa que, se `mrv-devDan`
alguma vez rodar uma versão da classe com `CodigoPAC` (ou qualquer campo
novo), **nosso endpoint vai rejeitar a requisição com 422**, mesmo sendo um
payload real e válido do ponto de vista do Apex. Isso é uma lacuna de
robustez genuína — corrigida na sequência desta análise (ver "Ações
tomadas").

Resposta real (`StackTrace__c` de `paccontestacao-insert`, útil por analogia
de padrão): a API real de crédito devolve o objeto completo de volta
(`dataCriacao`, `correlationIdCriacao`, `idUsuarioCriacao`, `id`, etc.), mas o
Apex só lê o campo `id` — nosso endpoint simplificado (`{"id": "<uuid>"}`)
está funcionalmente correto, só "mais magro" que a resposta real.

### 4. `paccontestacao-insert`/`contestar-pac-documento` (contestação, Tarefa 7.1b variação 5)

- `paccontestacao-insert`: **545 sucesso vs. 1 erro** — extremamente
  confiável em produção real (diferente de `jornadausuario-insert`).
- `contestar-pac-documento`: **395 sucesso vs. 25 erro**.
- Confirmado via `StackTrace__c`: o payload realmente enviado é
  `{dataCriacao, correlationIdCriacao, idUsuarioCriacao, dataAlteracao,
  correlationIdAlteracao, idUsuarioAlteracao, id, idPac, idMotivo,
  descricaoMotivo, descricao, dataSolucao, usuarioSolucao}` — mais rico que
  o `ContestacaoEventGridModel` (`idPac`, `idMotivo`, `descricao`,
  `usuarioSolucao`) que implementamos, mas o Apex só serializa o que está no
  wrapper interno, então nosso contrato de RECEBIMENTO (o que aceitamos no
  endpoint do simulador) está correto — a divergência é só na riqueza dos
  metadados que a API real devolveria de volta, que o Apex ignora de qualquer
  forma.

### 5. `/Cliente` (`cliente-insert`) — já maduro, MVP original

Contrato real confirma alinhamento com o que já implementamos
(`IdCliente`, `NomeCompleto`, `NumeroCPF`, `IdProspectSalesforce`,
`DataCriacao`, `DataAlteracao`). Campos adicionais reais não modelados:
`Nacionalidade`, `SistemaOrigem`, `TipoPessoa`, `OrigemAlteracao`,
`UsuarioCriacao`, `UsuarioAlteracao`, `IdUsuarioCriacao`, `Deletado` — todos
tolerados pelo Apex quando ausentes.

## Ações tomadas nesta análise

- [ ] **Corrigir `pacCreditoRequestSchema`** para tolerar campos extras
  desconhecidos (`.passthrough()` em vez de `.strict()`), prevenindo rejeição
  de payloads reais que evoluam com novos campos (ex.: `CodigoPAC`) sem
  quebrar a validação estrutural dos campos que já usamos. (Pendente,
  próximo passo desta sessão.)

## Recomendações para os próximos endpoints simulados (pré-requisito confirmado pelo usuário)

A partir de agora, **antes de desenhar qualquer novo contrato ou cenário**,
este processo deve incluir uma consulta a `LogIntegracao__c` em
`mrv-staging` (leitura, nunca escrita) para o(s) `EventType__c` relevante(s),
com pelo menos ~10-20 amostras reais, para:

1. Confirmar a forma exata do payload real (nomes de campo, aninhamento,
   valores reais de enums/status).
2. Entender a taxa de sucesso/erro real e as mensagens de erro mais comuns
   (revela cenários de regressão que a leitura do código sozinha não sugere).
3. Verificar se a versão do Apex em `mrv-staging` diverge da versão em
   `mrv-devDan`/no repositório (drift de ambiente já confirmado nesta análise
   para `EnvioPACCreditoQueue`).

Isso deve ser feito **antes** de qualquer implementação — leitura de Apex
sozinha, mesmo cuidadosa, já demonstrou nesta sessão (Tarefa 7.1/7.2)
divergir do comportamento real observado múltiplas vezes.
