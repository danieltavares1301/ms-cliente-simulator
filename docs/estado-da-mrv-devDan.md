# Estado do código da unificação na `mrv-devDan`

Retrato de **2026-10-20**, tirado depois do deploy do ponto zero (23:46 UTC).
Mostra, arquivo por arquivo, em que ponto dos branches da unificação está o
código implantado na sandbox de dev. Os testes do simulador valem para esse
código.

> **Como manter este doc.** Quando a dev mudar (deploy, reversão ou refresh),
> o usuário avisa. Aí:
>
> 1. se os branches tiverem commits novos, atualize as refs do
>    `com_salesforce_mrv` com `git fetch`, sem trocar de branch;
> 2. rode `node scripts/analise-staging/versao-implantada.ts`;
> 3. confira à parte o que o script não cobre (seção 4.3);
> 4. atualize as seções 1 e 3 a 6 com a saída e acrescente uma linha na
>    seção 8.
>
> O script é só leitura. Na org, faz SELECT pela Tooling API e baixa os
> metadados para uma pasta temporária. No repositório Salesforce, usa só
> comandos git de leitura.

## 1. Resumo

- **A dev está no ponto zero do
  [plano da reescrita](plano-branch-reescrita-2.2.md)** (seções 2 e 3). Isso
  é a 1.3 (`GV_909649`, `1ef8425b91`) mais a etapa 1 do branch local
  `GV_909649_918914`, na ponta `b16d25c214`. O código veio de três levas
  (seção 3):
  - **18/10, das 01:51 às 02:09 UTC:** o recorte da unificação na versão da
    1.3. Saíram as 5 classes que só existem na 2.2.
  - **19/10, às 02:54 e às 03:21 UTC:** a `NotificacaoPAC` e o teste dela,
    com os itens 4 e 5 da etapa 1, antes do commit.
  - **20/10, às 23:46 UTC:** o deploy do ponto zero (`0AfHZ00000QxNw60AF`),
    com o que a etapa 1 mudou e duas classes de teste da 1.3.
- **Todo arquivo do recorte é igual à ponta da 1.3 ou ao HEAD do branch.**
  Sobram duas diferenças de forma, não de conteúdo (seção 4):
  - o flow `PermutaCadastroCliente` volta da org com os elementos em outra
    ordem;
  - o Aura `atualizaEmailContaAura` volta com `type="Email"` em maiúscula.
- **Da 2.2, só o que a 1.3 já trazia.** A `MSClienteService` e a
  `ReconciliacaoContatosLeadQueueable` não existem na org. A busca do
  `c47170d879`, que a 1.3 já tinha, está lá, mas sem chamador (plano, seção
  1.1).
- **A 2.1 também saiu.** O `CpfCNPJ` e o LWC `iniciarJornadaLead` são os da
  1.3, sem o `expandirFormatosCPF` (plano, seção 1.4).
- **A dev é compartilhada.** Em 20/10, houve 27 deploys de outro trabalho:
  voucher da Uber, deslocamento, visita e SLA (seção 3).
  - Não tocam o recorte da unificação.
  - Mexem em Lead: `LeadHelper`, `GES_LeadTriggerHandler`, campos novos, o
    record type `GestaoVendas` e o flow
    `SelecaoStatusLeadDistribuicaoAutomatica`. Rodam no mesmo Lead que o
    harness cria.
- **Testes Apex do ponto zero:** passaram 80 dos 81 métodos das quatro
  classes que o plano pede (seção 5).
- **Desde 22/10, parte da etapa 3 está na dev** (seção 3). As seções 4 a 6
  ainda descrevem o ponto zero e serão refeitas no deploy da etapa 3.

## 2. Estados anteriores

Até 18/10, a dev rodava a 2.2. Todas as campanhas do runbook até 12/10 rodaram
nela, e não no ponto zero. O retrato de 11/10, arquivo por arquivo, está na
versão deste doc do commit `d519b3c`:

```bash
git show d519b3c:docs/estado-da-mrv-devDan.md
```

- **27/09, às 15:20 UTC:** entrou o Apex do `develop` de 21/09 a 27/09, que
  já tinha recebido a 2.2, a 2.1 e a 1.3. O `develop` foi refeito depois. As
  versões seguem em refs como `origin/develop_merge_superapp` e
  `origin/copy_develop`.
- **De 27/09, às 21:28 UTC, a 11/10, às 20:43 UTC:** quatro classes da 2.2
  ficaram revertidas a 03/09, de propósito (seção 2.1).
