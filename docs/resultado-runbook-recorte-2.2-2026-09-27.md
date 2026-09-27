# Resultado do runbook da Unificação 2.2 — recorte 2.2 na `mrv-devDan`

Execução de 2026-09-27T16:53:48.312Z a 2026-09-27T18:41:12.913Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**132 RUNs:** 121 conformes, 11 divergentes, 0 com erro de execução.

## Análise

São os 44 TCs executáveis, cada um nos três perfis obrigatórios. Ficaram de
fora os 17 bloqueados na planilha e os 9 `BLOCKED-FUNCIONAL` (008, 028, 029,
050, 052, 058, 060, 064 e 065). Os TCs 040, 045, 046 e 049 foram
executados de novo, para guardar o estado final como evidência, e repetiram
o resultado da primeira rodada. As 11 divergências se resumem a dois
achados.

### 1. Contato antes do cliente, sem prospect e sem Account: HTTP 400 (TC-040, PA e ME)

Um `contato-insert` de um IdCliente que ainda não existe na org, sem
`idprospectsalesforce`, chegando antes do `cliente-insert`, volta HTTP 400:

> `System.DmlException: Upsert failed. [...] REQUIRED_FIELD_MISSING, Required fields are missing: [LastName]`

O `/Cliente` tenta criar a Account a partir do contato, que não tem nome, em
vez de descartar o evento. O runbook (§5) espera descarte defensivo com HTTP
200. No perfil CA, em que o cliente chega primeiro, o TC é conforme: Account
e Lead Y completos com A/B, e X sem IdProspect.

**Ressalva:** no TC-040 não existe Lead X, então os eventos vão sem
prospect. Na jornada real, a 1.3 (não exercitada aqui) poderia deixar um
prospect de jornada que mudaria a correlação. Mesmo assim, contato antes do
cliente sem correlação é uma ordem real, observada em staging (runbook
§4.1.1), e hoje resulta em erro.

### 2. Lead candidato sem CPF não é reutilizado quando a Account Y é nova (TC-045, TC-046 e TC-049, todos os perfis)

Nos três TCs existe um Lead candidato livre, sem CPF e sem Account, com os
contatos aprovados. O esperado é reutilizá-lo, preenchendo o CPF Y. Em vez
disso, o Apex cria um Lead Y novo (`DescricaoOrigem__c = InsertClientePAC`) e
tira dele exatamente o contato que o candidato tem, como faz com contato
colidente. O candidato fica intacto e sem CPF:

| TC | Candidato (massa) | Lead Y criado |
|---|---|---|
| TC-045 | e-mail C, sem celular | CPF Y, **sem e-mail**, celular D |
| TC-046 | celular D, sem e-mail | CPF Y, e-mail C, **sem celular** |
| TC-049 | e-mail C e celular D | CPF Y, **sem e-mail e sem celular** |

O mesmo fallback **funciona** no TC-012 e no TC-013, em que a Account Y já
existe e o evento é `cliente-update`: o candidato é reutilizado, recebe o
CPF Y e é vinculado. A diferença observada é o caminho de criação da Account
(`cliente-insert`). A hipótese é que esse caminho não aplica o fallback por
contato e cai direto na criação com exclusão de colidentes.

**Para isolar:** rodar a massa do TC-045 com a Account Y já existente e
`cliente-update`. Se o candidato for reutilizado, a causa é o caminho de
insert.

**Ressalva:** TC-045 e TC-046 são de Venda Genérica, cuja 1.3 não foi
exercitada. Mas a decisão sobre o Lead de Y acontece depois da PAC, na 2.2.
E o TC-049 é Jornada de Unidade, sem 1.3.

## Resumo por TC

| TC | Cenário | PA (ORDEM-PARCIAIS-ANTES) | CA (ORDEM-CLIENTE-ANTES) | ME (ORDEM-MESMO-EVENTTIME) |
|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-002 | CPF, e-mail e celular divergentes | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-005 | Account Y existente, Lead Y ausente | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-006 | Account Y e Lead Y órfão existentes | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-007 | Contatos de Y pertencem ao Lead Z | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-009 | Account Y incompleta e Lead Y existente | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-010 | Colisão apenas de e-mail | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-011 | Colisão apenas de celular | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-012 | Fallback por e-mail em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-013 | Fallback por celular em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-016 | Y inexistente e colisão total | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-017 | Y inexistente; celular colide | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-018 | Y inexistente; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-020 | Account Y só com CPF; nenhum Lead | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-021 | Account Y com prospect divergente | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-022 | Account Y incompleta e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-023 | Account Y inexistente e Lead Y órfão | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024 | Lead Y preso a outra Account | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-026 | Dois Leads Y; reutilizar o livre | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ❌ diverge | ✅ conforme | ❌ diverge |
| TC-041 | Venda Genérica com colisão total | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-042 | Venda Genérica; e-mail colide | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-053 | Proponente com Account/IdCliente existente | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-054 | Proponente X aprovado como Y na Venda Genérica | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-055 | Priorizar Lead Y por CPF na Venda Genérica | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-056 | Repetição funcional do TC-055 | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-057 | Proponente Y colide totalmente com X | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme |

## Divergências e erros

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**PA** (`TC040-PA-38e129`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**ME** (`TC040-ME-93a8e3`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-94b8b9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwLRs2AM ≠ leadCandidato 00QHZ00000bwMxJ2AU"]`

**CA** (`TC045-CA-94304b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwMhG2AU ≠ leadCandidato 00QHZ00000bwMhF2AU"]`

**ME** (`TC045-ME-e1ae92`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwGC72AM ≠ leadCandidato 00QHZ00000bwCzp2AE"]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

**PA** (`TC046-PA-33e8df`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwG0l2AE ≠ leadCandidato 00QHZ00000bwEGt2AM"]`

**CA** (`TC046-CA-544a61`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwMhH2AU ≠ leadCandidato 00QHZ00000bwMHV2A2"]`

**ME** (`TC046-ME-9e66e1`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwGfD2AU ≠ leadCandidato 00QHZ00000bwKFf2AM"]`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-da07b9`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwLtJ2AU ≠ leadCandidato 00QHZ00000bvy7Q2AQ"]`

**CA** (`TC049-CA-005272`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwKvZ2AU ≠ leadCandidato 00QHZ00000bwCBj2AM"]`

**ME** (`TC049-ME-6d867b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000bwDMR2A2 ≠ leadCandidato 00QHZ00000bwHko2AE"]`

## Adaptações registradas

- **TC-012:** O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.
- **TC-014:** IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.
- **TC-015:** IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.
- **TC-025:** Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.
- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.
- **TC-053:** Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.
- **TC-056:** Duplicação aparente da planilha: mesma massa do TC-055.
- **TC-062:** Eventos vão sem idprospectsalesforce.

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

