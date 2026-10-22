# Resultado do runbook da Unificação 2.2 — etapa 3 (R1 e R2) na `mrv-devDan`

> **Etapa 3 do plano da reescrita.** Mede-se contra a etapa 2, com `npm run runbook:bugs -- --comparar` (`docs/plano-branch-reescrita-2.2.md`, seção 6).

Execução de 2026-10-22T11:58:06.285Z a 2026-10-22T12:48:08.878Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**484 RUNs:** 68 conformes, 416 divergentes, 0 com erro de execução.

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
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
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
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-026 | Dois Leads Y; reutilizar o livre | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
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
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-062 | Account Y com IdCliente e sem IdProspect | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |

## Divergências e erros

### TC-001 — CPF divergente com os mesmos contatos

**PA** (`TC001-PA-7d279a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC001-CA-88d9ed`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC001-ME-1ac289`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC001-C1-deb96c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC001-C2-0ad138`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC001-C3-b20199`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC001-C4-8e0a3b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC001-AR-57d031`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC001-FW-1e75e2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC001-RC-b75925`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc001.atrasado.tc001-rc-b75925@example.com","celular":"31982655097"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc001.atrasado.tc001-rc-b75925@example.com","marcador":"2026-10-22T11:58:54.000+0000"}`

**EP** (`TC001-EP-e9983f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC001-RL-4e3f0f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-002 — CPF, e-mail e celular divergentes

**PA** (`TC002-PA-4d75ec`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC002-CA-889408`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC002-ME-eadc3b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC002-C1-8b0bed`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC002-C2-5fddc6`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC002-C3-b5fc3e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC002-C4-b7a05e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC002-AR-3e08f2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC002-FW-ec6fb5`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC002-RC-cd2ddd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc002.atrasado.tc002-rc-cd2ddd@example.com","celular":"31971024094"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc002.atrasado.tc002-rc-cd2ddd@example.com","marcador":"2026-10-22T11:59:59.000+0000"}`

**EP** (`TC002-EP-b10ffd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC002-RL-fec01c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-003 — Match com dados idênticos

**RC** (`TC003-RC-da6594`, ❌ diverge):

- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc003.atrasado.tc003-rc-da6594@example.com","celular":"31987136604"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc003.atrasado.tc003-rc-da6594@example.com","marcador":"2026-10-22T12:01:17.000+0000"}`

### TC-004 — Jornada sem CPF e PAC inclui CPF

**RC** (`TC004-RC-7f60ff`, ❌ diverge):

- Lead leadX reutilizado e vinculado (CPF preenchido, com os contatos aprovados): `["contatos diferentes dos aprovados: qa.unif22.tc004.atrasado.tc004-rc-7f60ff@example.com / 31982793046"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc004.atrasado.tc004-rc-7f60ff@example.com","celular":"31982793046"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc004.atrasado.tc004-rc-7f60ff@example.com","marcador":"2026-10-22T12:02:26.000+0000"}`

### TC-005 — Account Y existente, Lead Y ausente

**PA** (`TC005-PA-2c5a05`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC005-CA-9f98ca`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC005-ME-4321c1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC005-C1-ec2c83`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC005-C2-18f102`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC005-C3-ec5572`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC005-C4-0f6127`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC005-AR-c02f11`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC005-AM-51e6e4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC005-FW-996089`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC005-RC-4daeec`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc005.atrasado.tc005-rc-4daeec@example.com","celular":"31976021171"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc005.atrasado.tc005-rc-4daeec@example.com","marcador":"2026-10-22T12:03:40.000+0000"}`

**EP** (`TC005-EP-f6ea57`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC005-RL-03721b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-006 — Account Y e Lead Y órfão existentes

**PA** (`TC006-PA-46c05f`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJmdc2AC"]`

**CA** (`TC006-CA-f2a664`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJgZs2AK"]`

**ME** (`TC006-ME-edccd4`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJzXl2AK"]`

**C1** (`TC006-C1-6d9c02`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK3Zm2AK"]`

**C2** (`TC006-C2-a5e0f6`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK4dD2AS"]`

**C3** (`TC006-C3-2eb509`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK73i2AC"]`

**C4** (`TC006-C4-553c44`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK8MM2A0"]`

**AR** (`TC006-AR-3d4a4d`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJcMh2AK"]`

**AM** (`TC006-AM-442707`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK7jf2AC"]`

**FW** (`TC006-FW-470127`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK7N42AK"]`

**RC** (`TC006-RC-f80b8f`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK1GE2A0"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc006.atrasado.tc006-rc-f80b8f@example.com","celular":"31979296188"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc006.atrasado.tc006-rc-f80b8f@example.com","marcador":"2026-10-22T12:05:16.000+0000"}`

**EP** (`TC006-EP-76821e`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJzJC2A0"]`

**RL** (`TC006-RL-4c3983`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK1w42AC"]`

### TC-007 — Contatos de Y pertencem ao Lead Z

**PA** (`TC007-PA-25808b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC007-CA-6d49fb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC007-ME-0f0e49`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC007-C1-cd56f9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC007-C2-e87c64`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC007-C3-ea988c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC007-C4-71d76c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC007-AR-1cda7e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC007-AM-1ede96`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC007-FW-1bac8e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC007-RC-62a995`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc007.atrasado.tc007-rc-62a995@example.com","celular":"31976088102"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc007.atrasado.tc007-rc-62a995@example.com","marcador":"2026-10-22T12:06:35.000+0000"}`

**EP** (`TC007-EP-6f746f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC007-RL-cf3132`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-009 — Account Y incompleta e Lead Y existente

**PA** (`TC009-PA-d7abff`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJmdd2AC"]`

**CA** (`TC009-CA-1a6867`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK8qz2AC"]`

**ME** (`TC009-ME-c268ab`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJtgy2AC"]`

**C1** (`TC009-C1-bf633c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJlzH2AS"]`

**C2** (`TC009-C2-cb703f`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK3TK2A0"]`

**C3** (`TC009-C3-eb2a9f`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK8ZG2A0"]`

**C4** (`TC009-C4-b03470`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK3Ej2AK"]`

**AR** (`TC009-AR-146cf9`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK3hj2AC"]`

**FW** (`TC009-FW-60289b`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJqcX2AS"]`

**RC** (`TC009-RC-6199ad`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK6E62AK"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc009.atrasado.tc009-rc-6199ad@example.com","celular":"31980172051"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc009.atrasado.tc009-rc-6199ad@example.com","marcador":"2026-10-22T12:07:51.000+0000"}`

**EP** (`TC009-EP-cfce76`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK9K12AK"]`

**RL** (`TC009-RL-edc28b`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJnEp2AK"]`

### TC-010 — Colisão apenas de e-mail

**PA** (`TC010-PA-d6e58b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC010-CA-51259b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC010-ME-448c63`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC010-C1-3d6139`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC010-C2-6ec72b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC010-C3-c9e25b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC010-C4-e6ab5f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC010-AR-5b0a68`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC010-AM-1baeb2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC010-FW-91e599`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC010-RC-caa519`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc010.atrasado.tc010-rc-caa519@example.com","celular":"31979980911"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc010.atrasado.tc010-rc-caa519@example.com","marcador":"2026-10-22T12:09:06.000+0000"}`

**EP** (`TC010-EP-c3cd3f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC010-RL-cbeb13`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-011 — Colisão apenas de celular

**PA** (`TC011-PA-c9e128`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC011-CA-0cd0ea`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC011-ME-148102`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC011-C1-a4759c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC011-C2-98366e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC011-C3-e97e32`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC011-C4-bd0bc5`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC011-AR-021c2b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC011-AM-6cf299`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC011-FW-64b730`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC011-RC-295281`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc011.atrasado.tc011-rc-295281@example.com","celular":"31988454950"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc011.atrasado.tc011-rc-295281@example.com","marcador":"2026-10-22T12:10:23.000+0000"}`

**EP** (`TC011-EP-7eb119`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC011-RL-125536`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-012 — Fallback por e-mail em Lead sem CPF

_Observação:_ O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.

**PA** (`TC012-PA-cbfebd`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJynD2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC012-CA-e19271`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9v82AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC012-ME-0a1505`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7Bp2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC012-C1-ffc512`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJqcY2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC012-C2-0ae5bf`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9jr2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC012-C3-a3c369`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK3OX2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC012-C4-11b070`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9qJ2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC012-AR-7de8c2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJzHo2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AM** (`TC012-AM-e76069`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJgbj2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC012-FW-9713d6`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7rl2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC012-RC-85109b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKA6P2AW"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc012.atrasado.tc012-rc-85109b@example.com","celular":"31979671724"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc012.atrasado.tc012-rc-85109b@example.com","marcador":"2026-10-22T12:11:46.000+0000"}`

**EP** (`TC012-EP-ce9036`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKA812AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC012-RL-1a5ae9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK5202AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-013 — Fallback por celular em Lead sem CPF

**PA** (`TC013-PA-50f099`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJsRd2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC013-CA-450c3d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKA9d2AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC013-ME-3b0e98`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJR6I2AW"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC013-C1-0c60e9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJxMO2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC013-C2-3346ea`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJnOi2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC013-C3-f35b18`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7rm2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC013-C4-29eda6`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK39s2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC013-AR-a22afc`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK2Vb2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AM** (`TC013-AM-2870eb`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJeGQ2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC013-FW-1af637`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJtCF2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC013-RC-eeafc2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJqO12AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc013.atrasado.tc013-rc-eeafc2@example.com","celular":"31985065903"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc013.atrasado.tc013-rc-eeafc2@example.com","marcador":"2026-10-22T12:13:14.000+0000"}`

**EP** (`TC013-EP-c92a12`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJsrM2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC013-RL-7598b5`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7DP2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-014 — Sem compatibilidade; IdCliente em minúsculas

_Observação:_ IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.

**PA** (`TC014-PA-45bd67`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC014-CA-4376cd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC014-ME-c9201b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC014-C1-0b6a7f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC014-C2-7acf54`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC014-C3-cc42b4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC014-C4-bbcc09`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC014-AR-cf3119`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC014-AM-d527b2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC014-FW-4f8e61`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC014-RC-dbd4ea`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc014.atrasado.tc014-rc-dbd4ea@example.com","celular":"31975381115"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc014.atrasado.tc014-rc-dbd4ea@example.com","marcador":"2026-10-22T12:14:35.000+0000"}`

**EP** (`TC014-EP-8524c9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC014-RL-e89d20`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-015 — Sem compatibilidade; IdCliente em maiúsculas

_Observação:_ IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.

**PA** (`TC015-PA-2c7c20`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC015-CA-e9a331`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC015-ME-9abb67`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC015-C1-a11e7b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC015-C2-74e60a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC015-C3-d36eba`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC015-C4-3f9ede`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC015-AR-e09a13`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC015-AM-a3cad1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC015-FW-60696c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC015-RC-4ce4ea`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc015.atrasado.tc015-rc-4ce4ea@example.com","celular":"31977615227"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc015.atrasado.tc015-rc-4ce4ea@example.com","marcador":"2026-10-22T12:15:55.000+0000"}`

**EP** (`TC015-EP-d99e88`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC015-RL-75b389`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-016 — Y inexistente e colisão total

**PA** (`TC016-PA-a8a4e9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC016-CA-9f33dd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC016-ME-e18de2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC016-C1-abf343`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC016-C2-3bc528`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC016-C3-7384dd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC016-C4-a62875`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC016-AR-dbcb06`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC016-FW-61aec7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC016-RC-02f467`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc016.atrasado.tc016-rc-02f467@example.com","celular":"31981218329"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc016.atrasado.tc016-rc-02f467@example.com","marcador":"2026-10-22T12:17:12.000+0000"}`

**EP** (`TC016-EP-14678d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC016-RL-63281c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-017 — Y inexistente; celular colide

**PA** (`TC017-PA-ed6df8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC017-CA-4a4ee4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC017-ME-c82e5e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC017-C1-191aa7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC017-C2-2f9ba7`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC017-C3-264a8e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC017-C4-f3aae0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC017-AR-b74952`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC017-FW-d3187d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC017-RC-62ae28`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc017.atrasado.tc017-rc-62ae28@example.com","celular":"31983084144"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc017.atrasado.tc017-rc-62ae28@example.com","marcador":"2026-10-22T12:18:21.000+0000"}`

**EP** (`TC017-EP-26c5e8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC017-RL-040fad`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-018 — Y inexistente; e-mail colide

**PA** (`TC018-PA-e96bbe`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC018-CA-2a5013`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC018-ME-0134bf`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC018-C1-a84c05`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC018-C2-fc0931`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC018-C3-b47323`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC018-C4-feaacb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC018-AR-c4a485`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC018-FW-a0aa2a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC018-RC-71d251`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc018.atrasado.tc018-rc-71d251@example.com","celular":"31979420788"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc018.atrasado.tc018-rc-71d251@example.com","marcador":"2026-10-22T12:19:37.000+0000"}`

**EP** (`TC018-EP-fd6cb5`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC018-RL-ad5a69`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-019 — Lead Y livre por CPF, contatos diferentes

**PA** (`TC019-PA-015120`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJvp62AC"]`

**CA** (`TC019-CA-db1f8b`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK07N2AS"]`

**ME** (`TC019-ME-b1fd1c`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK6cJ2AS"]`

**C1** (`TC019-C1-0dacb3`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK6dy2AC"]`

**C2** (`TC019-C2-990069`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK7N72AK"]`

**C3** (`TC019-C3-f2ee01`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK3dc2AC"]`

**C4** (`TC019-C4-332d99`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKBFN2A4"]`

**AR** (`TC019-AR-32f77a`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK7Tb2AK"]`

**AM** (`TC019-AM-d0a31e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK4Qw2AK"]`

**FW** (`TC019-FW-2a8bab`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKBIb2AO"]`

**RC** (`TC019-RC-14862e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJlrG2AS"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc019.atrasado.tc019-rc-14862e@example.com","celular":"31988883553"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc019.atrasado.tc019-rc-14862e@example.com","marcador":"2026-10-22T12:20:44.000+0000"}`

**EP** (`TC019-EP-068683`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK76x2AC"]`

**RL** (`TC019-RL-9a59be`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJebb2AC"]`

### TC-020 — Account Y só com CPF; nenhum Lead

**PA** (`TC020-PA-7fa16b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC020-CA-ad9208`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC020-ME-188119`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC020-C1-34c32b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC020-C2-eae42f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC020-C3-eae076`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC020-C4-fafe4e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC020-AR-250c59`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC020-FW-a2898c`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC020-RC-ced304`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc020.atrasado.tc020-rc-ced304@example.com","celular":"31971768632"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc020.atrasado.tc020-rc-ced304@example.com","marcador":"2026-10-22T12:22:01.000+0000"}`

**EP** (`TC020-EP-2824dd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC020-RL-92f6e9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-021 — Account Y com prospect divergente

**PA** (`TC021-PA-441fe0`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"50623540568","depois":"08474561531"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-pa-441fe0@example.com","depois":"qa.unif22.tc021.c.tc021-pa-441fe0@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**CA** (`TC021-CA-4946d3`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"07569895908","depois":"27709490042"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ca-4946d3@example.com","depois":"qa.unif22.tc021.c.tc021-ca-4946d3@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**ME** (`TC021-ME-193827`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"73101871301","depois":"21062507703"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-me-193827@example.com","depois":"qa.unif22.tc021.c.tc021-me-193827@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**C1** (`TC021-C1-9bdc96`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"27226532069","depois":"10524270490"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c1-9bdc96@example.com","depois":"qa.unif22.tc021.c.tc021-c1-9bdc96@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**C2** (`TC021-C2-66570e`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"54591345017","depois":"26191721285"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c2-66570e@example.com","depois":"qa.unif22.tc021.c.tc021-c2-66570e@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**C3** (`TC021-C3-56d19b`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"41232471720","depois":"95335936282"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c3-56d19b@example.com","depois":"qa.unif22.tc021.c.tc021-c3-56d19b@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**C4** (`TC021-C4-482602`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"63095150717","depois":"21968341226"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-c4-482602@example.com","depois":"qa.unif22.tc021.c.tc021-c4-482602@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**AR** (`TC021-AR-2a19fd`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"07360009413","depois":"06749112455"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ar-2a19fd@example.com","depois":"qa.unif22.tc021.c.tc021-ar-2a19fd@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**AM** (`TC021-AM-ba0390`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"41421536250","depois":"58515045109"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-am-ba0390@example.com","depois":"qa.unif22.tc021.c.tc021-am-ba0390@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**FW** (`TC021-FW-dd5fe9`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"62252401443","depois":"30584455712"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-fw-dd5fe9@example.com","depois":"qa.unif22.tc021.c.tc021-fw-dd5fe9@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**RC** (`TC021-RC-800011`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"95603247720","depois":"73296149988"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-rc-800011@example.com","depois":"qa.unif22.tc021.atrasado.tc021-rc-800011@example.com"},{"campo":"MobileP…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo","e-mail qa.unif22.tc021.atrasado.tc021-rc-800011@example.com"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc021.atrasado.tc021-rc-800011@example.com","celular":"31971371076"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc021.atrasado.tc021-rc-800011@example.com","marcador":"2026-10-22T12:23:32.000+0000"}`

**EP** (`TC021-EP-2f6f01`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"26885863270","depois":"02205685708"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ep-2f6f01@example.com","depois":"qa.unif22.tc021.c.tc021-ep-2f6f01@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

**RL** (`TC021-RL-3b101f`, ❌ diverge):

- Lead Z intacto: `[{"campo":"CPF__c","antes":"81715511573","depois":"10596438397"},{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-rl-3b101f@example.com","depois":"qa.unif22.tc021.c.tc021-rl-3b101f@example.com"},{"campo":"MobilePhone","…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["é um Lead da massa, não novo"]`

### TC-022 — Account Y incompleta e Lead Y órfão

**PA** (`TC022-PA-bbcadc`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJs882AC"]`

**CA** (`TC022-CA-f188bf`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJj6L2AS"]`

**ME** (`TC022-ME-ed9196`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJg282AC"]`

**C1** (`TC022-C1-4874df`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJaaz2AC"]`

**C2** (`TC022-C2-08477e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK3Em2AK"]`

**C3** (`TC022-C3-afd461`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKCBS2A4"]`

**C4** (`TC022-C4-592eab`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJsss2AC"]`

**AR** (`TC022-AR-120577`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKBAY2A4"]`

**FW** (`TC022-FW-4411ba`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK55P2AS"]`

**RC** (`TC022-RC-9224f7`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK2SZ2A0"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc022.atrasado.tc022-rc-9224f7@example.com","celular":"31989705477"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc022.atrasado.tc022-rc-9224f7@example.com","marcador":"2026-10-22T12:24:44.000+0000"}`

**EP** (`TC022-EP-ef6ccd`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJluT2AS"]`

**RL** (`TC022-RL-22e255`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJmFV2A0"]`

### TC-023 — Account Y inexistente e Lead Y órfão

**PA** (`TC023-PA-2a2deb`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJxPW2A0"]`

**CA** (`TC023-CA-819e54`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK5i22AC"]`

**ME** (`TC023-ME-5ec917`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKA832AG"]`

**C1** (`TC023-C1-44fcc0`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKBH02AO"]`

**C2** (`TC023-C2-182fd9`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJs892AC"]`

**C3** (`TC023-C3-15e3a5`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK69J2AS"]`

**C4** (`TC023-C4-b3d9e4`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK8nt2AC"]`

**AR** (`TC023-AR-70ab25`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJQAI2A4"]`

**FW** (`TC023-FW-35a002`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK1eM2AS"]`

**RC** (`TC023-RC-f6952e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJuRk2AK"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc023.atrasado.tc023-rc-f6952e@example.com","celular":"31982855269"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc023.atrasado.tc023-rc-f6952e@example.com","marcador":"2026-10-22T12:25:52.000+0000"}`

**EP** (`TC023-EP-5ef651`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJWh92AG"]`

**RL** (`TC023-RL-e3ebe8`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK9bm2AC"]`

### TC-024 — Lead Y preso a outra Account

**RC** (`TC024-RC-02625d`, ❌ diverge):

- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc024.atrasado.tc024-rc-02625d@example.com","celular":"31981384856"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc024.atrasado.tc024-rc-02625d@example.com","marcador":"2026-10-22T12:27:03.000+0000"}`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**PA** (`TC025-PA-239622`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC025-CA-f2295b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC025-ME-04302f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC025-C1-1494a1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC025-C2-fb693f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC025-C3-008072`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC025-C4-5ef631`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC025-AR-bd0342`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC025-FW-906c19`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC025-RC-505886`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc025.atrasado.tc025-rc-505886@example.com","celular":"31986888094"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc025.atrasado.tc025-rc-505886@example.com","marcador":"2026-10-22T12:28:23.000+0000"}`

**EP** (`TC025-EP-c1ef11`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC025-RL-a72962`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-026 — Dois Leads Y; reutilizar o livre

**PA** (`TC026-PA-6cef0c`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dJkiP2AS"]`

**CA** (`TC026-CA-905415`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dK9NJ2A0"]`

**ME** (`TC026-ME-185997`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dKCub2AG"]`

**C1** (`TC026-C1-74c0b2`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dK5TR2A0"]`

**C2** (`TC026-C2-bb80d4`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dJpv02AC"]`

**C3** (`TC026-C3-7c7bb2`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dJpgM2AS"]`

**C4** (`TC026-C4-e9a54c`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dK50R2AS"]`

**AR** (`TC026-AR-d0d2a0`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dJT1k2AG"]`

**AM** (`TC026-AM-5e796b`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dJtM02AK"]`

**FW** (`TC026-FW-7685a6`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dJvkQ2AS"]`

**RC** (`TC026-RC-214931`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dK7uz2AC"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc026.atrasado.tc026-rc-214931@example.com","celular":"31988932963"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc026.atrasado.tc026-rc-214931@example.com","marcador":"2026-10-22T12:29:53.000+0000"}`

**EP** (`TC026-EP-daa62b`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dKAmN2AW"]`

**RL** (`TC026-RL-4b6edd`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY2 00QHZ00000dKD4H2AW"]`

### TC-027 — Todos os Leads Y estão presos

**RC** (`TC027-RC-03dbe4`, ❌ diverge):

- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc027.atrasado.tc027-rc-03dbe4@example.com","celular":"31988260009"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc027.atrasado.tc027-rc-03dbe4@example.com","marcador":"2026-10-22T12:31:14.000+0000"}`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**PA** (`TC038-PA-c3fbf0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC038-CA-172b72`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC038-ME-a5ac5f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC038-C1-080b66`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC038-C2-f31a8b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC038-C3-263b5d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC038-C4-3f80d0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC038-AR-a78699`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC038-AM-cbccfe`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC038-FW-d9073e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC038-RC-f225a9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc038.atrasado.tc038-rc-f225a9@example.com","celular":"31983261937"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc038.atrasado.tc038-rc-f225a9@example.com","marcador":"2026-10-22T12:32:37.000+0000"}`

**EP** (`TC038-EP-f3466e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC038-RL-a4eb7d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-039 — Nova jornada do mesmo cliente Y

_Observação:_ A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.

**RC** (`TC039-RC-eb0de1`, ❌ diverge):

- Lead leadX reutilizado e vinculado (com os contatos aprovados): `["contatos diferentes dos aprovados: qa.unif22.tc039.atrasado.tc039-rc-eb0de1@example.com / 31975538239"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc039.atrasado.tc039-rc-eb0de1@example.com","celular":"31975538239"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc039.atrasado.tc039-rc-eb0de1@example.com","marcador":"2026-10-22T12:33:51.000+0000"}`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-6c7027`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC040-CA-51cc79`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC040-ME-c5d730`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC040-C1-d0169f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC040-C2-710cf2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC040-C3-200227`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC040-C4-8809d0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC040-AR-682bff`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC040-FW-29332a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC040-RC-d80976`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc040.atrasado.tc040-rc-d80976@example.com","celular":"31987988587"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc040.atrasado.tc040-rc-d80976@example.com","marcador":"2026-10-22T12:34:59.000+0000"}`

**EP** (`TC040-EP-994a44`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC040-RL-026542`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-041 — Venda Genérica com colisão total

**PA** (`TC041-PA-c858c2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC041-CA-b43be6`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC041-ME-75407f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC041-C1-91a5e2`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC041-C2-60bfe9`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC041-C3-949512`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC041-C4-dd4d57`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC041-AR-7c1cea`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC041-FW-cb204e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC041-RC-7f183d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc041.atrasado.tc041-rc-7f183d@example.com","celular":"31982477276"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc041.atrasado.tc041-rc-7f183d@example.com","marcador":"2026-10-22T12:36:05.000+0000"}`

**EP** (`TC041-EP-78164f`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC041-RL-e41797`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-042 — Venda Genérica; e-mail colide

**PA** (`TC042-PA-6f070b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC042-CA-4e7a2d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC042-ME-aa6472`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC042-C1-64af28`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC042-C2-961baf`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC042-C3-6a8da1`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC042-C4-8bda2e`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC042-AR-bee20a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC042-FW-b71988`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC042-RC-69be66`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc042.atrasado.tc042-rc-69be66@example.com","celular":"31971450363"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc042.atrasado.tc042-rc-69be66@example.com","marcador":"2026-10-22T12:37:15.000+0000"}`

**EP** (`TC042-EP-9ef318`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC042-RL-0a6dd0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, sem e-mail, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-043 — Venda Genérica; celular colide

**PA** (`TC043-PA-4959c4`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC043-CA-d593ce`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC043-ME-963681`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC043-C1-4eb200`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC043-C2-164904`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC043-C3-e40139`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC043-C4-4ab2a0`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC043-AR-1a3cbb`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC043-FW-70fa36`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC043-RC-215773`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc043.atrasado.tc043-rc-215773@example.com","celular":"31987162036"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc043.atrasado.tc043-rc-215773@example.com","marcador":"2026-10-22T12:38:16.000+0000"}`

**EP** (`TC043-EP-4226dd`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC043-RL-cabb4a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, sem celular: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**PA** (`TC044-PA-158e6d`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK8z72AC"]`

**CA** (`TC044-CA-466aa3`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKByZ2AW"]`

**ME** (`TC044-ME-56e0ba`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKBnH2AW"]`

**C1** (`TC044-C1-5b1121`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK4dK2AS"]`

**C2** (`TC044-C2-d9b9a5`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJq1M2AS"]`

**C3** (`TC044-C3-bcea40`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK6cP2AS"]`

**C4** (`TC044-C4-2f97aa`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKCQ02AO"]`

**AR** (`TC044-AR-8e7e05`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKBgv2AG"]`

**FW** (`TC044-FW-377be6`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJv6A2AS"]`

**RC** (`TC044-RC-379d90`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK9tZ2AS"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc044.atrasado.tc044-rc-379d90@example.com","celular":"31976615841"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc044.atrasado.tc044-rc-379d90@example.com","marcador":"2026-10-22T12:39:31.000+0000"}`

**EP** (`TC044-EP-66e21b`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKFSg2AO"]`

**RL** (`TC044-RL-5c0698`, ❌ diverge):

- Lead leadY reutilizado e vinculado: `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKFxJ2AW"]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-b6f655`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKAb92AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC045-CA-c3c054`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9QX2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC045-ME-dcb343`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7wb2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC045-C1-aa03a3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK6J82AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC045-C2-651d98`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK2XA2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC045-C3-88483b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK8RF2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC045-C4-2c0861`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJqFv2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC045-AR-79ecb5`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKG5N2AW"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC045-FW-ebfd27`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9zz2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC045-RC-5b2e19`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKA862AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc045.atrasado.tc045-rc-5b2e19@example.com","celular":"31979844339"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc045.atrasado.tc045-rc-5b2e19@example.com","marcador":"2026-10-22T12:40:34.000+0000"}`

**EP** (`TC045-EP-ba147c`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK3gG2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC045-RL-d3e51c`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK3WY2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

_Observação:_ Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).

**PA** (`TC046-PA-3088fa`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK62u2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC046-CA-150f5d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKG702AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC046-ME-6be5f3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJytc2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC046-C1-bce0ca`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9aF2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC046-C2-dccadc`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJidU2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC046-C3-4741b3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK6e02AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC046-C4-247509`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJv9M2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC046-AR-e37b1f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJmAr2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC046-FW-2e4bbb`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKDHC2A4"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC046-RC-84d727`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK2KV2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc046.atrasado.tc046-rc-84d727@example.com","celular":"31983372640"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc046.atrasado.tc046-rc-84d727@example.com","marcador":"2026-10-22T12:41:49.000+0000"}`

**EP** (`TC046-EP-e5d85b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKCpm2AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC046-RL-3a9f8a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJSbq2AG"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

_Observação:_ A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).

**PA** (`TC047-PA-022a15`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKFEC2A4"]`

**CA** (`TC047-CA-af7bf2`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKFVx2AO"]`

**ME** (`TC047-ME-e5c490`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKFm32AG"]`

**C1** (`TC047-C1-f91375`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKGF52AO"]`

**C2** (`TC047-C2-085718`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKB5k2AG"]`

**C3** (`TC047-C3-091bd5`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKFED2A4"]`

**C4** (`TC047-C4-dbaf1f`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK67l2AC"]`

**AR** (`TC047-AR-1eaa91`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dKGN72AO"]`

**FW** (`TC047-FW-07d0b3`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJwgP2AS"]`

**RC** (`TC047-RC-a58808`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJl3L2AS"]`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc047.atrasado.tc047-rc-a58808@example.com","celular":"31970193528"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc047.atrasado.tc047-rc-a58808@example.com","marcador":"2026-10-22T12:43:04.000+0000"}`

**EP** (`TC047-EP-4d6d27`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dJpwS2AS"]`

**RL** (`TC047-RL-1a8c66`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["Lead vinculado nenhum ≠ leadY 00QHZ00000dK9NN2A0"]`

### TC-048 — Lead Y preso com compatibilidade total

**RC** (`TC048-RC-0cf9b8`, ❌ diverge):

- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc048.atrasado.tc048-rc-0cf9b8@example.com","celular":"31974610891"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc048.atrasado.tc048-rc-0cf9b8@example.com","marcador":"2026-10-22T12:44:09.000+0000"}`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-58acd9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7yH2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**CA** (`TC049-CA-be5ffe`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK7yI2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**ME** (`TC049-ME-e757fe`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK8mE2AS"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C1** (`TC049-C1-45aa90`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK1Eh2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C2** (`TC049-C2-486754`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJtu02AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C3** (`TC049-C3-777b25`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKGVB2A4"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**C4** (`TC049-C4-5bebec`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJqO52AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**AR** (`TC049-AR-4c00b1`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKGWn2AO"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**FW** (`TC049-FW-a082de`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dKAjB2AW"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RC** (`TC049-RC-3a0e6e`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dJlHs2AK"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc049.atrasado.tc049-rc-3a0e6e@example.com","celular":"31975129206"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc049.atrasado.tc049-rc-3a0e6e@example.com","marcador":"2026-10-22T12:45:19.000+0000"}`

**EP** (`TC049-EP-a385e9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK8at2AC"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

**RL** (`TC049-RL-0abba1`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado nenhum ≠ leadCandidato 00QHZ00000dK9IU2A0"]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`

### TC-062 — Account Y com IdCliente e sem IdProspect

_Observação:_ Eventos vão sem idprospectsalesforce.

**PA** (`TC062-PA-04323a`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**CA** (`TC062-CA-6a3602`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**ME** (`TC062-ME-d25564`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C1** (`TC062-C1-09b4b5`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C2** (`TC062-C2-52611b`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C3** (`TC062-C3-00d9ef`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**C4** (`TC062-C4-ef4ab8`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AR** (`TC062-AR-16b903`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**AM** (`TC062-AM-0c7217`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**FW** (`TC062-FW-b2a734`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RC** (`TC062-RC-98c2c6`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`
- Account aprovada com os contatos da PAC: `{"email":"qa.unif22.tc062.atrasado.tc062-rc-98c2c6@example.com","celular":"31979126423"}`
- RC: contato-update atrasado, de antes da aprovação, descartado: `{"email":"qa.unif22.tc062.atrasado.tc062-rc-98c2c6@example.com","marcador":"2026-10-22T12:46:34.000+0000"}`

**EP** (`TC062-EP-17f58d`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

**RL** (`TC062-RL-8d0803`, ❌ diverge):

- 1 Lead(s) com o CPF aprovado: `{"encontrados":[]}`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["nenhum Lead vinculado à Account aprovada"]`
- Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c): `{"prospect":null}`

## Tempos

Média de 484 RUNs, em segundos: total 36.5; massa 4.2; cadeia 26.4 (dos quais 9.8 esperando jobs); verificação 0.6; cleanup 5.3.

Refeitos depois de queda de rede: TC-062/C4 (1 queda).

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

