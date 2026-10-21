# Resultado do runbook da Unificação 2.2 — etapa 2 (ponto zero: a 1.3 mais a etapa 1) na `mrv-devDan`

> **Linha de base da 1.3.** A dev roda a 1.3 com a etapa 1 do plano da reescrita, sem a camada de identidade e contatos da 2.2. As etapas seguintes se medem contra esta campanha (`docs/plano-branch-reescrita-2.2.md`, seções 3 e 6).

Execução de 2026-10-21T00:23:50.190Z a 2026-10-21T01:04:18.952Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**484 RUNs:** 24 conformes, 460 divergentes, 0 com erro de execução.

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

Os 39 TCs executáveis no modelo do harness, nos 13 perfis, com
`npm run runbook -- --todos --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL --paralelo 6`.
O AM rodou só nos 16 TCs em que se aplica. É a linha de base das etapas
seguintes do [plano da reescrita](plano-branch-reescrita-2.2.md) (seção 3.4).

- **Código da dev:** o ponto zero, a 1.3 mais a etapa 1
  ([estado da dev](estado-da-mrv-devDan.md), retrato de 20/10).
- **Execução:** das 00:23 às 01:04 UTC de 21/10. Nenhum RUN terminou em erro,
  não houve queda de rede, e o resíduo ficou zerado. Antes, a fumaça (TC-001,
  TC-003 e TC-026 no PA, no CA e no AR) rodou à parte.
- **Os JSONL:** `../campanhas-runbook/etapa-2-2026-10-20.jsonl` e
  `../campanhas-runbook/etapa-2-fumaca-2026-10-20.jsonl`.
- **A etapa 1 funciona na cadeia:**
  - o `pac-update` respondeu 200 em todos os RUNs, também sobre PAC
    existente;
  - a data da PAC aprovada ficou em UTC nos 39 RUNs do RC.

| Perfil | RUNs | Conformes | Divergentes |
|---|---:|---:|---:|
| PA | 39 | 2 | 37 |
| CA | 39 | 2 | 37 |
| ME | 39 | 2 | 37 |
| C1 | 39 | 2 | 37 |
| C2 | 39 | 2 | 37 |
| C3 | 39 | 2 | 37 |
| C4 | 39 | 2 | 37 |
| AR | 39 | 2 | 37 |
| AM | 16 | 2 | 14 |
| FW | 39 | 2 | 37 |
| RC | 39 | 0 | 39 |
| EP | 39 | 2 | 37 |
| RL | 39 | 2 | 37 |

Os conformes são os TCs de MATCH, o 003 e o 039, em todos os perfis menos o
RC.

### Rótulos

Por `npm run runbook:bugs` (o nome do arquivo dá a etapa 2). O que falta de
código sai como "pendente" da regra que o traz (plano, seção 3.3). Nenhuma
falha ficou com `?`.

| Rótulo | Pares | O que é |
|---|---:|---|
| pendente R1 | 269 | **X sobrescrita.** O `cliente-insert` de Y com o PROS-X acha X pelo prospect e grava nela o IdCliente, o CPF e o nome de Y; o reflexo leva o CPF de Y ao Lead X. Em 21 TCs, em todos os perfis. Daí falham também "Account aprovada é nova" ou "é a accountY", as contagens de Account e de Lead do CPF e o Caso C. Entram ainda a PAC de X que não acha X (TC-004) e a Opportunity da Venda Genérica (lacuna 8) |
| pendente R4 | 251 | Não nasce Lead para Y, e o Lead que devia ser reutilizado não é ligado |
| pendente R5 | 156 | O evento de Y com o PROS-X grava esse prospect na Account Y, que já existe. O campo é único, e o evento volta 400 com `DUPLICATE_VALUE`. O RUN para aí |
| pendente R3 | 26 | No RC, o contato atrasado, de antes da aprovação, vence os contatos da PAC aprovada |
| B1 | 9 | A pendência grava em X o e-mail de Y: TC-021 no C1, C2, C3, AR e FW; TC-040 e TC-062 no C2 e C3 |
| B4 | 10 | A pendência reflete os dados de Y no Lead de Z, no TC-021 |
| B8 | 6 | A PAC em análise de Y é recusada: TC-040 e TC-062, no C1, AR e FW |
| K1 | 2 | TC-040, no PA e no ME |

Não aparecem o B2, o B3, o B5, o B6, o B7, o B9, o B10 nem o K2.

### Contra o que o plano previa (seção 3.5)

**Confirmado:**
- X é sobrescrita pelo prospect, e o reflexo da 1.3 leva o CPF de Y ao Lead
  X.
- Não nasce Lead para Y. Os TCs de MATCH 003 e 039 passam.
- A Opportunity fica em X na Venda Genérica: AR e FW do 040 e do 062, e AM do
  062.
- O Lead Z do TC-021 muda (B4).
- Somem como mecanismo o B2, o B6, o B7, o B9 e o B10.
- O RC passa na data.

**Diferente do previsto:**
1. **O TC-004 não passa.** O plano o tratava como MATCH. A PAC de X
   (`pac-insert-x`) volta 400, "Cliente(Account) não encontrado", nos 12
   perfis. Nesse TC, X existe sem CPF e sem IdCliente.
   - A `NotificacaoPAC` da 1.3 busca a Account pelo `getClienteUnificacaoLead`,
     só por IdCliente e prospect.
   - A da 2.2 usa o `getClientePosPac` do `c47170d879`, que olha também o
     CPF. A R1 liga esse método na `NotificacaoPAC` (seção 4.1).
2. **156 pares param em `DUPLICATE_VALUE`.** São os 12 TCs em que a Account Y
   já existe (005 a 007, 010 a 015, 019, 026 e 038), em todos os perfis.
   - O `cliente-update` ou o `contato-email` de Y chega com o PROS-X, e a 1.3
     grava esse prospect na Account Y. Na 2.2, quem impedia era o
     `b372038f43`, que o inventário põe na R5.
   - Por isso, o rótulo é "pendente R5". Mas a R1 também lista "o IdProspect
     da Account" no escopo dela, então o erro pode sumir já na etapa 3.
   - Como o RUN para no evento, nada depois dele é medido nesses TCs, nem o
     B1 que o plano previa no 038 nem o Lead candidato do 012 e do 013.
3. **No RC, o contato atrasado vence** nos 26 TCs que chegam ao fim. Na 2.2, a
   PAC aprovada gravava os contatos com a data dela
   (`sincronizarContatosAprovadosPac`), e o contato mais velho era descartado.
   Isso volta com a R3.
4. **O B8 aparece também no TC-062**, e não só no 040.

### Matriz

| TC | PA | CA | ME | C1 | C2 | C3 | C4 | AR | AM | FW | RC | EP | RL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-002 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-003 | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | pendente R3 | ok | ok |
| TC-004 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | — | pendente R1 | pendente R1 | pendente R1 | pendente R1 |
| TC-005 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-006 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-007 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-009 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-010 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-011 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-012 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-013 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-014 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-015 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-016 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-017 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-018 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-019 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-020 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-021 | B4 pendente R4 | B4 pendente R4 | B4 pendente R4 | B1 B4 pendente R4 | B1 B4 pendente R4 | B1 pendente R4 | B4 pendente R4 | B1 pendente R4 | B4 pendente R4 | B1 pendente R4 | B4 pendente R3 pendente R4 | B4 pendente R4 | B4 pendente R4 |
| TC-022 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-023 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-024 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | — | pendente R1 | pendente R1 pendente R3 | pendente R1 | pendente R1 |
| TC-025 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-026 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-027 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | — | pendente R1 | pendente R1 pendente R3 | pendente R1 | pendente R1 |
| TC-038 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 | pendente R5 |
| TC-039 | ok | ok | ok | ok | ok | ok | ok | ok | ok | ok | pendente R3 pendente R4 | ok | ok |
| TC-040 | K1 | pendente R4 | K1 | B8 | B1 pendente R4 | B1 pendente R4 | pendente R4 | B8 pendente R1 pendente R4 | — | B8 pendente R1 pendente R4 | pendente R3 pendente R4 | pendente R4 | pendente R4 |
| TC-041 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-042 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-043 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-044 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-045 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-046 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-047 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-048 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | pendente R1 | — | pendente R1 | pendente R1 pendente R3 | pendente R1 | pendente R1 |
| TC-049 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 | — | pendente R1 pendente R4 | pendente R1 pendente R3 pendente R4 | pendente R1 pendente R4 | pendente R1 pendente R4 |
| TC-062 | pendente R4 | pendente R4 | pendente R4 | B8 | B1 pendente R4 | B1 pendente R4 | pendente R4 | B8 pendente R1 pendente R4 | pendente R1 pendente R4 | B8 pendente R1 pendente R4 | pendente R3 pendente R4 | pendente R4 | pendente R4 |

## Resumo por TC

| TC | Cenário | PA (ORDEM-PARCIAIS-ANTES) | CA (ORDEM-CLIENTE-ANTES) | ME (ORDEM-MESMO-EVENTTIME) | C1 (CAMINHO-1-PAC-SEM-IDCLIENTE-E-PENDENCIA) | C2 (CAMINHO-2-PAC-COM-IDCLIENTE-DA-JORNADA-E-PENDENCIA) | C3 (CAMINHO-3-PENDENCIA-ANTES-DA-PAC) | C4 (CAMINHO-4-CONTESTACAO-PENDENTE) | AR (APROVACAO-REAL-PESSOA-NOVA) | AM (APROVACAO-REAL-PESSOA-EXISTENTE) | FW (FALHA-E-REPETICAO-DO-WEBJOB) | RC (RELOGIO-DO-CREDITO) | EP (ECO-ANTES-DO-PARCIAL) | RL (REPOSTAGEM-EM-LOTE) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-002 | CPF, e-mail e celular divergentes | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-005 | Account Y existente, Lead Y ausente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-006 | Account Y e Lead Y órfão existentes | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-007 | Contatos de Y pertencem ao Lead Z | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-009 | Account Y incompleta e Lead Y existente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-010 | Colisão apenas de e-mail | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-011 | Colisão apenas de celular | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-012 | Fallback por e-mail em Lead sem CPF | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-013 | Fallback por celular em Lead sem CPF | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-016 | Y inexistente e colisão total | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-017 | Y inexistente; celular colide | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-018 | Y inexistente; e-mail colide | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-020 | Account Y só com CPF; nenhum Lead | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-021 | Account Y com prospect divergente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-022 | Account Y incompleta e Lead Y órfão | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-023 | Account Y inexistente e Lead Y órfão | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-024 | Lead Y preso a outra Account | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-026 | Dois Leads Y; reutilizar o livre | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-027 | Todos os Leads Y estão presos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-041 | Venda Genérica com colisão total | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-042 | Venda Genérica; e-mail colide | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-043 | Venda Genérica; celular colide | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-048 | Lead Y preso com compatibilidade total | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-062 | Account Y com IdCliente e sem IdProspect | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |

## Divergências e erros

### TC-001 — CPF divergente com os mesmos contatos

