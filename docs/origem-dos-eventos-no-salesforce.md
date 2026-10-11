# Origem dos eventos que o Salesforce recebe na Unificação 2.2

Análise de 2026-10-11. Responde a três perguntas:

1. Quais eventos a Plataforma BFF (`com_plataforma_bff`) lança no Salesforce,
   e quem publica os demais eventos que o simulador reproduz.
2. O que o MS Clientes real (repositório `cliente`) publica, como publica e
   quem dispara cada evento.
3. Se a separação entre esses projetos explica as diferenças de ordem dos
   eventos no Salesforce.

## 1. Resumo

O simulador manda todos os eventos como se viessem do MS Clientes, mas só os
seis do `/Cliente` são dele. Os eventos chegam de três publicadores, cada um
com seu tópico no mesmo Event Grid Domain:

| Eventos | Endpoint Apex | Tópico / subject real | Publicador |
|---|---|---|---|
| `cliente-*`, `contato-*`, `endereco-*` | `/Cliente` | `clientes` / `cliente` | MS Clientes |
| `pac-insert`, `pac-update` | `/PAC` | `pacs` / `proponentecredito/PacEventGridDTO` | MS de crédito (proponente-credito) |
| `notificacaopendencia-insert` | `/Pendencia` | `pacs` / `proponentecredito/NotificacaoPendenciasProponenteDTO` | MS de crédito |
| `jornadausuario-insert`, `jornadausuario-update` | `/MaquinaEstado` | `jornadas` / `jornadas` | Plataforma BFF |

A Plataforma BFF publica só os dois `jornadausuario-*`. Ela também escreve
direto no Salesforce por `POST /services/apexrest/Lead`.

A separação dos projetos explica **parte** das diferenças de ordem, a que
acontece entre origens. Ela não explica a inversão que o simulador mais testa,
contato ou endereço antes do cliente: esses eventos vêm todos do MS Clientes. A
seção 6 detalha as duas causas e um efeito que só aparece entre origens: os
relógios diferentes.

O código do MS Clientes confirma a primeira causa. Ele publica cada evento sem
esperar o envio, tenta de novo por até cerca de 1 min quando o envio falha, e
cada contato e cada endereço chega por uma chamada separada (seções 3.4 e
6.1).

## 2. Como foi verificado

- **Código da Plataforma BFF:** branch `feature/deslegado/cliente-exterior`,
  conferida contra o `origin/master`. Os pontos de publicação são os mesmos
  nos dois.
- **Código do MS Clientes:** repositório `cliente`, branch `master`, commit
  `aa0a4e9f` (2026-10-09).
- **Envelope real em `mrv-staging`:** consultas somente leitura em
  `LogIntegracao__c.BodyRequest__c`. As consultas imprimiram só tópico,
  subject, forma do envelope, formato de data e contagens. Nenhum dado de
  negócio saiu da org nem entrou neste documento.
- **Apex:**
  - o checkout local do `com_salesforce_mrv`;
  - o branch `origin/GV_918914_UnificPosAprovPAC`, lido sem checkout;
  - o corpo das classes implantadas em `mrv-staging` e `mrv-devDan`, lido pela
    Tooling API, somente leitura.

As amostras de staging são as mais recentes de cada tipo, limitadas a algumas
centenas de logs. Servem para atribuir a origem e o formato, não para medir
volume.

As consultas estão em `scripts/analise-staging/`. Todas rodam direto no
`node`, sem `npm install`, desde que a Salesforce CLI esteja autenticada como
`mrv-staging`:

| Script | O que mede | Seções |
|---|---|---|
| `origem-eventos.ts` | tópico, subject, versões, chaves do envelope e formato das datas, por tipo de evento | 1 e 4 |
| `payload-ms-clientes.ts` | chaves do `data` do MS Clientes, telefone, DDI e tipo de endereço | 4 |
| `chamadores-ms-clientes.ts` | quem disparou cada evento do MS Clientes (`UsuarioAlteracao`, `OrigemAlteracao`) | 3.5 |
| `estado-jornada.ts` | `Estado` da raiz em `jornadausuario-*` contra o primeiro `"Estado"` do texto | 5 |
| `reentregas.ts` | eventos entregues mais de uma vez: intervalo, erro da 1ª entrega e formas de envelope | 6.1 e 6.3 |
| `classes-implantadas.ts` | se o código implantado compara a data da PAC com os marcadores de contato (`--org mrv-staging` ou `--org mrv-devDan`) | 6.4 |

