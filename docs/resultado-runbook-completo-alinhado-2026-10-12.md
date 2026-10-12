# Resultado do runbook — campanha completa alinhada à planilha, 12/10

> **Campanha alinhada à planilha.** Mesma dev da
> [campanha com os commits](resultado-runbook-completo-com-commits-2026-10-11.md),
> com as quatro classes na ponta da 2.2 (`3f2919f5e7`). O que mudou foi o
> harness, alinhado à planilha oficial
> ([convergência entre a planilha e o runbook](convergencia-planilha-runbook-2.2.md)):
>
> - massa e aprovação como na planilha no 019, no 044 e no 046, e a 1ª PAC de X
>   com os contatos que X tem;
> - verificações que a planilha pede em todos os TCs: contatos e IdCliente da
>   Account aprovada, nenhuma Account a mais com o CPF aprovado e CPF e contatos
>   do Proponente; o CPF e os contatos do Lead no 004 e no 039; os contatos do
>   Lead Y2 no 026;
> - no 047, a exigência de preservar os contatos do Lead Y, que não vem da
>   planilha, e sim da regra do commit `d6f147d303` e do teste da QA de 29/08.
>   O 047 foi refeito às 12:28 UTC com ela, e o resultado dele substitui o da
>   rodada das 11:01;
> - os TCs 053 a 057, de proponente adicional, fora do `--todos`.

Execução de 2026-10-12T11:01:59.364Z a 2026-10-12T12:30:18.047Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**484 RUNs:** 295 conformes, 189 divergentes, 0 com erro de execução.

> **Perfis C1 a C4 (bug 4 do TC-001):** ordem CA mais PACs em análise com os
> dados da pessoa aprovada e um gatilho (pendência ou contestação). Nos TCs em
> que o caminho alcança X, "Account X intacta" diverge. Com os commits, o C1
> para na recusa da PAC em análise. Veja `docs/handoff-investigacao-tc001-bug4.md`.

> **Perfis AR, AM, FW, RC, EP e RL (ordens reais da aprovação):** a ordem que o
> MS de crédito, o WebJob e o MS Clientes produzem. "—" no AM é TC em que ele
> não se aplica (a pessoa aprovada ainda não existe no MS Clientes). Veja a
> seção 7.2 de `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Análise

Os 39 TCs executáveis no modelo do harness, nos 13 perfis, com
`npm run runbook -- --todos --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL --paralelo 6`.
O AM rodou só nos 16 TCs em que se aplica.

- **Execução:** das 11:01 às 11:49 UTC, mais o TC-047 refeito às 12:28. Nenhum
  RUN terminou em erro, uma queda de rede foi refeita e o resíduo ficou
  zerado.
- **Verificações novas:** rodaram em 466 RUNs (os outros 18 param na recusa da
  PAC em análise, no C1) e não falharam em nenhum. Em todos os RUNs, a Account
  aprovada e o Proponente refletem a PAC, o IdCliente está certo e não sobra
  Account duplicada.

| Perfil | RUNs | Conformes | Divergentes |
|---|---:|---:|---:|
| PA | 39 | 35 | 4 |
| CA | 39 | 36 | 3 |
| ME | 39 | 35 | 4 |
| C1 | 39 | 21 | 18 |
| C2 | 39 | 3 | 36 |
| C3 | 39 | 3 | 36 |
| C4 | 39 | 3 | 36 |
| AR | 39 | 20 | 19 |
| AM | 16 | 14 | 2 |
| FW | 39 | 17 | 22 |
| RC | 39 | 36 | 3 |
| EP | 39 | 36 | 3 |
| RL | 39 | 36 | 3 |

### O que mudou com o alinhamento

O código da dev é o mesmo da campanha com os commits; as mudanças vêm do
harness. Pela comparação (`npm run runbook:bugs -- --comparar`):

| Bug | Com os commits (11/10) | Alinhada (12/10) | Por quê |
|---|---:|---:|---|
| B10 — o Lead Y reutilizado recebe o celular de X | 0 | 11 | a verificação dos contatos do Lead Y2 no 026, que a planilha pede |
| B9 — o Lead Y reutilizado perde os contatos dele | 6 | 2 | ficou só no 047, no AR e no FW; o 055 e o 056 saíram do `--todos`. A preservação no 047 é regra da 2.2 e da QA, não da planilha |
| K2 — Lead candidato sem CPF não reutilizado | 24 | 16 | com o celular B da planilha, o candidato do 046 é reutilizado em todos os perfis |
| B7 — segundo Lead para Y na repetição do WebJob | 1 | 0 | é corrida: nesta rodada, o FW do 040 terminou com um só Lead de Y |
| B1, B2, B6 e B8 | 82, 41, 13 e 60 | 72, 36, 11 e 48 | os pares dos TCs 053 a 057, que saíram do `--todos` |
| B3, B4, B5 e K1 | 3, 3, 2 e 2 | iguais | |

- **Nos perfis obrigatórios** (PA, CA e ME), divergem agora o K1 (040, no PA e
  no ME), o K2 (045 e 049) e o B10 (026). O B10 é o único bug, entre esses três
  pontos, que viola a regra mestra: o Lead de Y termina com o celular de X.
- **Fora deles**, seguem o B1 no C2 e no C3, o B2 no C4, o B3, o B4, o B5, o
  B6 no FW, o B8 no C1, no AR e no FW, e o B9 no 047, no AR e no FW.

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
| TC-026 | Dois Leads Y; reutilizar o livre | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ❌ diverge | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ❌ diverge | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-041 | Venda Genérica com colisão total | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-042 | Venda Genérica; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |

## Divergências e erros

### TC-001 — CPF divergente com os mesmos contatos

**C1** (`TC001-C1-e4635a`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC001-C2-0a24a8`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:01:14.000+0000"}]`

