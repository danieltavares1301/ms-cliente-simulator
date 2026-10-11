# Resultado do runbook — campanha completa sem os commits (dev revertida), 11/10

> **Campanha sem os commits.** Rodou na dev revertida, com `ClienteService`,
> `NotificacaoCliente` e `NotificacaoPAC` iguais a `c04b6add92` e
> `NotificacaoMaquinaEstado` igual a `9f0ba21f38`, os dois de 03/09. Faltavam
> nelas os cinco commits abaixo, do branch da 2.2
> (`GV_918914_UnificPosAprovPAC`). A campanha com os commits, depois que as
> quatro voltaram à ponta da 2.2, está em
> [`resultado-runbook-completo-com-commits-2026-10-11.md`](resultado-runbook-completo-com-commits-2026-10-11.md).

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

Execução de 2026-10-11T16:48:19.433Z a 2026-10-11T18:11:05.356Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**545 RUNs:** 331 conformes, 214 divergentes, 0 com erro de execução.

> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os
> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em
> que o caminho alcança X, "Account X intacta" diverge até os guards de
> identidade serem implantados. Veja `docs/handoff-investigacao-tc001-bug4.md`.

> **Perfis AR, AM, FW, RC, EP e RL (ordens reais da aprovação):** a ordem que o
> MS de crédito, o WebJob e o MS Clientes produzem. "—" no AM é TC em que ele
> não se aplica (a pessoa aprovada ainda não existe no MS Clientes). Veja a
> seção 7.2 de `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Análise

Campanha completa de 11/10: os 44 TCs executáveis nos 13 perfis. O AM rodou
só nos 17 TCs em que se aplica.

- **Duas rodadas no mesmo arquivo de resultados:**
  - os seis perfis das ordens reais, das 16:48 às 17:14 UTC, com a análise
    deles no [relatório das ordens reais](resultado-runbook-ordens-reais-2026-10-11.md);
  - os outros sete, das 17:40 às 18:11 UTC.
- **Estado da dev:** o revertido de 27/09 ([estado da dev](estado-da-mrv-devDan.md)).
- **Execução:** nenhum RUN terminou em erro, o resíduo ficou zerado e uma
  queda de rede foi refeita.

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

Cada divergência está ligada a um bug no
[catálogo de bugs](bugs-pegos-pelo-runbook.md), que traz a matriz TC × perfil.
Em resumo:

- **PA, CA e ME:** os mesmos vereditos de 27/09 e 02/10, só com os bugs já
  conhecidos K1 e K2. A refatoração do motor feita em 11/10 não mudou nada.
- **C1:**
  - o bug 4 (B1) nos 19 TCs em que Y não tem Account;
  - a Account duplicada errada (B3) no TC-038;
  - no TC-040, o RUN para na recusa da PAC em análise (B8).
- **C2 e C3:** o bug 4 (B1) em todos os TCs, menos os três de MATCH (003,
  004 e 039). Os dois mandam o IdCliente de X nas PACs em análise. No C3, a
  pendência vem antes, e a PAC de Y altera X com a flag já ligada.
- **C4:** a contestação pendente grava em X (B2) em todos os TCs, menos os de
  MATCH.
- **AR, AM, FW, RC, EP e RL:** ver o relatório das ordens reais.

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

**C1** (`TC001-C1-1f19d7`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:39:45.000+0000"}]`