Exemplo: `node scripts/analise-staging/estado-jornada.ts --dias 45`.

Os scripts só aceitam SELECT, só falam com `mrv-staging` ou `mrv-devDan` e
mascaram qualquer valor com cara de dado pessoal. As janelas são relativas ao
dia em que rodam, então os números mudam de uma execução para outra. As
contagens deste documento são de 2026-10-11.

## 3. O que a Plataforma BFF e o MS Clientes enviam ao Salesforce

Nesta seção, os caminhos `src/...` não são do simulador. Em 3.1 a 3.3, são do
repositório `com_plataforma_bff`; em 3.4 e 3.5, do repositório `cliente`.

### 3.1 `jornadausuario-insert` e `jornadausuario-update`

Os dois saem de `EventGridAgent.Publicar`
(`src/Plataforma.DataAccess/EventGrid.cs`), que faz POST no tópico do Event
Grid com `aeg-sas-key`.

- **Insert** (`src/Plataforma.DataAccess/JornadaAgent.cs:52`):
  - sai na criação da jornada (`POST api/v1.1/clientes` → `ClientesCriarHandler`);
  - vai sempre com `Estado = Unidades`. Em staging, os 54 inserts recentes com
    corpo trouxeram `Unidades`;
  - não sai na jornada genérica (`postarEG = !JornadaGenerica`).
- **Update** (`JornadaAgent.cs:157`, em `AtualizarComRetry`):
  - sai em quase toda gravação da jornada, a partir de 75 pontos de chamada;
  - parte desses pontos passa `postarEG = false`. Muitos condicionam a
    publicação a `TipoJornada != JornadaGenerica`, e alguns a
    `!ReaproveitamentoPac`;
  - na jornada genérica, que pelo nome corresponde à Venda Genérica do
    runbook, só alguns updates saem, como o de `PropostaGenericaFinalizada`.
- **Payload:** o `data` é a Jornada inteira, serializada pelo Newtonsoft em
  PascalCase. Vão cliente (nome, contatos, renda, nascimento), simulação, PAC,
  proponentes, proposta etc. O formato bate com o que o
  [§1 da análise de staging](staging-logs-analysis.md) registrou.
- **No Salesforce:** `NotificacaoMaquinaEstado` faz upsert da Opportunity por
  `Id__c` (o id da jornada). Os campos vêm de `MapaOportunidade__mdt`, com 44
  registros no repositório. Alguns exemplos: `estado` vira `StageName`,
  `IdCorretor` vira o dono, `IdEmpreendimento` vira o empreendimento,
  `IdUnidade` vira a unidade, `Origem` vira `LeadSource`, a simulação vira
  valores financeiros e os contatos viram `EmailCliente__c`. O endpoint também
  responde ao `Microsoft.EventGrid.SubscriptionValidationEvent`, ou seja,
  recebe entrega direta do Event Grid.

### 3.2 Chamadas diretas ao Apex REST

- **`POST /services/apexrest/Lead`** (`SalesForceAgent.CriarLead` →
  `NotificacaoLead`): cria ou atualiza Lead e pode criar Account, passando por
  `ClienteService.getClienteUnificacaoLead`. Acontece em quatro fluxos:
  - criar cliente sem IdCliente e sem IdProspect (`ClientesCriarHandler`);
  - alterar proponente (`AlterarProponenteHandler`);
  - adicionar proponente na PAC (`AdicionarNovoProponentePacHandler`);
  - adicionar cônjuge (`AdicionarConjugeHandler`).
- **Somente leitura:** busca SOSL de Lead e Account (`BuscarLead`),
  `GET /services/apexrest/ConsultarUsuario` (perfil do corretor) e
  `GET /services/oauth2/userinfo` (login).
- **Sem uso:** `EventGridAgent.PublicarWebhookDireto` faz POST direto no
  Salesforce, sem Event Grid, mas nada o chama, nem no `master`.

### 3.3 O que a BFF aciona, mas não publica

A BFF chama o MS de crédito em `.../pacs/analisar-credito`, na contestação e
em `notificacao-pendencias`. Quem publica os `pac-*` e os
`notificacaopendencia-*` resultantes é o MS de crédito, no tópico `pacs`. A
BFF só consome o status da PAC, pela fila `eg-status-pac`.

