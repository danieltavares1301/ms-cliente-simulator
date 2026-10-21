# Inventário dos commits da 2.2

Base para reescrever de forma enxuta a camada de identidade e contatos da
Unificação 2.2. Cobre os 47 commits sem merge do branch
`GV_918914_UnificPosAprovPAC` desde que ele se separou do `develop`
(`git log --no-merges a37928be3b..GV_918914_UnificPosAprovPAC`), de 22/12/2025
a 21/09/2026. Para cada commit:

- o que muda no código e o que corrige;
- se o harness do runbook cobre o comportamento corrigido;
- em que regra da versão enxuta ele cai;
- se a mudança sobrevive na ponta (`3f2919f5e7`).

O alvo da reescrita está no
[critério de aceite da Unificação 2.2](criterio-de-aceite-unificacao-2.2.md).

> **Como foi feito.** Em 11/10, lendo os diffs no `com_salesforce_mrv`, só com
> comandos git de leitura, e cruzando com os TCs e as verificações do harness
> (`scripts/runbook/`). "Harness" diz se algum dos 44 TCs, em algum dos 13
> perfis, afirma o comportamento corrigido; não diz se o TC passa. Os
> resultados das duas campanhas de 11/10 estão no
> [catálogo de bugs](bugs-pegos-pelo-runbook.md), e o que cada um dos cinco
> últimos commits mudou está na seção 2.1 do
> [estado da dev](estado-da-mrv-devDan.md). Em 18/10, o item 6 foi revisto
> com a planilha, a skill local `salesforce-unificacao-clientes` do
> `com_salesforce_mrv` e o branch `GV_909649_918914`, a partir da 1.3.

**Em resumo:** 35 dos 47 commits caem nas cinco regras da camada de identidade
e contatos. Quase todos tapam um efeito de confiar no prospect da jornada, que
nos eventos de Y é o de X. A exceção é o `c47170d879`: ele cria a busca por
IdCliente, CPF e prospect, que é a base da R1, e os remendos vêm em cima dele
(item 6). Seis ficam fora dessa camada, dois são robustez
genérica e quatro são só teste ou comentário. Nenhum foi removido depois: 22
foram alterados por commits seguintes, e alguns vão e voltam, como o reflexo
da Account para o Proponente. Dez commits corrigem comportamentos que o
harness não exercita (seção 5).

## 1. As regras da versão enxuta

| Regra | O que diz | O que substitui |
|---|---|---|
| R1 — Identidade | CPF, e IdCliente quando houver, decidem quem é a pessoa e qual Account, Lead e Opportunity são dela. O prospect só serve de dica para vincular o Lead, e só se a pessoa dele tiver o mesmo CPF ou nenhum | a busca e o match do pós-PAC, o IdProspect da Account, a escolha entre Accounts do mesmo CPF, a Account da Opportunity |
| R2 — PAC e Proponente | A PAC em análise é aceita. O Proponente guarda os dados da pessoa da PAC e fica sem Account quando o CPF não bate (o lookup `Proponente__c` é opcional). O vínculo vem na PAC aprovada ou quando a Account da pessoa aparece | `criarInstanciaProponente`, o `IdProponente__c`, as fontes de contato do Proponente, o reflexo da Account para o Proponente |
| R3 — Escrita de contato na Account | Um ponto único, usado pela pendência, pela contestação, pela sincronização pós-PAC e pelo `/Cliente`, confere o CPF ou o IdCliente da fonte com a Account e a data do evento | `sincronizarEmailContatoPendencia`, `sincronizarContatosContestacao`, `sincronizarContatosAprovadosPac`, `preencherContatosAprovados` |
| R4 — Escrita no Lead | Uma política única para criar, reutilizar e atualizar Lead: só grava em Lead com o mesmo CPF da Account, ou no candidato sem CPF; Lead reutilizado só recebe contato onde está vazio; contato que colide com outra pessoa nunca é gravado | o `insertLeadQueueable`, os quatro escopos do `refletirAlteracoesLead`, a `ReconciliacaoContatosLeadQueueable`, o nome do Lead |
| R5 — Prospect de outra pessoa | Num evento de cliente com prospect de outra pessoa (como a repetição do WebJob, com o da jornada), o prospect é ignorado: não roda de novo o `criarLeadDoCliente` nem troca vínculo | o descarte de eventos pelo prospect, o `criarLeadDoCliente` no `cliente-update` |
| fica | Fora da camada de identidade e contatos; pode ficar como está | StageName, dono e equipe da Opportunity, fila manual de jornadas antigas, regra de validação, callback do PROS-Y |
| infra | Robustez genérica; mantém | repetição de DML em `UNABLE_TO_LOCK_ROW` |
| teste | Só teste ou comentário | — |

Quando um commit mistura categorias, a regra é a principal, e a outra aparece
no detalhe (seção 4).

## 2. Resumo

| Regra | Commits | Quais |
|---|---:|---|
| R1 — Identidade | 13 | `3f4b3f0906`, `c47170d879`, `09dadb24bf`, `85e4c3ba5f`, `12182e7e78`, `fc7077f94d`, `de3731957d`, `da90427ced`, `4d54e3b7d9`, `1f6844e910`, `9210581ea5`, `7c86318a05`, `3f2919f5e7` |
| R2 — PAC e Proponente | 5 | `dcb966ddd9`, `b4be1623d2`, `7694d36312`, `d0e2635a70`, `542df3b1d1` |
| R3 — Escrita de contato na Account | 4 | `e505fcb93e`, `6612bab1b3`, `07608bac4a`, `70f3295319` |
| R4 — Escrita no Lead | 11 | `d914e60785`, `8b06b4cd2b`, `1195c8984b`, `509c87ad24`, `2eef5b7ba2`, `3029bcfb6d`, `af28349332`, `78a25da643`, `c04b6add92`, `d6f147d303`, `a6d1f4c64c` |
| R5 — Evento de cliente com prospect de outra pessoa | 2 | `b372038f43`, `0dd2e9a338` |
| fica — Fora da camada de identidade | 6 | `fbbde9da5c`, `fbd67a1216`, `ec9d1a6a7c`, `dea0460ade`, `a1eef12c11`, `9f0ba21f38` |
| infra — Robustez genérica | 2 | `fe1d5a610c`, `72cbd884f6` |
| teste — Só teste ou comentário | 4 | `1792eaa62d`, `c2cdf75672`, `68e7cfc856`, `8763dacaaa` |

Cobertura pelo harness: 18 sim, 16 em parte e 13 não.
Na ponta (`3f2919f5e7`): 25 sobrevivem, 22 foram alterados depois e 0 removidos.

## 3. Os commits

