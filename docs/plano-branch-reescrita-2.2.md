# Plano do branch da reescrita da 2.2

Ordem de trabalho para refazer a Unificação 2.2 no branch local
`GV_909649_918914` do `com_salesforce_mrv`. O branch foi criado em 17/10 a
partir da ponta da 1.3 (`1ef8425b91`, `GV_909649`, 16/09). O que cada commit
da 2.2 faz e em que regra cai está no
[inventário dos commits da 2.2](inventario-commits-2.2.md). O alvo está no
[critério de aceite](criterio-de-aceite-unificacao-2.2.md), e os bugs, no
[catálogo](bugs-pegos-pelo-runbook.md).

- **Decisão de 18/10:** entra só a 2.2. A 2.1 fica fora por enquanto (seção
  1.4).
- **Quem faz o quê:** os commits, os cherry-picks e os deploys são do usuário.
  Este plano diz a ordem, os conflitos e como medir.
- **Onde rodar:** os comandos `git` e `sf project deploy` rodam no
  `com_salesforce_mrv`. Os comandos `npm` e o `versao-implantada.ts` rodam no
  `ms-cliente-simulator`. Os caminhos relativos deste documento partem do
  `ms-cliente-simulator`.

> **Como foi feito.** Em 18/10, com git só de leitura no `com_salesforce_mrv`,
> com simulações por `git merge-tree` e por cherry-pick num clone à parte no
> scratchpad, sem tocar no checkout do usuário. Também com consultas de
> leitura (Tooling API) na `mrv-devDan`. Nenhum teste Apex rodou e nada foi
> implantado. O que se diz sobre compilação e testes vem da leitura do código,
> das simulações e dos resultados de teste que já estavam na org. O plano
> passou por uma revisão adversarial em três frentes: git, Apex e coerência
> com os outros documentos.

> **Pendência máxima (19/10):** o `pac-update` sobre PAC existente quebra com
> o código do master, que é o da produção. A regra Perdido→Cancelado chegou lá
> sem o campo no seletor. A correção (`9559725a48`) já está no develop e no
> `GestaoVendasPreProd__c`, mas não na preprod nem no master. Falta confirmar
> na produção, que ainda não tem acesso, e saber quando a correção sobe (seção
> 7, "Alerta de produção").

**Em resumo:**

| Etapa | O que entra | Contra o quê se mede |
|---|---|---|
| 0. Preparação | pasta das campanhas, decisões de alvo (seção 7), ajustes do classificador (seção 3.3) | — |
| 1. O que fica | flow `PermutaCadastroCliente`, `fbd67a1216`, `dea0460ade`, `9f0ba21f38`, a regra Perdido→Cancelado e as 3h da data da PAC | testes Apex das classes tocadas |
| 2. Ponto zero | deploy da etapa 1 na dev, retrato da dev e campanha completa | é a linha de base |
| 3. R1 e R2 | `c47170d879`, o commit da R2 e o resto da R1 | o ponto zero |
| 4. R3 | ponto único de escrita de contato na Account | a etapa 3 |
| 5. R4 | política única de Lead, mais os commits adiados de lock e teste | a etapa 4 |
| 6. R5 | prospect de outra pessoa ignorado | a etapa 5 |
| Pronto | seção 7 do critério de aceite | a campanha alinhada de 12/10 |

## 1. Ponto de partida

### 1.1 O branch

- **Commits:** `GV_909649_918914` está em `1ef8425b91`, sem commit próprio.
- **Working tree:** três mudanças locais.
  - `.gitignore` e `.sf/config.json`: não commitar. O `.sf/config.json` aponta
    para a `mrv-devDan`, mas todo comando `sf` deste plano passa
    `--target-org mrv-devDan` mesmo assim.
  - `PermutaCadastroCliente.flow-meta.xml`: as 12 linhas de
    `regionContainerType` do `f2f34b48c5` (02/09, RDM 46500), que já está no
    master e na preprod. Só muda a indentação. **A mudança é obrigatória:** sem
    ela, o flow do HEAD não implanta. A validação `0AfHZ00000QtjK60AJ`, de
    18/10, falhou por isso.
- **O que a 1.3 já tem da 2.2:**
  - a busca do `c47170d879` (seletores, `getClientePosPac`,
    `deveDescartarMatchPosPac`), sem chamador (inventário, item 6);
  - o conteúdo do `fbbde9da5c`: a fórmula da regra `PreencherEmailOuCelular` é
    idêntica e entrou na 1.3 pelo `0f9014e393`.
- **O que a 1.3 não tem:** nada da escrita de Lead nem de contato da 2.2.
  - O `NotificacaoCliente` não cria Lead para Y: não há `insertLeadQueueable`
    nem `criarLeadDoCliente`.
  - Não existem `MSClienteService` nem `ReconciliacaoContatosLeadQueueable`.
  - A pendência grava o e-mail na Account pelo flow `Proponente_1`, com
    `Now()`, a cada save do Proponente.

### 1.2 A dev

- **Desde 18/10, a dev está na 1.3.** Os deploys de 18/10 (UTC) puseram nela a
  versão de `1ef8425b91` no recorte da unificação. As 48 classes têm o corpo
  igual ao do commit.
  - **01:51, `0AfHZ00000QtjyP0AR`:** 56 componentes, sem testes. Entre eles,
    as classes, a `ProponenteTrigger`, os LWCs `iniciarJornadaLead`,
    `validaEmail` e `atualizaEmailContaAura`, os flows `AlterarDadosLead` v17,
    `CadastroParceiro` v17 e `Proponente_1` v4, e a regra
    `PreencherEmailOuCelular`.
  - **02:05, `0AfHZ00000QtkhZ0AR`:** apagou as 5 classes que só existem pela
    2.2: `MSClienteService`, `MSClienteServiceTest`,
    `ReconciliacaoContatosLeadQueueable`,
    `ReconciliacaoContatosLeadQueueableTest` e `ProponenteTriggerHandlerTest`.
  - **02:07:** foi excluída a v16 do `AlterarDadosLead`, a do PR 112208
    (`1cf24e9365`, 02/09). Ela está no `origin/copy_develop` e no
    `origin/develop_merge_superapp`, não no `origin/develop` de hoje. Usava
    propriedades do `campoFlow` do develop e travava o deploy seguinte.
  - **02:08, `0AfHZ00000Qtko10AB`:** o `campoFlow` da 1.3 e o
    `PermutaCadastroCliente` v14, este a partir da cópia de trabalho, com a
    mudança não commitada.
- **O retrato está desatualizado.** O
  [estado da dev](estado-da-mrv-devDan.md) ainda descreve 11/10. Ele é refeito
  depois do deploy do ponto zero (seção 3.2), cobrindo também os deploys de
  18/10.
- **Classes de teste fora do branch:**
  - o `PesquisarContaControllerTest` é a versão com a US 1026579 e não compila
    contra o controller da 1.3;
  - o `OportunidadeSelectorTest` é a do `develop_merge_superapp`.

  O harness não roda teste Apex, mas um deploy com `RunLocalTests` falha pelo
  primeiro. Os dois entram no deploy do ponto zero.
- **O `pac-update` sobre PAC existente quebra na dev de hoje.** A linha 204 da
  `NotificacaoPAC` lê `Oportunidade__r.StageName`, e a consulta da PAC não
  traz o campo. Lançam `SObjectException` e respondem 400:
  - todo `pac-update` com status preenchido e diferente de
    `ANALISE_NAO_INICIADA` sobre uma PAC que já existe;
  - todo `pac-insert` sobre uma PAC que já existe.

  O harness para no primeiro `pac-update`. A seção 2.1 trata disso.

### 1.3 As campanhas anteriores

- **Os JSONL se perderam.** Os arquivos das campanhas de 11/10 e 12/10, e a
  extração da planilha, estavam no scratchpad de uma sessão e não existem
  mais. Sem eles, o `--comparar` automático contra 12/10 não roda.
- **A base de comparação passa a ser o relatório.** O
  [resultado da campanha alinhada](resultado-runbook-completo-alinhado-2026-10-12.md)
  guarda a matriz de todos os pares e, por RUN divergente, as asserções que
  falharam. O catálogo, na seção 3.4, tem a matriz por bug. Ela omite os TCs
  em que tudo passou, então a comparação é célula a célula.
