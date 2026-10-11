# Resultado do runbook — campanha completa com os commits (ponta da 2.2), 11/10

> **Campanha com os commits.** Rodou na dev com `ClienteService`,
> `NotificacaoCliente`, `NotificacaoMaquinaEstado` e `NotificacaoPAC` de volta
> à ponta da 2.2 (`3f2919f5e7`), pelo deploy `0AfHZ00000QmDjx0AF`, de 11/10 às
> 20:43 UTC. Entraram nelas os cinco commits abaixo, que faltavam na
> [campanha sem os commits](resultado-runbook-completo-sem-commits-2026-10-11.md).
> O resto da dev é o mesmo nas duas campanhas.

| Commit | Data | Título | Classes que ele muda |
|---|---|---|---|
| `1f6844e910` (commit 4) | 08/09 | Guard de identidade em NotificacaoCliente para eventos parciais pós-PAC | `ClienteService`, `NotificacaoCliente`, `NotificacaoPAC` |
| `72cbd884f6` (commit 3) | 09/09 | Novo Lead não é criado em cenário de aprovação de PAC com CPF divergente (UNABLE TO LOCK ROW) | `NotificacaoCliente` |
| `9210581ea5` | 09/09 | PAC enviado para fila manual indevidamente com erro "Cliente(Account) não encontrado no Salesforce" | `ClienteService`, `NotificacaoMaquinaEstado` |
| `7c86318a05` | 10/09 | Preserva vínculo histórico da Opp em jornadausuario-* sem idCliente | `NotificacaoMaquinaEstado` |
| `3f2919f5e7` | 21/09 | Corrige falso positivo no guard de identidade de payload parcial (contato-update/endereco-update) | `ClienteService`, `NotificacaoCliente` |

Os títulos são os dos commits, sem o prefixo `[918914] - [UNIFICAÇÃO DE LEADS]`.
Os commits também mudam as classes de teste, que não alteram o comportamento
medido. O que cada um muda no código está na seção 4.1 do
[estado da dev](estado-da-mrv-devDan.md).

Execução de 2026-10-11T20:49:28.734Z a 2026-10-11T21:44:18.419Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**545 RUNs:** 331 conformes, 214 divergentes, 0 com erro de execução.

> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os
> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em
> que o caminho alcança X, "Account X intacta" diverge. Com os commits, o C1
> para na recusa da PAC em análise (seção "Análise"). Veja
> `docs/handoff-investigacao-tc001-bug4.md`.

