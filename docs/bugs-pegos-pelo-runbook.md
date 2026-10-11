# Bugs pegos pelo runbook na `mrv-devDan`

Catálogo dos bugs que o harness do runbook pega, com cada TC e cada perfil em
que ele aparece. Versão de **2026-10-11**, com duas campanhas completas dos 44
TCs executáveis nos 13 perfis: uma sem e outra com os cinco commits da 2.2 que
a dev revertida não tinha (lista abaixo).

| Campanha | Estado da dev | Execução (UTC) | RUNs | Relatório |
|---|---|---|---|---|
| Sem os commits | 27/09 a 11/10: quatro classes centrais da 2.2 na versão de 03/09 | 11/10, 16:48 a 18:11 | 545: 331 conformes, 214 divergentes | [sem os commits](resultado-runbook-completo-sem-commits-2026-10-11.md) |
| Com os commits | desde 11/10, 20:43: as quatro na ponta da 2.2 (`3f2919f5e7`) | 11/10, 20:49 a 21:44 | 545: 331 conformes, 214 divergentes | [com os commits](resultado-runbook-completo-com-commits-2026-10-11.md) |

- **Os vereditos são os mesmos, par a par.** Os 214 pares divergentes são os
  mesmos nas duas campanhas; o que os commits mudam é o bug por trás de parte
  deles (seção 1).
- **Outros relatórios:** [ordens reais, sem os commits](resultado-runbook-ordens-reais-2026-10-11.md)
  e, para os bugs já conhecidos, [27/09](resultado-runbook-recorte-2.2-2026-09-27.md).
- **Estado da dev:** [estado da dev](estado-da-mrv-devDan.md).

### Os commits

Os cinco commits da 2.2 que a dev revertida não tinha e que estão nela desde
11/10, às 20:43 UTC. Do branch `GV_918914_UnificPosAprovPAC`. Na dev revertida,
`ClienteService`, `NotificacaoCliente` e `NotificacaoPAC` eram iguais a
`c04b6add92`, e `NotificacaoMaquinaEstado` a `9f0ba21f38`, os dois de 03/09.
Os títulos são os dos commits, sem o prefixo `[918914] - [UNIFICAÇÃO DE LEADS]`.

| Commit | Data | Título | Classes que ele muda |
|---|---|---|---|
| `1f6844e910` (commit 4) | 08/09 | Guard de identidade em NotificacaoCliente para eventos parciais pós-PAC | `ClienteService`, `NotificacaoCliente`, `NotificacaoPAC` |
| `72cbd884f6` (commit 3) | 09/09 | Novo Lead não é criado em cenário de aprovação de PAC com CPF divergente (UNABLE TO LOCK ROW) | `NotificacaoCliente` |
| `9210581ea5` | 09/09 | PAC enviado para fila manual indevidamente com erro "Cliente(Account) não encontrado no Salesforce" | `ClienteService`, `NotificacaoMaquinaEstado` |
| `7c86318a05` | 10/09 | Preserva vínculo histórico da Opp em jornadausuario-* sem idCliente | `NotificacaoMaquinaEstado` |
| `3f2919f5e7` | 21/09 | Corrige falso positivo no guard de identidade de payload parcial (contato-update/endereco-update) | `ClienteService`, `NotificacaoCliente` |

Os commits também mudam as classes de teste, que não alteram o comportamento
medido. O que cada um muda no código está na seção 4.1 do
[estado da dev](estado-da-mrv-devDan.md).

> **Como manter.** A cada campanha nova, rode
> `npm run runbook:bugs -- --entrada resultados.jsonl --comparar anterior.jsonl`.
> Ele liga cada asserção que falhou a um bug deste catálogo, pelas regras de
> `scripts/runbook/classificar-bugs.ts`, imprime a matriz da seção 3 e o que
> mudou desde a campanha anterior. Uma falha que sai como `?` não tem regra:
> analise-a e, se for bug novo, acrescente aqui e no script.

## 1. Resumo

Pares TC × perfil em que cada bug aparece, em cada campanha:

| Bug | O que acontece | Sem os commits | Com os commits |
|---|---|---|---|
| [B1](#b1) | A pendência grava em X o e-mail de Y (bug 4) | 139: C2 e C3 em todos menos os de MATCH; C1, AR e FW nos 19 TCs em que Y não tem Account | 82: só C2 e C3. **Corrigido no C1, no AR e no FW**, que passam ao B8 |
| [B2](#b2) | A contestação pendente grava em X o e-mail de Y | 41: C4 | 41: igual |
| [B3](#b3) | Sem IdCliente, a pendência grava na Account duplicada errada | 3: C1, AR e FW, no 038 | 3: igual |
| [B4](#b4) | A pendência reflete os dados de Y no Lead de Z | 3: AR, AM e FW, no 021 | 3: igual |
| [B5](#b5) | A pendência antes dos eventos de cliente impede reutilizar o Lead candidato | 2: AR e FW, no 013 | 2: igual |
| [B6](#b6) | A repetição do WebJob leva contatos de outra pessoa ao Lead novo de Y | 13: FW | 13: igual |
| [B7](#b7) | A repetição do WebJob cria um segundo Lead para Y | 1: FW, no 040 | 1: igual |
| [B8](#b8) | A PAC em análise de Y é recusada, e a pendência regrava X | 3: C1, AR e FW, no 040 | 60: **estendido** pelo commit 4 aos 19 TCs do B1 em C1, AR e FW |
| [B9](#b9) | O Lead Y reutilizado perde os contatos dele | — | 6: **novo**, AR e FW, nos TCs 047, 055 e 056 |
| [K1](#k1) | Contato antes do cliente, sem prospect e sem Account, volta 400 | 2: PA e ME, no 040 | 2: igual |
| [K2](#k2) | Lead candidato sem CPF não é reutilizado quando a Account Y é nova | 20: os de ordem CA nos TCs 045, 046 e 049, e AR e FW no 046 | 24: entram o AR e o FW nos TCs 045 e 049 |

K1 e K2 são conhecidos desde 27/09. Os B são de 11/10, salvo o B1 e o B2, que
a investigação do bug 4 já tinha reproduzido no TC-001 em 01/10. O B9 só
aparece com os commits.

**O que os commits mudaram, em resumo:**

- **O bug 4 sai do C1, do AR e do FW.** Com o commit 4, a PAC em análise de Y
  não acha mais X pelo prospect: é recusada até Y existir. X não recebe mais o
  e-mail de Y, mas a pendência ainda grava nela o carimbo, pelo Proponente que
  ficou com os dados de X (B8). No C1, o RUN para na recusa.
- **O bug 4 continua no C2 e no C3**, em que a PAC em análise traz o IdCliente
  de X, e a contestação continua gravando em X (B2, no C4).
- **Efeito novo (B9):** com a PAC em análise recusada, a Account Y nasce com os
  contatos de X, e a PAC aprovada leva os aprovados ao Lead Y reutilizado.
- **Os demais ficam iguais:** B3, B4, B5, B6, B7 e K1.

## 2. Os bugs

<a id="b1"></a>

### B1 — A pendência grava em X o e-mail de Y (bug 4)

- **Sintoma:** na aprovação da PAC de Y, a Account X recebe o e-mail de Y e o
  carimbo `DataHoraAtualizacaoEmailPendencia__c`. Em parte dos TCs, o Lead X
  também recebe o e-mail de Y, e o Lead novo de Y fica sem o e-mail aprovado,
  que agora colide com X.
- **Causa:**
  1. a PAC em análise sem IdCliente acha X pelo prospect da jornada e liga o
     Proponente a X;
  2. a pendência `DESLIGAMENTO`, que o crédito publica na aprovação, chega
     antes de a PAC aprovada religar o Proponente;
  3. `ProponenteTriggerHandler.sincronizarEmailContatoPendencia` copia o
     e-mail do Proponente para a Account dele, X.

  É o mecanismo do incidente de staging
  ([handoff do bug 4, seção 1.1](handoff-investigacao-tc001-bug4.md#11-causa-identificada-e-reprodução-2026-10-01)).
- **Onde, sem os commits:**
  - **C1, AR e FW:** os 19 TCs em que Y não tem Account e a jornada tem
    prospect. Quando Y já tem Account, a PAC em análise acha Y pelo CPF, e X
    fica intacta.
  - **C2 e C3:** todos os TCs, menos os três de MATCH (003, 004 e 039). As
    PACs em análise trazem o IdCliente de X e sempre o acham. No C3, a
    pendência vem antes delas, e a PAC de Y altera X com a flag já ligada.
- **Evidência, sem os commits:** `TC001-AR-863078` (carimbo em X) e
  `TC002-AR-7e9f8d` (Account X e Lead X com o e-mail de Y).
- **Com os commits:** o commit 4 faz a `NotificacaoPAC` descartar o match por
  prospect quando o CPF diverge, e a PAC em análise de Y passa a ser recusada
  até Y existir.
  - **AR e FW:** X não recebe mais o e-mail de Y. Resta o carimbo da
    pendência, que agora é o [B8](#b8).
  - **C1:** o RUN para na recusa da PAC em análise, também no B8.
  - **C2 e C3:** o B1 continua nos 41 TCs. Com o IdCliente de X na PAC em
    análise, o caminho não passa por esse descarte, e a
    `sincronizarEmailContatoPendencia` segue sem guard de identidade
    (`TC002-C2-72b121`).
  - O Lead X às vezes recebe também o e-mail de Y, e isso varia entre
    execuções. Numa segunda rodada de cinco TCs do C2 (002, 011, 014, 017 e
    020), com os commits, o Lead X ficou intacto em todos.

<a id="b2"></a>

### B2 — A contestação pendente grava em X o e-mail de Y

- **Sintoma:** X recebe o e-mail de Y, e o marcador
  `DataAlteracaoEventoContatoEmail__c` de X fica com a data da PAC. O carimbo
  de pendência fica vazio.
- **Causa:** com uma contestação pendente, a primeira PAC de Y chama
  `ClienteService.sincronizarContatosContestacao`, que confere só o IdCliente.
  É o caminho 4 do handoff do bug 4.
- **Onde:** C4, em todos os TCs menos os três de MATCH.
- **Evidência:** `TC001-C4-b0193d`.
- **Com os commits:** igual, nos mesmos 41 TCs (`TC001-C4-d9976d`). O método
  não mudou. O plano de correção no repositório Salesforce inclui a checagem
  de CPF na contestação.

<a id="b3"></a>

### B3 — Sem IdCliente, a pendência grava na Account duplicada errada

- **Sintoma:** no TC-038, a Account Y2, sem IdCliente, recebe o e-mail
  aprovado e o carimbo. O TC manda preservar a Y2 e usar a Y1, que tem
  IdCliente.
- **Causa:** sem IdCliente, a PAC em análise acha Y pelo CPF. Com duas
  Accounts do mesmo CPF, o Proponente fica na Y2, e a pendência grava nela.
- **Onde:** C1, AR e FW, no TC-038.
- **Evidência:** `TC038-AR-d1767e` (o Proponente ficou em "outra" Account).
- **Com os commits:** igual (`TC038-AR-c5c241`). A PAC em análise acha a Y2
  pelo CPF, e o descarte do commit 4, que compara o CPF, não a pega.

<a id="b4"></a>

### B4 — A pendência reflete os dados de Y no Lead de Z

- **Sintoma:** no TC-021, o Lead Z recebe o e-mail e o nome de Y, e o Lead
  novo de Y fica sem e-mail.
- **Causa:** na massa do TC-021, a Account Y está ligada ao Lead de Z pelo
  prospect. A pendência atualiza o e-mail da Account Y antes de a unificação
  refazer esse vínculo. O reflexo da Account para o Lead vinculado copia o
  e-mail e o nome para o Lead Z.
- **Onde:** AR, AM e FW, no TC-021. Acontece mesmo com o IdCliente na PAC em
  análise (AM).
- **Evidência:** `TC021-AM-d29ae3`.
- **Com os commits:** igual (`TC021-AM-1d1315`). A Account é a certa; o
  problema é o reflexo para o Lead de outra pessoa, que um guard de identidade
  na pendência não cobre.

<a id="b5"></a>

### B5 — A pendência antes dos eventos de cliente impede reutilizar o Lead candidato

- **Sintoma:** no TC-013, o Lead candidato sem CPF, achado pelo celular, não é
  reutilizado. Nasce um Lead novo só com o e-mail.
- **Causa:** isolada com execuções avulsas no TC-013:

  | Execução | Veredito |
  |---|---|
  | CA e C1 (pendência depois dos parciais) | conformes |
  | AR com o e-mail antes do celular | diverge |
  | AR com a pendência depois das chamadas do WebJob | conforme |

  É a pendência chegando antes do `cliente-update` que muda a escolha do
  Lead. O mecanismo no Apex não foi lido.
- **Onde:** AR e FW, no TC-013.
- **Evidência:** `TC013-AR-a45b5f`.
- **Com os commits:** igual (`TC013-AR-5874ce`).

<a id="b6"></a>

### B6 — A repetição do WebJob leva contatos de outra pessoa ao Lead novo de Y

- **Sintoma:** o Lead novo de Y termina com e-mail ou celular de X ou de Z,
  que o TC manda deixar de fora.
- **Causa:** na repetição, o `cliente-update` do WebJob volta com o prospect da
  jornada, que pertence a outra conta. O `NotificacaoCliente` registra
  "IdProspect pertence a outra conta" e roda de novo o `criarLeadDoCliente`,
  que grava no Lead de Y o e-mail e o celular que a primeira tentativa tinha
  deixado de fora, porque colidem com X ou com Z. Pela leitura do código, quem
  grava é o ramo do `insertLeadQueueable` que reutiliza o Lead do mesmo CPF,
  agora o Lead novo de Y: ele preenche e-mail e celular vazios sem conferir se
  pertencem a outra pessoa. Os parciais da repetição são descartados
  ("prospect divergente de outra conta"). Na primeira tentativa (perfil AR),
  isso não acontece.
- **Onde:** FW, em 13 TCs: 001, 007, 010, 016, 017, 018, 025, 038, 041, 042,
  043, 054 e 057.
- **Evidência:** `TC001-FW-7a35f3` e, com os commits, `TC001-FW-802785`. O
  detalhe do FW mostra o Lead de Y mudando `Email` e `MobilePhone` durante a
  repetição, enquanto a Account Y só muda a `DataAlteracaoEvento__c`. Os logs
  de integração dos dois RUNs mostram o caminho acima.
- **Correções de 11/10, depois da campanha com os commits:**
  - a causa descrita antes, a de parciais da repetição refletidos pela Account
    Y, não se confirma nos logs;
  - o 017 e o 043 entraram na contagem, que era de 11 TCs. No FW deles, o Lead
    novo tem o celular de outra pessoa. A primeira contagem os atribuiu ao bug
    4, porque o AR do mesmo TC falhava na mesma asserção por outro motivo
    (e-mail vazio). O classificador agora compara o tipo de problema.
- **Com os commits:** igual, nos mesmos 13 TCs. O guard de parciais do commit 4
  não resolve, porque os parciais da repetição já eram descartados.

<a id="b7"></a>

### B7 — A repetição do WebJob cria um segundo Lead para Y

- **Sintoma:** no TC-040, ficam dois Leads com o CPF de Y.
- **Causa:** sem Lead de Y antes da repetição, os eventos dela levam a duas
  criações. É o padrão dos Leads duplicados órfãos do
  [diagnóstico dos commits 3 e 4](tc-001-diagnostico-corridas-commits-3-4.md).
- **Onde:** FW, no TC-040.
- **Evidência:** `TC040-FW-f33814`.
- **Com os commits:** igual (`TC040-FW-2cc571`).

<a id="b8"></a>

### B8 — A PAC em análise de Y é recusada, e a pendência regrava X

- **Sintoma:** as PACs em análise de Y voltam 400 ("Cliente(Account) não
  encontrado"). O Proponente segue com os dados de X, da primeira PAC, e a
  pendência regrava em X o e-mail dessa PAC, com carimbo. Em geral é o e-mail
  que X já tem, e só o carimbo muda. Nos TCs 055 e 056, em que a massa dá a X
  o e-mail aprovado, o e-mail de X volta ao da primeira PAC, na Account e no
  Lead X.
- **Causa:** `NotificacaoPAC.criarInstanciaProponente` recusa a PAC quando não
  acha a pessoa por IdCliente, CPF ou prospect. A pendência, que chega antes
  da PAC aprovada, acha o Proponente pelo Id externo e copia o e-mail dele
  para a Account a que ele está ligado, X. Na produção, o Event Grid
  reentregaria a PAC recusada; a reentrega depois da aprovação passa sem mudar
  o status.
- **Onde:**
  - **sem os commits:** só no TC-040, que não tem prospect;
  - **com os commits:** também nos 19 TCs do B1 em que Y não tem Account
    (001, 002, 016, 017, 018, 023, 041 a 049 e 054 a 057). O commit 4 descarta
    o match por prospect quando o CPF diverge, e a PAC em análise de Y passa a
    ser recusada também neles;
  - em AR e FW, o RUN segue, e "Account X intacta" diverge. No C1, que não
    trata a recusa como esperada, o RUN para nela.
- **Evidência:** `TC040-AR-f97cac`, sem os commits; `TC002-AR-3354f2`,
  `TC055-AR-9ae356` e `TC001-C1-fc00ff`, com os commits.
- **Com os commits:** a recusa se estende aos 19 TCs, e o efeito da pendência
  sobre o Proponente velho continua.

<a id="b9"></a>

### B9 — O Lead Y reutilizado perde os contatos dele

- **Sintoma:** nos TCs 047, 055 e 056, o Lead Y achado pelo CPF termina com o
  e-mail aprovado (no 047, também com o celular). O TC manda preservar os
  contatos do Lead reutilizado.
- **Causa:** isolada em 11/10 com execuções avulsas do TC-047 e do TC-055 no
  AR, com retratos entre as etapas e os logs de integração:
  1. ao criar a Account Y, o `NotificacaoCliente` lê os contatos aprovados do
     Proponente principal da Account ou, sem ele, do Proponente achado pelo
     prospect do evento, que é o da jornada. Com a PAC em análise recusada
     ([B8](#b8)), esse Proponente ainda tem o e-mail e o celular de X, e a
     Account Y nasce com eles (`preencherContatosAprovados`);
  2. os parciais do WebJob, com os contatos aprovados e o prospect da jornada,
     são descartados ("prospect divergente de outra conta"). A Account Y fica
     com os contatos de X até a PAC aprovada;
  3. na PAC aprovada, o Proponente, com a flag da pendência ligada, é
     religado à Account Y. A `sincronizarEmailContatoPendencia` grava nela o
     e-mail aprovado, fora dos escopos de reflexo, e o reflexo da Account para
     o Lead leva esse e-mail ao Lead Y;
  4. a sincronização pós-aprovação
     (`ClienteService.sincronizarContatosAprovadosPac`) troca o celular da
     Account Y e pede a reconciliação `POS_PAC_APROVADA`. Como agora só o
     celular diverge, a regra do `d6f147d303` deixa sobrescrevê-lo no Lead Y,
     a menos que ele colida com outro Lead. No 055 e no 056, o celular
     aprovado é do Lead Z, a sobrescrita é barrada, e só o e-mail muda.

  Sem os commits, a PAC em análise aceita já tinha posto os dados de Y no
  Proponente, e a Account Y nascia com os contatos aprovados. A regra de
  descarte e a leitura pelo Proponente já existiam em 03/09. No CA, sem
  pendência, o e-mail não chega antes ao Lead Y: os dois contatos divergem, e
  a mesma regra do `d6f147d303` preserva o Lead.
- **Onde:** AR e FW, nos TCs 047, 055 e 056, só com os commits.
  - Pelo passo 1, a Account Y deve nascer com os contatos de X nos 19 TCs em
    que a PAC em análise é recusada. O harness confere só o estado final, que
    a PAC aprovada corrige, e só esses três TCs mandam preservar os contatos
    do Lead Y.
  - No 055 e no 056, o e-mail aprovado só fica livre porque o B8 tira de X o
    e-mail que a massa deu a ela.
  - O mesmo efeito aparece no TC-044, no AR e no FW: o Lead Y termina com o
    e-mail e o celular aprovados. Não entra na contagem porque o TC-044 não
    confere os contatos do Lead Y; o runbook não os define.
- **Evidência:**
  - na campanha: `TC047-AR-6f8c7a`, `TC047-FW-06cd51` e `TC055-AR-9ae356`;
  - com retratos: `TC047-AR-c90540` e `TC055-AR-6dbf3c`. A Account Y fica com
    o e-mail e o celular de X, e o Lead Y intacto, até a PAC aprovada;
  - no log da reconciliação do `TC055-AR-6dbf3c`, "sobrescrita barrada por
    colisao" só com o celular colidindo: o e-mail já tinha chegado ao Lead Y;
  - sem as reentregas: `TC047-AR-512768`, sem a das PACs em análise, e
    `TC047-AR-473a24`, sem a da pendência, divergem do mesmo jeito.

<a id="k1"></a>

### K1 — Contato antes do cliente, sem prospect e sem Account, volta 400

Conhecido desde 27/09. Um `contato-insert` de um IdCliente que ainda não
existe, sem prospect, chegando antes do `cliente-insert`, volta 400
(`REQUIRED_FIELD_MISSING`, `LastName`). O runbook espera descarte com 200.
Aparece no TC-040, nos perfis PA e ME
([relatório de 27/09](resultado-runbook-recorte-2.2-2026-09-27.md), seção 1).
Com os commits, igual.

<a id="k2"></a>

### K2 — Lead candidato sem CPF não é reutilizado quando a Account Y é nova

Conhecido desde 27/09. Nos TCs 045, 046 e 049, o Apex cria um Lead Y novo em
vez de reutilizar o candidato livre, sem CPF, que tem os contatos aprovados.
Aparece em todos os perfis com a ordem CA e, no TC-046, também em AR e FW
([relatório de 27/09](resultado-runbook-recorte-2.2-2026-09-27.md), seção 2).

Com os commits, aparece também no AR e no FW nos TCs 045 e 049
(`TC045-AR-335e1d`). Vem do passo 1 do [B9](#b9): a busca do candidato usa os
contatos aprovados que o fluxo lê do Proponente, e, com a PAC em análise
recusada, eles são os de X. Sem os commits, a PAC em análise aceita punha no
Proponente os contatos de Y, e o AR e o FW achavam o candidato nesses dois
TCs.

Pela leitura do código, o mesmo passo explicaria o K2 nos perfis de ordem CA
desde 27/09. Sem PAC em análise de Y, o Proponente achado pelo prospect da
jornada é o da PAC de X, e o candidato é procurado pelos contatos de X. Isso
explica também por que o 012 e o 013 passam: o contato que eles compartilham é
de X. A hipótese não foi reproduzida à parte
([inventário dos commits da 2.2](inventario-commits-2.2.md), seção 6).

## 3. Matrizes

Geradas por `npm run runbook:bugs`. "ok" é RUN conforme, e "—" é perfil que
não se aplica ao TC (o AM só roda quando a pessoa aprovada já existe no MS
Clientes). Só entram os TCs com alguma divergência.

### 3.1 Sem os commits

Classificada de novo em 11/10, depois da campanha com os commits: o B6 passou
a valer também no FW dos TCs 017 e 043 ([B6](#b6)).

| TC | PA | CA | ME | C1 | C2 | C3 | C4 | AR | AM | FW | RC | EP | RL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-002 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-005 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-006 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-007 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | B6 | ok | ok | ok |
| TC-009 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-010 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | B6 | ok | ok | ok |
| TC-011 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-012 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-013 | ok | ok | ok | ok | B1 | B1 | B2 | B5 | ok | B5 | ok | ok | ok |
| TC-014 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-015 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-016 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-017 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-018 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-019 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-020 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-021 | ok | ok | ok | ok | B1 | B1 | B2 | B4 | B4 | B4 | ok | ok | ok |
| TC-022 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-023 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-024 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-025 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | B6 | ok | ok | ok |
| TC-026 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-027 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-038 | ok | ok | ok | B3 | B1 | B1 | B2 | B3 | ok | B3 B6 | ok | ok | ok |
| TC-040 | K1 | ok | K1 | B8 | B1 | B1 | B2 | B8 | — | B7 B8 | ok | ok | ok |
| TC-041 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-042 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-043 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-044 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-045 | K2 | K2 | K2 | B1 | B1 | B1 | B2 | B1 | — | B1 | K2 | K2 | K2 |
| TC-046 | K2 | K2 | K2 | B1 | B1 | B1 | B2 | B1 K2 | — | B1 K2 | K2 | K2 | K2 |
| TC-047 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-048 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-049 | K2 | K2 | K2 | B1 | B1 | B1 | B2 | B1 | — | B1 | K2 | K2 | K2 |
| TC-053 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-054 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-055 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-056 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
| TC-057 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 B6 | ok | ok | ok |
| TC-062 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |

| Bug | Pares | Onde |
|---|---:|---|
| B1 | 139 | C1: 001, 002, 016, 017, 018, 023, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057; C2: 001, 002, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 038, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 053, 054, 055, 056, 057, 062; C3: 001, 002, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 038, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 053, 054, 055, 056, 057, 062; AR: 001, 002, 016, 017, 018, 023, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057; FW: 001, 002, 016, 017, 018, 023, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057 |
| B2 | 41 | C4: 001, 002, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 038, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 053, 054, 055, 056, 057, 062 |
| B3 | 3 | C1: 038; AR: 038; FW: 038 |
| B4 | 3 | AR: 021; AM: 021; FW: 021 |
| B5 | 2 | AR: 013; FW: 013 |
| B6 | 13 | FW: 001, 007, 010, 016, 017, 018, 025, 038, 041, 042, 043, 054, 057 |
| B7 | 1 | FW: 040 |
| B8 | 3 | C1: 040; AR: 040; FW: 040 |
| K1 | 2 | PA: 040; ME: 040 |
| K2 | 20 | PA: 045, 046, 049; CA: 045, 046, 049; ME: 045, 046, 049; AR: 046; FW: 046; RC: 045, 046, 049; EP: 045, 046, 049; RL: 045, 046, 049 |

### 3.2 Com os commits

| TC | PA | CA | ME | C1 | C2 | C3 | C4 | AR | AM | FW | RC | EP | RL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-002 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B8 | ok | ok | ok |
| TC-005 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-006 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-007 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | B6 | ok | ok | ok |
| TC-009 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-010 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | B6 | ok | ok | ok |
| TC-011 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-012 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-013 | ok | ok | ok | ok | B1 | B1 | B2 | B5 | ok | B5 | ok | ok | ok |
| TC-014 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-015 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-016 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-017 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-018 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-019 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-020 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-021 | ok | ok | ok | ok | B1 | B1 | B2 | B4 | B4 | B4 | ok | ok | ok |
| TC-022 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-023 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B8 | ok | ok | ok |
| TC-024 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-025 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | B6 | ok | ok | ok |
| TC-026 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-027 | ok | ok | ok | ok | B1 | B1 | B2 | ok | — | ok | ok | ok | ok |
| TC-038 | ok | ok | ok | B3 | B1 | B1 | B2 | B3 | ok | B3 B6 | ok | ok | ok |
| TC-040 | K1 | ok | K1 | B8 | B1 | B1 | B2 | B8 | — | B7 B8 | ok | ok | ok |
| TC-041 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-042 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-043 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-044 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B8 | ok | ok | ok |
| TC-045 | K2 | K2 | K2 | B8 | B1 | B1 | B2 | B8 K2 | — | B8 K2 | K2 | K2 | K2 |
| TC-046 | K2 | K2 | K2 | B8 | B1 | B1 | B2 | B8 K2 | — | B8 K2 | K2 | K2 | K2 |
| TC-047 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 B9 | — | B8 B9 | ok | ok | ok |
| TC-048 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B8 | ok | ok | ok |
| TC-049 | K2 | K2 | K2 | B8 | B1 | B1 | B2 | B8 K2 | — | B8 K2 | K2 | K2 | K2 |
| TC-053 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |
| TC-054 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-055 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 B9 | — | B8 B9 | ok | ok | ok |
| TC-056 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 B9 | — | B8 B9 | ok | ok | ok |
| TC-057 | ok | ok | ok | B8 | B1 | B1 | B2 | B8 | — | B6 B8 | ok | ok | ok |
| TC-062 | ok | ok | ok | ok | B1 | B1 | B2 | ok | ok | ok | ok | ok | ok |

| Bug | Pares | Onde |
|---|---:|---|
| B1 | 82 | C2: 001, 002, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 038, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 053, 054, 055, 056, 057, 062; C3: 001, 002, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 038, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 053, 054, 055, 056, 057, 062 |
| B2 | 41 | C4: 001, 002, 005, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 038, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 053, 054, 055, 056, 057, 062 |
| B3 | 3 | C1: 038; AR: 038; FW: 038 |
| B4 | 3 | AR: 021; AM: 021; FW: 021 |
| B5 | 2 | AR: 013; FW: 013 |
| B6 | 13 | FW: 001, 007, 010, 016, 017, 018, 025, 038, 041, 042, 043, 054, 057 |
| B7 | 1 | FW: 040 |
| B8 | 60 | C1: 001, 002, 016, 017, 018, 023, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057; AR: 001, 002, 016, 017, 018, 023, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057; FW: 001, 002, 016, 017, 018, 023, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057 |
| B9 | 6 | AR: 047, 055, 056; FW: 047, 055, 056 |
| K1 | 2 | PA: 040; ME: 040 |
| K2 | 24 | PA: 045, 046, 049; CA: 045, 046, 049; ME: 045, 046, 049; AR: 045, 046, 049; FW: 045, 046, 049; RC: 045, 046, 049; EP: 045, 046, 049; RL: 045, 046, 049 |

### 3.3 O que mudou

Saída do `--comparar`, com a campanha sem os commits como anterior. Os
conformes por perfil são os mesmos nas duas campanhas. A segunda tabela só traz
os pares em que a célula mudou.

| Bug | Pares sem os commits | Pares com os commits |
|---|---:|---:|
| B1 | 139 | 82 |
| B2 | 41 | 41 |
| B3 | 3 | 3 |
| B4 | 3 | 3 |
| B5 | 2 | 2 |
| B6 | 13 | 13 |
| B7 | 1 | 1 |
| B8 | 3 | 60 |
| B9 | 0 | 6 |
| K1 | 2 | 2 |
| K2 | 20 | 24 |

| Sem os commits | Com os commits | Pares | Onde |
|---|---|---:|---|
| B1 | B8 | 36 | C1: 001, 002, 016, 017, 018, 023, 041, 042, 043, 044, 045, 046, 047, 048, 049, 054, 055, 056, 057; AR: 001, 002, 016, 017, 018, 023, 041, 042, 043, 044, 048, 054, 057; FW: 002, 023, 044, 048 |
| B1 | B8 B9 | 6 | AR: 047, 055, 056; FW: 047, 055, 056 |
| B1 | B8 K2 | 4 | AR: 045, 049; FW: 045, 049 |
| B1 B6 | B6 B8 | 9 | FW: 001, 016, 017, 018, 041, 042, 043, 054, 057 |
| B1 K2 | B8 K2 | 2 | AR: 046; FW: 046 |
