# Bug 1142660: Account com IdProspect inválido não cria Lead a partir dos dados aprovados

- **Reportado por:** QA, em 31/10/2026, na `mrv-staging`. Bug 1142660, filho da US 918914. A QA o classifica como variação do TC-005.
- **Análise completa:** no `com_salesforce_mrv`, em
  `docs/unificacao-clientes/2026-11-03-bug-1142660-account-com-prospect-invalido-nao-cria-lead.md`
  (cópia local, fora do git): causa raiz, a regra documentada, o que a US diz, a correção proposta e os riscos.
- **Status:** reproduzido pelo simulador na `mrv-devDan` (seção 2). Correção aplicada no working tree do `GV_909649_918914` (sem commit) e implantada só na `mrv-devDan`; falta o reteste da QA na staging.

## 1. O bug, em uma frase

Se a Account da pessoa aprovada já tem um `IdProspectSalesforce__c` que não é de nenhum Lead, o
`UnificacaoLeadService.precisaVincularLead` devolve `false` ("prospect inexistente fica como está"), o
`VinculoLeadPosPac` não é enfileirado e o Lead com os dados aprovados nunca nasce. Na staging, a Account tinha CPF,
IdCliente e celular (sem e-mail) e um prospect que nenhum Lead possui, com a PAC aprovada e o Proponente principal
carregando o mesmo prospect.

## 2. Reprodução (03/11/2026)

**A variante `TC-005-PSL`** (`scripts/runbook/cenarios.ts`, fora do modelo) é o TC-005 com a Account Y trazendo um
IdProspect aleatório que nenhum Lead possui, com IdCliente, CPF e celular e sem e-mail. A aprovação é a do TC-005
(`cliente-update`). Ela roda nos **13 perfis** em que o TC-005 roda: PA, CA, ME, C1 a C4, AR, AM, FW, RC, EP e RL.

**Antes dos RUNs,** o corpo das classes da unificação na `mrv-devDan` conferiu com o HEAD do `GV_909649_918914`
(o `LeadRepository` difere só por espaço em branco).

| TC | Perfis | Veredito |
|---|---|---|
| TC-005 (controle) | PA | CONFORME |
| TC-005-PSL, **sem a correção** | os 13 | **13 DIVERGENTES** |
| TC-005-PSL, **com a correção** | os 13 | **13 CONFORMES** |

Sem a correção, os 13 perfis divergem nas mesmas 4 asserções: nenhum Lead com o CPF aprovado, nenhum Lead novo
vinculado, a Account continua com o prospect da massa e o prospect inválido não é substituído. Passam: Account
reutilizada, X intacta, PAC, Proponente e Opportunity na Account Y, contatos da PAC e IdCliente, sem job nem log com
erro. `prospectY = null`: o aviso ao MS Clientes não chegou, então a política de Lead não rodou. Resíduo na dev: 0.

**Arquivos:** `../campanhas-runbook/bug-1142660-sem-correcao-2026-11-03.jsonl` e
`../campanhas-runbook/bug-1142660-com-correcao-2026-11-03.jsonl`.

**Para repetir:**

```bash
npm run runbook -- --org-alias mrv-devDan --tcs TC-005-PSL --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL,RP,RE,RF,AS --saida ../campanhas-runbook/bug-1142660-<data>.jsonl
```

O harness descarta sozinho os perfis que não se aplicam (RP, RE, RF e AS).

## 3. A correção e a verificação

A correção (Opção A) é uma mudança em `UnificacaoLeadService.precisaVincularLead`, no `com_salesforce_mrv`: prospect
que não é de nenhum Lead passa a "precisar do Lead da pessoa". Está no working tree do `GV_909649_918914` (sem commit)
e foi implantada **só na `mrv-devDan`** em 03/11 (deploy `0AfHZ00000RE56k0AD`, 3 classes, NoTestRun, depois de um
`--dry-run` limpo).

- **Testes Apex** (5 classes que passam pelo `precisaVincularLead`): 147 passando antes, **152 passando depois**, 0 falhas.
- **Provas dos dois lados:** a variante diverge nos 13 perfis com o HEAD e fica conforme nos 13 com a correção.
- **Sem regressão:** campanha completa (`--todos`, 760 RUNs) comparada com a de 31/10 (`completa-correcao-tc017-2026-10-31.jsonl`):
  760 RUNs, **760 conformes**, 0 divergentes, 0 erros, resíduo 0 (14:54 a 16:27 BRT, `--paralelo 6`; 1 RUN refeito por queda de rede). Na comparação par a par: os únicos pares novos são os 13 da variante, todos conformes, e **nenhum par que era conforme passou a divergir**. Arquivo: `../campanhas-runbook/completa-correcao-bug-1142660-2026-11-03.jsonl`.

## 4. O que fica em aberto

- **Commit** da correção no `com_salesforce_mrv` e deste repo.
- **Confirmar com o PO/QA** que "prospect inexistente → criar Lead e substituir" vale como regra. A planilha
  (TC-050 e TC-064, hoje `BLOCKED-FUNCIONAL`) sustenta.
- **O reteste da QA na staging** exige deploy lá, que só com pedido explícito. A Account da staging não se corrige
  sozinha: precisa de novo evento depois do deploy ou do `AccountIdProspectSanitizationBatch` (com autorização).
- **Origem do prospect inválido** na Account da staging: não determinada.
