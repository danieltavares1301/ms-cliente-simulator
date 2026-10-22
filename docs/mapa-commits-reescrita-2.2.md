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
- **Falta:** o cenário de catálogo que o plano pede, no simulador.

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

## 3. Destino dos commits da 2.2 já tratados

| Commit da 2.2 | Destino |
|---|---|
| [`3f4b3f0906`](inventario-commits-2.2.md#c1) (1) | o campo `criarLeadDoCliente` não entra (commit 7) |
| [`dcb966ddd9`](inventario-commits-2.2.md#c3) (3) | já na base, pelo `0ee6d92b81` (13/02) |
| [`fbbde9da5c`](inventario-commits-2.2.md#c4) (4) | já na base, pelo `0f9014e393`; o cherry-pick sairia vazio |
| [`c47170d879`](inventario-commits-2.2.md#c6) (6) | commit 7 |
| [`b372038f43`](inventario-commits-2.2.md#c9) (9) | o descarte em todo evento, no commit 13, sem descartar o evento inteiro; o `prospectPertenceAOutraConta` fica para a lacuna 6 |
| [`fbd67a1216`](inventario-commits-2.2.md#c15) (15) | commit 2 |
| [`b4be1623d2`](inventario-commits-2.2.md#c20) (20) | a regra do `IdProponente__c`, no commit 8; o `sincronizarIdProponentePrincipal` do `/Cliente` fica para a R4 |
| [`ec9d1a6a7c`](inventario-commits-2.2.md#c24) (24) | pendente: lacuna 7 da R1 |
| [`fc7077f94d`](inventario-commits-2.2.md#c16) (16) | refeito no commit 12, com conferência de CPF |
| [`dea0460ade`](inventario-commits-2.2.md#c26) (26) | commit 3 |
| [`7694d36312`](inventario-commits-2.2.md#c27) (27) e [`d0e2635a70`](inventario-commits-2.2.md#c28) (28) | não entram (contra a R2) |
| [`542df3b1d1`](inventario-commits-2.2.md#c30) (30) | os comparadores de CPF e a forma final da regra do `IdProponente__c`, no commit 8; o resto fica para a R4 |
| [`a1eef12c11`](inventario-commits-2.2.md#c31) (31) | substituído pelo commit 5 |
| [`07608bac4a`](inventario-commits-2.2.md#c32) (32) | a linha da regra Perdido→Cancelado, no commit 5; a guarda do Proponente sem Account na pendência tem par no commit 9, no flow; o resto é da R3 |
| [`78a25da643`](inventario-commits-2.2.md#c33) (33) | não entra; o `ProponenteTriggerHandlerTest` do commit 9 só repete o nome da classe de teste dele; o resto é da R4 |
| [`9f0ba21f38`](inventario-commits-2.2.md#c38) (38) | commit 4 |
| [`c04b6add92`](inventario-commits-2.2.md#c39) (39) | o trecho das 3h, no commit 6; o resto é da R4 |
| [`1f6844e910`](inventario-commits-2.2.md#c43) (43) | a recusa da PAC em análise é substituída pelo commit 8; o resto é da R1 (lacuna 3) e da R3 |