### 3.4 O que o MS Clientes publica

O MS Clientes é uma API .NET 8 com GraphQL (HotChocolate; a V2 é a atual),
MediatR e EF Core.

- **Destino:** `src/Cliente.DataAccess/Agents/EventGridAgent.cs` publica no
  tópico `clientes` do Event Grid Domain, com subject `cliente` e
  `dataVersion` `1.0`, um evento por envio.
- **Um evento por mutation:** cada mutation grava no banco e publica um evento
  logo em seguida. Os tipos estão em `Constantes.EventGridTypes`: os seis do
  `/Cliente` (`cliente-*`, `contato-*`, `endereco-*`) e mais `descendente-*`,
  `relacionamento-*` e `produto-cidade-*`, que o `/Cliente` não trata.
- **Payload:** o DTO da entidade, em PascalCase, com os campos de auditoria
  (`DataCriacao`, `DataAlteracao`, `UsuarioCriacao`, `UsuarioAlteracao`,
  `IdUsuarioCriacao`, `Deletado`) e `OrigemAlteracao`. Campos nulos são
  omitidos. A seção 4 compara com o simulador.
- **Prospect em contato e endereço:** os handlers V2 publicam o
  `IdProspectSalesforce` que o cliente tem no MS Clientes no momento da
  publicação (`BuscarIdProspectSalesforceDoCliente`). Ver a seção 6.5.
- **Telefone:** desde o ADR-001 do MS Clientes, o DDI vai separado em
  `Complemento`, e `Descricao` leva só o número nacional.
- **Publicação sem espera:** a API registra o agente com `AddAgents(true)`
  (`src/Cliente.API/Startup.cs:92`). A seção 6.1 mostra o efeito na ordem.
- **Repostagem em lote:** `enviarClienteEventGrid` (GraphQL) e
  `GET event-grid` (REST) filtram por ids, intervalo de `DataAlteracao` ou
  `UsuarioAlteracao`.
  - O GraphQL manda, para cada cliente, o `cliente-update`, um
    `contato-update` por contato e um `endereco-update` por endereço, com a
    `DataAlteracao` que está gravada.
  - O REST manda só o `cliente-update`.
- **Build Debug não publica:** `Publicar` só envia em build Release
  (`#if !DEBUG`). Rodar o MS Clientes localmente em Debug não gera eventos.
- **A Plataforma BFF não chama o MS Clientes** no código atual; só existe uma
  `MSClientesException` sem uso. O README do MS Clientes ainda diz que a
  Plataforma é o principal consumidor.

### 3.5 Quem dispara os eventos do MS Clientes

Cada evento traz em `data.UsuarioAlteracao` quem chamou a API: o header
`idUsuario`, quando o chamador manda, ou o `client_id` do token
(`ScopeContext.ObterIdUsuario`). Distribuição em staging, em eventos distintos
dos últimos 30 dias, com até 600 logs por tipo:

| Evento (distintos) | `client_id` "Credito" | Chamadores identificados por GUID | Outros |
|---|---:|---:|---|
| `cliente-insert` (250) | 41% | 59% | — |
| `cliente-update` (597) | 31% | 68% (5 GUIDs) | `JobEqualizacaoCrm` |
| `contato-insert` (524) | 39% | 61% | — |
| `contato-update` (590) | 36% | 53% | e-mails de pessoas (8%), `script_refresh_qas` |
| `endereco-insert` (361) | 59% | 41% | — |
| `endereco-update` (587) | 62% | 38% | — |

- **MS de crédito, no pós-PAC:** chama `criarAtualizarCliente` e depois,
  conforme o contato e o endereço já existam ou não, `criarContato` ou
  `atualizarContato` e `criarEndereco` ou `atualizarEndereco`. São chamadas
  separadas, como mostra o diagrama de Crédito no README do MS Clientes.
- **Salesforce:** no branch da unificação, quatro classes usam
  `callout:VFlexMsClientes`. Duas delas geram eventos:
  - `MSClienteService.atualizarCliente`, o callback do IdProspect, gera o
    `cliente-update` de retorno. Esse evento é eco da própria escrita do
    Salesforce;
  - `VG_MSClienteCriarAtualizarInvocable` (Venda Genérica) chama
    `criarAtualizarCliente`.

  Em `cliente-insert`, um único GUID responde por 147 eventos, 145 deles com
  `SistemaOrigem = Salesforce`. Provavelmente é o fluxo de Venda Genérica, mas
  o payload não traz o nome do sistema.