**C3** (`TC001-C3-607994`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:00:59.000+0000","depois":"2026-10-12T11:01:14.000+0000"}]`

**C4** (`TC001-C4-cc0380`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:00:34.000+0000","depois":"2026-10-12T11:01:44.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:00:34.000+0000","depoi…`

**AR** (`TC001-AR-a3e2a1`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:01:41.000+0000"}]`

**FW** (`TC001-FW-6e7fa8`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc001.a.tc001-fw-6e7fa8@example.com","celular 31987537732"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:01:43.000+0000"}]`

### TC-002 — CPF, e-mail e celular divergentes

**C1** (`TC002-C1-7ae188`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC002-C2-12d696`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c2-12d696@example.com","depois":"qa.unif22.tc002.c.tc002-c2-12d696@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC002-C3-b2a99d`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c3-b2a99d@example.com","depois":"qa.unif22.tc002.c.tc002-c3-b2a99d@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:02:41.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c3-b2a99d@example.com","depois":"qa.unif22.tc002.c.tc002-c3-b2a99d@example.com"}]`

**C4** (`TC002-C4-e3b3d1`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-c4-e3b3d1@example.com","depois":"qa.unif22.tc002.c.tc002-c4-e3b3d1@example.com"},{"campo":"Celular__c","antes":"31983000093","depois":"31973000093"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-c4-e3b3d1@example.com","depois":"qa.unif22.tc002.c.tc002-c4-e3b3d1@example.com"},{"campo":"MobilePhone","antes":"31983000093","depois":"31973000093"},{"campo":"CelularSe…`

**AR** (`TC002-AR-5fe930`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:02:50.000+0000"}]`

**FW** (`TC002-FW-22f1b7`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:02:51.000+0000"}]`

### TC-005 — Account Y existente, Lead Y ausente

**C2** (`TC005-C2-de9cb3`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c2-de9cb3@example.com","depois":"qa.unif22.tc005.c.tc005-c2-de9cb3@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c2-de9cb3@example.com","depois":"qa.unif22.tc005.c.tc005-c2-de9cb3@example.com"}]`

**C3** (`TC005-C3-c7a268`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c3-c7a268@example.com","depois":"qa.unif22.tc005.c.tc005-c3-c7a268@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:06:08.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c3-c7a268@example.com","depois":"qa.unif22.tc005.c.tc005-c3-c7a268@example.com"}]`

**C4** (`TC005-C4-fed8e5`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc005.a.tc005-c4-fed8e5@example.com","depois":"qa.unif22.tc005.c.tc005-c4-fed8e5@example.com"},{"campo":"Celular__c","antes":"31982860258","depois":"31972860258"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc005.a.tc005-c4-fed8e5@example.com","depois":"qa.unif22.tc005.c.tc005-c4-fed8e5@example.com"},{"campo":"MobilePhone","antes":"31982860258","depois":"31972860258"},{"campo":"CelularSe…`

### TC-006 — Account Y e Lead Y órfão existentes

**C2** (`TC006-C2-9e03ab`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c2-9e03ab@example.com","depois":"qa.unif22.tc006.c.tc006-c2-9e03ab@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC006-C3-d658b0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c3-d658b0@example.com","depois":"qa.unif22.tc006.c.tc006-c3-d658b0@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:07:16.0…`

**C4** (`TC006-C4-5726ce`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc006.a.tc006-c4-5726ce@example.com","depois":"qa.unif22.tc006.c.tc006-c4-5726ce@example.com"},{"campo":"Celular__c","antes":"31988881843","depois":"31978881843"},{"campo":"Data…`

### TC-007 — Contatos de Y pertencem ao Lead Z

**C2** (`TC007-C2-03038b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c2-03038b@example.com","depois":"qa.unif22.tc007.c.tc007-c2-03038b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC007-C3-49c887`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c3-49c887@example.com","depois":"qa.unif22.tc007.c.tc007-c3-49c887@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:08:42.0…`

**C4** (`TC007-C4-ea0dc7`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc007.a.tc007-c4-ea0dc7@example.com","depois":"qa.unif22.tc007.c.tc007-c4-ea0dc7@example.com"},{"campo":"Celular__c","antes":"31989887695","depois":"31979887695"},{"campo":"Data…`

**FW** (`TC007-FW-b1c326`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc007.c.tc007-fw-b1c326@example.com"]`

### TC-009 — Account Y incompleta e Lead Y existente

**C2** (`TC009-C2-f06ec7`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:10:09.000+0000"}]`

**C3** (`TC009-C3-79e535`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:10:03.000+0000","depois":"2026-10-12T11:10:18.000+0000"}]`

**C4** (`TC009-C4-bb11cc`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:09:03.000+0000","depois":"2026-10-12T11:10:13.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:09:03.000+0000","depoi…`

### TC-010 — Colisão apenas de e-mail

**C2** (`TC010-C2-32daba`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:11:20.000+0000"}]`

**C3** (`TC010-C3-5dcbfb`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:11:05.000+0000","depois":"2026-10-12T11:11:20.000+0000"}]`

**C4** (`TC010-C4-9141d9`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31986599330","depois":"31976599330"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:10:06.000+0000","depois":"2026-10-12T11:11:16.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31986599330","depois":"31976599330"},{"campo":"CelularSemFormatacao__c","antes":"31986599330","depois":"31976599330"}]`

**FW** (`TC010-FW-fe99e8`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc010.a.tc010-fw-fe99e8@example.com"]`

### TC-011 — Colisão apenas de celular

**C2** (`TC011-C2-e8e008`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c2-e8e008@example.com","depois":"qa.unif22.tc011.c.tc011-c2-e8e008@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC011-C3-874326`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c3-874326@example.com","depois":"qa.unif22.tc011.c.tc011-c3-874326@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:12:31.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c3-874326@example.com","depois":"qa.unif22.tc011.c.tc011-c3-874326@example.com"}]`

**C4** (`TC011-C4-8ab21d`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc011.a.tc011-c4-8ab21d@example.com","depois":"qa.unif22.tc011.c.tc011-c4-8ab21d@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:11:31.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc011.a.tc011-c4-8ab21d@example.com","depois":"qa.unif22.tc011.c.tc011-c4-8ab21d@example.com"}]`

### TC-012 — Fallback por e-mail em Lead sem CPF

_Observação:_ O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.

**C2** (`TC012-C2-67dfc9`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:14:00.000+0000"}]`

**C3** (`TC012-C3-cfc0ae`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:13:48.000+0000","depois":"2026-10-12T11:14:03.000+0000"}]`

**C4** (`TC012-C4-38a30d`, ❌ diverge):

- Lead X intacto (guard ehLeadOriginal): `[{"campo":"MobilePhone","antes":"31982581362","depois":"31972581362"},{"campo":"CelularSemFormatacao__c","antes":"31982581362","depois":"31972581362"}]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31982581362","depois":"31972581362"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:12:57.000+0000","depois":"2026-10-12T11:14:07.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31982581362","depois":"31972581362"},{"campo":"CelularSemFormatacao__c","antes":"31982581362","depois":"31972581362"}]`

### TC-013 — Fallback por celular em Lead sem CPF

**C2** (`TC013-C2-24e324`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c2-24e324@example.com","depois":"qa.unif22.tc013.c.tc013-c2-24e324@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC013-C3-d9b60e`, ❌ diverge):

- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c3-d9b60e@example.com","depois":"qa.unif22.tc013.c.tc013-c3-d9b60e@example.com"}]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c3-d9b60e@example.com","depois":"qa.unif22.tc013.c.tc013-c3-d9b60e@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:15:06.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c3-d9b60e@example.com","depois":"qa.unif22.tc013.c.tc013-c3-d9b60e@example.com"}]`

**C4** (`TC013-C4-fd0b56`, ❌ diverge):

- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c4-fd0b56@example.com","depois":"qa.unif22.tc013.c.tc013-c4-fd0b56@example.com"}]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc013.a.tc013-c4-fd0b56@example.com","depois":"qa.unif22.tc013.c.tc013-c4-fd0b56@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:14:15.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc013.a.tc013-c4-fd0b56@example.com","depois":"qa.unif22.tc013.c.tc013-c4-fd0b56@example.com"}]`

**AR** (`TC013-AR-23eca7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chUZf2AM ≠ leadCandidato 00QHZ00000chNI42AM"]`

**FW** (`TC013-FW-da7532`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chAnx2AE ≠ leadCandidato 00QHZ00000chQuE2AU"]`

### TC-014 — Sem compatibilidade; IdCliente em minúsculas

_Observação:_ IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.

**C2** (`TC014-C2-d72ab9`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c2-d72ab9@example.com","depois":"qa.unif22.tc014.c.tc014-c2-d72ab9@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC014-C3-014710`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c3-014710@example.com","depois":"qa.unif22.tc014.c.tc014-c3-014710@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:16:16.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c3-014710@example.com","depois":"qa.unif22.tc014.c.tc014-c3-014710@example.com"}]`

**C4** (`TC014-C4-1bd7ff`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc014.a.tc014-c4-1bd7ff@example.com","depois":"qa.unif22.tc014.c.tc014-c4-1bd7ff@example.com"},{"campo":"Celular__c","antes":"31987328724","depois":"31977328724"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc014.a.tc014-c4-1bd7ff@example.com","depois":"qa.unif22.tc014.c.tc014-c4-1bd7ff@example.com"},{"campo":"MobilePhone","antes":"31987328724","depois":"31977328724"},{"campo":"CelularSe…`

### TC-015 — Sem compatibilidade; IdCliente em maiúsculas

_Observação:_ IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.

**C2** (`TC015-C2-e0783b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c2-e0783b@example.com","depois":"qa.unif22.tc015.c.tc015-c2-e0783b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c2-e0783b@example.com","depois":"qa.unif22.tc015.c.tc015-c2-e0783b@example.com"}]`

**C3** (`TC015-C3-abf677`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c3-abf677@example.com","depois":"qa.unif22.tc015.c.tc015-c3-abf677@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:17:41.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c3-abf677@example.com","depois":"qa.unif22.tc015.c.tc015-c3-abf677@example.com"}]`

**C4** (`TC015-C4-c0c935`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc015.a.tc015-c4-c0c935@example.com","depois":"qa.unif22.tc015.c.tc015-c4-c0c935@example.com"},{"campo":"Celular__c","antes":"31980564109","depois":"31970564109"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc015.a.tc015-c4-c0c935@example.com","depois":"qa.unif22.tc015.c.tc015-c4-c0c935@example.com"},{"campo":"MobilePhone","antes":"31980564109","depois":"31970564109"},{"campo":"CelularSe…`

### TC-016 — Y inexistente e colisão total

**C1** (`TC016-C1-25f47b`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC016-C2-d370dc`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:47:48.000+0000"}]`

**C3** (`TC016-C3-d3a7f7`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:18:52.000+0000","depois":"2026-10-12T11:19:07.000+0000"}]`

**C4** (`TC016-C4-8f10d3`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:17:53.000+0000","depois":"2026-10-12T11:19:03.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:17:53.000+0000","depoi…`

**AR** (`TC016-AR-9a412e`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:18:58.000+0000"}]`

**FW** (`TC016-FW-b35733`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc016.a.tc016-fw-b35733@example.com","celular 31983389536"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:18:59.000+0000"}]`

### TC-017 — Y inexistente; celular colide

**C1** (`TC017-C1-5f9afe`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC017-C2-8436d6`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c2-8436d6@example.com","depois":"qa.unif22.tc017.c.tc017-c2-8436d6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC017-C3-81b3a8`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c3-81b3a8@example.com","depois":"qa.unif22.tc017.c.tc017-c3-81b3a8@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:20:02.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c3-81b3a8@example.com","depois":"qa.unif22.tc017.c.tc017-c3-81b3a8@example.com"}]`

**C4** (`TC017-C4-b46fb8`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-c4-b46fb8@example.com","depois":"qa.unif22.tc017.c.tc017-c4-b46fb8@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:19:03.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-c4-b46fb8@example.com","depois":"qa.unif22.tc017.c.tc017-c4-b46fb8@example.com"}]`

**AR** (`TC017-AR-e6db3c`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:20:03.000+0000"}]`

**FW** (`TC017-FW-1867c2`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31986875390"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:20:03.000+0000"}]`

### TC-018 — Y inexistente; e-mail colide

**C1** (`TC018-C1-c1d1d9`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC018-C2-03f969`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:21:13.000+0000"}]`

**C3** (`TC018-C3-b087ef`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:20:58.000+0000","depois":"2026-10-12T11:21:13.000+0000"}]`

**C4** (`TC018-C4-23f45c`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31989070040","depois":"31979070040"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:20:00.000+0000","depois":"2026-10-12T11:21:10.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31989070040","depois":"31979070040"},{"campo":"CelularSemFormatacao__c","antes":"31989070040","depois":"31979070040"}]`

**AR** (`TC018-AR-1ec3f1`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:21:00.000+0000"}]`

**FW** (`TC018-FW-aeb80f`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc018.a.tc018-fw-aeb80f@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:21:05.000+0000"}]`

### TC-019 — Lead Y livre por CPF, contatos diferentes

**C2** (`TC019-C2-a8f021`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:22:20.000+0000"}]`

**C3** (`TC019-C3-c8a4e4`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:22:05.000+0000","depois":"2026-10-12T11:22:20.000+0000"}]`

**C4** (`TC019-C4-198a14`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:21:05.000+0000","depois":"2026-10-12T11:22:15.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:21:05.000+0000","depoi…`

### TC-020 — Account Y só com CPF; nenhum Lead

**C2** (`TC020-C2-159699`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c2-159699@example.com","depois":"qa.unif22.tc020.c.tc020-c2-159699@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC020-C3-756193`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c3-756193@example.com","depois":"qa.unif22.tc020.c.tc020-c3-756193@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:23:14.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c3-756193@example.com","depois":"qa.unif22.tc020.c.tc020-c3-756193@example.com"}]`

**C4** (`TC020-C4-b24fff`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc020.a.tc020-c4-b24fff@example.com","depois":"qa.unif22.tc020.c.tc020-c4-b24fff@example.com"},{"campo":"Celular__c","antes":"31982639241","depois":"31972639241"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc020.a.tc020-c4-b24fff@example.com","depois":"qa.unif22.tc020.c.tc020-c4-b24fff@example.com"},{"campo":"MobilePhone","antes":"31982639241","depois":"31972639241"},{"campo":"CelularSe…`

### TC-021 — Account Y com prospect divergente

**C2** (`TC021-C2-1a3223`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c2-1a3223@example.com","depois":"qa.unif22.tc021.c.tc021-c2-1a3223@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC021-C3-2c5b94`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c3-2c5b94@example.com","depois":"qa.unif22.tc021.c.tc021-c3-2c5b94@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:24:33.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c3-2c5b94@example.com","depois":"qa.unif22.tc021.c.tc021-c3-2c5b94@example.com"}]`

**C4** (`TC021-C4-c71fe6`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc021.a.tc021-c4-c71fe6@example.com","depois":"qa.unif22.tc021.c.tc021-c4-c71fe6@example.com"},{"campo":"Celular__c","antes":"31980793741","depois":"31970793741"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.a.tc021-c4-c71fe6@example.com","depois":"qa.unif22.tc021.c.tc021-c4-c71fe6@example.com"},{"campo":"MobilePhone","antes":"31980793741","depois":"31970793741"},{"campo":"CelularSe…`

**AR** (`TC021-AR-23fb8d`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ar-23fb8d@example.com","depois":"qa.unif22.tc021.c.tc021-ar-23fb8d@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AR-23fb8d","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**AM** (`TC021-AM-59b20e`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-am-59b20e@example.com","depois":"qa.unif22.tc021.c.tc021-am-59b20e@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AM-59b20e","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**FW** (`TC021-FW-81bacb`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-fw-81bacb@example.com","depois":"qa.unif22.tc021.c.tc021-fw-81bacb@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-FW-81bacb","depois":"UNIF22 TC…`

### TC-022 — Account Y incompleta e Lead Y órfão

**C2** (`TC022-C2-47f7e0`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:26:04.000+0000"}]`

**C3** (`TC022-C3-560f9b`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:25:49.000+0000","depois":"2026-10-12T11:26:04.000+0000"}]`

**C4** (`TC022-C4-bd1694`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:24:50.000+0000","depois":"2026-10-12T11:26:00.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:24:50.000+0000","depoi…`

### TC-023 — Account Y inexistente e Lead Y órfão

**C1** (`TC023-C1-31acd9`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC023-C2-3c0a98`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:27:04.000+0000"}]`

**C3** (`TC023-C3-f82b30`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:26:52.000+0000","depois":"2026-10-12T11:27:07.000+0000"}]`

**C4** (`TC023-C4-9a1a46`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:25:54.000+0000","depois":"2026-10-12T11:27:04.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:25:54.000+0000","depoi…`

**AR** (`TC023-AR-eb252f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:26:55.000+0000"}]`

**FW** (`TC023-FW-c02749`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:26:56.000+0000"}]`

### TC-024 — Lead Y preso a outra Account

**C2** (`TC024-C2-bb8310`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:28:18.000+0000"}]`

**C3** (`TC024-C3-a91c36`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:28:03.000+0000","depois":"2026-10-12T11:28:18.000+0000"}]`

**C4** (`TC024-C4-ce810f`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:27:05.000+0000","depois":"2026-10-12T11:28:15.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:27:05.000+0000","depoi…`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**C2** (`TC025-C2-cd225f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:29:25.000+0000"}]`

**C3** (`TC025-C3-c23dbf`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:29:10.000+0000","depois":"2026-10-12T11:29:25.000+0000"}]`

**C4** (`TC025-C4-7a494b`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:28:31.000+0000","depois":"2026-10-12T11:29:41.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:28:31.000+0000","depoi…`

**FW** (`TC025-FW-18a762`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc025.a.tc025-fw-18a762@example.com"]`

### TC-026 — Dois Leads Y; reutilizar o livre

**PA** (`TC026-PA-d50fa3`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-pa-d50fa3@example.com / 31986167609"]`

**CA** (`TC026-CA-0e1b50`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-ca-0e1b50@example.com / 31982340160"]`

**ME** (`TC026-ME-92a0fa`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-me-92a0fa@example.com / 31986528829"]`

**C1** (`TC026-C1-0637f3`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-c1-0637f3@example.com / 31983824931"]`

**C2** (`TC026-C2-6ce703`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-c2-6ce703@example.com / 31985298590"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:30:38.000+0000"}]`

**C3** (`TC026-C3-1ca972`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-c3-1ca972@example.com / 31988782876"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:30:24.000+0000","depois":"2026-10-12T11:30:39.000+0000"}]`

**C4** (`TC026-C4-919cd6`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-c4-919cd6@example.com / 31987130037"]`
- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:29:44.000+0000","depois":"2026-10-12T11:30:54.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:29:44.000+0000","depoi…`

**AM** (`TC026-AM-32d4bf`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-am-32d4bf@example.com / 31986210595"]`

**RC** (`TC026-RC-16af76`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-rc-16af76@example.com / 31984056260"]`

**EP** (`TC026-EP-dd7d83`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-ep-dd7d83@example.com / 31980214068"]`

**RL** (`TC026-RL-91d20e`, ❌ diverge):

- Lead leadY2 reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc026.leady2.tc026-rl-91d20e@example.com / 31987171136"]`

### TC-027 — Todos os Leads Y estão presos

**C2** (`TC027-C2-81da26`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:31:55.000+0000"}]`

**C3** (`TC027-C3-356ead`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:31:55.000+0000","depois":"2026-10-12T11:32:10.000+0000"}]`

**C4** (`TC027-C4-a51aa8`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:31:00.000+0000","depois":"2026-10-12T11:32:10.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:31:00.000+0000","depoi…`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**C1** (`TC038-C1-8db113`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-c1-8db113@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:32:59.000+0000"}]`

**C2** (`TC038-C2-7fe90f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:33:00.000+0000"}]`

**C3** (`TC038-C3-0e8226`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:33:09.000+0000","depois":"2026-10-12T11:33:24.000+0000"}]`

**C4** (`TC038-C4-a274b2`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:32:15.000+0000","depois":"2026-10-12T11:33:25.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:32:15.000+0000","depoi…`

**AR** (`TC038-AR-37e40a`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-ar-37e40a@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:33:30.000+0000"}]`

**FW** (`TC038-FW-772012`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-fw-772012@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:33:30.000+0000"}]`
- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc038.a.tc038-fw-772012@example.com"]`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-a72950`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**ME** (`TC040-ME-641b20`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**C1** (`TC040-C1-7d1d72`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC040-C2-49ae01`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:35:27.000+0000"}]`

**C3** (`TC040-C3-ca1ef3`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:35:25.000+0000","depois":"2026-10-12T11:35:40.000+0000"}]`

**C4** (`TC040-C4-c9ff84`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:34:27.000+0000","depois":"2026-10-12T11:35:37.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:34:27.000+0000","depoi…`

**AR** (`TC040-AR-db3b12`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:35:28.000+0000"}]`

**FW** (`TC040-FW-88a5a4`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:35:38.000+0000"}]`

### TC-041 — Venda Genérica com colisão total

**C1** (`TC041-C1-a18095`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC041-C2-dbcb92`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:36:36.000+0000"}]`

**C3** (`TC041-C3-1fa01e`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:36:40.000+0000","depois":"2026-10-12T11:36:55.000+0000"}]`

**C4** (`TC041-C4-9a9a6c`, ❌ diverge):

- Account X intacta: `[{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:35:41.000+0000","depois":"2026-10-12T11:36:51.000+0000"},{"campo":"DataAlteracaoEventoContatoCelular__c","antes":"2026-10-12T11:35:41.000+0000","depoi…`

**AR** (`TC041-AR-ad4743`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:36:42.000+0000"}]`

**FW** (`TC041-FW-e61e12`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc041.a.tc041-fw-e61e12@example.com","celular 31982460032"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:36:43.000+0000"}]`

### TC-042 — Venda Genérica; e-mail colide

**C1** (`TC042-C1-ff40cf`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC042-C2-e208fd`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:37:35.000+0000"}]`

**C3** (`TC042-C3-e9be20`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:37:37.000+0000","depois":"2026-10-12T11:37:52.000+0000"}]`

**C4** (`TC042-C4-64a519`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["celular vazio"]`
- Account X intacta: `[{"campo":"Celular__c","antes":"31987377779","depois":"31977377779"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:36:37.000+0000","depois":"2026-10-12T11:37:47.000+0000"},{"campo":"DataAlteracaoEv…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31987377779","depois":"31977377779"},{"campo":"CelularSemFormatacao__c","antes":"31987377779","depois":"31977377779"}]`

**AR** (`TC042-AR-accfe7`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:37:46.000+0000"}]`

**FW** (`TC042-FW-8b23f6`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc042.a.tc042-fw-8b23f6@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:37:52.000+0000"}]`

### TC-043 — Venda Genérica; celular colide

**C1** (`TC043-C1-393d3c`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC043-C2-a0d4c3`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c2-a0d4c3@example.com","depois":"qa.unif22.tc043.c.tc043-c2-a0d4c3@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c2-a0d4c3@example.com","depois":"qa.unif22.tc043.c.tc043-c2-a0d4c3@example.com"}]`

**C3** (`TC043-C3-51a270`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c3-51a270@example.com","depois":"qa.unif22.tc043.c.tc043-c3-51a270@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:38:39.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c3-51a270@example.com","depois":"qa.unif22.tc043.c.tc043-c3-51a270@example.com"}]`

**C4** (`TC043-C4-52d898`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-c4-52d898@example.com","depois":"qa.unif22.tc043.c.tc043-c4-52d898@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:37:43.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-c4-52d898@example.com","depois":"qa.unif22.tc043.c.tc043-c4-52d898@example.com"}]`

**AR** (`TC043-AR-729ca5`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:38:47.000+0000"}]`

**FW** (`TC043-FW-1b1f5f`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31980434740"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:38:47.000+0000"}]`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**C1** (`TC044-C1-c28d5c`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC044-C2-932853`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c2-932853@example.com","depois":"qa.unif22.tc044.c.tc044-c2-932853@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC044-C3-acb784`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c3-acb784@example.com","depois":"qa.unif22.tc044.c.tc044-c3-acb784@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:39:41.0…`

**C4** (`TC044-C4-dbd318`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-c4-dbd318@example.com","depois":"qa.unif22.tc044.c.tc044-c4-dbd318@example.com"},{"campo":"Celular__c","antes":"31983028669","depois":"31973028669"},{"campo":"Data…`

**AR** (`TC044-AR-39b1cb`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:39:51.000+0000"}]`

**FW** (`TC044-FW-e52474`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:39:52.000+0000"}]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-e1d9e9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chW5D2AU ≠ leadCandidato 00QHZ00000chMQu2AM"]`

**CA** (`TC045-CA-8c5951`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chRf52AE ≠ leadCandidato 00QHZ00000chYN82AM"]`

**ME** (`TC045-ME-19775c`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chW202AE ≠ leadCandidato 00QHZ00000chDp32AE"]`

**C1** (`TC045-C1-03bd16`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC045-C2-cdaff7`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c2-cdaff7@example.com","depois":"qa.unif22.tc045.c.tc045-c2-cdaff7@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC045-C3-f2560b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c3-f2560b@example.com","depois":"qa.unif22.tc045.c.tc045-c3-f2560b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:40:54.0…`

**C4** (`TC045-C4-f697f1`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-c4-f697f1@example.com","depois":"qa.unif22.tc045.c.tc045-c4-f697f1@example.com"},{"campo":"Celular__c","antes":"31985064816","depois":"31975064816"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"MobilePhone","antes":"31985064816","depois":"31975064816"},{"campo":"CelularSemFormatacao__c","antes":"31985064816","depois":"31975064816"}]`

**AR** (`TC045-AR-bcc050`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chUWS2A2 ≠ leadCandidato 00QHZ00000chW0Q2AU"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:40:57.000+0000"}]`

**FW** (`TC045-FW-5f43e2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chM992AE ≠ leadCandidato 00QHZ00000chXyx2AE"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:40:59.000+0000"}]`

**RC** (`TC045-RC-619c1d`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chSjE2AU ≠ leadCandidato 00QHZ00000chV5w2AE"]`

**EP** (`TC045-EP-5e29d9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chVDz2AM ≠ leadCandidato 00QHZ00000chUWT2A2"]`

**RL** (`TC045-RL-2ec762`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chTdi2AE ≠ leadCandidato 00QHZ00000cha5c2AA"]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

_Observação:_ Como na planilha: o candidato e a aprovação têm o celular B, o mesmo de X (o runbook usava D).

**C1** (`TC046-C1-7c7625`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC046-C2-a5ccf5`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c2-a5ccf5@example.com","depois":"qa.unif22.tc046.c.tc046-c2-a5ccf5@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC046-C3-5bed1b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c3-5bed1b@example.com","depois":"qa.unif22.tc046.c.tc046-c3-5bed1b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:41:57.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-c3-5bed1b@example.com","depois":"qa.unif22.tc046.c.tc046-c3-5bed1b@example.com"}]`

**C4** (`TC046-C4-d42b14`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-c4-d42b14@example.com","depois":"qa.unif22.tc046.c.tc046-c4-d42b14@example.com"},{"campo":"DataAlteracaoEventoContatoEmail__c","antes":"2026-10-12T11:40:59.000+000…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-c4-d42b14@example.com","depois":"qa.unif22.tc046.c.tc046-c4-d42b14@example.com"}]`

**AR** (`TC046-AR-4ad545`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:41:59.000+0000"}]`

**FW** (`TC046-FW-f03095`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:42:17.000+0000"}]`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

_Observação:_ A planilha não fala dos contatos do Lead Y. Preservá-los segue a regra do commit d6f147d303 (2.2) e o teste da QA de 29/08 (campanha R7153616).

**C1** (`TC047-C1-887b7d`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC047-C2-6faf59`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c2-6faf59@example.com","depois":"qa.unif22.tc047.c.tc047-c2-6faf59@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c2-6faf59@example.com","depois":"qa.unif22.tc047.c.tc047-c2-6faf59@example.com"}]`

**C3** (`TC047-C3-9f99ec`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c3-9f99ec@example.com","depois":"qa.unif22.tc047.c.tc047-c3-9f99ec@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T12:28:07.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c3-9f99ec@example.com","depois":"qa.unif22.tc047.c.tc047-c3-9f99ec@example.com"}]`

**C4** (`TC047-C4-68cefb`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-c4-68cefb@example.com","depois":"qa.unif22.tc047.c.tc047-c4-68cefb@example.com"},{"campo":"Celular__c","antes":"31989213670","depois":"31979213670"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-c4-68cefb@example.com","depois":"qa.unif22.tc047.c.tc047-c4-68cefb@example.com"},{"campo":"MobilePhone","antes":"31989213670","depois":"31979213670"},{"campo":"CelularSe…`

**AR** (`TC047-AR-e4257e`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc047.c.tc047-ar-e4257e@example.com / 31979193279"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T12:28:40.000+0000"}]`

**FW** (`TC047-FW-69b7c8`, ❌ diverge):

- Lead leadY reutilizado e vinculado (contatos preservados): `["contatos alterados: qa.unif22.tc047.c.tc047-fw-69b7c8@example.com / 31978036548"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T12:28:40.000+0000"}]`

### TC-048 — Lead Y preso com compatibilidade total

**C1** (`TC048-C1-933004`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC048-C2-9e3c4c`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c2-9e3c4c@example.com","depois":"qa.unif22.tc048.c.tc048-c2-9e3c4c@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC048-C3-16b700`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c3-16b700@example.com","depois":"qa.unif22.tc048.c.tc048-c3-16b700@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:44:06.0…`

**C4** (`TC048-C4-c2a8bc`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-c4-c2a8bc@example.com","depois":"qa.unif22.tc048.c.tc048-c4-c2a8bc@example.com"},{"campo":"Celular__c","antes":"31982043389","depois":"31972043389"},{"campo":"Data…`

**AR** (`TC048-AR-74ee57`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:44:21.000+0000"}]`

**FW** (`TC048-FW-80650a`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:44:21.000+0000"}]`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-cb7cb5`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chZaw2AE ≠ leadCandidato 00QHZ00000chXSm2AM"]`

**CA** (`TC049-CA-cbd986`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chYF72AM ≠ leadCandidato 00QHZ00000chSXt2AM"]`

**ME** (`TC049-ME-e452a3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chWuu2AE ≠ leadCandidato 00QHZ00000chTsD2AU"]`

**C1** (`TC049-C1-fe44ad`, ❌ diverge):

- Erro: pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…
- Todos os eventos responderam HTTP 200: `pac-analise-1 respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: NotificacaoException:[]: Cliente(Account) nÃ£o encontrado no Salesforce. Proponente.idCliente: null. Proponente.idP…`

**C2** (`TC049-C2-489189`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c2-489189@example.com","depois":"qa.unif22.tc049.c.tc049-c2-489189@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC049-C3-749500`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c3-749500@example.com","depois":"qa.unif22.tc049.c.tc049-c3-749500@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:45:14.0…`

**C4** (`TC049-C4-8c8a05`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-c4-8c8a05@example.com","depois":"qa.unif22.tc049.c.tc049-c4-8c8a05@example.com"},{"campo":"Celular__c","antes":"31989519203","depois":"31979519203"},{"campo":"Data…`

**AR** (`TC049-AR-5c935a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chW6v2AE ≠ leadCandidato 00QHZ00000chSJQ2A2"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:45:21.000+0000"}]`

**FW** (`TC049-FW-b110c2`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chMNi2AM ≠ leadCandidato 00QHZ00000chUmb2AE"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-12T11:45:21.000+0000"}]`

**RC** (`TC049-RC-b53cf4`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chR0p2AE ≠ leadCandidato 00QHZ00000chaok2AA"]`

**EP** (`TC049-EP-de46d5`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chRDb2AM ≠ leadCandidato 00QHZ00000chRWz2AM"]`

**RL** (`TC049-RL-d9b555`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000chLbG2AU ≠ leadCandidato 00QHZ00000chZke2AE"]`

### TC-062 — Account Y com IdCliente e sem IdProspect

_Observação:_ Eventos vão sem idprospectsalesforce.

**C2** (`TC062-C2-31796c`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c2-31796c@example.com","depois":"qa.unif22.tc062.c.tc062-c2-31796c@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**C3** (`TC062-C3-48a3e6`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c3-48a3e6@example.com","depois":"qa.unif22.tc062.c.tc062-c3-48a3e6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":"2026-10-12T11:46:23.0…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c3-48a3e6@example.com","depois":"qa.unif22.tc062.c.tc062-c3-48a3e6@example.com"}]`

**C4** (`TC062-C4-666117`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio","celular vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc062.a.tc062-c4-666117@example.com","depois":"qa.unif22.tc062.c.tc062-c4-666117@example.com"},{"campo":"Celular__c","antes":"31989590352","depois":"31979590352"},{"campo":"Data…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc062.a.tc062-c4-666117@example.com","depois":"qa.unif22.tc062.c.tc062-c4-666117@example.com"},{"campo":"MobilePhone","antes":"31989590352","depois":"31979590352"},{"campo":"CelularSe…`

## Adaptações registradas

- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.

## Tempos

Média de 484 RUNs, em segundos: total 34.4; massa 3.3; cadeia 26.1 (dos quais 12.8 esperando jobs); verificação 0.4; cleanup 4.5.

Refeitos depois de queda de rede: TC-016/C2 (1 queda).

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