> **Perfis AR, AM, FW, RC, EP e RL (ordens reais da aprovação):** a ordem que o
> MS de crédito, o WebJob e o MS Clientes produzem. "—" no AM é TC em que ele
> não se aplica (a pessoa aprovada ainda não existe no MS Clientes). Veja a
> seção 7.2 de `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Análise

Os 44 TCs executáveis nos 13 perfis, com o mesmo comando da campanha sem os
commits (`npm run runbook -- --todos --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL --paralelo 6`).
O AM rodou só nos 17 TCs em que se aplica.

- **Execução:** das 20:49 às 21:44 UTC. Nenhum RUN terminou em erro ou caiu
  por rede, e o resíduo ficou zerado.
- **Vereditos:** os mesmos da campanha sem os commits, par a par. Os 214 pares
  divergentes são os mesmos; o que muda é o bug por trás de parte deles.

| Perfil | RUNs | Conformes | Divergentes |
|---|---:|---:|---:|
| PA | 44 | 40 | 4 |
| CA | 44 | 41 | 3 |
| ME | 44 | 40 | 4 |
| C1 | 44 | 23 | 21 |
| C2 | 44 | 3 | 41 |
| C3 | 44 | 3 | 41 |
| C4 | 44 | 3 | 41 |
| AR | 44 | 21 | 23 |
| AM | 17 | 16 | 1 |
| FW | 44 | 18 | 26 |
| RC | 44 | 41 | 3 |
| EP | 44 | 41 | 3 |
| RL | 44 | 41 | 3 |

### O que os commits mudaram

Cada divergência está ligada a um bug no [catálogo](bugs-pegos-pelo-runbook.md),
que traz as matrizes das duas campanhas. A comparação sai de
`npm run runbook:bugs -- --entrada <com os commits>.jsonl --comparar <sem os commits>.jsonl`:

| Bug | Sem os commits | Com os commits | O que mudou |
|---|---:|---:|---|
| B1 — a pendência grava em X o e-mail de Y | 139 | 82 | Saiu do C1, do AR e do FW; ficou no C2 e no C3 |
| B8 — a PAC em análise é recusada, e a pendência regrava X | 3 | 60 | Recebeu os 57 pares que saíram do B1 |
| B9 — o Lead Y reutilizado perde os contatos dele | 0 | 6 | Novo: AR e FW, nos TCs 047, 055 e 056 |
| K2 — Lead candidato sem CPF não reutilizado | 20 | 24 | Entraram o AR e o FW nos TCs 045 e 049 |
| B2, B3, B4, B5, B6, B7 e K1 | 41, 3, 3, 2, 13, 1 e 2 | iguais | — |

1. **No C1, no AR e no FW, a PAC em análise de Y passa a ser recusada, mas a
   pendência ainda grava em X.** São os 19 TCs em que Y não tem Account e a
   jornada tem prospect. Sem IdCliente, a PAC em análise de Y não acha mais X pelo
   prospect: volta 400 ("Cliente(Account) não encontrado") até Y existir.
   - **AR e FW:** X não recebe mais o e-mail de Y. Nos 9 TCs em que recebia
     (002, 017 e 043 a 049), o Lead X também ficou intacto, e no AR o Lead
     novo de Y passou a ter o e-mail aprovado (002, 017 e 043). Mas a pendência
     chega antes da PAC aprovada e acha o Proponente ainda com os dados de X,
     da primeira PAC: grava o carimbo de pendência em X nos 19 TCs (B8). Nos
     TCs 055 e 056, em que a massa dá a X o e-mail aprovado, ela troca esse
     e-mail pelo da primeira PAC de X, na Account X e no Lead X.
   - **C1:** o RUN para na recusa, porque os perfis C não a tratam como
     esperada. O que vem depois só se vê no AR.
2. **C2 e C3: o bug 4 continua.** A PAC em análise com o IdCliente de X não
   passa pelo descarte do commit 4, e a pendência grava o e-mail de Y em X nos
   41 TCs, como antes. O Lead X às vezes recebe também o e-mail, e isso varia
   entre execuções: numa segunda rodada de cinco TCs do C2 (002, 011, 014, 017
   e 020), com os commits, o Lead X ficou intacto em todos.
3. **C4: a contestação continua gravando em X (B2).** O
   `sincronizarContatosContestacao` não mudou.
4. **Novo (B9): o Lead Y reutilizado perde os contatos dele.** Nos TCs 047,
   055 e 056, no AR e no FW, o Lead Y achado pelo CPF termina com o e-mail
   aprovado (no 047, também com o celular), e o TC manda preservar os contatos
   dele. A causa foi isolada com execuções avulsas do TC-047 e do TC-055 no AR,
   com retratos entre as etapas e os logs de integração:
   1. ao criar a Account Y, o `NotificacaoCliente` lê os contatos aprovados do
      Proponente achado pelo prospect do evento, que é o da jornada. Com a PAC
      em análise recusada, esse Proponente ainda tem o e-mail e o celular de
      X, e a Account Y nasce com eles;
   2. os parciais do WebJob, com os contatos aprovados e o prospect da
      jornada, são descartados ("prospect divergente de outra conta", regra que
      já existia em 03/09). A Account Y fica com os contatos de X até a PAC
      aprovada;
   3. na PAC aprovada, a pendência grava o e-mail aprovado na Account Y, e o
      reflexo o leva ao Lead Y. Depois, a reconciliação `POS_PAC_APROVADA`
      troca o celular do Lead Y, a menos que ele colida com outro Lead. No
      055, o log da reconciliação mostra a sobrescrita do celular barrada por
      colisão com o Lead Z.

   Sem os commits, a PAC em análise aceita já tinha posto os dados de Y no
   Proponente, e a Account Y nascia com os contatos aprovados. Tirar as
   reentregas das PACs em análise, ou a da pendência, não muda o resultado. O
   mesmo efeito aparece no TC-044, no AR e no FW, mas não é contado: o TC não
   confere os contatos do Lead Y.
5. **K2 no AR e no FW (045 e 049).** Vem do passo 1 do B9: a busca do Lead
   candidato usa os contatos aprovados que o fluxo leu do Proponente, e com os
   commits eles são os de X. Sem os commits, o AR e o FW reutilizavam o
   candidato nesses dois TCs.
6. **Sem mudança:** B3 (TC-038), B4 (TC-021), B5 (TC-013), B6 (FW, 13 TCs),
   B7 (TC-040) e K1. O B6 não depende dos parciais que o guard do commit 4
   bloqueia: os logs mostram que, na repetição do WebJob, quem mexe no Lead de
   Y é o `cliente-update` (entrada do B6 no catálogo).

## Resumo por TC

| TC | Cenário | PA (ORDEM-PARCIAIS-ANTES) | CA (ORDEM-CLIENTE-ANTES) | ME (ORDEM-MESMO-EVENTTIME) | C1 (CAMINHO-1-PAC-SEM-IDCLIENTE-E-PENDENCIA) | C2 (CAMINHO-2-PAC-COM-IDCLIENTE-DA-JORNADA-E-PENDENCIA) | C3 (CAMINHO-3-PENDENCIA-ANTES-DA-PAC) | C4 (CAMINHO-4-CONTESTACAO-PENDENTE) | AR (APROVACAO-REAL-PESSOA-NOVA) | AM (APROVACAO-REAL-PESSOA-EXISTENTE) | FW (FALHA-E-REPETICAO-DO-WEBJOB) | RC (RELOGIO-DO-CREDITO) | EP (ECO-ANTES-DO-PARCIAL) | RL (REPOSTAGEM-EM-LOTE) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-002 | CPF, e-mail e celular divergentes | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-005 | Account Y existente, Lead Y ausente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-006 | Account Y e Lead Y órfão existentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-007 | Contatos de Y pertencem ao Lead Z | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-009 | Account Y incompleta e Lead Y existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-010 | Colisão apenas de e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-011 | Colisão apenas de celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-012 | Fallback por e-mail em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-013 | Fallback por celular em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-016 | Y inexistente e colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-017 | Y inexistente; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-018 | Y inexistente; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-020 | Account Y só com CPF; nenhum Lead | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-021 | Account Y com prospect divergente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-022 | Account Y incompleta e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-023 | Account Y inexistente e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-026 | Dois Leads Y; reutilizar o livre | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ❌ diverge | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-041 | Venda Genérica com colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-042 | Venda Genérica; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-053 | Proponente com Account/IdCliente existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-054 | Proponente X aprovado como Y na Venda Genérica | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-055 | Priorizar Lead Y por CPF na Venda Genérica | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-056 | Repetição funcional do TC-055 | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-057 | Proponente Y colide totalmente com X | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |

## Divergências e erros

### TC-001 — CPF divergente com os mesmos contatos

**C1** (`TC001-C1-fc00ff`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC001-C2-5553cb`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:48:43.000+0000"}]`

