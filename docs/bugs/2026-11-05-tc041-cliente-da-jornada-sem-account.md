# TC-041: o Cliente da Jornada fica sem Account quando a Account de Y nasce depois da PAC

- **Reportado por:** QA, em 05/11/2026, na `mrv-staging`, no TC-041 (Venda Genérica com colisão total). O TC-039 do mesmo dia passou.
- **Plano e análise:** no `com_salesforce_mrv`, em `docs/unificacao-clientes/2026-11-05-tc041-cliente-da-jornada-fica-sem-cliente-quando-y-nasce-depois-da-pac.md` (cópia local, fora do git).
- **Status:** reproduzido pelo simulador e **corrigido** no commit `60408ea09e` do `GV_909649_918914` (commit 37 do [mapa](../mapa-commits-reescrita-2.2.md)), implantado na `mrv-devDan`. Não foi para a staging.

## 1. O bug, em uma frase

Na Venda Genérica, a PAC que chega antes da Account de Y apaga o Cliente da Jornada (`ClientesRelacionados__c`) de X e cria um principal **sem Account**; o `cliente-insert` de Y liga o Proponente e leva a Opportunity para Y, mas nenhum evento refaz o Cliente da Jornada.

## 2. Por que o simulador não via

O harness criava a Opportunity sem record type (o `AtualizaClientesRelacionadosService` só age em `UnidadeVendaGenerica`) e nunca lia `ClientesRelacionados__c`, embora a planilha (US 1026579) peça "Clientes da Jornada" no TC-041 e em outros 21 TCs. O TC-041 dava conforme em todos os perfis.

## 3. O que o harness ganhou

- `Execucao.comClienteDaJornada()` (opt-in): Opportunity `UnidadeVendaGenerica`; o `ClientesRelacionados__c` de X nasce da `pac-insert-x`.
- `Snapshot.clientesDaJornada`, lido pelo `GET /GETClientesRelacionados` (o usuário da CLI não tem FLS em `Cliente__c` na dev).
- `Verificador.clienteDaJornada()`: precondição (X, único, principal) e final (Y, único, principal).
- Só o TC-041 liga o modelo. Sem perfil novo: o **AS** já manda a PAC aprovada antes do `cliente-insert`.

## 4. Verificação (06/11/2026, `mrv-devDan`)

| | RUNs | Conformes | Divergentes |
|---|---:|---:|---|
| TC-041, todos os perfis aplicáveis, **sem a correção** | 16 | 15 | 1: AS, Cliente da Jornada `vazio` |
| TC-041, **com a correção** | 16 | **16** | 0 |
| Regressão: todos os TCs em PA, CA, ME e AS (`--paralelo 6`) | 187 | 187 | 0 |

A regressão foi comparada par a par com a campanha de 05/11 (`completa-correcao-prospect-outra-pessoa-2026-11-05.jsonl`): o único par que mudou foi TC-041/AS (DIVERGENTE → CONFORME); nenhuma asserção que passava passou a falhar; resíduo 0; nenhum job ou log com erro. A campanha completa de 775 RUNs não foi refeita. Resultados em `campanhas-runbook/`: `tc-041-cliente-da-jornada-{sem,com}-correcao-2026-11-06.jsonl` e `regressao-pa-ca-me-as-correcao-tc041-2026-11-06.jsonl`.

Testes Apex na dev (10 suítes): 207 → 222; 206 → 221 passam; a única falha é a conhecida (`NotificacaoMaquinaEstadoTest.jornadaVendaGenericaSemOportunidadeAguardaReenvioTest`, falta de `Error_Response_Mapping__mdt` na dev).

## 5. Pendências

- Estender `comClienteDaJornada()` aos demais TCs de Venda Genérica que citam "Clientes da Jornada" (TC-040, 042 a 048, 051, 059 a 063).
- Campanha completa (`--todos`) e reteste da QA depois do PR para o `develop`.
- Reparo dos registros vazios da staging: só com aprovação explícita.
