# Resultado do runbook da Unificação 2.2 — recorte 2.2 na `mrv-devDan`

Execução de 2026-10-02T13:24:06.040Z a 2026-10-02T14:03:09.160Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**132 RUNs:** 121 conformes, 11 divergentes, 0 com erro de execução.

## Análise

Esta campanha validou o pool paralelo e a espera de jobs mais curta contra a
campanha sequencial de 27/09
([relatório](resultado-runbook-recorte-2.2-2026-09-27.md)).

- **Configuração:** `npm run runbook -- --todos --paralelo 6`, com os perfis
  PA, CA e ME; os perfis C1 a C4 não entraram. A espera de jobs consultava a
  cada 1,5 s, só os jobs do usuário do CLI, e o celular sintético já tinha 7
  dígitos aleatórios.
- **Preparação:** antes da campanha, as sobras sintéticas dos executores
  antigos foram apagadas da `mrv-devDan` (seção 10 do
  [handoff do bug 4](handoff-investigacao-tc001-bug4.md)).
- **Resultado:** nos 132 pares TC×perfil, o veredito e as asserções com falha
  foram os mesmos de 27/09. As 11 divergências são as já conhecidas, e a
  análise delas está no relatório de 27/09.
- **Tempo:** cerca de 19 minutos de parede (86 RUNs em 13,6 min e 45 em
  5,5 min), contra 97,7 minutos em sequência em 27/09. Cada RUN ficou um pouco
  mais lento (48,2 s contra 44,4 s), porque 6 cadeias disputam a org; o ganho
  vem do paralelo.
- **Queda de rede:**
  - Entre ~13:37:40 e ~13:38:20 UTC, a rede desta máquina caiu, e 46 RUNs
    terminaram em ERRO (`SALESFORCE_NETWORK_ERROR`): o TC-022 PA e os três
    perfis dos TCs 041 a 062.
  - Três deles (TC-041 ME, TC-042 ME e TC-043 CA) deixaram 16 registros, que
    foram apagados à mão.
  - Os 46 pares foram refeitos: o TC-022 PA em sequência e os outros 45 com
    `--paralelo 6`. O relatório vale pelo último resultado de cada par, então o
    intervalo de execução no topo inclui a pausa até a refação.
  - O tratamento automático de queda de rede do harness veio depois desta
    campanha e ainda não rodou ao vivo.
- **Mudanças na dev desde 27/09:**
  - Houve deploy de `ClienteService`, `NotificacaoCliente`,
    `NotificacaoMaquinaEstado` e `NotificacaoPAC` em 27/09, entre 21:28 e
    21:31 UTC.
  - Em 29/09, às 17:04 UTC, entraram 31 componentes `LeadEventGrid*`.
  - Nenhum deles mudou veredito, e o `LeadEventGrid` não enfileirou jobs
    nesses fluxos.
  - Os jobs `JBIntBulkManager` são do Marketing Cloud Connect (`et4ae5`) e rodam
    como Automated Process, por isso ficam de fora da espera.
- **Evidências brutas:** os JSONL desta campanha e da refação (arquivos
  `campanha-20261002*.jsonl`) ficaram no scratchpad temporário da sessão do
  Claude Code:
  `%TEMP%\claude\D--Documentos-Trabalho-Ambientes-MRV-MS-Cliente\74731de7-baec-4346-97b5-0d0b042150a5\scratchpad\paralelo`.
  Essa pasta pode ser apagada.

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

**PA** (`TC040-PA-bb965e`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

**ME** (`TC040-ME-a0c62c`, ❌ diverge):

- Erro: contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …
- Todos os eventos responderam HTTP 200: `contato-email respondeu 400: { "Status": "Error", "Message": "Exception - EventGrid.iniciar - Exception: System.DmlException: Upsert failed. First exception on row 0; first error: REQUIRED_FIELD_MISSING, Required fields …`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**PA** (`TC045-PA-de6e76`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBC9t2AG ≠ leadCandidato 00QHZ00000cBVh02AG"]`

**CA** (`TC045-CA-144422`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBNy22AG ≠ leadCandidato 00QHZ00000cB5mf2AC"]`

**ME** (`TC045-ME-ed1d41`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBN592AG ≠ leadCandidato 00QHZ00000cBe2g2AC"]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

**PA** (`TC046-PA-dd9f01`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBeFZ2A0 ≠ leadCandidato 00QHZ00000cBSEe2AO"]`

**CA** (`TC046-CA-010874`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBCUn2AO ≠ leadCandidato 00QHZ00000cBPq52AG"]`

**ME** (`TC046-ME-a4af05`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBeDx2AK ≠ leadCandidato 00QHZ00000cBIjq2AG"]`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**PA** (`TC049-PA-92098b`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBWAG2A4 ≠ leadCandidato 00QHZ00000cBQNv2AO"]`

**CA** (`TC049-CA-3a22d3`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBLwB2AW ≠ leadCandidato 00QHZ00000cAz1A2AS"]`

**ME** (`TC049-ME-060a2f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cBNra2AG ≠ leadCandidato 00QHZ00000cBJr92AG"]`

## Adaptações registradas

- **TC-012:** O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.
- **TC-014:** IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.
- **TC-015:** IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.
- **TC-025:** Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.
- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.
- **TC-053:** Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.
- **TC-056:** Duplicação aparente da planilha: mesma massa do TC-055.
- **TC-062:** Eventos vão sem idprospectsalesforce.

## Tempos

Média de 132 RUNs, em segundos: total 48.2; massa 7.0; cadeia 31.6 (dos quais 12.8 esperando jobs); verificação 0.8; cleanup 8.7.

## Limpeza

RUNs com resíduo ou erro de limpeza: TC-040/CA (0 restantes; PropostaAnaliseCredito__c a0kHZ00000BSUeLYAX: SALESFORCE_NETWORK_ERROR)

No TC-040/CA, a exclusão da PAC chegou à org: só a resposta se perdeu na queda
de rede. O inventário por marca sintética depois da refação não achou resíduo
da campanha.