- **CRM:** a sincronização marca `OrigemAlteracao = 2` (`IntegracaoCrm`), em
  18% dos `contato-update` e 15% dos `endereco-update`. O `/Cliente` não lê
  `OrigemAlteracao` nem `UsuarioAlteracao`.

## 4. Formato real por origem e o que o simulador manda

| | MS Clientes (`clientes`) | MS de crédito (`pacs`) | Plataforma BFF (`jornadas`) | Simulador hoje |
|---|---|---|---|---|
| Chaves do envelope | camelCase | camelCase | PascalCase (`Id`, `EventType`, `Data`…) | camelCase |
| `metadataVersion` | ausente | ausente, exceto parte das pendências (seção 6.3) | `"1"` | presente |
| `dataVersion` | `1.0` | `1.0` | vazio | presente |
| `eventTime` | UTC com `Z`, 7 casas | UTC com `Z`, 7 casas | UTC com `+00:00`, 7 casas | UTC com `Z`, sem fração ou `.000` |
| `dataAlteracao` | UTC com `Z`, 2 a 7 casas | horário local **sem fuso** | horário de Brasília **sem fuso** | UTC com `Z` |
| Eventos por request | 1 | 1 | 1 | 1 |

No `jornadausuario-*` real, `EventTime` menos `DataAlteracao` lida como UTC dá
exatamente 3h em todos os 20 casos medidos.

O `data` dos eventos do MS Clientes também difere do que o simulador manda.
Contagens de eventos distintos de staging, últimos 30 dias:

| | MS Clientes real | Simulador hoje |
|---|---|---|
| Chaves do `data` | PascalCase (`IdCliente`, `NomeCompleto`…). O Apex converte para minúsculas | minúsculas |
| Campos nulos | omitidos; `IdProspectSalesforce` falta em 77 de 201 `cliente-insert` | — |
| Auditoria | `DataCriacao`, `UsuarioCriacao`, `UsuarioAlteracao`, `IdUsuarioCriacao`, `Deletado`, `OrigemAlteracao` | ausentes |
| Data de nascimento | `yyyy-MM-ddTHH:mm:ssZ` | só `yyyy-MM-dd` |
| Campos do contato | `IdContato`, `ContatoPrincipal`, `LiberadoMarketing`, `Complemento` | manda `numerocpf`, que o real não tem; sem `complemento` |
| Telefone | `Descricao` com o número nacional (11 dígitos em 94 de 151, 10 em 27, 8 em 25, 9 em 5) e DDI em `Complemento` (2 dígitos em 106, 3 em 28, 1 em 17) | `descricao` com 11 dígitos |
| Tipo de endereço | `Cobranca` (212) e `Principal` (85) | só `COBRANCA` |

## 5. Correção do §9 da análise de staging (`Estado` = sigla de UF)

O [§9 da análise de staging](staging-logs-analysis.md) e o
[doc do cenário](phase-7/maquina-estado-estado-nao-reconhecido.md)
`maquina-estado-update-estado-nao-reconhecido` dizem que cerca de 55% dos
`jornadausuario-update` reais chegam com `Estado` = UF (`SP`, `MG`, `MT`).
Isso não se confirma.

- **Amostra:** 1.250 `jornadausuario-update` distintos de 40 dias, até 40 logs
  por dia, sem as 138 reentregas.
- **`Estado` da raiz do `data`:** `Documentacao` 777, `Proposta` 400,
  `Unidades` 24, `Contrato` 18, `PropostaGenericaFinalizada` 16,
  `TrocarUnidade` 15. **Nenhuma UF.**
- **De onde vem a UF:** de `data.PropostaDetalhes.UnidadeInfos.Endereco.Estado`
  (e do mesmo caminho em `PropostaDetalhesCache`). Na serialização, esse nó vem
  antes do `Estado` da raiz, então uma busca pelo primeiro `"Estado"` do texto
  acha UF em 493 de 1.388 logs.
- **O que o Apex lê:** só a raiz. `NotificacaoHelper` usa
  `JSON.deserializeUntyped`, e `Conversor.converterMinusculo` só converte o
  primeiro nível.
