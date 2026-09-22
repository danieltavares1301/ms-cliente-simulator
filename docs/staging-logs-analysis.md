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
  não `"UNIDADES"`/`"SIMULACAO"` como usamos no smoke test.
  **CORREÇÃO (investigação de acompanhamento, ver seção abaixo):** isso
  **NÃO é uma divergência real** — foi verificado empiricamente que
  `retornaValorFase` funciona corretamente com `"Unidades"`, graças a uma
  peculiaridade conhecida do Apex: o operador `==` em `String` é
  **case-insensitive** (diferente de `.equals()`), então
  `"Unidades" == 'UNIDADES'` avalia `true`. Confirmado consultando
  Opportunities reais em `mrv-staging` resultantes de payloads
  `Estado="Unidades"` — todas com `StageName='Escolher Unidade'`, exatamente
  o valor de retorno esperado para esse branch. **`'SIMULACAO'`/`'UNIDADES'`
  continuam válidos como valores de teste no smoke test da Tarefa 7.2.**
- **`Cliente.contatos[]`** (array aninhado com `TipoContato`/`descricao`)
  nunca foi modelado — o contrato atual do simulador não tem esse campo.
- Payload real tem ~30 campos adicionais nunca modelados
  (`ContestacaoDocumental`, `PendenciaRepasse`, `PropostaFlex`, `TipoJornada`,
  `PacSimplificada`, `ReaproveitamentoPac`, `FgtsAprovado`, `Marca`, etc.) —
  a maioria provavelmente ignorada pelo Apex quando ausente do payload
  mínimo (comportamento tolerante, já confirmado para `/PAC`), mas vale
  registrar para futura expansão de realismo.

### 1.1. Investigação de acompanhamento: `Estado="Unidades"` (resolvida, não é bug)

