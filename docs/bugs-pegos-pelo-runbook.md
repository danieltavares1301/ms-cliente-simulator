# Bugs pegos pelo runbook na `mrv-devDan`

Catálogo dos bugs que o harness do runbook pega, com cada TC e cada perfil em
que ele aparece. Versão de **2026-10-11**, da campanha completa: os 44 TCs
executáveis nos 13 perfis.

- **Estado da dev:** o de 27/09, com quatro classes centrais da 2.2 na versão
  de 03/09, sem os commits 3 e 4 ([estado da dev](estado-da-mrv-devDan.md)).
  Os bugs abaixo valem para esse código. Em cada um, a seção "Na ponta da 2.2"
  diz o que se sabe sobre a versão mais nova.
- **A dev mudou depois:** em 11/10, às 20:43 UTC, as quatro classes voltaram
  à ponta da 2.2. Até a próxima campanha, este catálogo descreve o estado
  revertido.
- **Relatórios:** [ordens reais, 11/10](resultado-runbook-ordens-reais-2026-10-11.md),
  [campanha completa, 11/10](resultado-runbook-completo-2026-10-11.md) e, para
  os bugs já conhecidos, [27/09](resultado-runbook-recorte-2.2-2026-09-27.md).

> **Como manter.** A cada campanha nova, rode
> `npm run runbook:bugs -- --entrada resultados.jsonl`. Ele liga cada asserção
> que falhou a um bug deste catálogo, pelas regras de
> `scripts/runbook/classificar-bugs.ts`, e imprime a matriz da seção 3. Uma
> falha que sai como `?` não tem regra: analise-a e, se for bug novo, acrescente
> aqui e no script.

## 1. Resumo