- **Do lado da BFF:** `Estado` é um enum serializado pelo nome, então nunca
  seria UF.

O caminho Apex de `Estado` não reconhecido existe e o cenário continua válido
como teste desse ramo. O que cai é a premissa de que esse é o padrão real mais
comum.

A medição se refaz com `node scripts/analise-staging/estado-jornada.ts`. Uma
segunda execução no mesmo dia, com a janela deslocada, contou 1.211 eventos
distintos e também nenhuma UF na raiz.

## 6. Por que a ordem dos eventos varia no Salesforce

### 6.1 Dentro de um mesmo publicador: a separação não explica

A inversão que o runbook cobre com os perfis PA, CA e ME (contato ou endereço
antes de `cliente-*`) envolve só eventos do MS Clientes, no mesmo tópico.
Entre o MS Clientes e o dado gravado, a ordem pode se perder em três trechos:

```
MS Clientes ──(1) publicar──► Event Grid ──(2) entregar──► Salesforce ──(3) processar──► dado gravado
```

**(1) Publicar.** O código do MS Clientes não preserva a ordem:

- **Publicação sem espera:** com `AddAgents(true)`
  (`src/Cliente.API/Startup.cs:92`), `EventGridAgent.Publicar` dispara o envio
  sem `await`. A mutation responde antes de o evento sair, e a chamada seguinte
  do MS de crédito já pode publicar o próximo evento.
- **Retentativa local:** se o envio ao Event Grid falha, o agente tenta de novo
  5 vezes, esperando 2, 4, 8, 16 e 32 s. O evento sai até cerca de 1 min
  depois dos seguintes. Se as 5 tentativas falharem, ele se perde sem erro
  para quem chamou, porque a mutation já respondeu.
- **Uma chamada por parcial:** cada contato e cada endereço chega ao MS
  Clientes numa mutation própria e vira um evento independente desde a origem.

**(2) Entregar.** O Event Grid entrega cada evento numa chamada HTTP própria,
nunca em lote (confirmado em staging para todos os tipos). As entregas rodam em
paralelo, sem fila por cliente, e cada uma leva um tempo diferente, conforme a
rede e a carga do Salesforce. Quando uma entrega falha, o Event Grid tenta de
novo mais tarde, sem segurar os eventos seguintes. A documentação do Event Grid
avisa que a ordem de entrega não é garantida. O `CLAUDE.md` da Plataforma BFF
registra a mesma lição: para ter ordem por jornada, quem produz os eventos
precisa ser código próprio.

**(3) Processar.** Cada request vira uma transação própria no Salesforce, e
várias rodam em paralelo. No incidente do bug 4, o MS Clientes emitiu cliente,
celular, e-mail e endereços nessa ordem, mas todos foram gravados no mesmo
segundo ([passagem de contexto](handoff-investigacao-tc001-bug4.md), seção 4).
Quando o processamento dá erro, o Event Grid entrega o evento de novo segundos
depois, já atrás dos mais novos. Amostra dos últimos 7 dias em staging
(`reentregas.ts`):

| Evento | Distintos | Repetidos | Erro na 1ª entrega | Intervalo até a 2ª | Resultado final |
|---|---:|---:|---|---|---|
| `cliente-insert` | 106 | 55 | `DUPLICATE_VALUE` em todos | 1 a 60 s | sucesso em todos |
| `contato-insert` | 212 | 0 | — | — | — |
| `pac-update` | 270 | 29 | `UNABLE_TO_LOCK_ROW` em 23 | 10 a 60 s na maioria | sucesso em todos |

O `DUPLICATE_VALUE` na primeira tentativa indica corrida com outro evento do
mesmo cliente processado em paralelo. O par exato não foi identificado, mas
quem perde a corrida é sempre o `cliente-insert`: nenhum `contato-insert` da
mesma amostra precisou de reentrega. Na prática, metade dos `cliente-insert`
só é aplicada depois dos eventos que chegaram junto com ele. É a ordem
"parciais antes" produzida dentro de um único publicador.

Esperar a confirmação de cada evento no MS Clientes resolveria só o trecho 1:
a entrega e o processamento continuariam podendo trocar a ordem.

### 6.2 Entre publicadores: a separação explica

