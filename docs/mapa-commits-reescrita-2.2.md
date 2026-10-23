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
| 20 | `6285c95a0d` | 4, seção 5.1, item 1 | Ponto único de escrita de contato na Account; a PAC aprovada leva à Account da pessoa o e-mail e o celular aprovados, com a data dela | do [`07608bac4a`](inventario-commits-2.2.md#c32) (32), o `sincronizarContatosAprovadosPac`, sem o furo de data do [`70f3295319`](inventario-commits-2.2.md#c37) (37) | commit novo (2.18) |
| 21 | `d363515af3` | 4, seção 5.1, item 2 | A pendência grava o e-mail da PAC na Account pelo ponto único, com a data do evento da PAC, no lugar da ação do flow `Proponente_1` | do [`07608bac4a`](inventario-commits-2.2.md#c32) (32), a troca do flow pelo `sincronizarEmailContatoPendencia` na `ProponenteTrigger` | commit novo (2.19) |
| 22 | `a920622615` | 4, seção 5.1, item 3 | Com contestação pendente, a PAC leva à Account de cada Proponente o e-mail e o celular do payload pelo ponto único, conferindo o CPF | mistura do `sincronizarContatosContestacao` do [`6612bab1b3`](inventario-commits-2.2.md#c29) (29) e da versão dele refeita no [`07608bac4a`](inventario-commits-2.2.md#c32) (32) | commit novo (2.20) |
| 23 | `0949e50a55` | 4, seção 5.1, item 5 | O reflexo da Account para o Lead do prospect só vale para o Lead do mesmo CPF ou sem CPF, e não quebra com maiúsculas no `Id__c` do Lead | sem equivalente: na 2.2, o `refletirAlteracoesLead` ganhou escopos e passou a gravar campo a campo ([`07608bac4a`](inventario-commits-2.2.md#c32) e `78a25da643`), mas nunca conferiu o CPF | commit novo (2.21) |
| 24 | `f78c8b75cc` | 5, seção 5.2, item 1 | Árvore de decisão do Lead da Venda Genérica extraída para o `PoliticaLeadService`, sem mudar o comportamento do flow de tela | sem equivalente: refatora a "regra 6.6" que a base 1.3 já tinha no `VG_MSClienteCriarAtualizarInvocable` | commit novo (2.22) |
| 25 | `c5abb331d3` | 5, seção 5.2, item 2 | No pós-PAC, a Account da pessoa ganha o Lead dela pela política única, com os contatos aprovados do Proponente da pessoa | reescreve o `criarLeadDoCliente` e o `insertLeadQueueable` da 2.2 (`d914e60785`, [`8b06b4cd2b`](inventario-commits-2.2.md#c11), `1195c8984b`, `509c87ad24`, `2eef5b7ba2`, `3029bcfb6d` e a parte de Lead do [`de3731957d`](inventario-commits-2.2.md#c17)), sem trazer o código | commit novo (2.23) |
| 26 | `f752cd0e94` | 5, seção 5.2, item 3 | O Lead reutilizado pela política ganha o CPF da pessoa e só recebe o contato aprovado onde está vazio e se não for de outro Lead | no lugar do `509c87ad24` (o Lead reutilizado ganha o CPF) e da heurística "diverge nos dois" do `d6f147d303`, com a regra explícita da P3 | commit novo (2.24) |
| 27 | `2c34f6f7c9` | 5, seção 5.2, item 5 (parte) | `PoliticaLeadService` renomeado para `UnificacaoLeadService`, e a Account ligada ao Lead de outro CPF ganha o Lead da pessoa | sem equivalente: na 2.2, o TC-021 ficava com Y ligada ao Lead de Z | commit novo (2.25) |
| 28 | `2ed8b04e05` | 5, seção 5.2, item 5 | O reflexo da Account para o Lead grava cada contato só onde o Lead está vazio ou acompanhava a Account, e nunca o contato de outro Lead (P7) | no lugar do reflexo "tudo ou nada" da 1.3 e da heurística "diverge nos dois" do `d6f147d303`; resolve o que o `78a25da643` tentava (o reflexo trocava os contatos do Lead Y) | commit novo (2.26) |
| 29 | `e3cbc42e54` | 5, seção 5.2, item 4 | Quando a Account ganha o Lead da pessoa, o Proponente principal recebe o mesmo prospect e o MS Clientes é avisado (P6) | a `MSClienteService` do [`d914e60785`](inventario-commits-2.2.md#c2) (2) e o teste do [`1792eaa62d`](inventario-commits-2.2.md#c5) (5), iguais byte a byte; refaz o `sincronizarIdProponentePrincipal` do [`b4be1623d2`](inventario-commits-2.2.md#c20) (20) e o retry do [`fe1d5a610c`](inventario-commits-2.2.md#c23) (23) e do [`72cbd884f6`](inventario-commits-2.2.md#c44) (44); o Lead reutilizado sem `Id__c` ganha um, como no [`509c87ad24`](inventario-commits-2.2.md#c18) (18) | commit novo (2.27) |
| 30 | `753b1e272a` | 5, seção 5.2, item 6 | Na PAC aprovada, a Account do proponente principal sem prospect, ou com o prospect de um Lead de outro CPF, ganha um Lead do mesmo CPF, reutilizado ou criado | sem equivalente: na 2.2, só o `/Cliente` criava ou ligava o Lead depois da aprovação | commit novo (2.28) |

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

### 2.18 `6285c95a0d`: R3, item 1

- **O ponto único:** o `ClienteService.gravarContatosNaConta`, que recebe
  uma lista de `EscritaContato` (a Account, o CPF e o IdCliente da fonte, o
  e-mail, o celular, a data e a fonte).
  - **Identidade:** o mesmo CPF, só pelos dígitos; sem CPF de um dos lados,
    o mesmo IdCliente, sem caixa.
  - **Data:** cada tipo só é gravado com data mais nova que o carimbo dele
    (`DataAlteracaoEventoContatoEmail__c` e `…Celular__c`, os do `/Cliente`).
    O carimbo avança mesmo quando o valor já é o mesmo.
  - **DML parcial com log.**
- **Do [`07608bac4a`](inventario-commits-2.2.md#c32):** a PAC aprovada leva
  à Account do principal o e-mail e o celular aprovados, com a data da PAC
  (já corrigida pelo item 5 da etapa 1). É o `sincronizarContatosAprovadosPac`.
  - **Diferente:** lá, a Account precisava ter o IdCliente da PAC e o CPF
    compatível; aqui, o CPF igual basta, e sem CPF vale o IdCliente. Não
    entraram o bloqueio por conflito entre Proponentes, o escopo de reflexo
    para o Lead nem a `ReconciliacaoContatosLeadQueueable`, que são da R4.
- **O que não entrou:** o [`70f3295319`](inventario-commits-2.2.md#c37), que
  gravava sem olhar a data na Account da PAC vigente. Pela decisão 1 da R3
  (plano, seção 5.1), a data decide.
- **Testes:** o `gravarContatosNaContaTest`, no `ClienteServiceTest`, e o
  `pacAprovadaGravaOsContatosAprovadosNaContaDaPessoaTest` e o
  `pacAprovadaNaoSobrescreveContatoMaisNovoTest`, no `NotificacaoPACTest`.
- **Verificação na dev (22/10):** os 39 TCs no RC, no CA, no PA e no AR. No
  RC, "Account aprovada com os contatos da PAC" e o contato atrasado
  descartado passam nos 39, e o "pendente R3" some. Nada piorou nos outros
  três perfis.

### 2.19 `d363515af3`: R3, item 2

- **Do [`07608bac4a`](inventario-commits-2.2.md#c32):** a ação do flow
  `Proponente_1` que gravava o e-mail da pendência na Account sai, e o Apex
  na `ProponenteTrigger` (after insert e after update) faz o trabalho. Lá era
  o `sincronizarEmailContatoPendencia`, que o `78a25da643` mudou depois; aqui
  é o `ProponenteTriggerHandler.gravarEmailDaPendencia`.
- **Diferente:**
  - **Passa pelo ponto único** do commit 20: confere o CPF (ou o IdCliente)
    do Proponente contra a Account. Lá, a pendência não conferia nada.
  - **A data:** é a do evento da PAC, gravada no registro da PAC
    (`PropostaAnaliseCredito__c.DataAlteracaoEvento__c`) e já corrigida pelas
    3h do item 5 da etapa 1. Lá era o `Proponente.DataAlteracaoEvento__c`, um
    texto cru do payload, que no relógio do crédito vem sem fuso. Com a data
    da PAC, a pendência e a PAC aprovada carimbam o mesmo e-mail com a mesma
    data.
  - **O carimbo:** o do `/Cliente` (`DataAlteracaoEventoContatoEmail__c`).
    Lá era o `Contact.DataHoraAtualizacaoEmailPendencia__c`, que o `/Cliente`
    não lê.
  - **No update,** só roda quando muda o e-mail, a flag, a Account ou a data
    do Proponente. O flow regravava a cada save.
- **O flow `Proponente_1`:** saem a decisão "EnvioPendencia", a fórmula
  `Now()` e o update "AtualizarEmailConta". Fica o ReplyTo na Opportunity
  (v6 na dev).
- **Testes:** no `ProponenteTriggerHandlerTest`, a pendência grava com a data
  da PAC, não sobrescreve um e-mail mais novo, não grava na Account de outro
  CPF e, sem Account, não grava nada.
- **Verificação na dev (22/10):** os 39 TCs no C1, C2, C3, AR, AM e FW, os
  perfis com pendência: nenhuma diferença contra a etapa 3. O harness não
  separa o carimbo, que fica coberto pelos testes Apex.

### 2.20 `a920622615`: mistura do `6612bab1b3` e do `07608bac4a`

- **Do [`6612bab1b3`](inventario-commits-2.2.md#c29):** com contestação
  pendente na PAC, os contatos do payload vão para a Account de cada
  Proponente. Aqui é o `NotificacaoPAC.gravarContatosDaContestacao`, chamado
  depois do upsert dos Proponentes e antes do `resolverContestacao`.
- **Do [`07608bac4a`](inventario-commits-2.2.md#c32):** a versão refeita, sem
  a escrita no Lead e com a data obrigatória (a da PAC).
- **Diferente:**
  - **O ponto único confere o CPF.** Lá, só o IdCliente, e era daí que vinha o
    B2: no C4, a PAC de Y trazia o IdCliente de X.
  - **Não entraram** o bloqueio por conflito entre Proponentes da mesma
    Account e a troca do `ContestacaoSelector` para a contestação pendente
    mais recente, que não muda nada aqui.
  - **O `deveUsarContatoAprovado`** não entrou: no branch, o Proponente já
    recebe sempre os contatos do payload.
- **Testes:** no `NotificacaoPACTest`, a PAC com contestação pendente leva o
  e-mail para Y e deixa X intacta, e a PAC sem contestação e não aprovada não
  grava contato.
- **Verificação na dev (22/10):** os 39 TCs no C4: nenhuma mudança contra a
  etapa 3, e X intacta em 35 de 35, com a contestação agora gravando.

### 2.21 `0949e50a55`: R3, item 5, commit novo

- **O defeito:** o `refletirAlteracoesLead` da 1.3 copiava os dados da
  Account (CPF, e-mail, celular, nome, renda e nascimento) para o Lead do
  prospect sem conferir a pessoa. É o B4: no TC-021, o Lead Z recebia o CPF e
  os contatos de Y. Com a R3 aumentando as escritas na Account, ele
  disparava mais.
- **Aqui (decisão 2 da R3):** o reflexo só vale para o Lead do mesmo CPF da
  Account, só pelos dígitos, ou sem CPF (o `leadDaMesmaPessoa`). O reflexo
  completo, com a regra P7, segue na R4.
- **A correção do `NullPointerException`:** o mapa das Accounts é indexado
  pelo prospect em minúsculas, e a busca usava o `Id__c` do Lead como está
  gravado. Com maiúscula no `Id__c`, o update da Account caía (achado na
  lacuna 6, plano, seção 4.3). A 2.2 tem o mesmo código.
- **Testes:** o `refletirAlteracoesLeadSucessoTest` usava um Lead de outro
  CPF e esperava o reflexo; o Lead passou a ter o CPF da Account. O
  `refletirAlteracoesLeadConfereOCpfDoLeadTest` é novo.
- **Verificação na dev (22/10):** no TC-021, nos 13 perfis, o B4 some. O
  "1 Lead com o CPF aprovado" passa a falhar ("pendente R4"): ele só passava
  porque o Lead Z recebia o CPF de Y.

### 2.22 `f78c8b75cc`: R4, item 1, refatoração

- **O que é:** a árvore de decisão do Lead que a base 1.3 tinha no flow de tela
  da Venda Genérica (`VG_MSClienteCriarAtualizarInvocable`, a "regra 6.6") sai
  para o `PoliticaLeadService`, para o pós-PAC usar a mesma política (decisão
  de 22/10, plano, seção 5.2).
  - **`decidir(cpf, email, celular)`:** a árvore, com o mesmo código. Reutiliza
    o Lead livre do mesmo CPF; com todos presos, não reutiliza nem cria; sem
    Lead do CPF, reutiliza o candidato sem CPF e sem Account achado pelo
    contato; sem nada, decide criar, marcando o contato que já é de outro CPF.
    Só a entrada mudou: CPF, e-mail e celular explícitos, no lugar da Account.
  - **`criarLead(...)`:** a criação, também com os contatos explícitos, e
    devolvendo o Id do Lead.
- **O invocable** mantém o `vincularLeadExistenteAoCliente`, o
  `criarLeadDoCliente` e o `VinculacaoLeadResult`, que delegam ao serviço com
  os dados da Account. O flow de tela não muda.
- **Testes:** os 25 do `VG_MSClienteCriarAtualizarInvocableTest`, sem mudança.
  Um deles pegou um `NullPointerException` que o código original engolia
  dentro do `try`; a delegação passou a usar navegação segura.

### 2.23 `c5abb331d3`: R4, item 2, a política no pós-PAC

- **Na 2.2:** o `/Cliente` ligava a flag `criarLeadDoCliente` e o
  `insertLeadQueueable` criava ou reutilizava o Lead de Y. Os contatos vinham
  do Proponente achado pelo prospect do evento, que era o de X (o passo 1 do
  B9), e a repetição do WebJob rodava a criação de novo (o B6 e o B7). Esses
  commits não entram; a política nova resolve o problema de cada um (plano,
  seção 5.2, "O que é reescrito").
- **Aqui:**
  - **Quando:** o `/Cliente` enfileira o `VinculoLeadPosPacQueueable` no
    `cliente-insert` ou `cliente-update` da pessoa (Account achada pelo
    IdCliente, pelo CPF ou criada), quando a Account ficou sem prospect.
  - **O que roda:** o `PoliticaLeadService.vincularLeadPosPac`. Ele relê a
    Account com `FOR UPDATE` e não faz nada se ela já tiver prospect, o que
    evita o Lead duplicado e a repetição da R5.
  - **De onde vêm os contatos (P5):** do Proponente principal da pessoa,
    achado pelo CPF ou, sem CPF, pelo IdCliente
    (`getProponentePrincipalPorCpfOuIdCliente`), nunca pelo prospect. Sem
    Proponente, os da Account.
  - **A decisão (P1, P2, P4):** a árvore do commit 24.
  - **O vínculo (parte da P6):** o prospect do Lead vai para a Account.
  - **Sem contato de fonte nenhuma e sem Lead do CPF,** a política espera o
    próximo evento da pessoa em vez de criar um Lead vazio. No CA, o
    Queueable rodava antes de os contatos chegarem e criava o Lead errado.
- **Nomes:** o Queueable chegou a se chamar `VincularLeadDaPessoaQueueable`
  e foi renomeado antes do commit.
- **Testes:** o `PoliticaLeadServiceTest` (novo, seis casos) e, no
  `NotificacaoClienteTest`, o cliente da pessoa nova acabando com o Lead
  ligado. O `clienteUpdateNaoGravaProspectDeLeadDeOutroCpfTest` exigia a
  Account de Y sem prospect; agora Y ganha o Lead dela, e o teste confere só
  que não é o Lead de outro CPF.
- **Verificação na dev (22/10):** uma amostra de 10 TCs (001, 002, 006, 010,
  012, 019, 024, 026, 040 e 045) no CA, no AR e no FW: 27 conformes em 30,
  contra 3 na etapa 4. Sobra o 012, com o candidato reutilizado sem o CPF da
  pessoa (item 3).

### 2.24 `f752cd0e94`: R4, item 3, a P3

- **Aqui:** quando a política reutiliza um Lead, o `completarLeadReutilizado`
  dá ao candidato sem CPF o CPF da pessoa e preenche o e-mail e o celular
  aprovados só onde o Lead está vazio, e só se o contato não estiver em outro
  Lead que não tenha o CPF da pessoa (P4).
- **Na 2.2:** o `509c87ad24` dava o CPF ao Lead reutilizado, e o `d6f147d303`
  separava contato próprio de contato velho pela heurística "diverge nos dois"
  (com e-mail e celular divergindo, o Lead ficava como estava). A P3 troca a
  heurística pela regra: o Lead reutilizado só recebe contato onde está vazio
  (decisão 4).
- **Testes:** no `PoliticaLeadServiceTest`, o candidato ganha o CPF, o Lead Y
  mantém o e-mail próprio e recebe o celular no campo vazio, e o celular que
  já é de outro Lead não vai para o Lead Y.
- **Verificação na dev (23/10):** os TCs do candidato (012, 013, 045, 046 e
  049) e do Lead Y com contatos preservados (009, 019, 022, 023 e 047) no CA,
  no AR e no FW: 27 conformes em 30. Sobra o 047, em que o reflexo da Account
  para o Lead troca os contatos próprios do Lead Y depois do vínculo (item 5).

### 2.25 `2c34f6f7c9`: rename e o prospect de outro CPF

- **O rename:** o `PoliticaLeadService` e o teste dele passam a
  `UnificacaoLeadService` e `UnificacaoLeadServiceTest`, o termo que o código
  já usa para esse domínio (`getClienteUnificacaoLead` e outros). O invocable
  da Venda Genérica e o Queueable seguem o nome novo.
- **O prospect de outro CPF:** o `precisaVincularLead` diz se a Account
  precisa do Lead da pessoa: sem prospect, ou com o prospect de um Lead de
  outro CPF. O `vincularLeadPosPac` e o `/Cliente` usam esse critério. Com o
  prospect de outro CPF, a política troca o prospect pelo Lead da pessoa, e o
  Lead antigo não é tocado. É o TC-021, em que a massa liga Y ao Lead de Z.
- **Testes:** a troca do prospect de outro CPF e o `precisaVincularLeadTest`.

### 2.26 `2ed8b04e05`: R4, item 5, a P7

- **Antes:** o reflexo da 1.3 era "tudo ou nada". Se o e-mail ou o celular da
  Account já estava em outro Lead, nada ia; senão, tudo ia, sobrescrevendo os
  contatos do Lead.
- **Aqui:** o nome, a renda, o nascimento e o CPF vão para o Lead da mesma
  pessoa como antes. Cada contato vai só se o campo do Lead estiver vazio ou
  igual ao valor anterior da Account (o Lead acompanhava a Account), e se não
  for de outro Lead (`contatoPodeSerRefletido`).
  - **O Lead Y reutilizado** mantém os contatos próprios (047, decisão 4).
  - **O Lead que acompanhava a Account** a segue: é o MATCH do 039 e do 004,
    em que a planilha manda o Lead receber os contatos aprovados.
- **Testes:** os dois de reflexo que esperavam o "tudo ou nada" passaram a ter
  o Lead acompanhando a Account antes da mudança; entraram o contato próprio
  que fica e o contato de outro Lead que não vai.
- **Verificação na dev (23/10):** 10 TCs no CA, no AR e no FW (047, 039, 004,
  009, 019, 022, 023, 010, 021 e 012): 29 conformes em 30. Sobra o 021 no CA.
  Na época, o diagnóstico foi o `IdProponente__c` do principal com o prospect
  antigo, a corrigir no item 4. Estava errado: o principal já tinha o prospect
  final da Account, e o que divergia era o PROS-Y que o harness lê (seção
  2.27).

### 2.27 `e3cbc42e54`: R4, item 4, o resto da P6

- **Aqui:** depois que o `vincularLeadPosPac` grava o prospect na Account:
  - **o Proponente principal:** os principais ligados à Account recebem o
    mesmo prospect no `IdProponente__c` (`sincronizarIdProponentePrincipal`);
  - **o MS Clientes:** o `avisarMsClientes` (`@future(callout=true)`) chama o
    `MSClienteService.atualizarCliente` com o IdCliente e o prospect, se a
    Account tiver IdCliente;
  - **o lock:** os updates da Account, do principal e do Lead reutilizado
    passam pelo `atualizarComRetry`. Ele usa DML parcial, repete até 3 vezes
    só os registros que falharam por `UNABLE_TO_LOCK_ROW` e, se não der, só
    registra no log, sem exceção;
  - **o Lead reutilizado sem `Id__c`:** ganha um prospect novo antes do
    vínculo (a `Decisao` passa a levar o `idLeadReutilizado`). Até aqui, esse
    caso deixava a Account sem prospect.
- **Copiado como está:** a `MSClienteService` (do `d914e60785`) e a
  `MSClienteServiceTest` (do `1792eaa62d`), iguais byte a byte, e as 4 linhas
  do `ATUALIZAR_CLIENTE` no `GraphQLCreator` e a mudança do
  `GraphQLCreatorTest` (diffs aplicados sem conflito).
- **Na 2.2:** o `sincronizarIdProponentePrincipal` do `b4be1623d2` buscava os
  principais da Account, e o retry vinha em dois commits: o do `fe1d5a610c`
  (DML parcial no `IdProponente__c`) e o do `72cbd884f6` (`update` em
  try/catch na Account, relançando o erro que não fosse lock). Aqui é um
  helper só, sem relançar, porque o Queueable já registra e segue.
- **Testes:** no `UnificacaoLeadServiceTest`:
  - o principal recebe o prospect, e o MS Clientes recebe o IdCliente e o
    prospect (mock que guarda o corpo da chamada);
  - o Lead do CPF sem `Id__c` ganha um, sem Lead novo;
  - com 2 locks simulados, a terceira tentativa liga o Lead;
  - com 3, a Account fica sem prospect, sem exceção.

  O lock é simulado por um contador `@TestVisible` (`locksSimulados`), que
  devolve o `SaveResult` de `UNABLE_TO_LOCK_ROW` sem fazer o DML. O lock real
  nunca foi reproduzido (plano, seção 5.2).
- **Verificação na dev (23/10):** 10 TCs no CA, no AR e no FW (021, 001, 006,
  012, 019, 024, 026, 040, 045 e 047): 29 conformes em 30, igual ao item 5.
  Nos logs, 27 vínculos (18 reutilizados, 9 novos), 18 principais
  sincronizados, 27 avisos ao MS Clientes respondidos com sucesso pelo
  simulador, e nenhuma falha por lock.
- **O 021 no CA:** a primeira execução da política adia o Lead, porque a
  Account de Y ainda não tem contato e Y não tem Proponente. O harness lê o
  PROS-Y nesse momento, e ele ainda é o do Lead de Z. O eco que o harness
  manda com esse PROS-Y dispara a política de novo, que cria o Lead de Y e
  liga a Account e o principal a ele. O estado final está certo; a asserção
  compara com o PROS-Y lido antes. Na produção, sem o vínculo não há
  `atualizarCliente` nem eco, e quem liga o Lead é a PAC aprovada (item 6).

### 2.28 `753b1e272a`: R4, item 6, a PAC aprovada

- **Aqui:** depois de gravar os contatos aprovados, a PAC aprovada confere a
  Account de cada proponente principal ligado a uma Account. Se ela precisa do
  Lead do mesmo CPF (`precisaVincularLead`: sem prospect, ou com o prospect de
  um Lead de outro CPF), a PAC enfileira o mesmo `VinculoLeadPosPacQueueable`
  do `/Cliente` (`vincularLeadNaContaAprovada`).
- **Por quê:** no CA, o `cliente-update` chega antes dos contatos e da PAC de
  Y. A primeira execução da política adia o Lead, porque não há contato nem
  Proponente de Y. Sem vínculo, o Salesforce não chama o `atualizarCliente`, e
  o MS Clientes não manda eco. Antes deste commit, só o eco que o harness
  mandava sempre (e que no real não existiria) disparava a política de novo.
  Agora a PAC aprovada, que sempre chega e já traz os contatos aprovados, é o
  segundo gatilho.
- **Testes:** no `NotificacaoPACTest`, a PAC aprovada liga à Account de Y sem
  Lead um Lead do CPF de Y e acerta o principal; a PAC em análise não liga.
- **Harness, junto:** o eco do MS Clientes passou a sair só quando há aviso
  (`atualizarCliente`), com o prospect do aviso, e o PROS-Y passou a ser esse
  prospect (runbook, seção 4.6). Com o harness antigo, o 021 no CA ficava
  DIVERGENTE pelo PROS-Y lido antes do vínculo (seção 2.27).
- **Verificação na dev (23/10):** os 10 TCs da amostra do item 4 no CA, no AR
  e no FW, já com o harness novo: 30 conformes em 30. No 021 do CA, o Lead de
  Y é ligado pela PAC aprovada, e o eco sai depois dela. No 001, 012, 040 e
  045 do CA, que também tinham o Lead adiado, a asserção do principal passou a
  conferir o PROS-Y. O 024 fica sem eco nos três perfis, porque o Lead do CPF
  está preso a outra Account.

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
| [`b4be1623d2`](inventario-commits-2.2.md#c20) (20) | a regra do `IdProponente__c`, no commit 8; o `sincronizarIdProponentePrincipal`, refeito no commit 29 |
| [`12182e7e78`](inventario-commits-2.2.md#c13) (13) | substituído pelo `contaQueAJornadaMantem` do commit 18 |
| [`ec9d1a6a7c`](inventario-commits-2.2.md#c24) (24) | o `obterOportunidadePorPayload` e a exceção do vínculo histórico, no commit 18; o `devePreservarContaAtualDaOportunidade` não entra |
| [`85e4c3ba5f`](inventario-commits-2.2.md#c10) (10) | substituído pelo commit 17 |
| [`fc7077f94d`](inventario-commits-2.2.md#c16) (16) | refeito no commit 12, com conferência de CPF |
| [`4d54e3b7d9`](inventario-commits-2.2.md#c36) (36) | refeito no commit 19, com a Account vinda da identidade da PAC |
| [`70f3295319`](inventario-commits-2.2.md#c37) (37) | não entra (decisão 1 da R3: a data decide) |
| [`de3731957d`](inventario-commits-2.2.md#c17) (17) | a guarda do eco, no commit 15; a criação de Lead no `vincularLeadExistente` fica para a R4 |
| [`dea0460ade`](inventario-commits-2.2.md#c26) (26) | commit 3 |
| [`7694d36312`](inventario-commits-2.2.md#c27) (27) e [`d0e2635a70`](inventario-commits-2.2.md#c28) (28) | não entram (contra a R2) |
| [`542df3b1d1`](inventario-commits-2.2.md#c30) (30) | os comparadores de CPF e a forma final da regra do `IdProponente__c`, no commit 8; o resto fica para a R4 |
| [`a1eef12c11`](inventario-commits-2.2.md#c31) (31) | substituído pelo commit 5 |
| [`07608bac4a`](inventario-commits-2.2.md#c32) (32) | a linha da regra Perdido→Cancelado, no commit 5; a guarda do Proponente sem Account na pendência tem par no commit 9, no flow; a sincronização da PAC aprovada, no commit 20; a pendência em Apex, no commit 21; a contestação, no commit 22 |
| [`6612bab1b3`](inventario-commits-2.2.md#c29) (29) | a sincronização da contestação, no commit 22, conferindo o CPF |
| [`78a25da643`](inventario-commits-2.2.md#c33) (33) | não entra; o `ProponenteTriggerHandlerTest` do commit 9 só repete o nome da classe de teste dele; o resto é da R4 |
| [`9f0ba21f38`](inventario-commits-2.2.md#c38) (38) | commit 4 |
| [`c04b6add92`](inventario-commits-2.2.md#c39) (39) | o trecho das 3h, no commit 6; o resto é da R4 |
| [`1f6844e910`](inventario-commits-2.2.md#c43) (43) | a recusa da PAC em análise é substituída pelo commit 8; o CPF no descarte, no commit 14; o guard de parciais é da R3 |
| [`9210581ea5`](inventario-commits-2.2.md#c45) (45) | o ramo sem IdCliente e sem CPF, no commit 14; a leitura do CPF pelo `idProponente` e os testes, no commit 18 |
| [`7c86318a05`](inventario-commits-2.2.md#c46) (46) | substituído pelo `contaQueAJornadaMantem` do commit 18 |
| [`d914e60785`](inventario-commits-2.2.md#c2) (2) | a `MSClienteService` e o `ATUALIZAR_CLIENTE` do `GraphQLCreator`, no commit 29; o resto é reescrito pela política da R4 (commits 24 a 29) |
| [`1792eaa62d`](inventario-commits-2.2.md#c5) (5) | a `MSClienteServiceTest` e a mudança do `GraphQLCreatorTest`, no commit 29; os testes de seletores não entram |
| [`fe1d5a610c`](inventario-commits-2.2.md#c23) (23) e [`72cbd884f6`](inventario-commits-2.2.md#c44) (44) | o padrão do retry, refeito no `atualizarComRetry` do commit 29 |