- **Daqui em diante, os JSONL ficam fora do `/tmp`**, em
  `../campanhas-runbook/`, com um nome por etapa: `etapa-N-AAAA-MM-DD.jsonl`
  (o ponto zero é a etapa 2). Criar a pasta antes, na etapa 0: o `run.ts`
  grava com `appendFile` e não cria o diretório.

### 1.4 O que fica fora do branch

- **A 2.1** (`feature/gv_918899_unificacao_clientes`), por decisão de 18/10.
  - **O que a 2.2 perde:** dos 47 commits, só o `da90427ced` chama código que
    só existe na 2.1. Ele não entra, e nada depois dele depende do que ele
    cria. A busca por CPF com máscara, que ele fazia com o
    `expandirFormatosCPF`, vira a lacuna 5 da etapa 3 (seção 4.3). A cadeia
    real do critério (item 3) espera a 2.1.
  - **O que fica no pré-PAC:** o Iniciar Jornada da 1.3, que busca a Account
    também por celular, e-mail e telefone, depois do CPF. Num teste manual, o
    Lead X sem Account pode ser ligado à Account de outra pessoa com o mesmo
    contato. O harness não chama o pré-PAC e não pega isso.
  - **Se a 2.1 entrar depois:** o melhor caminho é um merge único da ponta
    `1c108fecd1`. São 6 commits lineares, e o cherry-pick obrigaria a resolver
    os mesmos trechos três ou quatro vezes.
    - O merge conflita com a 1.3 no `ClienteSelector` (4 trechos), no
      `ClienteSelectorTest` (1) e no `ClienteService` (3).
    - A resolução do `origin/copy_develop` serve inteira para os dois
      primeiros. No `ClienteService`, servem só os trechos, porque o arquivo de
      lá traz cerca de 800 linhas da 2.2.
    - No mesmo merge, três testes da 1.3 no `ClienteServiceTest` precisam sair
      ou mudar: eles esperam a busca de Account por celular, e-mail ou
      telefone, que a 2.1 tira.
- **A US 1026579** (obrigatoriedade de CPF): segue em PR próprio.
  - Ela muda 7 arquivos: `PesquisarContaController` e o teste, o flow
    `AlterarDadosLead` e os LWCs `botaoNovoCliente` e `iniciarJornadaLead`.
    Nenhum é da 2.2.
  - Contradiz o TC-004 ("jornada iniciada sem CPF").
  - Os 13 TCs da planilha rotulados com ela não tratam de CPF obrigatório: o
    022 e o 038 a 041 são cenários da 2.2, e o 030 a 037, de proponente
    adicional.

## 2. Etapa 1: o que fica

Os commits que entram, na ordem, com os conflitos da simulação em cadeia sobre
`1ef8425b91`:

| # | Commit | O que traz | Conflito e resolução |
|---|---|---|---|
| 0 | `f2f34b48c5` | `regionContainerType` no `PermutaCadastroCliente` | `git restore -- force-app/main/default/flows/PermutaCadastroCliente.flow-meta.xml` e depois `git cherry-pick -x f2f34b48c5`. Entra limpo e guarda a origem. |
| 1 | `fbd67a1216` | Jornada obsoleta sem Account responde 200, em vez de ir para a fila manual | No `NotificacaoMaquinaEstadoTest`, ficar com o arquivo da 1.3 e acrescentar só o `deveIgnorarEventoObsoletoSemClienteTest`. O lado da 2.2 traz junto o `obterCpfProponentePorIdClienteTest`, do `c47170d879`, que não compila na base. |
| 2 | `dea0460ade` | A Opportunity herda dono, equipe e gerente do Lead | No `LeadSelector.buscarLeadPorIdExterno`, unir os campos: `Id, Status, Name, FirstName, LastName, Email, MobilePhone, CelularSemFormatacao__c, CPF__c, Ges_RendaMensal__c, Id__c, OwnerId, GES_Equipe__c, Ges_GerenteAtual__c`. Sem os três últimos, o `herdarEstruturaComercialDoLead` falha em execução. No `NotificacaoMaquinaEstadoTest`, acrescentar os dois testes `herdarEstruturaComercialDoLead*` e tirar o `devePreservarContaAtualDaOportunidadeTest`, que chama método ausente na base. |
| 3 | `9f0ba21f38` | Não grava StageName vazio na Venda Genérica | Limpo. Conferir que os 3 testes dele entraram. |
| 4 | commit novo | Regra Perdido→Cancelado da PAC, gravando `CANCELADA` (seção 2.1) | — |
| 5 | commit novo | 3h nas datas da PAC que chegam sem fuso (seção 2.2) | — |

O `fbbde9da5c` não entra: o conteúdo dele já está na base, e o cherry-pick
sairia vazio.

Antes do deploy, conferir no `com_salesforce_mrv`:

```bash
git grep -nE '^(<<<<<<< |=======$|>>>>>>> )' -- force-app
git grep -nE 'obterCpfProponentePorIdCliente|devePreservarContaAtualDaOportunidade' -- force-app
git diff --check 1ef8425b91..HEAD -- force-app
git diff --stat 1ef8425b91..HEAD -- force-app
```

- **Os três primeiros devem vir vazios.** A regex do primeiro é ancorada de
  propósito: a base tem um comentário que começa com `===` no
  `NotificacaoPlanoFinanciamentoChamada.cls`.
- **O último deve listar só:** o flow, o `LeadSelector`, a
  `NotificacaoMaquinaEstado`, os testes das duas e o que os itens 4 e 5
  tocarem.

**No simulador, ainda nesta etapa:**
- criar a v2 do cenário `pac-insert-opportunity-perdida-forca-cancelado`, com
  `ANALISE_NAO_INICIADA` e `CANCELADA` esperado;
- criar o par para o `pac-update` (seção 2.1).

### 2.1 A regra Perdido→Cancelado

**O defeito.** A regra do `305a3060c7` (24/04) está na linha 204 da
`NotificacaoPAC` e lê `Oportunidade__r.StageName`. Ela chegou à preprod e ao
master pela metade, sem o campo no seletor (seção 7, "Alerta de produção").
- **PAC que já existe** (`pac-update`, ou `pac-insert` num reenvio): o
  registro vem da `getPacsByIdExternoForUpdate`, que não traz o campo. O
  resultado é `SObjectException`.
- **`pac-insert` de PAC nova:** não quebra. A relação é nula, e o Apex devolve
  `null`. A regra simplesmente não dispara.
- **`pac-update` com `ANALISE_NAO_INICIADA`:** volta antes, na linha 70, sem
  passar pela regra.

**Confirmado na dev em 19/10 (01:38 UTC)**, que roda os mesmos blobs da
`NotificacaoPAC`, do `PropostaAnaliseCreditoSelector` e do `EventGrid` que o
master e o `origin/GestaoVendasPreProd`. No RUN `TC003-PA-9a2ca9`:
- o `pac-insert` da PAC nova respondeu 200;
- o `pac-update` respondeu 400, com `System.SObjectException: SObject row was
  retrieved via SOQL without querying the requested field:
  Opportunity.StageName`.

**Duas saídas:**

| | `a1eef12c11` | Commit novo |
|---|---|---|
| O que faz | Põe `Oportunidade__r.StageName` nas duas consultas do `PropostaAnaliseCreditoSelector` | Carrega a Opportunity pelo `idjornadapac` antes do `preencherDadosPAC` e lê `this.oportunidade.StageName`, com null-check, no texto do `07608bac4a` |
| PAC existente | conserta | conserta |
| `pac-insert` de PAC nova | a regra continua sem disparar | a regra passa a disparar |
| Volta à preprod (`origin/GestaoVendasPreProd`) | entra limpo. O campo só ficaria repetido no SOQL contra o `origin/GestaoVendasPreProd__c` e o `origin/develop`, que têm o `9559725a48` | entra limpo, e o seletor não muda |

**Decisão de 18/10: o commit novo,** porque a regra vale também no
`pac-insert`.

**O literal é `CANCELADA`, não `Cancelado`.**
- `Cancelado` não falha na gravação, porque o `Status__c` é texto (50).
- Mas só `CANCELADA`, o valor do crédito (`StatusPacEnum.java:5`), é
  reconhecido:
  - pela fórmula `StatusFormula__c`, que mostra "Cancelada";
  - pelo `PropostaAnaliseCreditoHelper.encerrarOportunidadePACCancelada`.
- Com `CANCELADA`, o helper roda e não muda a Opportunity, que já está fechada
  como Perdido: ele só mexe em Opportunity aberta.