MS Clientes, MS de crédito e Plataforma BFF publicam em tópicos diferentes,
disparados por etapas diferentes do negócio, sem nenhum sequenciador comum.
Os eventos de uma origem também citam identidades criadas por outra: a PAC
traz o IdCliente que o MS Clientes cria, e a jornada traz o cliente e o
prospect. Nada garante, por exemplo, que o `cliente-insert` de Y chegue antes
da primeira PAC que fala de Y.

O bug 4 mostra esse efeito. Os horários de recebimento em staging foram:

1. `pac-update` em análise (MS de crédito), às 17:50 e às 17:52;
2. `cliente-insert` e parciais de Y (MS Clientes), às 17:52:43;
3. `notificacaopendencia-insert` (MS de crédito), também às 17:52:43;
4. `cliente-update` (MS Clientes), às 17:52:47;
5. PAC aprovada (MS de crédito), às 17:52:48.

As PACs em análise chegaram antes de o MS Clientes criar Y e vieram sem
IdCliente, então o Salesforce ligou o Proponente a X pelo prospect. Esse é o
efeito entre origens. A pendência e a PAC aprovada, porém, são do mesmo
publicador e chegaram na ordem em que foram emitidas. A pendência veio antes
da aprovação, que religaria o Proponente a Y, e projetou o e-mail de Y em X
nessa janela.

### 6.3 A pendência chega por duas rotas

Nos últimos 7 dias (`reentregas.ts`):

- todos os 43 `notificacaopendencia-insert` distintos chegaram duas vezes ou
  mais;
- 42 deles chegaram nas duas formas de envelope: com `metadataVersion`, que é
  o formato de entrega do Event Grid, e sem;
- nenhum teve erro na primeira entrega, e 33 chegaram pela segunda vez em até
  1 s. Ou seja, a repetição não é reentrega por falha;
- a mediana entre a primeira e a última entrega foi de 11 s, mas alguns
  eventos continuaram chegando por horas.

Isso indica duas assinaturas ou rotas para o mesmo evento, mas a rota exata não
foi confirmada. A [passagem de contexto do bug 4](handoff-investigacao-tc001-bug4.md)
já tinha visto reentregas da mesma pendência, uma delas pelo usuário Guest do
site. Na prática, cada pendência é processada mais de uma vez, em momentos
diferentes em relação aos eventos das outras origens.

### 6.4 Relógios diferentes: a ordem que o Salesforce enxerga

`EventGrid.parseDateTime` lê `dataAlteracao` com `DateTime.valueOfGmt`, isto é,
como GMT. O resultado depende da origem:

- **MS Clientes:** manda UTC, então a data fica correta;
- **MS de crédito e Plataforma BFF:** mandam horário local sem fuso, então as
  datas ficam **3h atrás** do instante real.

Isso pesa quando o Salesforce compara datas de origens diferentes:

- **Onde a comparação acontece:** no código da unificação, implantado na
  `mrv-devDan` em 27/09 e presente no branch
  `origin/GV_918914_UnificPosAprovPAC`.
  `ClienteService.sincronizarContatosAprovadosPac` e
  `sincronizarContatosContestacao` comparam a data da PAC
  (`PropostaAnaliseCredito__c.DataAlteracaoEvento__c`) com
  `Account.DataAlteracaoEventoContatoEmail__c` e `…Celular__c`. Esses
  marcadores são gravados pelo `/Cliente` com a data do MS Clientes, e depois a
  PAC grava a própria data neles.
- **Efeito:** a PAC parece 3h mais velha do que é. Um contato do MS Clientes de
  até 3h **antes** da aprovação é tratado como mais novo. Ele bloqueia a
  sincronização da PAC, ou, se chegar depois, sobrescreve o contato aprovado.
- **Staging:** a `mrv-staging` (implantação de 09/10) não tem esse método hoje.
  O risco vale para a dev e para quando o código da unificação for promovido.
- **Simulador:** manda a data da PAC com `Z`, então nunca reproduz esse efeito
  na dev.

### 6.5 Prospect misturado nos eventos de Y e o eco do callback

- **Prospect lido na hora:** o MS Clientes publica em contato e endereço o
  `IdProspectSalesforce` que o cliente tem gravado no momento (seção 3.4). Se
  o cliente Y foi gravado com o prospect da jornada (PROS-X), seus contatos e
  endereços saem com PROS-X até o callback do Salesforce gravar PROS-Y.
  Eventos publicados antes e depois do callback misturam os dois prospects, e
  a ordem de chegada decide qual deles o Salesforce processa por último.
