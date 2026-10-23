# Resultado do runbook da Unificação 2.2 — etapa 6 (R5) na `mrv-devDan`

> **Etapa 6 do plano da reescrita.** Mede-se contra a etapa 5, com `npm run runbook:bugs -- --comparar` (`docs/plano-branch-reescrita-2.2.md`, seção 6).

Execução de 2026-10-23T11:34:21.201Z a 2026-10-23T12:50:23.278Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**626 RUNs:** 626 conformes, 0 divergentes, 0 com erro de execução.

> **Código na dev:** o branch da reescrita até o `8f4a205492` (commit 31 do
> mapa), o fim da R4 com a correção do TC-013. A R5 não teve código novo: a
> campanha mede se ela já veio com as lacunas 2 e 6 da R1 e com a R4
> (`docs/plano-branch-reescrita-2.2.md`, seção 5.3).
>
> **O que esta campanha tem a mais que a da etapa 5:**
> - **os TCs 053 a 057**, que ficam fora do `--todos` e do modelo do harness
>   (a planilha descreve um proponente adicional; o harness só troca o
>   principal). Rodaram nos 16 perfis em que se aplicam;
> - **três perfis novos de reentrega,** sobre a ordem do PA. O parcial
>   recusado antes do cliente ("Parcial antes do cliente", 500) volta mais
>   tarde, como o Event Grid faz: depois da PAC aprovada (RP), depois da
>   máquina e antes do eco (RE) ou no fim (RF). Só valem nos TCs com
>   `cliente-insert`, os únicos em que o parcial é recusado: 27 de 44. Antes
>   da campanha, os três rodaram sozinhos nesses 27 TCs, com 81 conformes em
>   81 (`etapa-5-reentrega-2026-10-23.jsonl`).
>
> **O B7 (corrida no FW do TC-040):** além do FW desta campanha, o par rodou
> mais 5 vezes ao mesmo tempo, às 13:12 UTC. Todas conformes, com 1 Lead do
> CPF. Desde a R4, são 12 FW do 040 conformes.
>
> **Rede:** 2 RUNs foram refeitos por queda de rede, como o harness faz; o
> relatório usa a última execução de cada par.

> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os
> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em
> que o caminho alcança X, "Account X intacta" diverge até os guards de
> identidade serem implantados. Veja `docs/handoff-investigacao-tc001-bug4.md`.

> **Perfis AR, AM, FW, RC, EP, RL, RP, RE e RF (ordens reais):** a ordem que o
> MS de crédito, o WebJob e o MS Clientes produzem, e a reentrega atrasada do
> Event Grid (RP, RE e RF). "—" é TC em que o perfil não se aplica: no AM, a
> pessoa aprovada ainda não existe no MS Clientes; no RP, no RE e no RF, ela já
> tem Account, e nenhum parcial é recusado. Veja a seção 7.2 de
> `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Resumo por TC

| TC | Cenário | PA (ORDEM-PARCIAIS-ANTES) | CA (ORDEM-CLIENTE-ANTES) | ME (ORDEM-MESMO-EVENTTIME) | C1 (CAMINHO-1-PAC-SEM-IDCLIENTE-E-PENDENCIA) | C2 (CAMINHO-2-PAC-COM-IDCLIENTE-DA-JORNADA-E-PENDENCIA) | C3 (CAMINHO-3-PENDENCIA-ANTES-DA-PAC) | C4 (CAMINHO-4-CONTESTACAO-PENDENTE) | AR (APROVACAO-REAL-PESSOA-NOVA) | AM (APROVACAO-REAL-PESSOA-EXISTENTE) | FW (FALHA-E-REPETICAO-DO-WEBJOB) | RC (RELOGIO-DO-CREDITO) | EP (ECO-ANTES-DO-PARCIAL) | RL (REPOSTAGEM-EM-LOTE) | RP (REENTREGA-DEPOIS-DA-PAC-APROVADA) | RE (REENTREGA-ANTES-DO-ECO) | RF (REENTREGA-NO-FIM) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-002 | CPF, e-mail e celular divergentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-005 | Account Y existente, Lead Y ausente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-006 | Account Y e Lead Y órfão existentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-007 | Contatos de Y pertencem ao Lead Z | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-009 | Account Y incompleta e Lead Y existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-010 | Colisão apenas de e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-011 | Colisão apenas de celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-012 | Fallback por e-mail em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-013 | Fallback por celular em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-016 | Y inexistente e colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-017 | Y inexistente; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-018 | Y inexistente; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-020 | Account Y só com CPF; nenhum Lead | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-021 | Account Y com prospect divergente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-022 | Account Y incompleta e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-023 | Account Y inexistente e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-026 | Dois Leads Y; reutilizar o livre | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-040 | Venda Genérica aprova CPF Y diferente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-041 | Venda Genérica com colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-042 | Venda Genérica; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-053 | Proponente com Account/IdCliente existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
| TC-054 | Proponente X aprovado como Y na Venda Genérica | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-055 | Priorizar Lead Y por CPF na Venda Genérica | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-056 | Repetição funcional do TC-055 | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-057 | Proponente Y colide totalmente com X | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | — | — | — |
## Adaptações registradas

- **TC-012:** O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.
- **TC-014:** IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.
- **TC-015:** IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.
- **TC-025:** Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.
- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.
- **TC-040:** Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.
- **TC-046:** Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).
- **TC-047:** A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).
- **TC-053:** Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.
- **TC-056:** Duplicação aparente da planilha: mesma massa do TC-055.
- **TC-062:** Eventos vão sem idprospectsalesforce.

## Tempos

Média de 626 RUNs, em segundos: total 43.2; massa 4.0; cadeia 33.3 (dos quais 15.7 esperando jobs); verificação 0.6; cleanup 5.3.

Refeitos depois de queda de rede: TC-042/CA (1 queda), TC-056/RC (1 queda).

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