Ao revisar esta análise, a hipótese original ("`Estado` real diverge do que
usamos, pode quebrar `retornaValorFase`") foi **investigada empiricamente e
refutada**:

1. Localizada, via `Cliente.IdProspectSalesforce` de um log real com
   `Status2__c=success`, a `Account` real correspondente em `mrv-staging`
   (`Id=001HZ00000vxoUpYAI`).
2. Consultadas todas as `Opportunity` reais vinculadas a essa Account
   (RecordType `Unidade`): a esmagadora maioria tem
   `StageName='Escolher Unidade'` — exatamente o retorno esperado do branch
   `valorJson == 'UNIDADES'` em `retornaValorFase`.
3. Confirmado, baixando a versão REAL deployada de
   `NotificacaoMaquinaEstado.cls` em `mrv-staging` via Tooling API, que o
   código é idêntico ao lido em `mrv-devDan`/repositório (`valorJson ==
   'UNIDADES'`, sem `.toUpperCase()`/`equalsIgnoreCase()` em lugar nenhum).
4. **Causa raiz real**: o operador `==` para `String` em Apex é
   **case-insensitive por padrão** (comportamento documentado da plataforma,
   distinto de `String.equals()`, que É case-sensitive). Por isso
   `"Unidades" == 'UNIDADES'` é `true`, e o mapeamento funciona
   corretamente independente da capitalização exata enviada no payload.

**Conclusão**: nenhuma correção é necessária no cenário `maquina-estado-insert-minimo`
nem nos próximos incrementos da Tarefa 7.2 por causa deste ponto. O valor
`'SIMULACAO'` usado no smoke test continua correto e válido.

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

### 6. `jornadausuario-update` (`/MaquinaEstado`, update) — análise de acompanhamento

Amostra adicional de 60 registros reais de `LogIntegracao__c`
(`EventType__c='jornadausuario-update'`) para informar o incremento 3 da
Tarefa 7.2:

```
success   48.777
error     76.730   (≈61% de taxa de erro real, ainda maior que insert)
```

Categorização real dos erros (amostra de 60):

- **26/60 (≈43%)**: `System.QueryException: Registro atualmente indisponível:
  O registro que você está tentando editar, ou um de seus registros
  relacionados, está sendo modificado por outro usuário. Tente novamente.`
  — contenção real de lock de linha (`UNABLE_TO_LOCK_ROW`), tipicamente
  disparada por múltiplos eventos concorrentes tentando atualizar a MESMA
  Opportunity ao mesmo tempo (jornada do usuário avançando rapidamente por
  múltiplos estados).
- **30/60 (50%)**: logs com `StackTrace__c` mínimo (`error` / `### EventType
  não Informado -> Alterado para jornadausuario-update`), sem
  `BodyRequest__c`/`Response__c` capturado — aparentam ser um registro de log
  secundário/parcial para a mesma falha de lock (possivelmente um log
  duplicado emitido antes do corpo da requisição ser totalmente processado).
- **4/60 (≈7%)**: `Cliente(Account) não encontrado` — mesma causa já coberta
  pelo incremento 2 (`/Cliente` chegando depois do `/MaquinaEstado`), agora
  confirmada também para `update`, não só `insert`.

**Achado arquitetural real (CORRIGIDO — ver retificação abaixo):** ~~`NotificacaoMaquinaEstado.cls` não tem nenhuma lógica de retry para
`UNABLE_TO_LOCK_ROW`~~. **Esta afirmação estava ERRADA e foi corrigida após
verificação direta da versão realmente deployada em `mrv-staging`** (não
apenas do repositório) — ver seção 6.1 abaixo para o achado correto: a
versão real de `mrv-staging` **tem** um mecanismo de retry (5 tentativas), e
os erros observados são casos onde ele se esgota mesmo assim.

**Valores reais de `Estado` em updates de sucesso**: `"Documentacao"`,
`"MG"` (aparenta ser um valor de UF vazado no campo errado, ou um estado
customizado específico de algum fluxo não mapeado — não investigado a
fundo). Confirma, mais uma vez, que o operador `==` case-insensitive do Apex
absorve variações de capitalização sem problema.

**Decisão de escopo**: reproduzir deterministicamente a contenção de lock
real (43% dos erros) exigiria dispatch verdadeiramente concorrente para a
MESMA Opportunity — a mesma classe de infraestrutura construída para o O10
(Fase 6), que é incompatível com o guard `OUT_OF_ORDER` do orquestrador
sequencial (documentado desde a Fase 6: dispatch concorrente só é possível
via script standalone, fora do motor de cenários do catálogo). Por ora, este
achado fica **documentado, mas deferido** — o incremento 3 desta sessão
cobre o caminho mais simples e imediatamente acionável (`jornadausuario-update`
happy path + reteste de `Cliente(Account) não encontrado` para `update`).

### 6.1. Retificação: `NotificacaoMaquinaEstado.cls` TEM retry real (drift de versão confirmado)

**Esta seção corrige um erro da análise original acima**, apontado
corretamente pelo usuário durante a revisão. A afirmação inicial ("sem
nenhuma lógica de retry") foi baseada apenas na leitura do repositório
`com_salesforce_mrv`/`mrv-devDan` — **sem verificar a versão realmente
deployada em `mrv-staging`**, a mesma org de onde os logs foram extraídos.

**Verificação direta feita (Tooling API, `ApexClass.Body`, ambas as orgs):**

- `mrv-staging`: `NotificacaoMaquinaEstado.cls`, `LastModifiedDate =
  2026-09-22T18:42:47Z`, **contém** um bloco de retry real:
  ```apex
  private static final Integer MAX_TENTATIVAS_RETRY = 5;
  // ...
  // Retry para tratar race condition de DUPLICATE_VALUE e UNABLE_TO_LOCK_ROW
  Integer tentativa = 0;
  while (!sucesso && tentativa < MAX_TENTATIVAS_RETRY) {
      tentativa++;
      try {
          if (tentativa > 1 && !retornaValidacaoEventTime(sObjOportunidade)) {
              sucesso = true; // evento obsoleto detectado no retry, aborta
              break;
          }
          Database.upsert(sObjOportunidade, Opportunity.ID__c, true);
          sucesso = true;
      } catch (DmlException dmlEx) {
          // só retenta para DUPLICATE_VALUE / UNABLE_TO_LOCK_ROW;
          // qualquer outro tipo de DmlException é relançado imediatamente
      }
  }
  if (!sucesso && ultimaExcecao != null) { throw ultimaExcecao; }
  ```
- `mrv-devDan` (e o repositório `com_salesforce_mrv` que o reflete):
  `LastModifiedDate = 2026-09-04T03:17:28Z` — **não contém** esse bloco
  (confirmado: `MAX_TENTATIVAS_RETRY` e o comentário "Retry para tratar race
  condition" não existem no arquivo).

**Conclusão corrigida**: `mrv-staging` está rodando uma versão **mais nova**
de `NotificacaoMaquinaEstado.cls` (18 dias à frente) que já implementa o
retry, mas essa versão **ainda não chegou** em `mrv-devDan`/no repositório
compartilhado. Isso é o **terceiro caso confirmado nesta sessão** de drift
real de versão entre ambientes (os outros dois: `CodigoPAC` ausente em
`EnvioPACCreditoQueue.cls`, seção 3; e o próprio padrão já visto nos
metadados de `Contestacao__c`/Permission Set na Fase 7 anterior).

Isso também explica melhor os 43% de erros reais observados: **não é
ausência de retry** — é contenção **sustentada o suficiente para esgotar 5
tentativas**, um cenário de concorrência mais severo do que uma colisão
simples de dois eventos. A decisão de escopo (deferir a reprodução
determinística, pois exigiria dispatch concorrente incompatível com o
orquestrador sequencial) continua válida, mas a motivação/achado documentado
mudou: o item a explorar no futuro não é "adicionar retry" (já existe, na
versão mais nova), é "simular contenção severa o suficiente para esgotar 5
tentativas reais" — um cenário ainda mais difícil de reproduzir
deterministicamente.

**Nenhum incremento já implementado nesta sessão (1, 2 e 3 da Tarefa 7.2)
depende dessa correção** — nenhum deles testa/afirma nada sobre a presença
ou ausência de retry.

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
