# Resultado do runbook da Unificação 2.2 — etapa 4 (R3) na `mrv-devDan`

> **Etapa 4 do plano da reescrita.** Mede-se contra a etapa 3, com `npm run runbook:bugs -- --comparar` (`docs/plano-branch-reescrita-2.2.md`, seção 6).

Execução de 2026-10-22T21:30:42.269Z a 2026-10-22T22:28:25.325Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**484 RUNs:** 74 conformes, 410 divergentes, 0 com erro de execução.

> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os
> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em
> que o caminho alcança X, "Account X intacta" diverge até os guards de
> identidade serem implantados. Veja `docs/handoff-investigacao-tc001-bug4.md`.

> **Perfis AR, AM, FW, RC, EP e RL (ordens reais da aprovação):** a ordem que o
> MS de crédito, o WebJob e o MS Clientes produzem. "—" no AM é TC em que ele
> não se aplica (a pessoa aprovada ainda não existe no MS Clientes). Veja a
> seção 7.2 de `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Resumo por TC

| TC | Cenário | PA (ORDEM-PARCIAIS-ANTES) | CA (ORDEM-CLIENTE-ANTES) | ME (ORDEM-MESMO-EVENTTIME) | C1 (CAMINHO-1-PAC-SEM-IDCLIENTE-E-PENDENCIA) | C2 (CAMINHO-2-PAC-COM-IDCLIENTE-DA-JORNADA-E-PENDENCIA) | C3 (CAMINHO-3-PENDENCIA-ANTES-DA-PAC) | C4 (CAMINHO-4-CONTESTACAO-PENDENTE) | AR (APROVACAO-REAL-PESSOA-NOVA) | AM (APROVACAO-REAL-PESSOA-EXISTENTE) | FW (FALHA-E-REPETICAO-DO-WEBJOB) | RC (RELOGIO-DO-CREDITO) | EP (ECO-ANTES-DO-PARCIAL) | RL (REPOSTAGEM-EM-LOTE) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-002 | CPF, e-mail e celular divergentes | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
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
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-026 | Dois Leads Y; reutilizar o livre | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-041 | Venda Genérica com colisão total | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-042 | Venda Genérica; e-mail colide | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-043 | Venda Genérica; celular colide | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-062 | Account Y com IdCliente e sem IdProspect | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |

## Divergências e erros

### TC-001 — CPF divergente com os mesmos contatos

**PA** (`TC001-PA-8d10ab`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC001-CA-caec6f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC001-ME-67e21a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC001-C1-204328`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC001-C2-c4a1e4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC001-C3-8fbdaf`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC001-C4-e96314`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC001-AR-44a354`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC001-FW-797e0b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC001-RC-ebc4c8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC001-EP-a93558`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC001-RL-8dbf87`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-002 — CPF, e-mail e celular divergentes

**PA** (`TC002-PA-78977e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC002-CA-91c57b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC002-ME-b23e00`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC002-C1-dd41fc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC002-C2-b62127`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC002-C3-840fdb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC002-C4-602636`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC002-AR-470b87`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC002-FW-85b611`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC002-RC-b78f7d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC002-EP-7ac575`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC002-RL-a50f6f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-005 — Account Y existente, Lead Y ausente

