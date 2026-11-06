# Resultado do runbook da Unificação 2.2 — recorte 2.2 na `mrv-devDan`

Execução de 2026-11-05T23:03:12.737Z a 2026-11-06T00:31:49.333Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**775 RUNs:** 774 conformes, 1 divergentes, 0 com erro de execução.

> **199 dos RUNs são de TCs fora do modelo** (marcados na tabela e
> listados na seção "Fora do modelo"): variantes que não estão na planilha e TCs
> que o harness não monta como a planilha descreve. Um conforme neles não aprova
> o TC da planilha.

> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os
> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em
> que o caminho alcança X, "Account X intacta" diverge até os guards de
> identidade serem implantados. Veja `docs/handoff-investigacao-tc001-bug4.md`.

> **Perfis AR, AM, FW, RC, EP, RL, RP, RE, RF e AS (ordens reais):** a ordem que
> o MS de crédito, o WebJob e o MS Clientes produzem, a reentrega atrasada do
> Event Grid (RP, RE e RF) e a aprovação de pessoa nova com a Account nascendo
> depois da PAC e da jornada (AS). "—" é TC em que o perfil não se aplica: no AM, a pessoa
> aprovada ainda não existe no MS Clientes; no RP, no RE, no RF e no AS, ela já
> tem Account; no AS, também a jornada sem IdCliente do TC-001-MSI e do
> TC-001-MPC, que ele trocaria. Veja a seção 7.2 de
> `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Resumo por TC

| TC | Cenário | PA (ORDEM-PARCIAIS-ANTES) | CA (ORDEM-CLIENTE-ANTES) | ME (ORDEM-MESMO-EVENTTIME) | C1 (CAMINHO-1-PAC-SEM-IDCLIENTE-E-PENDENCIA) | C2 (CAMINHO-2-PAC-COM-IDCLIENTE-DA-JORNADA-E-PENDENCIA) | C3 (CAMINHO-3-PENDENCIA-ANTES-DA-PAC) | C4 (CAMINHO-4-CONTESTACAO-PENDENTE) | AR (APROVACAO-REAL-PESSOA-NOVA) | AM (APROVACAO-REAL-PESSOA-EXISTENTE) | FW (FALHA-E-REPETICAO-DO-WEBJOB) | RC (RELOGIO-DO-CREDITO) | EP (ECO-ANTES-DO-PARCIAL) | RL (REPOSTAGEM-EM-LOTE) | RP (REENTREGA-DEPOIS-DA-PAC-APROVADA) | RE (REENTREGA-ANTES-DO-ECO) | RF (REENTREGA-NO-FIM) | AS (APROVACAO-SIMULTANEA-PESSOA-NOVA) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-001-XSI | CPF divergente com os mesmos contatos, com X sem IdCliente _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-001-MSI | Jornada sem IdCliente, achada só pelo prospect de X, depois da PAC aprovada _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — |
| TC-001-MPC | Jornada sem IdCliente, com o CPF de Y no proponentecredito _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — |
| TC-002 | CPF, e-mail e celular divergentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-002-INT | CPF, e-mail e celular divergentes, com celular internacional de mesmos dígitos finais que o de um Lead brasileiro _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-005 | Account Y existente, Lead Y ausente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-005-PSL | Account Y existente com IdProspect sem Lead, Lead Y ausente _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-006 | Account Y e Lead Y órfão existentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-007 | Contatos de Y pertencem ao Lead Z | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-009 | Account Y incompleta e Lead Y existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-010 | Colisão apenas de e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-011 | Colisão apenas de celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-012 | Fallback por e-mail em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-013 | Fallback por celular em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-016 | Y inexistente e colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-017 | Y inexistente; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-018 | Y inexistente; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-020 | Account Y só com CPF; nenhum Lead | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-021 | Account Y com prospect divergente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-022 | Account Y incompleta e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-023 | Account Y inexistente e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024-CLI | Jornada iniciada com o prospect preso à Account de outra pessoa (saída da 2.1) _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-026 | Dois Leads Y; reutilizar o livre | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-040 | Venda Genérica aprova CPF Y diferente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040-IDP | Venda Genérica com o IdCliente de Y só no idProponente das PACs _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040-IDX | Venda Genérica com o IdCliente de X no idProponente das PACs de Y _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-041 | Venda Genérica com colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge |
| TC-042 | Venda Genérica; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-053 | Proponente com Account/IdCliente existente _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |
| TC-054 | Proponente X aprovado como Y na Venda Genérica _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-055 | Priorizar Lead Y por CPF na Venda Genérica _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-056 | Repetição funcional do TC-055 _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-057 | Proponente Y colide totalmente com X _(fora do modelo)_ | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — | — |

## Divergências e erros

### TC-041 — Venda Genérica com colisão total

_Observação:_ Modela o Cliente da Jornada (Opportunity UnidadeVendaGenerica + ClientesRelacionados__c), que o runbook cobra em "Clientes da Jornada" e o harness não lia: bug do TC-041 na staging (05/11).

**AS** (`TC041-AS-2435e5`, ❌ diverge):

- Cliente da Jornada na Account aprovada (Y), único e principal: `[{"cliente":"vazio","principal":true}]`

## Adaptações registradas

- **TC-012:** O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.
- **TC-014:** IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.
- **TC-015:** IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.
- **TC-024-CLI:** X é a pessoa da jornada (o "Y" do teste da QA). Massa = o que a 2.1 deixa: Account de X só com CPF e contatos, sem IdCliente e sem prospect; o Lead de X mantém o prospect, que continua na Account Z, de outra pessoa, com IdCliente.
- **TC-025:** Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.
- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.
- **TC-040:** Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.
- **TC-040-IDP:** Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.
- **TC-040-IDX:** Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.
- **TC-046:** Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).
- **TC-047:** A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).
- **TC-053:** Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.
- **TC-056:** Duplicação aparente da planilha: mesma massa do TC-055.
- **TC-062:** Eventos vão sem idprospectsalesforce.

## Fora do modelo

- **TC-001-XSI:** Variante do TC-001 para a lacuna 3 da R1: X sem IdCliente, achada só pelo prospect da jornada. Não está na planilha.
- **TC-001-MSI:** Variante do TC-001 para a lacuna 7 da R1: o jornadausuario-update sai sem IdCliente, com o prospect da jornada. Não está na planilha.
- **TC-001-MPC:** Variante do TC-001 para a lacuna 7 da R1: o jornadausuario-update sai sem IdCliente, com o prospect da jornada. Não está na planilha.
- **TC-002-INT:** Variante do TC-002 para a US 1060669: o celular aprovado é internacional (+351) e termina com os mesmos 11 dígitos do celular brasileiro do Lead de Z. Não está na planilha.
- **TC-005-PSL:** Variante do TC-005 para o bug 1142660 (US 918914): a Account Y existente, com CPF, IdCliente e celular e sem e-mail, traz um IdProspect que nenhum Lead possui. Não está na planilha.
- **TC-024-CLI:** Variante do TC-024 para o teste da QA de 05/11 (2.1 → 2.2): o prospect do Lead da jornada está preso a uma Account de outra pessoa (com IdCliente e CPF diferente); a 2.1 criou a Account da pessoa sem prospect, e a Opportunity nasce do jornadausuario-insert, sem IdCliente e sem CPF. Não está na planilha.
- **TC-040-IDP:** Variante do TC-040 para a lacuna 1 da R1: as PACs de Y saem sem IdCliente, com um IdCliente no idProponente. Não está na planilha.
- **TC-040-IDX:** Variante do TC-040 para a lacuna 1 da R1: as PACs de Y saem sem IdCliente, com um IdCliente no idProponente. Não está na planilha.
- **TC-053:** A planilha descreve a inclusão de um proponente adicional; o harness só modela a troca do principal na aprovação.
- **TC-054:** A planilha descreve a inclusão de um proponente adicional; o harness só modela a troca do principal na aprovação.
- **TC-055:** A planilha descreve a inclusão de um proponente adicional; o harness só modela a troca do principal na aprovação.
- **TC-056:** A planilha descreve a inclusão de um proponente adicional; o harness só modela a troca do principal na aprovação.
- **TC-057:** A planilha descreve a inclusão de um proponente adicional; o harness só modela a troca do principal na aprovação.

## Tempos

Média de 775 RUNs, em segundos: total 41.1; massa 3.6; cadeia 32.0 (dos quais 15.5 esperando jobs); verificação 0.5; cleanup 4.9.

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