**C3** (`TC001-C3-a5cf04`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:48:28.000+0000","depois":"2026-10-11T20:48:43.000+0000"}]`

**C4** (`TC001-C4-d9976d`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T20:48:12.000+0000","depois":"2026-10-11T20:49:22.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T20:48:12.000+0000","depoi…`

**AR** (`TC001-AR-6c600d`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:49:21.000+0000"}]`

**FW** (`TC001-FW-802785`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc001.a.tc001-fw-802785@example.com","celular 31987593405"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:49:21.000+0000"}]`

### TC-002 — CPF, e-mail e celular divergentes

**C1** (`TC002-C1-6692c0`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC002-C2-72b121`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c2-72b121@example.com","depois":"qa.unif22.tc002.c.tc002-c2-72b121@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC002-C3-8e38d4`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c3-8e38d4@example.com","depois":"qa.unif22.tc002.c.tc002-c3-8e38d4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:50:04.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c3-8e38d4@example.com","depois":"qa.unif22.tc002.c.tc002-c3-8e38d4@example.com"}]`

**C4** (`TC002-C4-2a752d`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c4-2a752d@example.com","depois":"qa.unif22.tc002.c.tc002-c4-2a752d@example.com"},{"campo":"Celular__c","antes":"31983972645","depois":"31973972645"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c4-2a752d@example.com","depois":"qa.unif22.tc002.c.tc002-c4-2a752d@example.com"},{"campo":"MobilePhone","antes":"31983972645","depois":"31973972645"},{"campo":"CelularSe…`

**AR** (`TC002-AR-3354f2`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:50:28.000+0000"}]`

**FW** (`TC002-FW-858cb6`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:50:28.000+0000"}]`

### TC-005 — Account Y existente, Lead Y ausente

**C2** (`TC005-C2-05c5f1`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c2-05c5f1@example.com","depois":"qa.unif22.tc005.c.tc005-c2-05c5f1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC005-C3-f2d739`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c3-f2d739@example.com","depois":"qa.unif22.tc005.c.tc005-c3-f2d739@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:53:32.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c3-f2d739@example.com","depois":"qa.unif22.tc005.c.tc005-c3-f2d739@example.com"}]`

**C4** (`TC005-C4-bf9341`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c4-bf9341@example.com","depois":"qa.unif22.tc005.c.tc005-c4-bf9341@example.com"},{"campo":"Celular__c","antes":"31989100238","depois":"31979100238"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c4-bf9341@example.com","depois":"qa.unif22.tc005.c.tc005-c4-bf9341@example.com"},{"campo":"MobilePhone","antes":"31989100238","depois":"31979100238"},{"campo":"CelularSe…`

### TC-006 — Account Y e Lead Y órfão existentes

**C2** (`TC006-C2-e25581`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c2-e25581@example.com","depois":"qa.unif22.tc006.c.tc006-c2-e25581@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC006-C3-7e0097`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c3-7e0097@example.com","depois":"qa.unif22.tc006.c.tc006-c3-7e0097@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:54:53.0…`

**C4** (`TC006-C4-3ad740`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c4-3ad740@example.com","depois":"qa.unif22.tc006.c.tc006-c4-3ad740@example.com"},{"campo":"Celular__c","antes":"31981689836","depois":"31971689836"},{"campo":"Data…`

### TC-007 — Contatos de Y pertencem ao Lead Z

**C2** (`TC007-C2-8833be`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c2-8833be@example.com","depois":"qa.unif22.tc007.c.tc007-c2-8833be@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC007-C3-b3a568`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c3-b3a568@example.com","depois":"qa.unif22.tc007.c.tc007-c3-b3a568@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:56:09.0…`

**C4** (`TC007-C4-6c8011`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c4-6c8011@example.com","depois":"qa.unif22.tc007.c.tc007-c4-6c8011@example.com"},{"campo":"Celular__c","antes":"31988797354","depois":"31978797354"},{"campo":"Data…`

**FW** (`TC007-FW-c43fac`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc007.c.tc007-fw-c43fac@example.com"]`

### TC-009 — Account Y incompleta e Lead Y existente

**C2** (`TC009-C2-955a8c`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:57:40.000+0000"}]`

**C3** (`TC009-C3-8d6f0a`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:57:45.000+0000","depois":"2026-10-11T20:58:00.000+0000"}]`

**C4** (`TC009-C4-147292`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T20:56:46.000+0000","depois":"2026-10-11T20:57:56.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T20:56:46.000+0000","depoi…`

### TC-010 — Colisão apenas de e-mail

**C2** (`TC010-C2-8625dc`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T20:58:58.000+0000"}]`

**C3** (`TC010-C3-6ba6e6`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T20:58:53.000+0000","depois":"2026-10-11T20:59:08.000+0000"}]`

**C4** (`TC010-C4-13d969`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31980599964","depois":"31970599964"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T20:57:53.000+0000","depois":"2026-10-11T20:59:03.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31980599964","depois":"31970599964"},{"campo":"CelularSemFormatacao__c","antes":"31980599964","depois":"31970599964"}]`

**FW** (`TC010-FW-c3255e`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc010.a.tc010-fw-c3255e@example.com"]`

### TC-011 — Colisão apenas de celular

**C2** (`TC011-C2-14438d`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c2-14438d@example.com","depois":"qa.unif22.tc011.c.tc011-c2-14438d@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c2-14438d@example.com","depois":"qa.unif22.tc011.c.tc011-c2-14438d@example.com"}]`

**C3** (`TC011-C3-d24f30`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c3-d24f30@example.com","depois":"qa.unif22.tc011.c.tc011-c3-d24f30@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:00:26.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c3-d24f30@example.com","depois":"qa.unif22.tc011.c.tc011-c3-d24f30@example.com"}]`

**C4** (`TC011-C4-88f62a`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c4-88f62a@example.com","depois":"qa.unif22.tc011.c.tc011-c4-88f62a@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T20:59:35.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c4-88f62a@example.com","depois":"qa.unif22.tc011.c.tc011-c4-88f62a@example.com"}]`

### TC-012 — Fallback por e-mail em Lead sem CPF

_Observação:_ O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.

**C2** (`TC012-C2-0dc89f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:01:55.000+0000"}]`

**C3** (`TC012-C3-5b676a`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:01:42.000+0000","depois":"2026-10-11T21:01:57.000+0000"}]`

**C4** (`TC012-C4-fce0fb`, ❌ diverge):

- Lead X intacto (guard ehLeadOriginal): `[{"campo":"MobilePhone","antes":"31985316832","depois":"31975316832"},{"campo":"CelularSemFormatacao__c","antes":"31985316832","depois":"31975316832"}]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31985316832","depois":"31975316832"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:00:42.000+0000","depois":"2026-10-11T21:01:52.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31985316832","depois":"31975316832"},{"campo":"CelularSemFormatacao__c","antes":"31985316832","depois":"31975316832"}]`

### TC-013 — Fallback por celular em Lead sem CPF

**C2** (`TC013-C2-b15f19`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c2-b15f19@example.com","depois":"qa.unif22.tc013.c.tc013-c2-b15f19@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC013-C3-6f78a4`, ❌ diverge):

- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c3-6f78a4@example.com","depois":"qa.unif22.tc013.c.tc013-c3-6f78a4@example.com"}]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c3-6f78a4@example.com","depois":"qa.unif22.tc013.c.tc013-c3-6f78a4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:03:02.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c3-6f78a4@example.com","depois":"qa.unif22.tc013.c.tc013-c3-6f78a4@example.com"}]`

**C4** (`TC013-C4-ebf170`, ❌ diverge):

- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c4-ebf170@example.com","depois":"qa.unif22.tc013.c.tc013-c4-ebf170@example.com"}]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c4-ebf170@example.com","depois":"qa.unif22.tc013.c.tc013-c4-ebf170@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:02:03.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c4-ebf170@example.com","depois":"qa.unif22.tc013.c.tc013-c4-ebf170@example.com"}]`

**AR** (`TC013-AR-5874ce`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfcoR2AQ ≠ leadCandidato 00QHZ00000cfkfS2AQ"]`

**FW** (`TC013-FW-a554bc`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfm4Y2AQ ≠ leadCandidato 00QHZ00000cfiQk2AI"]`

### TC-014 — Sem compatibilidade; IdCliente em minúsculas

_Observação:_ IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.

**C2** (`TC014-C2-89a144`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c2-89a144@example.com","depois":"qa.unif22.tc014.c.tc014-c2-89a144@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC014-C3-860b90`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c3-860b90@example.com","depois":"qa.unif22.tc014.c.tc014-c3-860b90@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:04:21.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c3-860b90@example.com","depois":"qa.unif22.tc014.c.tc014-c3-860b90@example.com"}]`

**C4** (`TC014-C4-522024`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c4-522024@example.com","depois":"qa.unif22.tc014.c.tc014-c4-522024@example.com"},{"campo":"Celular__c","antes":"31981289578","depois":"31971289578"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c4-522024@example.com","depois":"qa.unif22.tc014.c.tc014-c4-522024@example.com"},{"campo":"MobilePhone","antes":"31981289578","depois":"31971289578"},{"campo":"CelularSe…`

### TC-015 — Sem compatibilidade; IdCliente em maiúsculas

_Observação:_ IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.

**C2** (`TC015-C2-879e33`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c2-879e33@example.com","depois":"qa.unif22.tc015.c.tc015-c2-879e33@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC015-C3-24dbd1`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c3-24dbd1@example.com","depois":"qa.unif22.tc015.c.tc015-c3-24dbd1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:05:38.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c3-24dbd1@example.com","depois":"qa.unif22.tc015.c.tc015-c3-24dbd1@example.com"}]`

**C4** (`TC015-C4-06a47c`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c4-06a47c@example.com","depois":"qa.unif22.tc015.c.tc015-c4-06a47c@example.com"},{"campo":"Celular__c","antes":"31982793095","depois":"31972793095"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c4-06a47c@example.com","depois":"qa.unif22.tc015.c.tc015-c4-06a47c@example.com"},{"campo":"MobilePhone","antes":"31982793095","depois":"31972793095"},{"campo":"CelularSe…`

### TC-016 — Y inexistente e colisão total

**C1** (`TC016-C1-6213de`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC016-C2-9f8788`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:07:01.000+0000"}]`

**C3** (`TC016-C3-5c6271`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:07:05.000+0000","depois":"2026-10-11T21:07:20.000+0000"}]`

**C4** (`TC016-C4-fabc92`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:06:13.000+0000","depois":"2026-10-11T21:07:23.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:06:13.000+0000","depoi…`

**AR** (`TC016-AR-05ce08`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:07:14.000+0000"}]`

**FW** (`TC016-FW-016818`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc016.a.tc016-fw-016818@example.com","celular 31982740875"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:07:15.000+0000"}]`

### TC-017 — Y inexistente; celular colide

**C1** (`TC017-C1-627e13`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC017-C2-990402`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c2-990402@example.com","depois":"qa.unif22.tc017.c.tc017-c2-990402@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c2-990402@example.com","depois":"qa.unif22.tc017.c.tc017-c2-990402@example.com"}]`

**C3** (`TC017-C3-310526`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c3-310526@example.com","depois":"qa.unif22.tc017.c.tc017-c3-310526@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:08:15.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c3-310526@example.com","depois":"qa.unif22.tc017.c.tc017-c3-310526@example.com"}]`

**C4** (`TC017-C4-fb1a77`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c4-fb1a77@example.com","depois":"qa.unif22.tc017.c.tc017-c4-fb1a77@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:07:15.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c4-fb1a77@example.com","depois":"qa.unif22.tc017.c.tc017-c4-fb1a77@example.com"}]`

**AR** (`TC017-AR-79fbde`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:08:15.000+0000"}]`

**FW** (`TC017-FW-0c6e67`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31989251101"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:08:16.000+0000"}]`

### TC-018 — Y inexistente; e-mail colide

**C1** (`TC018-C1-d938b0`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC018-C2-1a3735`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:09:34.000+0000"}]`

**C3** (`TC018-C3-56cd18`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:09:19.000+0000","depois":"2026-10-11T21:09:34.000+0000"}]`

**C4** (`TC018-C4-abdf26`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31989414198","depois":"31979414198"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:08:28.000+0000","depois":"2026-10-11T21:09:38.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31989414198","depois":"31979414198"},{"campo":"CelularSemFormatacao__c","antes":"31989414198","depois":"31979414198"}]`

**AR** (`TC018-AR-e18bda`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:09:29.000+0000"}]`

**FW** (`TC018-FW-1d48ae`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc018.a.tc018-fw-1d48ae@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:09:31.000+0000"}]`

### TC-019 — Lead Y livre por CPF, contatos diferentes

**C2** (`TC019-C2-6f755b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc019.a.tc019-c2-6f755b@example.com","depois":"qa.unif22.tc019.c.tc019-c2-6f755b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc019.a.tc019-c2-6f755b@example.com","depois":"qa.unif22.tc019.c.tc019-c2-6f755b@example.com"}]`

**C3** (`TC019-C3-49877e`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc019.a.tc019-c3-49877e@example.com","depois":"qa.unif22.tc019.c.tc019-c3-49877e@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:10:35.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc019.a.tc019-c3-49877e@example.com","depois":"qa.unif22.tc019.c.tc019-c3-49877e@example.com"}]`

**C4** (`TC019-C4-3146e0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc019.a.tc019-c4-3146e0@example.com","depois":"qa.unif22.tc019.c.tc019-c4-3146e0@example.com"},{"campo":"Celular__c","antes":"31988161695","depois":"31978161695"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc019.a.tc019-c4-3146e0@example.com","depois":"qa.unif22.tc019.c.tc019-c4-3146e0@example.com"},{"campo":"MobilePhone","antes":"31988161695","depois":"31978161695"},{"campo":"CelularSe…`

### TC-020 — Account Y só com CPF; nenhum Lead

**C2** (`TC020-C2-0a6627`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c2-0a6627@example.com","depois":"qa.unif22.tc020.c.tc020-c2-0a6627@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC020-C3-b7fa75`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c3-b7fa75@example.com","depois":"qa.unif22.tc020.c.tc020-c3-b7fa75@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:12:04.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c3-b7fa75@example.com","depois":"qa.unif22.tc020.c.tc020-c3-b7fa75@example.com"}]`

**C4** (`TC020-C4-e9ec6e`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c4-e9ec6e@example.com","depois":"qa.unif22.tc020.c.tc020-c4-e9ec6e@example.com"},{"campo":"Celular__c","antes":"31986707311","depois":"31976707311"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c4-e9ec6e@example.com","depois":"qa.unif22.tc020.c.tc020-c4-e9ec6e@example.com"},{"campo":"MobilePhone","antes":"31986707311","depois":"31976707311"},{"campo":"CelularSe…`

### TC-021 — Account Y com prospect divergente

**C2** (`TC021-C2-00b3a8`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c2-00b3a8@example.com","depois":"qa.unif22.tc021.c.tc021-c2-00b3a8@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC021-C3-1d269f`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c3-1d269f@example.com","depois":"qa.unif22.tc021.c.tc021-c3-1d269f@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:13:20.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c3-1d269f@example.com","depois":"qa.unif22.tc021.c.tc021-c3-1d269f@example.com"}]`

**C4** (`TC021-C4-117aa2`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c4-117aa2@example.com","depois":"qa.unif22.tc021.c.tc021-c4-117aa2@example.com"},{"campo":"Celular__c","antes":"31986367393","depois":"31976367393"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c4-117aa2@example.com","depois":"qa.unif22.tc021.c.tc021-c4-117aa2@example.com"},{"campo":"MobilePhone","antes":"31986367393","depois":"31976367393"},{"campo":"CelularSe…`

**AR** (`TC021-AR-a1c3cf`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ar-a1c3cf@example.com","depois":"qa.unif22.tc021.c.tc021-ar-a1c3cf@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AR-a1c3cf","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**AM** (`TC021-AM-1d1315`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-am-1d1315@example.com","depois":"qa.unif22.tc021.c.tc021-am-1d1315@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AM-1d1315","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**FW** (`TC021-FW-e7d03a`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-fw-e7d03a@example.com","depois":"qa.unif22.tc021.c.tc021-fw-e7d03a@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-FW-e7d03a","depois":"UNIF22 TC…`

### TC-022 — Account Y incompleta e Lead Y órfão

**C2** (`TC022-C2-1695fa`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:14:49.000+0000"}]`

**C3** (`TC022-C3-7b82b3`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:14:35.000+0000","depois":"2026-10-11T21:14:50.000+0000"}]`

**C4** (`TC022-C4-65aa81`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:13:35.000+0000","depois":"2026-10-11T21:14:45.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:13:35.000+0000","depoi…`

### TC-023 — Account Y inexistente e Lead Y órfão

**C1** (`TC023-C1-024819`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC023-C2-5e9a89`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:16:02.000+0000"}]`

**C3** (`TC023-C3-4a28d2`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:15:47.000+0000","depois":"2026-10-11T21:16:02.000+0000"}]`

**C4** (`TC023-C4-9e1a87`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:14:48.000+0000","depois":"2026-10-11T21:15:58.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:14:48.000+0000","depoi…`

**AR** (`TC023-AR-2bbe53`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:15:52.000+0000"}]`

**FW** (`TC023-FW-e954e9`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:15:53.000+0000"}]`

### TC-024 — Lead Y preso a outra Account

**C2** (`TC024-C2-9d4591`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:17:17.000+0000"}]`

**C3** (`TC024-C3-fc61dc`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:17:03.000+0000","depois":"2026-10-11T21:17:18.000+0000"}]`

**C4** (`TC024-C4-88f351`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:16:09.000+0000","depois":"2026-10-11T21:17:19.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:16:09.000+0000","depoi…`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**C2** (`TC025-C2-a571af`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:18:34.000+0000"}]`

**C3** (`TC025-C3-908d27`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:18:20.000+0000","depois":"2026-10-11T21:18:35.000+0000"}]`

**C4** (`TC025-C4-8f25e9`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:17:20.000+0000","depois":"2026-10-11T21:18:30.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:17:20.000+0000","depoi…`

**FW** (`TC025-FW-b5c5d6`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc025.a.tc025-fw-b5c5d6@example.com"]`

### TC-026 — Dois Leads Y; reutilizar o livre

**C2** (`TC026-C2-dbeaab`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:19:44.000+0000"}]`

**C3** (`TC026-C3-23289f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:19:31.000+0000","depois":"2026-10-11T21:19:46.000+0000"}]`

**C4** (`TC026-C4-395129`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:18:31.000+0000","depois":"2026-10-11T21:19:41.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:18:31.000+0000","depoi…`

### TC-027 — Todos os Leads Y estão presos

**C2** (`TC027-C2-760612`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:21:06.000+0000"}]`

**C3** (`TC027-C3-dee420`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:20:55.000+0000","depois":"2026-10-11T21:21:10.000+0000"}]`

**C4** (`TC027-C4-60b30a`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:19:56.000+0000","depois":"2026-10-11T21:21:06.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:19:56.000+0000","depoi…`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**C1** (`TC038-C1-a191d4`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-c1-a191d4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:22:20.000+0000"}]`

**C2** (`TC038-C2-b30684`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:22:21.000+0000"}]`

**C3** (`TC038-C3-f95269`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:22:07.000+0000","depois":"2026-10-11T21:22:22.000+0000"}]`

**C4** (`TC038-C4-ab0fde`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:21:15.000+0000","depois":"2026-10-11T21:22:25.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:21:15.000+0000","depoi…`

**AR** (`TC038-AR-c5c241`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-ar-c5c241@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:22:31.000+0000"}]`

**FW** (`TC038-FW-a0665b`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-fw-a0665b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:22:54.000+0000"}]`
- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc038.a.tc038-fw-a0665b@example.com"]`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-e7a815`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**ME** (`TC040-ME-d4acd4`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**C1** (`TC040-C1-0232ff`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC040-C2-54e13c`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:24:43.000+0000"}]`

**C3** (`TC040-C3-b5f32a`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:24:32.000+0000","depois":"2026-10-11T21:24:47.000+0000"}]`

**C4** (`TC040-C4-c39e03`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:23:37.000+0000","depois":"2026-10-11T21:24:47.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:23:37.000+0000","depoi…`

**AR** (`TC040-AR-780bf6`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:24:38.000+0000"}]`

**FW** (`TC040-FW-2cc571`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:24:41.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000cfoXx2AI","Id__c":"39e74b94-221f-244d-63ce-315c6f18fd4e"},{"Id":"00QHZ00000cfqWN2AY","Id__c":"faa22eca-cb97-ceb4-1337-740b02bdff64"}]}`

### TC-041 — Venda Genérica com colisão total

**C1** (`TC041-C1-494657`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC041-C2-d79eab`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:25:50.000+0000"}]`

**C3** (`TC041-C3-d67bfb`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:25:44.000+0000","depois":"2026-10-11T21:25:59.000+0000"}]`

**C4** (`TC041-C4-57d3d3`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:24:45.000+0000","depois":"2026-10-11T21:25:55.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:24:45.000+0000","depoi…`

**AR** (`TC041-AR-f77e43`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:25:45.000+0000"}]`

**FW** (`TC041-FW-5feee4`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc041.a.tc041-fw-5feee4@example.com","celular 31980041881"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:25:53.000+0000"}]`

### TC-042 — Venda Genérica; e-mail colide

**C1** (`TC042-C1-0db18c`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC042-C2-9c7706`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:27:03.000+0000"}]`

**C3** (`TC042-C3-15e7d2`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:26:49.000+0000","depois":"2026-10-11T21:27:04.000+0000"}]`

**C4** (`TC042-C4-b0a2da`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31983078654","depois":"31973078654"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:25:58.000+0000","depois":"2026-10-11T21:27:08.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31983078654","depois":"31973078654"},{"campo":"CelularSemFormatacao__c","antes":"31983078654","depois":"31973078654"}]`

**AR** (`TC042-AR-b4bd16`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:26:58.000+0000"}]`

**FW** (`TC042-FW-9d7efd`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc042.a.tc042-fw-9d7efd@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:27:00.000+0000"}]`

### TC-043 — Venda Genérica; celular colide

**C1** (`TC043-C1-51a799`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC043-C2-14e1a5`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c2-14e1a5@example.com","depois":"qa.unif22.tc043.c.tc043-c2-14e1a5@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC043-C3-0184ff`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c3-0184ff@example.com","depois":"qa.unif22.tc043.c.tc043-c3-0184ff@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:27:54.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c3-0184ff@example.com","depois":"qa.unif22.tc043.c.tc043-c3-0184ff@example.com"}]`

**C4** (`TC043-C4-2fd590`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c4-2fd590@example.com","depois":"qa.unif22.tc043.c.tc043-c4-2fd590@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:26:54.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c4-2fd590@example.com","depois":"qa.unif22.tc043.c.tc043-c4-2fd590@example.com"}]`

**AR** (`TC043-AR-88c198`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:27:56.000+0000"}]`

**FW** (`TC043-FW-4102d8`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31984003198"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:28:01.000+0000"}]`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**C1** (`TC044-C1-b04e5b`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC044-C2-eb23a6`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c2-eb23a6@example.com","depois":"qa.unif22.tc044.c.tc044-c2-eb23a6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c2-eb23a6@example.com","depois":"qa.unif22.tc044.c.tc044-c2-eb23a6@example.com"}]`

**C3** (`TC044-C3-3a1892`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c3-3a1892@example.com","depois":"qa.unif22.tc044.c.tc044-c3-3a1892@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:28:59.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c3-3a1892@example.com","depois":"qa.unif22.tc044.c.tc044-c3-3a1892@example.com"}]`

**C4** (`TC044-C4-20d408`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c4-20d408@example.com","depois":"qa.unif22.tc044.c.tc044-c4-20d408@example.com"},{"campo":"Celular__c","antes":"31988670758","depois":"31978670758"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c4-20d408@example.com","depois":"qa.unif22.tc044.c.tc044-c4-20d408@example.com"},{"campo":"MobilePhone","antes":"31988670758","depois":"31978670758"},{"campo":"CelularSe…`

**AR** (`TC044-AR-0b1141`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:29:00.000+0000"}]`

**FW** (`TC044-FW-027b30`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:29:00.000+0000"}]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-b5fcf4`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfwjj2AA ≠ leadCandidato 00QHZ00000cfxcb2AA"]`

**CA** (`TC045-CA-123332`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzEZ2AY ≠ leadCandidato 00QHZ00000cfuwU2AQ"]`

**ME** (`TC045-ME-e9f885`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfvKh2AI ≠ leadCandidato 00QHZ00000cfx372AA"]`

**C1** (`TC045-C1-93fdbc`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC045-C2-61c928`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c2-61c928@example.com","depois":"qa.unif22.tc045.c.tc045-c2-61c928@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC045-C3-f62076`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c3-f62076@example.com","depois":"qa.unif22.tc045.c.tc045-c3-f62076@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:30:32.0…`

**C4** (`TC045-C4-641321`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c4-641321@example.com","depois":"qa.unif22.tc045.c.tc045-c4-641321@example.com"},{"campo":"Celular__c","antes":"31987392769","depois":"31977392769"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31987392769","depois":"31977392769"},{"campo":"CelularSemFormatacao__c","antes":"31987392769","depois":"31977392769"}]`

**AR** (`TC045-AR-335e1d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzfx2AA ≠ leadCandidato 00QHZ00000cfxBA2AY"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:30:32.000+0000"}]`

**FW** (`TC045-FW-501c1e`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfygg2AA ≠ leadCandidato 00QHZ00000cfzjB2AQ"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:30:44.000+0000"}]`

**RC** (`TC045-RC-a122e1`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzmP2AQ ≠ leadCandidato 00QHZ00000cforB2AQ"]`

**EP** (`TC045-EP-2c70c2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfewg2AA ≠ leadCandidato 00QHZ00000cfzkn2AA"]`

**RL** (`TC045-RL-56af50`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzpd2AA ≠ leadCandidato 00QHZ00000cfmJC2AY"]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

**PA** (`TC046-PA-5f6280`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfpDf2AI ≠ leadCandidato 00QHZ00000cfvKj2AI"]`

**CA** (`TC046-CA-2be8fa`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cftO12AI ≠ leadCandidato 00QHZ00000cfrlo2AA"]`

**ME** (`TC046-ME-b13c4b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfyC52AI ≠ leadCandidato 00QHZ00000cfsHy2AI"]`

**C1** (`TC046-C1-172fb7`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC046-C2-d18f54`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c2-d18f54@example.com","depois":"qa.unif22.tc046.c.tc046-c2-d18f54@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC046-C3-af1b3f`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c3-af1b3f@example.com","depois":"qa.unif22.tc046.c.tc046-c3-af1b3f@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:31:39.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-c3-af1b3f@example.com","depois":"qa.unif22.tc046.c.tc046-c3-af1b3f@example.com"}]`

**C4** (`TC046-C4-894dc9`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c4-894dc9@example.com","depois":"qa.unif22.tc046.c.tc046-c4-894dc9@example.com"},{"campo":"Celular__c","antes":"31986293778","depois":"31976293778"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-c4-894dc9@example.com","depois":"qa.unif22.tc046.c.tc046-c4-894dc9@example.com"}]`

**AR** (`TC046-AR-31b32f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfqZd2AI ≠ leadCandidato 00QHZ00000cfk182AA"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:31:45.000+0000"}]`

**FW** (`TC046-FW-6a020c`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzxh2AA ≠ leadCandidato 00QHZ00000cfhku2AA"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:31:55.000+0000"}]`

**RC** (`TC046-RC-f26848`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzw52AA ≠ leadCandidato 00QHZ00000cfzuT2AQ"]`

**EP** (`TC046-EP-68c446`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cftnX2AQ ≠ leadCandidato 00QHZ00000cg00v2AA"]`

**RL** (`TC046-RL-62afc8`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfxJD2AY ≠ leadCandidato 00QHZ00000cfffi2AA"]`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

**C1** (`TC047-C1-da6275`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC047-C2-3dcfb4`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c2-3dcfb4@example.com","depois":"qa.unif22.tc047.c.tc047-c2-3dcfb4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c2-3dcfb4@example.com","depois":"qa.unif22.tc047.c.tc047-c2-3dcfb4@example.com"}]`

**C3** (`TC047-C3-a1dd70`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c3-a1dd70@example.com","depois":"qa.unif22.tc047.c.tc047-c3-a1dd70@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:32:45.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c3-a1dd70@example.com","depois":"qa.unif22.tc047.c.tc047-c3-a1dd70@example.com"}]`

**C4** (`TC047-C4-b60e0b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c4-b60e0b@example.com","depois":"qa.unif22.tc047.c.tc047-c4-b60e0b@example.com"},{"campo":"Celular__c","antes":"31982350145","depois":"31972350145"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c4-b60e0b@example.com","depois":"qa.unif22.tc047.c.tc047-c4-b60e0b@example.com"},{"campo":"MobilePhone","antes":"31982350145","depois":"31972350145"},{"campo":"CelularSe…`

**AR** (`TC047-AR-6f8c7a`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc047.c.tc047-ar-6f8c7a@example.com / 31974847314"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:32:53.000+0000"}]`

**FW** (`TC047-FW-06cd51`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc047.c.tc047-fw-06cd51@example.com / 31974807248"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:32:53.000+0000"}]`

### TC-048 — Lead Y preso com compatibilidade total

**C1** (`TC048-C1-6366b2`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC048-C2-59f2e1`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c2-59f2e1@example.com","depois":"qa.unif22.tc048.c.tc048-c2-59f2e1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC048-C3-6facab`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c3-6facab@example.com","depois":"qa.unif22.tc048.c.tc048-c3-6facab@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:33:52.0…`

**C4** (`TC048-C4-0d9c30`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c4-0d9c30@example.com","depois":"qa.unif22.tc048.c.tc048-c4-0d9c30@example.com"},{"campo":"Celular__c","antes":"31983526214","depois":"31973526214"},{"campo":"Data…`

**AR** (`TC048-AR-93ade1`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:34:04.000+0000"}]`

**FW** (`TC048-FW-78612f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:34:07.000+0000"}]`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-dad939`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cg0P82AI ≠ leadCandidato 00QHZ00000cfsYC2AY"]`

**CA** (`TC049-CA-9cf33d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfzCy2AI ≠ leadCandidato 00QHZ00000cfpYg2AI"]`

**ME** (`TC049-ME-bba2a7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cg0c12AA ≠ leadCandidato 00QHZ00000cfqZf2AI"]`

**C1** (`TC049-C1-fd73ee`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC049-C2-0ecb63`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c2-0ecb63@example.com","depois":"qa.unif22.tc049.c.tc049-c2-0ecb63@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC049-C3-7c0f57`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c3-7c0f57@example.com","depois":"qa.unif22.tc049.c.tc049-c3-7c0f57@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:35:01.0…`

**C4** (`TC049-C4-2a4277`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c4-2a4277@example.com","depois":"qa.unif22.tc049.c.tc049-c4-2a4277@example.com"},{"campo":"Celular__c","antes":"31982035119","depois":"31972035119"},{"campo":"Data…`

**AR** (`TC049-AR-1973d4`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cg10D2AQ ≠ leadCandidato 00QHZ00000cfwlQ2AQ"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:35:04.000+0000"}]`

**FW** (`TC049-FW-aef9fe`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfsxw2AA ≠ leadCandidato 00QHZ00000cfsOW2AY"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:35:05.000+0000"}]`

**RC** (`TC049-RC-04e459`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfrSN2AY ≠ leadCandidato 00QHZ00000cg11p2AA"]`

**EP** (`TC049-EP-d8d8f1`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfr4E2AQ ≠ leadCandidato 00QHZ00000cfmMH2AY"]`

**RL** (`TC049-RL-6d71ca`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfoBK2AY ≠ leadCandidato 00QHZ00000cg16f2AA"]`

### TC-053 — Proponente com Account/IdCliente existente

_Observação:_ Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.

**C2** (`TC053-C2-730935`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc053.a.tc053-c2-730935@example.com","depois":"qa.unif22.tc053.e.tc053-c2-730935@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC053-C3-dd63c6`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc053.a.tc053-c3-dd63c6@example.com","depois":"qa.unif22.tc053.e.tc053-c3-dd63c6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:36:14.0…`

**C4** (`TC053-C4-9d7d2f`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc053.a.tc053-c4-9d7d2f@example.com","depois":"qa.unif22.tc053.e.tc053-c4-9d7d2f@example.com"},{"campo":"Celular__c","antes":"31988139860","depois":"31968139860"},{"campo":"Data…`

### TC-054 — Proponente X aprovado como Y na Venda Genérica

**C1** (`TC054-C1-51608f`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC054-C2-68fd63`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:37:40.000+0000"}]`

**C3** (`TC054-C3-4633cf`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:37:25.000+0000","depois":"2026-10-11T21:37:40.000+0000"}]`

**C4** (`TC054-C4-0eb75d`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:36:25.000+0000","depois":"2026-10-11T21:37:35.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:36:25.000+0000","depoi…`

**AR** (`TC054-AR-ccadeb`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:37:31.000+0000"}]`

**FW** (`TC054-FW-f8fbe3`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc054.a.tc054-fw-f8fbe3@example.com","celular 31980074873"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:37:31.000+0000"}]`

### TC-055 — Priorizar Lead Y por CPF na Venda Genérica

**C1** (`TC055-C1-30d80d`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC055-C2-b6d8c0`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:38:43.000+0000"}]`

**C3** (`TC055-C3-4923a3`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc055.a.tc055-c3-4923a3@example.com","depois":"qa.unif22.tc055.c.tc055-c3-4923a3@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:38:31.0…`

**C4** (`TC055-C4-b60b80`, ❌ diverge):

- Account X intacta: `[{"campo":"Celular__c","antes":"31987583558","depois":"31977583558"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:37:33.000+0000","depois":"2026-10-11T21:38:43.000+0000"},{"campo":"DataAlteracaoEv…`

**AR** (`TC055-AR-9ae356`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc055.c.tc055-ar-9ae356@example.com / 31965077901"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc055.c.tc055-ar-9ae356@example.com","depois":"qa.unif22.tc055.a.tc055-ar-9ae356@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc055.c.tc055-ar-9ae356@example.com","depois":"qa.unif22.tc055.a.tc055-ar-9ae356@example.com"}]`

**FW** (`TC055-FW-e358bf`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc055.c.tc055-fw-e358bf@example.com / 31961365329"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc055.c.tc055-fw-e358bf@example.com","depois":"qa.unif22.tc055.a.tc055-fw-e358bf@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc055.c.tc055-fw-e358bf@example.com","depois":"qa.unif22.tc055.a.tc055-fw-e358bf@example.com"}]`

### TC-056 — Repetição funcional do TC-055

_Observação:_ Duplicação aparente da planilha: mesma massa do TC-055.

**C1** (`TC056-C1-17bc93`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC056-C2-7490a6`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:39:53.000+0000"}]`

**C3** (`TC056-C3-1a2242`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc056.a.tc056-c3-1a2242@example.com","depois":"qa.unif22.tc056.c.tc056-c3-1a2242@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:39:39.0…`

**C4** (`TC056-C4-dfacec`, ❌ diverge):

- Account X intacta: `[{"campo":"Celular__c","antes":"31980550449","depois":"31970550449"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:38:46.000+0000","depois":"2026-10-11T21:39:56.000+0000"},{"campo":"DataAlteracaoEv…`

**AR** (`TC056-AR-9d1695`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc056.c.tc056-ar-9d1695@example.com / 31964050876"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc056.c.tc056-ar-9d1695@example.com","depois":"qa.unif22.tc056.a.tc056-ar-9d1695@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc056.c.tc056-ar-9d1695@example.com","depois":"qa.unif22.tc056.a.tc056-ar-9d1695@example.com"}]`

**FW** (`TC056-FW-282f9a`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc056.c.tc056-fw-282f9a@example.com / 31961112157"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc056.c.tc056-fw-282f9a@example.com","depois":"qa.unif22.tc056.a.tc056-fw-282f9a@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc056.c.tc056-fw-282f9a@example.com","depois":"qa.unif22.tc056.a.tc056-fw-282f9a@example.com"}]`

### TC-057 — Proponente Y colide totalmente com X

**C1** (`TC057-C1-b58270`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC057-C2-7727ac`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:40:58.000+0000"}]`

**C3** (`TC057-C3-3d4f56`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:40:49.000+0000","depois":"2026-10-11T21:41:04.000+0000"}]`

**C4** (`TC057-C4-5b6930`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T21:39:51.000+0000","depois":"2026-10-11T21:41:01.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T21:39:51.000+0000","depoi…`

**AR** (`TC057-AR-81fb42`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:40:52.000+0000"}]`

**FW** (`TC057-FW-cbb479`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc057.a.tc057-fw-cbb479@example.com","celular 31984961916"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T21:40:56.000+0000"}]`

### TC-062 — Account Y com IdCliente e sem IdProspect

_Observação:_ Eventos vão sem idprospectsalesforce.

**C2** (`TC062-C2-3aca26`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c2-3aca26@example.com","depois":"qa.unif22.tc062.c.tc062-c2-3aca26@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC062-C3-b230d5`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c3-b230d5@example.com","depois":"qa.unif22.tc062.c.tc062-c3-b230d5@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T21:42:04.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c3-b230d5@example.com","depois":"qa.unif22.tc062.c.tc062-c3-b230d5@example.com"}]`

**C4** (`TC062-C4-55fdcb`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c4-55fdcb@example.com","depois":"qa.unif22.tc062.c.tc062-c4-55fdcb@example.com"},{"campo":"Celular__c","antes":"31987023075","depois":"31977023075"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c4-55fdcb@example.com","depois":"qa.unif22.tc062.c.tc062-c4-55fdcb@example.com"},{"campo":"MobilePhone","antes":"31987023075","depois":"31977023075"},{"campo":"CelularSe…`

## Adaptações registradas

- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.

## Tempos

Média de 545 RUNs, em segundos: total 36.0; massa 3.7; cadeia 26.9 (dos quais 12.5 esperando jobs); verificação 0.4; cleanup 4.8.

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

