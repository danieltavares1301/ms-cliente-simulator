# Resultado do runbook da Unificação 2.2 — etapa 5 (R4) na `mrv-devDan`

> **Etapa 5 do plano da reescrita.** Mede-se contra a etapa 4, com `npm run runbook:bugs -- --comparar` (`docs/plano-branch-reescrita-2.2.md`, seção 6).

Execução de 2026-10-23T02:53:26.971Z a 2026-10-23T03:56:00.291Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**484 RUNs:** 482 conformes, 2 divergentes, 0 com erro de execução.

> **Código na dev:** o branch da reescrita até o item 6 da R4 (`753b1e272a`).
> Veja `docs/estado-da-mrv-devDan.md`.
>
> **Harness:** desde esta etapa, o eco do MS Clientes só sai quando o
> Salesforce chama o `atualizarCliente`, com o prospect da chamada (runbook,
> seção 4.6). A campanha rodou de 02:53 a 03:49 UTC com 475 conformes. Os 7
> divergentes que sobraram eram do harness, nas asserções que dependiam da
> hora fixa do eco antigo:
> - **RL (003, 004, 024, 027, 039 e 048):** a repostagem do cliente ia em
>   t+20, a hora do eco antigo, e não na data que o MS Clientes tem gravada;
> - **EP do 021:** a asserção do parcial atrasado comparava com o PROS-Y do
>   fim, e não com o prospect de antes do parcial.
>
> Corrigido o harness, o perfil RL inteiro (39 RUNs) e o EP do 021 rodaram de
> novo das 03:49 às 03:56 UTC, todos conformes. As linhas novas foram
> acrescentadas ao JSONL, e o relatório usa a última de cada par.
>
> **Os 2 divergentes (TC-013 no CA e no ME):** achado no Apex. A política roda
> no `/Cliente` com os contatos que a Account tem no instante. Nos dois RUNs,
> ela rodou entre o `contato-email` e o `contato-celular`, sem o Proponente de
> Y (a PAC aprovada vem depois): achou só o e-mail C, não achou o candidato
> sem CPF pelo celular B e criou um Lead novo. É uma corrida: na amostra do
> item 3 da R4, o mesmo TC passou no CA.

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
| TC-001 | CPF divergente com os mesmos contatos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-002 | CPF, e-mail e celular divergentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-005 | Account Y existente, Lead Y ausente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-006 | Account Y e Lead Y órfão existentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-007 | Contatos de Y pertencem ao Lead Z | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-009 | Account Y incompleta e Lead Y existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-010 | Colisão apenas de e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-011 | Colisão apenas de celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-012 | Fallback por e-mail em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-013 | Fallback por celular em Lead sem CPF | ✅ conforme | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-016 | Y inexistente e colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-017 | Y inexistente; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-018 | Y inexistente; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-020 | Account Y só com CPF; nenhum Lead | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-021 | Account Y com prospect divergente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-022 | Account Y incompleta e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-023 | Account Y inexistente e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-026 | Dois Leads Y; reutilizar o livre | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-041 | Venda Genérica com colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-042 | Venda Genérica; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |

## Divergências e erros

### TC-013 — Fallback por celular em Lead sem CPF

**CA** (`TC013-CA-e69383`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dMtE02AK ≠ leadCandidato 00QHZ00000dMxuD2AS"]`

**ME** (`TC013-ME-22f61e`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000dMJAV2A4 ≠ leadCandidato 00QHZ00000dMuRi2AK"]`

## Adaptações registradas

- **TC-012:** O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.
- **TC-014:** IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.
- **TC-015:** IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.
- **TC-025:** Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.
- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.
- **TC-040:** Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.
- **TC-046:** Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).
- **TC-047:** A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).
- **TC-062:** Eventos vão sem idprospectsalesforce.

## Tempos

Média de 484 RUNs, em segundos: total 41.3; massa 4.1; cadeia 31.4 (dos quais 14.1 esperando jobs); verificação 0.6; cleanup 5.2.

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