O diff do commit novo:

```diff
@@ obterPAC
-        this.preencherDadosPAC();
-  
+        // A Opportunity vem antes de preencherDadosPAC: a regra Perdido -> Cancelado (305a3060c7) depende do StageName dela
+        this.idOportunidadeExterno = String.valueOf( super.data.get( 'idjornadapac' ) );
         this.oportunidade = OportunidadeSelector.getInstance().selectOportunidadePorIdExternoParaConsulta( this.idOportunidadeExterno );
+
+        this.preencherDadosPAC();
@@ preencherDadosPAC
-            this.propostaAnaliseCredito.Status__c = this.propostaAnaliseCredito.Oportunidade__r.StageName == 'Perdido' ? 'Cancelado' : status;
+            this.propostaAnaliseCredito.Status__c = this.oportunidade != null && this.oportunidade.StageName == 'Perdido' ? 'CANCELADA' : status;
```

A `selectOportunidadePorIdExternoParaConsulta` já traz o StageName. A linha
`this.idOportunidadeExterno = ...` do `preencherDadosPAC` fica, e o número de
SOQL não muda.

**Testes no `NotificacaoPACTest`.** Pôr os métodos novos depois do
`contaNaoEncontradaTest` (linha 501 da base), e não no fim, para entrarem
limpos na preprod, que acrescenta testes depois do `realizaPostTest`.

| Teste | Cenário | Esperado com o commit novo | Na base |
|---|---|---|---|
| (a) | `pac-insert` de PAC nova, `ANALISE_NAO_INICIADA`, Opportunity inserida direto em Perdido | 200, 1 PAC, `CANCELADA` | 200, status do payload |
| (b) | `pac-update` `CREDITO_REPROVADO`, PAC existente, Opportunity em Perdido | 200, `CANCELADA`, Opportunity sem mudança | `SObjectException` |
| (c) | o mesmo, com a Opportunity em New | 200, `CREDITO_REPROVADO` | `SObjectException` |
| (d) | `pac-update` sem PAC prévia, Opportunity em Perdido | 200, 1 PAC, `CANCELADA` | 200, status do payload |
| (e) | `pac-insert` sem Opportunity: reforçar o `oportunidadeNaoEncontradaTest` (linha 586), que hoje só confere o corpo | mensagem "Oportunidade n…", nenhuma PAC, `statusCode >= 400` | igual |

Notas:
- **Não dá para testar uma PAC sem Opportunity:** o `Oportunidade__c` é
  MasterDetail.
- **O código de erro depende da org.** Ele vem do
  `Error_Response_Mapping__mdt`. A `mrv-devDan` não tem nenhum registro e
  responde 400 a tudo, por isso o teste (e) não fixa o código. Pelo mesmo
  motivo, o `erroRequisicaoTest` falha na dev com ou sem este commit.
- **O que prova a regra:** os testes (a) a (d) e o cenário de catálogo v2. O
  `NotificacaoPACTest` da 1.3 só usa `ANALISE_NAO_INICIADA` e não chega à
  regra. A fumaça do harness (seção 3.4) prova só que o `pac-update` deixou de
  lançar a exceção, porque nenhum TC usa Opportunity em Perdido.

Mensagem sugerida: `[918914] - [UNIFICAÇÃO DE LEADS] PAC: regra
Perdido→Cancelado lê a Opportunity da jornada (sem SObjectException no
pac-update)`.

### 2.2 As 3h nas datas da PAC

O crédito manda as datas sem fuso, no horário de Brasília. A ponta da 2.2 soma
3h na `NotificacaoPAC`, com o override de `parseDateTime` que veio no
`c04b6add92`. O `c04b6add92` é da R4, mas esse trecho é independente. Sem ele,
a asserção do perfil RC "data da PAC aprovada gravada em UTC" falha em todas
as etapas.

**As três trocas do `c04b6add92`:**
1. o override, logo depois do `criaSObjectExistente`, onde o `c04b6add92` o
   pôs:

   ```apex
   @TestVisible
   protected override DateTime parseDateTime( String dataHoraString )
   {
       if ( String.isBlank( dataHoraString ) )
       {
           return super.parseDateTime( dataHoraString );
       }
       String s = dataHoraString.trim();
       if ( s.endsWith( 'Z' ) || s.endsWithIgnoreCase( 'GMT' )
            || s.substring( Math.max( 0, s.length() - 6 ) ).contains( '+' )
            || s.substring( Math.max( 10, s.length() - 6 ) ).contains( '-' ) )
       {
           return super.parseDateTime( s );
       }
       DateTime bruto = super.parseDateTime( s );
       return bruto == null ? null : bruto.addHours( 3 );
   }
   ```

2. no `DataAprovacao__c` (linha 168 da base), `super.parseDateTime(
   dataAprovacao )` vira `this.parseDateTime( dataAprovacao )`;
3. no `DataResolucaoPendencias__c` (linha 344), o
   `DateTime.valueOf(dataAlteracaoPacFlagsStr.replace( 'T', ' ' ).replace(
   '.000Z', '' ))`, que lê no fuso do usuário, vira `this.parseDateTime(
   dataAlteracaoPacFlagsStr )`.

**Por que funciona:** o `DataAlteracaoEvento__c` que o RC confere vem do
`EventGrid` (linha 101), que chama `this.parseDateTime`. O método do pai é
`protected virtual`, e o override vale. Nenhuma outra classe muda.

**Teste:** o `parseDateTimeCorrigeFusoBRTPacUpdateTest`, depois do
`contaNaoEncontradaTest`, como na seção 2.1.

Mensagem sugerida: `[918914] - [UNIFICAÇÃO DE LEADS] PAC: datas sem fuso
gravadas em UTC (soma de 3h do c04b6add92)`.

## 3. Etapa 2: ponto zero

O ponto zero mede a 1.3 com o que fica, sem nada da camada de identidade e
contatos da 2.2. É a linha de base das etapas seguintes.

### 3.1 Deploy

A dev já está na 1.3 desde 18/10. O deploy leva só o que a etapa 1 mudou, mais
as duas classes de teste da seção 1.2. Não precisa de destrutivo.

Rodar a partir do `com_salesforce_mrv`, com o checkout no branch e o working
tree sem mudanças em `force-app`. Salvar o manifest abaixo como
`manifest-ponto-zero.xml` na raiz do repositório, sem commit.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>LeadSelector</members>
        <members>LeadSelectorTest</members>
        <members>NotificacaoMaquinaEstado</members>
        <members>NotificacaoMaquinaEstadoTest</members>
        <members>NotificacaoPAC</members>
        <members>NotificacaoPACTest</members>
        <members>OportunidadeSelectorTest</members>
        <members>PesquisarContaControllerTest</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>PermutaCadastroCliente</members>
        <name>Flow</name>
    </types>
    <version>65.0</version>