- **Eco do callback:** o `cliente-update` com PROS-Y é eco do próprio
  Salesforce. `MSClienteService.atualizarCliente` grava o prospect no MS
  Clientes, que publica um `cliente-update` de volta para o `/Cliente`, também
  sem esperar o envio. Esse evento pode chegar antes ou depois dos parciais
  que ainda carregam PROS-X.

## 7. O que isso muda no simulador

- **Atribuição:** registrar nos cenários e no runbook a origem real de cada
  evento. Na prática, o `/PAC` e o `/Pendencia` são do MS de crédito e o
  `/MaquinaEstado` é da Plataforma BFF.
- **Datas:**
  - o schema (`apexCompatibleUtcDateTimeSchema`, `maquina-estado.ts`) só
    aceita datas terminadas em `Z`;
  - para reproduzir a PAC e a jornada como elas chegam, é preciso aceitar
    horário local sem fuso nesses contratos. É a mesma decisão pendente do
    `O15`;
  - sem isso, o efeito da seção 6.4 fica fora de qualquer teste.
- **Payload da jornada:** o simulador manda 5 campos (`cliente`, `id`,
  `dataalteracao`, `estado`, `idunidade`). O real manda a Jornada inteira, e o
  Salesforce usa dezenas de campos dela. Sem `IdCorretor`, por exemplo, o
  `atribuirProprietariosOportunidade` nunca roda.
- **Envelope da jornada:** chaves em PascalCase, `Subject` e `Topic` =
  `jornadas`, `DataVersion` vazio e `metadataVersion` `"1"`.
- **Payload do MS Clientes:** alinhar o contrato do `/Cliente` à segunda
  tabela da seção 4:
  - tirar `numerocpf` do contato e aceitar `Complemento`;
  - aceitar `Principal` no endereço;
  - aceitar data de nascimento com hora e datas com 7 casas;
  - omitir campos nulos.

  O handoff do bug 4 já pedia para avaliar o escopo antes de mudar o schema
  público do simulador.
- **Telefone com DDI:** o `/Cliente` ignora o `Complemento`. No branch da
  unificação, `NotificacaoCliente.cls:588` tem o comentário "FALTA
  CONCATENACAO DO CAMPO COMPLEMENTO". Telefones de outros países entram sem
  DDI e podem coincidir com números nacionais no casamento por celular. Um
  cenário com DDI diferente de 55 mostraria o efeito.
- **Pendência:** a entrega dupla, por duas rotas e com alguns segundos de
  intervalo, é o comportamento normal, não exceção.
- **Venda Genérica no runbook:** o harness manda `jornadausuario-update` com
  `Documentacao` em todos os TCs (`scripts/runbook/engine.ts`). Na jornada
  genérica, a BFF quase não publica eventos de jornada. Vale rever esse passo
  nos TCs de Venda Genérica.
- **Docs antigos:** em 2026-10-11, o §6 e o §9 da análise de staging, o doc
  do cenário de `Estado` não reconhecido e o Checkpoint 7.2 do plano ganharam
  uma nota de retificação apontando para a seção 5. A descrição do cenário
  em `src/scenarios/definitions.ts`, servida pela API pública, ainda diz que
  ele reproduz "um jornadausuario-update real com estado de UF (SP)".

## 8. Limitações

- As amostras de staging são as mais recentes, com limite por consulta. As
  contagens de reentrega dos últimos 7 dias usam até 400 logs por tipo e
  servem como indício, não como taxa.
- Não foi confirmado como os eventos de `clientes` e `pacs` chegam ao
  Salesforce sem `metadataVersion`: se por intermediário (APIM, Function) ou
  por outro esquema de entrega. O tópico de origem, porém, está no envelope
  em todos os casos.
- O código Apex citado na seção 6.4 é o do branch da unificação e o implantado
  na `mrv-devDan`. Não há garantia de que será promovido igual.
- A correspondência entre a jornada genérica da BFF e a Venda Genérica do
  runbook foi inferida pelos nomes.
- Os GUIDs da seção 3.5 não foram ligados a sistemas. O payload só traz o
  `client_id`, e o cadastro de clientes do provedor de identidade não foi
  consultado.
- A ordem e a concorrência das chamadas do MS de crédito ao MS Clientes não
  foram vistas, porque o código dele está em outro repositório.