| Bug | O que acontece | Perfis | TCs |
|---|---|---|---|
| [B1](#b1) | A pendência grava em X o e-mail de Y (bug 4) | C1, C2, C3, AR, FW | C2 e C3: todos menos os de MATCH; C1, AR e FW: os 19 em que Y não tem Account |
| [B2](#b2) | A contestação pendente grava em X o e-mail de Y | C4 | todos menos os de MATCH |
| [B3](#b3) | Sem IdCliente, a pendência grava na Account duplicada errada | C1, AR, FW | 038 |
| [B4](#b4) | A pendência reflete os dados de Y no Lead de Z | AR, AM, FW | 021 |
| [B5](#b5) | A pendência antes dos eventos de cliente impede reutilizar o Lead candidato | AR, FW | 013 |
| [B6](#b6) | A repetição do WebJob leva contatos de outra pessoa ao Lead novo de Y | FW | 11 TCs |
| [B7](#b7) | A repetição do WebJob cria um segundo Lead para Y | FW | 040 |
| [B8](#b8) | Sem prospect, a PAC em análise é recusada, e a pendência regrava X | C1, AR, FW | 040 |
| [K1](#k1) | Contato antes do cliente, sem prospect e sem Account, volta 400 | PA, ME | 040 |
| [K2](#k2) | Lead candidato sem CPF não é reutilizado quando a Account Y é nova | todos os de ordem CA | 045, 046, 049 |

K1 e K2 são conhecidos desde 27/09. Os B são de 11/10, salvo o B1 e o B2, que
a investigação do bug 4 já tinha reproduzido no TC-001 em 01/10.

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
- **Onde:**
  - **C1, AR e FW:** os 19 TCs em que Y não tem Account e a jornada tem
    prospect. Quando Y já tem Account, a PAC em análise acha Y pelo CPF, e X
    fica intacta.
  - **C2 e C3:** todos os TCs, menos os três de MATCH (003, 004 e 039). As
    PACs em análise trazem o IdCliente de X e sempre o acham. No C3, a
    pendência vem antes delas, e a PAC de Y altera X com a flag já ligada.
- **Evidência:** `TC001-AR-863078` (carimbo em X) e `TC002-AR-7e9f8d` (Account
  X e Lead X com o e-mail de Y).
- **Na ponta da 2.2:** o commit 4 faz a `NotificacaoPAC` descartar o match por
  prospect quando o CPF diverge. A PAC em análise passa a ser recusada até Y
  existir, o que cortaria o caminho de C1 e AR; isso não foi testado ao vivo.
  A `sincronizarEmailContatoPendencia` segue sem guard de identidade, e o
  caminho do C2, com o IdCliente de X na PAC em análise, não passa por esse
  descarte (handoff, seção 1.1).

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
- **Na ponta da 2.2:** o método é igual na dev e na ponta. O plano de correção
  no repositório Salesforce inclui a checagem de CPF na contestação.

<a id="b3"></a>

### B3 — Sem IdCliente, a pendência grava na Account duplicada errada

- **Sintoma:** no TC-038, a Account Y2, sem IdCliente, recebe o e-mail
  aprovado e o carimbo. O TC manda preservar a Y2 e usar a Y1, que tem
  IdCliente.
- **Causa:** sem IdCliente, a PAC em análise acha Y pelo CPF. Com duas
  Accounts do mesmo CPF, o Proponente fica na Y2, e a pendência grava nela.
- **Onde:** C1, AR e FW, no TC-038.
- **Evidência:** `TC038-AR-d1767e` (o Proponente ficou em "outra" Account).
- **Na ponta da 2.2:** não testado. Um guard que só compare o CPF não pega,
  porque a Y2 tem o CPF de Y.

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
- **Na ponta da 2.2:** não testado. A Account é a certa; o problema é o
  reflexo para o Lead de outra pessoa, que um guard de identidade na pendência
  não cobre.

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
- **Na ponta da 2.2:** não testado.

<a id="b6"></a>

### B6 — A repetição do WebJob leva contatos de outra pessoa ao Lead novo de Y

- **Sintoma:** o Lead novo de Y termina com e-mail ou celular de X ou de Z,
  que o TC manda deixar de fora.
- **Causa:** na repetição, o `criarAtualizarCliente` devolve o prospect da
  jornada ao cliente no MS Clientes, e os parciais saem com ele. Eles chegam
  depois de o Lead de Y existir, e a Account Y os reflete no Lead. Na
  primeira tentativa (perfil AR), isso não acontece.
- **Onde:** FW.
- **Evidência:** `TC001-FW-7a35f3`. O detalhe do FW mostra o Lead de Y
  mudando `Email` e `MobilePhone` durante a repetição.
- **Na ponta da 2.2:** a dev não tem o guard de parciais do commit 4
  (`validarIdentidadePayloadParcialContraAccount`), que mira parcial com
  prospect de outra pessoa. Só rodando o FW com a ponta para saber se ele
  resolve.

<a id="b7"></a>

### B7 — A repetição do WebJob cria um segundo Lead para Y

- **Sintoma:** no TC-040, ficam dois Leads com o CPF de Y.
- **Causa:** sem Lead de Y antes da repetição, os eventos dela levam a duas
  criações. É o padrão dos Leads duplicados órfãos do
  [diagnóstico dos commits 3 e 4](tc-001-diagnostico-corridas-commits-3-4.md).
- **Onde:** FW, no TC-040.
- **Evidência:** `TC040-FW-f33814`.
- **Na ponta da 2.2:** não testado.

<a id="b8"></a>

### B8 — Sem prospect, a PAC em análise é recusada, e a pendência regrava X

- **Sintoma:** no TC-040, as PACs em análise de Y voltam 400 ("Cliente(Account)
  não encontrado"). O Proponente segue com os dados de X, da primeira PAC, e
  a pendência regrava o próprio e-mail de X, com carimbo.
- **Causa:** `NotificacaoPAC.criarInstanciaProponente` recusa a PAC quando não
  acha a pessoa por IdCliente, CPF ou prospect. Na produção, o Event Grid
  reentregaria; a reentrega depois da aprovação passa sem mudar o status.
- **Onde:** AR e FW, no TC-040. No C1, que não trata a recusa como esperada,
  o RUN para nela.
- **Evidência:** `TC040-AR-f97cac`.
- **Na ponta da 2.2:** a recusa continua, e o commit 4 a estende a outras PACs
  em análise. O efeito da pendência sobre o Proponente velho também continua.

<a id="k1"></a>

### K1 — Contato antes do cliente, sem prospect e sem Account, volta 400

Conhecido desde 27/09. Um `contato-insert` de um IdCliente que ainda não
existe, sem prospect, chegando antes do `cliente-insert`, volta 400
(`REQUIRED_FIELD_MISSING`, `LastName`). O runbook espera descarte com 200.
Aparece no TC-040, nos perfis PA e ME
([relatório de 27/09](resultado-runbook-recorte-2.2-2026-09-27.md), seção 1).

<a id="k2"></a>

### K2 — Lead candidato sem CPF não é reutilizado quando a Account Y é nova

Conhecido desde 27/09. Nos TCs 045, 046 e 049, o Apex cria um Lead Y novo em
vez de reutilizar o candidato livre, sem CPF, que tem os contatos aprovados.
Aparece em todos os perfis com a ordem CA e, no TC-046, também em AR e FW
([relatório de 27/09](resultado-runbook-recorte-2.2-2026-09-27.md), seção 2).

## 3. Matriz da campanha completa de 11/10

Gerada por `npm run runbook:bugs`. "ok" é RUN conforme, e "—" é perfil que
não se aplica ao TC (o AM só roda quando a pessoa aprovada já existe no MS
Clientes). Só entram os TCs com alguma divergência.

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
| TC-017 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
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
| TC-043 | ok | ok | ok | B1 | B1 | B1 | B2 | B1 | — | B1 | ok | ok | ok |
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
| B6 | 11 | FW: 001, 007, 010, 016, 018, 025, 038, 041, 042, 054, 057 |
| B7 | 1 | FW: 040 |
| B8 | 3 | C1: 040; AR: 040; FW: 040 |
| K1 | 2 | PA: 040; ME: 040 |
| K2 | 20 | PA: 045, 046, 049; CA: 045, 046, 049; ME: 045, 046, 049; AR: 046; FW: 046; RC: 045, 046, 049; EP: 045, 046, 049; RL: 045, 046, 049 |
