# Mapa dos commits da reescrita da 2.2

Cada commit do branch local `GV_909649_918914` do `com_salesforce_mrv`,
desde a base `1ef8425b91` (ponta da 1.3), ligado à etapa do
[plano da reescrita](plano-branch-reescrita-2.2.md) e ao commit equivalente da
branch antiga.

- **Branch antiga:** a 2.2, `origin/GV_918914_UnificPosAprovPAC`, ponta
  `3f2919f5e7`. O número entre parênteses é o do commit no
  [inventário dos commits da 2.2](inventario-commits-2.2.md), com o link para
  o detalhe dele.
- **Outras origens:** quando o equivalente não está na 2.2, a tabela diz de
  onde ele vem.
- **Como manter:** a cada commit novo no branch, acrescentar uma linha na
  tabela e, se ele não for um cherry-pick limpo, uma seção na parte 2. A parte
  3 diz o destino de cada commit da 2.2 já tratado.

## 1. Os commits

| # | Commit | Etapa do plano | O que é | Equivalente na branch antiga | Relação |
|---|---|---|---|---|---|
| 1 | `5baf87b376` | 1, item 0 | `regionContainerType` no flow `PermutaCadastroCliente` | `f2f34b48c5` (RDM 46500, do master e da preprod; não está na 2.2) | cherry-pick limpo, com `-x` |
| 2 | `982131008f` | 1, item 1 | Jornada obsoleta sem Account responde 200 | [`fbd67a1216`](inventario-commits-2.2.md#c15) (15) | cherry-pick com ajuste no teste (2.1) |
| 3 | `3109144d37` | 1, item 2 | A Opportunity herda dono, equipe e gerente do Lead | [`dea0460ade`](inventario-commits-2.2.md#c26) (26) | cherry-pick com ajustes (2.2) |
| 4 | `9fd68521e8` | 1, item 3 | Não grava StageName vazio na Venda Genérica | [`9f0ba21f38`](inventario-commits-2.2.md#c38) (38) | cherry-pick limpo |
| 5 | `6955c3a88d` | 1, item 4 | Regra Perdido→`CANCELADA` lê a Opportunity da jornada | substitui [`a1eef12c11`](inventario-commits-2.2.md#c31) (31); a linha da regra vem do [`07608bac4a`](inventario-commits-2.2.md#c32) (32) | commit novo (2.3) |
| 6 | `b16d25c214` | 1, item 5 | Datas sem fuso da PAC gravadas em UTC | o trecho das 3h do [`c04b6add92`](inventario-commits-2.2.md#c39) (39) | parte de um commit (2.4) |
| 7 | `2ea12a6a59` | 3, seção 4.1 | Busca do pós-PAC por IdCliente, CPF e prospect ligada no `/Cliente`, na PAC e na máquina | [`c47170d879`](inventario-commits-2.2.md#c6) (6) | cherry-pick com ajustes (2.5) |
| 8 | `784c14d7f6` | 3, seção 4.2, R2 (a) | A PAC confere o CPF da Account achada; sem Account da pessoa, o Proponente fica sem Account | mistura de [`542df3b1d1`](inventario-commits-2.2.md#c30) (30) e [`b4be1623d2`](inventario-commits-2.2.md#c20) (20); substitui na PAC a recusa do [`1f6844e910`](inventario-commits-2.2.md#c43) (43) | commit novo (2.6) |
| 9 | `a58b32caa4` | 3, seção 4.2, R2 (b) | Guardas para o Proponente sem Account no flow `Proponente_1` e no compartilhamento da Opportunity; compartilhamento quando o vínculo chega por update | sem equivalente direto; a guarda da pendência tem par no [`07608bac4a`](inventario-commits-2.2.md#c32) (32) | commit novo (2.7) |
| 10 | `c082172e87` | 3, seção 4.2, R2 (c) | O `/Cliente` liga à Account da pessoa os Proponentes que a PAC gravou sem Account | sem equivalente; o mais próximo é o `sincronizarIdProponentePrincipal` do [`b4be1623d2`](inventario-commits-2.2.md#c20) (20), que é da R4 | commit novo (2.8) |
| 11 | `7185fbbe79` | 3, seção 4.2, R2 (d) | Na Venda Genérica, o cliente relacionado vem da Account do Proponente, conferida pelo CPF | sem equivalente: a 2.2 não mexeu no `AtualizaClientesRelacionadosService` | commit novo (2.9) |
| 12 | `1ffd1d1645` | 3, seção 4.3, lacuna 1 | Sem IdCliente, o `idProponente` também é procurado como IdCliente, se o CPF não divergir | refaz o [`fc7077f94d`](inventario-commits-2.2.md#c16) (16), com conferência de CPF | commit novo (2.10) |
| 13 | `962e5993bc` | 3, seção 4.3, lacuna 2 | O `/Cliente` descarta o match pelo prospect de outra Account em todo evento; o parcial antes da Account da pessoa volta com erro reentregável | refaz o descarte do [`b372038f43`](inventario-commits-2.2.md#c9) (9), estendido a todos os eventos, sem descartar o evento inteiro | commit novo (2.11) |
| 14 | `0a18d28a48` | 3, seção 4.3, lacuna 3 | A Account achada só pelo prospect é descartada quando o IdCliente ou o CPF divergem; o parcial não dá IdCliente a uma Account sem IdCliente | mistura do CPF no descarte do [`1f6844e910`](inventario-commits-2.2.md#c43) (43) e do ramo sem IdCliente e sem CPF do [`9210581ea5`](inventario-commits-2.2.md#c45) (45); a parte do parcial não tem equivalente | commit novo (2.12) |
| 15 | `946cf8bdc1` | 3, seção 4.3, lacuna 6 | O evento do `/Cliente` só grava o prospect no IdProspect vazio se ele não for o eco do IdCliente, não estiver em outra Account e o Lead dele não tiver outro CPF | mistura do `prospectPertenceAOutraConta` e da guarda da gravação do [`09dadb24bf`](inventario-commits-2.2.md#c8) (8), da extensão a todo evento do [`b372038f43`](inventario-commits-2.2.md#c9) (9) e da guarda do eco do [`de3731957d`](inventario-commits-2.2.md#c17) (17); o CPF do Lead não tem equivalente | commit novo (2.13) |
| 16 | `1749168299` | 3, seção 4.3, lacuna 4 | Entre Accounts do mesmo CPF, a busca prefere a que tem IdCliente e, empatando, a modificada por último | sem equivalente: o B3 segue na ponta da 2.2 | commit novo (2.14) |
| 17 | `37246536b2` | 3, seção 4.3, lacuna 5 | A busca por CPF usa o índice do `CPF__pc` com os formatos expandidos, sem o `OR` na fórmula | o `CpfCNPJ` e o `CpfCNPJTest` do `56813a221e` (2.1, US 918899), iguais byte a byte, e a mudança de duas linhas dele no `ClienteSelector`; substitui o [`85e4c3ba5f`](inventario-commits-2.2.md#c10) (10) e a busca do [`da90427ced`](inventario-commits-2.2.md#c34) (34) | parte de um commit da 2.1, mais testes (2.15) |
| 18 | `ea5495b870` | 3, seção 4.3, lacuna 7 | A jornada lê o CPF também pelo `idProponente` e, sem IdCliente, não move a Opportunity que já existe | mistura da leitura do CPF e dos testes do [`9210581ea5`](inventario-commits-2.2.md#c45) (45), do `obterOportunidadePorPayload` do [`ec9d1a6a7c`](inventario-commits-2.2.md#c24) (24) e da intenção do [`12182e7e78`](inventario-commits-2.2.md#c13) (13) e do [`7c86318a05`](inventario-commits-2.2.md#c46) (46), refeitos numa regra só | commit novo (2.16) |
| 19 | `0d4d046b9d` | 3, seção 4.3, lacuna 8 | Na PAC aprovada, a Opportunity vai para a Account que o IdCliente e o CPF do proponente principal apontam | refaz o [`4d54e3b7d9`](inventario-commits-2.2.md#c36) (36), com a Account vinda da busca pela identidade da PAC, e não do vínculo do Proponente | commit novo (2.17) |

Os commits 2 a 4 e o 7 saíram sem a linha "(cherry picked from commit …)" que
o `-x` acrescenta. A origem fica registrada aqui.

## 2. O que mudou em relação ao equivalente

### 2.1 `982131008f` ← `fbd67a1216`

- **Entrou:** a mudança da `NotificacaoMaquinaEstado` e o
  `deveIgnorarEventoObsoletoSemClienteTest`.
- **Ficou de fora:** o `obterCpfProponentePorIdClienteTest`, que o lado da 2.2
  trazia no mesmo trecho do teste. Ele é do `c47170d879` e não compilava na
  base. Entrou depois, com o commit 7.

### 2.2 `3109144d37` ← `dea0460ade`

- **`LeadSelector`:** a consulta da `buscarLeadPorIdExterno` ficou com a união
  dos campos dos dois lados. Sem o `OwnerId`, o `GES_Equipe__c` e o
  `Ges_GerenteAtual__c`, o `herdarEstruturaComercialDoLead` falha em execução.
- **Testes:** entraram os dois `herdarEstruturaComercialDoLead*`.
- **Ficou de fora:** o `devePreservarContaAtualDaOportunidadeTest`, que chama
  um método do [`ec9d1a6a7c`](inventario-commits-2.2.md#c24) (24). Esse
  commit entra na lacuna 7 da R1.

### 2.3 `6955c3a88d`: commit novo no lugar do `a1eef12c11`

- **O defeito:** a regra Perdido→Cancelado do `305a3060c7` (24/04, já na 1.3)
  lia `Oportunidade__r.StageName`, que a consulta da PAC não traz. O
  `pac-update` sobre PAC existente lançava `SObjectException` (plano, seção
  2.1).
- **Na 2.2:** o [`a1eef12c11`](inventario-commits-2.2.md#c31) pôs o campo no
  `PropostaAnaliseCreditoSelector`. A regra continuava sem disparar no
  `pac-insert`.
- **Aqui:** a `NotificacaoPAC` carrega a Opportunity pelo `idjornadapac` antes
  do `preencherDadosPAC` e lê o `StageName` dela, com null-check, como na
  linha do [`07608bac4a`](inventario-commits-2.2.md#c32). O seletor não muda.
- **O literal:** `CANCELADA`, e não `Cancelado`, que a fórmula e o helper da
  PAC não reconhecem.
- **Fora da 2.2:** o `9559725a48` (develop, 29/09) corrige o mesmo defeito
  pelo seletor, e o `a1ad99b194` (US 970751, 03/03) nunca chegou ao master,
  à preprod nem ao develop.

### 2.4 `b16d25c214` ← parte do `c04b6add92`

Só o trecho das 3h do [`c04b6add92`](inventario-commits-2.2.md#c39):
- o override de `parseDateTime`, igual ao dele;
- as duas trocas de chamada, no `DataAprovacao__c` e no
  `DataResolucaoPendencias__c`;
- o `parseDateTimeCorrigeFusoBRTPacUpdateTest`, igual ao dele.

O resto do `c04b6add92` é da R4 (plano, seção 5.2).

### 2.5 `2ea12a6a59` ← `c47170d879`

- **Já estava na base:** a busca no `ClienteService` e nos seletores e os
  testes dela. Entraram na 1.3 pelo `6af00f4bc3` e pelo `539bcbfa73` (13/07),
  como código sem chamador.
- **Entrou:** a ligação da busca no `NotificacaoCliente`, na `NotificacaoPAC`
  e na `NotificacaoMaquinaEstado`, com o `obterCpfProponentePorIdCliente` e o
  teste dele.
- **`ClienteSelector`:** ficou a linha da base, com
  `OR CPFSemFormatacao__c IN :setCPF`. A lacuna 5 da R1 troca essa linha.
- **`NotificacaoCliente`:** saiu o `this.criarLeadDoCliente = true;`. O campo
  nasceu no [`3f4b3f0906`](inventario-commits-2.2.md#c1) e não existe na
  base.
- **`NotificacaoMaquinaEstadoTest`:** ficaram os testes da etapa 1 e o do
  commit. A troca do `Profile p` por `profiles.isEmpty()` entrou como estava,
  e ela tira desse teste a dependência do idioma do usuário.

### 2.6 `784c14d7f6`: R2 (a), commit novo

A 2.2 nunca teve Proponente sem Account. Lá, o
[`1f6844e910`](inventario-commits-2.2.md#c43) passou a conferir o CPF na PAC
e a recusar a PAC em análise de quem o Salesforce não acha, o que levou o B8
de 3 para 60 pares. Este commit confere o CPF, mas, em vez de recusar, grava o
Proponente sem Account.

| Parte | De onde vem |
|---|---|
| Conferir o CPF da Account achada e, se divergir, buscar só pelo CPF (item 1) | os comparadores `possuiCpfDivergente` e `normalizarCpfApenasDigitos` do [`542df3b1d1`](inventario-commits-2.2.md#c30) |
| Trocar o throw por Proponente sem Account e tirar a consulta que só servia ao log (item 2) | sem equivalente; substitui a recusa do [`1f6844e910`](inventario-commits-2.2.md#c43) |
| `IdProponente__c` do principal: o prospect da Account, senão o já gravado na mesma Account, senão o do payload (item 6) | o `resolverIdProponentePrincipal` do [`b4be1623d2`](inventario-commits-2.2.md#c20), na forma final do [`542df3b1d1`](inventario-commits-2.2.md#c30) |
| `IdProponente__c` no `getProponenteByPAC` | o mesmo campo que o `b4be1623d2` passou a usar |
| Pular o Proponente sem Account no `compartilharContaSegundoProponente` (item 3, primeira parte) | sem equivalente: na 2.2, o Proponente sempre tinha Account |

Ficaram de fora, de propósito:
- o reflexo da Account para o Proponente, do
  [`7694d36312`](inventario-commits-2.2.md#c27) (27) e do
  [`d0e2635a70`](inventario-commits-2.2.md#c28) (28), que vai contra a R2;
- o `reconciliarIdProponentePrincipalPos` e o retry em `UNABLE_TO_LOCK_ROW` do
  `542df3b1d1`, que ficam para a R4.

### 2.7 `a58b32caa4`: R2 (b), commit novo

| Parte | De onde vem |
|---|---|
| A condição `Proponente__c` não nulo na regra da pendência do flow `Proponente_1` (item 3) | Na 2.2, o [`07608bac4a`](inventario-commits-2.2.md#c32) tirou essa gravação do flow e a levou para o `sincronizarEmailContatoPendencia`, em Apex, que já pula o Proponente sem Account. Aqui o flow fica até a R3, que refaz esse ponto, e a guarda entra nele |
| Pular o Proponente sem Account no `compartilharSegundoProponenteAfterUpdate` do `OportunidadeTriggerHandler` (item 3) | sem equivalente: na 2.2, o Proponente sempre tinha Account |
| `ProponenteTrigger` em after update, com o `compartilharContaVinculadaDepois` (item 4) | Na 2.2, o after update também veio do `07608bac4a`, mas para a sincronização da pendência. O compartilhamento no update não existia |
| `ProponenteTriggerHandlerTest`, novo | Tem o mesmo nome da classe que o [`78a25da643`](inventario-commits-2.2.md#c33) (33) criou na 2.2, mas os casos são outros. A da 2.2 não volta |

O `OportunidadeTriggerHandler` do branch não compila na dev, que tem uma versão
de 03/11/2025. A guarda foi validada sobre a versão da dev, que tem o mesmo
método (plano, seção 4).

### 2.8 `c082172e87`: R2 (c), commit novo

- **No `/Cliente`:** depois do DML da Account, no `cliente-insert` e no
  `cliente-update`, os Proponentes sem Account do mesmo CPF são ligados à
  Account. A Account precisa ter sido criada pelo evento ou achada pelo
  IdCliente ou pelo CPF. Se ela não tiver CPF, vale o mesmo IdCliente. O CPF é
  comparado com e sem máscara, e a gravação usa DML parcial com log.
- **Na PAC:** nada muda. O upsert do commit 8 já liga o Proponente quando a
  Account aparece. O commit só acrescenta o teste disso.
- **Na 2.2:** não havia Proponente sem Account para ligar. O
  [`b4be1623d2`](inventario-commits-2.2.md#c20) atualizava, pelo
  `sincronizarIdProponentePrincipal`, o `IdProponente__c` dos Proponentes já
  ligados depois do vínculo do Lead. Isso é da R4 e não entrou.

### 2.9 `7185fbbe79`: R2 (d), commit novo

- **O defeito:** o `AtualizaClientesRelacionadosService` achava a Account do
  cliente relacionado pela própria busca, por IdCliente ou prospect e sem CPF.
  A PAC de Y com o IdCliente de X ligava X: o B1 por outro objeto. Ele vinha
  da 1.3 e continuou na 2.2, que não mexeu nessa classe.
- **Aqui:** o serviço usa a Account de cada Proponente da PAC, que o commit 8
  conferiu pelo CPF. A comparação que decide se a lista muda também passou a
  usar essa Account.
- **O que fica:** quando o `/Cliente` liga o Proponente depois (commit 10), o
  cliente relacionado segue sem Account até o próximo evento de PAC.

### 2.10 `1ffd1d1645` ← refaz o `fc7077f94d`

- **Igual ao `fc7077f94d`:** sem achar a Account pelo prospect, a busca do
  pós-PAC testa o valor do `idProponente` como IdCliente, e o match sai como
  `ID_CLIENTE`. É a PAC de encerramento da Venda Genérica, que traz o
  IdCliente só no `idProponente`.
- **Diferente:**
  - só roda quando o payload não tem IdCliente;
  - a Account achada assim só vale se o CPF do evento não divergir do dela.

  Sem isso, a PAC de Y com o IdCliente de X no `idProponente` achava X, o
  risco que o inventário apontava no `fc7077f94d`.
- **A conferência fica no `getClientePosPac`,** e não só na PAC. Assim ela
  vale para a PAC, o `/Cliente` e a máquina.
- **Verificação na dev (22/10):** no lugar do cenário de catálogo, que só
  roda com o app e um Postgres, duas variantes do TC-040 no harness, nos 12
  perfis. As PACs de Y saem sem IdCliente e com um IdCliente no `idProponente`:
  - **TC-040-IDP,** com o IdCliente de Y: o Proponente e a Opportunity vão
    para Y;
  - **TC-040-IDX,** com o IdCliente de X: X fica intacta em todos os perfis.
    No C1, a PAC em análise chega antes de Y existir, o recurso acha X pelo
    IdCliente, e a conferência de CPF a recusa.

### 2.11 `962e5993bc` ← refaz o descarte do `b372038f43`

- **Na 2.2:** o [`b372038f43`](inventario-commits-2.2.md#c9) estendeu o
  `deveDescartarMatchPosPac` e o `prospectPertenceAOutraConta` a todos os
  eventos do `/Cliente`. Fora do `cliente-insert`, ele descartava o evento
  inteiro e respondia 200, sem DML. O `0dd2e9a338` desfez isso no
  `cliente-update`, ligando o `criarLeadDoCliente`.
- **Aqui:**
  - o `deveDescartarMatchPosPac` vale em todo evento;
  - o `cliente-update` com o prospect de outra Account cria a Account da
    pessoa, como o `cliente-insert`;
  - o contato ou endereço sem a Account da pessoa volta com erro reentregável
    (500, pelo metadado `Error_Response_Mapping.Parcial_antes_do_cliente`) e é
    aplicado na reentrega. Na 2.2, ele era descartado de vez.
- **Ficou de fora:** o `prospectPertenceAOutraConta` e a gravação do prospect
  no IdProspect vazio. Os dois são da lacuna 6.
- **A decisão do erro reentregável** (decisão 2, K1) e como voltar ao 200 estão
  no [plano, seção 4.5](plano-branch-reescrita-2.2.md#45-decisão-2-o-parcial-que-chega-antes-do-cliente).

### 2.12 `0a18d28a48`: mistura do `1f6844e910` e do `9210581ea5`

- **Do [`1f6844e910`](inventario-commits-2.2.md#c43):** o CPF no
  `deveDescartarMatchPosPac`. A Account achada só pelo prospect é descartada
  quando o IdCliente ou o CPF do evento divergem dos dela, com o CPF comparado
  só pelos dígitos.
  - **Diferente:** lá, uma Account sem IdCliente passava sem conferir o CPF.
    Aqui o CPF é conferido nela também. Era assim que X sem IdCliente era
    sobrescrita.
  - **Ficou de fora:** a recusa da PAC em análise, já substituída pelo
    commit 8, e a conferência de escrita dos parciais, que é da R3.
- **Do [`9210581ea5`](inventario-commits-2.2.md#c45):** sem IdCliente e sem
  CPF no evento, o prospect continua valendo.
  - **Ficou de fora:** o "não move Opportunity existente" e o CPF da máquina
    pelo `idProponente`. Os dois são da lacuna 7.
- **Nas chamadas:** a PAC, o `/Cliente` e a máquina passam o CPF que têm. A
  versão de dois parâmetros segue, sem CPF.
- **Sem equivalente na 2.2:** no `/Cliente`, o contato ou endereço que acha só
  pelo prospect uma Account sem IdCliente descarta o match. O parcial não traz
  CPF, então não pode confirmar a pessoa. Sem isso, o contato de Y gravava o
  IdCliente de Y em X. O defeito apareceu no harness, no TC-001-XSI (a variante
  do TC-001 com X sem IdCliente), e não em teste Apex.
- **Testes:** o `deveDescartarMatchPosPacConfereCpfTest`, no
  `ClienteServiceTest`, e o
  `clienteInsertComProspectDeXSemIdClienteNaoSobrescreveXTest` e o
  `contatoNaoDaOIdClienteAContaSemIdClienteAchadaPeloProspectTest`, no
  `NotificacaoClienteTest`. O `contaAchadaPeloProspectNaoLigaProponenteTest`,
  do commit 10, passou a usar uma X sem CPF: com a X de outro CPF, o match era
  descartado e o teste deixava de medir o que diz.
- **Verificação na dev (22/10):** com o branch até aqui no working tree, o
  TC-001 e o TC-001-XSI nos 12 perfis deixaram a Account X e o Lead X
  intactos. Todos os RUNs param no primeiro contato depois do `cliente-insert`,
  com `DUPLICATE_VALUE` no IdProspect da Account Y, que é a lacuna 6.

### 2.13 `946cf8bdc1`: mistura do `09dadb24bf`, do `b372038f43` e do `de3731957d`

- **Do [`09dadb24bf`](inventario-commits-2.2.md#c8):** o
  `ClienteService.prospectPertenceAOutraConta`, com o mesmo nome e a mesma
  lógica, e a guarda que impede gravar no IdProspect vazio o prospect que já
  está em outra Account.
  - **Diferente:** na 2.2, a guarda era a flag `prospectDivergente`, ligada no
    `getSObjectExistente`. Aqui a decisão fica toda no
    `ClienteService.prospectPodeSerGravado`, chamado no
    `preencherAtributosAccount`.
  - **Ficou de fora:** o `criarLeadDoCliente`, que é da R4 e da R5.
- **Do [`b372038f43`](inventario-commits-2.2.md#c9):** a guarda vale em todo
  evento do `/Cliente`, inclusive no contato e no endereço. Na 2.2, esses
  eventos eram descartados inteiros; aqui eles são aplicados em Y, só sem o
  prospect.
- **Do [`de3731957d`](inventario-commits-2.2.md#c17):** a guarda do eco, sem
  caixa e sem espaço (o `idProspectIgualAoIdCliente`). A 1.3 já tinha uma
  comparação exata. O "null" em texto também não é gravado, como no
  `idProspectSalesforceFoiInformado` da 2.2.
  - **Ficou de fora:** a criação de Lead no `vincularLeadExistente`, que é da
    R4.
- **Sem equivalente na 2.2:** o Lead do prospect precisa ter o CPF da pessoa
  ou nenhum. O CPF da pessoa é o do evento ou, sem ele, o da Account. Sem Lead
  com aquele `Id__c`, o prospect é gravado, como na 1.3. As escolhas estão no
  [plano, seção 4.3](plano-branch-reescrita-2.2.md#43-as-lacunas-do-c47170d879-e-o-resto-da-r1).
- **Testes:** o `prospectPodeSerGravadoTest`, no `ClienteServiceTest`, e o
  `contatoComProspectDeXNaoGravaOProspectNaContaDeYTest`, o
  `clienteUpdateNaoGravaProspectDeLeadDeOutroCpfTest` e o
  `clienteUpdateGravaOProspectDoLeadDaPessoaTest`, no `NotificacaoClienteTest`.
  O último usa um prospect em minúsculas por causa de um defeito latente da
  1.3 no `refletirAlteracoesLead`, descrito no plano.
- **Verificação na dev (22/10):**
  - **TC-001 e TC-001-XSI, nos 12 perfis:** a cadeia vai até o fim, com todos
    os eventos em 200. Sobram só o Lead de Y ("pendente R4") e, no RC, o
    contato atrasado ("pendente R3").
  - **Os 18 TCs da verificação da lacuna** (seção 4.3 do plano), em 228 RUNs:
    nenhum evento fora do 200. Contra o ponto zero, os 228 pares saem de
    "pendente R1". Account X intacta e Lead X intacto passam em todos. O 024 e
    o 027 (Caso C) ficam conformes em 11 perfis; no RC, só o "pendente R3". O
    resto fica "pendente R4", e o 038 tem B3 em C1, C2, C3, AR e FW (lacuna
    4).
  - **Duas asserções passavam por engano no ponto zero.** No 020 e no 025,
    "1 Lead com o CPF aprovado" e "Account aprovada → Lead" passavam porque Y
    tomava o Lead X e gravava nele o CPF de Y. Agora o Lead X fica intacto, e
    as duas falham como "pendente R4".

### 2.14 `1749168299`: lacuna 4, commit novo

- **O defeito (B3):** o `obterClientePorCPF` pegava a Account modificada por
  último (`LIMIT 1`). Com duas Accounts do mesmo CPF, a PAC em análise sem
  IdCliente ia para a duplicada sem IdCliente, e a pendência gravava nela. Na
  2.2, isso segue igual na ponta.
- **Aqui:** a consulta traz até 100 Accounts do CPF, da modificada por último
  para a mais antiga, e o `escolherContaDoCpf` fica com a primeira que tem
  IdCliente. Sem nenhuma com IdCliente, fica a modificada por último, como
  antes. O limite de 100 só protege contra CPFs genéricos repetidos em massa.
- **Onde vale:** em toda busca por CPF. São a PAC (inclusive a nova busca de
  quando ela acha X com outro CPF, que é o caminho do B3 no C2 e no C3), o
  `/Cliente`, a máquina e o flow de tela da Venda Genérica
  (`VG_MSClienteCriarAtualizarInvocable`).
- **Testes:** o `obterClientePorCPFPrefereAContaComIdClienteTest` e o
  `escolherContaDoCpfTest`, no `ClienteSelectorTest`.
- **Verificação na dev (22/10):** no TC-038, a Account Y2 fica intacta e a
  aprovada é a Y1 nos 13 RUNs. O B3 sai do C1, do C2, do C3, do AR e do FW. No
  TC-025, com as duas sem IdCliente, a escolhida segue a Y2, a mais recente.

### 2.15 `37246536b2` ← parte do `56813a221e` (2.1)

- **Do `56813a221e`** (2.1, US 918899, 18/08), escolha (ii) do plano:
  - **`CpfCNPJ` e `CpfCNPJTest`:** o trecho do commit aplicado pelo git. Os
    dois arquivos ficaram iguais aos do `56813a221e` byte a byte, conferidos
    por hash. Quando a 2.1 entrar, não há conflito neles.
  - **`ClienteSelector`:** a mesma mudança de duas linhas, com o mesmo nome de
    variável (`setCPFExpandido`). A consulta passa a ser
    `WHERE CPF__pc IN :setCPFExpandido`, e o `OR CPFSemFormatacao__c` sai.
  - **Ficou de fora:** o teste que ele acrescentou ao `ClienteSelectorTest`.
    Ele estende um teste que a base não tem, então entrou um teste próprio.
- **Na 2.2:** o [`85e4c3ba5f`](inventario-commits-2.2.md#c10) pôs o `OR` na
  fórmula, e a busca do [`da90427ced`](inventario-commits-2.2.md#c34) trocou o
  `OR` pelo mesmo `expandirFormatosCPF`. Na base 1.3, o `OR` já vinha do
  `6af00f4bc3`.
- **Diferente do `56813a221e`:** a consulta mantém o `LIMIT 100` e a escolha
  do commit 16 (lacuna 4), em vez do `LIMIT 1`.
- **Testes:**
  - o `obterClientePorCPFComMascaraDosDoisLadosTest`, no `ClienteSelectorTest`:
    máscara dos dois lados e menos de 11 dígitos;
  - o `chamarServicoReaproveitaContaComCpfMascaradoTest`, no
    `VG_MSClienteCriarAtualizarInvocableTest`, que o plano pedia para o flow de
    tela da Venda Genérica.
- **Verificação na dev (22/10):**
  - **Explain:** a consulta antiga só tem planos de varredura da tabela. A nova
    tem como primeiro plano o índice do `CPF__c`, com custo 0.
  - **Harness:** o TC-001, o 009, o 025 e o 038, nos 12 perfis, sem nenhuma
    mudança contra as campanhas anteriores. Nenhum TC usa CPF com máscara.

### 2.16 `ea5495b870`: mistura do `9210581ea5`, do `ec9d1a6a7c`, do `12182e7e78` e do `7c86318a05`

- **Do [`9210581ea5`](inventario-commits-2.2.md#c45):** o
  `obterCpfProponentePorIdCliente` com o prospect, igual ao da ponta da 2.2.
  O CPF vem do Proponente de mesmo IdCliente ou, sem ele, do de `idProponente`
  igual ao prospect. Os três testes dele entraram iguais.
- **Do [`ec9d1a6a7c`](inventario-commits-2.2.md#c24):** o
  `obterOportunidadePorPayload`, igual, e a exceção do vínculo histórico. Com
  IdCliente obsoleto, se a Account achada pelo prospect foi descartada mas a
  Opportunity já está nela, ela continua lá, sem fila manual.
- **No lugar do [`12182e7e78`](inventario-commits-2.2.md#c13) e do
  [`7c86318a05`](inventario-commits-2.2.md#c46):** uma regra só, o
  `contaQueAJornadaMantem`. A jornada sem IdCliente não move a Opportunity que
  já existe: ela fica na Account em que está, seja qual for a Account achada.
  Sem Account achada, o evento é aplicado na Account da Opportunity, sem fila
  manual.
  - **Diferente do `12182e7e78`:** ele só mantinha a Opportunity se a Account
    atual tivesse IdCliente, condição que X também cumpre. O
    `deveManterOportunidadeNaContaAprovada` não entrou.
  - **Diferente do `7c86318a05`:** o `devePreservarContaAtualDaOportunidade`
    não entrou. Sem IdCliente, a regra nova já mantém a Opportunity, com o
    match descartado ou não.
  - **Não mexe no `OportunidadeSelector`,** como o `12182e7e78` fazia. A
    Account da Opportunity vem pelo `pesquisaContaPorId`.
- **Testes:** os três do `9210581ea5`; o
  `jornadaSemIdClienteNaoMoveAOportunidadeTest`, o
  `jornadaSemIdClienteComCpfDivergenteMantemAContaDaOportunidadeTest` e o
  `jornadaComIdClienteObsoletoMantemAContaDaOportunidadeTest`, no lugar dos
  testes do `12182e7e78`, do `7c86318a05` e do `ec9d1a6a7c`; e o
  `jornadausuarioSemIdClienteNaoTiraAOportunidadeDaContaAprovadaTest`, de ponta
  a ponta pelo `realizaPost`. Este último tira do payload o corretor e o cupom,
  que barram em validações sem relação com a regra, e simula a busca de
  campanhas que o trigger da Opportunity enfileira.
- **Ficou de fora:** mover a Opportunity na PAC aprovada, que é a lacuna 8.
- **Verificação na dev (22/10):** o TC-001, o 009, o 025 e o 038, nos 12
  perfis, sem mudança contra a lacuna 5. O harness sempre manda a jornada com
  IdCliente, então o caminho novo só é exercitado pelos testes Apex.
- **Variantes no harness (22/10),** no lugar do cenário de catálogo, que só
  roda com o app e um Postgres. Nos 12 perfis, o `jornadausuario-update` final
  sai sem IdCliente, depois da PAC aprovada, e a Opportunity fica em Y:
  - **TC-001-MSI,** só com o prospect de X: vale a regra do
    `contaQueAJornadaMantem`;
  - **TC-001-MPC,** com o CPF de Y no `proponentecredito`, no Proponente de
    `idProponente` igual ao prospect: a busca acha Y pelo CPF.

### 2.17 `0d4d046b9d` ← refaz o `4d54e3b7d9`

- **Igual ao [`4d54e3b7d9`](inventario-commits-2.2.md#c36):** com a PAC em
  `CREDITO_APROVADO_CONDICIONADO`, depois do upsert dos Proponentes, a
  Opportunity vai para a Account da pessoa aprovada, com o bypass do
  `ClienteTriggerHandler`.
- **Diferente:**
  - **A Account:** lá era a ligada ao Proponente principal, se tivesse
    IdCliente. Aqui é a que o IdCliente e o CPF do principal apontam, pela
    mesma busca do Proponente, sem prospect: se a Account do IdCliente tiver
    outro CPF, vale a do CPF.
  - **O prospect não move a Opportunity.** Sem IdCliente e sem CPF, nada
    muda. É o "não move Opportunity existente" que tinha ficado de fora do
    commit 14.
  - **DML parcial:** a falha no update vai para o log e não derruba a PAC
    (plano, seção 4.2). Lá era um `update` que lançava exceção.
  - **Sem os ganchos de teste** `statusPacParaTeste` e `oportunidadeParaTeste`
    e sem o `statusPacAutorizaProjecaoContatos`, que é do `07608bac4a`. O
    método lê o status do payload, e os testes passam pelo `realizaPost`.
- **Testes:** no `NotificacaoPACTest`, o
  `pacAprovadaLevaAOportunidadeParaAContaDaPessoaTest`, o
  `pacAprovadaSemContaDaPessoaNaoMoveAOportunidadeTest`, o
  `pacEmAnaliseNaoMoveAOportunidadeTest` e o
  `pacAprovadaSoComOProspectNaoMoveAOportunidadeTest`.
- **Verificação na dev (22/10):** nos 10 TCs de Venda Genérica (040 a 048 e
  062), nos 12 perfis, "Opportunity na Account aprovada" passa nos 121 RUNs,
  inclusive nos 20 do AR e do FW, que não têm evento de máquina. No ponto zero,
  o 040 e o 062 falhavam ali, e o 041 a 048 passavam por engano, porque X tinha
  sido sobrescrita por Y.

## 3. Destino dos commits da 2.2 já tratados

| Commit da 2.2 | Destino |
|---|---|
| [`3f4b3f0906`](inventario-commits-2.2.md#c1) (1) | o campo `criarLeadDoCliente` não entra (commit 7) |
| [`dcb966ddd9`](inventario-commits-2.2.md#c3) (3) | já na base, pelo `0ee6d92b81` (13/02) |
| [`fbbde9da5c`](inventario-commits-2.2.md#c4) (4) | já na base, pelo `0f9014e393`; o cherry-pick sairia vazio |
| [`c47170d879`](inventario-commits-2.2.md#c6) (6) | commit 7 |
| [`09dadb24bf`](inventario-commits-2.2.md#c8) (8) | o `prospectPertenceAOutraConta` e a guarda da gravação do prospect, no commit 15; o `criarLeadDoCliente` fica para a R4 e a R5 |
| [`b372038f43`](inventario-commits-2.2.md#c9) (9) | o descarte em todo evento, no commit 13, sem descartar o evento inteiro; a guarda do prospect em todo evento, no commit 15 |
| [`fbd67a1216`](inventario-commits-2.2.md#c15) (15) | commit 2 |
| [`b4be1623d2`](inventario-commits-2.2.md#c20) (20) | a regra do `IdProponente__c`, no commit 8; o `sincronizarIdProponentePrincipal` do `/Cliente` fica para a R4 |
| [`12182e7e78`](inventario-commits-2.2.md#c13) (13) | substituído pelo `contaQueAJornadaMantem` do commit 18 |
| [`ec9d1a6a7c`](inventario-commits-2.2.md#c24) (24) | o `obterOportunidadePorPayload` e a exceção do vínculo histórico, no commit 18; o `devePreservarContaAtualDaOportunidade` não entra |
| [`85e4c3ba5f`](inventario-commits-2.2.md#c10) (10) | substituído pelo commit 17 |
| [`fc7077f94d`](inventario-commits-2.2.md#c16) (16) | refeito no commit 12, com conferência de CPF |
| [`4d54e3b7d9`](inventario-commits-2.2.md#c36) (36) | refeito no commit 19, com a Account vinda da identidade da PAC |
| [`de3731957d`](inventario-commits-2.2.md#c17) (17) | a guarda do eco, no commit 15; a criação de Lead no `vincularLeadExistente` fica para a R4 |
| [`dea0460ade`](inventario-commits-2.2.md#c26) (26) | commit 3 |
| [`7694d36312`](inventario-commits-2.2.md#c27) (27) e [`d0e2635a70`](inventario-commits-2.2.md#c28) (28) | não entram (contra a R2) |
| [`542df3b1d1`](inventario-commits-2.2.md#c30) (30) | os comparadores de CPF e a forma final da regra do `IdProponente__c`, no commit 8; o resto fica para a R4 |
| [`a1eef12c11`](inventario-commits-2.2.md#c31) (31) | substituído pelo commit 5 |
| [`07608bac4a`](inventario-commits-2.2.md#c32) (32) | a linha da regra Perdido→Cancelado, no commit 5; a guarda do Proponente sem Account na pendência tem par no commit 9, no flow; o resto é da R3 |
| [`78a25da643`](inventario-commits-2.2.md#c33) (33) | não entra; o `ProponenteTriggerHandlerTest` do commit 9 só repete o nome da classe de teste dele; o resto é da R4 |
| [`9f0ba21f38`](inventario-commits-2.2.md#c38) (38) | commit 4 |
| [`c04b6add92`](inventario-commits-2.2.md#c39) (39) | o trecho das 3h, no commit 6; o resto é da R4 |
| [`1f6844e910`](inventario-commits-2.2.md#c43) (43) | a recusa da PAC em análise é substituída pelo commit 8; o CPF no descarte, no commit 14; o guard de parciais é da R3 |
| [`9210581ea5`](inventario-commits-2.2.md#c45) (45) | o ramo sem IdCliente e sem CPF, no commit 14; a leitura do CPF pelo `idProponente` e os testes, no commit 18 |
| [`7c86318a05`](inventario-commits-2.2.md#c46) (46) | substituído pelo `contaQueAJornadaMantem` do commit 18 |