- **De 11/10, às 20:43 UTC, a 18/10, às 01:51 UTC:** as quatro voltaram à
  ponta da 2.2 (`3f2919f5e7`, 21/09), pelo deploy `0AfHZ00000QmDjx0AF`.

### 2.1 A reversão de 27/09 a 11/10

As quatro classes foram levadas de volta a 03/09 para ver se o simulador
pegaria os bugs que os commits 3 e 4 corrigem. O texto original dos dois bugs
está em
[`textos-originais-bugs-tc001-commits-3-4.md`](textos-originais-bugs-tc001-commits-3-4.md).
O mesmo arquivo está em `docs/unificacao-clientes/` no checkout do
`com_salesforce_mrv`, numa cópia local fora do git.

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

O que o simulador encontrou no estado revertido:

| Bug | Commit que corrige | Resultado | Onde está |
|---|---|---|---|
| A Account X muda quando a PAC aprova outra pessoa, Y | 4, `1f6844e910` | **Reproduzido** em 01/10, com a mesma impressão digital de staging. A alteração veio da pendência (`ProponenteTrigger` → `sincronizarEmailContatoPendencia`), não do `/Cliente`. Três outros caminhos levam ao mesmo efeito | [handoff do bug 4, seção 1.1](handoff-investigacao-tc001-bug4.md#11-causa-identificada-e-reprodução-2026-10-01) |
| O Lead de Y não é criado (`UNABLE_TO_LOCK_ROW`) | 3, `72cbd884f6` | **Em parte.** O `DUPLICATE_VALUE` de staging se repetiu, mas o Lead sempre foi criado, e o `UNABLE_TO_LOCK_ROW` literal não apareceu. Achado novo: uma corrida silenciosa que deixa Leads duplicados órfãos | [diagnóstico dos commits 3 e 4](tc-001-diagnostico-corridas-commits-3-4.md) |

### 2.2 As campanhas e o estado em que rodaram

- **12/10, campanha completa alinhada à planilha** (484 RUNs nos 39 TCs que o
  harness modela, 295 conformes): na ponta da 2.2, com o harness alinhado à
  planilha oficial
  ([relatório](resultado-runbook-completo-alinhado-2026-10-12.md)). Trouxe o
  B10 para a matriz e tirou o B9 e o K2 do 046
  ([convergência](convergencia-planilha-runbook-2.2.md)).
- **11/10, campanha completa com os commits** (545 RUNs nos 13 perfis, 331
  conformes): das 20:49 às 21:44 UTC, na ponta da 2.2
  ([relatório](resultado-runbook-completo-com-commits-2026-10-11.md)). Os
  vereditos são os mesmos da campanha sem os commits, par a par. O que muda é
  o bug por trás de parte deles:
  - com o commit 4, a PAC em análise de Y passa a ser recusada nos 19 TCs em
    que Y não tem Account. No AR e no FW, X não recebe mais o e-mail de Y, mas
    a pendência ainda grava o carimbo em X pelo Proponente que ficou com os
    dados de X. No C1, o RUN para na recusa;
  - no C2 e no C3, com o IdCliente de X na PAC em análise, o bug 4 continua;
  - efeito novo: a Account Y nasce com os contatos de X, e a PAC aprovada
    leva os aprovados ao Lead Y reutilizado (B9, nos TCs 047, 055 e 056).

  A comparação completa está no [catálogo de bugs](bugs-pegos-pelo-runbook.md).
- **11/10, campanha completa sem os commits** (545 RUNs nos 13 perfis, 331
  conformes): no estado revertido, sem os cinco commits da seção 2.1
  ([relatório](resultado-runbook-completo-sem-commits-2026-10-11.md)). PA, CA
  e ME repetem os vereditos de 02/10.
- **11/10, perfis das ordens reais, sem os commits** (237 RUNs, 178
  conformes): no estado revertido
  ([relatório](resultado-runbook-ordens-reais-2026-10-11.md)). Com a ordem
  real da aprovação, a pendência grava na Account que a PAC em análise achou:
  - em X, nos 19 TCs do bug 4;
  - na Account duplicada errada, no TC-038;
  - pelo reflexo, no Lead de outra pessoa, no TC-021.

  A repetição do WebJob leva contatos de outra pessoa ao Lead novo de Y. O
  relatório contou 11 TCs; a classificação revista, de 11/10, conta 13.
- **02/10** (132 RUNs, 121 conformes): no estado revertido
  ([relatório](resultado-runbook-recorte-2.2-2026-10-02.md)).
- **27/09** (das 16:53 às 18:41 UTC): antes da reversão das quatro classes,
  com os mesmos vereditos
  ([relatório](resultado-runbook-recorte-2.2-2026-09-27.md)). A versão que
  as quatro tinham nesse intervalo não pode mais ser lida na org.

## 3. Deploys na dev desde 20/08

Apex agrupado pelo minuto do `LastModifiedDate`, mais os metadados que os
branches mudaram e os deploys conhecidos pelo ID. Horários em UTC.

- **As linhas até 11/10 foram lidas em 11/10.** Muito do que elas trouxeram
  foi sobrescrito em 18/10, e o `LastModifiedDate` dessas classes passou a ser
  o de 18/10.
- **As linhas de 18/10 em diante** vêm do script e do `DeployRequest` da
  Tooling API.

| Quando | O que entrou | Relação com a unificação |
|---|---|---|
| 01/07 15:22 | regra de validação `Lead.PreencherEmailOuCelular` | igual à ponta da 2.2 e da 1.3 |
| 20/08 a 24/08 | `AgentForceService`, `DALeadDisponivelCorretorController`, `DaPoolCorretorController`, `Logging`, `LeadHelper`, `NovoLeadService`, `UsuarioSelector` | fora dos três branches |
| 27/08 19:09 e 20:08 | `FilaLeads*` e `Whatslly*` | fora dos três branches |
| 27/08 23:21 | `GraphQLCreator` e `MSClienteService`, com `Email`, `EmailUtil`, `LeadDeduplicationPersistence`, `PesquisarContaController` e 10 testes | na época, `GraphQLCreator` e `MSClienteService` iguais à ponta da 2.2. Hoje só o `LeadDeduplicationPersistence` e 4 testes seguem nessa data |
| 28/08 18:25 | flow `Proponente_1`, versão ativa v3 | na época, igual à ponta da 2.2 |
| 30/08 02:54 | `ClienteCrmWrapper` | fora dos três branches |
| 16/09 18:13 | `Ges_LeadSelector` | igual à ponta da 2.2 e da 1.3 |
| 25/09 14:25 | `TelefoneUtil` | fora dos três branches |
| **27/09 15:20** | 19 classes, 19 testes, `ProponenteTrigger`, LWC `iniciarJornadaLead` e flows `AlterarDadosLead` (v16) e `PermutaCadastroCliente` (v13) | `develop` de 21/09 a 27/09 (seção 2) |
| **27/09 21:28 a 21:31** | `ClienteService`, `NotificacaoCliente`, `NotificacaoMaquinaEstado` e `NotificacaoPAC` | versão de 03/09 (seção 2.1) |
| 29/09 06:33 | `OwnBackup_*` e `ArchiverConfigurationsGetter` | fora da unificação |
| 29/09 17:04 | `LeadEventGrid*`, `GES_LeadTriggerHandler`, `MudancaProprietarioLeadService`, `SObjectRetornoSeguro` e o trigger `LeadEventGridTrigger` | fora da unificação. Não enfileira jobs nos fluxos do runbook ([handoff, seção 10](handoff-investigacao-tc001-bug4.md#10-estado-do-harness-do-runbook-e-da-dev-em-0210)) |
| 07/10 18:49 | `ConsultarEstoqueLeadController` e teste | fora da unificação |
| **11/10 20:43** | `ClienteService`, `NotificacaoCliente`, `NotificacaoMaquinaEstado` e `NotificacaoPAC` | ponta da 2.2; deploy `0AfHZ00000QmDjx0AF` |
| 14/10 02:53 | `ConsultarEstoqueLeadController` | fora da unificação |
| 15/10 17:25 | `QueroVenderUpdate*` e 2 testes | fora da unificação |
| **18/10 01:51** | as classes e os testes do recorte, `ProponenteTrigger`, LWCs `iniciarJornadaLead` e `validaEmail`, Aura `atualizaEmailContaAura` e flows `AlterarDadosLead` (v17), `CadastroParceiro` (v17) e `Proponente_1` (v4). Hoje, 24 classes e 18 testes seguem com essa data | ponta da 1.3; deploy `0AfHZ00000QtjyP0AR`, com 56 componentes |
| **18/10 02:05** | apagadas: `MSClienteService`, `MSClienteServiceTest`, `ReconciliacaoContatosLeadQueueable`, `ReconciliacaoContatosLeadQueueableTest` e `ProponenteTriggerHandlerTest` | só existem na 2.2; deploy `0AfHZ00000QtkhZ0AR` |
| 18/10 02:07 | excluída a v16 do flow `AlterarDadosLead`, a do PR 112208 (`1cf24e9365`) | travava o deploy seguinte |
| **18/10 02:08** | LWC `campoFlow` da 1.3 e flow `PermutaCadastroCliente` v14, da cópia de trabalho | deploy `0AfHZ00000Qtko10AB` |
| 19/10 02:54 e 03:21 | `NotificacaoPAC` e `NotificacaoPACTest`, com os itens 4 e 5 da etapa 1, antes do commit | deploys `0AfHZ00000QuBwH0AV` e `0AfHZ00000QuCcE0AV` |
| 20/10 01:11 a 23:28 | 27 deploys de outro trabalho: voucher da Uber, deslocamento, visita e SLA. Em Lead: `LeadHelper`, `GES_LeadTriggerHandler`, os campos `StatusVoucher__c`, `VoucherCode__c`, `VoucherCodeLink__c` e `OrigemCaptacao__c`, o record type `GestaoVendas` e o flow `SelecaoStatusLeadDistribuicaoAutomatica` | fora da unificação, mas no Lead |
| **20/10 23:46** | `LeadSelector`, `NotificacaoMaquinaEstado`, os testes deles, `OportunidadeSelectorTest`, `PesquisarContaControllerTest` e o flow `PermutaCadastroCliente` (v15). A `NotificacaoPAC` e o teste dela foram no pacote, mas já estavam iguais | ponto zero; deploy `0AfHZ00000QxNw60AF` |
| **22/10 02:21 e 02:33** | Parte da etapa 3, do working tree, com a lacuna 3 ainda sem commit: `AtualizaClientesRelacionadosService`, `ClienteService`, `NotificacaoCliente`, `NotificacaoMaquinaEstado`, `NotificacaoPAC`, `ProponenteSelector`, `ProponenteTriggerHandler`, os testes deles, o `ProponenteTrigger`, o flow `Proponente_1` (v5) e o metadado `Error_Response_Mapping.Parcial_antes_do_cliente` | etapa 3 parcial, para validar a lacuna 3; deploys `0AfHZ00000QzQUr0AN` e `0AfHZ00000QzQkz0AF`. Ficaram fora o `OportunidadeTriggerHandler`, que não compila na dev, e o `NotificacaoPendenciasTest` |
| **22/10 02:59** | `ClienteService`, `NotificacaoCliente` e os testes deles, com a lacuna 6 ainda sem commit | para validar a lacuna 6; deploy `0AfHZ00000QzRkH0AV`, depois da validação `0AfHZ00000QzRdp0AF` (80 testes) |
| **22/10 10:09** | `ClienteSelector` e `ClienteSelectorTest`, com a lacuna 4 ainda sem commit | para validar a lacuna 4; deploy `0AfHZ00000QzaFh0AJ`, depois da validação `0AfHZ00000QzaAr0AJ` (123 testes) |
| **22/10 10:27** | `CpfCNPJ`, `ClienteSelector`, os testes deles e o `VG_MSClienteCriarAtualizarInvocableTest`, com a lacuna 5 ainda sem commit | para validar a lacuna 5; deploy `0AfHZ00000QzaUD0AZ`, depois da validação `0AfHZ00000QzaSb0AJ` (127 testes) |
| **22/10 11:10** | `NotificacaoMaquinaEstado` e o teste dela, com a lacuna 7 ainda sem commit | para validar a lacuna 7; deploy `0AfHZ00000QzbbZ0AR`, depois da validação `0AfHZ00000QzbJq0AJ` (87 testes) |
| **22/10 11:26** | `NotificacaoPAC` e o teste dela, com a lacuna 8 ainda sem commit | para validar a lacuna 8; deploy `0AfHZ00000QzcML0AZ`, depois da validação `0AfHZ00000QzcB30AJ` (91 testes) |
| **22/10 14:59** | `ClienteService`, `NotificacaoPAC` e os testes deles, com o item 1 da R3 (o ponto único e a PAC aprovada) ainda sem commit | etapa 4; deploy `0AfHZ00000Qzg3Q0AR`, depois da validação `0AfHZ00000QzqM60AJ` (94 testes) |
| **22/10 19:03** | `ProponenteSelector`, `ProponenteTriggerHandler` e o teste dele, o `ProponenteTrigger` e o flow `Proponente_1` (v6, sem o elemento que grava o e-mail), com o item 2 da R3 (a pendência) ainda sem commit | etapa 4; deploy `0AfHZ00000R0Ttj0AF`, depois da validação `0AfHZ00000R0OpE0AV` (101 testes) |
| **22/10 19:38** | `NotificacaoPAC` e o teste dela, com o item 3 da R3 (a contestação) ainda sem commit | etapa 4; deploy `0AfHZ00000R0RS80AN`, depois da validação `0AfHZ00000R0X2s0AF` (81 testes) |
| **22/10 21:26** | `ClienteService` e o teste dele, com o item 5 da R3 (o reflexo para o Lead confere o CPF) ainda sem commit | etapa 4; deploy `0AfHZ00000R0cXE0AZ`, depois da validação `0AfHZ00000R0ruQ0AR` (104 testes) |
| **22/10, depois da etapa 4** | `PoliticaLeadService` (nova) e `VG_MSClienteCriarAtualizarInvocable`, com o item 1 da R4 (a árvore de Lead da Venda Genérica extraída para um serviço) ainda sem commit | etapa 5; deploy `0AfHZ00000R0wxJ0AR`, depois da validação `0AfHZ00000R0wsT0AR` (25 testes) |
| **22/10 23:20 e 23:29** | `PoliticaLeadService`, `VincularLeadDaPessoaQueueable` (nova), `ProponenteSelector`, `NotificacaoCliente` e os testes, com o item 2 da R4 (a política de Lead ligada no pós-PAC) ainda sem commit | etapa 5; deploys `0AfHZ00000R0ykb0AB` e `0AfHZ00000R0z2L0AR`, depois da validação `0AfHZ00000R0yxV0AR` (114 testes) |
| **22/10 23:38 a 23:44** | Rename do item 2 da R4: `VincularLeadDaPessoaQueueable` passou a `VinculoLeadPosPacQueueable`. A classe antiga foi removida (`0AfHZ00000R0voM0AR`, 23:38) antes do deploy das renomeadas, por um erro de comando meu; nesses 6 minutos, a `NotificacaoCliente` ficou inválida e o `/Cliente` da dev quebrado. Restaurado pelo deploy `0AfHZ00000R0zbp0AB` (23:44, 114 testes) e conferido com o TC-001 no CA | etapa 5 |
| **23/10 00:07** | `PoliticaLeadService` e o teste dele, com o item 3 da R4 (P3: o Lead reutilizado ganha o CPF e só recebe contato onde está vazio) ainda sem commit | etapa 5; deploy `0AfHZ00000R11If0AJ`, depois da validação `0AfHZ00000R11FR0AZ` (56 testes) |
| **23/10 00:2x** | Rename: `PoliticaLeadService` e o teste dele passaram a `UnificacaoLeadService` e `UnificacaoLeadServiceTest`, com o invocable da Venda Genérica e o Queueable atualizados. As novas foram implantadas antes (`0AfHZ00000R11nJ0AR`, 56 testes; o comentário em `0AfHZ00000R11s90AB`), e só depois as antigas foram removidas (`0AfHZ00000R11tl0AB`). Conferido com o TC-001 e o TC-012 no CA | etapa 5 |
| **23/10 00:30 e 00:42** | `ClienteService`, `UnificacaoLeadService`, `NotificacaoCliente` e os testes, com o item 5 da R4 (P7: o reflexo por campo; e a troca do prospect que aponta para um Lead de outro CPF) ainda sem commit | etapa 5; deploys `0AfHZ00000R12Ej0AJ` e `0AfHZ00000R12Y50AJ`, depois das validações `0AfHZ00000R11yb0AB` (94 testes) e `0AfHZ00000R12Mn0AJ` (114 testes) |
| **23/10 01:45** | Uma campanha completa da etapa 5 parcial foi interrompida a pedido do usuário depois de 6 RUNs. Os 6 RUNs em andamento deixaram massa sintética "UNIF22" (1 contestação, 6 Proponentes, 6 PACs, 6 Opportunities, 9 Leads e 11 Accounts, criados entre 01:45 e 01:46 UTC), apagada pela Bulk API na ordem do harness | etapa 5 |
| **23/10 02:19** | `UnificacaoLeadService` e o teste dele, a `MSClienteService` e o teste dela (de volta, iguais ao `d914e60785` e ao `1792eaa62d`), o `GraphQLCreator` e o teste dele (com o `ATUALIZAR_CLIENTE`), com o item 4 da R4 (o `IdProponente__c` do principal, o aviso ao MS Clientes, o retry em `UNABLE_TO_LOCK_ROW` e o prospect do Lead reutilizado sem `Id__c`) ainda sem commit. Uma primeira tentativa (`0AfHZ00000R15XZ0AZ`, 01:57) parou 17 minutos no `NotificacaoMaquinaEstadoTest.atribuirProprietariosOportunidadeEspecialistaTest`, que leva de 5 a 12 segundos e não passa pelo código do item, e foi cancelada sem implantar nada. Commitado depois como `e3cbc42e54` | etapa 5; deploy `0AfHZ00000R15xO0AR` (157 testes), depois da validação `0AfHZ00000R15Vx0AJ` (50 testes) |
| **23/10 02:42** | `NotificacaoPAC` e o teste dela, com o item 6 da R4 (a PAC aprovada põe na política de Lead a Account do principal que ainda está sem o Lead do mesmo CPF), commitado depois como `753b1e272a` | etapa 5; deploy `0AfHZ00000R16dJ0AR`, depois da validação `0AfHZ00000R16a50AB` (51 testes) |
| **23/10 02:53 a 03:56** | Campanha completa da etapa 5 (484 RUNs), com o branch até o `753b1e272a`, e a reexecução do perfil RL e do EP do TC-021 depois de um ajuste no harness. 482 conformes. O espaço de dados foi de 133 MB livres para 112 MB livres de 200 | etapa 5; [relatório](resultado-runbook-etapa-5-2026-10-23.md) |

Fora do Apex e dos branches:

- **01/10:** o permission set `AcessoDeAPI` ganhou leitura de
  `Contact.DataHoraAtualizacaoEmailPendencia__c` (deploy
  `0AfHZ00000QaIsH0AV`, seção 1.1 do handoff).
- **20/10:** o outro trabalho também criou o objeto
  `VoucherDeslocamento__c`, o metadado `UberConfig__mdt`, a credencial
  `uber_voucher`, os flows `EditarCompromisso` e `FinalizarVisita` e o grupo
  público "ZZ QA Equipe Visita Uber", e implantou o perfil `Admin`.
- **20/10:** o usuário dono da sandbox passou para `en_US` e, por volta das
  23:40 UTC, voltou para `pt_BR` (seção 5).

## 4. O recorte da unificação, arquivo por arquivo

Saída do `versao-implantada.ts` de 20/10, com o checkout do
`com_salesforce_mrv` em `GV_909649_918914` (`b16d25c214`) e as refs do fetch
de 20/10, às 23:30 UTC.

### 4.1 O que a etapa 1 mudou: igual ao HEAD do branch

| Arquivo | Commits da etapa 1 | Na org desde |
|---|---|---|
| `LeadSelector` | `3109144d37` (cherry-pick do `dea0460ade`) | 20/10 23:45 |
| `NotificacaoMaquinaEstado` | `982131008f` (`fbd67a1216`), `3109144d37` (`dea0460ade`) e `9fd68521e8` (`9f0ba21f38`) | 20/10 23:45 |
| `NotificacaoPAC` | `6955c3a88d` (Perdido→`CANCELADA`) e `b16d25c214` (3h nas datas) | 20/10 23:45 (o conteúdo é o de 19/10, 03:21) |
| flow `PermutaCadastroCliente` (v15) | `5baf87b376` (`f2f34b48c5`, o `regionContainerType`) | 20/10 23:45 |

Os testes dessas classes (`LeadSelectorTest`, `NotificacaoMaquinaEstadoTest`
e `NotificacaoPACTest`) também estão iguais ao HEAD.

O script diz "nenhuma versão igual no git" para o flow. A causa é a ordem: a
org devolve os elementos do flow ordenados de outro jeito, e o script compara
linha a linha, na ordem. Ordenadas, as 4.435 linhas normalizadas são idênticas
às do HEAD (seção 7).

### 4.2 O resto: o que está no branch

**Iguais à ponta da 1.3:** `AccountRepository`, `AlteraLeadService`,
`ClienteSelector`, `ClienteService`, `Ges_LeadSelector`,
`LeadDeduplicationHandler`, `LeadDeduplicationUtils`, `LeadFilter`,
`LeadRepository`, `NotificacaoChatbot`, `NotificacaoCliente`, `PersonAccount`,
`VG_MSClienteCriarAtualizarInvocable`, o flow `AlterarDadosLead` (v17) e a
regra `Lead.PreencherEmailOuCelular`.

- Para o `AccountRepository`, o `ClienteSelector`, o `ClienteService` e o
  `NotificacaoCliente`, o script diz antes "2.2: não bate", e nos dois do
  meio também "2.1: não bate". É o esperado: esses branches mudaram os
  arquivos, e a dev tem a versão da 1.3.
- O `Ges_LeadSelector` e a regra `PreencherEmailOuCelular` são iguais nas
  pontas da 2.2 e da 1.3.

**Iguais à cópia de trabalho do checkout.** São arquivos que só a 2.2 ou a 2.1
mudaram. Como a 1.3 não os tocou, estão na versão do branch, sem nada da 2.2
nem da 2.1:

- 2.2: `ClienteTriggerHandler`, `ContestacaoSelector`, `GraphQLCreator`,
  `OportunidadeSelector`, `ProponenteSelector`, `ProponenteSelectorTeste`,
  `ProponenteTrigger`, `ProponenteTriggerHandler`,
  `PropostaAnaliseCreditoSelector` e o flow `Proponente_1` (v4);
- 2.1: `CpfCNPJ` e o LWC `iniciarJornadaLead` (html e js).

**Não existem na org:** `MSClienteService` e
`ReconciliacaoContatosLeadQueueable`, nem os testes delas nem o
`ProponenteTriggerHandlerTest`.

### 4.3 O que o script não cobre, conferido à parte

Conferido em 20/10 pela Tooling API e por retrieve, com a mesma normalização
do script:

- **Classes de teste:** as 23 implantadas em 18/10 e em 20/10 estão iguais ao
  HEAD. O script só olha o `ProponenteSelectorTeste`, que termina em "Teste".
- **`Email`, `EmailUtil` e `PesquisarContaController`:** iguais ao HEAD.
- **LWCs `campoFlow` e `validaEmail` e flow `CadastroParceiro` (v17):**
  iguais ao HEAD.
- **Aura `atualizaEmailContaAura`:** igual ao HEAD, menos uma linha. No
  `lightning:input` do e-mail, a org tem `type="Email"`, e o git tem
  `type="email"`. O deploy de 18/10 levou a versão do git, e o resto do
  componente bate. O harness não usa essa tela.

## 5. Testes Apex do ponto zero

As quatro classes da seção 3.1 do plano, em 20/10:

| Classe | Validação `0AfHZ00000QxPg90AF` e run `707HZ00001mNEbq` |
|---|---|
| `NotificacaoMaquinaEstadoTest` | 14 de 14 |
| `LeadSelectorTest` | 22 de 22 |
| `PesquisarContaControllerTest` | 28 de 28 |
| `NotificacaoPACTest` | 16 de 17 |

- **A falha:** o `erroRequisicaoTest`. A dev não tem registros no
  `Error_Response_Mapping__mdt`, responde 400, e o teste espera 500. Falha
  assim desde 26/09, com ou sem a etapa 1.
- **Cobertura:** `NotificacaoMaquinaEstado` 87%, `NotificacaoPAC` 81% e
  `LeadSelector` 92%.
- **Depende do idioma do usuário.** O setup do `NotificacaoMaquinaEstadoTest`
  procura o perfil "Administrador do sistema". O nome dos perfis padrão sai no
  idioma de quem roda o teste: em `en_US`, é "System Administrator", e os 14
  métodos quebram no `criarCupom` com `List has no rows`. Foi o que aconteceu
  na primeira validação de 20/10 (`0AfHZ00000QxPLB0A3`). A base tem 18
  classes de teste que procuram o perfil assim.

## 6. O que isso muda nos testes do simulador

- **O ponto zero é uma base nova.** Todas as campanhas da seção 2.2 rodaram
  na 2.2. A comparação com elas é célula a célula, contra o relatório de 12/10
  (plano, seção 1.3).
- **O que esperar:** a seção 3.5 do plano. Em resumo:
  - o `cliente-insert` de Y com o PROS-X sobrescreve a Account X;
  - não nasce Lead para Y;
  - o `refletirAlteracoesLead` da 1.3 copia tudo da Account para o Lead do
    prospect, inclusive o CPF.
- **PAC:**
  - o `pac-update` sobre PAC existente não lança mais `SObjectException`;
  - com a Opportunity em Perdido, a PAC fica `CANCELADA`, também no
    `pac-insert`;
  - as datas sem fuso entram em UTC, então o RC deve passar na data.
- **Lead:** o outro trabalho de 20/10 mudou o `LeadHelper` e o
  `GES_LeadTriggerHandler` (seção 3). Se o Lead mudar de comportamento na
  campanha, parte da diferença pode vir daí, e não da etapa 1.

## 7. Limitações

- **Escopo:** o script compara só os arquivos que os três branches mudaram
  desde a base com o `develop`. Classes de fora, como `NotificacaoPendencias`,
  `EventGrid` e `LeadHelper`, não entram. As classes de teste e alguns
  componentes ficam para a conferência à parte (seção 4.3).
- **Refs:** são as do último fetch do `com_salesforce_mrv`, de 20/10, às
  23:30 UTC.
- **O que a comparação ignora:**
  - em todos os arquivos: fim de linha, espaço no fim das linhas e espaço no
    começo e no fim do arquivo;
  - nos metadados XML: indentação, linhas vazias e o que o retrieve
    acrescenta e o repositório não guarda (estilo dos campos de tela,
    `nameSegment` e `areMetricsLoggedToDataCloud`).
- **Ordem dos elementos:** o script compara na ordem. Quando a org devolve os
  elementos de um flow em outra ordem, como no `PermutaCadastroCliente`, ele
  diz "não bate" mesmo com o conteúdo igual. Nesse caso, compare as linhas
  normalizadas ordenadas.
- **Versões sobrescritas:** o `LastModifiedDate` só guarda o último deploy de
  cada arquivo. Uma versão sobrescrita, como a das quatro classes entre 15:20
  e 21:28 de 27/09, não pode mais ser lida.
- **Flows:** nos quatro flows (`AlterarDadosLead`, `CadastroParceiro`,
  `PermutaCadastroCliente` e `Proponente_1`), a versão ativa é também a mais
  recente, que é a que o retrieve devolve.

## 8. Histórico

| Data | O que mudou na dev | Conferido |
|---|---|---|
| 27/09 | Leva das 15:20 e reversão das 21:28 a 21:31 (seções 2 e 3) | em 11/10, pelo script |
| 29/09 | `OwnBackup_*` às 06:33 e `LeadEventGrid*` às 17:04 | em 11/10, pelo script |
| 01/10 | Permission set `AcessoDeAPI` | handoff do bug 4, seção 1.1 |
| 07/10 | `ConsultarEstoqueLeadController` | em 11/10, pelo script |
| 11/10 | Primeira versão deste doc | `versao-implantada.ts` |
| 11/10 20:43 | As quatro classes revertidas voltam à ponta da 2.2 (deploy `0AfHZ00000QmDjx0AF`) | em 11/10, pelo script |
| 14/10 e 15/10 | `ConsultarEstoqueLeadController` de novo e `QueroVenderUpdate*` | em 20/10, pelo script |
| 18/10 01:51 a 02:09 | A dev passa à 1.3, e saem as 5 classes só da 2.2 (seção 3) | em 20/10, pelo script e pelo `DeployRequest` |
| 19/10 02:54 e 03:21 | `NotificacaoPAC` com os itens 4 e 5 da etapa 1 | em 20/10, pelo script |
| 20/10 01:11 a 23:28 | 27 deploys do trabalho da Uber, com mudanças em Lead | em 20/10, pelo `DeployRequest` |
| 20/10 23:46 | Ponto zero: a etapa 1 inteira (deploy `0AfHZ00000QxNw60AF`) | em 20/10, pelo script e à parte (seção 4.3) |
| 21/10 e 22/10 | Deploys do outro trabalho (SLA, deslocamento, list views) e o usuário de novo em `en_US` | em 22/10, pelo `DeployRequest` |
| 22/10 02:21 e 02:33 | Etapa 3 parcial, para validar a lacuna 3 (seção 3) | em 22/10, pelo `DeployRequest`; o retrato arquivo por arquivo não foi refeito |
| 22/10 02:59 | Lacuna 6, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 10:09 | Lacuna 4, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 10:27 | Lacuna 5, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 11:10 | Lacuna 7, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 11:26 | Lacuna 8, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 14:59 | R3, item 1, do working tree (seção 3) | em 22/10, pelo `DeployRequest`; antes, a dev conferida igual ao branch no `0d4d046b9d` |
| 22/10 19:03 | R3, item 2, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 19:38 | R3, item 3, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 21:26 | R3, item 5, do working tree (seção 3) | em 22/10, pelo `DeployRequest` |
| 22/10 22:16 a 22:40 | **Espaço de dados estourado e limpeza.** A dev chegou a 220 MB de 200 (110%) no fim da campanha da etapa 4, com 90.460 `LogIntegracao__c`. Foram apagados os 55.285 criados antes dos últimos 3 dias (de 29/05 a 19/10 01:38), pela Bulk API, sem hard delete (o usuário não tem a permissão "Bulk API Hard Delete"); ficam na lixeira por 15 dias. O espaço caiu para 150 MB (75%) | em 22/10, pelos limites da org e pela contagem dos logs |
| 22/10, depois da etapa 4 | **Segunda limpeza, a pedido do usuário (pelo menos 75% dos logs).** Apagados os 27.962 `LogIntegracao__c` criados antes de 22/10 21:00 UTC (79% dos 35.523), pela Bulk API, sem hard delete. Ficaram os 7.561 da campanha da etapa 4. O espaço caiu para 75 MB (38%) | em 22/10, pelos limites da org e pela contagem dos logs |