</Package>
```

Com o `a1eef12c11` no lugar do commit novo, entra também o
`PropostaAnaliseCreditoSelector`. A `NotificacaoPAC` e o teste dela continuam
no pacote por causa do item 5.

1. **Validar:**

   ```bash
   sf project deploy start --target-org mrv-devDan --manifest manifest-ponto-zero.xml --dry-run \
     --test-level RunSpecifiedTests --tests NotificacaoMaquinaEstadoTest --tests LeadSelectorTest \
     --tests NotificacaoPACTest --tests PesquisarContaControllerTest --wait 60
   ```

2. **Ler as falhas.** Com `RunSpecifiedTests`, uma falha derruba o deploy.
   - **`erroRequisicaoTest`:** falha na dev de qualquer jeito (seção 2.1).
   - **`NotificacaoMaquinaEstadoTest`:** nunca rodou com a 1.3 e estes
     commits. O `dea0460ade` tirou a herança do dono de dentro do
     `!Test.isRunningTest()`, então o `atribuirProprietariosOportunidade*Test`
     e o `leadOrigemMIATest` podem mudar de resultado.
   - **Cobertura:** com o `a1eef12c11`, se acusar menos de 75% no
     `PropostaAnaliseCreditoSelector`, acrescentar o
     `NotificacaoContestacaoTest` e o `ContestacaoTriggerHandlerTest`.
3. **Implantar.** Se só as falhas conhecidas aparecerem, implantar sem
   testes, o que a sandbox aceita:

   ```bash
   sf project deploy start --target-org mrv-devDan --manifest manifest-ponto-zero.xml --test-level NoTestRun --wait 60
   ```

4. **Rodar os testes à parte** e registrar o resultado:

   ```bash
   sf apex run test --target-org mrv-devDan --class-names NotificacaoMaquinaEstadoTest --class-names LeadSelectorTest \
     --class-names NotificacaoPACTest --class-names PesquisarContaControllerTest --result-format human --wait 30
   ```

### 3.2 Conferir a dev

A partir do `ms-cliente-simulator`, com o checkout do `com_salesforce_mrv` em
`GV_909649_918914` e os commits aplicados:

```bash
node scripts/analise-staging/versao-implantada.ts --org mrv-devDan --repo ../com_salesforce_mrv
```

- **O script compara com as refs `origin/`.** Quando nenhum branch bate, ele
  procura em todas as refs e na cópia de trabalho. Por isso o checkout precisa
  estar no branch na hora de rodar.
- **O que esperar:**
  - "1.3: igual à ponta" nos arquivos da 1.3 que a etapa 1 não tocou. Às vezes
    vem antes um "2.2: não bate", como no `ClienteService`, no
    `NotificacaoCliente`, no `ClienteSelector`, no `Ges_LeadSelector`, no
    `AccountRepository` e na `PreencherEmailOuCelular`.
  - "igual à cópia de trabalho do checkout" nos arquivos que a etapa 1 mudou e
    nos que só a 2.2 muda (`ProponenteTriggerHandler`, `ProponenteTrigger`,
    `Proponente_1`).
  - "não existe na org" no `MSClienteService` e na
    `ReconciliacaoContatosLeadQueueable`.
- **O que o script não confere:**
  - as classes `*Test`, menos o `ProponenteSelectorTeste`, que termina em
    "Teste";
  - o `campoFlow`, o `Email`, o `EmailUtil`, o `PesquisarContaController`, o
    `CadastroParceiro`, o `validaEmail` e o `atualizaEmailContaAura`.

  Conferir esses pela Tooling, sempre com `--target-org mrv-devDan`.
- **Depois:** refazer o [estado da dev](estado-da-mrv-devDan.md) com os
  deploys de 18/10 e o do ponto zero.

### 3.3 Ajustes no harness

O `run.ts` só grava o JSONL. O `runbook:relatorio` e o `runbook:bugs` releem o
arquivo. Por isso os ajustes abaixo podem vir antes ou depois da campanha e
valem para o mesmo JSONL.

- **Comparar por asserção.** Um bug corrigido numa célula que continua
  divergente por outro motivo some da contagem por célula. A comparação deve
  usar TC × perfil × nome da asserção (`ResultadoRun.assercoes`).
- **Rótulos por etapa no classificador.** Hoje ele foi afinado para a 2.2.
  Precisa de três rótulos novos:
  - a sobrescrita de X pelo `cliente-insert`, no ponto zero;
  - B7 só com 2 Leads ou mais;
  - "pendente R4", até a etapa 5, para as asserções de Lead:
    - `N Lead(s) com o CPF aprovado`;
    - `Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c)`;
    - `Lead novo vinculado, …`;
    - `Lead <ref> reutilizado e vinculado…` (`leadCandidato`, `leadY`,
      `leadY2`, `leadX`);
    - `Proponente principal na Account aprovada…`, com o PROS-Y.
- **Cabeçalho do relatório:** marcar a campanha como linha de base da 1.3
  (`scripts/runbook/relatorio.ts`).

**Feito em 20/10** (`scripts/runbook/etapas.ts`, `classificar-bugs.ts` e
`relatorio.ts`):
- **A etapa:** vem de `--etapa N` ou do nome do arquivo
  (`etapa-N-AAAA-MM-DD.jsonl`). Na comparação, a campanha anterior usa
  `--etapa-anterior` ou o próprio nome. Sem etapa, a campanha é da 2.2, e
  nada muda na classificação dela.
- **"pendente" de cada regra:** antes da etapa que traz a regra, o que ela
  resolve sai como "pendente R1", "pendente R3", "pendente R4" ou "pendente
  R5". Da etapa da regra em diante, a mesma falha sai como `?`.
- **A sobrescrita de X pelo `cliente-insert`:** "pendente R1". O classificador
  a reconhece pelo mecanismo: X (a Account ou o Lead) ficou com outro
  IdCliente ou outro CPF. Nas campanhas da 2.2, isso nunca aconteceu.
- **O que cai junto com ela:** "Account aprovada é nova" ou "é a `<ref>`", as
  contagens de Account e de Lead do CPF e o Caso C saem como "pendente R1"
  (consequência). Sem isso, o Lead X com o CPF de Y contava como B7.
- **O B7:** só com dois Leads ou mais, em qualquer etapa.
- **"pendente R4":** as asserções de Lead da lista acima. Tem prioridade sobre
  o K2, o B5, o B6, o B9 e o B10, mas não sobre o B7.
- **Rótulos que a campanha do ponto zero pediu** (seção 3.5):
  - "pendente R1": a PAC de X que não acha X (TC-004) e a Opportunity da
    Venda Genérica (lacuna 8);
  - "pendente R3": o contato atrasado que vence no RC;
  - "pendente R5": o `DUPLICATE_VALUE` do PROS-X gravado na Account Y.
- **A comparação por asserção:** três tabelas novas no `--comparar`: as
  asserções que passavam e agora falham, as que falhavam e agora passam e as
  que seguem falhando com outro rótulo.

### 3.4 Campanha

A partir do `ms-cliente-simulator`:

1. **Fumaça,** para ver se o `pac-update` responde 200. No PA, o TC-040 para
   no K1 antes de qualquer `pac-update`, por isso ele fica fora:

   ```bash
   npm run runbook -- --tcs TC-001,TC-003,TC-026 --perfis PA,CA,AR --org-alias mrv-devDan --saida ../campanhas-runbook/etapa-2-fumaca-AAAA-MM-DD.jsonl
   ```

2. **Campanha completa,** com 484 RUNs (cerca de 50 min em 12/10):

   ```bash
   npm run runbook -- --todos --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL --paralelo 6 --org-alias mrv-devDan --saida ../campanhas-runbook/etapa-2-AAAA-MM-DD.jsonl
   npm run runbook:relatorio -- --entrada ../campanhas-runbook/etapa-2-AAAA-MM-DD.jsonl --saida docs/resultado-runbook-etapa-2-AAAA-MM-DD.md
   npm run runbook:bugs -- --entrada ../campanhas-runbook/etapa-2-AAAA-MM-DD.jsonl
   ```

### 3.5 O que esperar

Pela leitura, sem rodar:

- **Account X é sobrescrita pelo prospect.** O `cliente-insert` de Y com o
  PROS-X sobrescreve a Account X: é o bug que o `3f4b3f0906` corrigiu. O
  classificador vai rotular isso como B1, B2 ou B8.
- **TC-038:** em C1, AR e FW, sem IdCliente, a PAC em análise acha X pelo
  prospect, e o rótulo é B1. O B3 só volta com o `c47170d879`, na etapa 3.
- **Não nasce Lead para Y.** As asserções de Lead (seção 3.3) falham na
  maioria dos TCs. A exceção são os de MATCH (003, 004, 039) e de Caso C (024,
  027, 048), que não pedem Lead novo.
  - No FW, a falta de Lead sai com o rótulo B7, sem o mecanismo do B7.
  - Nos TCs do Lead candidato (012, 013, 045, 046 e 049), a falha sai como K2
    ou B5 em todos os perfis.
- **"Opportunity na Account aprovada" falha** no AR e no FW dos TCs de Venda
  Genérica. Ali o harness não manda evento de máquina, e a PAC aprovada da 1.3
  não move a Opportunity (lacuna 8 da etapa 3).
- **O `refletirAlteracoesLead` da 1.3 copia tudo** da Account para o Lead do
  prospect, inclusive o CPF, sem conferir identidade.
- **O Lead da massa passa pela deduplicação da 1.3** (`LeadDeduplicationHandler`
  e `LeadDeduplicationUtils`), que mudou em 18/10.
- **Somem como mecanismo** o B2, o B6, o B7, o B9 e o B10, que dependem de
  código da 2.2. O B8 fica só no TC-040.
- **O RC passa na data** se o item 5 da etapa 1 entrar.

**O que deu (20/10):** está no
[relatório da etapa 2](resultado-runbook-etapa-2-2026-10-20.md), na seção
"Contra o que o plano previa". O resto se confirmou, com quatro diferenças:
- o TC-004 não passa: a PAC de X não acha X sem o `getClientePosPac`;
- 156 pares param em `DUPLICATE_VALUE`, nos 12 TCs em que a Account Y já
  existe;
- no RC, o contato atrasado vence;
- o B8 aparece também no TC-062.

## 4. Etapa 3: R1 e R2

R1 e R2 entram juntas, num deploy só. Conferir o CPF na PAC sem aceitar
Proponente sem Account vira recusa da PAC, que é o B8: o `1f6844e910` o levou
de 3 para 60 pares.

### 4.1 O `c47170d879`

`git cherry-pick -x c47170d879`. A 1.3 já tem a busca. O que entra é a ligação
nas três entradas do pós-PAC, mais o `obterCpfProponentePorIdCliente` da
máquina (inventário, item 6). No `/Cliente`, ele substitui o descarte do
`3f4b3f0906`.

Depois da etapa 1, são três conflitos:
- **`ClienteSelector`:** ficar com a linha da base, com
  `OR CPFSemFormatacao__c IN :setCPF`. A lacuna 5 troca isso logo depois.
- **`NotificacaoCliente`:** ficar com o bloco do commit e apagar
  `this.criarLeadDoCliente = true;`. Esse campo não existe na base. Manter
  `cliente = null; return cliente;`.
- **`NotificacaoMaquinaEstadoTest`:** ficar com os dois lados.
  - Os três testes da etapa 1 continuam, e o `obterCpfProponentePorIdClienteTest`
    entra.
  - Manter a troca de `Profile p` por `profiles.isEmpty()` do commit, que entra
    limpa.
  - O git emparelha o `@IsTest` e o `}` nas bordas do trecho. Repor o `}` que
    fecha o `herdarEstruturaComercialDoLeadUsuarioPadraoTest` e o `@IsTest`
    antes do `obterCpfProponentePorIdClienteTest`. Sem isso, a classe não
    compila.

O teste `realizaPostDescartaMatchPorIdProspectDivergenteTest`, que vem no
commit, exige 0 Proponente. Ele muda com a R2.

O `c2cdf75672` não entra. O `configurarIdProponenteComClienteRelacionadoTest`
manda `ANALISE_NAO_INICIADA`, que volta antes de chegar ao método. O outro
teste só confere o 200. Os casos dele são refeitos na lacuna 1.

### 4.2 O commit da R2

Na base, a R2 dá pouco trabalho. O lookup `Proponente__c` é opcional e
SetNull, e a `NotificacaoPAC` já grava no Proponente o CPF, o e-mail, o
celular e o nome do payload. O que bloqueia é o throw da
`criarInstanciaProponente`, os pontos sem guarda de nulo e o caminho da Venda
Genérica.

1. **Conferir o CPF na `criarInstanciaProponente`**, depois do descarte do
   `c47170d879`. Se o CPF da PAC diverge do da Account achada, por qualquer
   chave, buscar de novo só pelo CPF. Sem Account com esse CPF, o cliente fica
   nulo. Os comparadores podem vir do `542df3b1d1` (`normalizarCpfApenasDigitos`
   e `possuiCpfDivergente`).
2. **Trocar o throw por Proponente sem Account.** Gravar
   `Proponente__c = cliente?.Id` e um log do motivo, sem CPF, e-mail nem o mapa
   de Accounts. Tirar a consulta do `obterMapMultiplasChavesECliente`, que só
   servia ao log.
3. **Guardas de `Proponente__c` nulo:**
   - no `ProponenteTriggerHandler.compartilharContaSegundoProponente`;
   - no flow `Proponente_1`, com a condição `$Record.Proponente__c IsNull =
     false` na `myRule_1`;
   - no `OportunidadeTriggerHandler`, por volta das linhas 1450 a 1472. Ali,
     qualquer troca de `OwnerId` ou `Equipe__c` numa Opportunity com
     `PACAtual__c` e `QuantidadeProponentes__c > 1` insere `AccountTeamMember`
     com o `AccountId` do Proponente, que agora pode ser nulo. A máquina não
     chega a esse caminho: o `dea0460ade` só define o dono na Opportunity nova.
4. **Compartilhar no update.** A `ProponenteTrigger` da 1.3 só roda em after
   insert. Com o vínculo vindo depois, por update, a Account de Y fica sem
   compartilhamento. Acrescentar after update quando o `Proponente__c` muda
   para um valor não nulo.
5. **Ligar o Proponente.**
   - Na PAC, quando ela acha a Account com o mesmo CPF.
   - No `/Cliente`, depois do DML da Account, em `cliente-insert` ou
     `cliente-update` achado por IdCliente ou CPF. Buscar o Proponente sem
     Account com o mesmo CPF, ou, sem CPF, com o mesmo IdCliente. Usar DML
     parcial com log, para não derrubar o `/Cliente`. No AM, a PAC aprovada
     chega antes de Y existir, e o Event Grid não reentrega: o vínculo depende
     deste passo.
6. **`IdProponente__c` do principal.**
   - Se a Account tem o mesmo CPF e um prospect válido e diferente do `Id__c`,
     usar o prospect dela.
   - Se não, e o Proponente já está ligado à mesma Account, preservar o valor.
   - Nos outros casos, usar o do payload.

   A regra vem do `b4be1623d2` e do `542df3b1d1`. No `pac-update` da Venda
   Genérica, o `configurarIdProponenteDeAcordoComClienteRelacionado` reescreve
   o `idProponente` pelo nome antes da `criarInstanciaProponente`, então o "do
   payload" pode já vir trocado. O retry do `fe1d5a610c` fica para a R4,
   quando há PROS-Y para sincronizar.
7. **Venda Genérica: `ClientesRelacionados__c`.** Depois do upsert dos
   Proponentes, o `AtualizaClientesRelacionadosService` acha a Account pela
   própria busca por IdCliente ou prospect, sem CPF. Com a PAC de Y trazendo o
   IdCliente de X, ele continua ligando X como cliente relacionado, o que é o
   B1 por outro objeto. Tirar o `Cliente__c` do `Proponente__c` já conferido,
   ou aplicar a mesma conferência de CPF. O harness não lê esse objeto.
8. **Testes.**
   - Reescrever o `realizaPostDescartaMatchPorIdProspectDivergenteTest`: 200,
     1 Proponente, `Proponente__c` nulo, dados do payload, Account intacta.
   - Corrigir o `atualizarProponentesTest` e o
     `atualizarProponentesIdClienteTest`, que consultam com o Id do Salesforce
     e sempre recebem 0.
   - Criar casos para:
     - PAC com o IdCliente de X e o CPF de Y, com e sem Account de Y;
     - o mesmo na Venda Genérica, conferindo o `ClientesRelacionados__c`;
     - vínculo pelo `cliente-insert`, inclusive quando falha;
     - pendência com Proponente sem Account;
     - update direto de `OwnerId` ou `Equipe__c` numa Opportunity com PAC de 2
       Proponentes, um deles sem Account.

Dos commits R2 da 2.2:
- o `dcb966ddd9` já está na base, pelo `0ee6d92b81`;
- o `7694d36312` e o `d0e2635a70` vão contra a R2. Não trazer o reflexo da
  Account para o Proponente.

Sem rollback no `EventGrid`, qualquer exceção depois do upsert da PAC deixa a
PAC e o `PACAtual__c` da Opportunity gravados, sem os Proponentes, e responde
400. Por isso os passos 3 a 5 precisam das guardas e do DML parcial.

### 4.3 As lacunas do `c47170d879` e o resto da R1

Cada linha vira um commit, com teste. Nenhuma traz o commit da 2.2 que ela
substitui.

| # | Lacuna | Correção | Substitui | Verificação |
|---|---|---|---|---|
| 1 | A PAC de encerramento da Venda Genérica que traz o IdCliente só no `idProponente` deixa de achar a Account | Sem IdCliente, procurar o valor do `idProponente` também em `Id__c`, sujeito à conferência de CPF | `fc7077f94d` | Apex com CPF igual e com CPF divergente; cenário novo de catálogo |
| 2 | No `/Cliente`, o descarte só vale no `cliente-insert` | Aplicar a decisão de identidade a todos os eventos; o parcial sem a Account da pessoa responde 200, sem DML | o descarte do `b372038f43` estendido a todos os eventos, sem descartar o evento inteiro | PA: "Account X intacta depois dos parciais"; perfil EP; K1 do 040 |
| 3 | A Account achada não tem o CPF conferido (B1) | Conferir IdCliente e CPF contra toda Account achada, com o CPF normalizado nos dois lados. Sem IdCliente e sem CPF, o prospect vale, mas não move Opportunity existente | do `1f6844e910`, o CPF no descarte e a recusa da PAC; do `9210581ea5`, o ramo sem IdCliente e sem CPF | C1, C2 e C3 sem B1; C1, AR e FW sem B8 |
| 4 | Entre Accounts do mesmo CPF, fica a mais recente (B3) | Preferir a que tem `Id__c`; empatando, a modificada por último (TCs 028 e 068) | — (o B3 segue na ponta) | TC-038 em C1, AR e FW ("Account Y2 intacta"); teste novo no `ClienteSelectorTest` |
| 5 | CPF gravado com máscara: o `OR` na fórmula `CPFSemFormatacao__c` faz a consulta virar varredura | Expandir os formatos no `obterClientePorCPF` e manter `WHERE CPF__pc IN :set` (ver abaixo) | `85e4c3ba5f`; do `da90427ced`, a busca | Apex com máscara dos dois lados e com menos de 11 dígitos; explain na dev |
| 6 | Achada pelo CPF, a Account Y recebe o prospect de X no IdProspect vazio | Gravar o prospect do evento só se o Lead dele tiver o mesmo CPF ou nenhum e não estiver preso a outra Account | do `09dadb24bf`, o `prospectPertenceAOutraConta` e a gravação; `de3731957d` (o eco) | 009, 020, 022, 024, 025 e 027: "Lead X intacto" e Y sem PROS-X |
| 7 | Na máquina, o CPF só é lido pelo IdCliente | Ler também pelo `idProponente` igual ao prospect; jornada sem IdCliente não move a Opportunity | do `9210581ea5`, a parte da máquina; `7c86318a05`, `12182e7e78`. O `ec9d1a6a7c` entra aqui | Apex desses commits refeitos; cenário novo com `proponentecredito` |
| 8 | Depois da PAC aprovada, a Opportunity fica na Account de X até chegar um evento de máquina, que a Venda Genérica pode não ter | Na PAC aprovada, mover a Opportunity para a Account que o CPF e o IdCliente da PAC apontam | `4d54e3b7d9` | "Opportunity na Account aprovada" no AR e no FW dos TCs de Venda Genérica |

Ficam para outras etapas:
- **Para a R3 (seção 5.1):** a conferência de escrita dos parciais, que é o
  guard de parciais do `1f6844e910` e do `3f2919f5e7`.
- **Para a R5 (seção 5.3):** a repetição do `criarLeadDoCliente` do
  `09dadb24bf`.
- **Fora do branch:** o resto do `da90427ced`, que é o Iniciar Jornada da 2.1
  e o reflexo para o Proponente.

**Lacuna 5, sem a 2.1.**
- **Por que mudar:** o `CPF__pc` lê o `Contact.CPF__c`, que é External ID e
  tem índice. O `CPFSemFormatacao__c` é fórmula e não tem. Pelo explain na
  dev, o `OR` transforma a consulta numa varredura da Account a cada evento.
  Hoje nenhum chamador roda em trigger, então ela não lança "Non-selective
  query". O custo é desempenho.
- **A mudança:** montar o conjunto {entrada, só dígitos, `formatarCPF` dos
  dígitos} e consultar `WHERE CPF__pc IN :set`. O `CpfCNPJ.formatarCPF` da base
  lança exceção com menos de 11 dígitos, então só formatar com 11.
- **Duas formas:**
  - (i) um helper privado no `ClienteSelector`;
  - (ii) copiar para o `CpfCNPJ`, igual byte a byte, o `expandirFormatosCPF`
    do `56813a221e`, com o teste. Isso evita conflito no `CpfCNPJ` quando a 2.1
    entrar.

  A lacuna 4 mexe na mesma consulta: o `LIMIT 1` impede escolher depois. Com
  ela, o `obterClientePorCPF` deixa de ser igual ao da 2.1 nesse trecho de
  qualquer jeito, e a vantagem da (ii) fica só no `CpfCNPJ`. A escolha é do
  usuário.
- **O que se perde:** o `OR` pegava máscaras parciais, espaço e parênteses. A
  dev só tem a máscara completa; a produção não foi medida.
- **O que mais muda:** o flow de tela da Venda Genérica da 1.3 usa o mesmo
  seletor (`VG_MSClienteCriarAtualizarInvocable`). Acrescentar o caso no teste
  dele.
- **Lacuna no harness:** nenhum TC usa CPF com máscara. Para uma variante com
  a Account Y mascarada, antes é preciso ajustar as consultas que comparam o
  `CPF__pc` exato: `engine.ts` (limpeza, retrato e `contaDaPessoa`) e o
  `contasDoCpf` de `verificacoes.ts`.

### 4.4 O que esperar

Contra o ponto zero:
- **Passam em todos os perfis:**
  - "Account X intacta" e "Lead X intacto";
  - "PACs em análise aplicadas ao Proponente";
  - "Nenhuma Account a mais";
  - "Proponente principal com o CPF e os contatos da PAC";
  - "Opportunity na Account aprovada", depois da lacuna 8.
- **Somem** o B1, o B8 e o K1, este último se a decisão 2 de PO/QA mantiver o
  200.
- **O B3 que o `c47170d879` traz não aparece** (lacuna 4). Conferir pela
  asserção "Account Y2 intacta" do TC-038.
- **Seguem com o rótulo "pendente R4":** as asserções de Lead.
- **Pode falhar:** o "Lead Z intacto" do TC-021, porque o
  `refletirAlteracoesLead` da 1.3 copia o CPF.
- **Fica latente até a R3 e a R4:** a pendência, pelo flow, passa a gravar o
  e-mail aprovado na Account Y quando o Proponente se liga. Isso é o passo 3
  do B9.

## 5. Etapas 4 a 6: R3, R4 e R5

### 5.1 R3: ponto único de escrita de contato na Account

- **O que é:** uma função que confere o CPF ou o IdCliente da fonte com a
  Account e a data do evento. Todos passam por ela:
  - os `contato-*` e `endereco-*` do `/Cliente`;
  - a pendência, trocando a ação do flow `Proponente_1` por Apex na
    `ProponenteTrigger`, com a data do evento e nada gravado se o
    `Proponente__c` for nulo;
  - a contestação;
  - a sincronização da PAC aprovada.
- **Substitui:** `e505fcb93e`, `6612bab1b3`, `07608bac4a`, `70f3295319`, o
  guard de parciais do `1f6844e910` e o `3f2919f5e7`. Ao refazer o que o
  `07608bac4a` fazia na `NotificacaoPAC`, manter a carga da Opportunity antes
  do `preencherDadosPAC` (seção 2.1).
- **Cuidado:** a R3 aumenta as escritas na Account. Pôr já nela a conferência
  de CPF no `refletirAlteracoesLead` da 1.3, ou pelo menos parar de copiar o
  `CPF__pc` para o Lead.
- **Decidir antes:** se a PAC aprovada prevalece sobre um `contato-*` mais
  novo, como regra explícita.
- **Esperado:**
  - "Account aprovada com os contatos da PAC" passa em todos os TCs e perfis;
  - o C4 fica sem B2;
  - o RC confere o contato atrasado descartado.

### 5.2 R4: política única de Lead

**Em uma frase:** a R4 escreve do zero a parte que cria, reutiliza e atualiza
o Lead de Y. Quase nada da 2.2 entra como código. Os commits dela servem de
lista dos problemas que a política nova precisa resolver, cada um com o TC ou
o teste que o confere.

**A política, em sete regras:**

| Regra | O que diz |
|---|---|
| P1 | O Lead da pessoa é o do mesmo CPF. Sem ele, vale o candidato sem CPF e livre, achado pelo contato aprovado. Lead de outro CPF nunca é usado. |
| P2 | Sem Lead para reutilizar, cria-se um, já com os contatos aprovados. |
| P3 | Lead reutilizado só recebe contato onde está vazio. |
| P4 | Contato que já é de outro Lead nunca é gravado. |
| P5 | Os contatos aprovados vêm do Proponente da PAC da própria pessoa, achado por CPF ou IdCliente, e nunca pelo prospect do evento. |
| P6 | O vínculo: o IdProspect da Account recebe o `Id__c` do Lead (um Lead sem `Id__c` ganha um), o `IdProponente__c` do principal recebe o mesmo valor, e o MS Clientes é avisado. |
| P7 | O reflexo da Account para o Lead (nome e contatos) só vai ao Lead da mesma pessoa e obedece a P3 e a P4. Substitui o `refletirAlteracoesLead` da 1.3, que copia tudo, inclusive o CPF, para o Lead do prospect. |

#### O que entra de código da 2.2

**1. Copiado como está.** São as duas classes que o Rubens criou e as 4
linhas de que elas dependem. Ninguém mexeu nelas depois dele.

| De onde | O que copiar | Por quê |
|---|---|---|
| `d914e60785` | a classe `MSClienteService` | O `atualizarCliente` avisa o MS Clientes do IdProspect do cliente depois que o Lead é ligado (P6). Usa a credencial `VFlexMsClientes`, que a base já usa na Venda Genérica, e é chamado pelo `NotificacaoCliente.callMSClienteFuture` (`@future`). |
| `d914e60785` | o `ATUALIZAR_CLIENTE` do `GraphQLCreator` (4 linhas) | A `MSClienteService` depende dele, e a base não tem. |
| `1792eaa62d` | a `MSClienteServiceTest` e os testes de seletores | Os testes do Queueable são refeitos com a política nova. |

- **Por que copiar o arquivo e não fazer cherry-pick:** o `d914e60785` também
  muda o `NotificacaoCliente`, a parte que esta etapa reescreve.
- **Por que só agora:** antes da R4, o `NotificacaoCliente` da 1.3 não cria
  nem liga Lead para Y, então ninguém chamaria a `MSClienteService`.
- **Na dev:** o deploy de 18/10 apagou a `MSClienteService` e o teste dela, e
  eles voltam no deploy desta etapa.

**2. O padrão volta, em código novo.** Os dois commits mexiam em métodos que
não existem na base, então não há o que aplicar. O que se repete é a técnica.

| Commit | O padrão | Onde aplicar |
|---|---|---|
| `fe1d5a610c` | DML parcial com até 3 tentativas em `UNABLE_TO_LOCK_ROW`; se falhar, só log, sem exceção | na sincronização do `IdProponente__c` (P6) |
| `72cbd884f6` | o mesmo retry, para o rollback do savepoint não desfazer o Lead novo | no update da Account com o vínculo (P6) |

**3. Já resolvido em outro lugar.**
- `Ges_LeadSelector` (mudança do `d914e60785`): já está na base.
- `LeadSelector` (campos da `buscarLeadPorIdExterno`): entra na etapa 1, pela
  união de campos do `dea0460ade`.
- As 3h da data da PAC (do `c04b6add92`): entram na etapa 1 (seção 2.2).

**4. Não volta.**
- `ProponenteSelector.getProponenteByIdProponente` (do `d914e60785`): acha o
  Proponente pelo prospect do evento. O `NotificacaoCliente` da 2.2 o usa para
  ler os "contatos aprovados", e é assim que a Account Y nasce com os contatos
  de X: é o passo 1 do B9. A P5 o substitui.
- `68e7cfc856`: só tirava comentários e logs de uma classe que não existe na
  base. A lição que fica dele é manter o log de falha de DML e não deixar
  `catch` vazio.
- `8763dacaaa`: só tirava comentários de um teste que não volta.

#### O que é reescrito

Estes commits não entram. A política nova resolve o problema de cada um, e a
última coluna diz como conferir. Os TCs 053 a 057 estão fora do `--todos` e
rodam com `--tcs`.

| Commit | O que ele corrigia | Regra | Como conferir |
|---|---|---|---|
| `d914e60785` (o resto) | Com o `3f4b3f0906`, X perdia o prospect e Y herdava o Lead da jornada. Y passa a ter Lead próprio, novo ou reutilizado, sem os contatos do Lead original. | P1, P2, P4, P6 | Lead novo em 22 TCs (ex.: 001, 002, 010, 017); Lead reutilizado em 15 (ex.: 006, 012, 019, 045); Leads presos preservados (024, 026, 027, 048) |
| `8b06b4cd2b` | No MATCH sem prospect, o `cliente-update` da aprovação não ligava a Account ao Lead de mesmo CPF que já existia. | P1, P6 | TC-062 e os Caso C (024, 027, 048). O caso exato do título não tem TC: precisa de teste Apex. |
| `1195c8984b` | A aprovação criava um segundo Lead do CPF Y quando o Lead Y já estava ligado à Account Y. | P1 | TC-053 ("1 Lead do CPF"); no FW, a repetição não cria Lead |
| `509c87ad24` | Um Lead de outro CPF, achado por e-mail ou celular, era reusado e tinha o CPF trocado. Um Lead reusado sem `Id__c` deixava a Account sem IdProspect. | P1, P6 | Caso C (024, 027, 048); reuso do Lead livre (026); fallback sem CPF (012, 013, 045, 046, 049). O Lead sem `Id__c` precisa de teste Apex. |
| `2eef5b7ba2` | A colisão era conferida nos contatos do evento, que vinham vazios, e o Lead de Y herdava o e-mail de outro Lead. | P4, P5 | Lead só com CPF (001, 016, 041, 057); Lead sem o contato que colide (010, 011, 017, 018, 042, 043) |
| `3029bcfb6d` | O Lead livre sem CPF que compartilhava e-mail ou celular com o Lead da jornada não era achado, e nascia um Lead novo. | P1, P5 | TC-012 e TC-013 |
| `af28349332` | O Lead não recebia o nome da Account depois da aprovação. | P7 | Nenhum TC confere o nome do Lead de Y: precisa de teste Apex ou de asserção nova |
| `78a25da643` | O reflexo trocava os contatos do Lead Y e alterava o Lead de outra pessoa. O contato que chegava antes do vínculo não chegava ao Lead. | P3, P4, P7 | "Lead X intacto" e "Lead Z intacto"; TC-021 (B4) |
| `c04b6add92` (o resto) | Caso Clarice: depois da PAC aprovada, a Account Y tinha os contatos aprovados e o Lead Y o contato velho com que nasceu. | P2, P3 | Não está nos TCs; cenário de catálogo `pac-aprovada-sobrescreve-contato-anterior` |
| `d6f147d303` | A sobrescrita pós-PAC trocava pelos aprovados os contatos próprios do Lead Y reutilizado. | P3 | TCs 009, 019, 022, 023 e 047 ("contatos preservados") |
| `a6d1f4c64c` | A sobrescrita pós-PAC podia gravar no Lead Y um e-mail ou celular de outro Lead. | P4 | AR e FW do 055 e do 056 (fora do `--todos`); precisa de teste Apex, porque nenhuma asserção isola o caso |
| `de3731957d` (parte de Lead) | Na Venda Genérica com cliente existente, a Account ficava sem Lead. | P1, P2 | TC-062 e TC-040 ("Lead novo vinculado") |
| `b4be1623d2` (parte de Lead) | O Proponente principal ficava com o prospect da jornada, não com o do Lead de Y. | P6 | "Proponente principal na Account aprovada com PROS-Y", que roda em todo TC |

#### Antes e depois

- **Decidir antes:** as decisões 3 (K2) e 4 (contatos do Lead Y reutilizado)
  de PO/QA.
- **Testes Apex a escrever antes:** os quatro casos sem TC da tabela
  (`8b06b4cd2b`, `509c87ad24`, `af28349332`, `a6d1f4c64c`) e o lock simulado
  para o retry do `fe1d5a610c` e do `72cbd884f6`, que nunca foi reproduzido.
- **Esperado:**
  - somem os rótulos "pendente R4", e todas as asserções de Lead passam;
  - o B4, o B6, o B9 e o B10 não voltam quando a criação e o reuso de Lead
    voltarem;
  - o B5 e o K2 só contam como resolvidos nos pares em que aparecem na
    campanha de 12/10. Antes da R4, esses rótulos vêm da falta de Lead, não
    do mecanismo.

### 5.3 R5: prospect de outra pessoa

- **O que é:** num evento de cliente com prospect de outra pessoa, o prospect
  é ignorado. O evento não reenfileira criação de Lead nem troca vínculo. O
  resto dele é aplicado pelo IdCliente (R1) e pelo ponto único (R3).
- **Substitui:**
  - o `0dd2e9a338`;
  - a repetição do `criarLeadDoCliente` do `09dadb24bf`;
  - o resto do `b372038f43`: em vez de descartar o evento inteiro, ignorar só
    o prospect.
- **Testes:** repetir o FW do 040 várias vezes, porque o B7 é corrida.
- **Esperado:**
  - o FW fica conforme;
  - o EP e o RL não trocam o prospect nem criam Account ou Lead.

## 6. Como medir cada etapa e quando está pronto

A cada etapa, com N sendo o número da etapa:

1. O usuário faz o deploy de todos os arquivos da unificação que a etapa
   mudou, como na seção 3.1. Um deploy parcial mistura versões na dev.
2. Rodar o `versao-implantada.ts` (seção 3.2) e atualizar o
   [estado da dev](estado-da-mrv-devDan.md).
3. Rodar a campanha completa, com
   `--saida ../campanhas-runbook/etapa-N-AAAA-MM-DD.jsonl`.
4. Rodar o relatório e a matriz contra a etapa anterior:

   ```bash
   npm run runbook:relatorio -- --entrada ../campanhas-runbook/etapa-N-AAAA-MM-DD.jsonl --saida docs/resultado-runbook-etapa-N-AAAA-MM-DD.md
   npm run runbook:bugs -- --entrada ../campanhas-runbook/etapa-N-AAAA-MM-DD.jsonl --comparar ../campanhas-runbook/etapa-<N-1>-AAAA-MM-DD.jsonl
   ```

5. Comparar por asserção e rodar os testes Apex e os cenários de catálogo da
   etapa.

**Não regressão:**
- nenhuma asserção que passava passa a falhar;
- os bugs previstos para a etapa somem;
- não aparece nenhum `?`; o que falta de código sai como "pendente" da regra
  que o traz.

**Pronto,** pela seção 7 do critério de aceite:
1. os TCs executáveis ficam conformes em PA, CA, ME, AR, AM, FW, RC, EP e RL
   (conforme a decisão 1), C1 a C4 não acusam nenhum B, e o `runbook:bugs` não
   mostra B nem `?`; K1 e K2 seguem as decisões 2 e 3;
2. os dez comportamentos sem TC (inventário, seção 5) têm teste;
3. a cadeia real passa pela 2.1 e pela 1.3, e só roda quando a 2.1 entrar;
4. nenhuma etapa regrediu, e nenhum dos 295 pares conformes da campanha
   alinhada de 12/10 diverge, comparando célula a célula e asserção a asserção
   com o relatório.

## 7. Perguntas para o time

**Decisões do critério de aceite** (seção 6 dele), com a etapa antes da qual
cada uma precisa estar fechada:

| Decisão | O que é | Antes da |
|---|---|---|
| 1 | quais perfis entram no critério | etapa 0, porque define o alvo |
| 9 | versão do runbook, com 3 ou 6 perfis | etapa 0 |
| 2 | K1: o 200 nos parciais sem Account | etapa 3 |
| 5 | os 9 `BLOCKED-FUNCIONAL` (008, 028, 029, 050, 052, 058, 060, 064 e 065), inclusive o desempate do TC-028 e a mutação Y→Z | etapa 3 |
| 3 | K2: o Lead candidato no 045 e no 049 | etapa 5 |
| 4 | contatos do Lead Y reutilizado onde a planilha não fala | etapa 5 |
| 7 | aceite pela cadeia real | pronto, com a 2.1 |

**Respostas de 18/10:**

| Pergunta | Resposta | O que muda |
|---|---|---|
| Qual ref é a preprod? | `origin/GestaoVendasPreProd` | Os dois caminhos da seção 2.1 entram limpos nela. |
| De que branch a produção roda? | master | Ver o alerta abaixo. |
| A regra Perdido→Cancelado vale no `pac-insert`? | sim | Entra o commit novo, não o `a1eef12c11`. |
| O literal `Cancelado` está certo? | se for erro, consertar | Era erro: o commit novo grava `CANCELADA` (seção 2.1). |
| Qual Opportunity vale para a regra? | — | Ver abaixo. Fica a da jornada (`idjornadapac`), salvo objeção. |
| A US 1026579 entra? | não, tem conteúdo próprio e fica como está | Continua fora do branch (seção 1.4). |

**Alerta de produção (pendência máxima).**
- **O código:** a produção roda o master. O master tem os mesmos blobs da
  `NotificacaoPAC` e do `PropostaAnaliseCreditoSelector` que quebraram na dev
  em 19/10 (seção 2.1). A regra entrou no master em 04/05, pelo `a0559ec8f8`
  (RDM 44893).
- **O que isso quer dizer:** se a produção roda exatamente o master, desde
  então todo `pac-update` com status, exceto `ANALISE_NAO_INICIADA`, sobre uma
  PAC que já existe responde 400. A Event Grid não repete a
  entrega que responde 400: o evento vai para o dead-letter, se houver, ou se
  perde.
- **Falta confirmar na produção.** Ainda não há acesso. O usuário confere
  quando tiver: só leitura, comparando o corpo das duas classes na org e
  procurando no `LogIntegracao__c` a mensagem `Opportunity.StageName`. Até lá,
  a `mrv-staging`, que espelha o develop, serve de indício (investigação em
  andamento).
- **Como o bug nasceu:** a regra foi feita completa e copiada pela metade.

  | Commit | Data | Autor | O que fez | Onde está |
  |---|---|---|---|---|
  | `a1ad99b194` (US 970751) | 03/03 | Carlos Eduardo | A regra completa: a linha na `NotificacaoPAC`, o `StageName` na `getPacsByIdExternoForUpdate` e 61 linhas de teste | `970751_ajuste_oportunidade_perdida_notificacao_pac`, `release2023` e outros. Nunca chegou ao master, à preprod nem ao develop |
  | `305a3060c7` | 24/04 | santana.jeferson | Só a linha da regra na `NotificacaoPAC`, sem o seletor e sem os testes | preprod, develop e master (desde 04/05) |

- **Quem já pôs o campo no seletor depois:**

  | Commit | Data | Autor | Consultas | Onde está |
  |---|---|---|---|---|
  | `a1eef12c11` (2.2) | 28/08 | daniel tavares | as duas | `GV_918914_UnificPosAprovPAC`, `copy_develop` e `develop_merge_superapp` |
  | `9559725a48` (US 1060669, "fix necessários de telefone internacional") | 29/09 | cef-silva | só a `getPacsByIdExternoForUpdate`, a que a `NotificacaoPAC` usa | `origin/develop` e `origin/GestaoVendasPreProd__c`; não está no `origin/GestaoVendasPreProd` de 06/10 nem no master |

- **O campo no seletor resolve o bug.** O `pac-update` sobre PAC existente
  deixa de lançar a exceção, e a regra passa a valer nele. No `pac-insert` de
  PAC nova, a regra continua sem disparar e o literal continua `Cancelado`: é o
  que o commit novo da seção 2.1 acrescenta no branch da reescrita.
- **A correção da produção provavelmente já está a caminho**, dentro do
  `9559725a48`. Ela chega quando o `GestaoVendasPreProd__c`, ou a US 1060669,
  for promovido. A pergunta para o time é quando isso sobe. Se for demorar, a
  saída é um hotfix só com o campo no seletor, ou com o commit novo, a partir
  da `GestaoVendasPreProd`.
- **O branch da reescrita não muda.** O commit novo mexe só na
  `NotificacaoPAC` e não conflita com o campo do `9559725a48`. Quando os dois
  se encontrarem, o campo fica sem uso, sem erro.

**Qual Opportunity vale para a regra.** É uma escolha, e a recomendação é
ficar com a da jornada:
- **Duas formas de chegar a uma Opportunity a partir da PAC:**
  - a **mestre** da PAC, pelo `Oportunidade__c`, que é o que o `305a3060c7`
    lia;
  - a **da jornada** do evento, pelo `idjornadapac`, que é o que o commit novo
    lê.
- **Na prática são a mesma.** A PAC nasce ligada à Opportunity da jornada, o
  `Oportunidade__c` é MasterDetail e não troca de pai, e o `PACAtual__c` já é
  gravado na Opportunity do `idjornadapac`.
- **Só divergiriam** num evento que chegasse com o `idjornadapac` de outra
  Opportunity.

**Ainda em aberto, sobre a US 1026579 (para PO/QA):**
- o rótulo dos TCs 022 e 030 a 041 não bate com o conteúdo;
- a obrigatoriedade de CPF não tem TC na planilha;
- a US impede o TC-004 pela UI.