| # | Commit | Data | O que corrige | Harness | Regra | Na ponta |
|---:|---|---|---|---|---|---|
| 1 | [`3f4b3f0906`](#c1) | 22/12/25 | O `cliente-insert` de Y com o prospect de X achava X pelo prospect (`getClienteUnificacaoLead`) e a sobrescrevia com o IdCliente, o CPF e o nome de Y; Y ficava sem Account e sem Lead próprios. | sim | R1 | alterada depois |
| 2 | [`d914e60785`](#c2) | 03/02/26 | Com `3f4b3f0906`, X perdia o prospect e Y herdava o prospect e o Lead da jornada. Agora X fica intacta e Y ganha Lead próprio, novo ou reutilizado, sem os contatos do Lead original. | sim | R4 | alterada depois |
| 3 | [`dcb966ddd9`](#c3) | 03/02/26 | O mapeamento de `3f4b3f0906` lia campos que o DTO não tinha. Agora o celular da PAC chega ao `Proponente.Celular__c`, de onde o `insertLeadQueueable` tira o celular aprovado. | sim | R2 | alterada depois |
| 4 | [`fbbde9da5c`](#c4) | 03/02/26 | O Lead de Y criado sem contatos (porque todos colidem com o Lead original, ou porque a PAC não trouxe nenhum) era barrado pela validação, e o `insertLeadQueueable` falhava. | sim | fica | sobrevive |
| 5 | [`1792eaa62d`](#c5) | 06/02/26 | Dá cobertura de testes Apex a `d914e60785`; não muda comportamento. | não | teste | sobrevive |
| 6 | [`c47170d879`](#c6) | 08/07/26 | A busca antiga usava só o IdCliente e o prospect: a Account de Y só com CPF não era achada e nascia duplicada, e eventos com o IdCliente de Y caíam na Account X pelo prospect. | sim | R1 | alterada depois |
| 7 | [`c2cdf75672`](#c7) | 08/07/26 | Dá cobertura de testes Apex, no mesmo dia de `c47170d879`; não muda comportamento. | não | teste | sobrevive |
| 8 | [`09dadb24bf`](#c8) | 15/07/26 | Com a Account de Y já existente, o `cliente-insert` gravava nela o prospect de X (Y ficava ligada ao Lead X), e Y não ganhava Lead próprio. | sim | R1 | alterada depois |
| 9 | [`b372038f43`](#c9) | 23/07/26 | Contato, endereço e `cliente-update` de Y com o prospect de X caíam na Account X, achada pelo prospect, e sobrescreviam o `Id__c` e os contatos dela. Com Y já criada, podiam gravar nela o prospect de X. | sim | R5 | alterada depois |
| 10 | [`85e4c3ba5f`](#c10) | 24/07/26 | A Account de Y gravada com CPF formatado não era achada pelo CPF só com dígitos que o `getClientePosPac` monta, e o evento seguia como se Y não existisse. | em parte | R1 | alterada depois |
| 11 | [`8b06b4cd2b`](#c11) | 05/08/26 | No MATCH sem prospect na Account e no evento, o cliente-update da aprovação não ligava a Account ao Lead que já existia com o mesmo CPF. | em parte | R4 | alterada depois |
| 12 | [`0dd2e9a338`](#c12) | 10/08/26 | O cliente-update de Y que chegava com o prospect da jornada (de X) era descartado inteiro, e a Account Y ficava sem o Lead dela vinculado. | sim | R5 | sobrevive |
| 13 | [`12182e7e78`](#c13) | 11/08/26 | Um evento de jornada sem IdCliente, resolvido pelo prospect da jornada, levava de volta para X a Opportunity que já estava ligada a Y. | não | R1 | sobrevive |
| 14 | [`1195c8984b`](#c14) | 11/08/26 | A aprovação criava um segundo Lead do CPF Y quando o Lead Y já estava ligado à própria Account Y. | sim | R4 | sobrevive |
| 15 | [`fbd67a1216`](#c15) | 11/08/26 | Um evento de jornada fora de ordem, sem Account porque o match por prospect foi descartado, ia para a fila manual mesmo já tendo sido superado. | não | fica | sobrevive |
| 16 | [`fc7077f94d`](#c16) | 14/08/26 | No encerramento da Venda Genérica, a PAC que só trazia o IdCliente no `idProponente` não achava a Account e ia com erro para a fila do Event Grid. | não | R1 | sobrevive |
| 17 | [`de3731957d`](#c17) | 18/08/26 | Na Venda Genérica com cliente já existente, a Account ficava sem Lead e recebia como IdProspect o eco do próprio IdCliente. | em parte | R1 | sobrevive |
| 18 | [`509c87ad24`](#c18) | 21/08/26 | Lead de outro CPF achado por e-mail ou celular podia ser reusado e ter o CPF trocado, e, com os Leads do CPF presos a outra Account, nascia um duplicado. Lead reusado sem `Id__c` deixava a Account com IdProspect vazio. | sim | R4 | sobrevive |
| 19 | [`2eef5b7ba2`](#c19) | 21/08/26 | A colisão era conferida nos contatos do evento, que vinham vazios, enquanto o Lead novo recebia os do Proponente, e assim o Lead de Y herdava o e-mail de outro Lead. | sim | R4 | alterada depois |
| 20 | [`b4be1623d2`](#c20) | 21/08/26 | Depois da aprovação, o Proponente principal ficava com o prospect da jornada em vez do prospect do Lead de Y. | sim | R2 | alterada depois |
| 21 | [`e505fcb93e`](#c21) | 23/08/26 | A Account aprovada ficava sem os contatos aprovados quando eles colidiam com outro Lead ou no Caso C. | em parte | R3 | alterada depois |
| 22 | [`3029bcfb6d`](#c22) | 24/08/26 | O Lead livre sem CPF que compartilhava e-mail ou celular com o Lead da jornada não era achado no fallback, e nascia um Lead novo. | sim | R4 | sobrevive |
| 23 | [`fe1d5a610c`](#c23) | 24/08/26 | Um lock no Proponente fazia o savepoint desfazer o Lead criado e o vínculo da Account. | não | infra | sobrevive |
| 24 | [`ec9d1a6a7c`](#c24) | 26/08/26 | Eventos de jornadas antigas, com IdCliente obsoleto, iam para a fila manual depois do descarte de match da 2.2. | não | fica | alterada depois |
| 25 | [`af28349332`](#c25) | 26/08/26 | O Lead não recebia o nome da Account depois da aprovação. | em parte | R4 | alterada depois |
| 26 | [`dea0460ade`](#c26) | 26/08/26 | A Opportunity criada pela jornada ficava com o usuário padrão em vez do dono, da equipe e do gerente do Lead. | não | fica | sobrevive |
| 27 | [`7694d36312`](#c27) | 26/08/26 | O nome do Proponente não acompanhava o da Account. Apesar do título, não mexe no Lead. | em parte | R2 | alterada depois |
| 28 | [`d0e2635a70`](#c28) | 26/08/26 | O Proponente não acompanhava e-mail e celular vigentes da Account. Apesar do título, não mexe no Lead. | em parte | R2 | alterada depois |
| 29 | [`6612bab1b3`](#c29) | 27/08/26 | A contestação atualizava os contatos do Proponente, mas não os da Account vinculada. | em parte | R3 | alterada depois |
| 30 | [`542df3b1d1`](#c30) | 28/08/26 | O Lead novo de Y nascia com um celular diferente do aprovado, porque o Proponente ligado a uma Account de outro CPF guardava os contatos dela. Também evita `IdProponente__c` com prospect antigo quando a Account passa a PROS-Y em corrida com o Queueable. | sim | R2 | alterada depois |
| 31 | [`a1eef12c11`](#c31) | 28/08/26 | No `pac-update`, a `NotificacaoPAC` lia `Oportunidade__r.StageName` (regra Perdido→Cancelado) sem o campo na consulta, o que lança exceção e derruba o evento da PAC aprovada. | em parte | fica | sobrevive |
| 32 | [`07608bac4a`](#c32) | 30/08/26 | A PAC aprovada não levava à Account o e-mail e o celular aprovados; a pendência gravava pelo flow, com `Now()`, a cada update do Proponente, e a contestação mexia no Lead pelo prospect. Também troca a leitura de `Oportunidade__r.StageName` por `this.oportunidade`, que ainda é nulo nesse ponto. | sim | R3 | alterada depois |
| 33 | [`78a25da643`](#c33) | 31/08/26 | Updates técnicos do pós-PAC e eventos de contato refletiam a Account inteira no Lead (E/F do Lead Y trocados, Lead de outra pessoa alterado), e o contato que chegava antes do vínculo PROS-Y não chegava ao Lead. O `criarLeadDoCliente` lia os contatos aprovados só pelo prospect do evento. | sim | R4 | alterada depois |
| 34 | [`da90427ced`](#c34) | 31/08/26 | Sem sintoma no título. Traz da 2.1 a busca por CPF em vários formatos e a unificação Lead→Account que não atualiza Account com IdCliente achada só pelo prospect. | em parte | R1 | sobrevive |
| 35 | [`68e7cfc856`](#c35) | 31/08/26 | Nenhum sintoma; é limpeza. | em parte | teste | sobrevive |
| 36 | [`4d54e3b7d9`](#c36) | 01/09/26 | Depois da PAC aprovada de Y, a Opportunity seguia na Account de X até chegar um evento de máquina, que a Venda Genérica pode não ter. | sim | R1 | sobrevive |
| 37 | [`70f3295319`](#c37) | 01/09/26 | Um contato-* da jornada com data mais nova que a PAC aprovada impedia os contatos aprovados de chegar à Account e ao Proponente. | em parte | R3 | alterada depois |
| 38 | [`9f0ba21f38`](#c38) | 03/09/26 | Uma jornada de Venda Genérica com estado sem fase mapeada gravava StageName vazio; a Opportunity falhava por campo obrigatório e o evento ia para a fila manual. | não | fica | sobrevive |
| 39 | [`c04b6add92`](#c39) | 03/09/26 | Caso Clarice (staging, 02/09): após a PAC aprovada, a Account Y tinha os contatos aprovados e o Lead Y o contato velho com que o Queueable o criou. Corrige também a data da PAC, gravada 3h atrás. | em parte | R4 | alterada depois |
| 40 | [`d6f147d303`](#c40) | 04/09/26 | A `POS_PAC_APROVADA` do c04b6add92 trocava pelos aprovados os contatos próprios do Lead Y reutilizado (TCs 019, 022 e 047 nos testes Apex). | sim | R4 | sobrevive |
| 41 | [`a6d1f4c64c`](#c41) | 08/09/26 | A `POS_PAC_APROVADA` podia gravar no Lead Y um e-mail ou celular que já é de outro Lead. | em parte | R4 | sobrevive |
| 42 | [`8763dacaaa`](#c42) | 08/09/26 | Nada; não muda comportamento. | não | teste | sobrevive |
| 43 | [`1f6844e910`](#c43) | 08/09/26 | Bug 4 de staging: a Account X mudava na aprovação da PAC de Y com CPF divergente. O commit mira os parciais do `/Cliente`, mas o efeito medido vem do descarte por CPF na `NotificacaoPAC`, que passa a recusar a PAC em análise de Y sem IdCliente até Y existir. | em parte | R1 | alterada depois |
| 44 | [`72cbd884f6`](#c44) | 09/09/26 | O Lead novo de Y era desfeito pelo rollback do savepoint quando o update da Account batia em `UNABLE_TO_LOCK_ROW` (relato de staging). | não | infra | sobrevive |
| 45 | [`9210581ea5`](#c45) | 09/09/26 | Regressão do 1f6844e910: jornada (e PAC) sem IdCliente e sem CPF perdia o match pelo prospect e ia para a fila manual com 'Cliente(Account) não encontrado'. | não | R1 | sobrevive |
| 46 | [`7c86318a05`](#c46) | 10/09/26 | Depois do 9210581ea5, essa jornada tinha o match descartado e ia para a fila manual, mesmo com a Opportunity já na Account do prospect, porque o vínculo histórico não via o CPF. | não | R1 | sobrevive |
| 47 | [`3f2919f5e7`](#c47) | 21/09/26 | Falso positivo do guard do 1f6844e910: bastava existir, em qualquer Account, um Proponente principal aprovado de outro IdCliente para descartar `contato-update` e `endereco-update` legítimos. | em parte | R1 | sobrevive |

## 4. Detalhe por commit

<a id="c1"></a>

### 1. `3f4b3f0906` — Ajusta Criação Cliente Aprovação PAC

- **Data e arquivos:** 22/12/2025; `NotificacaoCliente`, `NotificacaoPAC`, `ProponenteSelector`.
- **Mudança:** No `cliente-insert` que acha pelo prospect uma Account de outro IdCliente, troca por um GUID novo o IdProspect dessa Account e o `Id__c` do Lead dela, cria a Account de Y com o prospect da jornada e enfileira `insereLeadQueueable`, que cria o Lead de Y com esse prospect. Na `NotificacaoPAC`, passa a gravar `Celular__c` e `Telefone__c` no Proponente.
- **Corrige:** O `cliente-insert` de Y com o prospect de X achava X pelo prospect (`getClienteUnificacaoLead`) e a sobrescrevia com o IdCliente, o CPF e o nome de Y; Y ficava sem Account e sem Lead próprios.
- **Harness (sim):** Os TCs de Y inexistente com `cliente-insert` (001, 002, 016 a 018, 041 a 043, 054, 057) afirmam `contaNova` e X intacta, e a troca de GUID deste commit reprovaria `Account X intacta` e `Lead X intacto`. No catálogo da API, `cliente-insert-prospect-divergente`.
- **Regra R1:** Usa o IdCliente para recusar a Account achada pelo prospect (R1). A troca de GUID em X e o Lead de Y com o prospect da jornada contrariam R1 e R4 e já saíram; o `Celular__c` do Proponente é R2.
- **Na ponta (alterada depois):** A troca de GUID, o `insereLeadQueueable` e o prospect da jornada na Account nova saíram em `d914e60785`. Ficam a flag `criarLeadDoCliente` e o `Proponente.Celular__c`, hoje pela política de `07608bac4a`.
- **Relação:** `d914e60785` substitui o mecanismo, e `dcb966ddd9` conserta o DTO, que não tinha `telefoneCelular` nem `telefoneResidencial`. A flag `criarLeadDoCliente` nasce aqui; rodá-la de novo na repetição do WebJob é o B6.

<a id="c2"></a>

### 2. `d914e60785` — Ajusta Criação Cliente Após Aprov PAC

- **Data e arquivos:** 03/02/2026; `NotificacaoCliente`, `MSClienteService`, `ProponenteSelector`, `LeadSelector`, `Ges_LeadSelector`, `GraphQLCreator`.
- **Mudança:** Tira a troca de GUID: no `cliente-insert` com match pelo prospect de outro IdCliente, cria a Account de Y e enfileira `insertLeadQueueable`. Esse job lê o celular e o e-mail do Proponente achado pelo prospect (`getProponenteByIdProponente`), reutiliza um Lead livre por CPF, e-mail ou celular (fora o original e os ligados a uma Account) ou cria um novo (GUID; `InsertClientePAC` sem contatos), grava o vínculo na Account e chama `MSClienteService.atualizarCliente` (via `callMSClienteFuture`) para levar o prospect novo ao MS Clientes.
- **Corrige:** Com `3f4b3f0906`, X perdia o prospect e Y herdava o prospect e o Lead da jornada. Agora X fica intacta e Y ganha Lead próprio, novo ou reutilizado, sem os contatos do Lead original.
- **Harness (sim):** `leadNovo`/`leadSoCpf` em 22 TCs (ex.: 001, 002, 010, 017), `leadReutilizado` em 15 TCs de CPF divergente (ex.: 006, 012, 019, 045) e Leads presos preservados (024, 026, 027, 048), sempre com `vinculo` e X intacta. O callback `atualizarCliente` só é conferido pela ausência de erro em log e job; o catálogo o testa em `graphql-erro-500`, `graphql-resposta-invalida` e `graphql-timeout`.
- **Regra R4:** É a criação e o reuso do Lead de Y (R4); na reescrita, a política única faz isso uma vez, com os contatos da PAC de Y achada por CPF/IdCliente, e não do Proponente achado pelo prospect (R1/R3). O callback `atualizarCliente` é `fica`.
- **Na ponta (alterada depois):** O `insertLeadQueueable` foi reescrito por `1195c8984b`, `509c87ad24`, `3029bcfb6d`, `e505fcb93e`, `78a25da643` e outros. `MSClienteService`, `callMSClienteFuture`, `getProponenteByIdProponente` e `retornarLeadMaisRepresentativo` seguem iguais.
- **Relação:** Substitui a troca de GUID de `3f4b3f0906` e depende de `dcb966ddd9` e de `fbbde9da5c`. A leitura do Proponente pelo prospect (hoje um fallback) é o passo 1 do B9 e a causa do K2 com os commits; o ramo de reuso que preenche contato vazio sem checar colisão (hoje o do mesmo CPF) é por onde a reexecução do B6 grava contatos de X ou Z no Lead de Y.

<a id="c3"></a>

### 3. `dcb966ddd9` — Ajusta Celular PAC

- **Data e arquivos:** 03/02/2026; `NotificacaoPAC`.
- **Mudança:** Acrescenta `telefoneCelular` ao DTO `Proponente` da PAC e tira a atribuição de `Telefone__c`, que lia `telefoneResidencial`, campo que o DTO não tem.
- **Corrige:** O mapeamento de `3f4b3f0906` lia campos que o DTO não tinha. Agora o celular da PAC chega ao `Proponente.Celular__c`, de onde o `insertLeadQueueable` tira o celular aprovado.
- **Harness (sim):** Toda PAC do harness manda `telefoneCelular` e, com os parciais descartados, o celular aprovado só chega ao Lead novo (`leadNovo` com D em 002, 005, 010, 014, 015, 018, 020, 021, 042) e à Account (`contaComContatos` no 019) pelo Proponente. A asserção do Proponente confere só o CPF e o e-mail.
- **Regra R2:** É o mapeamento PAC→Proponente: o Proponente guarda os dados da pessoa da PAC (R2). Na reescrita, o celular fica no Proponente e só vai à Account pelo ponto único de R3.
- **Na ponta (alterada depois):** O `telefoneCelular` do DTO segue; a atribuição direta virou `resolverContatoVigenteProponente` (`d0e2635a70`) e depois `escolherContatoConformePolitica` (`07608bac4a`). `Telefone__c` continua sem mapeamento.
- **Relação:** Conserta `3f4b3f0906`; `0ee6d92b81` (13/02, outro autor) fez a mesma mudança em paralelo. É o celular que o `insertLeadQueueable` lê do Proponente (B9, K2).

<a id="c4"></a>

### 4. `fbbde9da5c` — Ajusta Fórmula Lead

- **Data e arquivos:** 03/02/2026; `Lead.PreencherEmailOuCelular (regra de validação)`.
- **Mudança:** A regra `PreencherEmailOuCelular` do Lead deixa de exigir e-mail ou celular quando `DescricaoOrigem__c = 'InsertClientePAC'`.
- **Corrige:** O Lead de Y criado sem contatos (porque todos colidem com o Lead original, ou porque a PAC não trouxe nenhum) era barrado pela validação, e o `insertLeadQueueable` falhava.
- **Harness (sim):** `leadSoCpf` afirma Lead novo sem e-mail, sem celular e com origem `InsertClientePAC` em 001, 007, 016, 041 e 057. Os TCs 025, 038 e 054 afirmam Lead novo sem contatos.
- **Regra fica:** É uma regra de validação, fora da camada de identidade. A política de R4 continua criando Lead sem o contato que colide e precisa dessa exceção.
- **Na ponta (sobrevive):** A fórmula na ponta é a deste commit.
- **Relação:** Par de `d914e60785`, que marca `InsertClientePAC` no Lead sem contatos.

<a id="c5"></a>

### 5. `1792eaa62d` — Ajusta Classes Testes Criação Cliente PAC

- **Data e arquivos:** 06/02/2026; `NotificacaoClienteTest`, `MSClienteServiceTest`, `Ges_LeadSelectorTest`, `GraphQLCreatorTest`, `LeadSelectorTest`, `ProponenteSelectorTeste`.
- **Mudança:** Testa o `insertLeadQueueable` (Lead novo; Lead existente achado pelo e-mail), o `MSClienteService` com mock do `atualizarCliente`, os seletores e o `GraphQLCreator` alterados em `d914e60785`.
- **Corrige:** Dá cobertura de testes Apex a `d914e60785`; não muda comportamento.
- **Harness (não):** Só testes Apex.
- **Regra teste:** Só teste; na reescrita, refazer junto com a política de R4.
- **Na ponta (sobrevive):** Os dois testes do `insertLeadQueueable` e o `MSClienteServiceTest` seguem iguais; `LeadSelectorTest` e `ProponenteSelectorTeste` ganharam casos depois.
- **Relação:** Testes de `d914e60785`.

<a id="c6"></a>

### 6. `c47170d879` — pesquisa por CPF e pesquisa defensiva de Id Prospect no pós-PAC

- **Data e arquivos:** 08/07/2026; `ClienteService`, `ClienteSelector`, `NotificacaoCliente`, `NotificacaoMaquinaEstado`, `NotificacaoPAC`.
- **Antes do commit:** As três entradas do pós-PAC (`/Cliente`, `criarInstanciaProponente` da PAC e máquina) achavam a Account pelo `getClienteUnificacaoLead`, com o IdCliente e o prospect no mesmo conjunto e numa só consulta (`Id__c IN :set OR IdProspectSalesforce__c IN :set`, linha 192 do `ClienteSelector` do pai). CPF, celular, e-mail e telefone iam como `null` (linhas 545 e 552 do `ClienteService` da 1.3). E-mail e celular nunca entraram na busca de Account do pós-PAC.
- **Mudança:** Cria `getClientePosPac` e `deveDescartarMatchPosPac`, que entram no lugar do `getClienteUnificacaoLead` no `/Cliente`, na `criarInstanciaProponente` e na máquina.
  - **`getClientePosPac`:** busca o IdCliente só em `Id__c`, depois o CPF só com dígitos em `CPF__pc`, depois o prospect só em `IdProspectSalesforce__c`. Em cada busca, fica com a Account mais recente e devolve o `matchedVia`. Na máquina, o CPF vem do `proponentecredito` do payload (`obterCpfProponentePorIdCliente`).
  - **`deveDescartarMatchPosPac`:** descarta o match pelo prospect quando o IdCliente do evento difere do `Id__c` preenchido da Account. No `/Cliente`, substitui o descarte do `3f4b3f0906` e continua só no `cliente-insert`. Na PAC e na máquina, o descarte é novo.
- **Corrige:** A busca antiga usava só o IdCliente e o prospect: a Account de Y só com CPF não era achada e nascia duplicada, e eventos com o IdCliente de Y caíam na Account X pelo prospect.
- **Harness (sim):** A Account Y só com CPF é achada e reutilizada em 009, 020, 022, 024, 025 e 027 (`contaReutilizada`, `contaComIdCliente`, `contasDoCpf`); o 038 afirma a prioridade do IdCliente, o 014 e o 015 a caixa, e o catálogo tem `match-cpf-sem-id-cliente`. O CPF da máquina não roda, porque a `jornadausuario-update` do harness não traz `proponentecredito`.
- **Regra R1:** O commit tem duas partes.
  - **A busca em cascata é a base da R1 e fica na reescrita.** Ela tem cada chave no seu campo e inclui o CPF. Não é remendo.
  - **O `deveDescartarMatchPosPac` é proteção parcial.** Só olha o IdCliente e deixa passar três casos: a Account X sem `Id__c`, o evento sem IdCliente e o CPF divergente. No `/Cliente`, só vale no `cliente-insert`. Na reescrita, ele dá lugar à conferência de CPF e IdCliente um contra o outro, e o prospect nunca acha a Account de outra pessoa.
- **Na ponta (alterada depois):**
  - O `getClientePosPac` ganhou o prospect tratado como IdCliente (`fc7077f94d`).
  - O `obterClientePorCPF` passou a casar o CPF com máscara: primeiro pela fórmula (`85e4c3ba5f`), depois pela expansão de formatos (`da90427ced`).
  - O `deveDescartarMatchPosPac` ganhou o CPF (`1f6844e910`, `9210581ea5`).
  - Na máquina, o CPF ganhou fallback pelo idProponente (`9210581ea5`).
- **Relação:**
  - **Regressão na Venda Genérica:** ao separar os campos, o commit perde um caso que a consulta antiga cobria. A PAC de encerramento que traz o IdCliente só no `idProponente` passa a cair no erro da `criarInstanciaProponente`. O [`fc7077f94d`](#c16) restaura o caso.
  - **B1, B3 e B8:** como não confere o CPF da Account achada por IdCliente ou prospect, o commit deixa o B1. Sem IdCliente, a PAC em análise acha X pelo prospect; com o IdCliente de X, acha X. A escolha da mais recente entre Accounts do mesmo CPF dá o B3. O CPF só entra no descarte com o `1f6844e910`, que gera o B8.
  - **Testes:** o `realizaPostDescartaMatchPorIdProspectDivergenteTest` exige 0 Proponente quando o match é descartado. Ou seja, trava o comportamento do B8, contraria a R2 e precisa mudar com ela. O `erroRequisicaoTest` troca `== 500` por `>= 400`, o que só afrouxa a checagem.
  - **Prospect gravado em Y:** o `preencherAtributosAccount` já gravava o prospect do evento no IdProspect vazio da Account achada. Quando a Account Y passa a ser achada pelo CPF, ela recebe o prospect de X. O [`09dadb24bf`](#c8) trata isso.
- **E-mail e celular:**
  - **No código:** quem os tirou da busca de Account foi o Iniciar Jornada, antes da PAC: na 2.1, o `b60c6ae4b9`; na 2.2, o `da90427ced`. Eles seguem na busca de Account da `NotificacaoLead` e na busca de Lead.
  - **Na planilha:** os dois servem para achar Lead sem CPF (TCs 012, 013, 045, 046 e 049) e, no 050, Account. O que ela manda é desconsiderar os Leads achados só por contato quando há Lead com o CPF (034, 035, 055 e 056).
  - **Ordem de busca:** a planilha não escreve uma. Ela acha a Account pelo IdCliente e pelo CPF, e o IdProspect é só o vínculo a gravar. A ordem IdCliente, CPF e prospect está na skill local `salesforce-unificacao-clientes` (27/08), que descreve este commit.
- **Na 1.3:**
  - **O código já está lá, sem uso.** O `6af00f4bc3` (13/07) copiou os seletores, o serviço e os testes deste commit, já com o filtro `CPFSemFormatacao__c`, que a 2.2 só ganhou no `85e4c3ba5f`. O `539bcbfa73` corrigiu dois erros de compilação da cópia. Na 1.3, o `NotificacaoCliente` (linha 65), a `NotificacaoPAC` (517) e a `NotificacaoMaquinaEstado` (40) ainda chamam o `getClienteUnificacaoLead`.
  - **O que o commit traz:** num branch a partir da 1.3, só a ligação nessas três classes, mais o `obterCpfProponentePorIdCliente`.
  - **Conflitos no cherry-pick:**
    - `ClienteSelector`: ficar com o `OR CPFSemFormatacao__c` da base.
    - `NotificacaoCliente`: ficar com o bloco do commit, sem o `this.criarLeadDoCliente = true;`, porque a base não tem esse campo.

<a id="c7"></a>

### 7. `c2cdf75672` — Ajuste em classe de testes

- **Data e arquivos:** 08/07/2026; `NotificacaoPACTest`.
- **Mudança:** Acrescenta dois testes na `NotificacaoPACTest`: o `pac-update` em análise, que passa pelo `resolverContestacao`, e a PAC com cliente relacionado (`configurarIdProponenteDeAcordoComClienteRelacionado`). Os dois só conferem o HTTP 200.
- **Corrige:** Dá cobertura de testes Apex, no mesmo dia de `c47170d879`; não muda comportamento.
- **Harness (não):** Só testes Apex.
- **Regra teste:** Só teste, sem asserção de identidade ou de contato.
- **Na ponta (sobrevive):** Os dois testes seguem iguais.
- **Relação:** Acompanha `c47170d879`.

<a id="c8"></a>

### 8. `09dadb24bf` — Novo Lead não é criado após aprovação de PAC com CPF divergente

- **Data e arquivos:** 15/07/2026; `ClienteService`, `NotificacaoCliente`.
- **Mudança:** Cria `prospectPertenceAOutraConta`, que diz se o prospect do evento é o IdProspect de outra Account. No `cliente-insert` que achou Y por IdCliente ou CPF, liga `criarLeadDoCliente` e `prospectDivergente`, e este impede copiar o prospect da jornada para o IdProspect vazio da Account Y.
- **Corrige:** Com a Account de Y já existente, o `cliente-insert` gravava nela o prospect de X (Y ficava ligada ao Lead X), e Y não ganhava Lead próprio.
- **Harness (sim):** Os `cliente-insert` com a Account Y achada por CPF (009, 020, 022, 024, 025, 027) afirmam `vinculo` com um Lead de Y novo ou reutilizado, X intacta e, no Caso C (024, 027), `contaSemProspect`. Os `cliente-update` com Account Y (005 a 007, 010, 011, 014, 015, 019, 021, 026, 038) só passam por aqui desde `0dd2e9a338`.
- **Regra R1:** Trata o IdProspect da Account e o prospect de outra pessoa, que o R1 lista. Na reescrita, o prospect só liga Lead se a pessoa dele tiver o mesmo CPF ou nenhum, e disparar `criarLeadDoCliente` a cada evento com esse prospect contraria R5.
- **Na ponta (alterada depois):** `prospectPertenceAOutraConta` segue igual; vale para todo evento desde `b372038f43` e cria Lead também no `cliente-update` desde `0dd2e9a338`. A guarda `prospectDivergente` do `preencherAtributosAccount` ganhou condições em `de3731957d` e `78a25da643`.
- **Relação:** Com `b372038f43`, vira o descarte dos 1.515 parciais. Com `0dd2e9a338`, a repetição do WebJob (`cliente-update` com o prospect da jornada) roda de novo o `criarLeadDoCliente` (B6).

<a id="c9"></a>

### 9. `b372038f43` — [GV] - Sobrescrita de Account/Lead ao aprovar PAC com CPF divergente do lead original

- **Data e arquivos:** 23/07/2026; `NotificacaoCliente`.
- **Mudança:** Estende `deveDescartarMatchPosPac` e `prospectPertenceAOutraConta` a todos os eventos do `/Cliente`. Fora do `cliente-insert`, liga `descartarEvento`, e o `executar` retorna sem DML.
- **Corrige:** Contato, endereço e `cliente-update` de Y com o prospect de X caíam na Account X, achada pelo prospect, e sobrescreviam o `Id__c` e os contatos dela. Com Y já criada, podiam gravar nela o prospect de X.
- **Harness (sim):** O perfil PA afirma `Account X intacta depois dos parciais` e `nenhuma Account/Lead criada pelos parciais`; o EP afirma que o parcial atrasado não troca o prospect nem cria registros, e o catálogo tem `cpf-divergente-contato-primeiro`. A perda do contato legítimo de Y não é afirmada, porque a PAC aprovada a corrige antes do estado final.
- **Regra R5:** Trata o evento com prospect de outra pessoa (R5), mas descarta o evento inteiro em vez de ignorar só o prospect. Na reescrita, o parcial de Y vai à Account achada por IdCliente (R1), pelo ponto único de R3.
- **Na ponta (alterada depois):** O retorno antecipado do `executar` segue. `0dd2e9a338` tira o `cliente-update` do descarte, e `1f6844e910` passa o CPF ao descarte e soma o guard `validarIdentidadePayloadParcialContraAccount` (ajustado em `3f2919f5e7`).
- **Relação:** É o caminho dos 1.515 descartes por `prospectPertenceAOutraConta` e dos 100 por `deveDescartarMatchPosPac`; sem os parciais, a Account Y fica com os contatos lidos do Proponente até a PAC aprovada (passo 2 do B9). Descartar o `cliente-update` deixava a Account Y existente sem Lead, o que `0dd2e9a338` desfez, e o K1 é o parcial sem prospect, que escapa do descarte e volta 400.

<a id="c10"></a>

### 10. `85e4c3ba5f` — Novo Lead não é criado após aprovação de PAC com CPF divergente

- **Data e arquivos:** 24/07/2026; `ClienteSelector`, `LeadSelector`.
- **Mudança:** `obterClientePorCPF` passa a casar também `CPFSemFormatacao__c`, a fórmula do CPF sem pontuação. No `LeadSelector`, só muda a ordem dos campos.
- **Corrige:** A Account de Y gravada com CPF formatado não era achada pelo CPF só com dígitos que o `getClientePosPac` monta, e o evento seguia como se Y não existisse.
- **Harness (em parte):** A busca por CPF roda nos TCs com Account Y só com CPF (009, 020, 022, 024, 025, 027), mas a massa, os eventos e o catálogo usam CPF só com dígitos. O caso do CPF formatado não é exercitado.
- **Regra R1:** É a busca por CPF de R1. Na reescrita, comparar o CPF normalizado dos dois lados, sem filtrar por fórmula, que não é seletiva.
- **Na ponta (alterada depois):** `da90427ced` trocou o filtro pela fórmula `CPFSemFormatacao__c` por `CpfCNPJ.expandirFormatosCPF` sobre `CPF__pc`. A troca de ordem no `LeadSelector` não muda comportamento e segue, já com campos novos.
- **Relação:** Complementa a busca por CPF de `c47170d879`. Na 1.3, o `6af00f4bc3` já tinha esse filtro desde 13/07, 11 dias antes.

<a id="c11"></a>

### 11. `8b06b4cd2b` — Lead existente não é vinculado à Account após atualização de cliente na aprovação da PAC

- **Data e arquivos:** 05/08/2026; `NotificacaoCliente`.
- **Mudança:** Cria a flag `vincularLeadExistente`, ligada no cliente-insert/update de Account sem IdProspect quando o evento também vem sem prospect. Ela enfileira a `insertLeadQueueable` só para vincular (`permitirCriacaoLead` falso), e a Queueable passa a aceitar prospect vazio ou 'null', a não quebrar sem Lead original e a buscar o CPF também só com dígitos.
- **Corrige:** No MATCH sem prospect na Account e no evento, o cliente-update da aprovação não ligava a Account ao Lead que já existia com o mesmo CPF.
- **Harness (em parte):** O caminho roda no TC-062 e no eco sem prospect do TC-040 e dos Caso C (024, 027 e 048), que afirmam Lead novo vinculado ou Account sem prospect. Nenhum TC tem o caso do título: Lead Y livre já existente, Account Y sem prospect e eventos sem prospect.
- **Regra R4:** Vincula Lead pelo CPF, o que é R4, mas só quando falta prospect, um critério que a R1 descarta. Na reescrita, o vínculo parte do CPF/IdCliente pela política única da R4, com ou sem prospect no evento.
- **Na ponta (alterada depois):** A flag e o disparo continuam lá (linhas 90 e 260), mas o de3731957d passou a criar Lead nesse caminho. A Queueable foi reescrita pelo 509c87ad24 e pelo 78a25da643.
- **Relação:** Par do 0dd2e9a338, que tem o mesmo título. Junto com o de3731957d, é por aqui que entram as duas criações do B7 (TC-040, FW).

<a id="c12"></a>

### 12. `0dd2e9a338` — Lead existente não é vinculado à Account após atualização de cliente na aprovação da PAC

- **Data e arquivos:** 10/08/2026; `NotificacaoCliente`.
- **Mudança:** No `getSObjectExistente`, o cliente-update passa a ser tratado como o cliente-insert quando o match por prospect é descartado (`deveDescartarMatchPosPac`) ou o prospect é de outra conta (`prospectPertenceAOutraConta`). Nesses casos ele liga `criarLeadDoCliente` em vez de descartar o evento.
- **Corrige:** O cliente-update de Y que chegava com o prospect da jornada (de X) era descartado inteiro, e a Account Y ficava sem o Lead dela vinculado.
- **Harness (sim):** Os TCs de cliente-update de Y com o prospect de X afirmam Lead novo ou reutilizado e vinculado: 005 a 007, 010 a 015, 019, 021, 026, 038 e 053. O ramo de Y inexistente com cliente-update não roda, porque o harness manda cliente-insert, e o eco sem prospect também levaria ao vínculo, então a asserção não isola este commit.
- **Regra R5:** Responde ao evento de cliente com prospect de outra pessoa rodando o `criarLeadDoCliente`, o que a R5 proíbe na repetição. Na reescrita, o cliente-update ignora o prospect de outra pessoa, e o Lead de Y é vinculado uma vez só, pela R4.
- **Na ponta (sobrevive):** Os dois `eventTypeClientInsertOrClientUpdate()` continuam nas linhas 76 e 84. Só a chamada do `deveDescartarMatchPosPac` mudou, ganhando o CPF no 1f6844e910.
- **Relação:** Par do 8b06b4cd2b. Abre caminho para o B6, porque a repetição do WebJob com o prospect da jornada roda de novo o `criarLeadDoCliente`, e para a corrida de Leads órfãos do diagnóstico dos commits 3 e 4.

<a id="c13"></a>

### 13. `12182e7e78` — Oportunidade permanece vinculada ao cliente da jornada (CPF X) em vez do cliente aprovado na PAC (CPF Y)

- **Data e arquivos:** 11/08/2026; `ClienteService`, `NotificacaoMaquinaEstado`, `OportunidadeSelector`.
- **Mudança:** Cria o `ClienteService.deveManterOportunidadeNaContaAprovada`: num jornadausuario-* sem idCliente, resolvido só pelo prospect, a Opportunity fica na Account atual se essa Account tem IdCliente. O `OportunidadeSelector` passa a trazer `Account.Id__c` e `Account.IdProspectSalesforce__c`.
- **Corrige:** Um evento de jornada sem IdCliente, resolvido pelo prospect da jornada, levava de volta para X a Opportunity que já estava ligada a Y.
- **Harness (não):** A máquina do harness sempre leva o IdCliente de Y e casa por ID_CLIENTE, então o guard sai cedo, e a asserção 'Opportunity na Account aprovada' não passa por ele. O cenário de catálogo `e2e-opportunity-permanece-conta-aprovada` cobre esse caminho.
- **Regra R1:** Decide a Account da Opportunity, o que é R1, e trata como aprovada qualquer Account com IdCliente, condição que X também cumpre. Na reescrita, a Account vem do CPF/IdCliente da PAC aprovada, e evento de jornada sem IdCliente não troca a Account.
- **Na ponta (sobrevive):** O método (`ClienteService`, linha 1499) e a chamada (`NotificacaoMaquinaEstado`, linha 95) estão intactos.
- **Relação:** Completado pelo 9210581ea5, que leva o CPF do Proponente para a busca da máquina, e pelo 7c86318a05, que trata o vínculo histórico. Nenhum bug do catálogo passa por ele.

<a id="c14"></a>

### 14. `1195c8984b` — Aprovação da PAC cria novo lead com CPF já existente em vez de reutilizar lead/account existente

- **Data e arquivos:** 11/08/2026; `NotificacaoCliente`, `AccountRepository`.
- **Mudança:** Na `insertLeadQueueable`, o filtro deixava de fora todo Lead que já era prospect de alguma Account. Agora deixa de fora só o Lead preso a outra Account, usando o novo `AccountRepository.findProspectIdToAccountId`.
- **Corrige:** A aprovação criava um segundo Lead do CPF Y quando o Lead Y já estava ligado à própria Account Y.
- **Harness (sim):** O TC-053 (Account e Lead Y já ligados, cliente-update com o prospect de X) afirma que o Lead Y é reutilizado e que só há 1 Lead do CPF. No FW, a asserção de que a repetição não cria Lead também depende dele.
- **Regra R4:** É regra de reuso de Lead por CPF. Na reescrita, a política única reusa o Lead do mesmo CPF que esteja livre ou já ligado à própria Account, e nunca o preso a outra.
- **Na ponta (sobrevive):** O `findProspectIdToAccountId` e o teste `contaDoProspect != this.idCliente` continuam (linhas 915, 922 e 959), dentro dos laços que o 509c87ad24 reescreveu.
- **Relação:** Base do 509c87ad24. Na repetição do FW, é ele que faz o Lead Y ser reaproveitado, e o preenchimento dos campos vazios nesse reuso é o B6.

<a id="c15"></a>

### 15. `fbd67a1216` — Jornada é direcionada para fila manual

- **Data e arquivos:** 11/08/2026; `NotificacaoMaquinaEstado`.
- **Mudança:** Quando não acha a Account, o `NotificacaoMaquinaEstado` responde 200 e ignora o jornadausuario-* mais antigo que a Opportunity existente, comparando o EventTime (`deveIgnorarEventoObsoletoSemCliente`). Se o evento é atual, a exceção continua, para o Event Grid entregar de novo.
- **Corrige:** Um evento de jornada fora de ordem, sem Account porque o match por prospect foi descartado, ia para a fila manual mesmo já tendo sido superado.
- **Harness (não):** A máquina do harness leva o IdCliente de Y, sempre acha a Account e nunca chega obsoleta. O cenário de catálogo `e2e-evento-obsoleto-sem-cliente-ignorado` cobre esse caminho.
- **Regra fica:** Trata evento de jornada obsoleto e fila manual, fora da camada de identidade e contatos. Pode ficar como está: com a R1, a Account deixa de sumir nesses eventos, e o guard passa a ser só uma defesa.
- **Na ponta (sobrevive):** O método (linha 550) e a chamada (linha 51) estão intactos. O 7c86318a05 pôs o vínculo histórico logo depois.
- **Relação:** Mesmo tema do ec9d1a6a7c (jornadas antigas na fila manual) e do 7c86318a05.

<a id="c16"></a>

### 16. `fc7077f94d` — Encerramento de Venda Genérica envia erro indevido para a fila EventGrid de PACS quando cliente não existe inicialmente no Salesforce

- **Data e arquivos:** 14/08/2026; `ClienteService`.
- **Mudança:** No `getClientePosPacComOrigem`, quando o valor do prospect não acha Account por IdProspect, ele é testado como IdCliente, e o match é marcado como 'ID_CLIENTE'.
- **Corrige:** No encerramento da Venda Genérica, a PAC que só trazia o IdCliente no `idProponente` não achava a Account e ia com erro para a fila do Event Grid.
- **Harness (não):** Nenhum evento do harness ou do catálogo leva o IdCliente no campo de prospect. O prospect de X sempre acha a Account X antes de o fallback rodar.
- **Regra R1:** Muda a busca usada por `/Cliente`, `/PAC` e `/MaquinaEstado`, e o match 'ID_CLIENTE' escapa do descarte do `deveDescartarMatchPosPac`. Na reescrita, a identidade vem do IdCliente/CPF do payload e a PAC sem Account é aceita (R2), o que torna o fallback desnecessário.
- **Na ponta (sobrevive):** Intacto em `ClienteService`, linhas 1381 a 1387.
- **Relação:** Restaura um caso que a consulta antiga cobria (`Id__c OR IdProspectSalesforce__c`) e que o [`c47170d879`](#c6) perdeu ao separar os campos. É o mesmo problema de prospect igual ao IdCliente que o de3731957d trata na gravação. Se o `idProponente` de uma PAC de Y trouxer o IdCliente de X, o fallback acha X sem o descarte por CPF.

<a id="c17"></a>

### 17. `de3731957d` — Pós-PAC Venda Genérica preenche incorretamente ID Prospect Salesforce quando cliente já existe na base

- **Data e arquivos:** 18/08/2026; `NotificacaoCliente`.
- **Mudança:** O `preencherAtributosAccount` deixa de gravar como IdProspect um prospect igual ao IdCliente (`idProspectIgualAoIdCliente`), e o caminho `vincularLeadExistente` passa a criar Lead quando não acha um (`permitirCriacaoLead`). O Lead novo recebe os contatos da Account do evento, que vêm vazios em cliente-*, quando o Proponente não tem.
- **Corrige:** Na Venda Genérica com cliente já existente, a Account ficava sem Lead e recebia como IdProspect o eco do próprio IdCliente.
- **Harness (em parte):** A criação de Lead no caminho de vínculo é afirmada no TC-062 e no TC-040 (Lead novo vinculado). O eco com prospect igual ao IdCliente não está no harness, só no cenário de catálogo `id-prospect-igual-id-cliente`.
- **Regra R1:** Decide o IdProspect da Account a partir do prospect do evento (R1) e cria Lead no vínculo (R4). Na reescrita, o prospect só vira vínculo se for de um Lead do mesmo CPF ou sem CPF, o que já barra o eco, e a criação segue a política única da R4.
- **Na ponta (sobrevive):** O `permitirCriacaoLead` (linha 262) e o guard do eco (linhas 388 e 397) continuam. Os contatos do Lead novo foram refeitos pelo 2eef5b7ba2 e pelo 78a25da643, que lê a Account do banco.
- **Relação:** Desfaz a trava de criação do 8b06b4cd2b. No TC-040 (FW) nenhum evento traz prospect, então as duas criações do B7 só podem vir deste caminho: o eco e a repetição chegam antes do vínculo.

<a id="c18"></a>

### 18. `509c87ad24` — Pós-PAC reutiliza lead livre por CPF/e-mail/celular e evita IdProspect inválido

- **Data e arquivos:** 21/08/2026; `NotificacaoCliente`.
- **Mudança:** Reescreve a escolha do Lead na `insertLeadQueueable`: Lead de outro CPF só marca colisão, e reusa o Lead do mesmo CPF que esteja livre; se todos estão presos a outra Account, não cria (Caso C); sem Lead do CPF, reusa um Lead sem CPF e livre que case e-mail ou celular. O Lead novo nasce sem o contato que colide, e o reusado sem `Id__c` ganha um GUID.
- **Corrige:** Lead de outro CPF achado por e-mail ou celular podia ser reusado e ter o CPF trocado, e, com os Leads do CPF presos a outra Account, nascia um duplicado. Lead reusado sem `Id__c` deixava a Account com IdProspect vazio.
- **Harness (sim):** Caso C no 024, 027 e 048; reuso do Lead livre no 026; fallback sem CPF no 012, 013, 045, 046 e 049; colisão no 001, 007, 010, 011, 016 a 018, 041 a 043 e 057. O GUID no Lead sem `Id__c` não roda, porque a massa sempre tem prospect.
- **Regra R4:** É a política de criar e reusar Lead e de colisão da R4. Na reescrita, vira o núcleo da política única, com a colisão valendo também para o Lead reusado e sem a sobrescrita de contatos que o 78a25da643 pôs no fallback.
- **Na ponta (sobrevive):** A árvore continua nas linhas 917 a 977. Depois vieram a gravação de contatos no Caso C (e505fcb93e) e a sobrescrita no fallback sem CPF (78a25da643).
- **Relação:** Usa o filtro do 1195c8984b. O K2 (045, 046 e 049) e o B5 (013) aparecem no fallback, e o reuso por CPF preenche vazios sem checar colisão, o que dá o B6 na repetição do FW.

<a id="c19"></a>

### 19. `2eef5b7ba2` — PAC aprovada cria Lead com e-mail herdado de outro Lead quando CPF novo possui apenas correspondência de celular

- **Data e arquivos:** 21/08/2026; `NotificacaoCliente`.
- **Mudança:** Calcula um único contato candidato (o do Proponente ou, sem ele, o do evento) e usa esse valor na busca, na checagem de colisão e na gravação, tanto do Lead novo quanto dos campos vazios do reusado. Também tira dados pessoais dos logs.
- **Corrige:** A colisão era conferida nos contatos do evento, que vinham vazios, enquanto o Lead novo recebia os do Proponente, e assim o Lead de Y herdava o e-mail de outro Lead.
- **Harness (sim):** Nos TCs de colisão, o candidato vem do Proponente da jornada. Os TCs 001, 016, 041 e 057 afirmam Lead só com CPF, e os 010, 011, 017, 018, 042 e 043 afirmam Lead sem o contato que colide.
- **Regra R4:** Impede que contato de outra pessoa vá ao Lead novo (R4), mas lê os 'contatos aprovados' do Proponente achado pelo prospect do evento, sem conferir identidade (R3). Na reescrita, a fonte passa pelo ponto único da R3, e a colisão vale também para o Lead reusado.
- **Na ponta (alterada depois):** A colisão sobre o candidato continua. O candidato passou a ser sempre o contato do Proponente (3029bcfb6d) e depois o do Proponente principal da Account, com a Account lida do banco como reserva (78a25da643).
- **Relação:** O reuso por CPF ainda grava nos campos vazios o contato que colide (B6, FW). O candidato tirado do Proponente da jornada, que já era a fonte antes deste commit, está por trás do K2 e do passo 1 do B9.

<a id="c20"></a>

### 20. `b4be1623d2` — PAC aprovada altera cliente principal, porém Id do Proponente não é atualizado no objeto Proponente

- **Data e arquivos:** 21/08/2026; `NotificacaoCliente`, `NotificacaoPAC`, `ProponenteSelector`.
- **Mudança:** Na PAC, o `IdProponente__c` do principal cujo IdCliente casa com a Account achada passa a vir do IdProspect dela, ou do Proponente já gravado, e não do payload (`resolverIdProponentePrincipal`). No `insertLeadQueueable`, depois do vínculo, `sincronizarIdProponentePrincipal` grava o novo prospect nos Proponentes principais da Account, tudo sob um savepoint.
- **Corrige:** Depois da aprovação, o Proponente principal ficava com o prospect da jornada em vez do prospect do Lead de Y.
- **Harness (sim):** A asserção 'Proponente principal na Account aprovada com PROS-Y' (comuns) roda em todo TC e perfil em que a Account aprovada tem prospect, e a PAC aprovada do harness leva o prospect da jornada. Passa nas duas campanhas: nenhuma falha ficou sem classificação.
- **Regra R2:** É a atualização do `IdProponente__c` do principal, que vem da Account achada (X, se a PAC de Y achou X). Na reescrita, gravar o prospect do Lead da pessoa da PAC só quando o vínculo acontece; o savepoint é infra.
- **Na ponta (alterada depois):** fe1d5a610c pôs DML parcial e retry no `sincronizarIdProponentePrincipal`; 542df3b1d1 reescreveu `resolverIdProponentePrincipal` (sem exigir IdCliente igual) e acrescentou `reconciliarIdProponentePrincipalPos`.
- **Relação:** fe1d5a610c existe porque o savepoint deste commit desfazia o Lead quando havia lock; 542df3b1d1 completa o ajuste na PAC. Sem bug no catálogo.

<a id="c21"></a>

### 21. `e505fcb93e` — Corrige preenchimento de contatos na Account aprovada pós-PAC

- **Data e arquivos:** 23/08/2026; `NotificacaoCliente`.
- **Mudança:** No `insertLeadQueueable` do `criarLeadDoCliente`, grava na Account o e-mail e o celular do Proponente achado pelo prospect do evento (ou os do evento), junto com o IdProspect e também no Caso C (`preencherContatosAprovados`, `atualizarContatosAprovadosSemVinculo`). Corrige ainda o `if` do `SistemaOrigem__pc`, que testava `profissao`.
- **Corrige:** A Account aprovada ficava sem os contatos aprovados quando eles colidiam com outro Lead ou no Caso C.
- **Harness (em parte):** Roda nos TCs em que o evento de Y traz o prospect de X, mas só o TC-019 confere os contatos da Account Y, e no estado final, que a PAC aprovada regrava. O Caso C (024, 027, 048) não confere contatos, e o valor intermediário só aparece pelo B9.
- **Regra R3:** Escrita de contato na Account pelo `/Cliente` (os 'contatos aprovados' do `criarLeadDoCliente`), sem conferir o CPF do Proponente de onde vêm. Na reescrita, passar pelo ponto único; o ajuste do `SistemaOrigem__pc` fica.
- **Na ponta (alterada depois):** As duas funções seguem; 78a25da643 pôs o Proponente principal da Account antes do achado pelo prospect e suspendeu o reflexo, e c04b6add92 pula a escrita quando a PAC aprovada já projetou.
- **Relação:** Origem do passo 1 do B9: `preencherContatosAprovados` grava na Account Y os contatos do Proponente achado pelo prospect (o de X). 78a25da643 e c04b6add92 mudaram a fonte e o momento sem tirar esse caminho.

<a id="c22"></a>

### 22. `3029bcfb6d` — reutiliza Lead livre no fallback por contato compartilhado

- **Data e arquivos:** 24/08/2026; `NotificacaoCliente`.
- **Mudança:** Os contatos usados para buscar, reutilizar e criar o Lead no `insertLeadQueueable` passam a ser sempre os do Proponente (ou os do evento), mesmo quando iguais aos do Lead da jornada.
- **Corrige:** O Lead livre sem CPF que compartilhava e-mail ou celular com o Lead da jornada não era achado no fallback, e nascia um Lead novo.
- **Harness (sim):** TC-012 (e-mail A, de X) e TC-013 (celular B, de X) afirmam o reuso do candidato sem CPF e o Lead X intacto. 045, 046 e 049 testam contato não compartilhado e caem no K2.
- **Regra R4:** Reuso do Lead sem CPF por e-mail/celular; a fonte dos contatos (Proponente achado pelo prospect) é R1/R3. Na reescrita, buscar com os contatos da PAC da própria pessoa e manter o guard do Lead original.
- **Na ponta (sobrevive):** As linhas `celularCandidato = celularAprovadoAccount` seguem; a origem desses contatos mudou em 78a25da643.
- **Relação:** Faz o 012 e o 013 passarem. A mesma fonte (Proponente achado pelo prospect da jornada) está no K2, no passo 1 do B9 e nos contatos que o B6 grava no Lead de Y.

<a id="c23"></a>

### 23. `fe1d5a610c` — torna sincronizacao do Proponente principal resiliente a UNABLE_TO_LOCK_ROW com DML parcial + retry, sem reverter o reconhecimento Lead+Account

- **Data e arquivos:** 24/08/2026; `NotificacaoCliente`.
- **Mudança:** `sincronizarIdProponentePrincipal` passa a usar DML parcial com até três tentativas em `UNABLE_TO_LOCK_ROW` e, se falhar, só registra log, sem lançar exceção.
- **Corrige:** Um lock no Proponente fazia o savepoint desfazer o Lead criado e o vínculo da Account.
- **Harness (não):** O lock nunca foi reproduzido. Só o caminho feliz roda, conferido pela asserção do PROS-Y no Proponente.
- **Regra infra:** Retry de DML em lock na sincronização do `IdProponente__c` (R2). Mantém.
- **Na ponta (sobrevive):** Igual na ponta, menos um comentário removido em c04b6add92.
- **Relação:** Corrige o efeito colateral do savepoint do b4be1623d2; o mesmo padrão volta em 542df3b1d1 (`reconciliarIdProponentePrincipalPos`) e em 72cbd884f6 (commit 3).

<a id="c24"></a>

### 24. `ec9d1a6a7c` — jornadas antigas estão enviando eventos para a fila manual após alteração

- **Data e arquivos:** 26/08/2026; `NotificacaoMaquinaEstado`.
- **Mudança:** Na `/MaquinaEstado`, quando o match por prospect é descartado por IdCliente divergente, mantém a Account se ela já é a da Opportunity da jornada (`devePreservarContaAtualDaOportunidade`), em vez de lançar 'Cliente(Account) não encontrado'.
- **Corrige:** Eventos de jornadas antigas, com IdCliente obsoleto, iam para a fila manual depois do descarte de match da 2.2.
- **Harness (não):** A máquina do harness leva o IdCliente de Y e acha a Account por ele, então o descarte não acontece. O cenário de catálogo `e2e-opportunity-permanece-conta-aprovada` cobre só o caso vizinho, sem idCliente.
- **Regra fica:** Fila manual de jornadas antigas; usa o prospect só para manter a Account que a Opportunity já tem (R1). Pode ficar, desde que o novo descarte de match mantenha essa exceção.
- **Na ponta (alterada depois):** 7c86318a05 passou o CPF a `devePreservarContaAtualDaOportunidade`, acompanhando o descarte por CPF do 9210581ea5.
- **Relação:** Resposta ao `deveDescartarMatchPosPac` na máquina; 9210581ea5 e 7c86318a05 levaram o CPF ao descarte e a esta exceção.

<a id="c25"></a>

### 25. `af28349332` — Pós-PAC não atualiza nome do Lead após aprovação da jornada

- **Data e arquivos:** 26/08/2026; `ClienteService`, `NotificacaoCliente`.
- **Mudança:** No `refletirAlteracoesLead`, mudança de FirstName/LastName dispara o reflexo, e o nome vai para o Lead mesmo quando o contato colide. O `insertLeadQueueable` grava o FirstName no Lead criado ou reutilizado.
- **Corrige:** O Lead não recebia o nome da Account depois da aprovação.
- **Harness (em parte):** O reflexo e o queueable rodam, mas o nome do Lead de Y não é conferido; o LastName só entra em 'X/Z intactos'. É por essa asserção que o B4 pega o nome de Y no Lead Z (TC-021).
- **Regra R4:** Nome do Lead e reflexo Account→Lead. Na reescrita, o nome só vai para Lead com o mesmo CPF da Account ou para o Lead novo.
- **Na ponta (alterada depois):** O FirstName no queueable segue; 07608bac4a reescreveu o nome no `refletirAlteracoesLead` (grava só se difere, ainda sem conferir CPF) e 78a25da643 criou os escopos.
- **Relação:** Primeiro de três commits com o mesmo título (7694d36312, d0e2635a70). O nome copiado sem conferir CPF aparece no B4.

<a id="c26"></a>

### 26. `dea0460ade` — Oportunidade criada pela jornada não herda corretamente proprietário, equipe e gerente do Lead

- **Data e arquivos:** 26/08/2026; `LeadSelector`, `NotificacaoMaquinaEstado`.
- **Mudança:** Na Opportunity nova criada pela jornada, herda OwnerId, `Equipe__c` e `GerenteAtual__c` do Lead achado pelo IdProspect (ou Id__c) da Account, se o dono for um usuário e não o padrão (`herdarEstruturaComercialDoLead`). `adjustLeadStatus` passa a receber esse Lead.
- **Corrige:** A Opportunity criada pela jornada ficava com o usuário padrão em vez do dono, da equipe e do gerente do Lead.
- **Harness (não):** O harness cria a Opportunity por DML e só manda `jornadausuario-update`; dono, equipe e gerente não são lidos.
- **Regra fica:** Dono, equipe e gerente da Opportunity; acha o Lead pelo IdProspect da Account (R1). Pode ficar.
- **Na ponta (sobrevive):** `herdarEstruturaComercialDoLead` e os campos novos de `buscarLeadPorIdExterno` estão iguais.

<a id="c27"></a>

### 27. `7694d36312` — Pós-PAC não atualiza nome do Lead após aprovação da jornada

- **Data e arquivos:** 26/08/2026; `ClienteService`, `ClienteTriggerHandler`, `NotificacaoPAC`, `ProponenteSelector`.
- **Mudança:** O `NomeCompleto__c` do Proponente passa a vir do nome da Account achada pela PAC (`resolverNomeVigenteProponente`). Um reflexo novo no `ClienteTriggerHandler` copia mudança de nome da Account para todos os Proponentes dela (`refletirAlteracoesNomeProponentes`).
- **Corrige:** O nome do Proponente não acompanhava o da Account. Apesar do título, não mexe no Lead.
- **Harness (em parte):** Toda PAC passa por `resolverNomeVigenteProponente`, mas o snapshot não lê `NomeCompleto__c`. O reflexo de nome não dispara, porque o nome da massa é igual ao do evento.
- **Regra R2:** O Proponente passa a guardar o nome da Account achada, não o da PAC; com a PAC de Y ligada a X, fica com o nome de X. Na reescrita, o Proponente guarda o nome da PAC e só recebe reflexo da Account com o mesmo CPF.
- **Na ponta (alterada depois):** `resolverNomeVigenteProponente` segue; o reflexo virou `refletirAlteracoesDadosProponentes` em d0e2635a70.
- **Relação:** Segundo commit do trio com esse título; d0e2635a70 estende o reflexo a e-mail e celular.

<a id="c28"></a>

### 28. `d0e2635a70` — Pós-PAC não atualiza nome do Lead após aprovação da jornada

- **Data e arquivos:** 26/08/2026; `ClienteService`, `ClienteTriggerHandler`, `NotificacaoPAC`, `ProponenteSelector`.
- **Mudança:** O reflexo vira `refletirAlteracoesDadosProponentes` e copia nome, e-mail e celular da Account para todos os Proponentes dela. Na PAC, e-mail e celular do Proponente passam a vir da Account achada e só vêm do payload se ela estiver vazia (`resolverContatoVigenteProponente`).
- **Corrige:** O Proponente não acompanhava e-mail e celular vigentes da Account. Apesar do título, não mexe no Lead.
- **Harness (em parte):** C1 a C4, AR, AM e FW conferem, quando a PAC em análise é aceita, que ela grava CPF e e-mail do payload no Proponente, o oposto da precedência da Account (já desfeita). O reflexo Account→Proponente roda e não é conferido.
- **Regra R2:** O Proponente deixa de guardar os contatos da PAC, e o reflexo Account→Proponente é mais uma escrita de contato sem conferir CPF (R3). Na reescrita, tirar o reflexo ou exigir o mesmo CPF.
- **Na ponta (alterada depois):** O reflexo de nome, e-mail e celular está na ponta (07608bac4a o reduziu a nome e da90427ced o restaurou). `resolverContatoVigenteProponente` saiu em 07608bac4a, e o principal usa o payload desde 70f3295319.
- **Relação:** Estende 7694d36312. A precedência da Account foi desfeita por 6612bab1b3 (contestação), 542df3b1d1 (CPF divergente) e 07608bac4a/70f3295319.

<a id="c29"></a>

### 29. `6612bab1b3` — Contestação de PAC atualiza dados de contato do Proponente, mas não sincroniza e-mail e celular na Account vinculada

- **Data e arquivos:** 27/08/2026; `ClienteService`, `ContestacaoSelector`, `NotificacaoPAC`.
- **Mudança:** Com contestação pendente, a PAC grava no Proponente os contatos do payload e chama `sincronizarContatosContestacao`, que copia e-mail e celular para a Account ligada (conferindo só IdCliente e data) e para o Lead do IdProspect dela. `buscaContestacaoPorPAC` passa a pegar a contestação pendente mais recente.
- **Corrige:** A contestação atualizava os contatos do Proponente, mas não os da Account vinculada.
- **Harness (em parte):** O C4 roda o caminho nos 44 TCs e pega a escrita em X (B2, 41 TCs); o efeito certo só aparece no estado final do 039, que a PAC aprovada também grava. O cenário de catálogo `pac-update-com-contestacao-pendente-sincroniza-contatos` afirma a Account com os contatos.
- **Regra R3:** Escrita de contato na Account pela contestação, conferindo só IdCliente e data. Na reescrita, usar o ponto único com CPF; a escrita no Lead (R4) já saiu.
- **Na ponta (alterada depois):** O guard só por IdCliente segue; 07608bac4a tirou a escrita no Lead, passou a exigir a data da PAC e a bloquear conflito por Account.
- **Relação:** Origem do B2: no C4, a PAC de Y traz o IdCliente de X, e é o único dado conferido. A regra de usar o payload como fonte quando há contestação segue em `deveUsarContatoAprovado`.

<a id="c30"></a>

### 30. `542df3b1d1` — Novo lead criado com dados divergentes da PAC (celular não corresponde ao aprovado) e lead sem sincronização completa dos dados aprovados

- **Data e arquivos:** 28/08/2026; `NotificacaoPAC`.
- **Mudança:** Em `criarInstanciaProponente`, `possuiCpfDivergente` faz do payload a fonte de e-mail e celular quando o CPF da PAC é diferente do da Account achada. Cria `reconciliarIdProponentePrincipalPos`, que relê a Account e grava o prospect dela no `IdProponente__c` do principal (até 3 tentativas em `UNABLE_TO_LOCK_ROW`), e `resolverIdProponentePrincipal` passa a usar o prospect da Account sem exigir IdCliente igual.
- **Corrige:** O Lead novo de Y nascia com um celular diferente do aprovado, porque o Proponente ligado a uma Account de outro CPF guardava os contatos dela. Também evita `IdProponente__c` com prospect antigo quando a Account passa a PROS-Y em corrida com o Queueable.
- **Harness (sim):** 'Proponente principal na Account aprovada com PROS-Y' (todo TC com prospect) cobre o `IdProponente__c`, e em C2 a C4 'PACs em análise aplicadas ao Proponente' exige o CPF e o e-mail de Y no Proponente ligado a X. A corrida com o Queueable e o retry de lock não são forçados.
- **Regra R2:** Decide os contatos e o `IdProponente__c` do Proponente (R2); o retry em `UNABLE_TO_LOCK_ROW` é infra. Na reescrita, o Proponente guarda os dados da PAC, fica sem Account quando o CPF não bate e só herda o prospect de uma Account com o mesmo CPF.
- **Na ponta (alterada depois):** `possuiCpfDivergente`, `reconciliarIdProponentePrincipalPos` e `resolverIdProponentePrincipal` estão iguais. `resolverContatoVigenteProponente` virou `deveUsarContatoAprovado`/`escolherContatoConformePolitica` no 07608bac4a (mexido depois no 70f3295319 e no c04b6add92), e o payload segue como fonte quando o CPF diverge.
- **Relação:** Par do a1eef12c11 (mesmo título). Em C2 e C3 é a regra que põe os contatos de Y no Proponente ligado a X, que a pendência copia para X (B1); com o 1f6844e910, a PAC em análise de Y sem Account é recusada antes de chegar aqui, e o Proponente fica com os dados de X (B8, B9, K2).

<a id="c31"></a>

### 31. `a1eef12c11` — Novo lead criado com dados divergentes da PAC (celular não corresponde ao aprovado) e lead sem sincronização completa dos dados aprovados

- **Data e arquivos:** 28/08/2026; `PropostaAnaliseCreditoSelector`.
- **Mudança:** Acrescenta `Oportunidade__r.StageName` às consultas `getPacsByIdExterno` e `getPacsByIdExternoForUpdate`.
- **Corrige:** No `pac-update`, a `NotificacaoPAC` lia `Oportunidade__r.StageName` (regra Perdido→Cancelado) sem o campo na consulta, o que lança exceção e derruba o evento da PAC aprovada.
- **Harness (em parte):** Todo TC manda `pac-update` com status e exige HTTP 200, mas na ponta nada lê esse campo, e nenhum TC usa Opportunity em Perdido. O cenário de catálogo `pac-insert-opportunity-perdida-forca-cancelado` só cobre o insert.
- **Regra fica:** É só a leitura de StageName para o status da PAC, fora da identidade e dos contatos. Se a regra Perdido→Cancelado ainda valer, a reescrita deve carregar a Opportunity antes de `preencherDadosPAC`.
- **Na ponta (sobrevive):** O campo segue nos dois métodos, mas nada o lê: desde o 07608bac4a, a `NotificacaoPAC` usa `this.oportunidade.StageName`.
- **Relação:** Par do 542df3b1d1 (mesmo título). No `pac-insert` de PAC nova, a relação é nula e o Apex devolve `null` em vez de lançar exceção: a regra não dispara, mas o evento não quebra. O `preencherEstadoTest`, que faz a mesma leitura numa Opportunity não consultada, passou na dev em 08/10. Esse commit passou a ler `this.oportunidade`, que ainda é nulo em `preencherDadosPAC`, e a regra Perdido→Cancelado (305a3060c7) não dispara na ponta.

<a id="c32"></a>

### 32. `07608bac4a` — Corrige sincronização de contatos aprovados no pós-PAC

- **Data e arquivos:** 30/08/2026; `ClienteService`, `ClienteTriggerHandler`, `NotificacaoPAC`, `ProponenteSelector`, `ProponenteTriggerHandler`, `ProponenteTrigger (trigger)`, `Proponente_1 (flow)`.
- **Mudança:** Cria `sincronizarContatosAprovadosPac`: com a PAC em CREDITO_APROVADO_CONDICIONADO, grava na Account o e-mail e o celular do principal se IdCliente e CPF batem e a data é mais nova. Troca a ação do flow `Proponente_1` por `ProponenteTriggerHandler.sincronizarEmailContatoPendencia` (after insert/update, carimbo pela data do evento) e também refaz `sincronizarContatosContestacao` (sem Lead, com conflito e data obrigatória), faz o `refletirAlteracoesLead` gravar só o que mudou e campo a campo, reduz ao nome o reflexo para o Proponente, cria `deveUsarContatoAprovado` e passa a ler o StageName de `this.oportunidade`.
- **Corrige:** A PAC aprovada não levava à Account o e-mail e o celular aprovados; a pendência gravava pelo flow, com `Now()`, a cada update do Proponente, e a contestação mexia no Lead pelo prospect. Também troca a leitura de `Oportunidade__r.StageName` por `this.oportunidade`, que ainda é nulo nesse ponto. O `pac-insert` de PAC nova não lançava exceção: numa relação nula, o Apex devolve `null` (item 31).
- **Harness (sim):** TC-004, TC-019 e TC-039 afirmam 'Account aprovada com os contatos da PAC', e o perfil RC depende do carimbo avançado para descartar o contato atrasado. A pendência roda em C2, C3, AR, AM e FW e a contestação no C4, onde 'Account X intacta' pega B1, B8 e B2; a regra Perdido→Cancelado não é exercitada.
- **Regra R3:** Cria ou refaz os três escritores de contato na Account (pendência, contestação e pós-PAC), cada um com sua checagem: só o pós-PAC confere CPF, e a pendência não confere nada. Na reescrita, os três passam pelo ponto único de R3; o reflexo Account→Lead vai para R4, a fonte de contato do Proponente para R2, e o StageName fica.
- **Na ponta (alterada depois):** Trigger, flow e contestação seguem; o recorte do reflexo para o Proponente foi revertido pelo da90427ced, e `sincronizarEmailContatoPendencia` mudou no 78a25da643. `sincronizarContatosAprovadosPac` e `deveUsarContatoAprovado` mudaram no 78a25da643, no 70f3295319 e no c04b6add92.
- **Relação:** `sincronizarEmailContatoPendencia` é o passo 3 do B1 e a escrita do B3, B4 e B8; a contestação segue conferindo só o IdCliente (B2); `sincronizarContatosAprovadosPac` é o passo 3 do B9, e o ramo COMPLETA do `refletirAlteracoesLead`, sem CPF, é o reflexo do B4. Tornou o a1eef12c11 desnecessário e deixou sem efeito a regra Perdido→Cancelado.

<a id="c33"></a>

### 33. `78a25da643` — Corrige reflexão de dados e vínculos entre Lead, Account e Proponente no pós-PAC

- **Data e arquivos:** 31/08/2026; `ClienteService`, `NotificacaoCliente`, `NotificacaoPAC`, `ProponenteSelector`, `ProponenteTriggerHandler`, `ReconciliacaoContatosLeadQueueable`.
- **Mudança:** Cria as políticas de reflexo Account→Lead (`BLOQUEAR`, `PREENCHER_CONTATOS_VAZIOS`, `PREENCHER_CPF_VAZIO_IDENTIDADE_VINCULADA`, `ATUALIZAR_CONTATOS_MESMA_IDENTIDADE_ESTAVEL`), aplicadas no `/Cliente`, no `insertLeadQueueable` e em `sincronizarContatosAprovadosPac`, e a `ReconciliacaoContatosLeadQueueable`, que preenche contato vazio do Lead PROS-Y (origens CONTATO e POS_VINCULO). O `insertLeadQueueable` relê a Account e lê os contatos aprovados do Proponente principal dela (no fallback, do Proponente do prospect do evento); além disso, o fallback sem CPF passa a trocar o contato complementar, o `/Cliente` só grava IdProspect que veio no evento, a pendência compara com o carimbo gravado e a PAC obsoleta sai antes dos Proponentes.
- **Corrige:** Updates técnicos do pós-PAC e eventos de contato refletiam a Account inteira no Lead (E/F do Lead Y trocados, Lead de outra pessoa alterado), e o contato que chegava antes do vínculo PROS-Y não chegava ao Lead. O `criarLeadDoCliente` lia os contatos aprovados só pelo prospect do evento.
- **Harness (sim):** TC-004 (CPF no Lead X), TC-019 e TC-047 (Lead Y com contatos preservados), TC-021 (Lead Z intacto) e TC-062 (Lead novo com C/D) afirmam as políticas e a reconciliação; AR e FW reentregam PACs em análise obsoletas e exigem 'PAC no status aprovado'. Não se afirma o contato complementar do fallback (TC-012/013) nem os contatos do Lead X no TC-039.
- **Regra R4:** Os escopos de reflexo e a fila de reconciliação são a política de Lead (R4); o commit também muda a leitura dos contatos aprovados do `criarLeadDoCliente` (R3) e deixa de gravar IdProspect ausente (R5). Na reescrita, uma política única de Lead substitui os quatro escopos e a fila, e os contatos aprovados só vêm de fonte com o CPF da Account, sem o fallback pelo prospect do evento.
- **Na ponta (alterada depois):** As políticas, `deveAtualizarContatosMesmaIdentidadeEstavel` e a leitura pelo Proponente principal seguem. A fila mudou no 68e7cfc856, no c04b6add92, no d6f147d303 e no a6d1f4c64c, e o `insertLeadQueueable` ganhou `contatosJaForamProjetadosPelaPac` (c04b6add92) e retry de lock (72cbd884f6).
- **Relação:** O fallback pelo Proponente do prospect do evento é o passo 1 do B9 e do K2 em AR e FW; os escopos não cobrem o DML da pendência, que cai no reflexo completo (B4). É esta fila que o c04b6add92 estendeu com POS_PAC_APROVADA (passo 3 do B9).

<a id="c34"></a>

### 34. `da90427ced` — Consolida fluxos pós-PAC e amplia cobertura de regressão

- **Data e arquivos:** 31/08/2026; `ClienteSelector`, `ClienteService`, `ClienteTriggerHandler`, `ProponenteSelector`.
- **Mudança:** Reescreve `createOrUpdateClienteByLeadUnificacao` (CPF primeiro, depois prospect; Account com IdCliente achada pelo prospect e Lead com CPF geram Account nova), troca o filtro de `obterClientePorCPF` por `CpfCNPJ.expandirFormatosCPF` e cria `ClienteSelector.obterClientePorId`. Volta o `refletirAlteracoesDadosProponentes` (nome, e-mail e celular da Account para todos os Proponentes dela) no lugar do recorte por nome e tira comentários.
- **Corrige:** Sem sintoma no título. Traz da 2.1 a busca por CPF em vários formatos e a unificação Lead→Account que não atualiza Account com IdCliente achada só pelo prospect.
- **Harness (em parte):** A busca por CPF é afirmada nos TCs com Account Y só com CPF (009, 020, 022, 024, 025, 027) e no 038 (B3), mas o CPF da massa tem só dígitos. O reflexo para o Proponente roda em todo update de Account, sem asserção própria, e a unificação da 2.1 (`PesquisarContaController`) não é chamada.
- **Regra R1:** A busca por CPF (pós-PAC e Iniciar Jornada) e a escolha de Account na unificação Lead→Account são R1; a volta do `refletirAlteracoesDadosProponentes` fere R2, porque troca pelos da Account os contatos que vieram da PAC. Na reescrita, manter a busca por CPF/IdCliente, preferindo a Account com IdCliente, e tirar o reflexo de contatos para o Proponente.
- **Na ponta (sobrevive):** Os métodos estão idênticos na ponta, e o `ClienteTriggerHandler` ainda chama `refletirAlteracoesDadosProponentes`. O `ClienteSelector` da dev, que veio do `develop`, tem o mesmo código.
- **Relação:** Reverte o recorte do 07608bac4a e traz, quase igual, código da 2.1 (b60c6ae4b9, 56813a221e); no branch, o `CpfCNPJ` não tem `expandirFormatosCPF`, e a dev só compila porque tem o `CpfCNPJ` da 2.1. A busca por CPF continua pegando a Account mais recente, sem preferir a que tem IdCliente (B3).

<a id="c35"></a>

### 35. `68e7cfc856` — Remoção de comentários

- **Data e arquivos:** 31/08/2026; `ReconciliacaoContatosLeadQueueable`.
- **Mudança:** Tira os comentários da `ReconciliacaoContatosLeadQueueable` e do teste e, junto, os logs de estado por Account, de falha de DML no Lead e de enqueue.
- **Corrige:** Nenhum sintoma; é limpeza.
- **Harness (em parte):** A fila roda em vários TCs (ex.: TC-062), mas o harness só lê logs de erro e jobs com falha, e uma falha de DML no Lead não derruba o job. Nada do que ele mede muda.
- **Regra teste:** Era só para tirar comentários, mas levou junto os logs de falha de DML e de enqueue, e o `catch` de `enqueueJob` ficou vazio. Na reescrita, manter o log de falha (infra).
- **Na ponta (sobrevive):** Os logs seguem fora e o `catch` de `enqueueJob` continua vazio, apesar das mudanças posteriores na classe.
- **Relação:** Limpeza do 78a25da643, do mesmo dia. Nenhum bug do catálogo ligado.

<a id="c36"></a>

### 36. `4d54e3b7d9` — Sincronização de Conta da Oportunidade após aprovação da PAC

- **Data e arquivos:** 01/09/2026; `NotificacaoPAC`.
- **Mudança:** Cria `sincronizarContaOportunidadeAposAprovacao`, chamado depois do upsert dos Proponentes: com a PAC em CREDITO_APROVADO_CONDICIONADO, move a Opportunity para a Account do Proponente principal se ela tiver IdCliente.
- **Corrige:** Depois da PAC aprovada de Y, a Opportunity seguia na Account de X até chegar um evento de máquina, que a Venda Genérica pode não ter.
- **Harness (sim):** 'Opportunity na Account aprovada' vale em todos os TCs, e na Venda Genérica em AR e FW, que não têm máquina, só este método move a Opp. O cenário de catálogo `e2e-opportunity-permanece-conta-aprovada` cobre a máquina depois da troca.
- **Regra R1:** Decide a Account da Opportunity (R1) pela Account do Proponente principal, que vem da busca do pós-PAC. Na reescrita, a Opp vai para a Account que o CPF/IdCliente da PAC aprovada apontam, sem depender do vínculo do Proponente.
- **Na ponta (sobrevive):** `sincronizarContaOportunidadeAposAprovacao` está idêntico na ponta.
- **Relação:** Faz na PAC aprovada o que o 12182e7e78 faz na máquina, e o 7c86318a05 impede a máquina de desfazer. Nenhum bug do catálogo envolve a Opportunity.

<a id="c37"></a>

### 37. `70f3295319` — Sincronização de Conta da Oportunidade e projeção de contatos após aprovação da PAC

- **Data e arquivos:** 01/09/2026; `ClienteService`, `NotificacaoPAC`.
- **Mudança:** `sincronizarContatosAprovadosPac` ganha `accountIdDaPacVigente` (a Account da Opportunity) e, para essa Account, grava os contatos sem olhar a data. `deveUsarContatoAprovado` também deixa de comparar a data quando o IdCliente bate e a Account achada é a da Opportunity.
- **Corrige:** Um contato-* da jornada com data mais nova que a PAC aprovada impedia os contatos aprovados de chegar à Account e ao Proponente.
- **Harness (em parte):** No harness, a PAC aprovada é sempre mais nova que os contato-*, então a guarda de data passaria de qualquer jeito no TC-004, no TC-019 e no TC-039. O cenário de catálogo `pac-aprovada-sobrescreve-contato-anterior` cobre a PAC aprovada mais antiga que os contatos.
- **Regra R3:** Fura a guarda de data na escrita de contato do pós-PAC (R3) e na fonte de contato do Proponente (R2) quando a Account é a da PAC vigente. Na reescrita, o ponto único compara a data do evento; se a PAC aprovada tiver de prevalecer, que seja regra explícita e confira o CPF/IdCliente.
- **Na ponta (alterada depois):** O c04b6add92 trocou a Account da Opp por `obterAccountIdDoProponentePrincipal` e fez `payloadPertenceAPacVigenteDaConta` valer para todo principal com Account, antes do teste de identidade forte.
- **Relação:** Segue o 4d54e3b7d9, do mesmo dia. Na ponta, a sincronização pós-PAC não confere a data para a Account do principal, e é por ela que a PAC aprovada troca os contatos da Account Y no passo 3 do B9.

<a id="c38"></a>

### 38. `9f0ba21f38` — Evento de jornada de Venda Genérica direcionado para fila manual devido falha de criação/atualização de Oportunidade causada por StageName obrigatório

- **Data e arquivos:** 03/09/2026; `NotificacaoMaquinaEstado`.
- **Mudança:** Em `preencherEstado`, só grava o StageName quando `retornaValorFase` devolve valor, e o retorno padrão de `retornaValorFase` passa de vazio para o StageName atual (ou nulo).
- **Corrige:** Uma jornada de Venda Genérica com estado sem fase mapeada gravava StageName vazio; a Opportunity falhava por campo obrigatório e o evento ia para a fila manual.
- **Harness (não):** A máquina do harness manda sempre `Documentacao`, que tem fase, e na Venda Genérica em AR e FW não há máquina. O cenário de catálogo `maquina-estado-update-estado-nao-reconhecido` (estado `SP`) cobre o StageName preservado.
- **Regra fica:** Mexe só na fase da Opportunity na máquina, fora da identidade e dos contatos. Pode ficar como está.
- **Na ponta (sobrevive):** O trecho está igual na ponta; o 9210581ea5 e o 7c86318a05 mexeram em outras partes da classe.
- **Relação:** Sem relação com B1 a B9, K1 e K2. Na dev revertida (27/09 a 11/10), a `NotificacaoMaquinaEstado` era igual a este commit.

<a id="c39"></a>

### 39. `c04b6add92` — sincronização pós-aprovação PAC entre Account e Lead

- **Data e arquivos:** 03/09/2026; `ClienteService`, `NotificacaoCliente`, `NotificacaoPAC`, `ReconciliacaoContatosLeadQueueable`.
- **Mudança:** Cria a origem `POS_PAC_APROVADA`, disparada no fim de `sincronizarContatosAprovadosPac`, que sobrescreve no Lead vinculado o contato que diverge da Account. Na `NotificacaoPAC`, soma 3h à data sem fuso (`parseDateTime`), dá ao Proponente principal os contatos do payload e trata como vigente a Account dele, que recebe os aprovados sem olhar data (`obterAccountIdDoProponentePrincipal`); no `insertLeadQueueable`, `contatosJaForamProjetadosPelaPac` não regrava a Account já projetada pela PAC.
- **Corrige:** Caso Clarice (staging, 02/09): após a PAC aprovada, a Account Y tinha os contatos aprovados e o Lead Y o contato velho com que o Queueable o criou. Corrige também a data da PAC, gravada 3h atrás.
- **Harness (em parte):** O RC afirma a data da PAC em UTC e o contato atrasado descartado, e os TCs 019 e 039 afirmam a Account com os contatos da PAC. O caso Clarice (Lead nascido com contato velho, ordem O09) não está nos 44 TCs; na API, `pac-aprovada-sobrescreve-contato-anterior` cobre a PAC aprovada vencendo o contato anterior.
- **Regra R4:** O núcleo é sobrescrever o Lead depois da PAC aprovada, o que a R4 proíbe no Lead reutilizado; o lado da Account (Proponente principal, `contatosJaForamProjetadosPelaPac`) é R3, e a soma de 3h fica. Na reescrita, o Lead criado pelo fluxo nasce com os aprovados (caso Clarice) e o reutilizado só recebe contato onde está vazio.
- **Na ponta (alterada depois):** A sobrescrita em `avaliarHelper` e `processarLote` mudou no d6f147d303 e no a6d1f4c64c. O resto sobrevive.
- **Relação:** Base do d6f147d303 e do a6d1f4c64c; estava nas duas campanhas. A `POS_PAC_APROVADA` é provável parte do B9: no 047 do AR e do FW, é ela que leva o celular aprovado ao Lead Y.

<a id="c40"></a>

### 40. `d6f147d303` — refina POS_PAC_APROVADA para preservar contatos próprios do Lead

- **Data e arquivos:** 04/09/2026; `ReconciliacaoContatosLeadQueueable`.
- **Mudança:** Em `avaliarHelper`, a sobrescrita pós-PAC só troca o contato divergente se o Lead não diverge da Account nos dois. Com e-mail e celular preenchidos e diferentes nos dois lados, o Lead fica como está.
- **Corrige:** A `POS_PAC_APROVADA` do c04b6add92 trocava pelos aprovados os contatos próprios do Lead Y reutilizado (TCs 019, 022 e 047 nos testes Apex).
- **Harness (sim):** Os TCs 009, 019, 022, 023, 047, 055 e 056 afirmam o Lead Y reutilizado com os contatos preservados e passam no PA, CA, ME, RC, EP e RL. No AR e no FW, o 047, o 055 e o 056 falham (B9).
- **Regra R4:** É uma heurística ('diverge nos dois') para separar contato próprio de contato velho. A R4 a troca por regra explícita: Lead reutilizado só preenche vazio, não importa quantos campos divergem.
- **Na ponta (sobrevive):** O bloco `divergeEmAmbos` segue em `avaliarHelper`.
- **Relação:** Refina o c04b6add92. Provável parte do B9: quando a pendência já igualou o e-mail, sobra só o celular divergente, e esta regra deixa sobrescrevê-lo (047 no AR e no FW).

<a id="c41"></a>

### 41. `a6d1f4c64c` — guarda de colisão na sobrescrita POS_PAC_APROVADA

- **Data e arquivos:** 08/09/2026; `ReconciliacaoContatosLeadQueueable`.
- **Mudança:** Em `processarLote`, os valores que a sobrescrita pós-PAC vai gravar entram na busca de colisão com outros Leads; antes, só os campos vazios eram conferidos. `avaliarHelper` barra o valor que colide e registra log.
- **Corrige:** A `POS_PAC_APROVADA` podia gravar no Lead Y um e-mail ou celular que já é de outro Lead.
- **Harness (em parte):** Só o AR e o FW do 055 e do 056 chegam à sobrescrita com colisão (o celular aprovado é do Lead Z), e o Lead Y mantém o celular dele. Nenhuma asserção isola isso: a de contatos preservados já falha pelo e-mail (B9), e 'Lead Z intacto' passaria mesmo sem o guard.
- **Regra R4:** Aplica à sobrescrita a regra da R4 de nunca gravar contato que colide com outra pessoa. Na reescrita, a checagem fica na política única do Lead e vale para toda escrita nele.
- **Na ponta (sobrevive):** Candidatos de colisão em `processarLote` e log em `avaliarHelper` seguem iguais.
- **Relação:** Completa o d6f147d303. No 055 e no 056 do AR e do FW, é provavelmente o que segura o celular do Lead Z fora do Lead Y, e por isso o B9 ali só troca o e-mail.

<a id="c42"></a>

### 42. `8763dacaaa` — retire comentários desnecessários

- **Data e arquivos:** 08/09/2026; `ClienteServiceTest`.
- **Mudança:** Remove três linhas de comentário de `sincronizarContatosAprovadosPacCorridaColisaoBloqueiaSobrescritaCelularTest`.
- **Corrige:** Nada; não muda comportamento.
- **Harness (não):** Só comentário em classe de teste.
- **Regra teste:** Limpeza de teste; nada a levar para a reescrita.
- **Na ponta (sobrevive):** O teste segue sem os comentários.
- **Relação:** O teste é o que o a6d1f4c64c criou.

<a id="c43"></a>

### 43. `1f6844e910` — Guard de identidade em NotificacaoCliente para eventos parciais pós-PAC

- **Data e arquivos:** 08/09/2026; `ClienteService`, `NotificacaoCliente`, `NotificacaoPAC`.
- **Mudança:** `deveDescartarMatchPosPac` ganha o CPF: descarta o match pelo prospect se o IdCliente ou o CPF do evento divergem da Account, ou se o evento não traz nenhum dos dois, e a `NotificacaoPAC` passa a enviar o CPF. No `/Cliente`, `validarIdentidadePayloadParcialContraAccount` descarta `contato-*` e `endereco-*` com prospect diferente do da Account ou cuja Account tem Proponente principal aprovado de outro IdCliente (`existeProponentePrincipalAprovadoDivergente`).
- **Corrige:** Bug 4 de staging: a Account X mudava na aprovação da PAC de Y com CPF divergente. O commit mira os parciais do `/Cliente`, mas o efeito medido vem do descarte por CPF na `NotificacaoPAC`, que passa a recusar a PAC em análise de Y sem IdCliente até Y existir.
- **Harness (em parte):** Nos 19 TCs sem Account Y, a PAC em análise é recusada no C1, no AR e no FW, e no AR e no FW X deixa de receber o e-mail de Y, mas 'Account X intacta' segue falhando pelo carimbo (B8). O guard de parciais disparou 0 vezes: os parciais com prospect alheio já caem antes no `prospectPertenceAOutraConta`.
- **Regra R1:** Conferir o CPF antes de aceitar o match pelo prospect é R1 e fica, mas recusar a PAC em análise contraria a R2, que a aceita com o Proponente sem Account. O guard de parciais é conferência de escrita e, na reescrita, vai para o ponto único da R3.
- **Na ponta (alterada depois):** O ramo sem IdCliente e sem CPF de `deveDescartarMatchPosPac` mudou no 9210581ea5, e `existeProponentePrincipalAprovadoDivergente`, no 3f2919f5e7. As chamadas com CPF seguem.
- **Relação:** Commit 4: tira o B1 do C1, do AR e do FW e leva o B8 de 3 para 60 pares; com a Account Y nascendo com os contatos de X, abre o B9 e o K2 do AR e do FW (045 e 049). Suas regressões foram corrigidas pelo 9210581ea5 e pelo 3f2919f5e7.

<a id="c44"></a>

### 44. `72cbd884f6` — Novo Lead não é criado em cenário de aprovação de PAC com CPF divergente (UNABLE TO LOCK ROW)

- **Data e arquivos:** 09/09/2026; `NotificacaoCliente`.
- **Mudança:** No `insertLeadQueueable`, o update da Account (IdProspect e contatos aprovados) passa por `updateAccountComRetryLock`, que repete o DML até 3 vezes em `UNABLE_TO_LOCK_ROW`.
- **Corrige:** O Lead novo de Y era desfeito pelo rollback do savepoint quando o update da Account batia em `UNABLE_TO_LOCK_ROW` (relato de staging).
- **Harness (não):** O `UNABLE_TO_LOCK_ROW` nunca apareceu no harness nem nos diagnósticos `diag:tc001-race-*`, com até 25 requisições simultâneas. As asserções de job e de `LogIntegracao__c` com erro pegariam a falha, mas o retry nunca é acionado.
- **Regra infra:** Robustez genérica de DML, fora da camada de identidade; mantém. Não cobre o 'Record Currently Unavailable' (QueryException) que o diagnóstico dos commits 3 e 4 reproduziu.
- **Na ponta (sobrevive):** `updateAccountComRetryLock` segue no `insertLeadQueueable`.
- **Relação:** Commit 3. Não alcança a corrida silenciosa de Leads duplicados órfãos (padrão do B7), que não lança erro.

<a id="c45"></a>

### 45. `9210581ea5` — PAC enviado para fila manual indevidamente com erro "Cliente(Account) não encontrado no Salesforce"

- **Data e arquivos:** 09/09/2026; `ClienteService`, `NotificacaoMaquinaEstado`.
- **Mudança:** Sem IdCliente e sem CPF no evento, `deveDescartarMatchPosPac` volta a aceitar o match pelo prospect. A `NotificacaoMaquinaEstado` busca o CPF em `proponentecredito` também pelo `idProponente` igual ao prospect (`obterCpfProponentePorIdCliente`) e o passa ao descarte.
- **Corrige:** Regressão do 1f6844e910: jornada (e PAC) sem IdCliente e sem CPF perdia o match pelo prospect e ia para a fila manual com 'Cliente(Account) não encontrado'.
- **Harness (não):** Nenhum perfil manda evento sem IdCliente e sem CPF, nem jornada com `proponentecredito`. Na API, `e2e-opportunity-permanece-conta-aprovada` (passo `maquina-estado-update-identidade-antiga`) e `e2e-evento-atual-reentregue-apos-cliente-insert` (passo `maquina-estado-insert-reentregue`) passam pelo ramo sem IdCliente e sem CPF.
- **Regra R1:** Decide a Account da jornada e da PAC sem IdCliente: o CPF do proponente confere o prospect, e sem CPF o prospect vale. Na reescrita, mantém a ordem IdCliente, CPF e prospect, com o CPF tirado do payload, e sem CPF o prospect não troca a Account de uma Opportunity existente.
- **Na ponta (sobrevive):** Ramo sem IdCliente e sem CPF e busca pelo `idProponente` intactos.
- **Relação:** Corrige regressão do 1f6844e910 e é base do 7c86318a05. Reabre o match pelo prospect para PAC sem IdCliente e sem CPF (o caminho do B1), que o harness não testa porque toda PAC leva CPF.

<a id="c46"></a>

### 46. `7c86318a05` — Preserva vínculo histórico da Opp em jornadausuario-* sem idCliente

- **Data e arquivos:** 10/09/2026; `NotificacaoMaquinaEstado`.
- **Mudança:** `devePreservarContaAtualDaOportunidade` recebe o CPF do proponente e o repassa a `deveDescartarMatchPosPac`. Com CPF divergente da Account do prospect, a jornada sem IdCliente mantém a Account atual da Opportunity quando ela já é essa Account.
- **Corrige:** Depois do 9210581ea5, essa jornada tinha o match descartado e ia para a fila manual, mesmo com a Opportunity já na Account do prospect, porque o vínculo histórico não via o CPF.
- **Harness (não):** Nenhum perfil nem cenário da API manda jornada sem IdCliente com `proponentecredito`, de onde vem o CPF. O `maquina-estado-update-obsoleto-sem-cliente` para antes, no descarte de evento obsoleto.
- **Regra R1:** Decide a Account da Opportunity: sem IdCliente e com CPF divergente, ela fica onde está. Na reescrita, jornada sem IdCliente não move a Opportunity; quem a move é a PAC aprovada, por CPF/IdCliente.
- **Na ponta (sobrevive):** `devePreservarContaAtualDaOportunidade` com CPF intacto.
- **Relação:** Complementa o 9210581ea5. Sem relação com B1–B9 ou K1–K2.

<a id="c47"></a>

### 47. `3f2919f5e7` — Corrige falso positivo no guard de identidade de payload parcial (contato-update/endereco-update)

- **Data e arquivos:** 21/09/2026; `ClienteService`, `NotificacaoCliente`.
- **Mudança:** `existeProponentePrincipalAprovadoDivergente` passa a olhar só Proponentes principais aprovados da própria Account, com IdCliente diferente do dela e na PAC atual da Opportunity. O guard registra o motivo do descarte (`ID_PROSPECT_DIVERGENTE` ou `PROPONENTE_PRINCIPAL_DIVERGENTE`).
- **Corrige:** Falso positivo do guard do 1f6844e910: bastava existir, em qualquer Account, um Proponente principal aprovado de outro IdCliente para descartar `contato-update` e `endereco-update` legítimos.
- **Harness (em parte):** O guard roda nos parciais que passam pelas regras antigas e disparou 0 vezes na campanha. Nenhuma asserção separa o efeito de um parcial legítimo do da PAC aprovada, então nem o falso positivo do 1f6844e910 seria pego.
- **Regra R1:** Conferência da identidade do parcial contra a Account; na reescrita, vai para o ponto único de escrita da R3. Pela R5, o parcial com prospect alheio seria aplicado pelo IdCliente, ignorando o prospect, em vez de descartado.
- **Na ponta (sobrevive):** É a ponta.
- **Relação:** Corrige o guard do 1f6844e910. Não alcança o B6 nem o passo 2 do B9, cujos parciais o `prospectPertenceAOutraConta` descarta antes.

## 5. O que o harness não cobre

Comportamentos que estes commits corrigem e que nenhum TC exercita. Na reescrita, cada um precisa de teste próprio antes de sair ou mudar.

- [`12182e7e78`](#c13) (R1): Um evento de jornada sem IdCliente, resolvido pelo prospect da jornada, levava de volta para X a Opportunity que já estava ligada a Y.
- [`fbd67a1216`](#c15) (fica): Um evento de jornada fora de ordem, sem Account porque o match por prospect foi descartado, ia para a fila manual mesmo já tendo sido superado.
- [`fc7077f94d`](#c16) (R1): No encerramento da Venda Genérica, a PAC que só trazia o IdCliente no `idProponente` não achava a Account e ia com erro para a fila do Event Grid.
- [`fe1d5a610c`](#c23) (infra): Um lock no Proponente fazia o savepoint desfazer o Lead criado e o vínculo da Account.
- [`ec9d1a6a7c`](#c24) (fica): Eventos de jornadas antigas, com IdCliente obsoleto, iam para a fila manual depois do descarte de match da 2.2.
- [`dea0460ade`](#c26) (fica): A Opportunity criada pela jornada ficava com o usuário padrão em vez do dono, da equipe e do gerente do Lead.
- [`9f0ba21f38`](#c38) (fica): Uma jornada de Venda Genérica com estado sem fase mapeada gravava StageName vazio; a Opportunity falhava por campo obrigatório e o evento ia para a fila manual.
- [`72cbd884f6`](#c44) (infra): O Lead novo de Y era desfeito pelo rollback do savepoint quando o update da Account batia em `UNABLE_TO_LOCK_ROW` (relato de staging).
- [`9210581ea5`](#c45) (R1): Regressão do 1f6844e910: jornada (e PAC) sem IdCliente e sem CPF perdia o match pelo prospect e ia para a fila manual com 'Cliente(Account) não encontrado'.
- [`7c86318a05`](#c46) (R1): Depois do 9210581ea5, essa jornada tinha o match descartado e ia para a fila manual, mesmo com a Opportunity já na Account do prospect, porque o vínculo histórico não via o CPF.

## 6. Achados da leitura

Fatos que valem para mais de um commit e que a reescrita precisa levar em
conta. A última coluna diz como cada um foi verificado.

| Achado | Commits | Verificação |
|---|---|---|
| O guard de parciais só repete a regra antiga: em 2.001 parciais da campanha com os commits, disparou 0 vezes. 1.515 caíram no `prospectPertenceAOutraConta` e 100 no `deveDescartarMatchPosPac` | `1f6844e910`, `3f2919f5e7`, `09dadb24bf`, `b372038f43` | logs da campanha |
| A comparação entre as campanhas mede só os cinco últimos commits: `c04b6add92`, `d6f147d303` e `a6d1f4c64c` estavam na dev nas duas | `c04b6add92`, `d6f147d303`, `a6d1f4c64c` | estado da dev |
| B9, passo 3: o e-mail aprovado chega ao Lead Y antes da reconciliação, pela pendência e pelo reflexo da Account para o Lead; depois, a `POS_PAC_APROVADA` tenta trocar só o celular, que no 055 e no 056 é barrado por colisão com o Lead Z | `07608bac4a`, `c04b6add92`, `d6f147d303`, `a6d1f4c64c` | log da reconciliação no `TC055-AR-6dbf3c` ("sobrescrita barrada por colisao", `celularColidiu=true`); o caminho do e-mail, pela leitura |
| O B9 também acontece no TC-044 (AR e FW): o Lead Y termina com o e-mail e o celular aprovados. Não é contado porque o TC não confere os contatos do Lead Y | `1f6844e910` | dados da campanha |
| B6: no `insertLeadQueueable`, o ramo que reutiliza o Lead do mesmo CPF preenche e-mail e celular vazios sem conferir se pertencem a outra pessoa. É o que grava no Lead de Y, na repetição do WebJob, os contatos que colidem com X ou Z | `509c87ad24`, `2eef5b7ba2`, `1195c8984b` | leitura, coerente com os logs do B6 |
| K2 nos perfis de ordem CA: sem PAC em análise de Y, o Proponente achado pelo prospect da jornada é o da PAC de X, e o candidato é procurado pelos contatos de X. Explica também por que o 012 e o 013 passam: o contato compartilhado é de X | `d914e60785`, `3029bcfb6d`, `78a25da643` | hipótese da leitura, não reproduzida à parte |
| O reflexo da Account para o Proponente (`refletirAlteracoesDadosProponentes`) copia nome, e-mail e celular para todos os Proponentes da Account, sem conferir CPF. Foi reduzido ao nome e restaurado no dia seguinte | `d0e2635a70`, `07608bac4a`, `da90427ced` | leitura |
| A sincronização pós-PAC grava os contatos da Account do Proponente principal sem conferir a data. É por ela que a PAC aprovada troca os contatos da Account Y no B9 | `70f3295319`, `c04b6add92` | leitura |
| A 2.2 sozinha não compila: o `ClienteSelector` chama `CpfCNPJ.expandirFormatosCPF`, que só existe na 2.1 (`094926c608`); nem o branch nem o `origin/develop` de 09/10 têm o método | `da90427ced` | leitura da ponta e do `origin/develop` |
| A regra Perdido→Cancelado da PAC não dispara na ponta: o `preencherDadosPAC` lê `this.oportunidade` antes de a `obterPAC` carregá-la (linhas 116, 118 e 223 da `NotificacaoPAC`). O cenário de catálogo `pac-insert-opportunity-perdida-forca-cancelado` deve acusar isso | `07608bac4a`, `a1eef12c11` | leitura; não testado ao vivo |
| Falhas de DML que não sejam lock na `ReconciliacaoContatosLeadQueueable` somem sem rastro: os logs saíram, e o `catch` do enqueue ficou vazio. O harness também não veria, porque o job termina sem erro | `68e7cfc856` | leitura |
| O CPF tirado do `proponentecredito` da jornada não é exercitado em lugar nenhum: nem o harness nem os payloads de jornada da API trazem esse bloco | `c47170d879`, `9210581ea5`, `7c86318a05` | leitura do harness e do catálogo |
| E-mail e celular nunca entraram na busca de Account do pós-PAC. Antes do `c47170d879`, ela usava o IdCliente e o prospect numa só consulta, com `null` para os contatos. Os dois saíram da busca do Iniciar Jornada (2.1, `b60c6ae4b9`; 2.2, `da90427ced`) e seguem na `NotificacaoLead` | `c47170d879`, `da90427ced` | leitura do pai do `c47170d879` (`ClienteSelector`, linha 192) e da 1.3 (`ClienteService`, linhas 545 e 552) |
| A 1.3 já tem a busca do `c47170d879` (`6af00f4bc3` e `539bcbfa73`), mas nenhuma das três entradas do pós-PAC a chama. O cherry-pick sobre a 1.3 conflita só no `ClienteSelector` e no `NotificacaoCliente` | `c47170d879` | `git grep` e `git merge-tree` sobre `GV_909649_918914` |
