# Estado do código da unificação na `mrv-devDan`

Retrato de **2026-10-11**, atualizado às 20:43 UTC, depois do deploy que
recolocou a ponta da 2.2 nas quatro classes revertidas. Mostra, arquivo por
arquivo, em que ponto dos branches da unificação está o código implantado na
sandbox de dev. Os testes do simulador valem para esse código.

> **Como manter este doc.** Quando a dev mudar (deploy, reversão ou refresh),
> o usuário avisa. Aí:
>
> 1. se os branches tiverem commits novos, atualize as refs do
>    `com_salesforce_mrv` com `git fetch`, sem trocar de branch;
> 2. rode `node scripts/analise-staging/versao-implantada.ts`;
> 3. atualize as seções 1 e 3 a 7 com a saída e acrescente uma linha na
>    seção 9.
>
> O script é só leitura. Na org, faz SELECT pela Tooling API e baixa os
> metadados para uma pasta temporária. No repositório Salesforce, usa só
> comandos git de leitura.

## 1. Resumo

- **A dev não está em nenhum commit.** O código da unificação veio de três
  deploys:
  - **27/09, 15:20 UTC:** 19 classes, 19 classes de teste, o
    `ProponenteTrigger`, os flows `AlterarDadosLead` e
    `PermutaCadastroCliente` e o LWC `iniciarJornadaLead`. As classes e o
    trigger são os do `develop` de 21/09 em diante, quando ele já tinha
    recebido a 2.2, a 2.1 e a 1.3 (seção 3).
  - **27/09, 21:28 a 21:31 UTC:** `ClienteService`, `NotificacaoCliente`,
    `NotificacaoMaquinaEstado` e `NotificacaoPAC`, de volta à versão de
    03/09. É a "reversão dos commits 3 e 4" (seção 2).
  - **11/10, 20:43 UTC:** as mesmas quatro classes de volta à ponta da 2.2
    (`3f2919f5e7`, 21/09), a pedido do usuário (deploy
    `0AfHZ00000QmDjx0AF`). Os cinco commits que faltavam estão na dev.
- **Na 2.2, nada mais está atrás da ponta por reversão.** Quatro classes que a
  2.2 também mudou (`AccountRepository`, `ClienteSelector`, `LeadSelector` e
  `OportunidadeSelector`) estão na versão do `develop` (seção 4.2). Os testes
  `ClienteServiceTest` e `NotificacaoMaquinaEstadoTest` também seguem na
  versão do `develop`; não fizeram parte da reversão nem mudam o
  comportamento.
- **O resto da 2.2 é igual à ponta**, incluindo `ProponenteTrigger`,
  `ProponenteTriggerHandler`, `ReconciliacaoContatosLeadQueueable` e
  `MSClienteService`.
- **1.3 e 2.1:** a dev tem a versão que o `develop` tinha depois de receber
  esses branches, e não a ponta deles (seções 5 e 6).

## 2. A reversão de 27/09 a 11/10

Desde 11/10, às 20:43 UTC, a dev não está mais revertida. Esta seção registra
por que ela esteve e o que o simulador achou nesse estado.

As quatro classes foram levadas de volta a 03/09 de propósito, para ver se o
simulador pegaria os bugs que os commits 3 e 4 corrigem. O texto original dos
dois bugs está em
[`textos-originais-bugs-tc001-commits-3-4.md`](textos-originais-bugs-tc001-commits-3-4.md).
O mesmo arquivo está em `docs/unificacao-clientes/` no checkout do
`com_salesforce_mrv`, numa cópia local fora do git.

O que o simulador encontrou nesse estado:

| Bug | Commit que corrige | Resultado | Onde está |
|---|---|---|---|
| A Account X muda quando a PAC aprova outra pessoa, Y | 4, `1f6844e910` | **Reproduzido** em 01/10, com a mesma impressão digital de staging. A alteração veio da pendência (`ProponenteTrigger` → `sincronizarEmailContatoPendencia`), não do `/Cliente`. Três outros caminhos levam ao mesmo efeito | [handoff do bug 4, seção 1.1](handoff-investigacao-tc001-bug4.md#11-causa-identificada-e-reprodução-2026-10-01) |
| O Lead de Y não é criado (`UNABLE_TO_LOCK_ROW`) | 3, `72cbd884f6` | **Em parte.** O `DUPLICATE_VALUE` de staging se repetiu, mas o Lead sempre foi criado, e o `UNABLE_TO_LOCK_ROW` literal não apareceu. Achado novo: uma corrida silenciosa que deixa Leads duplicados órfãos | [diagnóstico dos commits 3 e 4](tc-001-diagnostico-corridas-commits-3-4.md) |

Campanhas do runbook e o estado em que rodaram:

- **11/10, campanha completa** (545 RUNs nos 13 perfis, 331 conformes):
  depois da reversão ([relatório](resultado-runbook-completo-2026-10-11.md)).
  Cada bug pego, com a matriz TC × perfil, está no
  [catálogo de bugs](bugs-pegos-pelo-runbook.md). PA, CA e ME repetem os
  vereditos de 02/10.
- **11/10, perfis das ordens reais** (237 RUNs, 178 conformes): depois da
  reversão ([relatório](resultado-runbook-ordens-reais-2026-10-11.md)). Com a
  ordem real da aprovação, a pendência grava na Account que a PAC em análise
  achou: em X nos 19 TCs do bug 4, na Account duplicada errada no TC-038 e,
  pelo reflexo, no Lead de outra pessoa no TC-021. A repetição do WebJob leva
  contatos de outra pessoa ao Lead novo de Y em 11 TCs. O guard de parciais
  do commit 4 não está na dev; o efeito dele nesses casos só se mede com a
  ponta implantada.
- **02/10** (132 RUNs, 121 conformes): depois da reversão
  ([relatório](resultado-runbook-recorte-2.2-2026-10-02.md)).
- **27/09** (das 16:53 às 18:41 UTC): antes da reversão das quatro classes,
  com os mesmos vereditos
  ([relatório](resultado-runbook-recorte-2.2-2026-09-27.md)). A versão que
  as quatro tinham nesse intervalo não pode mais ser lida na org.

## 3. Deploys na dev desde 20/08

Apex agrupado pelo minuto do `LastModifiedDate`, mais os metadados que os
branches mudaram. Horários em UTC:

| Quando | O que entrou | Relação com a unificação |
|---|---|---|
| 01/07 15:22 | regra de validação `Lead.PreencherEmailOuCelular` | igual à ponta da 2.2 e da 1.3 |
| 20/08 a 24/08 | `AgentForceService`, `DALeadDisponivelCorretorController`, `DaPoolCorretorController`, `Logging`, `LeadHelper`, `NovoLeadService`, `UsuarioSelector` | fora dos três branches |
| 27/08 19:09 e 20:08 | `FilaLeads*` e `Whatslly*` | fora dos três branches |
| 27/08 23:21 | `GraphQLCreator` e `MSClienteService`, com `Email`, `EmailUtil`, `LeadDeduplicationPersistence`, `PesquisarContaController` e 10 testes | `GraphQLCreator` e `MSClienteService` iguais à ponta da 2.2 |
| 28/08 18:25 | flow `Proponente_1`, versão ativa v3 | igual à ponta da 2.2 |
| 30/08 02:54 | `ClienteCrmWrapper` | fora dos três branches |
| 16/09 18:13 | `Ges_LeadSelector` | igual à ponta da 2.2 e da 1.3 |
| 25/09 14:25 | `TelefoneUtil` | fora dos três branches |
| **27/09 15:20** | 19 classes, 19 testes, `ProponenteTrigger`, LWC `iniciarJornadaLead` e flows `AlterarDadosLead` (v16) e `PermutaCadastroCliente` (v13) | seções 4 a 6 |
| **27/09 21:28 a 21:31** | `ClienteService`, `NotificacaoCliente`, `NotificacaoMaquinaEstado` e `NotificacaoPAC` | versão de 03/09 (seção 4.1) |
| 29/09 06:33 | `OwnBackup_*` e `ArchiverConfigurationsGetter` | fora da unificação |
| 29/09 17:04 | `LeadEventGrid*`, `GES_LeadTriggerHandler`, `MudancaProprietarioLeadService`, `SObjectRetornoSeguro` e o trigger `LeadEventGridTrigger` | fora da unificação. Não enfileira jobs nos fluxos do runbook ([handoff, seção 10](handoff-investigacao-tc001-bug4.md#10-estado-do-harness-do-runbook-e-da-dev-em-0210)) |
| 07/10 18:49 | `ConsultarEstoqueLeadController` | fora da unificação |
| **11/10 20:43** | `ClienteService`, `NotificacaoCliente`, `NotificacaoMaquinaEstado` e `NotificacaoPAC` | ponta da 2.2 (seção 4.1); deploy `0AfHZ00000QmDjx0AF` |

Fora do Apex, a dev mudou também em 01/10: o permission set `AcessoDeAPI`
ganhou leitura de `Contact.DataHoraAtualizacaoEmailPendencia__c` (deploy
`0AfHZ00000QaIsH0AV`, seção 1.1 do handoff).

**De onde veio a leva das 15:20:**

- **Apex do `develop`.** As 39 peças de Apex dessa leva, 38 classes e o
  trigger, são idênticas às do `develop` em todos os commits de `023abfee6b`
  (21/09) até `3c2f3ca5bc` (02/10). No commit anterior, `abaca86ad2`, duas
  classes de teste diferem. Então o Apex veio de um `develop` de 21/09 a
  27/09.
- **O flow `PermutaCadastroCliente` não veio desse `develop`.** A dev tem a
  versão de `1f3fa31bfe` (04/09), e o `develop` da época tinha a de
  `8a9dcc2224` (24/08).
- **O `develop` foi refeito depois.** O `origin/develop` do último fetch
  (09/10) não contém esses commits. Nenhum dos 39 arquivos tem nele o
  conteúdo da dev, e a `ReconciliacaoContatosLeadQueueable` nem existe. As
  versões seguem em refs como `origin/develop_merge_superapp` e
  `origin/copy_develop`.

## 4. Branch 2.2 (`GV_918914_UnificPosAprovPAC`, ponta `3f2919f5e7`, 21/09)

### 4.1 As quatro classes revertidas, de volta à ponta

Desde 11/10, às 20:43 UTC, as quatro estão iguais à ponta da 2.2 (deploy
`0AfHZ00000QmDjx0AF`, feito do branch local `GV_918914_UnificPosAprovPAC`
do `com_salesforce_mrv`, sem commit). De 27/09 a 11/10, estavam assim:

| Classe | Revertida em | Igual a | Commits da 2.2 que faltavam |
|---|---|---|---|
| `ClienteService` | 27/09 21:28 | `c04b6add92` (03/09) | `1f6844e910`, `9210581ea5`, `3f2919f5e7` |
| `NotificacaoCliente` | 27/09 21:29 | `c04b6add92` (03/09) | `1f6844e910`, `72cbd884f6`, `3f2919f5e7` |
| `NotificacaoMaquinaEstado` | 27/09 21:30 | `9f0ba21f38` (03/09) | `9210581ea5`, `7c86318a05` |
| `NotificacaoPAC` | 27/09 21:31 | `c04b6add92` (03/09) | `1f6844e910` |

Os cinco commits que faltavam:

| Commit | Data | O que é | O que muda no código |
|---|---|---|---|
| `1f6844e910` | 08/09 | **Commit 4.** Guard de identidade em `NotificacaoCliente` para eventos parciais pós-PAC | Cria o `validarIdentidadePayloadParcialContraAccount` no `/Cliente` e a versão de `deveDescartarMatchPosPac` que recebe o CPF. A `NotificacaoPAC` passa a mandar o CPF para ela |
| `72cbd884f6` | 09/09 | **Commit 3.** Novo Lead não é criado na aprovação de PAC com CPF divergente (`UNABLE_TO_LOCK_ROW`) | Cria o `updateAccountComRetryLock` no `insertLeadQueueable`: repete o update da Account quando dá `UNABLE_TO_LOCK_ROW` |
| `9210581ea5` | 09/09 | PAC enviada para a fila manual indevidamente, com o erro "Cliente(Account) não encontrado no Salesforce" | Sem IdCliente e sem CPF no evento, o `deveDescartarMatchPosPac` deixa de descartar o match. A `NotificacaoMaquinaEstado` passa a mandar o CPF do proponente. Depende do commit 4 |
| `7c86318a05` | 10/09 | Preserva o vínculo histórico da Opportunity em `jornadausuario-*` sem IdCliente | A `NotificacaoMaquinaEstado` passa a considerar o CPF ao decidir se mantém a Account atual da Opportunity |
| `3f2919f5e7` | 21/09 | Corrige falso positivo no guard de identidade de payload parcial (`contato-update` e `endereco-update`) | Ajusta o guard do commit 4 |

### 4.2 O resto da 2.2

Igual à ponta: `ClienteTriggerHandler`, `ContestacaoSelector`,
`Ges_LeadSelector`, `GraphQLCreator`, `MSClienteService`,
`ProponenteSelector`, `ProponenteSelectorTeste`, `ProponenteTrigger`,
`ProponenteTriggerHandler`, `PropostaAnaliseCreditoSelector`,
`ReconciliacaoContatosLeadQueueable`, o flow `Proponente_1` e a regra
`Lead.PreencherEmailOuCelular`.

Fora do histórico do branch, iguais a commits do `develop`:

| Classe | Igual a |
|---|---|
| `AccountRepository` | `32382519d6` (11/08), merge do PR 110545, da 2.2 |
| `ClienteSelector` (também mudada pela 2.1 e pela 1.3) | `9f350c85c5` (31/08), "reset automático" do `develop` |
| `LeadSelector` (também mudada pela 1.3) | `abaca86ad2` (21/09), merge do PR 113310 |
| `OportunidadeSelector` | `a78971a987` (17/09), merge do PR 113124 (`RDM_46637`) |

## 5. Branch 1.3 (`GV_909649`, ponta `1ef8425b91`, 16/09)

Igual à ponta: `AlteraLeadService`, `Ges_LeadSelector`,
`LeadDeduplicationUtils`, `LeadFilter`, `PersonAccount`,
`VG_MSClienteCriarAtualizarInvocable` e a regra
`Lead.PreencherEmailOuCelular`.

Iguais a commits do `develop`:

| Arquivo | Igual a |
|---|---|
| `LeadDeduplicationHandler` e `NotificacaoChatbot` | `b97abbe846` (16/09), merge do PR 113062, da 1.3 |
| `LeadRepository` | `abaca86ad2` (21/09), merge do PR 113310 |
| flow `AlterarDadosLead` (v16) | `1cf24e9365` (02/09), merge do PR 112208, da 1.3 |
| flow `PermutaCadastroCliente` (v13) | `1f3fa31bfe` (04/09), "Fix PreProd into develop" |

`ClienteSelector` e `LeadSelector` estão na seção 4.2.

## 6. Branch 2.1 (`feature/gv_918899_unificacao_clientes`, ponta `1c108fecd1`, 09/09)

Nenhum arquivo da 2.1 está na versão da ponta:

- `CpfCNPJ`: igual a `094926c608` (18/08), merge do PR 111051, da 2.1.
- LWC `iniciarJornadaLead` (html e js): igual a `cbf4fc9f99` (11/08), merge do
  PR 110492, da 2.1.
- `ClienteSelector` e `ClienteService`: seção 4.

## 7. O que isso muda nos testes

- **A dev roda a ponta da 2.2 desde 11/10, às 20:43 UTC.** As campanhas de
  27/09 a 11/10 (a última terminou às 18:11 UTC) rodaram no estado revertido,
  e o [catálogo de bugs](bugs-pegos-pelo-runbook.md) vale para ele. Para saber
  quais bugs a ponta corrige, rode a campanha de novo e compare as matrizes
  com `npm run runbook:bugs`.
- **PAC em análise de quem o Salesforce não acha:** com o commit 4, a ponta
  descarta o match por prospect quando o CPF diverge. A PAC em análise de Y
  passa a ser recusada (400, "Cliente(Account) não encontrado") até Y existir,
  também nos TCs em que antes ela achava X (handoff do bug 4, seção 1.1). Os
  perfis AR, AM e FW tratam essa recusa como esperada e reentregam a PAC
  depois; os perfis C1 a C4 não, e o RUN para nela.
- **Fila manual e vínculo da Opportunity:** com `9210581ea5` e `7c86318a05`,
  os eventos sem IdCliente seguem a ponta, tanto na PAC quanto na jornada
  (`jornadausuario-*`). Os cenários da API que mandam jornada sem cliente
  (`maquina-estado-insert-sem-cliente` e
  `maquina-estado-update-obsoleto-sem-cliente`) passam por esses caminhos.
- **Relógio do crédito:** a `NotificacaoPAC` de `c04b6add92` já soma 3h à
  data que chega sem fuso, então a dev grava a data da PAC em UTC. A seção
  6.4 do [doc de origem dos eventos](origem-dos-eventos-no-salesforce.md)
  explica, e o perfil RC do harness confere.

## 8. Limitações

- **Escopo:** o script compara só os arquivos que os três branches mudaram
  desde a base com o `develop`. Classes de fora, como `NotificacaoPendencias`,
  `EventGrid` e `LeadHelper`, não entram.
- **Refs:** são as do último fetch do `com_salesforce_mrv`, de 09/10.
- **O que a comparação ignora:**
  - em todos os arquivos: fim de linha, espaço no fim das linhas e espaço no
    começo e no fim do arquivo;
  - nos metadados XML: indentação, linhas vazias e o que o retrieve
    acrescenta e o repositório não guarda (estilo dos campos de tela,
    `nameSegment` e `areMetricsLoggedToDataCloud`).
- **Versões sobrescritas:** o `LastModifiedDate` só guarda o último deploy de
  cada arquivo. Uma versão sobrescrita, como a das quatro classes entre 15:20
  e 21:28 de 27/09, não pode mais ser lida.
- **Flows:** nos três flows, a versão ativa é também a mais recente, que é a
  que o retrieve devolve.

## 9. Histórico

| Data | O que mudou na dev | Conferido |
|---|---|---|
| 27/09 | Leva das 15:20 e reversão das 21:28 a 21:31 (seções 3 e 4) | em 11/10, pelo script |
| 29/09 | `OwnBackup_*` às 06:33 e `LeadEventGrid*` às 17:04 | em 11/10, pelo script |
| 01/10 | Permission set `AcessoDeAPI` | handoff do bug 4, seção 1.1 |
| 07/10 | `ConsultarEstoqueLeadController` | em 11/10, pelo script |
| 11/10 | Primeira versão deste doc | `versao-implantada.ts` |
| 11/10 20:43 | As quatro classes revertidas voltam à ponta da 2.2 (deploy `0AfHZ00000QmDjx0AF`) | em 11/10, pelo script |