**PA** (`TC005-PA-f14669`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC005-CA-318174`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC005-ME-e5ae51`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC005-C1-5a0953`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC005-C2-78025b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC005-C3-c7b613`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC005-C4-2a317a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC005-AR-89338c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC005-AM-86a28c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC005-FW-262c80`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC005-RC-e075c5`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC005-EP-1b0692`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC005-RL-0d47e8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-006 — Account Y e Lead Y órfão existentes

**PA** (`TC006-PA-a5e640`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLg162AC"]`

**CA** (`TC006-CA-565340`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLftB2AS"]`

**ME** (`TC006-ME-06227b`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLZUJ2A4"]`

**C1** (`TC006-C1-bd46b8`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLoui2AC"]`

**C2** (`TC006-C2-e49fcb`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLdXu2AK"]`

**C3** (`TC006-C3-09ee18`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLaq62AC"]`

**C4** (`TC006-C4-aba157`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLk1W2AS"]`

**AR** (`TC006-AR-207638`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLY5A2AW"]`

**AM** (`TC006-AM-a85ae6`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLbT62AK"]`

**FW** (`TC006-FW-0c215e`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dL4n52AC"]`

**RC** (`TC006-RC-430772`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLqtE2AS"]`

**EP** (`TC006-EP-31dbff`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLgnc2AC"]`

**RL** (`TC006-RL-1ef761`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLfwI2AS"]`

### TC-007 — Contatos de Y pertencem ao Lead Z

**PA** (`TC007-PA-889fcc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC007-CA-356ca2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC007-ME-3570fc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC007-C1-50e804`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC007-C2-dd31bb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC007-C3-c1fb96`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC007-C4-783a81`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC007-AR-85a5ed`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC007-AM-06c590`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC007-FW-70861d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC007-RC-2f8cbd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC007-EP-5947e0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC007-RL-f4d02d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-009 — Account Y incompleta e Lead Y existente

**PA** (`TC009-PA-6de406`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLaQM2A0"]`

**CA** (`TC009-CA-f1235a`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLe8v2AC"]`

**ME** (`TC009-ME-ac27d3`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLdo42AC"]`

**C1** (`TC009-C1-f0a913`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLqQG2A0"]`

**C2** (`TC009-C2-dc767d`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLtB82AK"]`

**C3** (`TC009-C3-b9828c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLmQa2AK"]`

**C4** (`TC009-C4-fd1d8c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLbG32AK"]`

**AR** (`TC009-AR-4c076c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLhoY2AS"]`

**FW** (`TC009-FW-c9df42`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLcIT2A0"]`

**RC** (`TC009-RC-c1ca08`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLm5B2AS"]`

**EP** (`TC009-EP-68c404`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLR612AG"]`

**RL** (`TC009-RL-13a82b`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLlrx2AC"]`

### TC-010 — Colisão apenas de e-mail

**PA** (`TC010-PA-c0a43a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC010-CA-b376eb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC010-ME-d07ca6`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC010-C1-b4702c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC010-C2-496291`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC010-C3-d911fa`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC010-C4-096cde`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC010-AR-1ab7f3`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC010-AM-f4020b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC010-FW-d51b5a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC010-RC-c5a716`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC010-EP-764b9a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC010-RL-130ad8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-011 — Colisão apenas de celular

**PA** (`TC011-PA-14242a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC011-CA-c87a3a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC011-ME-c599de`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC011-C1-d5e76e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC011-C2-fa3b87`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC011-C3-299236`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC011-C4-14de04`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC011-AR-c80553`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC011-AM-5d54e8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC011-FW-cacbc7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC011-RC-5f7a30`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC011-EP-83d5d4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC011-RL-7de14c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-012 — Fallback por e-mail em Lead sem CPF

_Observação:_ O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.

**PA** (`TC012-PA-827f0b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLO7b2AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC012-CA-a23c55`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLalS2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC012-ME-7ec3c7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLh262AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC012-C1-d87236`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLuOv2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC012-C2-e84cd4`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLZB12AO"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC012-C3-cf1785`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLRGh2AO"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC012-C4-13ed6b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLlf92AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC012-AR-73da7d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLfOM2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AM** (`TC012-AM-f2dfa3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLebD2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC012-FW-e1b1c8`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dL0NO2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC012-RC-f10182`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLqd92AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**EP** (`TC012-EP-be9a15`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLuWz2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC012-RL-b4bdcd`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLlfA2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-013 — Fallback por celular em Lead sem CPF

**PA** (`TC013-PA-763c0b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLqWm2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC013-CA-d09e9d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLp992AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC013-ME-743277`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLrAz2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC013-C1-46edfd`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLtPg2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC013-C2-578849`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLeqU2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC013-C3-9d6fb9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLnNY2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC013-C4-d7fcac`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLpXr2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC013-AR-af4ff6`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLh0N2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AM** (`TC013-AM-6cd5ab`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLO7c2AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC013-FW-c1ea34`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLJ1O2AW"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC013-RC-833e78`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLbW82AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**EP** (`TC013-EP-29cf9a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLuju2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC013-RL-7cda8d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLcda2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-014 — Sem compatibilidade; IdCliente em minúsculas

_Observação:_ IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.

**PA** (`TC014-PA-44f592`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC014-CA-54dd23`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC014-ME-c415fc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC014-C1-83a0f8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC014-C2-41c25d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC014-C3-a6f8ef`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC014-C4-243b1b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC014-AR-60dca9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC014-AM-3081b4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC014-FW-9b916b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC014-RC-c6ce79`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC014-EP-69b07f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC014-RL-812664`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-015 — Sem compatibilidade; IdCliente em maiúsculas

_Observação:_ IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.

**PA** (`TC015-PA-dc0047`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC015-CA-f8c189`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC015-ME-1a06cf`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC015-C1-23b067`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC015-C2-9ab652`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC015-C3-60a6d6`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC015-C4-07dc4d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC015-AR-ffcc97`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC015-AM-da860f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC015-FW-472546`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC015-RC-062acf`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC015-EP-496ffe`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC015-RL-5ffa27`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-016 — Y inexistente e colisão total

**PA** (`TC016-PA-baed1b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC016-CA-da1e54`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC016-ME-68de45`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC016-C1-39cdbc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC016-C2-3a3944`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC016-C3-022ea0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC016-C4-37f026`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC016-AR-90041c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC016-FW-f21b6a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC016-RC-be770f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC016-EP-759731`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC016-RL-2f7061`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-017 — Y inexistente; celular colide

**PA** (`TC017-PA-21a77d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC017-CA-438dc3`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC017-ME-ae5b62`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC017-C1-6e4451`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC017-C2-9afd45`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC017-C3-3cc767`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC017-C4-fc9645`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC017-AR-e3b293`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC017-FW-28f2ca`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC017-RC-0a8752`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC017-EP-f8c1f8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC017-RL-665c67`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-018 — Y inexistente; e-mail colide

**PA** (`TC018-PA-b04e8f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC018-CA-07673e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC018-ME-757eeb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC018-C1-ea15fc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC018-C2-e7bc6f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC018-C3-b4e9cc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC018-C4-b5e6e1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC018-AR-9bd43e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC018-FW-f1c081`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC018-RC-7b7ab9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC018-EP-e9bfea`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC018-RL-7c0828`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-019 — Lead Y livre por CPF, contatos diferentes

**PA** (`TC019-PA-fad436`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLpFj2AK"]`

**CA** (`TC019-CA-171bc5`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLRA82AO"]`

**ME** (`TC019-ME-0f7151`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLR662AG"]`

**C1** (`TC019-C1-5cf60d`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLRer2AG"]`

**C2** (`TC019-C2-6c8fed`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLobI2AS"]`

**C3** (`TC019-C3-a5f3dc`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLuf42AC"]`

**C4** (`TC019-C4-24a9e9`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLX2m2AG"]`

**AR** (`TC019-AR-599410`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLY8Q2AW"]`

**AM** (`TC019-AM-0e4237`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLuf52AC"]`

**FW** (`TC019-FW-552e99`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLr2z2AC"]`

**RC** (`TC019-RC-f3baa6`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLvkn2AC"]`

**EP** (`TC019-EP-3486ed`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLoWd2AK"]`

**RL** (`TC019-RL-de5162`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLkZM2A0"]`

### TC-020 — Account Y só com CPF; nenhum Lead

**PA** (`TC020-PA-139cd8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC020-CA-90f294`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC020-ME-8106c7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC020-C1-4c2e3e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC020-C2-aefa97`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC020-C3-b5ef71`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC020-C4-9b1ead`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC020-AR-bdfb0a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC020-FW-44c07c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC020-RC-8d548f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC020-EP-984474`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC020-RL-7a51b7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-021 — Account Y com prospect divergente

**PA** (`TC021-PA-5420ad`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 22050045140","e-mail qa.unif22.tc021.e.tc021-pa-5420ad@example.com","celular 31954617884"]`

**CA** (`TC021-CA-453163`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 96050410305","e-mail qa.unif22.tc021.e.tc021-ca-453163@example.com","celular 31957883965"]`

**ME** (`TC021-ME-1b461c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 48998844273","e-mail qa.unif22.tc021.e.tc021-me-1b461c@example.com","celular 31955230591"]`

**C1** (`TC021-C1-5b10fe`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 20397583214","e-mail qa.unif22.tc021.e.tc021-c1-5b10fe@example.com","celular 31953505038"]`

**C2** (`TC021-C2-257128`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 43702155791","e-mail qa.unif22.tc021.e.tc021-c2-257128@example.com","celular 31950731234"]`

**C3** (`TC021-C3-244bf4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 64616350507","e-mail qa.unif22.tc021.e.tc021-c3-244bf4@example.com","celular 31958276486"]`

**C4** (`TC021-C4-4c29a2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 20342171526","e-mail qa.unif22.tc021.e.tc021-c4-4c29a2@example.com","celular 31959189337"]`

**AR** (`TC021-AR-1fc1e5`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 11431541184","e-mail qa.unif22.tc021.e.tc021-ar-1fc1e5@example.com","celular 31957967101"]`

**AM** (`TC021-AM-3ce5af`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 04948754102","e-mail qa.unif22.tc021.e.tc021-am-3ce5af@example.com","celular 31953077436"]`

**FW** (`TC021-FW-36cbfd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 13921023831","e-mail qa.unif22.tc021.e.tc021-fw-36cbfd@example.com","celular 31950172398"]`

**RC** (`TC021-RC-cadefb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 45449491492","e-mail qa.unif22.tc021.e.tc021-rc-cadefb@example.com","celular 31953238959"]`

**EP** (`TC021-EP-c72160`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 31401209157","e-mail qa.unif22.tc021.e.tc021-ep-c72160@example.com","celular 31959908639"]`

**RL** (`TC021-RL-27a3d9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","CPF 18784940824","e-mail qa.unif22.tc021.e.tc021-rl-27a3d9@example.com","celular 31954661004"]`

### TC-022 — Account Y incompleta e Lead Y órfão

**PA** (`TC022-PA-ae9a17`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLseu2AC"]`

**CA** (`TC022-CA-254712`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLmZs2AK"]`

**ME** (`TC022-ME-c5f58c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLq0O2AS"]`

**C1** (`TC022-C1-676db8`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLIS12AO"]`

**C2** (`TC022-C2-a16bb4`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLqN12AK"]`

**C3** (`TC022-C3-13e56c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLq432AC"]`

**C4** (`TC022-C4-3d7a22`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLvzJ2AS"]`

**AR** (`TC022-AR-3e1891`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLXCI2A4"]`

**FW** (`TC022-FW-113777`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLgcB2AS"]`

**RC** (`TC022-RC-d51c44`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLtke2AC"]`

**EP** (`TC022-EP-46753e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLaWx2AK"]`

**RL** (`TC022-RL-84e2d8`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLlQu2AK"]`

### TC-023 — Account Y inexistente e Lead Y órfão

**PA** (`TC023-PA-806130`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLtWB2A0"]`

**CA** (`TC023-CA-e05c5e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLnKJ2A0"]`

**ME** (`TC023-ME-0adf3e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLw5m2AC"]`

**C1** (`TC023-C1-940f5a`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLTSn2AO"]`

**C2** (`TC023-C2-0746fb`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLlbv2AC"]`

**C3** (`TC023-C3-7ca463`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLZpx2AG"]`

**C4** (`TC023-C4-49b16b`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLqN22AK"]`

**AR** (`TC023-AR-1bc3db`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLkkd2AC"]`

**FW** (`TC023-FW-857b90`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLkr72AC"]`

**RC** (`TC023-RC-e7f516`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLYed2AG"]`

**EP** (`TC023-EP-5990b1`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLrxQ2AS"]`

**RL** (`TC023-RL-edf291`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLMbx2AG"]`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**PA** (`TC025-PA-135436`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC025-CA-0701ac`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC025-ME-3ff486`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC025-C1-c70a00`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC025-C2-d5833a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC025-C3-269fdf`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC025-C4-bcdedb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC025-AR-94a199`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC025-FW-16e482`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC025-RC-ce12a2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC025-EP-308d97`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC025-RL-e77e46`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-026 — Dois Leads Y; reutilizar o livre

**PA** (`TC026-PA-452c6b`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLtmK2AS"]`

**CA** (`TC026-CA-50baf5`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLe2Y2AS"]`

**ME** (`TC026-ME-0656a0`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLuvG2AS"]`

**C1** (`TC026-C1-14e0d7`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLHsN2AW"]`

**C2** (`TC026-C2-89c190`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLota2AC"]`

**C3** (`TC026-C3-aac08b`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLwVb2AK"]`

**C4** (`TC026-C4-3d9c6b`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLw4B2AS"]`

**AR** (`TC026-AR-94ffa2`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLu7F2AS"]`

**AM** (`TC026-AM-087d63`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLqq02AC"]`

**FW** (`TC026-FW-01d090`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLsdL2AS"]`

**RC** (`TC026-RC-1bf998`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLpAo2AK"]`

**EP** (`TC026-EP-5c3547`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLTTs2AO"]`

**RL** (`TC026-RL-6c027c`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dLudV2AS"]`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**PA** (`TC038-PA-5365ef`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC038-CA-ed7bed`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC038-ME-23d746`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC038-C1-d60b5d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC038-C2-09fecd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC038-C3-131347`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC038-C4-d90690`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC038-AR-4b4c02`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC038-AM-006846`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC038-FW-4f94a4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC038-RC-067a82`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC038-EP-a1b8b3`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC038-RL-ab0b7e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-c7a996`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC040-CA-70f441`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC040-ME-6a93f1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC040-C1-2e2ed4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC040-C2-13193c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC040-C3-7fa711`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC040-C4-b38991`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC040-AR-9dd84c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC040-FW-5cae4e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC040-RC-a8ee14`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC040-EP-df1830`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC040-RL-63dfd1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-041 — Venda Genérica com colisão total

**PA** (`TC041-PA-c7093e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC041-CA-1ef35a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC041-ME-4ab0ff`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC041-C1-e2fa53`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC041-C2-87dfec`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC041-C3-1e79d1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC041-C4-3dcc30`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC041-AR-4e36bd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC041-FW-64817b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC041-RC-c3333f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC041-EP-2eb3d8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC041-RL-50887d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-042 — Venda Genérica; e-mail colide

**PA** (`TC042-PA-ace742`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC042-CA-8accc8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC042-ME-106fcb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC042-C1-fa5c5b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC042-C2-3be86b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC042-C3-794d1f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC042-C4-fb1845`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC042-AR-ddbd0e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC042-FW-b4d247`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC042-RC-9832ba`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC042-EP-76a399`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC042-RL-f8039a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-043 — Venda Genérica; celular colide

**PA** (`TC043-PA-d53df4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC043-CA-c083d9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC043-ME-9f5cf1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC043-C1-ede92d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC043-C2-d36000`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC043-C3-54956f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC043-C4-2c12bd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC043-AR-635458`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC043-FW-cd8f25`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC043-RC-b9cf9f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC043-EP-052718`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC043-RL-235456`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**PA** (`TC044-PA-a403bb`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLeDt2AK"]`

**CA** (`TC044-CA-68ee24`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLftG2AS"]`

**ME** (`TC044-ME-46a783`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLwdi2AC"]`

**C1** (`TC044-C1-521f0e`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLgm62AC"]`

**C2** (`TC044-C2-e3ad73`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM1Ws2AK"]`

**C3** (`TC044-C3-0f78e9`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLaLf2AK"]`

**C4** (`TC044-C4-24b54d`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM1Wt2AK"]`

**AR** (`TC044-AR-4c1556`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM1rp2AC"]`

**FW** (`TC044-FW-91eecf`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLoGS2A0"]`

**RC** (`TC044-RC-5dfcae`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLsWc2AK"]`

**EP** (`TC044-EP-f03b59`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLz8Z2AS"]`

**RL** (`TC044-RL-73f45e`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM1qG2AS"]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-3c9436`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM2fp2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC045-CA-a5c77b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLdmR2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC045-ME-d59b2a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLss12AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC045-C1-d31e44`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM2b02AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC045-C2-8a6a73`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLgym2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC045-C3-0f4f56`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLqgN2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC045-C4-611cdb`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLqmq2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC045-AR-bc7bdd`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLe5m2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC045-FW-56a840`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLmub2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC045-RC-b66be2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLSUj2AO"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**EP** (`TC045-EP-24b3b0`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLxea2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC045-RL-f18df7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLmst2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

_Observação:_ Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).

**PA** (`TC046-PA-74d19a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM2pV2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC046-CA-a58b81`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLxHy2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC046-ME-787ec2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLZO12AO"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC046-C1-167008`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLlP32AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC046-C2-6769e3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLgdt2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC046-C3-5c8cf7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM2zB2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC046-C4-3934f6`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM30n2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC046-AR-ac045a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLbhM2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC046-FW-6b937a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM3KA2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC046-RC-df092c`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLyCR2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**EP** (`TC046-EP-dc4b19`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM3NO2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC046-RL-caa21f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM01L2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

_Observação:_ A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).

**PA** (`TC047-PA-73be22`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLzy62AC"]`

**CA** (`TC047-CA-4cb35b`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM3AW2A0"]`

**ME** (`TC047-ME-261d54`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM3NP2A0"]`

**C1** (`TC047-C1-872ec7`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLfoH2AS"]`

**C2** (`TC047-C2-ccfb00`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLu5c2AC"]`

**C3** (`TC047-C3-980f77`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM2O62AK"]`

**C4** (`TC047-C4-c09bab`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLRs02AG"]`

**AR** (`TC047-AR-bae0ad`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM0e42AC"]`

**FW** (`TC047-FW-8a90e3`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dLRuy2AG"]`

**RC** (`TC047-RC-1c0c48`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM3qP2AS"]`

**EP** (`TC047-EP-87c199`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM2Kt2AK"]`

**RL** (`TC047-RL-b996f2`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dM3td2AC"]`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-442248`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLvIX2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC049-CA-d060eb`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM04a2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC049-ME-5eb766`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLotc2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC049-C1-2e6c2a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM7CU2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC049-C2-f81bdb`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM5142AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC049-C3-0420d7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLM0t2AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC049-C4-95c036`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM1Gl2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC049-AR-06fa26`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLdY02AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC049-FW-479f7a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM5Iq2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC049-RC-a734a4`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM2b12AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**EP** (`TC049-EP-02c0b8`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dLtd52AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC049-RL-45e25d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dM1zx2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-062 — Account Y com IdCliente e sem IdProspect

_Observação:_ Eventos vão sem idprospectsalesforce.

**PA** (`TC062-PA-e0ec6e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC062-CA-142483`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC062-ME-f23491`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC062-C1-d1cf8b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC062-C2-6fdba3`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC062-C3-a579a0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC062-C4-b6bb2a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC062-AR-552c9f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC062-AM-d87127`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC062-FW-d55ed8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC062-RC-e73f9e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**EP** (`TC062-EP-20ebdc`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC062-RL-c916d7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

## Adaptações registradas

- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.

## Tempos

Média de 484 RUNs, em segundos: total 36.0; massa 4.0; cadeia 26.4 (dos quais 10.2 esperando jobs); verificação 0.6; cleanup 5.1.

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