**PA** (`TC001-PA-581272`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ejsOYAQ"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-pa-581272@example.com","celular 31986163658","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"eaff915f-6a6d-46bc-92cb-9dcf0214c78f","depois":"152771e5-cd17-49f0-b1bd-cdd451b720e1"},{"campo":"CPF__pc","antes":"15234045820","depois":"29733533785"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15234045820","depois":"29733533785"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-PA-581272","depois":"UNIF22 TC001 CLIENTE Y TC001-PA-581272"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"eaff915f-6a6d-46bc-92cb-9dcf0214c78f","depois":"152771e5-cd17-49f0-b1bd-cdd451b720e1"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:21:50.000+0000","depois":"2026-10-21T…`

**CA** (`TC001-CA-ac35d2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9mpYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-ca-ac35d2@example.com","celular 31988256357","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c90e868f-5bc3-4b3e-823e-e87c0964dea7","depois":"ce6f656b-677f-4c41-8ba5-98c3a17a7bfa"},{"campo":"CPF__pc","antes":"02173502409","depois":"51550431587"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"02173502409","depois":"51550431587"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-CA-ac35d2","depois":"UNIF22 TC001 CLIENTE Y TC001-CA-ac35d2"}]`

**ME** (`TC001-ME-13f92e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9TPYAY"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-me-13f92e@example.com","celular 31981023557","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"423326f9-1cd3-41b7-90b4-dd19abdc2c08","depois":"75cd3af1-5319-403b-8d44-e600cd039934"},{"campo":"CPF__pc","antes":"63516065354","depois":"17140233110"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"63516065354","depois":"17140233110"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-ME-13f92e","depois":"UNIF22 TC001 CLIENTE Y TC001-ME-13f92e"}]`

**C1** (`TC001-C1-ab9b1c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f93eYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-c1-ab9b1c@example.com","celular 31989193938","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b8acea62-a529-41d9-b385-9cbd75b327aa","depois":"2476093f-663a-45b9-a54f-2bc15eff4d2f"},{"campo":"CPF__pc","antes":"50315813369","depois":"51502490684"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"50315813369","depois":"51502490684"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-C1-ab9b1c","depois":"UNIF22 TC001 CLIENTE Y TC001-C1-ab9b1c"}]`

**C2** (`TC001-C2-475459`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ey09YAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-c2-475459@example.com","celular 31985782775","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"44cb7360-ff21-4554-9070-5178d8f78b24","depois":"c6825942-8441-41ff-9d95-f2cc9e844985"},{"campo":"CPF__pc","antes":"93785331320","depois":"17827029892"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"93785331320","depois":"17827029892"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-C2-475459","depois":"UNIF22 TC001 CLIENTE Y TC001-C2-475459"}]`

**C3** (`TC001-C3-7c66c5`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fAHMYA2"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-c3-7c66c5@example.com","celular 31988561280","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c804b9d8-ca59-4cb6-a62e-97d5071889df","depois":"d59f127f-4a7f-43c9-857a-314cc2e0c36d"},{"campo":"CPF__pc","antes":"05481342278","depois":"38511982477"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"05481342278","depois":"38511982477"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-C3-7c66c5","depois":"UNIF22 TC001 CLIENTE Y TC001-C3-7c66c5"}]`

**C4** (`TC001-C4-9a1827`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enzFYAQ"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-c4-9a1827@example.com","celular 31982065126","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8394328f-c75e-4160-a147-5fb9702ae090","depois":"94ec8a12-6c16-45e9-80ba-7f099e5c5966"},{"campo":"CPF__pc","antes":"71412200709","depois":"02335280830"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"71412200709","depois":"02335280830"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-C4-9a1827","depois":"UNIF22 TC001 CLIENTE Y TC001-C4-9a1827"}]`

**AR** (`TC001-AR-a31107`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9ZqYAI"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-ar-a31107@example.com","celular 31981680928","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c3d10c2a-73cd-4d51-9b39-ab04074dd507","depois":"6e70057c-db6b-4c2f-93d2-5432319777de"},{"campo":"CPF__pc","antes":"74312227268","depois":"20980331684"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"74312227268","depois":"20980331684"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-AR-a31107","depois":"UNIF22 TC001 CLIENTE Y TC001-AR-a31107"}]`

**FW** (`TC001-FW-663619`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f1waYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-fw-663619@example.com","celular 31985348389","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d4903cb5-490c-4b24-9d32-757b89545980","depois":"9ca8c43e-4864-456a-ab0e-f2618b8d653a"},{"campo":"CPF__pc","antes":"95353237765","depois":"11280336587"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"95353237765","depois":"11280336587"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-FW-663619","depois":"UNIF22 TC001 CLIENTE Y TC001-FW-663619"}]`

**RC** (`TC001-RC-70dc14`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLKnYAM"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.atrasado.tc001-rc-70dc14@example.com","celular 31985091631","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"4e36e7f1-f043-4df1-9b9f-8b4ac632cf92","depois":"e5ed6e5b-e65d-482c-9f7d-14136dba34a4"},{"campo":"CPF__pc","antes":"20526558326","depois":"28843904132"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"20526558326","depois":"28843904132"},{"campo":"Email","antes":"qa.unif22.tc001.a.tc001-rc-70dc14@example.com","depois":"qa.unif22.tc001.atrasado.tc001-rc-70dc14@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc001.atrasado.tc001-rc-70dc14@example.com","celular":"31985091631"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc001.atrasado.tc001-rc-70dc14@example.com","marcador":"2026-10-21T00:24:40.000+0000"}`

**EP** (`TC001-EP-bb02fb`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013exx4YAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-ep-bb02fb@example.com","celular 31982978791","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"0c76400d-a6e0-4a50-bbe4-daee2fc4ae48","depois":"7619e61c-c328-4f52-a9d7-5507b6b829cd"},{"campo":"CPF__pc","antes":"16543000988","depois":"06588152108"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"16543000988","depois":"06588152108"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-EP-bb02fb","depois":"UNIF22 TC001 CLIENTE Y TC001-EP-bb02fb"}]`

**RL** (`TC001-RL-a6ddc0`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9oLYAQ"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc001.a.tc001-rl-a6ddc0@example.com","celular 31984322332","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"5119bdc7-8cf6-459c-bcd8-7ec1ffdc91b7","depois":"4a96cb2d-7d4e-4ce5-9b8e-0d69c3279fd4"},{"campo":"CPF__pc","antes":"35457315371","depois":"56522409208"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"35457315371","depois":"56522409208"},{"campo":"LastName","antes":"UNIF22 TC001 CLIENTE X TC001-RL-a6ddc0","depois":"UNIF22 TC001 CLIENTE Y TC001-RL-a6ddc0"}]`

### TC-002 — CPF, e-mail e celular divergentes

**PA** (`TC002-PA-f6d551`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013emogYAA"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"f6d3cdd4-827f-4bd1-ad82-800f1753cfe1","depois":"0d3bc5d3-a388-4f28-b2fd-69e5199894a5"},{"campo":"CPF__pc","antes":"16665842150","depois":"23034535260"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"16665842150","depois":"23034535260"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-pa-f6d551@example.com","depois":"qa.unif22.tc002.c.tc002-pa-f6d551@example.com"},{"campo":"MobilePhone","…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"f6d3cdd4-827f-4bd1-ad82-800f1753cfe1","depois":"0d3bc5d3-a388-4f28-b2fd-69e5199894a5"},{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-pa-f6d551@example.com","depois":"qa.unif22.tc002.c…`

**CA** (`TC002-CA-1e71a1`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f1J2YAI"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"ab118685-4adc-4ff0-9e5e-9c338c148067","depois":"5bcfc2f0-cdd0-40d6-a084-80af6bfefbf0"},{"campo":"CPF__pc","antes":"92330652275","depois":"38354400395"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"92330652275","depois":"38354400395"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-ca-1e71a1@example.com","depois":"qa.unif22.tc002.c.tc002-ca-1e71a1@example.com"},{"campo":"MobilePhone","…`

**ME** (`TC002-ME-d3cb67`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fA9QYAU"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cabae8b3-3270-49f4-a1c5-5857a6373f8d","depois":"ee03b990-68bb-4cb3-93fa-2a14787e38f7"},{"campo":"CPF__pc","antes":"13510044177","depois":"14383584403"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"13510044177","depois":"14383584403"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-me-d3cb67@example.com","depois":"qa.unif22.tc002.c.tc002-me-d3cb67@example.com"},{"campo":"MobilePhone","…`

**C1** (`TC002-C1-2d23fe`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f23IYAQ"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"4b7028eb-f56b-4c6b-9154-38dc6dd6956d","depois":"db6ac983-a878-4bca-bf2f-2c6f3f9086fb"},{"campo":"CPF__pc","antes":"25303182398","depois":"34130724207"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"25303182398","depois":"34130724207"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c1-2d23fe@example.com","depois":"qa.unif22.tc002.c.tc002-c1-2d23fe@example.com"},{"campo":"MobilePhone","…`

**C2** (`TC002-C2-137dd4`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCStYAM"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cf4caf74-ce40-4913-9a9d-be79bc0368ab","depois":"84ddc81e-3fc1-4a5f-bb10-e7fe0c0c27a5"},{"campo":"CPF__pc","antes":"08201110315","depois":"85405840424"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"08201110315","depois":"85405840424"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c2-137dd4@example.com","depois":"qa.unif22.tc002.c.tc002-c2-137dd4@example.com"},{"campo":"MobilePhone","…`

**C3** (`TC002-C3-70ed3c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezfWYAQ"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"de8c5b5f-b9a1-4564-8702-ea8ab47eecde","depois":"76c2f05c-435f-43ac-a538-cca5e26522bc"},{"campo":"CPF__pc","antes":"21005250006","depois":"49191104300"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"21005250006","depois":"49191104300"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c3-70ed3c@example.com","depois":"qa.unif22.tc002.c.tc002-c3-70ed3c@example.com"},{"campo":"MobilePhone","…`

**C4** (`TC002-C4-590c9d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiztYAA"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"728c8c23-4362-45b0-847c-a36216259827","depois":"f98ca461-fbb3-4ff1-ae3b-0f1fad721216"},{"campo":"CPF__pc","antes":"51083223135","depois":"05331549101"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"51083223135","depois":"05331549101"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c4-590c9d@example.com","depois":"qa.unif22.tc002.c.tc002-c4-590c9d@example.com"},{"campo":"MobilePhone","…`

**AR** (`TC002-AR-188c63`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013erZ4YAI"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"7d036ab8-563d-4042-b181-da2ec8725d1d","depois":"123fac05-1092-4b0b-b852-c2121025ac67"},{"campo":"CPF__pc","antes":"12495050972","depois":"34076260880"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"12495050972","depois":"34076260880"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-ar-188c63@example.com","depois":"qa.unif22.tc002.c.tc002-ar-188c63@example.com"},{"campo":"MobilePhone","…`

**FW** (`TC002-FW-6fecaa`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013emiFYAQ"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"ad167b57-c84a-454b-83be-3a6ff8afb95c","depois":"fb82f3bf-1a4c-48b1-bc18-5d1e3378307a"},{"campo":"CPF__pc","antes":"49905306242","depois":"50344140237"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"49905306242","depois":"50344140237"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-fw-6fecaa@example.com","depois":"qa.unif22.tc002.c.tc002-fw-6fecaa@example.com"},{"campo":"MobilePhone","…`

**RC** (`TC002-RC-ae7102`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezU9YAI"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc002.atrasado.tc002-rc-ae7102@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8840ba68-b99b-4310-a194-a275e0bd653d","depois":"14fdb26c-0c07-4e88-8e91-a1c92b85344e"},{"campo":"CPF__pc","antes":"10431025070","depois":"03651012069"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"10431025070","depois":"03651012069"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-rc-ae7102@example.com","depois":"qa.unif22.tc002.atrasado.tc002-rc-ae7102@example.com"},{"campo":"MobileP…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc002.atrasado.tc002-rc-ae7102@example.com","celular":"31974042508"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc002.atrasado.tc002-rc-ae7102@example.com","marcador":"2026-10-21T00:25:45.000+0000"}`

**EP** (`TC002-EP-06d93d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enkgYAA"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"de2d3f5d-7121-441b-8407-f85892eefdeb","depois":"45319ed3-8f74-4dcf-a292-330df489b6e3"},{"campo":"CPF__pc","antes":"10712816909","depois":"70050853538"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"10712816909","depois":"70050853538"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-ep-06d93d@example.com","depois":"qa.unif22.tc002.c.tc002-ep-06d93d@example.com"},{"campo":"MobilePhone","…`

**RL** (`TC002-RL-2fd985`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eoNRYAY"}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"da60e110-4cf7-4d38-be27-58019226788a","depois":"a6a4087b-1f18-4ed4-ad3e-957ca78933e9"},{"campo":"CPF__pc","antes":"98030259107","depois":"31081213167"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"98030259107","depois":"31081213167"},{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-rl-2fd985@example.com","depois":"qa.unif22.tc002.c.tc002-rl-2fd985@example.com"},{"campo":"MobilePhone","…`

### TC-003 — Match com dados idênticos

**RC** (`TC003-RC-a62785`, ❌ diverge):

- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc003.atrasado.tc003-rc-a62785@example.com","celular":"31982851177"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc003.atrasado.tc003-rc-a62785@example.com","marcador":"2026-10-21T00:27:08.000+0000"}`

### TC-004 — Jornada sem CPF e PAC inclui CPF

**PA** (`TC004-PA-642170`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: cebed587-a3f3-4914-8c…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: cebed587-a3f3-4914-8c…`

**CA** (`TC004-CA-567649`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 6afc66af-8ea9-46ef-95…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 6afc66af-8ea9-46ef-95…`

**ME** (`TC004-ME-e47edb`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 1bece753-f6d8-426f-8d…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 1bece753-f6d8-426f-8d…`

**C1** (`TC004-C1-35c4f6`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 056b32ff-4cbc-4ecb-82…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 056b32ff-4cbc-4ecb-82…`

**C2** (`TC004-C2-f234f9`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 3ffd6f62-d1f8-4225-8d…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 3ffd6f62-d1f8-4225-8d…`

**C3** (`TC004-C3-551174`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 4e638667-94a7-4ced-95…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 4e638667-94a7-4ced-95…`

**C4** (`TC004-C4-282ad6`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 1b6cfba5-1fd4-4af8-a0…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 1b6cfba5-1fd4-4af8-a0…`

**AR** (`TC004-AR-8eff87`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: f133cc37-1919-4647-aa…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: f133cc37-1919-4647-aa…`

**FW** (`TC004-FW-3dd546`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 27f799fb-a922-48bb-85…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 27f799fb-a922-48bb-85…`

**RC** (`TC004-RC-f1dfe0`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 40f8e172-7f1d-445c-9c…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 40f8e172-7f1d-445c-9c…`

**EP** (`TC004-EP-88ec99`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 4360c980-f9ca-4916-af…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 4360c980-f9ca-4916-af…`

**RL** (`TC004-RL-3c31e6`, ❌ diverge):

- Erro: pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 46dfd459-e031-41da-95…
- Todos os eventos responderam HTTP 200: `pac-insert-x respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: 46dfd459-e031-41da-95…`

### TC-005 — Account Y existente, Lead Y ausente

**PA** (`TC005-PA-2e4dca`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9jWYAQ; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9jWYAQ; first error: DUPLICATE_VAL…`

**CA** (`TC005-CA-f2837d`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9jXYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9jXYAQ; first error: DUPLICATE_VA…`

**ME** (`TC005-ME-88ffb2`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCG2YAM; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCG2YAM; first error: DUPLICATE_VAL…`

**C1** (`TC005-C1-c8de6c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eznWYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eznWYAQ; first error: DUPLICATE_VA…`

**C2** (`TC005-C2-1dfa14`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eV3iYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eV3iYAE; first error: DUPLICATE_VA…`

**C3** (`TC005-C3-8f19cb`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewxxYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewxxYAA; first error: DUPLICATE_VA…`

**C4** (`TC005-C4-7d117a`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezArYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezArYAI; first error: DUPLICATE_VA…`

**AR** (`TC005-AR-532c4a`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLEQYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLEQYA2; first error: DUPLICATE_VA…`

**AM** (`TC005-AM-73bbe5`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9mtYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9mtYAA; first error: DUPLICATE_VA…`

**FW** (`TC005-FW-fff785`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ex7YYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ex7YYAQ; first error: DUPLICATE_VA…`

**RC** (`TC005-RC-203ce8`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLmDYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLmDYAU; first error: DUPLICATE_VA…`

**EP** (`TC005-EP-d09e41`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fAkOYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fAkOYAU; first error: DUPLICATE_VA…`

**RL** (`TC005-RL-f9a646`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBmwYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBmwYAE; first error: DUPLICATE_VA…`

### TC-006 — Account Y e Lead Y órfão existentes

**PA** (`TC006-PA-eb52c7`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLXjYAM; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLXjYAM; first error: DUPLICATE_VAL…`

**CA** (`TC006-CA-14d2d3`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLeAYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLeAYAU; first error: DUPLICATE_VA…`

**ME** (`TC006-ME-2e7136`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ekQJYAY; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ekQJYAY; first error: DUPLICATE_VAL…`

**C1** (`TC006-C1-7da6b5`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8OUYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8OUYAY; first error: DUPLICATE_VA…`

**C2** (`TC006-C2-2d9549`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8M8YAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8M8YAI; first error: DUPLICATE_VA…`

**C3** (`TC006-C3-c31511`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013el9aYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013el9aYAA; first error: DUPLICATE_VA…`

**C4** (`TC006-C4-40fb00`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en4iYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en4iYAA; first error: DUPLICATE_VA…`

**AR** (`TC006-AR-b9fa0e`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCxbYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCxbYAE; first error: DUPLICATE_VA…`

**AM** (`TC006-AM-e35556`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013efKAYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013efKAYAY; first error: DUPLICATE_VA…`

**FW** (`TC006-FW-412ff5`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eiZlYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eiZlYAI; first error: DUPLICATE_VA…`

**RC** (`TC006-RC-382271`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ez1DYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ez1DYAQ; first error: DUPLICATE_VA…`

**EP** (`TC006-EP-6ab9e1`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejcDYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejcDYAQ; first error: DUPLICATE_VA…`

**RL** (`TC006-RL-26beb4`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9jYYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9jYYAQ; first error: DUPLICATE_VA…`

### TC-007 — Contatos de Y pertencem ao Lead Z

**PA** (`TC007-PA-3114c5`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fM2LYAU; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fM2LYAU; first error: DUPLICATE_VAL…`

**CA** (`TC007-CA-c557c0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLUXYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLUXYA2; first error: DUPLICATE_VA…`

**ME** (`TC007-ME-f90a5f`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9TRYAY; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9TRYAY; first error: DUPLICATE_VAL…`

**C1** (`TC007-C1-db5000`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8IpYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8IpYAI; first error: DUPLICATE_VA…`

**C2** (`TC007-C2-f16775`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoKeYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoKeYAI; first error: DUPLICATE_VA…`

**C3** (`TC007-C3-4fbd01`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejPSYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejPSYAY; first error: DUPLICATE_VA…`

**C4** (`TC007-C4-f4df2a`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0oPYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0oPYAQ; first error: DUPLICATE_VA…`

**AR** (`TC007-AR-6699eb`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eztuYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eztuYAA; first error: DUPLICATE_VA…`

**AM** (`TC007-AM-24cdad`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eo49YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eo49YAA; first error: DUPLICATE_VA…`

**FW** (`TC007-FW-16526c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBa3YAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBa3YAE; first error: DUPLICATE_VA…`

**RC** (`TC007-RC-aa41b7`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ex5nYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ex5nYAA; first error: DUPLICATE_VA…`

**EP** (`TC007-EP-7a4f6f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fM7BYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fM7BYAU; first error: DUPLICATE_VA…`

**RL** (`TC007-RL-0ff937`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBa4YAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBa4YAE; first error: DUPLICATE_VA…`

### TC-009 — Account Y incompleta e Lead Y existente

**PA** (`TC009-PA-dd6ff0`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ejCbYAI","obtido":"001HZ000013enEUYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDrEZ2A0 ≠ leadY 00QHZ00000dDjXI2A0"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013enEUYAY","Id__c":"21399a42-63ac-44b2-b349-5e2f0f95513b"},{"Id":"001HZ000013ejCbYAI","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDrEZ2A0","Id__c":"21998746-82e7-4484-9c30-7057ff1150a7"},{"Id":"00QHZ00000dDjXI2A0","Id__c":"4ba83872-7631-4e24-a5da-6907849a7f55"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"4538802f-4441-44bd-b96f-d82bf2a89d3d","depois":"21399a42-63ac-44b2-b349-5e2f0f95513b"},{"campo":"CPF__pc","antes":"71594105057","depois":"57197106044"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"71594105057","depois":"57197106044"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-PA-dd6ff0","depois":"UNIF22 TC009 CLIENTE Y TC009-PA-dd6ff0"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"4538802f-4441-44bd-b96f-d82bf2a89d3d","depois":"21399a42-63ac-44b2-b349-5e2f0f95513b"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:28:01.000+0000","depois":"2026-10-21T…`

**CA** (`TC009-CA-6a008a`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f1pBYAQ","obtido":"001HZ000013ejMFYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDtGL2A0 ≠ leadY 00QHZ00000dDjAd2AK"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ejMFYAY","Id__c":"f4d47332-c6c1-423f-9f0d-ce484c4c7213"},{"Id":"001HZ000013f1pBYAQ","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDtGL2A0","Id__c":"46287e33-259a-404d-9e93-4bd37510da73"},{"Id":"00QHZ00000dDjAd2AK","Id__c":"c2060848-08fb-4027-a754-0924df491cda"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"ad1a896f-bfc4-4cda-a84b-d459a332b21e","depois":"f4d47332-c6c1-423f-9f0d-ce484c4c7213"},{"campo":"CPF__pc","antes":"22355450099","depois":"42610901208"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"22355450099","depois":"42610901208"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-CA-6a008a","depois":"UNIF22 TC009 CLIENTE Y TC009-CA-6a008a"}]`

**ME** (`TC009-ME-2fb908`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ehyoYAA","obtido":"001HZ000013elkXYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDtGM2A0 ≠ leadY 00QHZ00000dDqQa2AK"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013elkXYAQ","Id__c":"8e9f7934-5ab7-446f-9ea9-f24b15bf16c2"},{"Id":"001HZ000013ehyoYAA","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDtGM2A0","Id__c":"edc08dc6-da8e-4e75-8fd0-49c09b5ca4f3"},{"Id":"00QHZ00000dDqQa2AK","Id__c":"b22208cf-d80e-446d-8395-a4badc2c49b0"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"a54e9ab0-e14e-4e9c-be4d-95f07688ff2e","depois":"8e9f7934-5ab7-446f-9ea9-f24b15bf16c2"},{"campo":"CPF__pc","antes":"42046121724","depois":"01562454501"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"42046121724","depois":"01562454501"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-ME-2fb908","depois":"UNIF22 TC009 CLIENTE Y TC009-ME-2fb908"}]`

**C1** (`TC009-C1-b2f539`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ezacYAA","obtido":"001HZ000013ez7WYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDrPr2AK ≠ leadY 00QHZ00000dDeSh2AK"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ez7WYAQ","Id__c":"1ff88930-0fd8-445d-bfd9-253467a5d450"},{"Id":"001HZ000013ezacYAA","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDrPr2AK","Id__c":"21680dea-3de4-47d1-8aca-c59a4df69f32"},{"Id":"00QHZ00000dDeSh2AK","Id__c":"d534a5bc-3a98-4573-afe3-ec7c2b78baed"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"55a32a2d-37c4-42f5-8987-ea69500775fd","depois":"1ff88930-0fd8-445d-bfd9-253467a5d450"},{"campo":"CPF__pc","antes":"92179612214","depois":"18500445114"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"92179612214","depois":"18500445114"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-C1-b2f539","depois":"UNIF22 TC009 CLIENTE Y TC009-C1-b2f539"}]`

**C2** (`TC009-C2-bda8bf`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013eznZYAQ","obtido":"001HZ000013emIXYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDevf2AC ≠ leadY 00QHZ00000dDf8b2AC"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013emIXYAY","Id__c":"1a106821-8e97-4837-b9b4-d72a656efd56"},{"Id":"001HZ000013eznZYAQ","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDevf2AC","Id__c":"2c0f97c7-8425-404e-ac65-133221bca1f0"},{"Id":"00QHZ00000dDf8b2AC","Id__c":"b34f039d-b573-41d7-a4cb-addfe09fb118"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"42c0c5ec-577d-414a-9892-619c9518cc9b","depois":"1a106821-8e97-4837-b9b4-d72a656efd56"},{"campo":"CPF__pc","antes":"75653221058","depois":"64823274270"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"75653221058","depois":"64823274270"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-C2-bda8bf","depois":"UNIF22 TC009 CLIENTE Y TC009-C2-bda8bf"}]`

**C3** (`TC009-C3-0be6a6`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ekABYAY","obtido":"001HZ000013eyI5YAI"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDn7r2AC ≠ leadY 00QHZ00000dDikq2AC"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013eyI5YAI","Id__c":"acaa0326-0566-424b-b333-b2eb83dc3a7b"},{"Id":"001HZ000013ekABYAY","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDn7r2AC","Id__c":"858d5931-756f-48b4-a183-5431c464eaed"},{"Id":"00QHZ00000dDikq2AC","Id__c":"bb0524c8-376b-4072-8f35-cf264067eb8f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"677163ed-f836-4a2d-ae65-f2bfd57e7bc3","depois":"acaa0326-0566-424b-b333-b2eb83dc3a7b"},{"campo":"CPF__pc","antes":"81306483344","depois":"48541526992"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"81306483344","depois":"48541526992"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-C3-0be6a6","depois":"UNIF22 TC009 CLIENTE Y TC009-C3-0be6a6"}]`

**C4** (`TC009-C4-9f3fdf`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013eoQrYAI","obtido":"001HZ000013ezlqYAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDfmz2AC ≠ leadY 00QHZ00000dDdv22AC"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ezlqYAA","Id__c":"cf9b74f1-78b7-48da-b920-9021510f765d"},{"Id":"001HZ000013eoQrYAI","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDfmz2AC","Id__c":"344f2737-6596-477c-87f0-503f581ca7c2"},{"Id":"00QHZ00000dDdv22AC","Id__c":"cdcec287-62c5-4f67-b376-45136171ec49"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"0124ec73-4ab1-4e7f-a163-429b210a49d8","depois":"cf9b74f1-78b7-48da-b920-9021510f765d"},{"campo":"CPF__pc","antes":"13294235003","depois":"75430205303"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"13294235003","depois":"75430205303"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-C4-9f3fdf","depois":"UNIF22 TC009 CLIENTE Y TC009-C4-9f3fdf"}]`

**AR** (`TC009-AR-5e7f45`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013el81YAA","obtido":"001HZ000013ei3PYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDtFO2A0 ≠ leadY 00QHZ00000dDq5g2AC"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ei3PYAQ","Id__c":"ed3bf5de-4ee4-4311-a949-b07a2cfcad5d"},{"Id":"001HZ000013el81YAA","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDtFO2A0","Id__c":"a1400beb-004b-434b-b7f0-f351e99d9fa4"},{"Id":"00QHZ00000dDq5g2AC","Id__c":"1b47727d-2135-4641-94ee-8aba28f698de"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"8287b859-38a9-47dc-9ba7-7e28fb0f131f","depois":"ed3bf5de-4ee4-4311-a949-b07a2cfcad5d"},{"campo":"CPF__pc","antes":"21449328245","depois":"00080741436"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"21449328245","depois":"00080741436"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-AR-5e7f45","depois":"UNIF22 TC009 CLIENTE Y TC009-AR-5e7f45"}]`

**FW** (`TC009-FW-c6520b`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f9LTYAY","obtido":"001HZ000013ezIkYAI"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDsVa2AK ≠ leadY 00QHZ00000dDkQH2A0"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ezIkYAI","Id__c":"425f1222-7fb6-494c-b0be-af15c4a810b5"},{"Id":"001HZ000013f9LTYAY","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDsVa2AK","Id__c":"782a6331-6f7f-45c2-b2cb-50c5b1a8b132"},{"Id":"00QHZ00000dDkQH2A0","Id__c":"740c3bfd-1758-4010-bcc4-9488cf149422"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"5c97a5f0-6e4f-4427-a7d8-3b1bb7c847bb","depois":"425f1222-7fb6-494c-b0be-af15c4a810b5"},{"campo":"CPF__pc","antes":"82072130433","depois":"12632058520"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"82072130433","depois":"12632058520"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-FW-c6520b","depois":"UNIF22 TC009 CLIENTE Y TC009-FW-c6520b"}]`

**RC** (`TC009-RC-dec1a1`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f7THYAY","obtido":"001HZ000013f0rZYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDmxm2AC ≠ leadY 00QHZ00000dDqVR2A0"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013f0rZYAQ","Id__c":"5052012c-67f5-4943-989a-c7e6c7d734ef"},{"Id":"001HZ000013f7THYAY","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDmxm2AC","Id__c":"a1139062-1b0a-41d7-8179-33796ea94576"},{"Id":"00QHZ00000dDqVR2A0","Id__c":"b1406a72-5117-40fe-8108-189588d329e0"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"38f8974d-2578-4fe1-a625-724e42129dc1","depois":"5052012c-67f5-4943-989a-c7e6c7d734ef"},{"campo":"CPF__pc","antes":"99401710309","depois":"50217596045"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"99401710309","depois":"50217596045"},{"campo":"Email","antes":"qa.unif22.tc009.a.tc009-rc-dec1a1@example.com","depois":"qa.unif22.tc009.atrasado.tc009-rc-dec1a1@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc009.atrasado.tc009-rc-dec1a1@example.com","celular":"31988242610"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc009.atrasado.tc009-rc-dec1a1@example.com","marcador":"2026-10-21T00:31:10.000+0000"}`

**EP** (`TC009-EP-316f49`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013emGxYAI","obtido":"001HZ000013fDITYA2"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDoQN2A0 ≠ leadY 00QHZ00000dDq0l2AC"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fDITYA2","Id__c":"64447598-1e3c-4202-8d61-055dd72a2768"},{"Id":"001HZ000013emGxYAI","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDoQN2A0","Id__c":"cd96aad3-ea0a-4682-9ae6-03c85a2cf13b"},{"Id":"00QHZ00000dDq0l2AC","Id__c":"6e31416b-653f-47ef-b0fd-898a1c20ff22"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"1b7221f7-2be8-41d5-89f5-0b0320b047bd","depois":"64447598-1e3c-4202-8d61-055dd72a2768"},{"campo":"CPF__pc","antes":"96300311244","depois":"87325575238"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"96300311244","depois":"87325575238"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-EP-316f49","depois":"UNIF22 TC009 CLIENTE Y TC009-EP-316f49"}]`

**RL** (`TC009-RL-ba5b46`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ezlrYAA","obtido":"001HZ000013elkYYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDkoH2AS ≠ leadY 00QHZ00000dDesd2AC"]`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013elkYYAQ","Id__c":"697b9b07-3526-4854-b492-a5b0f3e7e8b7"},{"Id":"001HZ000013ezlrYAA","Id__c":null}]}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkoH2AS","Id__c":"932e5b34-ec66-45ce-8a61-76cbe6dc26ed"},{"Id":"00QHZ00000dDesd2AC","Id__c":"eaddd035-be16-499a-bd89-cdfce06bc2e7"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"edb30fc5-27ba-4d98-98bf-1855dfed7361","depois":"697b9b07-3526-4854-b492-a5b0f3e7e8b7"},{"campo":"CPF__pc","antes":"26649101915","depois":"31350143804"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"26649101915","depois":"31350143804"},{"campo":"LastName","antes":"UNIF22 TC009 CLIENTE X TC009-RL-ba5b46","depois":"UNIF22 TC009 CLIENTE Y TC009-RL-ba5b46"}]`

### TC-010 — Colisão apenas de e-mail

**PA** (`TC010-PA-3fa5dc`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewcpYAA; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewcpYAA; first error: DUPLICATE_VAL…`

**CA** (`TC010-CA-3feb00`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMNJYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMNJYA2; first error: DUPLICATE_VA…`

**ME** (`TC010-ME-6078fb`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ehsDYAQ; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ehsDYAQ; first error: DUPLICATE_VAL…`

**C1** (`TC010-C1-b8bd91`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8u2YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8u2YAA; first error: DUPLICATE_VA…`

**C2** (`TC010-C2-2f22ca`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013efWyYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013efWyYAI; first error: DUPLICATE_VA…`

**C3** (`TC010-C3-1f87c9`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBLYYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBLYYA2; first error: DUPLICATE_VA…`

**C4** (`TC010-C4-364bf0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejxJYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejxJYAQ; first error: DUPLICATE_VA…`

**AR** (`TC010-AR-7275d2`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMTlYAM; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMTlYAM; first error: DUPLICATE_VA…`

**AM** (`TC010-AM-210bfc`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ekc4YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ekc4YAA; first error: DUPLICATE_VA…`

**FW** (`TC010-FW-06f123`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9LVYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9LVYAY; first error: DUPLICATE_VA…`

**RC** (`TC010-RC-fc7fea`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013enjQYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013enjQYAQ; first error: DUPLICATE_VA…`

**EP** (`TC010-EP-2541ff`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMWzYAM; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMWzYAM; first error: DUPLICATE_VA…`

**RL** (`TC010-RL-998690`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7kwYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7kwYAA; first error: DUPLICATE_VA…`

### TC-011 — Colisão apenas de celular

**PA** (`TC011-PA-d41688`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezUAYAY; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezUAYAY; first error: DUPLICATE_VAL…`

**CA** (`TC011-CA-c50a6f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7TLYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7TLYAY; first error: DUPLICATE_VA…`

**ME** (`TC011-ME-655f3d`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLhOYAU; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLhOYAU; first error: DUPLICATE_VAL…`

**C1** (`TC011-C1-92f1cb`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1wdYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1wdYAA; first error: DUPLICATE_VA…`

**C2** (`TC011-C2-d0bdfa`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezSWYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezSWYAY; first error: DUPLICATE_VA…`

**C3** (`TC011-C3-1e767e`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoQsYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoQsYAI; first error: DUPLICATE_VA…`

**C4** (`TC011-C4-d1828b`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eiRlYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eiRlYAI; first error: DUPLICATE_VA…`

**AR** (`TC011-AR-3fd08f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMjtYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMjtYAE; first error: DUPLICATE_VA…`

**AM** (`TC011-AM-5b4a82`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f82mYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f82mYAA; first error: DUPLICATE_VA…`

**FW** (`TC011-FW-b088e3`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMqLYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMqLYAU; first error: DUPLICATE_VA…`

**RC** (`TC011-RC-e9d1d0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fAe6YAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fAe6YAE; first error: DUPLICATE_VA…`

**EP** (`TC011-EP-ee045a`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoPJYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoPJYAY; first error: DUPLICATE_VA…`

**RL** (`TC011-RL-fd6457`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013exZyYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013exZyYAI; first error: DUPLICATE_VA…`

### TC-012 — Fallback por e-mail em Lead sem CPF

_Observação:_ O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.

**PA** (`TC012-PA-9b13e2`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLj4YAE; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLj4YAE; first error: DUPLICATE_VAL…`

**CA** (`TC012-CA-0a5512`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013exnCYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013exnCYAQ; first error: DUPLICATE_VA…`

**ME** (`TC012-ME-6c2dbb`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMvCYAU; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMvCYAU; first error: DUPLICATE_VAL…`

**C1** (`TC012-C1-ce8759`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0GbYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0GbYAI; first error: DUPLICATE_VA…`

**C2** (`TC012-C2-411b54`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCT0YAM; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCT0YAM; first error: DUPLICATE_VA…`

**C3** (`TC012-C3-58b23a`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ehTsYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ehTsYAI; first error: DUPLICATE_VA…`

**C4** (`TC012-C4-5b2c35`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9DQYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f9DQYAY; first error: DUPLICATE_VA…`

**AR** (`TC012-AR-4c3777`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1MRYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1MRYAY; first error: DUPLICATE_VA…`

**AM** (`TC012-AM-075325`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7jRYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7jRYAQ; first error: DUPLICATE_VA…`

**FW** (`TC012-FW-3d01cb`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0oRYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0oRYAQ; first error: DUPLICATE_VA…`

**RC** (`TC012-RC-ad86b0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013elKoYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013elKoYAI; first error: DUPLICATE_VA…`

**EP** (`TC012-EP-8ec52e`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fN4sYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fN4sYAE; first error: DUPLICATE_VA…`

**RL** (`TC012-RL-84ce3b`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ehguYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ehguYAA; first error: DUPLICATE_VA…`

### TC-013 — Fallback por celular em Lead sem CPF

**PA** (`TC013-PA-f88afd`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMVPYA2; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMVPYA2; first error: DUPLICATE_VAL…`

**CA** (`TC013-CA-9a8817`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fIRCYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fIRCYA2; first error: DUPLICATE_VA…`

**ME** (`TC013-ME-c1a0ae`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fA9SYAU; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fA9SYAU; first error: DUPLICATE_VAL…`

**C1** (`TC013-C1-85d580`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1J6YAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1J6YAI; first error: DUPLICATE_VA…`

**C2** (`TC013-C2-8b684f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLpSYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLpSYAU; first error: DUPLICATE_VA…`

**C3** (`TC013-C3-35f0a0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewy1YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewy1YAA; first error: DUPLICATE_VA…`

**C4** (`TC013-C4-47e85f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013dUsbYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013dUsbYAE; first error: DUPLICATE_VA…`

**AR** (`TC013-AR-90618c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013elMQYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013elMQYAY; first error: DUPLICATE_VA…`

**AM** (`TC013-AM-ef96b1`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fNBKYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fNBKYA2; first error: DUPLICATE_VA…`

**FW** (`TC013-FW-9197d4`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ec1GYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ec1GYAQ; first error: DUPLICATE_VA…`

**RC** (`TC013-RC-44ddee`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ej6fYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ej6fYAA; first error: DUPLICATE_VA…`

**EP** (`TC013-EP-1ee403`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejOCYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejOCYAY; first error: DUPLICATE_VA…`

**RL** (`TC013-RL-becc1f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013emexYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013emexYAA; first error: DUPLICATE_VA…`

### TC-014 — Sem compatibilidade; IdCliente em minúsculas

_Observação:_ IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.

**PA** (`TC014-PA-56bce5`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f93iYAA; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f93iYAA; first error: DUPLICATE_VAL…`

**CA** (`TC014-CA-6bab98`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fNBLYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fNBLYA2; first error: DUPLICATE_VA…`

**ME** (`TC014-ME-b31155`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCXfYAM; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCXfYAM; first error: DUPLICATE_VAL…`

**C1** (`TC014-C1-02c587`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyt0YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyt0YAA; first error: DUPLICATE_VA…`

**C2** (`TC014-C2-a8482d`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en1gYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en1gYAA; first error: DUPLICATE_VA…`

**C3** (`TC014-C3-5eea02`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en4lYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en4lYAA; first error: DUPLICATE_VA…`

**C4** (`TC014-C4-76e536`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013enEWYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013enEWYAY; first error: DUPLICATE_VA…`

**AR** (`TC014-AR-08361c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fDaDYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fDaDYAU; first error: DUPLICATE_VA…`

**AM** (`TC014-AM-b2a9c8`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLr5YAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLr5YAE; first error: DUPLICATE_VA…`

**FW** (`TC014-FW-296e18`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fNODYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fNODYA2; first error: DUPLICATE_VA…`

**RC** (`TC014-RC-538d6e`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fDIVYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fDIVYA2; first error: DUPLICATE_VA…`

**EP** (`TC014-EP-37b2c1`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f2NDYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f2NDYAY; first error: DUPLICATE_VA…`

**RL** (`TC014-RL-62a2ec`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1imYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1imYAA; first error: DUPLICATE_VA…`

### TC-015 — Sem compatibilidade; IdCliente em maiúsculas

_Observação:_ IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.

**PA** (`TC015-PA-874f88`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCpPYAU; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fCpPYAU; first error: DUPLICATE_VAL…`

**CA** (`TC015-CA-fbda33`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLr6YAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLr6YAE; first error: DUPLICATE_VA…`

**ME** (`TC015-ME-900142`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en1iYAA; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en1iYAA; first error: DUPLICATE_VAL…`

**C1** (`TC015-C1-c119ae`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fAaqYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fAaqYAE; first error: DUPLICATE_VA…`

**C2** (`TC015-C2-2fc0e4`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ei3SYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ei3SYAQ; first error: DUPLICATE_VA…`

**C3** (`TC015-C3-4605b0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ej1FYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ej1FYAQ; first error: DUPLICATE_VA…`

**C4** (`TC015-C4-79792e`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013emIaYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013emIaYAI; first error: DUPLICATE_VA…`

**AR** (`TC015-AR-a15ce0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eymXYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eymXYAQ; first error: DUPLICATE_VA…`

**AM** (`TC015-AM-d42880`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezCNYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezCNYAY; first error: DUPLICATE_VA…`

**FW** (`TC015-FW-557d49`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMwqYAE; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMwqYAE; first error: DUPLICATE_VA…`

**RC** (`TC015-RC-247cbd`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejFmYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejFmYAI; first error: DUPLICATE_VA…`

**EP** (`TC015-EP-0ed6d3`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLpTYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLpTYAU; first error: DUPLICATE_VA…`

**RL** (`TC015-RL-dfc875`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMaFYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMaFYAU; first error: DUPLICATE_VA…`

### TC-016 — Y inexistente e colisão total

**PA** (`TC016-PA-6a3e2f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCKqYAM"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-pa-6a3e2f@example.com","celular 31982769230","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"72e35d80-304a-4003-a34f-8f906daf77a8","depois":"a4eb5e0f-c591-4034-aa09-543a1b4fce87"},{"campo":"CPF__pc","antes":"52053440082","depois":"03493544995"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"52053440082","depois":"03493544995"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-PA-6a3e2f","depois":"UNIF22 TC016 CLIENTE Y TC016-PA-6a3e2f"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"72e35d80-304a-4003-a34f-8f906daf77a8","depois":"a4eb5e0f-c591-4034-aa09-543a1b4fce87"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:33:35.000+0000","depois":"2026-10-21T…`

**CA** (`TC016-CA-365695`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ekwgYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-ca-365695@example.com","celular 31985966526","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"38898630-2df0-4794-9360-60afb42bc1cd","depois":"a2e5708c-dbdb-4856-924a-08711fb14dd7"},{"campo":"CPF__pc","antes":"44842344911","depois":"34431174494"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"44842344911","depois":"34431174494"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-CA-365695","depois":"UNIF22 TC016 CLIENTE Y TC016-CA-365695"}]`

**ME** (`TC016-ME-570cdb`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enUmYAI"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-me-570cdb@example.com","celular 31988933663","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"904c6305-8a6f-47e2-98cc-8741e3f2c73b","depois":"b75fa270-353b-47d0-a426-151ef423c586"},{"campo":"CPF__pc","antes":"49833563716","depois":"88181316800"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"49833563716","depois":"88181316800"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-ME-570cdb","depois":"UNIF22 TC016 CLIENTE Y TC016-ME-570cdb"}]`

**C1** (`TC016-C1-386dc4`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f8qdYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-c1-386dc4@example.com","celular 31984375195","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"a6c3acf4-5289-43aa-9156-4fbfac029fd8","depois":"94ecfb67-d265-4a0a-b9c2-cdcba6e578f9"},{"campo":"CPF__pc","antes":"62934280055","depois":"42510061275"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"62934280055","depois":"42510061275"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-C1-386dc4","depois":"UNIF22 TC016 CLIENTE Y TC016-C1-386dc4"}]`

**C2** (`TC016-C2-770550`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMbuYAE"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-c2-770550@example.com","celular 31987275238","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cbe0eba9-fcfd-480f-aa71-6ac9bfae0c3b","depois":"a2f45177-1d97-4410-9f58-776234ed8715"},{"campo":"CPF__pc","antes":"80161637698","depois":"57731032817"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"80161637698","depois":"57731032817"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-C2-770550","depois":"UNIF22 TC016 CLIENTE Y TC016-C2-770550"}]`

**C3** (`TC016-C3-6c6e16`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eodcYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-c3-6c6e16@example.com","celular 31986827483","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"341fc3db-b981-43d8-9de1-42430dbfbd8e","depois":"f1be51f5-2059-4aa1-b2d0-540f57aca938"},{"campo":"CPF__pc","antes":"54781020674","depois":"10643720588"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"54781020674","depois":"10643720588"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-C3-6c6e16","depois":"UNIF22 TC016 CLIENTE Y TC016-C3-6c6e16"}]`

**C4** (`TC016-C4-149aac`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f0oSYAQ"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-c4-149aac@example.com","celular 31984875453","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"aa991dcd-1c5c-4823-9952-dad05d750141","depois":"586baab8-81ec-43a6-b962-7cb17a290198"},{"campo":"CPF__pc","antes":"03450721704","depois":"60023113510"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"03450721704","depois":"60023113510"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-C4-149aac","depois":"UNIF22 TC016 CLIENTE Y TC016-C4-149aac"}]`

**AR** (`TC016-AR-3c0f84`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLSyYAM"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-ar-3c0f84@example.com","celular 31984141522","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"72523682-39c6-4f3b-8dc6-3cf5d0ae30a6","depois":"eb5150b3-b341-4d1d-a62f-2790bbec7b69"},{"campo":"CPF__pc","antes":"23112620410","depois":"23082243550"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23112620410","depois":"23082243550"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-AR-3c0f84","depois":"UNIF22 TC016 CLIENTE Y TC016-AR-3c0f84"}]`

**FW** (`TC016-FW-6e5e2b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezcBYAQ"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-fw-6e5e2b@example.com","celular 31989634308","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d2fee105-0f0c-4eea-8d77-42654023f364","depois":"ec5724d8-ddef-41ab-8038-eb39526c47ff"},{"campo":"CPF__pc","antes":"12282224019","depois":"89383651407"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"12282224019","depois":"89383651407"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-FW-6e5e2b","depois":"UNIF22 TC016 CLIENTE Y TC016-FW-6e5e2b"}]`

**RC** (`TC016-RC-32943d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ejFnYAI"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.atrasado.tc016-rc-32943d@example.com","celular 31984150250","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"37ceb20f-03f3-4d31-82e4-3cb9e9591526","depois":"0192bda6-cd44-4104-8a42-ab623ce0fb1a"},{"campo":"CPF__pc","antes":"09130213002","depois":"42828497542"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"09130213002","depois":"42828497542"},{"campo":"Email","antes":"qa.unif22.tc016.a.tc016-rc-32943d@example.com","depois":"qa.unif22.tc016.atrasado.tc016-rc-32943d@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc016.atrasado.tc016-rc-32943d@example.com","celular":"31984150250"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc016.atrasado.tc016-rc-32943d@example.com","marcador":"2026-10-21T00:36:38.000+0000"}`

**EP** (`TC016-EP-cac0be`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCXhYAM"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-ep-cac0be@example.com","celular 31982346242","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"040f2fd0-e5ee-4563-ae76-a864676a152d","depois":"6ac0c428-1206-4fbe-a7b4-1cb0c1a41ff4"},{"campo":"CPF__pc","antes":"35555621850","depois":"62406921310"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"35555621850","depois":"62406921310"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-EP-cac0be","depois":"UNIF22 TC016 CLIENTE Y TC016-EP-cac0be"}]`

**RL** (`TC016-RL-3a9bbd`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fBQSYA2"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc016.a.tc016-rl-3a9bbd@example.com","celular 31985789428","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cec0f5b0-ca1f-457e-a5ab-eb5ce87e0d1a","depois":"5a66632e-6a2e-4164-b75f-5039f3dc6839"},{"campo":"CPF__pc","antes":"34236175517","depois":"32488016381"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"34236175517","depois":"32488016381"},{"campo":"LastName","antes":"UNIF22 TC016 CLIENTE X TC016-RL-3a9bbd","depois":"UNIF22 TC016 CLIENTE Y TC016-RL-3a9bbd"}]`

### TC-017 — Y inexistente; celular colide

**PA** (`TC017-PA-4b604f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f1qpYAA"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31989123320"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8e994544-4b82-4abc-940b-618b364433a6","depois":"f0a740f0-8951-4ead-af6a-fc1bcf33006c"},{"campo":"CPF__pc","antes":"11451923350","depois":"34652324103"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"11451923350","depois":"34652324103"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-pa-4b604f@example.com","depois":"qa.unif22.tc017.c.tc017-pa-4b604f@example.com"},{"campo":"LastName","ant…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"8e994544-4b82-4abc-940b-618b364433a6","depois":"f0a740f0-8951-4ead-af6a-fc1bcf33006c"},{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-pa-4b604f@example.com","depois":"qa.unif22.tc017.c…`

**CA** (`TC017-CA-e3c174`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013efjwYAA"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31982255300"]`
- Account X intacta: `[{"campo":"Id__c","antes":"336a4b21-ea05-43dd-a4db-a971019e810d","depois":"3e15152e-94ee-44da-8767-74b8167a6753"},{"campo":"CPF__pc","antes":"00132015064","depois":"52025881002"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"00132015064","depois":"52025881002"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-ca-e3c174@example.com","depois":"qa.unif22.tc017.c.tc017-ca-e3c174@example.com"},{"campo":"LastName","ant…`

**ME** (`TC017-ME-790372`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eorTYAQ"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31984539657"]`
- Account X intacta: `[{"campo":"Id__c","antes":"84ff2c2b-81ef-4460-9bba-601d272c41b2","depois":"46788391-a20a-45ca-b211-374cc7126c1d"},{"campo":"CPF__pc","antes":"31915030056","depois":"74385655138"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"31915030056","depois":"74385655138"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-me-790372@example.com","depois":"qa.unif22.tc017.c.tc017-me-790372@example.com"},{"campo":"LastName","ant…`

**C1** (`TC017-C1-bd9f19`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fDQXYA2"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31985792694"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b1ad7dc7-d6e0-44f5-9f79-64b2604ce642","depois":"a6fdb94d-6a83-48a2-a97f-7ff0829b4c88"},{"campo":"CPF__pc","antes":"53423152397","depois":"36345574864"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"53423152397","depois":"36345574864"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c1-bd9f19@example.com","depois":"qa.unif22.tc017.c.tc017-c1-bd9f19@example.com"},{"campo":"LastName","ant…`

**C2** (`TC017-C2-bc5759`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9tIYAQ"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31984855762"]`
- Account X intacta: `[{"campo":"Id__c","antes":"32298bca-210a-4b1a-b5ee-0143e8ada62f","depois":"e62354bb-0790-41a4-87e1-6ba4424ab1a9"},{"campo":"CPF__pc","antes":"68347345031","depois":"51093479809"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"68347345031","depois":"51093479809"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c2-bc5759@example.com","depois":"qa.unif22.tc017.c.tc017-c2-bc5759@example.com"},{"campo":"LastName","ant…`

**C3** (`TC017-C3-b6ab0b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezlsYAA"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31983439502"]`
- Account X intacta: `[{"campo":"Id__c","antes":"fc1d4031-bb1e-4756-a96a-0b4be17b5023","depois":"5923722b-1cf8-4e55-ae08-83f1e22c2d4b"},{"campo":"CPF__pc","antes":"53867333386","depois":"51450532403"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"53867333386","depois":"51450532403"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c3-b6ab0b@example.com","depois":"qa.unif22.tc017.c.tc017-c3-b6ab0b@example.com"},{"campo":"LastName","ant…`

**C4** (`TC017-C4-6d0191`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013exWhYAI"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31987049102"]`
- Account X intacta: `[{"campo":"Id__c","antes":"655fe32f-df00-4294-99f3-3916a48bcbde","depois":"260d94ec-21df-4bfd-b1d6-7a17c6dfbf14"},{"campo":"CPF__pc","antes":"14964329160","depois":"95100625023"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"14964329160","depois":"95100625023"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c4-6d0191@example.com","depois":"qa.unif22.tc017.c.tc017-c4-6d0191@example.com"},{"campo":"LastName","ant…`

**AR** (`TC017-AR-dcf233`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fNT6YAM"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31987542475"]`
- Account X intacta: `[{"campo":"Id__c","antes":"669d1fb4-9699-4491-a256-0a642e7490ce","depois":"aa2b4f3d-d67c-4bc6-a161-aa334b270c1d"},{"campo":"CPF__pc","antes":"20413803147","depois":"15245003309"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"20413803147","depois":"15245003309"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-ar-dcf233@example.com","depois":"qa.unif22.tc017.c.tc017-ar-dcf233@example.com"},{"campo":"LastName","ant…`

**FW** (`TC017-FW-5d1953`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMwsYAE"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31983450823"]`
- Account X intacta: `[{"campo":"Id__c","antes":"039c2708-1637-4680-8c30-b0011a3dad47","depois":"b698bdcd-9a16-4af9-b200-2a0104fbd5c7"},{"campo":"CPF__pc","antes":"19263590389","depois":"68356498520"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"19263590389","depois":"68356498520"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-fw-5d1953@example.com","depois":"qa.unif22.tc017.c.tc017-fw-5d1953@example.com"},{"campo":"LastName","ant…`

**RC** (`TC017-RC-8be7d0`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eyoBYAQ"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc017.atrasado.tc017-rc-8be7d0@example.com","celular 31988654360"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b16fe3a6-624e-470a-a96f-855b9faf8849","depois":"2272ce4a-e5f1-4ec5-81b1-c70df18eec14"},{"campo":"CPF__pc","antes":"63853332480","depois":"00553868306"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"63853332480","depois":"00553868306"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-rc-8be7d0@example.com","depois":"qa.unif22.tc017.atrasado.tc017-rc-8be7d0@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc017.atrasado.tc017-rc-8be7d0@example.com","celular":"31988654360"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc017.atrasado.tc017-rc-8be7d0@example.com","marcador":"2026-10-21T00:37:44.000+0000"}`

**EP** (`TC017-EP-5cd5bf`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ek71YAA"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31987009829"]`
- Account X intacta: `[{"campo":"Id__c","antes":"a2a28bf6-9492-40ac-9082-1867624d7d15","depois":"4043db19-8598-446c-9ded-f279695988f8"},{"campo":"CPF__pc","antes":"22808525516","depois":"34546248350"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"22808525516","depois":"34546248350"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-ep-5cd5bf@example.com","depois":"qa.unif22.tc017.c.tc017-ep-5cd5bf@example.com"},{"campo":"LastName","ant…`

**RL** (`TC017-RL-7b4066`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLPiYAM"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31981480026"]`
- Account X intacta: `[{"campo":"Id__c","antes":"69306eb1-d9ef-499d-811a-ec929f59de6e","depois":"d3e6ce3d-1bb3-4d51-95c2-968ad9c96059"},{"campo":"CPF__pc","antes":"00486563561","depois":"10529030373"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"00486563561","depois":"10529030373"},{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-rl-7b4066@example.com","depois":"qa.unif22.tc017.c.tc017-rl-7b4066@example.com"},{"campo":"LastName","ant…`

### TC-018 — Y inexistente; e-mail colide

**PA** (`TC018-PA-348eba`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f8sLYAQ"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-pa-348eba@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d23a496c-cf09-4b1f-86bc-208fc27f85c3","depois":"adcf3f76-e81a-4e7b-adf9-4fbb72ab7dc5"},{"campo":"CPF__pc","antes":"14932483597","depois":"34504949377"},{"campo":"Celular__c","antes":"3198284410…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"14932483597","depois":"34504949377"},{"campo":"MobilePhone","antes":"31982844103","depois":"31972844103"},{"campo":"CelularSemFormatacao__c","antes":"31982844103","depois":"31972844103"},{"cam…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"d23a496c-cf09-4b1f-86bc-208fc27f85c3","depois":"adcf3f76-e81a-4e7b-adf9-4fbb72ab7dc5"},{"campo":"Celular__c","antes":"31982844103","depois":"31972844103"},{"campo":"DataAlteracaoEventoContatoEm…`

**CA** (`TC018-CA-2d5538`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMLjYAM"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-ca-2d5538@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"eabb9856-b0f2-46f4-a4b6-818dd028a7a6","depois":"a57d74da-a040-4f75-b0dd-3e8234286431"},{"campo":"CPF__pc","antes":"59441123528","depois":"52912466695"},{"campo":"Celular__c","antes":"3198725687…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"59441123528","depois":"52912466695"},{"campo":"MobilePhone","antes":"31987256875","depois":"31977256875"},{"campo":"CelularSemFormatacao__c","antes":"31987256875","depois":"31977256875"},{"cam…`

**ME** (`TC018-ME-bdfa6b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCW7YAM"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-me-bdfa6b@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"e08ca202-6945-4b39-8619-41fdeae1d446","depois":"b7876e76-1fb0-43a2-8c07-02ff6def17b5"},{"campo":"CPF__pc","antes":"18630410280","depois":"35265044582"},{"campo":"Celular__c","antes":"3198216002…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"18630410280","depois":"35265044582"},{"campo":"MobilePhone","antes":"31982160020","depois":"31972160020"},{"campo":"CelularSemFormatacao__c","antes":"31982160020","depois":"31972160020"},{"cam…`

**C1** (`TC018-C1-d4645e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9YIYAY"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-c1-d4645e@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"687cce39-0bbc-4d48-b50b-e43ddc6c152a","depois":"1a63e06c-b139-4f82-9de6-425c06da06a9"},{"campo":"CPF__pc","antes":"32254435302","depois":"92951450540"},{"campo":"Celular__c","antes":"3198436914…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"32254435302","depois":"92951450540"},{"campo":"MobilePhone","antes":"31984369147","depois":"31974369147"},{"campo":"CelularSemFormatacao__c","antes":"31984369147","depois":"31974369147"},{"cam…`

**C2** (`TC018-C2-311641`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f8IrYAI"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-c2-311641@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"52f4ab00-695f-48bf-8da1-21eb8a34834a","depois":"9a0941a3-8662-45d8-8196-0888508b40dc"},{"campo":"CPF__pc","antes":"20136103782","depois":"01461644585"},{"campo":"Celular__c","antes":"3198875496…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"20136103782","depois":"01461644585"},{"campo":"MobilePhone","antes":"31988754962","depois":"31978754962"},{"campo":"CelularSemFormatacao__c","antes":"31988754962","depois":"31978754962"},{"cam…`

**C3** (`TC018-C3-0ad20a`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMgiYAE"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-c3-0ad20a@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"15b69ec6-592f-4267-a475-961fe297e4e4","depois":"f6eb5bed-fb1a-4753-a865-f21acb155f5b"},{"campo":"CPF__pc","antes":"14370100593","depois":"00733138748"},{"campo":"Celular__c","antes":"3198815827…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"14370100593","depois":"00733138748"},{"campo":"MobilePhone","antes":"31988158274","depois":"31978158274"},{"campo":"CelularSemFormatacao__c","antes":"31988158274","depois":"31978158274"},{"cam…`

**C4** (`TC018-C4-295c8c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013elm8YAA"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-c4-295c8c@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"69705cf4-5b16-4687-aa7e-cecf759301c6","depois":"fd3edac4-23d7-45e7-a6bc-5a3bcd6c0149"},{"campo":"CPF__pc","antes":"46804903811","depois":"20264702352"},{"campo":"Celular__c","antes":"3198451294…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"46804903811","depois":"20264702352"},{"campo":"MobilePhone","antes":"31984512948","depois":"31974512948"},{"campo":"CelularSemFormatacao__c","antes":"31984512948","depois":"31974512948"},{"cam…`

**AR** (`TC018-AR-772b41`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eo4CYAQ"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-ar-772b41@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"13427af2-d01a-4f94-80c1-cb518290a349","depois":"f2b3c103-db5b-45dc-95ca-49a1dc1927c4"},{"campo":"CPF__pc","antes":"25412138403","depois":"21652351973"},{"campo":"Celular__c","antes":"3198928438…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"25412138403","depois":"21652351973"},{"campo":"MobilePhone","antes":"31989284384","depois":"31979284384"},{"campo":"CelularSemFormatacao__c","antes":"31989284384","depois":"31979284384"},{"cam…`

**FW** (`TC018-FW-5bb54e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enuVYAQ"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-fw-5bb54e@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"699ad239-d738-449c-9297-b9fcd067a29e","depois":"c6edb983-fb67-48af-adbe-2e5707c1b3cd"},{"campo":"CPF__pc","antes":"23128576009","depois":"94122504287"},{"campo":"Celular__c","antes":"3198269139…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23128576009","depois":"94122504287"},{"campo":"MobilePhone","antes":"31982691393","depois":"31972691393"},{"campo":"CelularSemFormatacao__c","antes":"31982691393","depois":"31972691393"},{"cam…`

**RC** (`TC018-RC-c5c1c2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMYeYAM"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.atrasado.tc018-rc-c5c1c2@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c460afad-799d-4f67-a8c7-9510f8d71a9e","depois":"6d330459-cb5e-4c89-aa35-892b6b06b238"},{"campo":"CPF__pc","antes":"06233232147","depois":"12344004050"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"06233232147","depois":"12344004050"},{"campo":"Email","antes":"qa.unif22.tc018.a.tc018-rc-c5c1c2@example.com","depois":"qa.unif22.tc018.atrasado.tc018-rc-c5c1c2@example.com"},{"campo":"MobileP…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc018.atrasado.tc018-rc-c5c1c2@example.com","celular":"31976525598"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc018.atrasado.tc018-rc-c5c1c2@example.com","marcador":"2026-10-21T00:38:52.000+0000"}`

**EP** (`TC018-EP-bd1049`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCHYYA2"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-ep-bd1049@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"f729047f-41cf-4f34-bc92-4d2c8bac34fc","depois":"fc5968bc-6edd-4e86-8680-c459d49bea7c"},{"campo":"CPF__pc","antes":"25313418203","depois":"96383042785"},{"campo":"Celular__c","antes":"3198516453…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"25313418203","depois":"96383042785"},{"campo":"MobilePhone","antes":"31985164534","depois":"31975164534"},{"campo":"CelularSemFormatacao__c","antes":"31985164534","depois":"31975164534"},{"cam…`

**RL** (`TC018-RL-d5b0a3`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMjvYAE"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc018.a.tc018-rl-d5b0a3@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"dbc9bd06-4dc5-45cd-806a-43fbbb1dad3e","depois":"613f912b-c407-4435-89a2-369481bc4959"},{"campo":"CPF__pc","antes":"06762000959","depois":"25711277057"},{"campo":"Celular__c","antes":"3198451725…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"06762000959","depois":"25711277057"},{"campo":"MobilePhone","antes":"31984517258","depois":"31974517258"},{"campo":"CelularSemFormatacao__c","antes":"31984517258","depois":"31974517258"},{"cam…`

### TC-019 — Lead Y livre por CPF, contatos diferentes

**PA** (`TC019-PA-a44ec4`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoAaYAI; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eoAaYAI; first error: DUPLICATE_VAL…`

**CA** (`TC019-CA-720eba`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyt3YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyt3YAA; first error: DUPLICATE_VA…`

**ME** (`TC019-ME-0230f0`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1qqYAA; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1qqYAA; first error: DUPLICATE_VAL…`

**C1** (`TC019-C1-299ba1`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013emmzYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013emmzYAA; first error: DUPLICATE_VA…`

**C2** (`TC019-C2-235437`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013enUrYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013enUrYAI; first error: DUPLICATE_VA…`

**C3** (`TC019-C3-3cc1d4`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eztwYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eztwYAA; first error: DUPLICATE_VA…`

**C4** (`TC019-C4-3a8e52`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8PUYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f8PUYAY; first error: DUPLICATE_VA…`

**AR** (`TC019-AR-abc990`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1qrYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1qrYAA; first error: DUPLICATE_VA…`

**AM** (`TC019-AM-8cf19c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7hrYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7hrYAA; first error: DUPLICATE_VA…`

**FW** (`TC019-FW-807e22`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLpZYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLpZYAU; first error: DUPLICATE_VA…`

**RC** (`TC019-RC-4eddb4`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ei0OYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ei0OYAQ; first error: DUPLICATE_VA…`

**EP** (`TC019-EP-ece8ca`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013exWiYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013exWiYAI; first error: DUPLICATE_VA…`

**RL** (`TC019-RL-012710`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fOFRYA2; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fOFRYA2; first error: DUPLICATE_VA…`

### TC-020 — Account Y só com CPF; nenhum Lead

**PA** (`TC020-PA-18364e`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fOFSYA2","obtido":"001HZ000013elKsYAI"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013elKsYAI","Id__c":"c8ff374e-bb2b-4c94-b97c-7a147ac78e1a"},{"Id":"001HZ000013fOFSYA2","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"0477e402-7bfe-4f4e-856e-0e99ed5913ab","depois":"c8ff374e-bb2b-4c94-b97c-7a147ac78e1a"},{"campo":"CPF__pc","antes":"84079631510","depois":"60912358777"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"84079631510","depois":"60912358777"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-pa-18364e@example.com","depois":"qa.unif22.tc020.c.tc020-pa-18364e@example.com"},{"campo":"MobilePhone","…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"0477e402-7bfe-4f4e-856e-0e99ed5913ab","depois":"c8ff374e-bb2b-4c94-b97c-7a147ac78e1a"},{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-pa-18364e@example.com","depois":"qa.unif22.tc020.c…`

**CA** (`TC020-CA-e91f38`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013erZ8YAI","obtido":"001HZ000013enkiYAA"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013enkiYAA","Id__c":"d8b69a73-8732-4cae-a3f9-63b30f040e3e"},{"Id":"001HZ000013erZ8YAI","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8fab4343-963b-4c87-9ec8-40999f5b8f68","depois":"d8b69a73-8732-4cae-a3f9-63b30f040e3e"},{"campo":"CPF__pc","antes":"88271517538","depois":"72075324409"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"88271517538","depois":"72075324409"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-ca-e91f38@example.com","depois":"qa.unif22.tc020.c.tc020-ca-e91f38@example.com"},{"campo":"MobilePhone","…`

**ME** (`TC020-ME-c59ffc`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013elfpYAA","obtido":"001HZ000013eyd8YAA"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013eyd8YAA","Id__c":"2df8a1fb-e721-4506-bfec-807b2d92299b"},{"Id":"001HZ000013elfpYAA","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"507c9f8e-da22-4397-aca2-94ee6b993ab9","depois":"2df8a1fb-e721-4506-bfec-807b2d92299b"},{"campo":"CPF__pc","antes":"26711623592","depois":"14043683456"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"26711623592","depois":"14043683456"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-me-c59ffc@example.com","depois":"qa.unif22.tc020.c.tc020-me-c59ffc@example.com"},{"campo":"MobilePhone","…`

**C1** (`TC020-C1-016a15`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ehE3YAI","obtido":"001HZ000013ez63YAA"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ez63YAA","Id__c":"5f2d7ea0-dada-4385-81bc-d0a3988cec13"},{"Id":"001HZ000013ehE3YAI","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"5bea2ba4-d5ae-417b-bf41-9f7eb4759d5e","depois":"5f2d7ea0-dada-4385-81bc-d0a3988cec13"},{"campo":"CPF__pc","antes":"50688325530","depois":"50443020230"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"50688325530","depois":"50443020230"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c1-016a15@example.com","depois":"qa.unif22.tc020.c.tc020-c1-016a15@example.com"},{"campo":"MobilePhone","…`

**C2** (`TC020-C2-1091c5`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013en4mYAA","obtido":"001HZ000013ewg6YAA"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ewg6YAA","Id__c":"6882d6fb-7d43-4e3f-baba-2b0ffa5bcabd"},{"Id":"001HZ000013en4mYAA","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"4105becc-42d3-4e43-8d54-ece596210b0e","depois":"6882d6fb-7d43-4e3f-baba-2b0ffa5bcabd"},{"campo":"CPF__pc","antes":"84223157426","depois":"39771067915"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"84223157426","depois":"39771067915"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c2-1091c5@example.com","depois":"qa.unif22.tc020.c.tc020-c2-1091c5@example.com"},{"campo":"MobilePhone","…`

**C3** (`TC020-C3-b6634e`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fOH3YAM","obtido":"001HZ000013eo2aYAA"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013eo2aYAA","Id__c":"ae0f87fc-218f-4a81-8b77-69d05a507de8"},{"Id":"001HZ000013fOH3YAM","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8bbcaece-15b3-4d3a-8f16-85bb5b4a90d1","depois":"ae0f87fc-218f-4a81-8b77-69d05a507de8"},{"campo":"CPF__pc","antes":"40010141499","depois":"82576464076"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"40010141499","depois":"82576464076"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c3-b6634e@example.com","depois":"qa.unif22.tc020.c.tc020-c3-b6634e@example.com"},{"campo":"MobilePhone","…`

**C4** (`TC020-C4-61f4c8`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013eo5sYAA","obtido":"001HZ000013ejxLYAQ"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ejxLYAQ","Id__c":"fbbb291f-1c9e-4430-a31d-0482c6b5b5c4"},{"Id":"001HZ000013eo5sYAA","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"e30742f8-baa2-4ebf-a28c-71d5c5084682","depois":"fbbb291f-1c9e-4430-a31d-0482c6b5b5c4"},{"campo":"CPF__pc","antes":"52215193808","depois":"18311231346"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"52215193808","depois":"18311231346"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c4-61f4c8@example.com","depois":"qa.unif22.tc020.c.tc020-c4-61f4c8@example.com"},{"campo":"MobilePhone","…`

**AR** (`TC020-AR-25acb3`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fNEYYA2","obtido":"001HZ000013eju7YAA"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013eju7YAA","Id__c":"6251164d-790b-4ae3-9212-a26f06e8c2ab"},{"Id":"001HZ000013fNEYYA2","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8e4d3166-769e-4c18-aa9d-b95eb198f00e","depois":"6251164d-790b-4ae3-9212-a26f06e8c2ab"},{"campo":"CPF__pc","antes":"95433225208","depois":"02926128347"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"95433225208","depois":"02926128347"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-ar-25acb3@example.com","depois":"qa.unif22.tc020.c.tc020-ar-25acb3@example.com"},{"campo":"MobilePhone","…`

**FW** (`TC020-FW-53fd58`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f0ICYAY","obtido":"001HZ000013fMVSYA2"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fMVSYA2","Id__c":"cb02b86c-1049-455a-9c10-310c6124f979"},{"Id":"001HZ000013f0ICYAY","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"ab4889b7-6a28-453f-9a6c-6a643aa88893","depois":"cb02b86c-1049-455a-9c10-310c6124f979"},{"campo":"CPF__pc","antes":"86720152904","depois":"62465187376"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"86720152904","depois":"62465187376"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-fw-53fd58@example.com","depois":"qa.unif22.tc020.c.tc020-fw-53fd58@example.com"},{"campo":"MobilePhone","…`

**RC** (`TC020-RC-a66d2c`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fAJ8YAM","obtido":"001HZ000013fNb8YAE"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fNb8YAE","Id__c":"a76b7780-b5dc-4a95-88a6-419e0d14cde8"},{"Id":"001HZ000013fAJ8YAM","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc020.atrasado.tc020-rc-a66d2c@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8663655e-804a-4bdc-9d70-6fd6db28dd96","depois":"a76b7780-b5dc-4a95-88a6-419e0d14cde8"},{"campo":"CPF__pc","antes":"76284422504","depois":"02775332609"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"76284422504","depois":"02775332609"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-rc-a66d2c@example.com","depois":"qa.unif22.tc020.atrasado.tc020-rc-a66d2c@example.com"},{"campo":"MobileP…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc020.atrasado.tc020-rc-a66d2c@example.com","celular":"31977942035"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc020.atrasado.tc020-rc-a66d2c@example.com","marcador":"2026-10-21T00:40:54.000+0000"}`

**EP** (`TC020-EP-024115`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013enjaYAA","obtido":"001HZ000013fOQjYAM"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fOQjYAM","Id__c":"4ffa7418-6cc6-4807-b06c-8cb74fb8ba24"},{"Id":"001HZ000013enjaYAA","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"eb68577f-7234-48fc-9795-1ca8a7902c6e","depois":"4ffa7418-6cc6-4807-b06c-8cb74fb8ba24"},{"campo":"CPF__pc","antes":"44101248206","depois":"70436780720"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"44101248206","depois":"70436780720"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-ep-024115@example.com","depois":"qa.unif22.tc020.c.tc020-ep-024115@example.com"},{"campo":"MobilePhone","…`

**RL** (`TC020-RL-5f42b0`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fMDfYAM","obtido":"001HZ000013fDFLYA2"}`
- 1 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fDFLYA2","Id__c":"b5fbeb54-da7c-4cc6-a5c4-e2c9ce146b21"},{"Id":"001HZ000013fMDfYAM","Id__c":null}]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"Id__c","antes":"6bbcef69-b363-4bfc-b57f-2630987c4f26","depois":"b5fbeb54-da7c-4cc6-a5c4-e2c9ce146b21"},{"campo":"CPF__pc","antes":"27070344368","depois":"25012191803"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"27070344368","depois":"25012191803"},{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-rl-5f42b0@example.com","depois":"qa.unif22.tc020.c.tc020-rl-5f42b0@example.com"},{"campo":"MobilePhone","…`

### TC-021 — Account Y com prospect divergente

**PA** (`TC021-PA-e48256`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"34883540596","depois":"42141614325"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-pa-e48256@example.com","depois":"qa.unif22.tc021.c.tc021-pa-e48256@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c 9abebf0b-0b86-481c-9bfd-025adca10039"]`

**CA** (`TC021-CA-5f03da`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"07133901668","depois":"06514748090"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ca-5f03da@example.com","depois":"qa.unif22.tc021.c.tc021-ca-5f03da@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c c6e89cbf-ad83-4fcb-addb-decedbc4b706"]`

**ME** (`TC021-ME-d1697f`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"35190972062","depois":"71056753145"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-me-d1697f@example.com","depois":"qa.unif22.tc021.c.tc021-me-d1697f@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c ed8662ed-85c9-4073-8181-f169d7ca0f0a"]`

**C1** (`TC021-C1-3a3d57`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"54425932900","depois":"05623160271"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c1-3a3d57@example.com","depois":"qa.unif22.tc021.c.tc021-c1-3a3d57@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c1-3a3d57@example.com","depois":"qa.unif22.tc021.c.tc021-c1-3a3d57@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c 1fda2e44-f1ce-4bcf-8417-82d59d2a34f9"]`

**C2** (`TC021-C2-700862`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"43843338116","depois":"15657527321"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c2-700862@example.com","depois":"qa.unif22.tc021.c.tc021-c2-700862@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c2-700862@example.com","depois":"qa.unif22.tc021.c.tc021-c2-700862@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c 57b7b4d4-1c51-40a2-9b25-c566dabd5112"]`

**C3** (`TC021-C3-02a57f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 13222733406","e-mail qa.unif22.tc021.e.tc021-c3-02a57f@example.com","celular 31957233473"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c3-02a57f@example.com","depois":"qa.unif22.tc021.c.tc021-c3-02a57f@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-21T00:41:28.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c3-02a57f@example.com","depois":"qa.unif22.tc021.c.tc021-c3-02a57f@example.com"}]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c bbffe0d5-85fc-4afa-a9c7-64a48ba5ace7"]`

**C4** (`TC021-C4-575698`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"70820055395","depois":"09203430741"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c4-575698@example.com","depois":"qa.unif22.tc021.c.tc021-c4-575698@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c d757509d-e138-4c40-87d1-bd9ae4ab9261"]`

**AR** (`TC021-AR-0beb43`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 02634226586","e-mail qa.unif22.tc021.e.tc021-ar-0beb43@example.com","celular 31958055900"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-ar-0beb43@example.com","depois":"qa.unif22.tc021.c.tc021-ar-0beb43@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-ar-0beb43@example.com","depois":"qa.unif22.tc021.c.tc021-ar-0beb43@example.com"}]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c 62652823-9142-40ff-a6da-6afaf17dda88"]`

**AM** (`TC021-AM-7cc600`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"89022540200","depois":"21264548605"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-am-7cc600@example.com","depois":"qa.unif22.tc021.c.tc021-am-7cc600@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c be72ce04-5fad-40fd-ac95-13b2b96e9719"]`

**FW** (`TC021-FW-2331e1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 45152028808","e-mail qa.unif22.tc021.e.tc021-fw-2331e1@example.com","celular 31953348996"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-fw-2331e1@example.com","depois":"qa.unif22.tc021.c.tc021-fw-2331e1@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-fw-2331e1@example.com","depois":"qa.unif22.tc021.c.tc021-fw-2331e1@example.com"}]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c b66611ac-bd66-4df5-a33f-50639dffd0eb"]`

**RC** (`TC021-RC-73c0f5`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"32315444675","depois":"11140487558"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-rc-73c0f5@example.com","depois":"qa.unif22.tc021.atrasado.tc021-rc-73c0f5@example.com"},{"campo":"MobileP…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc021.atrasado.tc021-rc-73c0f5@example.com"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c d882f0dc-19c5-4d51-b2bb-a19847cb6121"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc021.atrasado.tc021-rc-73c0f5@example.com","celular":"31973916513"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc021.atrasado.tc021-rc-73c0f5@example.com","marcador":"2026-10-21T00:42:01.000+0000"}`

**EP** (`TC021-EP-a33a4c`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"15581816280","depois":"93942131390"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ep-a33a4c@example.com","depois":"qa.unif22.tc021.c.tc021-ep-a33a4c@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c 9056628f-76c0-4abc-b5a3-60d0f9b58366"]`

**RL** (`TC021-RL-d5d87e`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"13757828003","depois":"57392319493"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-rl-d5d87e@example.com","depois":"qa.unif22.tc021.c.tc021-rl-d5d87e@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`
- Proponente principal na Account aprovada com PROS-Y: `["IdProponente__c 2d85216a-17d3-4ab5-baef-7063b9f890fe"]`

### TC-022 — Account Y incompleta e Lead Y órfão

**PA** (`TC022-PA-3fde1a`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fAMGYA2","obtido":"001HZ000013eobvYAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDbJe2AK ≠ leadY 00QHZ00000dDhqP2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDbJe2AK","Id__c":"dc14e653-5df1-4d6b-ba77-45b5266616c6"},{"Id":"00QHZ00000dDhqP2AS","Id__c":"6ca3ca02-8b10-41ac-b9ac-6456105b146d"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"7ca6e487-6bee-4868-bb15-3664b31dd345","depois":"5832ec69-e507-4bcd-888f-cd1713ad90e7"},{"campo":"CPF__pc","antes":"15234827534","depois":"01257445448"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15234827534","depois":"01257445448"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-PA-3fde1a","depois":"UNIF22 TC022 CLIENTE Y TC022-PA-3fde1a"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"7ca6e487-6bee-4868-bb15-3664b31dd345","depois":"5832ec69-e507-4bcd-888f-cd1713ad90e7"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:40:06.000+0000","depois":"2026-10-21T…`

**CA** (`TC022-CA-f7caab`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ejpKYAQ","obtido":"001HZ000013fNo4YAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDima2AC ≠ leadY 00QHZ00000dDtI22AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDima2AC","Id__c":"e5b9f7c2-9eae-495f-87b3-f4962b0fdfce"},{"Id":"00QHZ00000dDtI22AK","Id__c":"e9fe4898-dd22-42a0-af9c-71513d05cbe1"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"4788505a-1ce6-4db5-a359-c4819a6608c3","depois":"e9bcf23e-adc6-464d-b672-9f14a7e62b3c"},{"campo":"CPF__pc","antes":"33476776689","depois":"44702747207"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"33476776689","depois":"44702747207"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-CA-f7caab","depois":"UNIF22 TC022 CLIENTE Y TC022-CA-f7caab"}]`

**ME** (`TC022-ME-a3ae48`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f7gEYAQ","obtido":"001HZ000013eyt9YAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDg802AC ≠ leadY 00QHZ00000dDbzc2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDg802AC","Id__c":"00091e11-1090-4619-90c2-430f347883e3"},{"Id":"00QHZ00000dDbzc2AC","Id__c":"78f167df-91a2-4681-a6dc-4d2482bffefb"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"e05185ac-81dc-458d-aa32-725249d40af3","depois":"5d92d6f9-270d-4eff-a9a6-1414df19da62"},{"campo":"CPF__pc","antes":"63524164382","depois":"74529051803"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"63524164382","depois":"74529051803"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-ME-a3ae48","depois":"UNIF22 TC022 CLIENTE Y TC022-ME-a3ae48"}]`

**C1** (`TC022-C1-02dfe4`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013elKuYAI","obtido":"001HZ000013ej31YAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDoIg2AK ≠ leadY 00QHZ00000dDuFf2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDoIg2AK","Id__c":"c165f3b7-5f60-49a8-9c61-afdf80de88e8"},{"Id":"00QHZ00000dDuFf2AK","Id__c":"61bdf59f-5c91-436f-87fc-5eadaf51b72e"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"63c7392a-3e00-498c-a9bf-96b93f06e49e","depois":"2b74159a-f3ef-4bec-95b9-41a5c3c806cd"},{"campo":"CPF__pc","antes":"01977332129","depois":"65295861058"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"01977332129","depois":"65295861058"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-C1-02dfe4","depois":"UNIF22 TC022 CLIENTE Y TC022-C1-02dfe4"}]`

**C2** (`TC022-C2-d94755`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f1BGYAY","obtido":"001HZ000013elu3YAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDdZt2AK ≠ leadY 00QHZ00000dDvEw2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDdZt2AK","Id__c":"22caab5e-52ba-497d-b660-5fbe755bbc75"},{"Id":"00QHZ00000dDvEw2AK","Id__c":"75dfb25b-e016-4282-944d-4c28b35f2f57"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"df33c103-c5ae-4ff6-a7c4-5756778b9945","depois":"e8043451-0dfa-49f5-afc0-830667950ebb"},{"campo":"CPF__pc","antes":"15030945296","depois":"50870312693"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15030945296","depois":"50870312693"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-C2-d94755","depois":"UNIF22 TC022 CLIENTE Y TC022-C2-d94755"}]`

**C3** (`TC022-C3-a796aa`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f06pYAA","obtido":"001HZ000013fNTAYA2"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDq0n2AC ≠ leadY 00QHZ00000dDXdR2AW"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDq0n2AC","Id__c":"aad639ee-f201-47c9-b5f7-5e5df212a4c8"},{"Id":"00QHZ00000dDXdR2AW","Id__c":"817b1f13-98ec-48a1-897c-c74fcfa82eeb"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"b7841d0c-ae26-44a1-8f72-05de44f0d666","depois":"89eac638-9a50-4f54-bc2e-8ac56925e6a3"},{"campo":"CPF__pc","antes":"03436555436","depois":"44592157214"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"03436555436","depois":"44592157214"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-C3-a796aa","depois":"UNIF22 TC022 CLIENTE Y TC022-C3-a796aa"}]`

**C4** (`TC022-C4-d5791e`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fNMgYAM","obtido":"001HZ000013ezYyYAI"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDipk2AC ≠ leadY 00QHZ00000dDnCa2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDipk2AC","Id__c":"b894b850-0478-4416-91c2-40bf32663c94"},{"Id":"00QHZ00000dDnCa2AK","Id__c":"19788f8e-c928-46f9-acb6-a8efa542bfd8"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"8d66bf3c-9e98-4de7-b9d8-db2622412a4e","depois":"85daac8c-1704-43e9-b88b-f775068f9929"},{"campo":"CPF__pc","antes":"34650980135","depois":"30151754756"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"34650980135","depois":"30151754756"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-C4-d5791e","depois":"UNIF22 TC022 CLIENTE Y TC022-C4-d5791e"}]`

**AR** (`TC022-AR-98a3d5`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f0oVYAQ","obtido":"001HZ000013eknCYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDehD2AS ≠ leadY 00QHZ00000dDnGa2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDehD2AS","Id__c":"6baca7d5-b093-441d-98da-b662bac4dbce"},{"Id":"00QHZ00000dDnGa2AK","Id__c":"ca26c5cd-325f-497c-98eb-71ad4dc8816d"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"744b0667-317c-4aed-87af-c6541c90d6d8","depois":"47e73ef9-d042-4ff0-9dbf-0e12dbea459e"},{"campo":"CPF__pc","antes":"08217401306","depois":"05735418505"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"08217401306","depois":"05735418505"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-AR-98a3d5","depois":"UNIF22 TC022 CLIENTE Y TC022-AR-98a3d5"}]`

**FW** (`TC022-FW-334b62`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fDwHYAU","obtido":"001HZ000013ezUHYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDfbm2AC ≠ leadY 00QHZ00000dDnqv2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDfbm2AC","Id__c":"f5d5940b-da06-4e7d-bb65-11fe0f8794c1"},{"Id":"00QHZ00000dDnqv2AC","Id__c":"b398a5f7-0662-4f78-93f5-a941f58628a0"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"34b12055-8edd-4da7-9f71-53147a7de4cb","depois":"de55f060-05cd-4d0e-baf4-f24695bbda27"},{"campo":"CPF__pc","antes":"48393550297","depois":"30599425954"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"48393550297","depois":"30599425954"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-FW-334b62","depois":"UNIF22 TC022 CLIENTE Y TC022-FW-334b62"}]`

**RC** (`TC022-RC-e38a24`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fDGpYAM","obtido":"001HZ000013fNTBYA2"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDmV32AK ≠ leadY 00QHZ00000dDmJy2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDmV32AK","Id__c":"a9d7d82d-1338-4c57-803b-f08333f8fe0a"},{"Id":"00QHZ00000dDmJy2AK","Id__c":"74a93ba6-e8bf-4897-afeb-c6980a436b0f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"70c13a25-fef9-4588-8438-fc81b155facb","depois":"2165296f-982e-44e3-82d4-04cc1f7dece9"},{"campo":"CPF__pc","antes":"44109706904","depois":"41574722093"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"44109706904","depois":"41574722093"},{"campo":"Email","antes":"qa.unif22.tc022.a.tc022-rc-e38a24@example.com","depois":"qa.unif22.tc022.atrasado.tc022-rc-e38a24@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc022.atrasado.tc022-rc-e38a24@example.com","celular":"31986856094"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc022.atrasado.tc022-rc-e38a24@example.com","marcador":"2026-10-21T00:43:20.000+0000"}`

**EP** (`TC022-EP-f991fb`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f9jcYAA","obtido":"001HZ000013ejxMYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDqou2AC ≠ leadY 00QHZ00000dDghL2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDqou2AC","Id__c":"2f9877dd-24e8-4f18-8a86-0bc170cb85cf"},{"Id":"00QHZ00000dDghL2AS","Id__c":"4eece589-537a-4a12-b4aa-df86b8b1063f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"54d3c0a3-91c9-48d4-8a77-e6da51631675","depois":"65441e6b-d165-478f-9aa6-d43427f82d1f"},{"campo":"CPF__pc","antes":"40261118579","depois":"14095663073"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"40261118579","depois":"14095663073"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-EP-f991fb","depois":"UNIF22 TC022 CLIENTE Y TC022-EP-f991fb"}]`

**RL** (`TC022-RL-26d62a`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fAnnYAE","obtido":"001HZ000013ejz1YAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDvI92AK ≠ leadY 00QHZ00000dDrEe2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDvI92AK","Id__c":"f71be374-4655-45aa-899a-364362632184"},{"Id":"00QHZ00000dDrEe2AK","Id__c":"fccbffb6-cae4-42d7-88e2-3a3e56e17d15"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"13f03724-2895-42fe-ae3f-e732c047bd72","depois":"6470caae-81c5-4937-bbb8-8263ece877d2"},{"campo":"CPF__pc","antes":"23035663122","depois":"73456749406"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23035663122","depois":"73456749406"},{"campo":"LastName","antes":"UNIF22 TC022 CLIENTE X TC022-RL-26d62a","depois":"UNIF22 TC022 CLIENTE Y TC022-RL-26d62a"}]`

### TC-023 — Account Y inexistente e Lead Y órfão

**PA** (`TC023-PA-5f4757`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fOs9YAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDfDV2A0 ≠ leadY 00QHZ00000dDqTs2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDfDV2A0","Id__c":"ee9a8ebd-74dc-40a6-b7dc-817f02c910ab"},{"Id":"00QHZ00000dDqTs2AK","Id__c":"a6314a37-5e50-4672-a334-e0c1427e13c0"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"c93aa56b-8356-4367-bdb5-8f5408b56093","depois":"bf2475de-4a06-41d1-9d08-a9e14c848a97"},{"campo":"CPF__pc","antes":"45402158681","depois":"40569261740"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"45402158681","depois":"40569261740"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-PA-5f4757","depois":"UNIF22 TC023 CLIENTE Y TC023-PA-5f4757"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"c93aa56b-8356-4367-bdb5-8f5408b56093","depois":"bf2475de-4a06-41d1-9d08-a9e14c848a97"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:41:20.000+0000","depois":"2026-10-21T…`

**CA** (`TC023-CA-ef68d5`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezh5YAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDgeF2AS ≠ leadY 00QHZ00000dDnfb2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDgeF2AS","Id__c":"f4877723-a26a-4130-9a28-81af8141e4ae"},{"Id":"00QHZ00000dDnfb2AC","Id__c":"25369f7d-6214-499b-b9bd-72e791940001"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"8d61160d-fd84-42ff-b7cd-553b96fd3e8e","depois":"946ab3b8-8022-4e60-a7d9-41041fb7ebd0"},{"campo":"CPF__pc","antes":"75450210701","depois":"22292180260"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"75450210701","depois":"22292180260"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-CA-ef68d5","depois":"UNIF22 TC023 CLIENTE Y TC023-CA-ef68d5"}]`

**ME** (`TC023-ME-5fa608`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f03kYAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDgEP2A0 ≠ leadY 00QHZ00000dDvMz2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDgEP2A0","Id__c":"8ff62540-13ae-4f9f-bafa-bf5c13b419c9"},{"Id":"00QHZ00000dDvMz2AK","Id__c":"a97f51cb-35a7-4eef-a6b7-7f3fca32e7c6"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"a971b949-a901-4260-91dc-354afa8fecf9","depois":"a989dab7-a398-44d0-9330-74abd1a0607c"},{"campo":"CPF__pc","antes":"92136514490","depois":"17335802202"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"92136514490","depois":"17335802202"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-ME-5fa608","depois":"UNIF22 TC023 CLIENTE Y TC023-ME-5fa608"}]`

**C1** (`TC023-C1-ecedd5`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiNVYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDvQD2A0 ≠ leadY 00QHZ00000dDqX92AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDvQD2A0","Id__c":"fdca8b63-45d0-4a4e-95af-13d8014cf57e"},{"Id":"00QHZ00000dDqX92AK","Id__c":"29f26f24-5e94-4022-829c-5c51afb98532"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"d4b1be0c-de6c-4ffb-870d-2c845a6dbc6b","depois":"b59364b3-3b3c-4e89-8ce3-901774100452"},{"campo":"CPF__pc","antes":"50946406820","depois":"24652455119"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"50946406820","depois":"24652455119"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-C1-ecedd5","depois":"UNIF22 TC023 CLIENTE Y TC023-C1-ecedd5"}]`

**C2** (`TC023-C2-1cad58`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eooNYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDsKJ2A0 ≠ leadY 00QHZ00000dDpcd2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDsKJ2A0","Id__c":"78d5795b-0147-4331-90d7-eb739c4ba748"},{"Id":"00QHZ00000dDpcd2AC","Id__c":"5f89960f-0f5f-44da-ac48-f090a8752eb1"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"8fed44c4-9e07-450e-82fa-41992d5702d1","depois":"a6b76bb0-56e0-4ebd-b6e4-99dd1b0e2597"},{"campo":"CPF__pc","antes":"55032575291","depois":"41022745611"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"55032575291","depois":"41022745611"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-C2-1cad58","depois":"UNIF22 TC023 CLIENTE Y TC023-C2-1cad58"}]`

**C3** (`TC023-C3-f53a9d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fN4DYAU"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDfdM2AS ≠ leadY 00QHZ00000dDqTt2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDfdM2AS","Id__c":"3703da17-bd0e-466d-8814-3576c8a333c8"},{"Id":"00QHZ00000dDqTt2AK","Id__c":"7b01132f-8cac-4d07-bec1-2731334a3c8f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"4b58e796-d8bb-4e02-ab20-29325929cb1e","depois":"9abf647f-c709-4eaf-96ec-ac1b2f4b4de9"},{"campo":"CPF__pc","antes":"40352186267","depois":"52831030137"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"40352186267","depois":"52831030137"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-C3-f53a9d","depois":"UNIF22 TC023 CLIENTE Y TC023-C3-f53a9d"}]`

**C4** (`TC023-C4-4cc10c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fOaQYAU"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDon32AC ≠ leadY 00QHZ00000dDdjp2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDon32AC","Id__c":"669c2efe-93d9-4084-8581-6a9b6f16f5b1"},{"Id":"00QHZ00000dDdjp2AC","Id__c":"0191b941-4a6f-4763-b8cd-2444b243216f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"74b90ad3-f27c-43d2-abe7-2d33abb93160","depois":"7a6dee49-3c8f-459f-8390-76c3c114eb5c"},{"campo":"CPF__pc","antes":"74135763332","depois":"35520134669"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"74135763332","depois":"35520134669"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-C4-4cc10c","depois":"UNIF22 TC023 CLIENTE Y TC023-C4-4cc10c"}]`

**AR** (`TC023-AR-b8dbae`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fBn4YAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDghM2AS ≠ leadY 00QHZ00000dDsnN2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDghM2AS","Id__c":"5e28bf9d-cfaa-446c-aa12-a838a35538f3"},{"Id":"00QHZ00000dDsnN2AS","Id__c":"e5abf864-3922-4c76-95e0-15c7da3c7f1e"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"3b7295bd-47bc-4bcd-98aa-56c72e9a409e","depois":"14ae89fb-75f1-401e-890d-0afee8f6b3e8"},{"campo":"CPF__pc","antes":"64307240421","depois":"20048658146"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"64307240421","depois":"20048658146"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-AR-b8dbae","depois":"UNIF22 TC023 CLIENTE Y TC023-AR-b8dbae"}]`

**FW** (`TC023-FW-a947db`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eo7EYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDnCb2AK ≠ leadY 00QHZ00000dDe4b2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDnCb2AK","Id__c":"ef80f217-0010-449f-9d6c-5334da8c80fc"},{"Id":"00QHZ00000dDe4b2AC","Id__c":"bc1265cb-f285-443d-8afa-0938e45f61cd"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"a20154d6-f3a1-4c39-915f-bad2cbd447b3","depois":"83367b6d-ed4f-4719-b2ff-d3e4992f7489"},{"campo":"CPF__pc","antes":"15914552435","depois":"81364137704"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15914552435","depois":"81364137704"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-FW-a947db","depois":"UNIF22 TC023 CLIENTE Y TC023-FW-a947db"}]`

**RC** (`TC023-RC-3a73b2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ehoxYAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDgHk2AK ≠ leadY 00QHZ00000dDvRp2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDgHk2AK","Id__c":"96ee0730-c7d1-4e9f-ac4f-5d40ecc055e2"},{"Id":"00QHZ00000dDvRp2AK","Id__c":"f99b958d-3792-4813-970b-bacebaef39da"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"c4ef24a2-abdf-40f5-8f48-f9f06ebc697c","depois":"2d6abe0f-c8a7-4daa-947d-88b843ca4902"},{"campo":"CPF__pc","antes":"20950950904","depois":"19342401333"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"20950950904","depois":"19342401333"},{"campo":"Email","antes":"qa.unif22.tc023.a.tc023-rc-3a73b2@example.com","depois":"qa.unif22.tc023.atrasado.tc023-rc-3a73b2@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc023.atrasado.tc023-rc-3a73b2@example.com","celular":"31989772014"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc023.atrasado.tc023-rc-3a73b2@example.com","marcador":"2026-10-21T00:44:40.000+0000"}`

**EP** (`TC023-EP-36844d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eyYDYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDk9z2AC ≠ leadY 00QHZ00000dDe4c2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDk9z2AC","Id__c":"5480892e-c944-4892-90cd-81aa883a1acd"},{"Id":"00QHZ00000dDe4c2AC","Id__c":"f20fcd86-1ab1-4b36-a110-69bdb7a607d9"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"ec5f8d0b-02f8-4902-9285-1ab11d321537","depois":"19bbb4e6-5ba3-47d4-a7d3-7f895468f6ea"},{"campo":"CPF__pc","antes":"49381501408","depois":"28149047018"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"49381501408","depois":"28149047018"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-EP-36844d","depois":"UNIF22 TC023 CLIENTE Y TC023-EP-36844d"}]`

**RL** (`TC023-RL-18a749`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fO91YAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDkI72AK ≠ leadY 00QHZ00000dD6pd2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkI72AK","Id__c":"2994e3f3-8e24-4670-982b-2fd185dab520"},{"Id":"00QHZ00000dD6pd2AC","Id__c":"664e7f3c-1753-401a-b124-6218247a7b53"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"2467cdc0-0aaa-4cdb-a00d-fd91f0255572","depois":"908e4f50-98fe-42e9-b3f3-5f8ec6cd8b74"},{"campo":"CPF__pc","antes":"94913576461","depois":"52464453480"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"94913576461","depois":"52464453480"},{"campo":"LastName","antes":"UNIF22 TC023 CLIENTE X TC023-RL-18a749","depois":"UNIF22 TC023 CLIENTE Y TC023-RL-18a749"}]`

### TC-024 — Lead Y preso a outra Account

**PA** (`TC024-PA-62f289`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013el3CYAQ","obtido":"001HZ000013ezQtYAI"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"2f1c4211-4cb9-4600-b102-a9e9191d987f"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDPtb2AG","Id__c":"2f1c4211-4cb9-4600-b102-a9e9191d987f"},{"Id":"00QHZ00000dDkmn2AC","Id__c":"17ecf1de-66b3-4747-bdc2-db193cca2e01"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"62b41489-f41b-4c9d-a228-90829687556e","depois":"fd966ff6-e583-467a-a3a1-1e706724bb70"},{"campo":"CPF__pc","antes":"97950572191","depois":"94210571717"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"97950572191","depois":"94210571717"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-PA-62f289","depois":"UNIF22 TC024 CLIENTE Y TC024-PA-62f289"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"62b41489-f41b-4c9d-a228-90829687556e","depois":"fd966ff6-e583-467a-a3a1-1e706724bb70"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:42:35.000+0000","depois":"2026-10-21T…`

**CA** (`TC024-CA-c73a44`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f1BJYAY","obtido":"001HZ000013fCpSYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"5497c517-9e3e-4d01-9e98-663e20fd9e02"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDnEF2A0","Id__c":"5497c517-9e3e-4d01-9e98-663e20fd9e02"},{"Id":"00QHZ00000dDssD2AS","Id__c":"f27fe4ec-7877-4cae-9acb-7e9c4c6c6189"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"9d747dca-82ff-4adf-a7ed-0a115dd7b603","depois":"7f4f8462-98c2-4c5f-b480-244fb8580433"},{"campo":"CPF__pc","antes":"36424552049","depois":"03091528103"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"36424552049","depois":"03091528103"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-CA-c73a44","depois":"UNIF22 TC024 CLIENTE Y TC024-CA-c73a44"}]`

**ME** (`TC024-ME-b053ee`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fM5bYAE","obtido":"001HZ000013fMdTYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"61dee781-381f-4cab-9683-de1a677829d7"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDh7R2AS","Id__c":"61dee781-381f-4cab-9683-de1a677829d7"},{"Id":"00QHZ00000dDv0R2AS","Id__c":"b2c98566-18fd-4fd5-8403-1ce301736778"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"7da4967d-16b6-44a0-93bb-b8cde79b312f","depois":"2027101d-349c-4b99-b795-c8a5c9cdf620"},{"campo":"CPF__pc","antes":"21220245500","depois":"98132333705"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"21220245500","depois":"98132333705"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-ME-b053ee","depois":"UNIF22 TC024 CLIENTE Y TC024-ME-b053ee"}]`

**C1** (`TC024-C1-bad8a2`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ezxCYAQ","obtido":"001HZ000013ei58YAA"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"6df1755d-c40c-4ce8-9ffb-47074376dcb4"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDjXK2A0","Id__c":"6df1755d-c40c-4ce8-9ffb-47074376dcb4"},{"Id":"00QHZ00000dDfqJ2AS","Id__c":"92eb51a0-e861-4f2f-ad54-aa066eeb2b29"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"890050bd-3605-41b3-aa3c-a0e6e7af0f8a","depois":"21587233-a4f1-40e9-9fe0-76c7bcafde64"},{"campo":"CPF__pc","antes":"23230322835","depois":"09741761503"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23230322835","depois":"09741761503"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-C1-bad8a2","depois":"UNIF22 TC024 CLIENTE Y TC024-C1-bad8a2"}]`

**C2** (`TC024-C2-bbe27e`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fOgvYAE","obtido":"001HZ000013ecKiYAI"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"ebf138f0-6c27-47ba-b949-0c9c0fa43f21"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkQK2A0","Id__c":"ebf138f0-6c27-47ba-b949-0c9c0fa43f21"},{"Id":"00QHZ00000dDqXB2A0","Id__c":"f41c66e2-c818-48be-81d3-6aae9002fdcf"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"42e66f84-ac6a-40b0-a78d-98fd4827ffad","depois":"5881741a-9353-4f88-98e6-bee9d141ef61"},{"campo":"CPF__pc","antes":"36370542300","depois":"63933550505"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"36370542300","depois":"63933550505"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-C2-bbe27e","depois":"UNIF22 TC024 CLIENTE Y TC024-C2-bbe27e"}]`

**C3** (`TC024-C3-f8bb9e`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ezHGYAY","obtido":"001HZ000013fLeDYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"7a506ef6-4b39-4bb2-bb6f-a74134841ba2"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDvRq2AK","Id__c":"7a506ef6-4b39-4bb2-bb6f-a74134841ba2"},{"Id":"00QHZ00000dDm5X2AS","Id__c":"2c232f69-2718-41ea-b3a5-fc4addda2cdb"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"9d2ea8ba-70e2-4cb8-95da-973164405c10","depois":"050771ac-d741-4de1-a3e7-892ddf9483bd"},{"campo":"CPF__pc","antes":"06508144367","depois":"71245481100"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"06508144367","depois":"71245481100"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-C3-f8bb9e","depois":"UNIF22 TC024 CLIENTE Y TC024-C3-f8bb9e"}]`

**C4** (`TC024-C4-065c96`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013eyBYYAY","obtido":"001HZ000013ekacYAA"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"330452ac-0fc5-44bf-8fab-0717d0bd1878"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDvEy2AK","Id__c":"330452ac-0fc5-44bf-8fab-0717d0bd1878"},{"Id":"00QHZ00000dDhIa2AK","Id__c":"6b7683b9-d778-4301-aee6-f04ee47b8e4b"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"d423623b-fd02-4013-90ff-0a76a15c0940","depois":"b5d40348-53f3-4b52-a6b7-387f0895317f"},{"campo":"CPF__pc","antes":"55039293810","depois":"64340444707"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"55039293810","depois":"64340444707"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-C4-065c96","depois":"UNIF22 TC024 CLIENTE Y TC024-C4-065c96"}]`

**AR** (`TC024-AR-9f32c6`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ek28YAA","obtido":"001HZ000013f9yEYAQ"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"8dfd47bd-debf-4dee-9ce3-5bbcc4643edd"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkZe2AK","Id__c":"8dfd47bd-debf-4dee-9ce3-5bbcc4643edd"},{"Id":"00QHZ00000dDh7S2AS","Id__c":"cc48ea43-e5c7-461a-baac-70e043a7e3cd"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"fd0342d4-fe35-4cf2-8f99-ea2821b9af3e","depois":"fcfa4744-7c47-478c-85a2-680f623ff6ed"},{"campo":"CPF__pc","antes":"48252460879","depois":"69605326043"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"48252460879","depois":"69605326043"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-AR-9f32c6","depois":"UNIF22 TC024 CLIENTE Y TC024-AR-9f32c6"}]`

**FW** (`TC024-FW-2ad20d`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f9OiYAI","obtido":"001HZ000013ewWFYAY"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"ac527e4e-723d-4f21-8bf2-627ad5e76130"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDnvu2AC","Id__c":"ac527e4e-723d-4f21-8bf2-627ad5e76130"},{"Id":"00QHZ00000dDaIn2AK","Id__c":"96d2b61f-b92e-424d-938b-c9f73d4e3341"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"683afbb5-ef5a-4ca1-87e2-3abad962af06","depois":"ab0885e5-7dce-4900-9a8d-0f8f57d2213e"},{"campo":"CPF__pc","antes":"70744987261","depois":"51420075063"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"70744987261","depois":"51420075063"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-FW-2ad20d","depois":"UNIF22 TC024 CLIENTE Y TC024-FW-2ad20d"}]`

**RC** (`TC024-RC-f8a131`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fMlZYAU","obtido":"001HZ000013fOLyYAM"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"5836dda0-c514-4d31-9b76-bf65d4141f12"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDZRa2AO","Id__c":"5836dda0-c514-4d31-9b76-bf65d4141f12"},{"Id":"00QHZ00000dDd0Q2AS","Id__c":"3b11627d-f13f-4ee1-84a2-844a432a1bc1"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"7f7c7b40-552f-4fdc-8d92-6dd37e2eacb0","depois":"f8be9ddf-003b-4f7e-aa69-b8621a3f22e6"},{"campo":"CPF__pc","antes":"65820609883","depois":"94919040512"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"65820609883","depois":"94919040512"},{"campo":"Email","antes":"qa.unif22.tc024.a.tc024-rc-f8a131@example.com","depois":"qa.unif22.tc024.atrasado.tc024-rc-f8a131@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc024.atrasado.tc024-rc-f8a131@example.com","celular":"31987780178"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc024.atrasado.tc024-rc-f8a131@example.com","marcador":"2026-10-21T00:45:48.000+0000"}`

**EP** (`TC024-EP-4fe685`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013eo5vYAA","obtido":"001HZ000013fNeeYAE"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"68c6813e-303f-4b12-9347-728852a04752"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDru52AC","Id__c":"68c6813e-303f-4b12-9347-728852a04752"},{"Id":"00QHZ00000dDvJo2AK","Id__c":"4f4a3e0a-42d9-4cb4-bf66-dff8d531b8b3"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"95176f5a-cce4-41bf-98bb-3fc5827c8a07","depois":"95fc6141-be1d-47a3-8019-674e55730466"},{"campo":"CPF__pc","antes":"55104764354","depois":"12145043373"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"55104764354","depois":"12145043373"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-EP-4fe685","depois":"UNIF22 TC024 CLIENTE Y TC024-EP-4fe685"}]`

**RL** (`TC024-RL-ac6027`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f9bhYAA","obtido":"001HZ000013fPLBYA2"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"890e003b-cdc5-4d36-a49c-99568a3c670f"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDirR2AS","Id__c":"890e003b-cdc5-4d36-a49c-99568a3c670f"},{"Id":"00QHZ00000dDp5Y2AS","Id__c":"693be796-9630-4906-b608-f7a839f93397"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"df6d83c2-c114-4b2c-bfff-92eff0955742","depois":"7a19dfd8-5fd9-4b9d-8934-083de30bec16"},{"campo":"CPF__pc","antes":"96772438701","depois":"90359590357"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"96772438701","depois":"90359590357"},{"campo":"LastName","antes":"UNIF22 TC024 CLIENTE X TC024-RL-ac6027","depois":"UNIF22 TC024 CLIENTE Y TC024-RL-ac6027"}]`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**PA** (`TC025-PA-4c6c17`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013ewBTYAY","obtido":"001HZ000013exnGYAQ"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013exnGYAQ","Id__c":"54503f24-2fbd-4dbc-bd7f-de9b53c44d7b"},{"Id":"001HZ000013fO92YAE","Id__c":null},{"Id":"001HZ000013ewBTYAY","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-pa-4c6c17@example.com","celular 31987554930"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c951aa7c-6a81-486c-9578-6425ce2fd6aa","depois":"54503f24-2fbd-4dbc-bd7f-de9b53c44d7b"},{"campo":"CPF__pc","antes":"20002507935","depois":"81232961000"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"20002507935","depois":"81232961000"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-PA-4c6c17","depois":"UNIF22 TC025 CLIENTE Y TC025-PA-4c6c17"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"c951aa7c-6a81-486c-9578-6425ce2fd6aa","depois":"54503f24-2fbd-4dbc-bd7f-de9b53c44d7b"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:43:48.000+0000","depois":"2026-10-21T…`

**CA** (`TC025-CA-1cd5e7`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013ej9OYAQ","obtido":"001HZ000013eooPYAQ"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013eooPYAQ","Id__c":"6227d5fa-4072-42cf-a39c-4de4dc4c113b"},{"Id":"001HZ000013fPOPYA2","Id__c":null},{"Id":"001HZ000013ej9OYAQ","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-ca-1cd5e7@example.com","celular 31988179250"]`
- Account X intacta: `[{"campo":"Id__c","antes":"7b19290a-4d67-4940-8ce7-620d4cb8b047","depois":"6227d5fa-4072-42cf-a39c-4de4dc4c113b"},{"campo":"CPF__pc","antes":"54232814078","depois":"54350614311"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"54232814078","depois":"54350614311"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-CA-1cd5e7","depois":"UNIF22 TC025 CLIENTE Y TC025-CA-1cd5e7"}]`

**ME** (`TC025-ME-5e988d`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013enspYAA","obtido":"001HZ000013ejZ2YAI"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ejZ2YAI","Id__c":"1e7cd299-eb63-4c1e-842b-3af8df7b2cd1"},{"Id":"001HZ000013dLdrYAE","Id__c":null},{"Id":"001HZ000013enspYAA","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-me-5e988d@example.com","celular 31987942142"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8f9282f1-b151-4e6e-bb4b-5062696fa3ca","depois":"1e7cd299-eb63-4c1e-842b-3af8df7b2cd1"},{"campo":"CPF__pc","antes":"23521216551","depois":"19973541014"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23521216551","depois":"19973541014"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-ME-5e988d","depois":"UNIF22 TC025 CLIENTE Y TC025-ME-5e988d"}]`

**C1** (`TC025-C1-b1af38`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013fN6ZYAU","obtido":"001HZ000013eiGWYAY"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013eiGWYAY","Id__c":"a1d126ad-a8a7-47bd-aee4-05748b0e5188"},{"Id":"001HZ000013fNEfYAM","Id__c":null},{"Id":"001HZ000013fN6ZYAU","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-c1-b1af38@example.com","celular 31980505919"]`
- Account X intacta: `[{"campo":"Id__c","antes":"9b67557f-b269-4f0e-9312-94eeeecf6b8d","depois":"a1d126ad-a8a7-47bd-aee4-05748b0e5188"},{"campo":"CPF__pc","antes":"65353998006","depois":"04156006506"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"65353998006","depois":"04156006506"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-C1-b1af38","depois":"UNIF22 TC025 CLIENTE Y TC025-C1-b1af38"}]`

**C2** (`TC025-C2-d76c83`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013fMFKYA2","obtido":"001HZ000013ejcJYAQ"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013ejcJYAQ","Id__c":"850364f6-f4aa-49b2-940f-01934121b597"},{"Id":"001HZ000013f9bkYAA","Id__c":null},{"Id":"001HZ000013fMFKYA2","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-c2-d76c83@example.com","celular 31982795341"]`
- Account X intacta: `[{"campo":"Id__c","antes":"177317ce-00b6-42a3-bb4f-16e989295fa8","depois":"850364f6-f4aa-49b2-940f-01934121b597"},{"campo":"CPF__pc","antes":"98888955240","depois":"36329680477"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"98888955240","depois":"36329680477"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-C2-d76c83","depois":"UNIF22 TC025 CLIENTE Y TC025-C2-d76c83"}]`

**C3** (`TC025-C3-4929d1`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013fCRLYA2","obtido":"001HZ000013f9OkYAI"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013f9OkYAI","Id__c":"09c64e78-dc8e-4929-bd43-c5210d842be7"},{"Id":"001HZ000013f9zeYAA","Id__c":null},{"Id":"001HZ000013fCRLYA2","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-c3-4929d1@example.com","celular 31988631448"]`
- Account X intacta: `[{"campo":"Id__c","antes":"45ecfb0d-b49a-4aec-95af-2c7a99b73906","depois":"09c64e78-dc8e-4929-bd43-c5210d842be7"},{"campo":"CPF__pc","antes":"31394503890","depois":"13312099781"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"31394503890","depois":"13312099781"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-C3-4929d1","depois":"UNIF22 TC025 CLIENTE Y TC025-C3-4929d1"}]`

**C4** (`TC025-C4-8a1810`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013ejcLYAQ","obtido":"001HZ000013fL5hYAE"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fL5hYAE","Id__c":"08dae1e0-a832-43c7-84b2-50a77088f154"},{"Id":"001HZ000013fMnFYAU","Id__c":null},{"Id":"001HZ000013ejcLYAQ","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-c4-8a1810@example.com","celular 31984647655"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b9c3dfb7-84d9-4de9-847b-5226b4e8dc00","depois":"08dae1e0-a832-43c7-84b2-50a77088f154"},{"campo":"CPF__pc","antes":"23073384111","depois":"66910583302"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23073384111","depois":"66910583302"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-C4-8a1810","depois":"UNIF22 TC025 CLIENTE Y TC025-C4-8a1810"}]`

**AR** (`TC025-AR-4abfd8`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013en6IYAQ","obtido":"001HZ000013f1NpYAI"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013f1NpYAI","Id__c":"c395e1a0-0328-405e-aa3d-3a44b9284c64"},{"Id":"001HZ000013elavYAA","Id__c":null},{"Id":"001HZ000013en6IYAQ","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-ar-4abfd8@example.com","celular 31987960121"]`
- Account X intacta: `[{"campo":"Id__c","antes":"0addec28-f852-4ce1-876e-1195ca54b9c3","depois":"c395e1a0-0328-405e-aa3d-3a44b9284c64"},{"campo":"CPF__pc","antes":"11247201546","depois":"34940407969"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"11247201546","depois":"34940407969"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-AR-4abfd8","depois":"UNIF22 TC025 CLIENTE Y TC025-AR-4abfd8"}]`

**FW** (`TC025-FW-355ecd`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013fAnrYAE","obtido":"001HZ000013fL5iYAE"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fL5iYAE","Id__c":"f15f3d39-c02a-4ed2-afe5-26f053ffc4c0"},{"Id":"001HZ000013ejKdYAI","Id__c":null},{"Id":"001HZ000013fAnrYAE","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-fw-355ecd@example.com","celular 31986076045"]`
- Account X intacta: `[{"campo":"Id__c","antes":"eca94f06-26c9-4ebd-b1f2-d18d73641024","depois":"f15f3d39-c02a-4ed2-afe5-26f053ffc4c0"},{"campo":"CPF__pc","antes":"52646136218","depois":"71361934433"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"52646136218","depois":"71361934433"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-FW-355ecd","depois":"UNIF22 TC025 CLIENTE Y TC025-FW-355ecd"}]`

**RC** (`TC025-RC-a3f5bb`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013f1FnYAI","obtido":"001HZ000013exa6YAA"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013exa6YAA","Id__c":"b474b0c2-cbc3-46fe-a574-7cadabc35a82"},{"Id":"001HZ000013elChYAI","Id__c":null},{"Id":"001HZ000013f1FnYAI","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.atrasado.tc025-rc-a3f5bb@example.com","celular 31983070712"]`
- Account X intacta: `[{"campo":"Id__c","antes":"0ed12fd8-582c-4020-b98a-6b07d2db6fc2","depois":"b474b0c2-cbc3-46fe-a574-7cadabc35a82"},{"campo":"CPF__pc","antes":"28529208242","depois":"42630333531"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"28529208242","depois":"42630333531"},{"campo":"Email","antes":"qa.unif22.tc025.a.tc025-rc-a3f5bb@example.com","depois":"qa.unif22.tc025.atrasado.tc025-rc-a3f5bb@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc025.atrasado.tc025-rc-a3f5bb@example.com","celular":"31983070712"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc025.atrasado.tc025-rc-a3f5bb@example.com","marcador":"2026-10-21T00:46:56.000+0000"}`

**EP** (`TC025-EP-894c72`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013fLfvYAE","obtido":"001HZ000013fPcwYAE"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fPcwYAE","Id__c":"ee981a9a-db45-4e8f-9256-289a94993ccc"},{"Id":"001HZ000013emv4YAA","Id__c":null},{"Id":"001HZ000013fLfvYAE","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-ep-894c72@example.com","celular 31986945453"]`
- Account X intacta: `[{"campo":"Id__c","antes":"a1b8e09f-bfbd-4555-b51f-f5f017d11915","depois":"ee981a9a-db45-4e8f-9256-289a94993ccc"},{"campo":"CPF__pc","antes":"65436733549","depois":"59047345819"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"65436733549","depois":"59047345819"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-EP-894c72","depois":"UNIF22 TC025 CLIENTE Y TC025-EP-894c72"}]`

**RL** (`TC025-RL-30aa89`, ❌ diverge):

- Account aprovada é a accountY2 (mesmo Salesforce Id): `{"esperado":"001HZ000013f0Y8YAI","obtido":"001HZ000013fAkSYAU"}`
- 2 Account(s) com o CPF aprovado: `{"encontradas":[{"Id":"001HZ000013fAkSYAU","Id__c":"077ca007-b6ad-4454-8a63-e04ea47c1f0c"},{"Id":"001HZ000013ex4CYAQ","Id__c":null},{"Id":"001HZ000013f0Y8YAI","Id__c":null}]}`
- Lead novo vinculado, sem e-mail, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc025.a.tc025-rl-30aa89@example.com","celular 31982355895"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8e828524-0c5e-411f-a046-75c83623d39b","depois":"077ca007-b6ad-4454-8a63-e04ea47c1f0c"},{"campo":"CPF__pc","antes":"02123385018","depois":"23475792079"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"02123385018","depois":"23475792079"},{"campo":"LastName","antes":"UNIF22 TC025 CLIENTE X TC025-RL-30aa89","depois":"UNIF22 TC025 CLIENTE Y TC025-RL-30aa89"}]`

### TC-026 — Dois Leads Y; reutilizar o livre

**PA** (`TC026-PA-9cd073`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eobwYAA; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eobwYAA; first error: DUPLICATE_VAL…`

**CA** (`TC026-CA-2284d5`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en6JYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013en6JYAQ; first error: DUPLICATE_VA…`

**ME** (`TC026-ME-35f10b`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezIoYAI; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezIoYAI; first error: DUPLICATE_VAL…`

**C1** (`TC026-C1-e0f1b2`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ei7NYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ei7NYAQ; first error: DUPLICATE_VA…`

**C2** (`TC026-C2-2eaef0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyxvYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyxvYAA; first error: DUPLICATE_VA…`

**C3** (`TC026-C3-2ecf3c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejpNYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejpNYAQ; first error: DUPLICATE_VA…`

**C4** (`TC026-C4-3a39fb`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7hsYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f7hsYAA; first error: DUPLICATE_VA…`

**AR** (`TC026-AR-f8fabf`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eks6YAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eks6YAA; first error: DUPLICATE_VA…`

**AM** (`TC026-AM-ac08be`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1MWYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1MWYAY; first error: DUPLICATE_VA…`

**FW** (`TC026-FW-e3114c`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ekqEYAQ; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ekqEYAQ; first error: DUPLICATE_VA…`

**RC** (`TC026-RC-a390db`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fM7EYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fM7EYAU; first error: DUPLICATE_VA…`

**EP** (`TC026-EP-d33ebc`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013dVtEYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013dVtEYAU; first error: DUPLICATE_VA…`

**RL** (`TC026-RL-b338d6`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyYEYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013eyYEYAY; first error: DUPLICATE_VA…`

### TC-027 — Todos os Leads Y estão presos

**PA** (`TC027-PA-a1fe5d`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ekQPYAY","obtido":"001HZ000013fO4BYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"7a0f1b71-a951-41ab-ba7a-5ba725b69f4a"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDtOT2A0","Id__c":"7a0f1b71-a951-41ab-ba7a-5ba725b69f4a"},{"Id":"00QHZ00000dDphT2AS","Id__c":"ad39f9fb-a0a9-4a74-9672-0c23b2eae3ca"},{"Id":"00QHZ00000dDkyB2AS","Id__c":"04b0538b-5bcb-437a…`
- Account X intacta: `[{"campo":"Id__c","antes":"d114a34e-afc0-4776-a364-cfab9cd5fac3","depois":"cac4a322-62e3-46a8-810e-ee09520fb249"},{"campo":"CPF__pc","antes":"95031590408","depois":"36045830121"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"95031590408","depois":"36045830121"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-PA-a1fe5d","depois":"UNIF22 TC027 CLIENTE Y TC027-PA-a1fe5d"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"d114a34e-afc0-4776-a364-cfab9cd5fac3","depois":"cac4a322-62e3-46a8-810e-ee09520fb249"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:46:00.000+0000","depois":"2026-10-21T…`

**CA** (`TC027-CA-803ab2`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fAXVYA2","obtido":"001HZ000013fPhlYAE"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"1b603364-fb7a-479e-a12b-e8553b2415e5"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDgj92AC","Id__c":"1b603364-fb7a-479e-a12b-e8553b2415e5"},{"Id":"00QHZ00000dDguM2AS","Id__c":"f6a0fec2-9561-4ef5-bcc3-48db7fe8c3df"},{"Id":"00QHZ00000dDfvC2AS","Id__c":"02d29090-55b7-4e16…`
- Account X intacta: `[{"campo":"Id__c","antes":"4972e8da-6629-482a-81cf-a260a6cbfafc","depois":"9f4c44f4-9908-478e-a908-dd439f6d2d71"},{"campo":"CPF__pc","antes":"13331378852","depois":"30493001751"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"13331378852","depois":"30493001751"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-CA-803ab2","depois":"UNIF22 TC027 CLIENTE Y TC027-CA-803ab2"}]`

**ME** (`TC027-ME-f1174b`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013eyoEYAQ","obtido":"001HZ000013f84VYAQ"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"3a86993a-a411-43f7-a702-fc170989a010"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDg822AC","Id__c":"3a86993a-a411-43f7-a702-fc170989a010"},{"Id":"00QHZ00000dDdp52AC","Id__c":"c431cf8e-3b02-4d7a-92de-e4c3da26fc18"},{"Id":"00QHZ00000dDbJg2AK","Id__c":"816f2ec7-2f7f-4a73…`
- Account X intacta: `[{"campo":"Id__c","antes":"80866c8a-80e1-4e10-b8e9-ac38725dbaf8","depois":"31c01f6d-e323-439a-8587-4876c7b71dfc"},{"campo":"CPF__pc","antes":"12359730185","depois":"74143914000"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"12359730185","depois":"74143914000"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-ME-f1174b","depois":"UNIF22 TC027 CLIENTE Y TC027-ME-f1174b"}]`

**C1** (`TC027-C1-7525e2`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ewhkYAA","obtido":"001HZ000013ey8IYAQ"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"050cd749-fc47-4227-8cde-5657d4e07e2a"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkUt2AK","Id__c":"050cd749-fc47-4227-8cde-5657d4e07e2a"},{"Id":"00QHZ00000dDe1M2AS","Id__c":"94a5c976-dc35-464a-ad45-642e9e97d16e"},{"Id":"00QHZ00000dDgZY2A0","Id__c":"ccec7265-7588-47e5…`
- Account X intacta: `[{"campo":"Id__c","antes":"ef87cd26-2866-407d-9ad3-3c9e71f6b17a","depois":"0eb63a37-d5d3-492e-9376-0f0a59796341"},{"campo":"CPF__pc","antes":"34125214425","depois":"20062074156"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"34125214425","depois":"20062074156"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-C1-7525e2","depois":"UNIF22 TC027 CLIENTE Y TC027-C1-7525e2"}]`

**C2** (`TC027-C2-b643e0`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013exygYAA","obtido":"001HZ000013f8qgYAA"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"a55d3a4a-e41e-4035-a56c-c87603e24f52"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDt3W2AS","Id__c":"a55d3a4a-e41e-4035-a56c-c87603e24f52"},{"Id":"00QHZ00000dDn7x2AC","Id__c":"c2aaf605-c2b5-44b0-92ec-a5071aa39980"},{"Id":"00QHZ00000dDrEh2AK","Id__c":"c992a6d9-fab3-4123…`
- Account X intacta: `[{"campo":"Id__c","antes":"49ceb815-c55f-438c-a60f-a0b7a2070452","depois":"e7525cd6-8e3b-4c4a-acdf-1a3db1c116eb"},{"campo":"CPF__pc","antes":"94256452567","depois":"50705329100"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"94256452567","depois":"50705329100"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-C2-b643e0","depois":"UNIF22 TC027 CLIENTE Y TC027-C2-b643e0"}]`

**C3** (`TC027-C3-16c5bb`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fIRFYA2","obtido":"001HZ000013fAm5YAE"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"ea15c6b2-865c-4fd8-87c9-68419a740cd1"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDjaX2AS","Id__c":"ea15c6b2-865c-4fd8-87c9-68419a740cd1"},{"Id":"00QHZ00000dDiEf2AK","Id__c":"fa97ecbb-7143-45d5-8def-4a84e71c0904"},{"Id":"00QHZ00000dDcxI2AS","Id__c":"87c84abb-dd03-44c8…`
- Account X intacta: `[{"campo":"Id__c","antes":"e3eb8690-7064-447f-895b-4b1e43f6037f","depois":"4bc1bf92-ad26-4481-b38d-8312ce39d672"},{"campo":"CPF__pc","antes":"61243720964","depois":"12255013002"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"61243720964","depois":"12255013002"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-C3-16c5bb","depois":"UNIF22 TC027 CLIENTE Y TC027-C3-16c5bb"}]`

**C4** (`TC027-C4-a72ff5`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013ekLYYAY","obtido":"001HZ000013fOCIYA2"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"58620382-6d30-469d-a4ed-f06884123f02"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDphV2AS","Id__c":"58620382-6d30-469d-a4ed-f06884123f02"},{"Id":"00QHZ00000dDv232AC","Id__c":"6a0cec73-2654-4791-8a3e-8b8d3f82d136"},{"Id":"00QHZ00000dDqiN2AS","Id__c":"5b38d2e2-871a-4397…`
- Account X intacta: `[{"campo":"Id__c","antes":"ecf67841-9841-4354-8c92-08f7c2eb45f5","depois":"fac90919-4446-4a1a-9285-fe21231739ed"},{"campo":"CPF__pc","antes":"16157051981","depois":"92538874513"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"16157051981","depois":"92538874513"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-C4-a72ff5","depois":"UNIF22 TC027 CLIENTE Y TC027-C4-a72ff5"}]`

**AR** (`TC027-AR-f691ec`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fMnQYAU","obtido":"001HZ000013dVtFYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"ebe51942-ad06-420f-adaf-fffb20bf4cfd"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkoL2AS","Id__c":"ebe51942-ad06-420f-adaf-fffb20bf4cfd"},{"Id":"00QHZ00000dDfQV2A0","Id__c":"d3db8f5e-8f03-4914-83fe-beba529bf4d6"},{"Id":"00QHZ00000dDv0T2AS","Id__c":"514b72a6-83cf-487a…`
- Account X intacta: `[{"campo":"Id__c","antes":"3c090471-0ea8-4959-ab47-0548d78b608e","depois":"1676a28b-b436-4982-87a1-7722ebdfdc93"},{"campo":"CPF__pc","antes":"05500757989","depois":"42133405380"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"05500757989","depois":"42133405380"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-AR-f691ec","depois":"UNIF22 TC027 CLIENTE Y TC027-AR-f691ec"}]`

**FW** (`TC027-FW-842da9`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f8M9YAI","obtido":"001HZ000013f0DXYAY"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"c13a074d-46f1-4bca-85fc-a56134427837"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDoAM2A0","Id__c":"c13a074d-46f1-4bca-85fc-a56134427837"},{"Id":"00QHZ00000dDl7g2AC","Id__c":"381e73d7-5a4e-4487-81b5-cc842bbc8325"},{"Id":"00QHZ00000dDnkb2AC","Id__c":"16387250-20d6-49fc…`
- Account X intacta: `[{"campo":"Id__c","antes":"3ab8035c-2020-46cb-8067-6945b6a9af5c","depois":"5a430cb4-89bf-4435-8fff-550d643f62db"},{"campo":"CPF__pc","antes":"23124107292","depois":"66832421940"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23124107292","depois":"66832421940"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-FW-842da9","depois":"UNIF22 TC027 CLIENTE Y TC027-FW-842da9"}]`

**RC** (`TC027-RC-b25555`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013fM7FYAU","obtido":"001HZ000013f8e3YAA"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"0bf4f3f5-56ea-405d-a067-59dc0bb5693d"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDo0i2AC","Id__c":"0bf4f3f5-56ea-405d-a067-59dc0bb5693d"},{"Id":"00QHZ00000dDsHA2A0","Id__c":"a35ad4cc-4b66-4699-ad74-e8c060aa2e93"},{"Id":"00QHZ00000dDhKO2A0","Id__c":"e1e3c1cb-8560-4587…`
- Account X intacta: `[{"campo":"Id__c","antes":"aadee9dc-bbcf-42cd-8072-31f07aebc6b9","depois":"98a64ae2-d32f-44f5-989b-f284fdd1320b"},{"campo":"CPF__pc","antes":"25223079086","depois":"51486920497"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"25223079086","depois":"51486920497"},{"campo":"Email","antes":"qa.unif22.tc027.a.tc027-rc-b25555@example.com","depois":"qa.unif22.tc027.atrasado.tc027-rc-b25555@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc027.atrasado.tc027-rc-b25555@example.com","celular":"31985436813"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc027.atrasado.tc027-rc-b25555@example.com","marcador":"2026-10-21T00:49:09.000+0000"}`

**EP** (`TC027-EP-d057ef`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013f0WlYAI","obtido":"001HZ000013fPTGYA2"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"94fc25ed-e02a-4fc3-b21a-7f88926e2767"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDoQU2A0","Id__c":"94fc25ed-e02a-4fc3-b21a-7f88926e2767"},{"Id":"00QHZ00000dDvGb2AK","Id__c":"329acba2-a72f-46f3-bf38-69a2a96b12f6"},{"Id":"00QHZ00000dDr0B2AS","Id__c":"263261b7-9f67-4705…`
- Account X intacta: `[{"campo":"Id__c","antes":"19a93849-c304-4d7e-ad1a-69542b7c0ae1","depois":"5c6deeb9-1677-4b4b-b214-7f743443c474"},{"campo":"CPF__pc","antes":"74141397512","depois":"03158425637"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"74141397512","depois":"03158425637"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-EP-d057ef","depois":"UNIF22 TC027 CLIENTE Y TC027-EP-d057ef"}]`

**RL** (`TC027-RL-be9612`, ❌ diverge):

- Account aprovada é a accountY (mesmo Salesforce Id): `{"esperado":"001HZ000013exaTYAQ","obtido":"001HZ000013f8u9YAA"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"e0548ce6-748b-45b2-b396-73c90d18e644"}`
- 2 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDtbL2AS","Id__c":"e0548ce6-748b-45b2-b396-73c90d18e644"},{"Id":"00QHZ00000dDoLa2AK","Id__c":"c504a5f0-5cca-4ee9-bfcb-dd051ad9c528"},{"Id":"00QHZ00000dDp9b2AC","Id__c":"61830582-fe84-471e…`
- Account X intacta: `[{"campo":"Id__c","antes":"b8dc5fed-4c75-4b09-b647-8b0a8c61023f","depois":"132004be-9119-45f3-9d5d-387c36767f64"},{"campo":"CPF__pc","antes":"24225679837","depois":"71108115578"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"24225679837","depois":"71108115578"},{"campo":"LastName","antes":"UNIF22 TC027 CLIENTE X TC027-RL-be9612","depois":"UNIF22 TC027 CLIENTE Y TC027-RL-be9612"}]`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**PA** (`TC038-PA-e90128`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1NsYAI; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f1NsYAI; first error: DUPLICATE_VAL…`

**CA** (`TC038-CA-7116d0`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0GxYAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0GxYAI; first error: DUPLICATE_VA…`

**ME** (`TC038-ME-2591a9`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezAtYAI; first error: DUPLICATE_VAL…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ezAtYAI; first error: DUPLICATE_VAL…`

**C1** (`TC038-C1-bfdc74`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejHUYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ejHUYAY; first error: DUPLICATE_VA…`

**C2** (`TC038-C2-35a5d6`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLPlYAM; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fLPlYAM; first error: DUPLICATE_VA…`

**C3** (`TC038-C3-4aba96`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013em0eYAA; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013em0eYAA; first error: DUPLICATE_VA…`

**C4** (`TC038-C4-e80a29`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fPoEYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fPoEYAU; first error: DUPLICATE_VA…`

**AR** (`TC038-AR-2109c1`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewWHYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013ewWHYAY; first error: DUPLICATE_VA…`

**AM** (`TC038-AM-1d9d70`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fOjGYAU; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fOjGYAU; first error: DUPLICATE_VA…`

**FW** (`TC038-FW-2aa959`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013elB4YAI; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013elB4YAI; first error: DUPLICATE_VA…`

**RC** (`TC038-RC-02da6f`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0DZYAY; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013f0DZYAY; first error: DUPLICATE_VA…`

**EP** (`TC038-EP-5ef097`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBTiYAM; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fBTiYAM; first error: DUPLICATE_VA…`

**RL** (`TC038-RL-848951`, ❌ diverge):

- Erro: cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMX6YAM; first error: DUPLICATE_VA…
- Todos os eventos responderam HTTP 200: `cliente-update respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Update failed. First exception on row 0 with id 001HZ000013fMX6YAM; first error: DUPLICATE_VA…`

### TC-039 — Nova jornada do mesmo cliente Y

_Observação:_ A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.

**RC** (`TC039-RC-b7e1e6`, ❌ diverge):

- Lead leadX reutilizado e vinculado (com os contatos aprovados): `["contatos diferentes dos aprovados: qa.unif22.tc039.atrasado.tc039-rc-b7e1e6@example.com / 31979926391"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc039.atrasado.tc039-rc-b7e1e6@example.com","celular":"31979926391"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc039.atrasado.tc039-rc-b7e1e6@example.com","marcador":"2026-10-21T00:51:04.000+0000"}`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-3bb0a0`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Campos obrigatór…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Campos obrigatór…`

**CA** (`TC040-CA-b6c3d3`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC040-ME-0b0f19`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Campos obrigatór…
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Campos obrigatór…`

**C1** (`TC040-C1-69fac6`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC040-C2-f720cd`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-21T00:51:39.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC040-C3-7dfbc7`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-21T00:51:37.000+0000","depois":"2026-10-21T00:51:39.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC040-C4-9559c0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC040-AR-a62ee7`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-21T00:51:58.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Opportunity na Account aprovada: `{"conta":"001HZ000013ewtKYAQ","oportunidade":"001HZ000013ewBXYAY"}`

**FW** (`TC040-FW-85309f`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-21T00:51:56.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Opportunity na Account aprovada: `{"conta":"001HZ000013fPA6YAM","oportunidade":"001HZ000013ewGKYAY"}`

**RC** (`TC040-RC-9db954`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc040.atrasado.tc040-rc-9db954@example.com","celular":"31980514846"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc040.atrasado.tc040-rc-9db954@example.com","marcador":"2026-10-21T00:52:06.000+0000"}`

**EP** (`TC040-EP-5f35d8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC040-RL-1f5b21`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-041 — Venda Genérica com colisão total

**PA** (`TC041-PA-b7930b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fDIaYAM"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-pa-b7930b@example.com","celular 31988105760","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c5fa1bba-70fa-43ab-90d2-c31a2d9cdabc","depois":"363a9ce2-18d1-4ac4-b906-3928182f7cf8"},{"campo":"CPF__pc","antes":"79152555500","depois":"60937364584"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"79152555500","depois":"60937364584"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-PA-b7930b","depois":"UNIF22 TC041 CLIENTE Y TC041-PA-b7930b"}]`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"c5fa1bba-70fa-43ab-90d2-c31a2d9cdabc","depois":"363a9ce2-18d1-4ac4-b906-3928182f7cf8"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-21T00:50:15.000+0000","depois":"2026-10-21T…`

**CA** (`TC041-CA-f81be0`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiRnYAI"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-ca-f81be0@example.com","celular 31989705925","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"65e94cdd-f3d9-4428-a8d9-7973c0cf0575","depois":"c915df11-c851-4bab-9cad-1715420d9b15"},{"campo":"CPF__pc","antes":"32353560709","depois":"33510501276"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"32353560709","depois":"33510501276"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-CA-f81be0","depois":"UNIF22 TC041 CLIENTE Y TC041-CA-f81be0"}]`

**ME** (`TC041-ME-31e043`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPGMYA2"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-me-31e043@example.com","celular 31983171888","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"43d9dcfc-1b90-4a7c-bab0-fb94f82a92fb","depois":"37826a9d-6b21-4156-a6b0-ec5b55cdb3c8"},{"campo":"CPF__pc","antes":"45074783160","depois":"04316315900"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"45074783160","depois":"04316315900"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-ME-31e043","depois":"UNIF22 TC041 CLIENTE Y TC041-ME-31e043"}]`

**C1** (`TC041-C1-1be97c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fC1UYAU"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-c1-1be97c@example.com","celular 31989437089","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d651688f-a301-44fe-8af5-58674303093c","depois":"bd29f370-99bd-4c19-8ce5-142b3b3c6e89"},{"campo":"CPF__pc","antes":"11533395101","depois":"49133901473"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"11533395101","depois":"49133901473"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-C1-1be97c","depois":"UNIF22 TC041 CLIENTE Y TC041-C1-1be97c"}]`

**C2** (`TC041-C2-c9ce46`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eofGYAQ"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-c2-c9ce46@example.com","celular 31982209717","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"9481a95b-07ec-4f1e-b4ed-1e049c64cc78","depois":"9b7c291b-97a5-4bf9-84f4-be2784aca893"},{"campo":"CPF__pc","antes":"22557623741","depois":"25117435400"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"22557623741","depois":"25117435400"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-C2-c9ce46","depois":"UNIF22 TC041 CLIENTE Y TC041-C2-c9ce46"}]`

**C3** (`TC041-C3-29729e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eymaYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-c3-29729e@example.com","celular 31985018428","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"5f148e89-d692-4454-bf7c-9505b9879b45","depois":"608e3024-1397-4804-a006-fce1582c5c5c"},{"campo":"CPF__pc","antes":"93714923764","depois":"02643613260"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"93714923764","depois":"02643613260"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-C3-29729e","depois":"UNIF22 TC041 CLIENTE Y TC041-C3-29729e"}]`

**C4** (`TC041-C4-dae4e2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fOfNYAU"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-c4-dae4e2@example.com","celular 31986964923","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"fc2db464-bd65-455e-a6cf-2321a0341f42","depois":"a3c54017-cbd3-4e30-af9f-b5e35d32642c"},{"campo":"CPF__pc","antes":"40866102302","depois":"00093503229"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"40866102302","depois":"00093503229"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-C4-dae4e2","depois":"UNIF22 TC041 CLIENTE Y TC041-C4-dae4e2"}]`

**AR** (`TC041-AR-386a3b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f0GzYAI"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-ar-386a3b@example.com","celular 31984809613","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cd3d5596-1307-4fcc-8768-e54c907f9edd","depois":"7878b735-d8c3-4ace-9971-8b0bd030992d"},{"campo":"CPF__pc","antes":"46332502215","depois":"71383343381"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"46332502215","depois":"71383343381"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-AR-386a3b","depois":"UNIF22 TC041 CLIENTE Y TC041-AR-386a3b"}]`

**FW** (`TC041-FW-ced4aa`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fOaTYAU"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-fw-ced4aa@example.com","celular 31988106414","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b8035bba-7bb5-4bfa-993c-6f90465a2967","depois":"77e631a6-92a8-4669-8d37-5a9e52ad0039"},{"campo":"CPF__pc","antes":"45572097934","depois":"72055209086"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"45572097934","depois":"72055209086"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-FW-ced4aa","depois":"UNIF22 TC041 CLIENTE Y TC041-FW-ced4aa"}]`

**RC** (`TC041-RC-6c3fd2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f8R4YAI"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.atrasado.tc041-rc-6c3fd2@example.com","celular 31985432930","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"386fd73e-a841-47bf-9185-79af67181d1e","depois":"801a7685-6e00-4a97-ba2e-4e8e935d3796"},{"campo":"CPF__pc","antes":"21773657593","depois":"34248776545"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"21773657593","depois":"34248776545"},{"campo":"Email","antes":"qa.unif22.tc041.a.tc041-rc-6c3fd2@example.com","depois":"qa.unif22.tc041.atrasado.tc041-rc-6c3fd2@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc041.atrasado.tc041-rc-6c3fd2@example.com","celular":"31985432930"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc041.atrasado.tc041-rc-6c3fd2@example.com","marcador":"2026-10-21T00:53:18.000+0000"}`

**EP** (`TC041-EP-8acbe1`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enssYAA"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-ep-8acbe1@example.com","celular 31989485690","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"eeb53f72-f2ea-4bb9-b2b4-86e5c509683a","depois":"b691c33d-9534-4bd7-9b98-1e0f1cb03e0a"},{"campo":"CPF__pc","antes":"70346321468","depois":"34347364172"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"70346321468","depois":"34347364172"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-EP-8acbe1","depois":"UNIF22 TC041 CLIENTE Y TC041-EP-8acbe1"}]`

**RL** (`TC041-RL-0be74e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQHGYA2"}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["é um Lead da massa, não novo","e-mail qa.unif22.tc041.a.tc041-rl-0be74e@example.com","celular 31984454486","DescricaoOrigem__c vazio"]`
- Account X intacta: `[{"campo":"Id__c","antes":"540143af-8483-4733-a1ff-6d3e1ac9a564","depois":"2c7f632d-3753-4189-b30a-53785abd6855"},{"campo":"CPF__pc","antes":"60363545093","depois":"13100472004"},{"campo":"LastName","antes":"QA UNIF22 TC…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"60363545093","depois":"13100472004"},{"campo":"LastName","antes":"UNIF22 TC041 CLIENTE X TC041-RL-0be74e","depois":"UNIF22 TC041 CLIENTE Y TC041-RL-0be74e"}]`

### TC-042 — Venda Genérica; e-mail colide

**PA** (`TC042-PA-7d3039`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f0BZYAY"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-pa-7d3039@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"be52cae7-d52e-4c16-b5d6-1be214031e13","depois":"e96ca8c2-b54e-4386-8db1-68a0851db286"},{"campo":"CPF__pc","antes":"16404388316","depois":"32261591438"},{"campo":"Celular__c","antes":"3198895755…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"16404388316","depois":"32261591438"},{"campo":"MobilePhone","antes":"31988957555","depois":"31978957555"},{"campo":"CelularSemFormatacao__c","antes":"31988957555","depois":"31978957555"},{"cam…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"be52cae7-d52e-4c16-b5d6-1be214031e13","depois":"e96ca8c2-b54e-4386-8db1-68a0851db286"},{"campo":"Celular__c","antes":"31988957555","depois":"31978957555"},{"campo":"DataAlteracaoEventoContatoEm…`

**CA** (`TC042-CA-ac7210`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f7zhYAA"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-ca-ac7210@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"398d3538-ca0d-48f0-83f1-5239195eab69","depois":"9d155ecc-2fa7-464d-90e6-6f58d2b1037a"},{"campo":"CPF__pc","antes":"58529412982","depois":"55606664240"},{"campo":"Celular__c","antes":"3198023024…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"58529412982","depois":"55606664240"},{"campo":"MobilePhone","antes":"31980230244","depois":"31970230244"},{"campo":"CelularSemFormatacao__c","antes":"31980230244","depois":"31970230244"},{"cam…`

**ME** (`TC042-ME-d036f4`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eks9YAA"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-me-d036f4@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c72564db-54ff-488a-95d8-d74e014d37d0","depois":"1d962885-0808-4338-b36b-c23bf0ecabcf"},{"campo":"CPF__pc","antes":"47035963340","depois":"49450746230"},{"campo":"Celular__c","antes":"3198658569…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"47035963340","depois":"49450746230"},{"campo":"MobilePhone","antes":"31986585694","depois":"31976585694"},{"campo":"CelularSemFormatacao__c","antes":"31986585694","depois":"31976585694"},{"cam…`

**C1** (`TC042-C1-99b39f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQPJYA2"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-c1-99b39f@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"8a419b40-a595-4a4b-9183-7f8c49f39c5a","depois":"d2693083-64fd-4af2-93bb-02a611048ce0"},{"campo":"CPF__pc","antes":"30714365564","depois":"61831405466"},{"campo":"Celular__c","antes":"3198463684…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"30714365564","depois":"61831405466"},{"campo":"MobilePhone","antes":"31984636842","depois":"31974636842"},{"campo":"CelularSemFormatacao__c","antes":"31984636842","depois":"31974636842"},{"cam…`

**C2** (`TC042-C2-ea0ad7`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQE2YAM"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-c2-ea0ad7@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"6c8d2609-958d-4a82-b699-b56f33f97fd9","depois":"518e3627-0b66-4c71-aad6-1322990683b0"},{"campo":"CPF__pc","antes":"49232534444","depois":"54619651303"},{"campo":"Celular__c","antes":"3198994682…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"49232534444","depois":"54619651303"},{"campo":"MobilePhone","antes":"31989946822","depois":"31979946822"},{"campo":"CelularSemFormatacao__c","antes":"31989946822","depois":"31979946822"},{"cam…`

**C3** (`TC042-C3-dabd40`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f1PcYAI"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-c3-dabd40@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"1f47f918-8130-44da-81e1-6926661439fc","depois":"20ed1246-35b4-4cdd-8edf-4c1df258b51b"},{"campo":"CPF__pc","antes":"43052441795","depois":"61554475007"},{"campo":"Celular__c","antes":"3198530075…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"43052441795","depois":"61554475007"},{"campo":"MobilePhone","antes":"31985300754","depois":"31975300754"},{"campo":"CelularSemFormatacao__c","antes":"31985300754","depois":"31975300754"},{"cam…`

**C4** (`TC042-C4-c12c3c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013em0fYAA"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-c4-c12c3c@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"36ef8712-5c8f-4828-98d9-72cd969870fb","depois":"0f327cd5-f0a7-4257-b8e1-a1623a08308d"},{"campo":"CPF__pc","antes":"23124204140","depois":"41621201295"},{"campo":"Celular__c","antes":"3198152378…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23124204140","depois":"41621201295"},{"campo":"MobilePhone","antes":"31981523783","depois":"31971523783"},{"campo":"CelularSemFormatacao__c","antes":"31981523783","depois":"31971523783"},{"cam…`

**AR** (`TC042-AR-568290`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPrSYAU"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-ar-568290@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"06a06668-c9af-46f6-94c8-5542d40a4ab1","depois":"6b108bb5-d67a-4953-8a5c-b10c3d09d64f"},{"campo":"CPF__pc","antes":"57208233284","depois":"31285286405"},{"campo":"Celular__c","antes":"3198620134…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"57208233284","depois":"31285286405"},{"campo":"MobilePhone","antes":"31986201349","depois":"31976201349"},{"campo":"CelularSemFormatacao__c","antes":"31986201349","depois":"31976201349"},{"cam…`

**FW** (`TC042-FW-b654e5`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezdpYAA"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-fw-b654e5@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d4a1f6b0-619a-458c-935b-83bbbb2ab8ea","depois":"77e8c3a8-e7e7-4334-bdc2-ebf716108368"},{"campo":"CPF__pc","antes":"52191059490","depois":"05249244815"},{"campo":"Celular__c","antes":"3198594424…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"52191059490","depois":"05249244815"},{"campo":"MobilePhone","antes":"31985944244","depois":"31975944244"},{"campo":"CelularSemFormatacao__c","antes":"31985944244","depois":"31975944244"},{"cam…`

**RC** (`TC042-RC-64a13f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eyOpYAI"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.atrasado.tc042-rc-64a13f@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"e5ffa601-96f4-4e38-9b12-2588f9bb4802","depois":"3af6fb5c-8754-41ef-93b4-ce53b9544b5e"},{"campo":"CPF__pc","antes":"47507354504","depois":"51614104859"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"47507354504","depois":"51614104859"},{"campo":"Email","antes":"qa.unif22.tc042.a.tc042-rc-64a13f@example.com","depois":"qa.unif22.tc042.atrasado.tc042-rc-64a13f@example.com"},{"campo":"MobileP…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc042.atrasado.tc042-rc-64a13f@example.com","celular":"31976605341"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc042.atrasado.tc042-rc-64a13f@example.com","marcador":"2026-10-21T00:54:16.000+0000"}`

**EP** (`TC042-EP-8c8bfd`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fApRYAU"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-ep-8c8bfd@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"782ac0e6-831e-4cc6-b0a4-e94ed30a1c1f","depois":"ca3f7c84-afbc-49de-bb5b-c9304f2d8aa1"},{"campo":"CPF__pc","antes":"15532208549","depois":"31573530476"},{"campo":"Celular__c","antes":"3198979162…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15532208549","depois":"31573530476"},{"campo":"MobilePhone","antes":"31989791628","depois":"31979791628"},{"campo":"CelularSemFormatacao__c","antes":"31989791628","depois":"31979791628"},{"cam…`

**RL** (`TC042-RL-013918`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezffYAA"}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc042.a.tc042-rl-013918@example.com"]`
- Account X intacta: `[{"campo":"Id__c","antes":"1e2c4b99-35cb-4f28-ab64-3aae4c2c07dc","depois":"5a682898-14c3-42c6-baac-4541c2b7d252"},{"campo":"CPF__pc","antes":"84009713372","depois":"40832215694"},{"campo":"Celular__c","antes":"3198478237…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"84009713372","depois":"40832215694"},{"campo":"MobilePhone","antes":"31984782373","depois":"31974782373"},{"campo":"CelularSemFormatacao__c","antes":"31984782373","depois":"31974782373"},{"cam…`

### TC-043 — Venda Genérica; celular colide

**PA** (`TC043-PA-9a3322`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f7mjYAA"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31985514384"]`
- Account X intacta: `[{"campo":"Id__c","antes":"70dae804-7ebd-4a68-a298-ab191c95f91d","depois":"8105231e-9b94-470a-929a-1d1a9e2c0427"},{"campo":"CPF__pc","antes":"23152594364","depois":"29303305205"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23152594364","depois":"29303305205"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-pa-9a3322@example.com","depois":"qa.unif22.tc043.c.tc043-pa-9a3322@example.com"},{"campo":"LastName","ant…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"70dae804-7ebd-4a68-a298-ab191c95f91d","depois":"8105231e-9b94-470a-929a-1d1a9e2c0427"},{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-pa-9a3322@example.com","depois":"qa.unif22.tc043.c…`

**CA** (`TC043-CA-767a2d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQIsYAM"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31987786636"]`
- Account X intacta: `[{"campo":"Id__c","antes":"dd68e036-d8ac-49ba-a777-c823014832c2","depois":"4b6f69d2-66c8-4c16-95b4-3e7bcbefe2b1"},{"campo":"CPF__pc","antes":"71106701208","depois":"17245480001"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"71106701208","depois":"17245480001"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-ca-767a2d@example.com","depois":"qa.unif22.tc043.c.tc043-ca-767a2d@example.com"},{"campo":"LastName","ant…`

**ME** (`TC043-ME-d75e48`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMajYAE"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31988798725"]`
- Account X intacta: `[{"campo":"Id__c","antes":"c06b52ea-4e58-4062-b97d-abf58efeda0a","depois":"394d1a3f-70fa-4629-9369-46fc18023604"},{"campo":"CPF__pc","antes":"53121238205","depois":"39345334262"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"53121238205","depois":"39345334262"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-me-d75e48@example.com","depois":"qa.unif22.tc043.c.tc043-me-d75e48@example.com"},{"campo":"LastName","ant…`

**C1** (`TC043-C1-691c35`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eXfsYAE"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31981108815"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d3d466a4-5122-4c37-8201-c7d0485f791e","depois":"4b16ef3d-5bbf-49d8-9d16-4dbb1fd0f9bb"},{"campo":"CPF__pc","antes":"76802002388","depois":"48816520957"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"76802002388","depois":"48816520957"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c1-691c35@example.com","depois":"qa.unif22.tc043.c.tc043-c1-691c35@example.com"},{"campo":"LastName","ant…`

**C2** (`TC043-C2-de0ef2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLKwYAM"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31988353479"]`
- Account X intacta: `[{"campo":"Id__c","antes":"2e423e88-aa40-4389-8469-7a5ee2ac3003","depois":"369b492f-aeb1-46d4-9dcc-fde9ee38ddce"},{"campo":"CPF__pc","antes":"95524706330","depois":"10405770081"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"95524706330","depois":"10405770081"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c2-de0ef2@example.com","depois":"qa.unif22.tc043.c.tc043-c2-de0ef2@example.com"},{"campo":"LastName","ant…`

**C3** (`TC043-C3-3a2893`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQHIYA2"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31988187408"]`
- Account X intacta: `[{"campo":"Id__c","antes":"d209e967-7780-431b-9e20-dcc8f497d93c","depois":"12f9bcf9-cd9b-41a8-8650-31c898fa2e74"},{"campo":"CPF__pc","antes":"03535483913","depois":"06300055086"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"03535483913","depois":"06300055086"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c3-3a2893@example.com","depois":"qa.unif22.tc043.c.tc043-c3-3a2893@example.com"},{"campo":"LastName","ant…`

**C4** (`TC043-C4-79a3ea`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPhoYAE"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31987379186"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b6052477-c6bd-4dd2-80ba-292b8918c560","depois":"462a4214-9978-419d-91f1-8bd98e7b8dfe"},{"campo":"CPF__pc","antes":"24006036264","depois":"55622078342"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"24006036264","depois":"55622078342"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c4-79a3ea@example.com","depois":"qa.unif22.tc043.c.tc043-c4-79a3ea@example.com"},{"campo":"LastName","ant…`

**AR** (`TC043-AR-11fb53`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ejHXYAY"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31981713008"]`
- Account X intacta: `[{"campo":"Id__c","antes":"4cdef2a1-dff6-4624-b8cc-7f04024a78a1","depois":"a95401d7-1152-449f-b4c1-e6125d7affdc"},{"campo":"CPF__pc","antes":"73472448970","depois":"71001684060"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"73472448970","depois":"71001684060"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-ar-11fb53@example.com","depois":"qa.unif22.tc043.c.tc043-ar-11fb53@example.com"},{"campo":"LastName","ant…`

**FW** (`TC043-FW-62da5f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPQ9YAM"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31985453883"]`
- Account X intacta: `[{"campo":"Id__c","antes":"f4e620a4-ec5e-446b-becc-23ba7347621a","depois":"784367a5-9237-4744-8f82-8ce7793fc48b"},{"campo":"CPF__pc","antes":"51129651428","depois":"52556120304"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"51129651428","depois":"52556120304"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-fw-62da5f@example.com","depois":"qa.unif22.tc043.c.tc043-fw-62da5f@example.com"},{"campo":"LastName","ant…`

**RC** (`TC043-RC-3de1a3`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fAeAYAU"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","e-mail qa.unif22.tc043.atrasado.tc043-rc-3de1a3@example.com","celular 31988768767"]`
- Account X intacta: `[{"campo":"Id__c","antes":"be2ab895-50c1-44d5-807f-5dab368c35b8","depois":"ef46f068-8021-4e5c-90bd-a3b3e2c11900"},{"campo":"CPF__pc","antes":"83311414900","depois":"14702210637"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"83311414900","depois":"14702210637"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-rc-3de1a3@example.com","depois":"qa.unif22.tc043.atrasado.tc043-rc-3de1a3@example.com"},{"campo":"LastNam…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc043.atrasado.tc043-rc-3de1a3@example.com","celular":"31988768767"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc043.atrasado.tc043-rc-3de1a3@example.com","marcador":"2026-10-21T00:55:19.000+0000"}`

**EP** (`TC043-EP-161541`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPOWYA2"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31987479241"]`
- Account X intacta: `[{"campo":"Id__c","antes":"9fe67959-6111-4d46-b510-c26e30865ea0","depois":"889dc0d8-6b5e-40ea-ba25-eb7f6054a9e5"},{"campo":"CPF__pc","antes":"01322699534","depois":"01217238875"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"01322699534","depois":"01217238875"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-ep-161541@example.com","depois":"qa.unif22.tc043.c.tc043-ep-161541@example.com"},{"campo":"LastName","ant…`

**RL** (`TC043-RL-37696f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLjBYAU"}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["é um Lead da massa, não novo","celular 31989624869"]`
- Account X intacta: `[{"campo":"Id__c","antes":"1668a1a1-561e-4c42-b683-35c842db5ebb","depois":"e1376fec-0aae-4e23-b903-2c27b12e8373"},{"campo":"CPF__pc","antes":"59433134435","depois":"23262960365"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"59433134435","depois":"23262960365"},{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-rl-37696f@example.com","depois":"qa.unif22.tc043.c.tc043-rl-37696f@example.com"},{"campo":"LastName","ant…`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**PA** (`TC044-PA-c06a68`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQNjYAM"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDqmV2AS ≠ leadY 00QHZ00000dDhKQ2A0"]`
- Account X intacta: `[{"campo":"Id__c","antes":"63ba3e6d-7320-4f22-b08e-f49144025e45","depois":"ca9bad3f-34fd-4dd5-bb96-d5e9274aa09e"},{"campo":"CPF__pc","antes":"02514088410","depois":"03198154391"},{"campo":"PersonEmail","antes":"qa.unif22…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"63ba3e6d-7320-4f22-b08e-f49144025e45","depois":"ca9bad3f-34fd-4dd5-bb96-d5e9274aa09e"},{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-pa-c06a68@example.com","depois":"qa.unif22.tc044.c…`

**CA** (`TC044-CA-d9633f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fDFRYA2"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDool2AC ≠ leadY 00QHZ00000dDh0w2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDool2AC","Id__c":"968e5f5f-834a-4727-b1fd-5d281d1d82d0"},{"Id":"00QHZ00000dDh0w2AC","Id__c":"d1211640-10cc-44f1-aa67-3d3158b79b8b"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"33b55e8a-1bc0-4417-8988-8ad6bd3d22dc","depois":"1a610d9e-6f34-4ff8-a7e2-d480a63f1c0a"},{"campo":"CPF__pc","antes":"43483399704","depois":"91319800408"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"43483399704","depois":"91319800408"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-CA-d9633f","depois":"UNIF22 TC044 CLIENTE Y TC044-CA-d9633f"}]`

**ME** (`TC044-ME-b622e5`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f7mlYAA"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDw7n2AC ≠ leadY 00QHZ00000dDmqE2AS"]`
- Account X intacta: `[{"campo":"Id__c","antes":"bc71d56b-7796-47f6-9f6f-7540d52f61a5","depois":"29be402d-336d-46ad-81c5-9a79c9689de6"},{"campo":"CPF__pc","antes":"74962240579","depois":"25200731283"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C1** (`TC044-C1-f01d7f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eyZpYAI"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDwe12AC ≠ leadY 00QHZ00000dDhIe2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDwe12AC","Id__c":"db8defe7-4c2a-4fbd-941a-efdee2010bc5"},{"Id":"00QHZ00000dDhIe2AK","Id__c":"d72de014-b39b-4b6c-9e3a-d8a46cb1ea2f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"cf3dd345-8563-49ff-aca2-9645686fa2a7","depois":"e614f06c-d5a9-4c5c-851d-2534c7279307"},{"campo":"CPF__pc","antes":"62450156267","depois":"59572382446"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"62450156267","depois":"59572382446"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-C1-f01d7f","depois":"UNIF22 TC044 CLIENTE Y TC044-C1-f01d7f"}]`

**C2** (`TC044-C2-5896ea`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eyxxYAA"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDbJk2AK ≠ leadY 00QHZ00000dDqTx2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDbJk2AK","Id__c":"2f14d6a9-cefa-4ded-8239-51464c056628"},{"Id":"00QHZ00000dDqTx2AK","Id__c":"22e105dd-e43a-4138-ba33-dd51f8b9a23e"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"856cf52b-221d-4d58-9b24-1e0d6f661cdf","depois":"ff086fb7-9ff0-48d5-9f1f-82b3ce72d112"},{"campo":"CPF__pc","antes":"02232061647","depois":"13043143400"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"02232061647","depois":"13043143400"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-C2-5896ea","depois":"UNIF22 TC044 CLIENTE Y TC044-C2-5896ea"}]`

**C3** (`TC044-C3-17ef55`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f19VYAQ"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDvZw2AK ≠ leadY 00QHZ00000dDv3h2AC"]`
- Account X intacta: `[{"campo":"Id__c","antes":"7ac8a669-9057-4b20-bb40-dc0bd6fff5b3","depois":"91e2b723-1213-4571-a2c8-b802b8d8b7f2"},{"campo":"CPF__pc","antes":"56640710447","depois":"99501345289"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C4** (`TC044-C4-2649dc`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCKtYAM"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDnqw2AC ≠ leadY 00QHZ00000dDnnk2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDnqw2AC","Id__c":"5c2ed3aa-141d-4f50-85ed-1bef2fcda62b"},{"Id":"00QHZ00000dDnnk2AC","Id__c":"ecc97f91-969b-4ef9-a98a-8e56729bc584"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"843452f0-822a-4aab-95ec-667b35276a7b","depois":"f5bb08dd-0bff-447f-a903-f9496fe5537a"},{"campo":"CPF__pc","antes":"78538508164","depois":"36894111731"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"78538508164","depois":"36894111731"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-C4-2649dc","depois":"UNIF22 TC044 CLIENTE Y TC044-C4-2649dc"}]`

**AR** (`TC044-AR-3edd54`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f0bZYAQ"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDvbX2AS ≠ leadY 00QHZ00000dDsie2AC"]`
- Account X intacta: `[{"campo":"Id__c","antes":"3bea1dd5-43c2-44b6-89d6-13dfd8b60e09","depois":"ac5d3831-dde2-45f0-a8aa-79ad850b5220"},{"campo":"CPF__pc","antes":"18452376502","depois":"23243851718"},{"campo":"PersonEmail","antes":"qa.unif22…`

**FW** (`TC044-FW-fbe75b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fQfTYAU"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDiiB2AS ≠ leadY 00QHZ00000dDpxc2AC"]`
- Account X intacta: `[{"campo":"Id__c","antes":"47433520-86f6-489d-b697-5e173738d037","depois":"8b6d7402-c624-4abb-a9ed-3dcb3d3b42ef"},{"campo":"CPF__pc","antes":"81685144918","depois":"23554010200"},{"campo":"PersonEmail","antes":"qa.unif22…`

**RC** (`TC044-RC-ed7f85`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fOfPYAU"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDqC52AK ≠ leadY 00QHZ00000dDjCM2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDqC52AK","Id__c":"16e8ae0e-4cab-4c9c-998a-3d3e364a3fb1"},{"Id":"00QHZ00000dDjCM2A0","Id__c":"057ce5fd-f709-4f80-b1a0-f40784b259f3"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"511df60f-9e45-45e8-8b60-d48e29fc4d28","depois":"81c91e4d-067d-47cf-aadd-245aec706a02"},{"campo":"CPF__pc","antes":"44920505310","depois":"09575415388"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"44920505310","depois":"09575415388"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-RC-ed7f85","depois":"UNIF22 TC044 CLIENTE Y TC044-RC-ed7f85"}]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc044.atrasado.tc044-rc-ed7f85@example.com","celular":"31973895919"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc044.atrasado.tc044-rc-ed7f85@example.com","marcador":"2026-10-21T00:56:27.000+0000"}`

**EP** (`TC044-EP-61fc3d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fBLbYAM"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDmQG2A0 ≠ leadY 00QHZ00000dDwkT2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDmQG2A0","Id__c":"c9f99a94-016a-498c-acc0-66429edffa72"},{"Id":"00QHZ00000dDwkT2AS","Id__c":"eb9dcb1b-d184-41a9-98be-0eb2e3a1da79"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"632091de-6449-4a08-87e0-0ffff11733e3","depois":"114c5390-13c8-47c1-bbf7-2fa202e1d882"},{"campo":"CPF__pc","antes":"45622210623","depois":"50631375473"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"45622210623","depois":"50631375473"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-EP-61fc3d","depois":"UNIF22 TC044 CLIENTE Y TC044-EP-61fc3d"}]`

**RL** (`TC044-RL-fd2ea9`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ewcwYAA"}`
- Lead leadY reutilizado e vinculado: `["Lead vinculado 00QHZ00000dDt3X2AS ≠ leadY 00QHZ00000dDc7d2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDt3X2AS","Id__c":"1d68dd45-ec4c-4988-88d9-34940e6dabf2"},{"Id":"00QHZ00000dDc7d2AC","Id__c":"4ebd4f80-d9b6-4bc6-8b92-b60e077ff5d2"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"d9930d4a-ece1-4675-8400-16eb5af00d49","depois":"340d8a01-98a2-4ae3-8410-7d02ae488482"},{"campo":"CPF__pc","antes":"78032652000","depois":"55355032907"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"78032652000","depois":"55355032907"},{"campo":"LastName","antes":"UNIF22 TC044 CLIENTE X TC044-RL-fd2ea9","depois":"UNIF22 TC044 CLIENTE Y TC044-RL-fd2ea9"}]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-eaec68`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f1cRYAQ"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDr6c2AC ≠ leadCandidato 00QHZ00000dDj4B2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"e7f55631-1665-4244-add2-1e71043db309","depois":"4fcff6db-4c38-4cfe-ae11-6f950f861f6e"},{"campo":"CPF__pc","antes":"45232098551","depois":"58658168700"},{"campo":"PersonEmail","antes":"qa.unif22…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"e7f55631-1665-4244-add2-1e71043db309","depois":"4fcff6db-4c38-4cfe-ae11-6f950f861f6e"},{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-pa-eaec68@example.com","depois":"qa.unif22.tc045.c…`

**CA** (`TC045-CA-f5ecf7`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ewnRYAQ"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDsto2AC ≠ leadCandidato 00QHZ00000dDvGe2AK"]`
- Account X intacta: `[{"campo":"Id__c","antes":"54d094f7-06b2-4c62-a8ff-2470b0f7f4bd","depois":"7d0f2c57-d7d1-476b-9f17-c8243f369c82"},{"campo":"CPF__pc","antes":"95009676427","depois":"96573554787"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"95009676427","depois":"96573554787"},{"campo":"LastName","antes":"UNIF22 TC045 CLIENTE X TC045-CA-f5ecf7","depois":"UNIF22 TC045 CLIENTE Y TC045-CA-f5ecf7"}]`

**ME** (`TC045-ME-bd8b87`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiNfYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDoom2AC ≠ leadCandidato 00QHZ00000dDh5n2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"24f2514f-fe4f-44dd-b115-05318adc648d","depois":"8ebe68e9-9020-48ff-9ba5-bc35448ec55e"},{"campo":"CPF__pc","antes":"38867084895","depois":"18209651714"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C1** (`TC045-C1-7dd23e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enmOYAQ"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDe9T2AS ≠ leadCandidato 00QHZ00000dDoVO2A0"]`
- Account X intacta: `[{"campo":"Id__c","antes":"6657f8af-627e-4bf9-b093-d9d2be2cd39f","depois":"227c2b36-19d5-4a06-9fc8-6874d9304b2d"},{"campo":"CPF__pc","antes":"15250181325","depois":"12375234510"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15250181325","depois":"12375234510"},{"campo":"LastName","antes":"UNIF22 TC045 CLIENTE X TC045-C1-7dd23e","depois":"UNIF22 TC045 CLIENTE Y TC045-C1-7dd23e"}]`

**C2** (`TC045-C2-e27496`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMfDYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDmuz2AC ≠ leadCandidato 00QHZ00000dDsTJ2A0"]`
- Account X intacta: `[{"campo":"Id__c","antes":"a25ca340-90ed-4a7c-bad4-88a6200a45b7","depois":"63fbf4e0-a1e9-40be-b1cb-5be9324d63ab"},{"campo":"CPF__pc","antes":"15088376510","depois":"35605291076"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"15088376510","depois":"35605291076"},{"campo":"LastName","antes":"UNIF22 TC045 CLIENTE X TC045-C2-e27496","depois":"UNIF22 TC045 CLIENTE Y TC045-C2-e27496"}]`

**C3** (`TC045-C3-7d83af`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fAvrYAE"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDgES2A0 ≠ leadCandidato 00QHZ00000dDqqO2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"5863328d-3b84-4c2f-816f-a33cf84d8cd1","depois":"e55836d5-bc2a-44ce-87a7-718cd2d6a238"},{"campo":"CPF__pc","antes":"01943330271","depois":"90284111864"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C4** (`TC045-C4-43f963`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fOnOYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDrBM2A0 ≠ leadCandidato 00QHZ00000dDnJJ2A0"]`
- Account X intacta: `[{"campo":"Id__c","antes":"3d1ffe6e-c378-40c8-a426-487a1b45117b","depois":"e60e94f5-7932-422d-92d4-1e18cc2aabce"},{"campo":"CPF__pc","antes":"46080195038","depois":"21504731786"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"46080195038","depois":"21504731786"},{"campo":"LastName","antes":"UNIF22 TC045 CLIENTE X TC045-C4-43f963","depois":"UNIF22 TC045 CLIENTE Y TC045-C4-43f963"}]`

**AR** (`TC045-AR-5c4519`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ewBYYAY"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDwm52AC ≠ leadCandidato 00QHZ00000dDvjc2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"4f11c540-9998-40a6-a267-d37282cca8dd","depois":"4d7a120a-467b-44c2-a33e-e535dc839fa4"},{"campo":"CPF__pc","antes":"41050343590","depois":"25902521530"},{"campo":"PersonEmail","antes":"qa.unif22…`

**FW** (`TC045-FW-f4cb7c`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPrUYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDsc72AC ≠ leadCandidato 00QHZ00000dDoS42AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"78c7e9ed-c033-4a8d-a7e5-cea9323b03a7","depois":"71c6fbd3-e3c7-4dfc-9366-82283c5a211a"},{"campo":"CPF__pc","antes":"16459001855","depois":"11245113852"},{"campo":"PersonEmail","antes":"qa.unif22…`

**RC** (`TC045-RC-32d0b2`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013exdpYAA"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDvd92AC ≠ leadCandidato 00QHZ00000dDqqP2AS"]`
- Account X intacta: `[{"campo":"Id__c","antes":"5e60cf13-1ab6-42cd-afc0-dc51a412c727","depois":"957b67b4-df15-4aec-acf5-057d89500265"},{"campo":"CPF__pc","antes":"81453001778","depois":"25212253551"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"81453001778","depois":"25212253551"},{"campo":"Email","antes":"qa.unif22.tc045.a.tc045-rc-32d0b2@example.com","depois":"qa.unif22.tc045.atrasado.tc045-rc-32d0b2@example.com"},{"campo":"MobileP…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc045.atrasado.tc045-rc-32d0b2@example.com","celular":"31970777036"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc045.atrasado.tc045-rc-32d0b2@example.com","marcador":"2026-10-21T00:57:34.000+0000"}`

**EP** (`TC045-EP-06f38b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enPiYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDtBW2A0 ≠ leadCandidato 00QHZ00000dDuNj2AK"]`
- Account X intacta: `[{"campo":"Id__c","antes":"dea40d9f-a786-4c38-a116-895b9469092b","depois":"bdfc7ea9-f1dc-48d8-855e-9e3da60f81ff"},{"campo":"CPF__pc","antes":"17212214841","depois":"31543915507"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"17212214841","depois":"31543915507"},{"campo":"LastName","antes":"UNIF22 TC045 CLIENTE X TC045-EP-06f38b","depois":"UNIF22 TC045 CLIENTE Y TC045-EP-06f38b"}]`

**RL** (`TC045-RL-f6c0c1`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiOnYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDwW02AK ≠ leadCandidato 00QHZ00000dDpmU2AS"]`
- Account X intacta: `[{"campo":"Id__c","antes":"3baebe57-0772-4f7e-8eb8-9d674329f35c","depois":"de4fe21f-9946-4197-b884-12bbbc503910"},{"campo":"CPF__pc","antes":"38034336491","depois":"28713801040"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"38034336491","depois":"28713801040"},{"campo":"LastName","antes":"UNIF22 TC045 CLIENTE X TC045-RL-f6c0c1","depois":"UNIF22 TC045 CLIENTE Y TC045-RL-f6c0c1"}]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

_Observação:_ Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).

**PA** (`TC046-PA-a989c1`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ewBaYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDuxC2AS ≠ leadCandidato 00QHZ00000dDsqd2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"66fe0d30-09c7-470a-a51d-0895b6d8944c","depois":"48e7af72-f156-40ed-89c1-bf7411f980d7"},{"campo":"CPF__pc","antes":"44637570611","depois":"29011339401"},{"campo":"PersonEmail","antes":"qa.unif22…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"66fe0d30-09c7-470a-a51d-0895b6d8944c","depois":"48e7af72-f156-40ed-89c1-bf7411f980d7"},{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-pa-a989c1@example.com","depois":"qa.unif22.tc046.c…`

**CA** (`TC046-CA-dc9694`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fR21YAE"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDVW82AO ≠ leadCandidato 00QHZ00000dDtBX2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"3610dc58-1d36-43c8-917b-0ef281918292","depois":"e5690975-4644-4299-8ddb-d7ceae4fc35c"},{"campo":"CPF__pc","antes":"33367663034","depois":"35023810119"},{"campo":"PersonEmail","antes":"qa.unif22…`

**ME** (`TC046-ME-8fede7`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fAeBYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDlMD2A0 ≠ leadCandidato 00QHZ00000dDg1Z2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"241b90b1-c77d-4fc2-8ab4-be5bcac9ff1a","depois":"9e41acb7-c1f1-4845-9956-085ff309316b"},{"campo":"CPF__pc","antes":"45046445760","depois":"51081200103"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C1** (`TC046-C1-d2886d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiZqYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDtOX2A0 ≠ leadCandidato 00QHZ00000dDqDk2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"9a16d394-71bc-4387-a78e-7ff3b5178e3b","depois":"32853f14-7776-460f-af66-3c106d0d6218"},{"campo":"CPF__pc","antes":"26286033653","depois":"35171530289"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C2** (`TC046-C2-5b5dec`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPbNYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDnJK2A0 ≠ leadCandidato 00QHZ00000dDx0b2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"ec134b6b-7e37-44d7-b353-a4462e2eebf5","depois":"b47c8503-02f0-4142-aa9c-989048b52054"},{"campo":"CPF__pc","antes":"13539018310","depois":"17210114203"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C3** (`TC046-C3-f861e7`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPVGYA2"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDhyb2AC ≠ leadCandidato 00QHZ00000dDobl2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"90a1bb4d-640e-4be6-957b-7c6f568fb11d","depois":"f211b2ec-d895-40fd-877f-c425d6ab5117"},{"campo":"CPF__pc","antes":"13207482449","depois":"82004964570"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C4** (`TC046-C4-cf2c42`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013enHlYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDjfO2AS ≠ leadCandidato 00QHZ00000dDtLD2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"efdb4d65-aa53-42b5-8f83-74a945c70273","depois":"935a0cfe-131a-4c56-b267-b42a54ef96c7"},{"campo":"CPF__pc","antes":"43105258655","depois":"08204043228"},{"campo":"PersonEmail","antes":"qa.unif22…`

**AR** (`TC046-AR-7d81bf`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fBK0YAM"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDg1a2AC ≠ leadCandidato 00QHZ00000dDjDs2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"36bc201a-c5c8-4910-a5f9-b3876ba522e1","depois":"226bd832-8c8c-44dd-82a2-8f14ee5c5412"},{"campo":"CPF__pc","antes":"40369762576","depois":"57032032109"},{"campo":"PersonEmail","antes":"qa.unif22…`

**FW** (`TC046-FW-341399`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013exWtYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDoYT2A0 ≠ leadCandidato 00QHZ00000dDajL2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"82b48a02-6b20-4a15-bcca-25554f6f199c","depois":"a1073bdf-b4b7-45d2-b22d-4a26a2eefeee"},{"campo":"CPF__pc","antes":"38752020070","depois":"23423635916"},{"campo":"PersonEmail","antes":"qa.unif22…`

**RC** (`TC046-RC-c78f62`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCWDYA2"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDcsM2AS ≠ leadCandidato 00QHZ00000dDvzj2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"2449f8d0-ffc0-43be-95b6-b2b518f03dd5","depois":"a556bc0c-bc38-43f6-a66a-021a11312abe"},{"campo":"CPF__pc","antes":"23216338169","depois":"75323909005"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc046.atrasado.tc046-rc-c78f62@example.com","celular":"31988021526"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc046.atrasado.tc046-rc-c78f62@example.com","marcador":"2026-10-21T00:58:38.000+0000"}`

**EP** (`TC046-EP-e6b47f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9yIYAQ"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDfYW2A0 ≠ leadCandidato 00QHZ00000dDvdB2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"7d4b3d45-5868-4ff2-b58e-b4c37e2d5490","depois":"fc7631d0-989a-4be8-a6b5-2c836c51575b"},{"campo":"CPF__pc","antes":"34492210601","depois":"57658153753"},{"campo":"PersonEmail","antes":"qa.unif22…`

**RL** (`TC046-RL-8faa3a`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fRDJYA2"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDqnD2AS ≠ leadCandidato 00QHZ00000dDuUB2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"bc9eb3c3-6e49-4a04-9e99-b1dd59f9754f","depois":"2dbce289-424f-4cb5-aaf3-2fbf2ea67043"},{"campo":"CPF__pc","antes":"81355362679","depois":"40561256357"},{"campo":"PersonEmail","antes":"qa.unif22…`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

_Observação:_ A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).

**PA** (`TC047-PA-75a4eb`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fM7KYAU"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDtBY2A0 ≠ leadY 00QHZ00000dDqXC2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDtBY2A0","Id__c":"354be3e6-7b9e-496e-8cd7-a88ec9a14493"},{"Id":"00QHZ00000dDqXC2A0","Id__c":"ace9f2c6-1136-4bf8-bd31-ce31dba52de2"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"04075f26-e493-450e-ac71-c8dff7cd44b9","depois":"08137ce2-54b4-463f-bfb8-20ab78c3bc7e"},{"campo":"CPF__pc","antes":"41373002166","depois":"42173813285"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"41373002166","depois":"42173813285"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-pa-75a4eb@example.com","depois":"qa.unif22.tc047.c.tc047-pa-75a4eb@example.com"},{"campo":"MobilePhone","…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"04075f26-e493-450e-ac71-c8dff7cd44b9","depois":"08137ce2-54b4-463f-bfb8-20ab78c3bc7e"},{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-pa-75a4eb@example.com","depois":"qa.unif22.tc047.c…`

**CA** (`TC047-CA-659ad1`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fAayYAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDk8L2AS ≠ leadY 00QHZ00000dDslo2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDk8L2AS","Id__c":"80e61d55-cd47-402e-b96f-9bede8fa1896"},{"Id":"00QHZ00000dDslo2AC","Id__c":"a5a21d8c-c780-4aed-9545-a21f1b321b3b"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"b7e64ce5-2292-4df7-8259-e369250266c5","depois":"1e5df9ca-68e9-4865-a729-18b027c46d49"},{"campo":"CPF__pc","antes":"97285172383","depois":"28568673678"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"97285172383","depois":"28568673678"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-ca-659ad1@example.com","depois":"qa.unif22.tc047.c.tc047-ca-659ad1@example.com"},{"campo":"MobilePhone","…`

**ME** (`TC047-ME-6b36ce`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fP56YAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDx3p2AC ≠ leadY 00QHZ00000dDx2E2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDx3p2AC","Id__c":"a7a0b512-902b-421f-a985-a26e2815eade"},{"Id":"00QHZ00000dDx2E2AS","Id__c":"1edbae17-5ccf-4641-ab23-ef9843d1cae5"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"6194ecca-2b50-415b-814d-4df553a2a564","depois":"29b5caf2-4c07-4302-8241-da73bd3fc875"},{"campo":"CPF__pc","antes":"55350825208","depois":"53316103589"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"55350825208","depois":"53316103589"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-me-6b36ce@example.com","depois":"qa.unif22.tc047.c.tc047-me-6b36ce@example.com"},{"campo":"MobilePhone","…`

**C1** (`TC047-C1-a8cbec`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fAJFYA2"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDkem2AC ≠ leadY 00QHZ00000dDfYX2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDkem2AC","Id__c":"3727c1c7-3dad-44d3-839d-42ef97edeb5e"},{"Id":"00QHZ00000dDfYX2A0","Id__c":"37921941-bc55-4777-926b-70e447b2b7d5"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"4367497f-8987-418e-a3f1-944918d55b32","depois":"8533a052-3c52-46d8-9ff3-f794a31ca23f"},{"campo":"CPF__pc","antes":"37637154106","depois":"15411515343"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"37637154106","depois":"15411515343"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c1-a8cbec@example.com","depois":"qa.unif22.tc047.c.tc047-c1-a8cbec@example.com"},{"campo":"MobilePhone","…`

**C2** (`TC047-C2-0db303`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f93qYAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDwis2AC ≠ leadY 00QHZ00000dDq7N2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDwis2AC","Id__c":"d7b24a6e-2150-4b6d-929f-47cebc0fe5c4"},{"Id":"00QHZ00000dDq7N2AS","Id__c":"3551bdcc-b22e-4f00-b54f-add9399a2535"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"96b9907a-317a-4f64-a5d4-c6ab764932a2","depois":"d56e39c1-ad31-4f18-91e7-c1fda47f464d"},{"campo":"CPF__pc","antes":"92473170533","depois":"53253551474"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"92473170533","depois":"53253551474"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c2-0db303@example.com","depois":"qa.unif22.tc047.c.tc047-c2-0db303@example.com"},{"campo":"MobilePhone","…`

**C3** (`TC047-C3-97c628`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fASeYAM"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDf0E2AS ≠ leadY 00QHZ00000dDutz2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDf0E2AS","Id__c":"e6d874ce-f76d-4bdd-95ab-59c4d96bed14"},{"Id":"00QHZ00000dDutz2AC","Id__c":"83760e54-85be-4536-b103-03109cb568c2"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"99042a56-1532-434a-993a-ecfbbd5e08d9","depois":"d6abcb82-854d-4160-8ad8-bff2adce89dd"},{"campo":"CPF__pc","antes":"23101649501","depois":"44047433519"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23101649501","depois":"44047433519"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c3-97c628@example.com","depois":"qa.unif22.tc047.c.tc047-c3-97c628@example.com"},{"campo":"MobilePhone","…`

**C4** (`TC047-C4-fd1443`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ey0IYAQ"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDx3q2AC ≠ leadY 00QHZ00000dDt562AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDx3q2AC","Id__c":"1ca52abb-acfa-45c9-b9a0-bcc376931712"},{"Id":"00QHZ00000dDt562AC","Id__c":"ea9fe9e6-244b-416f-ba32-05958cbd6dee"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"2193fa8a-d641-494b-ae5c-24aac4ca6459","depois":"c22aac8c-5a89-4131-8ac9-85af66bd10a5"},{"campo":"CPF__pc","antes":"32306454213","depois":"55824371180"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"32306454213","depois":"55824371180"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c4-fd1443@example.com","depois":"qa.unif22.tc047.c.tc047-c4-fd1443@example.com"},{"campo":"MobilePhone","…`

**AR** (`TC047-AR-d8793b`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ez65YAA"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDv0U2AS ≠ leadY 00QHZ00000dDw7o2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDv0U2AS","Id__c":"a702e5ba-2f36-49c8-81d7-47a4eb0280a9"},{"Id":"00QHZ00000dDw7o2AC","Id__c":"4ed31eca-dbe8-4c41-9712-68da44f8acbf"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"097c805a-3132-4596-8f04-9f5e44768c74","depois":"5bdd079f-6ddf-40f4-bfe0-a45742abf010"},{"campo":"CPF__pc","antes":"16848151343","depois":"35010256533"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"16848151343","depois":"35010256533"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-ar-d8793b@example.com","depois":"qa.unif22.tc047.c.tc047-ar-d8793b@example.com"},{"campo":"MobilePhone","…`

**FW** (`TC047-FW-2fe914`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fDC8YAM"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDprB2AS ≠ leadY 00QHZ00000dDk0K2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDprB2AS","Id__c":"c4d79c6f-18e2-4d79-aa97-4757e95c7e25"},{"Id":"00QHZ00000dDk0K2AS","Id__c":"83c31202-fb42-414f-ba82-d18fe508e37f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"6591e340-5e9b-4cf7-aead-7e7d6a1d4a0e","depois":"e24eff49-6f84-4f60-9e10-07906cfa1843"},{"campo":"CPF__pc","antes":"21359035400","depois":"64833482312"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"21359035400","depois":"64833482312"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-fw-2fe914@example.com","depois":"qa.unif22.tc047.c.tc047-fw-2fe914@example.com"},{"campo":"MobilePhone","…`

**RC** (`TC047-RC-48796e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ejXlYAI"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDt9G2AS ≠ leadY 00QHZ00000dDjaY2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDt9G2AS","Id__c":"2ddbd493-e67f-45c6-b445-bba5139d78af"},{"Id":"00QHZ00000dDjaY2AS","Id__c":"90eae875-16f7-49ca-a18d-3da7a89d484c"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"af8f4c60-86f6-449d-9b61-e7cf3ab83ef8","depois":"0eefde22-d14e-4453-ba74-62125a861e81"},{"campo":"CPF__pc","antes":"83914540702","depois":"02055521454"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"83914540702","depois":"02055521454"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-rc-48796e@example.com","depois":"qa.unif22.tc047.atrasado.tc047-rc-48796e@example.com"},{"campo":"MobileP…`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc047.atrasado.tc047-rc-48796e@example.com","celular":"31977216127"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc047.atrasado.tc047-rc-48796e@example.com","marcador":"2026-10-21T00:59:43.000+0000"}`

**EP** (`TC047-EP-01d663`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCveYAE"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDwB12AK ≠ leadY 00QHZ00000dDecZ2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDwB12AK","Id__c":"6fd557a0-8b59-4246-aab4-15fac10c609f"},{"Id":"00QHZ00000dDecZ2AS","Id__c":"220f85fc-d6a2-4889-9b64-ef0da1918fee"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"d2cb4d78-9df0-4319-806b-04673ee0b9c4","depois":"1491c203-40b9-455f-8208-32e7dc9367b5"},{"campo":"CPF__pc","antes":"90385999003","depois":"41725704102"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"90385999003","depois":"41725704102"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-ep-01d663@example.com","depois":"qa.unif22.tc047.c.tc047-ep-01d663@example.com"},{"campo":"MobilePhone","…`

**RL** (`TC047-RL-89598f`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f7TVYAY"}`
- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado 00QHZ00000dDuFg2AK ≠ leadY 00QHZ00000dDwNu2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDuFg2AK","Id__c":"86c99c15-9ed5-4d9b-967a-0b94a65fe073"},{"Id":"00QHZ00000dDwNu2AK","Id__c":"03f36f3c-a6dc-4162-a329-ada6fa9cac07"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"105e507d-3a49-4588-b2af-a1be9c880358","depois":"69ec6eea-5ed6-44a7-98d8-3389100605a5"},{"campo":"CPF__pc","antes":"16058413230","depois":"84353154796"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"16058413230","depois":"84353154796"},{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-rl-89598f@example.com","depois":"qa.unif22.tc047.c.tc047-rl-89598f@example.com"},{"campo":"MobilePhone","…`

### TC-048 — Lead Y preso com compatibilidade total

**PA** (`TC048-PA-a56099`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fRMzYAM"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"21a5f149-8b11-4c1f-9f55-7c17aab9a882"}`
- Account X intacta: `[{"campo":"Id__c","antes":"ebecab89-f406-41d9-9ca7-44d483775cfb","depois":"1549f71e-f7d7-44ee-b171-f662cf43ddc7"},{"campo":"CPF__pc","antes":"88274437209","depois":"17034594902"},{"campo":"PersonEmail","antes":"qa.unif22…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"ebecab89-f406-41d9-9ca7-44d483775cfb","depois":"1549f71e-f7d7-44ee-b171-f662cf43ddc7"},{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-pa-a56099@example.com","depois":"qa.unif22.tc048.c…`

**CA** (`TC048-CA-f1d985`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fCKuYAM"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"e86090fb-881f-4f24-801c-c7f49ad3cfd8"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDvTV2A0","Id__c":"e86090fb-881f-4f24-801c-c7f49ad3cfd8"},{"Id":"00QHZ00000dDjaZ2AS","Id__c":"67ae07ad-5785-4b07-8a0b-bb71a16eab5f"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"09c7ae27-28ba-4655-b751-00a5d5c50a0b","depois":"0a5c7baf-be41-4d30-87a5-59b5a7519637"},{"campo":"CPF__pc","antes":"98426476171","depois":"44324379793"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"98426476171","depois":"44324379793"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-CA-f1d985","depois":"UNIF22 TC048 CLIENTE Y TC048-CA-f1d985"}]`

**ME** (`TC048-ME-767ff4`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fB7MYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"25a51e08-b4bf-4b17-89c7-fd761492aab1"}`
- Account X intacta: `[{"campo":"Id__c","antes":"6332808f-6e60-48d2-87a6-79fca00d8652","depois":"702f30d8-07d5-492a-afd1-0076b740bc1b"},{"campo":"CPF__pc","antes":"15556882096","depois":"50393355209"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C1** (`TC048-C1-290f24`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eyBaYAI"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"d9cd8dcc-c3e4-438e-b098-6cef68dfb5e7"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDpZQ2A0","Id__c":"d9cd8dcc-c3e4-438e-b098-6cef68dfb5e7"},{"Id":"00QHZ00000dDcm72AC","Id__c":"edfff1c1-4a95-4f83-a1c8-01231ee0059e"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"efc2903f-0585-4d83-95ee-f10328aaf1dd","depois":"e27c22f2-71a6-43be-99c2-5ca40afd0f14"},{"campo":"CPF__pc","antes":"06924155138","depois":"50010101870"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"06924155138","depois":"50010101870"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-C1-290f24","depois":"UNIF22 TC048 CLIENTE Y TC048-C1-290f24"}]`

**C2** (`TC048-C2-9f78ef`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fMqNYAU"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"eb0b3ac1-90a3-4c31-9604-d74966ad4612"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDxLZ2A0","Id__c":"eb0b3ac1-90a3-4c31-9604-d74966ad4612"},{"Id":"00QHZ00000dDi6W2AS","Id__c":"a177e5e7-7ad3-4362-8dda-37522daece8b"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"6e1ae902-088b-430d-a0b6-503431d19f35","depois":"45a9c724-836c-4e82-a5ee-65560d1fc643"},{"campo":"CPF__pc","antes":"36981474913","depois":"06067640970"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"36981474913","depois":"06067640970"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-C2-9f78ef","depois":"UNIF22 TC048 CLIENTE Y TC048-C2-9f78ef"}]`

**C3** (`TC048-C3-7ae524`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eiZsYAI"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"5ac72291-0284-4dcb-8a45-71e139e3d4ed"}`
- Account X intacta: `[{"campo":"Id__c","antes":"c3bd676a-c008-4801-8d44-d8120991d968","depois":"4963746b-bb44-42f3-9d10-e1a885bfaebf"},{"campo":"CPF__pc","antes":"15355335365","depois":"60085337986"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C4** (`TC048-C4-9ee80e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f9I8YAI"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"1c3d9bc3-5490-43a5-a0bb-e27d4fde014e"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDfoj2AC","Id__c":"1c3d9bc3-5490-43a5-a0bb-e27d4fde014e"},{"Id":"00QHZ00000dDqQj2AK","Id__c":"4c079e7b-a58c-4be1-bb8e-fe0de93a3bc6"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"0b0e6b69-2bf0-47a4-a9ed-877c4cd3a494","depois":"30452108-edc0-4b16-bd7c-2b965328529d"},{"campo":"CPF__pc","antes":"23207293301","depois":"02010331516"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"23207293301","depois":"02010331516"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-C4-9ee80e","depois":"UNIF22 TC048 CLIENTE Y TC048-C4-9ee80e"}]`

**AR** (`TC048-AR-531a67`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLYMYA2"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"5328375d-8eee-4a6f-9cbf-c4fb9680b797"}`
- Account X intacta: `[{"campo":"Id__c","antes":"0906bfa8-0c26-4cf4-b7c2-dc5c6d5fc581","depois":"e3938179-76a5-4185-ba61-217def9f15fd"},{"campo":"CPF__pc","antes":"33761440367","depois":"54116886122"},{"campo":"PersonEmail","antes":"qa.unif22…`

**FW** (`TC048-FW-ba0690`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f2NPYAY"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"19c3d454-d1fe-43a5-a606-55a52262f66f"}`
- Account X intacta: `[{"campo":"Id__c","antes":"e55f196c-4847-4838-974b-88df90ea34a3","depois":"a0a4ef3c-31fa-4a14-b9aa-09f7b7fb9255"},{"campo":"CPF__pc","antes":"48018350230","depois":"19610954243"},{"campo":"PersonEmail","antes":"qa.unif22…`

**RC** (`TC048-RC-17b096`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fRQEYA2"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"ab971fde-9138-42a1-994b-04eee6c6b48a"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDaLq2AK","Id__c":"ab971fde-9138-42a1-994b-04eee6c6b48a"},{"Id":"00QHZ00000dDWbd2AG","Id__c":"2b22be4c-c231-48b1-a059-21ed2ba0c21d"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"7c7e5ee8-4531-4c36-a268-772f472cd195","depois":"8636a40c-2fdf-4ef9-8d3d-d96f7f088205"},{"campo":"CPF__pc","antes":"35030634398","depois":"31935703030"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"35030634398","depois":"31935703030"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-RC-17b096","depois":"UNIF22 TC048 CLIENTE Y TC048-RC-17b096"}]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc048.atrasado.tc048-rc-17b096@example.com","celular":"31972374316"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc048.atrasado.tc048-rc-17b096@example.com","marcador":"2026-10-21T01:01:04.000+0000"}`

**EP** (`TC048-EP-3b436d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013emgjYAA"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"74229f25-994a-4b9f-bfb0-b2b17fc167eb"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDxQP2A0","Id__c":"74229f25-994a-4b9f-bfb0-b2b17fc167eb"},{"Id":"00QHZ00000dDtxv2AC","Id__c":"6b0015a7-5a16-4fa1-ac91-65283f4ef0fe"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"a60df7b6-efb3-4f48-8f2f-7f20f84ed62e","depois":"f50003ae-ef27-4f66-b2bf-5d9d1a48052c"},{"campo":"CPF__pc","antes":"54953001222","depois":"58940115589"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"54953001222","depois":"58940115589"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-EP-3b436d","depois":"UNIF22 TC048 CLIENTE Y TC048-EP-3b436d"}]`

**RL** (`TC048-RL-11f8a5`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f8sSYAQ"}`
- Caso C: Account aprovada sem IdProspect: `{"obtido":"cf5e18c8-c92d-44cf-a1a9-8a321ae5a96d"}`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000dDxS12AK","Id__c":"cf5e18c8-c92d-44cf-a1a9-8a321ae5a96d"},{"Id":"00QHZ00000dDe4f2AC","Id__c":"baa2e31f-66c4-4d57-a825-636cc0e79907"}]}`
- Account X intacta: `[{"campo":"Id__c","antes":"422d2421-795c-46d4-ad2a-956051bc15b0","depois":"6cd3c1e7-440c-4834-a88f-c76cea010a7d"},{"campo":"CPF__pc","antes":"81041002386","depois":"20000538400"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"81041002386","depois":"20000538400"},{"campo":"LastName","antes":"UNIF22 TC048 CLIENTE X TC048-RL-11f8a5","depois":"UNIF22 TC048 CLIENTE Y TC048-RL-11f8a5"}]`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-5412e6`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fLeOYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDxTd2AK ≠ leadCandidato 00QHZ00000dDxVF2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"1682ceb1-3a75-44e8-8e9b-190f532bc9fc","depois":"c9fef9aa-88e1-4eee-b4c7-76dce910565a"},{"campo":"CPF__pc","antes":"68073533910","depois":"14302552425"},{"campo":"PersonEmail","antes":"qa.unif22…`
- PA: Account X intacta depois dos parciais: `[{"campo":"Id__c","antes":"1682ceb1-3a75-44e8-8e9b-190f532bc9fc","depois":"c9fef9aa-88e1-4eee-b4c7-76dce910565a"},{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-pa-5412e6@example.com","depois":"qa.unif22.tc049.c…`

**CA** (`TC049-CA-c8dccf`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ejR0YAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDpB92AK ≠ leadCandidato 00QHZ00000dDxWr2AK"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cb73f0a4-5769-4d65-bd34-1f394e4e6aa8","depois":"0fbef9d9-5835-40bd-9b5f-60794ce2f7bf"},{"campo":"CPF__pc","antes":"05031203323","depois":"34770323735"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"05031203323","depois":"34770323735"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-CA-c8dccf","depois":"UNIF22 TC049 CLIENTE Y TC049-CA-c8dccf"}]`

**ME** (`TC049-ME-d192a6`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ekJrYAI"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDxYT2A0 ≠ leadCandidato 00QHZ00000dDfGu2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"1443e1cb-8b44-4512-a09e-44a4b307d2f0","depois":"9bfccb1c-0c9c-431c-befb-c228438b4f15"},{"campo":"CPF__pc","antes":"30813240760","depois":"54051803511"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C1** (`TC049-C1-95cde8`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ezu2YAA"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDgcn2AC ≠ leadCandidato 00QHZ00000dDflS2AS"]`
- Account X intacta: `[{"campo":"Id__c","antes":"cec0639d-5ce6-4606-9171-57efa368308a","depois":"1fd74315-d256-4aea-8978-89769c6296d6"},{"campo":"CPF__pc","antes":"01933155051","depois":"21385838485"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"01933155051","depois":"21385838485"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-C1-95cde8","depois":"UNIF22 TC049 CLIENTE Y TC049-C1-95cde8"}]`

**C2** (`TC049-C2-46e41d`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013eouiYAA"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDkTL2A0 ≠ leadCandidato 00QHZ00000dDv6y2AC"]`
- Account X intacta: `[{"campo":"Id__c","antes":"eb2872e3-9416-4ce5-b81b-368c031a865d","depois":"a836f0ed-f111-4028-a4b3-f72ea74297c5"},{"campo":"CPF__pc","antes":"17340104011","depois":"29359822400"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"17340104011","depois":"29359822400"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-C2-46e41d","depois":"UNIF22 TC049 CLIENTE Y TC049-C2-46e41d"}]`

**C3** (`TC049-C3-97a685`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f84YYAQ"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDv6x2AC ≠ leadCandidato 00QHZ00000dDg1b2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"87c9e990-2e71-4a93-8283-8b25bc2c1c6d","depois":"170596e0-29d4-4f83-94e8-e96af410f276"},{"campo":"CPF__pc","antes":"40618664009","depois":"59153252462"},{"campo":"PersonEmail","antes":"qa.unif22…`

**C4** (`TC049-C4-066343`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013f8HXYAY"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDcMh2AK ≠ leadCandidato 00QHZ00000dDq442AC"]`
- Account X intacta: `[{"campo":"Id__c","antes":"dd15c876-ab32-4c18-958b-0f116b6a579f","depois":"175e96b3-2d14-4bcb-821d-ac8d3c6b08dd"},{"campo":"CPF__pc","antes":"11632524333","depois":"52621025145"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"11632524333","depois":"52621025145"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-C4-066343","depois":"UNIF22 TC049 CLIENTE Y TC049-C4-066343"}]`

**AR** (`TC049-AR-f68db0`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013elMXYAY"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDvlF2AS ≠ leadCandidato 00QHZ00000dDkUx2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"bdabb632-1547-42bf-823c-db03ae7eef33","depois":"da0a2556-4db0-4d7a-bd0b-ec52d84d7f30"},{"campo":"CPF__pc","antes":"84108648005","depois":"74523712670"},{"campo":"PersonEmail","antes":"qa.unif22…`

**FW** (`TC049-FW-733336`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fPgGYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDeJ52AK ≠ leadCandidato 00QHZ00000dDkl62AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account X intacta: `[{"campo":"Id__c","antes":"c6611257-1d81-4e2f-aeb8-a7ba01743e48","depois":"fc0c6327-d02b-49d8-b2ca-7b98975fff06"},{"campo":"CPF__pc","antes":"81513847279","depois":"43210178313"},{"campo":"PersonEmail","antes":"qa.unif22…`

**RC** (`TC049-RC-174e70`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013ekNFYAY"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDwSk2AK ≠ leadCandidato 00QHZ00000dDlR02AK"]`
- Account X intacta: `[{"campo":"Id__c","antes":"b660262a-0aad-4d5a-95c1-adaaa219f12f","depois":"4919f18e-927a-42a6-b19c-bc3685246e25"},{"campo":"CPF__pc","antes":"03222334374","depois":"83836509733"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"03222334374","depois":"83836509733"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-RC-174e70","depois":"UNIF22 TC049 CLIENTE Y TC049-RC-174e70"}]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc049.atrasado.tc049-rc-174e70@example.com","celular":"31976059331"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc049.atrasado.tc049-rc-174e70@example.com","marcador":"2026-10-21T01:02:13.000+0000"}`

**EP** (`TC049-EP-4b5f5e`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013emqLYAQ"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDvzk2AC ≠ leadCandidato 00QHZ00000dDhIf2AK"]`
- Account X intacta: `[{"campo":"Id__c","antes":"ac8673f5-efc8-4b82-8a18-2ca83ab51ee5","depois":"ae4c7e13-7cf4-4c71-aacd-377064909009"},{"campo":"CPF__pc","antes":"38404979812","depois":"43282757042"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"38404979812","depois":"43282757042"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-EP-4b5f5e","depois":"UNIF22 TC049 CLIENTE Y TC049-EP-4b5f5e"}]`

**RL** (`TC049-RL-a6e246`, ❌ diverge):

- Account aprovada é nova: `{"obtido":"001HZ000013fRgMYAU"}`
- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dDaIo2AK ≠ leadCandidato 00QHZ00000dDgeK2AS"]`
- Account X intacta: `[{"campo":"Id__c","antes":"58c90c77-9db6-465f-a555-e2e1982caeb9","depois":"72e2aaf3-4012-492c-a437-b7a88a0dba09"},{"campo":"CPF__pc","antes":"90424245671","depois":"31360130420"},{"campo":"PersonEmail","antes":"qa.unif22…`
- Lead X intacto: `[{"campo":"CPF__c","antes":"90424245671","depois":"31360130420"},{"campo":"LastName","antes":"UNIF22 TC049 CLIENTE X TC049-RL-a6e246","depois":"UNIF22 TC049 CLIENTE Y TC049-RL-a6e246"}]`

### TC-062 — Account Y com IdCliente e sem IdProspect

_Observação:_ Eventos vão sem idprospectsalesforce.

**PA** (`TC062-PA-a346ea`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC062-CA-492091`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC062-ME-fbf571`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC062-C1-3ff97f`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC062-C2-c91dc9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c2-c91dc9@example.com","depois":"qa.unif22.tc062.c.tc062-c2-c91dc9@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c2-c91dc9@example.com","depois":"qa.unif22.tc062.c.tc062-c2-c91dc9@example.com"}]`

**C3** (`TC062-C3-a3117f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c3-a3117f@example.com","depois":"qa.unif22.tc062.c.tc062-c3-a3117f@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-21T01:03:11.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c3-a3117f@example.com","depois":"qa.unif22.tc062.c.tc062-c3-a3117f@example.com"}]`

**C4** (`TC062-C4-bcc006`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC062-AR-fdeb1d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-21T01:03:24.000+0000"}]`
- Opportunity na Account aprovada: `{"conta":"001HZ000013ejFtYAI","oportunidade":"001HZ000013eatoYAA"}`

**AM** (`TC062-AM-3fd747`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Opportunity na Account aprovada: `{"conta":"001HZ000013fBVMYA2","oportunidade":"001HZ000013f0jvYAA"}`

**FW** (`TC062-FW-5c3c79`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-21T01:03:24.000+0000"}]`
- Opportunity na Account aprovada: `{"conta":"001HZ000013elW8YAI","oportunidade":"001HZ000013fSPWYA2"}`

**RC** (`TC062-RC-b0161b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc062.atrasado.tc062-rc-b0161b@example.com","celular":"31978861805"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc062.atrasado.tc062-rc-b0161b@example.com","marcador":"2026-10-21T01:03:47.000+0000"}`

**EP** (`TC062-EP-86e596`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC062-RL-da3254`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

## Tempos

Média de 484 RUNs, em segundos: total 29.9; massa 3.8; cadeia 16.9 (dos quais 6.6 esperando jobs); verificação 0.3; cleanup 6.4.

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