**C2** (`TC001-C2-aa70a4`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:39:45.000+0000"}]`

**C3** (`TC001-C3-7a51d9`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:39:30.000+0000","depois":"2026-10-11T17:39:45.000+0000"}]`

**C4** (`TC001-C4-b0193d`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:39:03.000+0000","depois":"2026-10-11T17:40:13.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:39:03.000+0000","depoi…`

**AR** (`TC001-AR-863078`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:47:34.000+0000"}]`

**FW** (`TC001-FW-7a35f3`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc001.a.tc001-fw-7a35f3@example.com","celular 31981654623"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:47:34.000+0000"}]`

### TC-002 — CPF, e-mail e celular divergentes

**C1** (`TC002-C1-ed515f`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c1-ed515f@example.com","depois":"qa.unif22.tc002.c.tc002-c1-ed515f@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C2** (`TC002-C2-7ccc7c`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c2-7ccc7c@example.com","depois":"qa.unif22.tc002.c.tc002-c2-7ccc7c@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c2-7ccc7c@example.com","depois":"qa.unif22.tc002.c.tc002-c2-7ccc7c@example.com"}]`

**C3** (`TC002-C3-7588d4`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c3-7588d4@example.com","depois":"qa.unif22.tc002.c.tc002-c3-7588d4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:40:33.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c3-7588d4@example.com","depois":"qa.unif22.tc002.c.tc002-c3-7588d4@example.com"}]`

**C4** (`TC002-C4-9606f5`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c4-9606f5@example.com","depois":"qa.unif22.tc002.c.tc002-c4-9606f5@example.com"},{"campo":"Celular__c","antes":"31985991057","depois":"31975991057"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c4-9606f5@example.com","depois":"qa.unif22.tc002.c.tc002-c4-9606f5@example.com"},{"campo":"MobilePhone","antes":"31985991057","depois":"31975991057"},{"campo":"CelularSe…`

**AR** (`TC002-AR-7e9f8d`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-ar-7e9f8d@example.com","depois":"qa.unif22.tc002.c.tc002-ar-7e9f8d@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-ar-7e9f8d@example.com","depois":"qa.unif22.tc002.c.tc002-ar-7e9f8d@example.com"}]`

**FW** (`TC002-FW-43cf42`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-fw-43cf42@example.com","depois":"qa.unif22.tc002.c.tc002-fw-43cf42@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-fw-43cf42@example.com","depois":"qa.unif22.tc002.c.tc002-fw-43cf42@example.com"}]`

### TC-005 — Account Y existente, Lead Y ausente

**C2** (`TC005-C2-de0758`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c2-de0758@example.com","depois":"qa.unif22.tc005.c.tc005-c2-de0758@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC005-C3-8dfad2`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c3-8dfad2@example.com","depois":"qa.unif22.tc005.c.tc005-c3-8dfad2@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:42:12.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c3-8dfad2@example.com","depois":"qa.unif22.tc005.c.tc005-c3-8dfad2@example.com"}]`

**C4** (`TC005-C4-0108aa`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c4-0108aa@example.com","depois":"qa.unif22.tc005.c.tc005-c4-0108aa@example.com"},{"campo":"Celular__c","antes":"31981956771","depois":"31971956771"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c4-0108aa@example.com","depois":"qa.unif22.tc005.c.tc005-c4-0108aa@example.com"},{"campo":"MobilePhone","antes":"31981956771","depois":"31971956771"},{"campo":"CelularSe…`

### TC-006 — Account Y e Lead Y órfão existentes

**C2** (`TC006-C2-99ca02`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c2-99ca02@example.com","depois":"qa.unif22.tc006.c.tc006-c2-99ca02@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC006-C3-ec9030`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c3-ec9030@example.com","depois":"qa.unif22.tc006.c.tc006-c3-ec9030@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:42:51.0…`

**C4** (`TC006-C4-b30c31`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c4-b30c31@example.com","depois":"qa.unif22.tc006.c.tc006-c4-b30c31@example.com"},{"campo":"Celular__c","antes":"31987367681","depois":"31977367681"},{"campo":"Data…`

### TC-007 — Contatos de Y pertencem ao Lead Z

**C2** (`TC007-C2-0131a6`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c2-0131a6@example.com","depois":"qa.unif22.tc007.c.tc007-c2-0131a6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC007-C3-4bbb19`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c3-4bbb19@example.com","depois":"qa.unif22.tc007.c.tc007-c3-4bbb19@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:43:49.0…`

**C4** (`TC007-C4-aeddda`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c4-aeddda@example.com","depois":"qa.unif22.tc007.c.tc007-c4-aeddda@example.com"},{"campo":"Celular__c","antes":"31982963742","depois":"31972963742"},{"campo":"Data…`

**FW** (`TC007-FW-dc3e60`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc007.c.tc007-fw-dc3e60@example.com"]`

### TC-009 — Account Y incompleta e Lead Y existente

**C2** (`TC009-C2-03e73c`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:44:42.000+0000"}]`

**C3** (`TC009-C3-b97ca4`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:44:28.000+0000","depois":"2026-10-11T17:44:43.000+0000"}]`

**C4** (`TC009-C4-34f770`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:43:36.000+0000","depois":"2026-10-11T17:44:46.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:43:36.000+0000","depoi…`

### TC-010 — Colisão apenas de e-mail

**C2** (`TC010-C2-12c74d`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:45:23.000+0000"}]`

**C3** (`TC010-C3-e17369`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:45:08.000+0000","depois":"2026-10-11T17:45:23.000+0000"}]`

**C4** (`TC010-C4-9ef2ad`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31983350705","depois":"31973350705"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:44:09.000+0000","depois":"2026-10-11T17:45:19.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31983350705","depois":"31973350705"},{"campo":"CelularSemFormatacao__c","antes":"31983350705","depois":"31973350705"}]`

**FW** (`TC010-FW-c6d078`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc010.a.tc010-fw-c6d078@example.com"]`

### TC-011 — Colisão apenas de celular

**C2** (`TC011-C2-bdd641`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c2-bdd641@example.com","depois":"qa.unif22.tc011.c.tc011-c2-bdd641@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC011-C3-ca6201`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c3-ca6201@example.com","depois":"qa.unif22.tc011.c.tc011-c3-ca6201@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:45:51.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c3-ca6201@example.com","depois":"qa.unif22.tc011.c.tc011-c3-ca6201@example.com"}]`

**C4** (`TC011-C4-d21f32`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c4-d21f32@example.com","depois":"qa.unif22.tc011.c.tc011-c4-d21f32@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:44:52.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c4-d21f32@example.com","depois":"qa.unif22.tc011.c.tc011-c4-d21f32@example.com"}]`

### TC-012 — Fallback por e-mail em Lead sem CPF

_Observação:_ O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.

**C2** (`TC012-C2-04041f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:46:49.000+0000"}]`

**C3** (`TC012-C3-723c47`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:46:34.000+0000","depois":"2026-10-11T17:46:49.000+0000"}]`

**C4** (`TC012-C4-5a8d48`, ❌ diverge):

- Lead X intacto (guard ehLeadOriginal): `[{"campo":"MobilePhone","antes":"31984859967","depois":"31974859967"},{"campo":"CelularSemFormatacao__c","antes":"31984859967","depois":"31974859967"}]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31984859967","depois":"31974859967"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:45:35.000+0000","depois":"2026-10-11T17:46:45.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31984859967","depois":"31974859967"},{"campo":"CelularSemFormatacao__c","antes":"31984859967","depois":"31974859967"}]`

### TC-013 — Fallback por celular em Lead sem CPF

**C2** (`TC013-C2-f9d766`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c2-f9d766@example.com","depois":"qa.unif22.tc013.c.tc013-c2-f9d766@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC013-C3-0ec952`, ❌ diverge):

- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c3-0ec952@example.com","depois":"qa.unif22.tc013.c.tc013-c3-0ec952@example.com"}]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c3-0ec952@example.com","depois":"qa.unif22.tc013.c.tc013-c3-0ec952@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:47:18.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c3-0ec952@example.com","depois":"qa.unif22.tc013.c.tc013-c3-0ec952@example.com"}]`

**C4** (`TC013-C4-e90da1`, ❌ diverge):

- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c4-e90da1@example.com","depois":"qa.unif22.tc013.c.tc013-c4-e90da1@example.com"}]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c4-e90da1@example.com","depois":"qa.unif22.tc013.c.tc013-c4-e90da1@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:46:30.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c4-e90da1@example.com","depois":"qa.unif22.tc013.c.tc013-c4-e90da1@example.com"}]`

**AR** (`TC013-AR-a45b5f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfXn32AE ≠ leadCandidato 00QHZ00000cfNam2AE"]`

**FW** (`TC013-FW-d05252`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfZFI2A2 ≠ leadCandidato 00QHZ00000cfNHU2A2"]`

### TC-014 — Sem compatibilidade; IdCliente em minúsculas

_Observação:_ IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.

**C2** (`TC014-C2-e15b07`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c2-e15b07@example.com","depois":"qa.unif22.tc014.c.tc014-c2-e15b07@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c2-e15b07@example.com","depois":"qa.unif22.tc014.c.tc014-c2-e15b07@example.com"}]`

**C3** (`TC014-C3-c67ee3`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c3-c67ee3@example.com","depois":"qa.unif22.tc014.c.tc014-c3-c67ee3@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:48:02.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c3-c67ee3@example.com","depois":"qa.unif22.tc014.c.tc014-c3-c67ee3@example.com"}]`

**C4** (`TC014-C4-28be16`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c4-28be16@example.com","depois":"qa.unif22.tc014.c.tc014-c4-28be16@example.com"},{"campo":"Celular__c","antes":"31980741696","depois":"31970741696"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c4-28be16@example.com","depois":"qa.unif22.tc014.c.tc014-c4-28be16@example.com"},{"campo":"MobilePhone","antes":"31980741696","depois":"31970741696"},{"campo":"CelularSe…`

### TC-015 — Sem compatibilidade; IdCliente em maiúsculas

_Observação:_ IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.

**C2** (`TC015-C2-9d05a7`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c2-9d05a7@example.com","depois":"qa.unif22.tc015.c.tc015-c2-9d05a7@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC015-C3-68cf78`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c3-68cf78@example.com","depois":"qa.unif22.tc015.c.tc015-c3-68cf78@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:48:39.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c3-68cf78@example.com","depois":"qa.unif22.tc015.c.tc015-c3-68cf78@example.com"}]`

**C4** (`TC015-C4-f78453`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c4-f78453@example.com","depois":"qa.unif22.tc015.c.tc015-c4-f78453@example.com"},{"campo":"Celular__c","antes":"31980521749","depois":"31970521749"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c4-f78453@example.com","depois":"qa.unif22.tc015.c.tc015-c4-f78453@example.com"},{"campo":"MobilePhone","antes":"31980521749","depois":"31970521749"},{"campo":"CelularSe…`

### TC-016 — Y inexistente e colisão total

**C1** (`TC016-C1-58f0f0`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:49:26.000+0000"}]`

**C2** (`TC016-C2-b656e7`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:49:26.000+0000"}]`

**C3** (`TC016-C3-a7df6b`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:49:18.000+0000","depois":"2026-10-11T17:49:33.000+0000"}]`

**C4** (`TC016-C4-8274b1`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:48:19.000+0000","depois":"2026-10-11T17:49:29.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:48:19.000+0000","depoi…`

**AR** (`TC016-AR-57a07c`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:55:47.000+0000"}]`

**FW** (`TC016-FW-8ade0e`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc016.a.tc016-fw-8ade0e@example.com","celular 31983820766"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:55:57.000+0000"}]`

### TC-017 — Y inexistente; celular colide

**C1** (`TC017-C1-38ad97`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c1-38ad97@example.com","depois":"qa.unif22.tc017.c.tc017-c1-38ad97@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c1-38ad97@example.com","depois":"qa.unif22.tc017.c.tc017-c1-38ad97@example.com"}]`

**C2** (`TC017-C2-ac5eff`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c2-ac5eff@example.com","depois":"qa.unif22.tc017.c.tc017-c2-ac5eff@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC017-C3-37bb02`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c3-37bb02@example.com","depois":"qa.unif22.tc017.c.tc017-c3-37bb02@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:49:51.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c3-37bb02@example.com","depois":"qa.unif22.tc017.c.tc017-c3-37bb02@example.com"}]`

**C4** (`TC017-C4-4cb045`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c4-4cb045@example.com","depois":"qa.unif22.tc017.c.tc017-c4-4cb045@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:48:59.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c4-4cb045@example.com","depois":"qa.unif22.tc017.c.tc017-c4-4cb045@example.com"}]`

**AR** (`TC017-AR-9f8d62`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-ar-9f8d62@example.com","depois":"qa.unif22.tc017.c.tc017-ar-9f8d62@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-ar-9f8d62@example.com","depois":"qa.unif22.tc017.c.tc017-ar-9f8d62@example.com"}]`

**FW** (`TC017-FW-6a6888`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31987793522"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-fw-6a6888@example.com","depois":"qa.unif22.tc017.c.tc017-fw-6a6888@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-fw-6a6888@example.com","depois":"qa.unif22.tc017.c.tc017-fw-6a6888@example.com"}]`

### TC-018 — Y inexistente; e-mail colide

**C1** (`TC018-C1-36a585`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:50:40.000+0000"}]`

**C2** (`TC018-C2-fcc4de`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:50:41.000+0000"}]`

**C3** (`TC018-C3-b4dc3f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:50:38.000+0000","depois":"2026-10-11T17:50:53.000+0000"}]`

**C4** (`TC018-C4-189ff5`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31983229948","depois":"31973229948"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:49:48.000+0000","depois":"2026-10-11T17:50:58.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31983229948","depois":"31973229948"},{"campo":"CelularSemFormatacao__c","antes":"31983229948","depois":"31973229948"}]`

**AR** (`TC018-AR-e0b280`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:56:54.000+0000"}]`

**FW** (`TC018-FW-b9ab50`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc018.a.tc018-fw-b9ab50@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:56:57.000+0000"}]`

### TC-019 — Lead Y livre por CPF, contatos diferentes

**C2** (`TC019-C2-1ed6f0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc019.a.tc019-c2-1ed6f0@example.com","depois":"qa.unif22.tc019.c.tc019-c2-1ed6f0@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc019.a.tc019-c2-1ed6f0@example.com","depois":"qa.unif22.tc019.c.tc019-c2-1ed6f0@example.com"}]`

**C3** (`TC019-C3-c3ee3d`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc019.a.tc019-c3-c3ee3d@example.com","depois":"qa.unif22.tc019.c.tc019-c3-c3ee3d@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:51:20.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc019.a.tc019-c3-c3ee3d@example.com","depois":"qa.unif22.tc019.c.tc019-c3-c3ee3d@example.com"}]`

**C4** (`TC019-C4-fe4719`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc019.a.tc019-c4-fe4719@example.com","depois":"qa.unif22.tc019.c.tc019-c4-fe4719@example.com"},{"campo":"Celular__c","antes":"31982993434","depois":"31972993434"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc019.a.tc019-c4-fe4719@example.com","depois":"qa.unif22.tc019.c.tc019-c4-fe4719@example.com"},{"campo":"MobilePhone","antes":"31982993434","depois":"31972993434"},{"campo":"CelularSe…`

### TC-020 — Account Y só com CPF; nenhum Lead

**C2** (`TC020-C2-459dcb`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c2-459dcb@example.com","depois":"qa.unif22.tc020.c.tc020-c2-459dcb@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c2-459dcb@example.com","depois":"qa.unif22.tc020.c.tc020-c2-459dcb@example.com"}]`

**C3** (`TC020-C3-388202`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c3-388202@example.com","depois":"qa.unif22.tc020.c.tc020-c3-388202@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:52:05.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c3-388202@example.com","depois":"qa.unif22.tc020.c.tc020-c3-388202@example.com"}]`

**C4** (`TC020-C4-d50147`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c4-d50147@example.com","depois":"qa.unif22.tc020.c.tc020-c4-d50147@example.com"},{"campo":"Celular__c","antes":"31983302733","depois":"31973302733"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c4-d50147@example.com","depois":"qa.unif22.tc020.c.tc020-c4-d50147@example.com"},{"campo":"MobilePhone","antes":"31983302733","depois":"31973302733"},{"campo":"CelularSe…`

### TC-021 — Account Y com prospect divergente

**C2** (`TC021-C2-54bec5`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c2-54bec5@example.com","depois":"qa.unif22.tc021.c.tc021-c2-54bec5@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC021-C3-e95ee7`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c3-e95ee7@example.com","depois":"qa.unif22.tc021.c.tc021-c3-e95ee7@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:52:38.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c3-e95ee7@example.com","depois":"qa.unif22.tc021.c.tc021-c3-e95ee7@example.com"}]`

**C4** (`TC021-C4-d02299`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c4-d02299@example.com","depois":"qa.unif22.tc021.c.tc021-c4-d02299@example.com"},{"campo":"Celular__c","antes":"31988716802","depois":"31978716802"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c4-d02299@example.com","depois":"qa.unif22.tc021.c.tc021-c4-d02299@example.com"},{"campo":"MobilePhone","antes":"31988716802","depois":"31978716802"},{"campo":"CelularSe…`

**AR** (`TC021-AR-b81a87`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ar-b81a87@example.com","depois":"qa.unif22.tc021.c.tc021-ar-b81a87@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AR-b81a87","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**AM** (`TC021-AM-d29ae3`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-am-d29ae3@example.com","depois":"qa.unif22.tc021.c.tc021-am-d29ae3@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AM-d29ae3","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**FW** (`TC021-FW-9e32af`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-fw-9e32af@example.com","depois":"qa.unif22.tc021.c.tc021-fw-9e32af@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-FW-9e32af","depois":"UNIF22 TC…`

### TC-022 — Account Y incompleta e Lead Y órfão

**C2** (`TC022-C2-647e25`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:53:26.000+0000"}]`

**C3** (`TC022-C3-44b501`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:53:19.000+0000","depois":"2026-10-11T17:53:34.000+0000"}]`

**C4** (`TC022-C4-5ca7b4`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:52:20.000+0000","depois":"2026-10-11T17:53:30.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:52:20.000+0000","depoi…`

### TC-023 — Account Y inexistente e Lead Y órfão

**C1** (`TC023-C1-28d44b`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:53:59.000+0000"}]`

**C2** (`TC023-C2-6668d4`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:54:07.000+0000"}]`

**C3** (`TC023-C3-a55d97`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:53:52.000+0000","depois":"2026-10-11T17:54:07.000+0000"}]`

**C4** (`TC023-C4-f29652`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:53:04.000+0000","depois":"2026-10-11T17:54:14.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:53:04.000+0000","depoi…`

**AR** (`TC023-AR-8afdb6`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:00:07.000+0000"}]`

**FW** (`TC023-FW-9adeea`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:00:08.000+0000"}]`

### TC-024 — Lead Y preso a outra Account

**C2** (`TC024-C2-32cb5b`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:54:41.000+0000"}]`

**C3** (`TC024-C3-fc8f1b`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:54:40.000+0000","depois":"2026-10-11T17:54:55.000+0000"}]`

**C4** (`TC024-C4-89fdc6`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:53:44.000+0000","depois":"2026-10-11T17:54:54.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:53:44.000+0000","depoi…`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**C2** (`TC025-C2-a26589`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:55:37.000+0000"}]`

**C3** (`TC025-C3-579d2f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:55:23.000+0000","depois":"2026-10-11T17:55:38.000+0000"}]`

**C4** (`TC025-C4-eb4dd7`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:54:33.000+0000","depois":"2026-10-11T17:55:43.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:54:33.000+0000","depoi…`

**FW** (`TC025-FW-c32a1e`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc025.a.tc025-fw-c32a1e@example.com"]`

### TC-026 — Dois Leads Y; reutilizar o livre

**C2** (`TC026-C2-afec92`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:56:13.000+0000"}]`

**C3** (`TC026-C3-c95ff3`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:56:07.000+0000","depois":"2026-10-11T17:56:22.000+0000"}]`

**C4** (`TC026-C4-78eb34`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:55:08.000+0000","depois":"2026-10-11T17:56:18.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:55:08.000+0000","depoi…`

### TC-027 — Todos os Leads Y estão presos

**C2** (`TC027-C2-74d4d6`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:56:58.000+0000"}]`

**C3** (`TC027-C3-6139bf`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:56:43.000+0000","depois":"2026-10-11T17:56:58.000+0000"}]`

**C4** (`TC027-C4-92ebcd`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:55:47.000+0000","depois":"2026-10-11T17:56:57.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:55:47.000+0000","depoi…`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**C1** (`TC038-C1-6355df`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-c1-6355df@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:57:46.000+0000"}]`

**C2** (`TC038-C2-ed9112`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:57:47.000+0000"}]`

**C3** (`TC038-C3-8c3053`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:57:33.000+0000","depois":"2026-10-11T17:57:48.000+0000"}]`

**C4** (`TC038-C4-95fd39`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:56:43.000+0000","depois":"2026-10-11T17:57:53.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:56:43.000+0000","depoi…`

**AR** (`TC038-AR-d1767e`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-ar-d1767e@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:03:12.000+0000"}]`

**FW** (`TC038-FW-1e97ab`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-fw-1e97ab@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:03:17.000+0000"}]`
- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc038.a.tc038-fw-1e97ab@example.com"]`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-2e7ace`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**ME** (`TC040-ME-65e9c1`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**C1** (`TC040-C1-ee9a23`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC040-C2-0f06f8`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:58:54.000+0000"}]`

**C3** (`TC040-C3-1f1779`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:58:48.000+0000","depois":"2026-10-11T17:59:03.000+0000"}]`

**C4** (`TC040-C4-805b7a`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:57:56.000+0000","depois":"2026-10-11T17:59:06.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:57:56.000+0000","depoi…`

**AR** (`TC040-AR-f97cac`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:04:06.000+0000"}]`

**FW** (`TC040-FW-f33814`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:04:12.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000cfXAJ2A2","Id__c":"4193065f-3cf2-f66d-5950-42876f5e8e74"},{"Id":"00QHZ00000cfZOy2AM","Id__c":"2024feab-7978-3c93-4fb2-b3a1f5dab5b1"}]}`

### TC-041 — Venda Genérica com colisão total

**C1** (`TC041-C1-a4e251`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:59:39.000+0000"}]`

**C2** (`TC041-C2-b41989`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:59:45.000+0000"}]`

**C3** (`TC041-C3-68f4c4`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T17:59:33.000+0000","depois":"2026-10-11T17:59:48.000+0000"}]`

**C4** (`TC041-C4-e4cfcc`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:58:43.000+0000","depois":"2026-10-11T17:59:53.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T17:58:43.000+0000","depoi…`

**AR** (`TC041-AR-79e914`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:04:58.000+0000"}]`

**FW** (`TC041-FW-56cb36`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc041.a.tc041-fw-56cb36@example.com","celular 31985583538"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:05:00.000+0000"}]`

### TC-042 — Venda Genérica; e-mail colide

**C1** (`TC042-C1-ab0cbd`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:00:24.000+0000"}]`

**C2** (`TC042-C2-002461`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:00:24.000+0000"}]`

**C3** (`TC042-C3-b6ed43`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:00:18.000+0000","depois":"2026-10-11T18:00:33.000+0000"}]`

**C4** (`TC042-C4-4ece66`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31982283472","depois":"31972283472"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T17:59:32.000+0000","depois":"2026-10-11T18:00:42.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31982283472","depois":"31972283472"},{"campo":"CelularSemFormatacao__c","antes":"31982283472","depois":"31972283472"}]`

**AR** (`TC042-AR-9a36ab`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:05:15.000+0000"}]`

**FW** (`TC042-FW-f6576a`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc042.a.tc042-fw-f6576a@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:05:36.000+0000"}]`

### TC-043 — Venda Genérica; celular colide

**C1** (`TC043-C1-2ff534`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c1-2ff534@example.com","depois":"qa.unif22.tc043.c.tc043-c1-2ff534@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c1-2ff534@example.com","depois":"qa.unif22.tc043.c.tc043-c1-2ff534@example.com"}]`

**C2** (`TC043-C2-0d496c`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c2-0d496c@example.com","depois":"qa.unif22.tc043.c.tc043-c2-0d496c@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC043-C3-5c329e`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c3-5c329e@example.com","depois":"qa.unif22.tc043.c.tc043-c3-5c329e@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:01:03.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c3-5c329e@example.com","depois":"qa.unif22.tc043.c.tc043-c3-5c329e@example.com"}]`

**C4** (`TC043-C4-84411d`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c4-84411d@example.com","depois":"qa.unif22.tc043.c.tc043-c4-84411d@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T18:00:09.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c4-84411d@example.com","depois":"qa.unif22.tc043.c.tc043-c4-84411d@example.com"}]`

**AR** (`TC043-AR-9407a4`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-ar-9407a4@example.com","depois":"qa.unif22.tc043.c.tc043-ar-9407a4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-ar-9407a4@example.com","depois":"qa.unif22.tc043.c.tc043-ar-9407a4@example.com"}]`

**FW** (`TC043-FW-0f19b6`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31988820364"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-fw-0f19b6@example.com","depois":"qa.unif22.tc043.c.tc043-fw-0f19b6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-fw-0f19b6@example.com","depois":"qa.unif22.tc043.c.tc043-fw-0f19b6@example.com"}]`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**C1** (`TC044-C1-1d5194`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c1-1d5194@example.com","depois":"qa.unif22.tc044.c.tc044-c1-1d5194@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c1-1d5194@example.com","depois":"qa.unif22.tc044.c.tc044-c1-1d5194@example.com"}]`

**C2** (`TC044-C2-789694`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c2-789694@example.com","depois":"qa.unif22.tc044.c.tc044-c2-789694@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c2-789694@example.com","depois":"qa.unif22.tc044.c.tc044-c2-789694@example.com"}]`

**C3** (`TC044-C3-09c11b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c3-09c11b@example.com","depois":"qa.unif22.tc044.c.tc044-c3-09c11b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:01:42.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c3-09c11b@example.com","depois":"qa.unif22.tc044.c.tc044-c3-09c11b@example.com"}]`

**C4** (`TC044-C4-ba8ed8`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c4-ba8ed8@example.com","depois":"qa.unif22.tc044.c.tc044-c4-ba8ed8@example.com"},{"campo":"Celular__c","antes":"31986502378","depois":"31976502378"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-c4-ba8ed8@example.com","depois":"qa.unif22.tc044.c.tc044-c4-ba8ed8@example.com"},{"campo":"MobilePhone","antes":"31986502378","depois":"31976502378"},{"campo":"CelularSe…`

**AR** (`TC044-AR-6340c0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-ar-6340c0@example.com","depois":"qa.unif22.tc044.c.tc044-ar-6340c0@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-ar-6340c0@example.com","depois":"qa.unif22.tc044.c.tc044-ar-6340c0@example.com"}]`

**FW** (`TC044-FW-76c9d0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-fw-76c9d0@example.com","depois":"qa.unif22.tc044.c.tc044-fw-76c9d0@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-fw-76c9d0@example.com","depois":"qa.unif22.tc044.c.tc044-fw-76c9d0@example.com"}]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-6a5d52`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfRpj2AE ≠ leadCandidato 00QHZ00000cfgob2AA"]`

**CA** (`TC045-CA-2573f2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfa8E2AQ ≠ leadCandidato 00QHZ00000cff2w2AA"]`

**ME** (`TC045-ME-dfe87d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfUqp2AE ≠ leadCandidato 00QHZ00000cfXS12AM"]`

**C1** (`TC045-C1-298fdf`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c1-298fdf@example.com","depois":"qa.unif22.tc045.c.tc045-c1-298fdf@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C2** (`TC045-C2-313171`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c2-313171@example.com","depois":"qa.unif22.tc045.c.tc045-c2-313171@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC045-C3-d891cd`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c3-d891cd@example.com","depois":"qa.unif22.tc045.c.tc045-c3-d891cd@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:02:27.0…`

**C4** (`TC045-C4-5c4452`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c4-5c4452@example.com","depois":"qa.unif22.tc045.c.tc045-c4-5c4452@example.com"},{"campo":"Celular__c","antes":"31986699392","depois":"31976699392"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31986699392","depois":"31976699392"},{"campo":"CelularSemFormatacao__c","antes":"31986699392","depois":"31976699392"}]`

**AR** (`TC045-AR-f2058b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-ar-f2058b@example.com","depois":"qa.unif22.tc045.c.tc045-ar-f2058b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**FW** (`TC045-FW-8b40cb`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-fw-8b40cb@example.com","depois":"qa.unif22.tc045.c.tc045-fw-8b40cb@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**RC** (`TC045-RC-d7dd10`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfTgG2AU ≠ leadCandidato 00QHZ00000cfLFn2AM"]`

**EP** (`TC045-EP-576875`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfa4v2AA ≠ leadCandidato 00QHZ00000cfLfU2AU"]`

**RL** (`TC045-RL-f369f0`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfZVU2A2 ≠ leadCandidato 00QHZ00000cfamQ2AQ"]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

**PA** (`TC046-PA-9139f6`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfgyH2AQ ≠ leadCandidato 00QHZ00000cfWHa2AM"]`

**CA** (`TC046-CA-1c2031`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cffUN2AY ≠ leadCandidato 00QHZ00000cfXoi2AE"]`

**ME** (`TC046-ME-8af9bf`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfKl12AE ≠ leadCandidato 00QHZ00000cfa9l2AA"]`

**C1** (`TC046-C1-890ed5`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c1-890ed5@example.com","depois":"qa.unif22.tc046.c.tc046-c1-890ed5@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C2** (`TC046-C2-5d43f1`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c2-5d43f1@example.com","depois":"qa.unif22.tc046.c.tc046-c2-5d43f1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC046-C3-a0ef87`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c3-a0ef87@example.com","depois":"qa.unif22.tc046.c.tc046-c3-a0ef87@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:03:11.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-c3-a0ef87@example.com","depois":"qa.unif22.tc046.c.tc046-c3-a0ef87@example.com"}]`

**C4** (`TC046-C4-8007fe`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c4-8007fe@example.com","depois":"qa.unif22.tc046.c.tc046-c4-8007fe@example.com"},{"campo":"Celular__c","antes":"31984659017","depois":"31974659017"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-c4-8007fe@example.com","depois":"qa.unif22.tc046.c.tc046-c4-8007fe@example.com"}]`

**AR** (`TC046-AR-11ddcc`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfYfq2AE ≠ leadCandidato 00QHZ00000cfXs02AE"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-ar-11ddcc@example.com","depois":"qa.unif22.tc046.c.tc046-ar-11ddcc@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-ar-11ddcc@example.com","depois":"qa.unif22.tc046.c.tc046-ar-11ddcc@example.com"}]`

**FW** (`TC046-FW-172a51`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfLm12AE ≠ leadCandidato 00QHZ00000cfUlz2AE"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-fw-172a51@example.com","depois":"qa.unif22.tc046.c.tc046-fw-172a51@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-fw-172a51@example.com","depois":"qa.unif22.tc046.c.tc046-fw-172a51@example.com"}]`

**RC** (`TC046-RC-5cf1df`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfY7w2AE ≠ leadCandidato 00QHZ00000cfMF52AM"]`

**EP** (`TC046-EP-83c16f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfNfc2AE ≠ leadCandidato 00QHZ00000cfLCY2A2"]`

**RL** (`TC046-RL-39491a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfPCt2AM ≠ leadCandidato 00QHZ00000cfGas2AE"]`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

**C1** (`TC047-C1-e8a066`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c1-e8a066@example.com","depois":"qa.unif22.tc047.c.tc047-c1-e8a066@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c1-e8a066@example.com","depois":"qa.unif22.tc047.c.tc047-c1-e8a066@example.com"}]`

**C2** (`TC047-C2-f1c5d6`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c2-f1c5d6@example.com","depois":"qa.unif22.tc047.c.tc047-c2-f1c5d6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c2-f1c5d6@example.com","depois":"qa.unif22.tc047.c.tc047-c2-f1c5d6@example.com"}]`

**C3** (`TC047-C3-3cf225`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c3-3cf225@example.com","depois":"qa.unif22.tc047.c.tc047-c3-3cf225@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:03:42.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c3-3cf225@example.com","depois":"qa.unif22.tc047.c.tc047-c3-3cf225@example.com"}]`

**C4** (`TC047-C4-302875`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c4-302875@example.com","depois":"qa.unif22.tc047.c.tc047-c4-302875@example.com"},{"campo":"Celular__c","antes":"31984861809","depois":"31974861809"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c4-302875@example.com","depois":"qa.unif22.tc047.c.tc047-c4-302875@example.com"},{"campo":"MobilePhone","antes":"31984861809","depois":"31974861809"},{"campo":"CelularSe…`

**AR** (`TC047-AR-e705ae`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-ar-e705ae@example.com","depois":"qa.unif22.tc047.c.tc047-ar-e705ae@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-ar-e705ae@example.com","depois":"qa.unif22.tc047.c.tc047-ar-e705ae@example.com"}]`

**FW** (`TC047-FW-55bc59`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-fw-55bc59@example.com","depois":"qa.unif22.tc047.c.tc047-fw-55bc59@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-fw-55bc59@example.com","depois":"qa.unif22.tc047.c.tc047-fw-55bc59@example.com"}]`

### TC-048 — Lead Y preso com compatibilidade total

**C1** (`TC048-C1-cd5bc3`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c1-cd5bc3@example.com","depois":"qa.unif22.tc048.c.tc048-c1-cd5bc3@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C2** (`TC048-C2-2ad040`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c2-2ad040@example.com","depois":"qa.unif22.tc048.c.tc048-c2-2ad040@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC048-C3-75f5ce`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c3-75f5ce@example.com","depois":"qa.unif22.tc048.c.tc048-c3-75f5ce@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:04:32.0…`

**C4** (`TC048-C4-bb9ed2`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c4-bb9ed2@example.com","depois":"qa.unif22.tc048.c.tc048-c4-bb9ed2@example.com"},{"campo":"Celular__c","antes":"31986923090","depois":"31976923090"},{"campo":"Data…`

**AR** (`TC048-AR-4b88ab`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-ar-4b88ab@example.com","depois":"qa.unif22.tc048.c.tc048-ar-4b88ab@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**FW** (`TC048-FW-d5111c`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-fw-d5111c@example.com","depois":"qa.unif22.tc048.c.tc048-fw-d5111c@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-4f2188`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfbAh2AI ≠ leadCandidato 00QHZ00000cfhHd2AI"]`

**CA** (`TC049-CA-9b703a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfbgw2AA ≠ leadCandidato 00QHZ00000cfg8g2AA"]`

**ME** (`TC049-ME-d58c71`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfLu82AE ≠ leadCandidato 00QHZ00000cfSiY2AU"]`

**C1** (`TC049-C1-590109`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c1-590109@example.com","depois":"qa.unif22.tc049.c.tc049-c1-590109@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C2** (`TC049-C2-09e671`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c2-09e671@example.com","depois":"qa.unif22.tc049.c.tc049-c2-09e671@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC049-C3-eff3c1`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c3-eff3c1@example.com","depois":"qa.unif22.tc049.c.tc049-c3-eff3c1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:05:16.0…`

**C4** (`TC049-C4-a0a6a4`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c4-a0a6a4@example.com","depois":"qa.unif22.tc049.c.tc049-c4-a0a6a4@example.com"},{"campo":"Celular__c","antes":"31980943222","depois":"31970943222"},{"campo":"Data…`

**AR** (`TC049-AR-c7c5d7`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-ar-c7c5d7@example.com","depois":"qa.unif22.tc049.c.tc049-ar-c7c5d7@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**FW** (`TC049-FW-0e86dc`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-fw-0e86dc@example.com","depois":"qa.unif22.tc049.c.tc049-fw-0e86dc@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**RC** (`TC049-RC-e6b358`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfWe82AE ≠ leadCandidato 00QHZ00000cfZX32AM"]`

**EP** (`TC049-EP-70f3f7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfVDL2A2 ≠ leadCandidato 00QHZ00000cfc532AA"]`

**RL** (`TC049-RL-082a74`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfUil2AE ≠ leadCandidato 00QHZ00000cfN6D2AU"]`

### TC-053 — Proponente com Account/IdCliente existente

_Observação:_ Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.

**C2** (`TC053-C2-57393a`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc053.a.tc053-c2-57393a@example.com","depois":"qa.unif22.tc053.e.tc053-c2-57393a@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC053-C3-c0e561`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc053.a.tc053-c3-c0e561@example.com","depois":"qa.unif22.tc053.e.tc053-c3-c0e561@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:05:51.0…`

**C4** (`TC053-C4-1bd5e3`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc053.a.tc053-c4-1bd5e3@example.com","depois":"qa.unif22.tc053.e.tc053-c4-1bd5e3@example.com"},{"campo":"Celular__c","antes":"31987318338","depois":"31967318338"},{"campo":"Data…`

### TC-054 — Proponente X aprovado como Y na Venda Genérica

**C1** (`TC054-C1-b1bd38`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:06:43.000+0000"}]`

**C2** (`TC054-C2-dc5829`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:06:43.000+0000"}]`

**C3** (`TC054-C3-907fc4`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:06:29.000+0000","depois":"2026-10-11T18:06:44.000+0000"}]`

**C4** (`TC054-C4-f9eec0`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T18:05:29.000+0000","depois":"2026-10-11T18:06:39.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T18:05:29.000+0000","depoi…`

**AR** (`TC054-AR-6d9224`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:09:58.000+0000"}]`

**FW** (`TC054-FW-6efb96`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc054.a.tc054-fw-6efb96@example.com","celular 31986359354"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:10:23.000+0000"}]`

### TC-055 — Priorizar Lead Y por CPF na Venda Genérica

**C1** (`TC055-C1-d37762`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:07:17.000+0000"}]`

**C2** (`TC055-C2-b28ca9`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:07:17.000+0000"}]`

**C3** (`TC055-C3-3fbd8b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc055.a.tc055-c3-3fbd8b@example.com","depois":"qa.unif22.tc055.c.tc055-c3-3fbd8b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:07:08.0…`

**C4** (`TC055-C4-4bb8ce`, ❌ diverge):

- Account X intacta: `[{"campo":"Celular__c","antes":"31989004692","depois":"31979004692"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T18:06:09.000+0000","depois":"2026-10-11T18:07:19.000+0000"},{"campo":"DataAlteracaoEv…`

**AR** (`TC055-AR-604f6f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:10:32.000+0000"}]`

**FW** (`TC055-FW-953d0e`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:10:32.000+0000"}]`

### TC-056 — Repetição funcional do TC-055

_Observação:_ Duplicação aparente da planilha: mesma massa do TC-055.

**C1** (`TC056-C1-fc9f8f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:07:53.000+0000"}]`

**C2** (`TC056-C2-d8227d`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:08:01.000+0000"}]`

**C3** (`TC056-C3-af7a9b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc056.a.tc056-c3-af7a9b@example.com","depois":"qa.unif22.tc056.c.tc056-c3-af7a9b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:07:46.0…`

**C4** (`TC056-C4-c6c3c7`, ❌ diverge):

- Account X intacta: `[{"campo":"Celular__c","antes":"31983214659","depois":"31973214659"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T18:07:10.000+0000","depois":"2026-10-11T18:08:20.000+0000"},{"campo":"DataAlteracaoEv…`

**AR** (`TC056-AR-273a02`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:06.000+0000"}]`

**FW** (`TC056-FW-c6f8fd`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:08.000+0000"}]`

### TC-057 — Proponente Y colide totalmente com X

**C1** (`TC057-C1-61d1bf`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:08:37.000+0000"}]`

**C2** (`TC057-C2-44506b`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T18:08:46.000+0000"}]`

**C3** (`TC057-C3-045a74`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:08:40.000+0000","depois":"2026-10-11T18:08:55.000+0000"}]`

**C4** (`TC057-C4-d81362`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-11T18:07:41.000+0000","depois":"2026-10-11T18:08:51.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-11T18:07:41.000+0000","depoi…`

**AR** (`TC057-AR-586348`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:53.000+0000"}]`

**FW** (`TC057-FW-8f5d95`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc057.a.tc057-fw-8f5d95@example.com","celular 31985634762"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:56.000+0000"}]`

### TC-062 — Account Y com IdCliente e sem IdProspect

_Observação:_ Eventos vão sem idprospectsalesforce.

**C2** (`TC062-C2-383ce4`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c2-383ce4@example.com","depois":"qa.unif22.tc062.c.tc062-c2-383ce4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC062-C3-e560a1`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c3-e560a1@example.com","depois":"qa.unif22.tc062.c.tc062-c3-e560a1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-11T18:09:29.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c3-e560a1@example.com","depois":"qa.unif22.tc062.c.tc062-c3-e560a1@example.com"}]`

**C4** (`TC062-C4-cbdcb0`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c4-cbdcb0@example.com","depois":"qa.unif22.tc062.c.tc062-c4-cbdcb0@example.com"},{"campo":"Celular__c","antes":"31983592243","depois":"31973592243"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c4-cbdcb0@example.com","depois":"qa.unif22.tc062.c.tc062-c4-cbdcb0@example.com"},{"campo":"MobilePhone","antes":"31983592243","depois":"31973592243"},{"campo":"CelularSe…`

## Adaptações registradas

- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.

## Tempos

Média de 545 RUNs, em segundos: total 36.9; massa 3.5; cadeia 28.3 (dos quais 13.4 esperando jobs); verificação 0.4; cleanup 4.7.

Refeitos depois de queda de rede: TC-017/RC (1 queda).

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

