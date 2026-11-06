# Bugs mapeados

Bugs encontrados fora do runbook: os que a QA reporta e os que aparecem nas
consultas à staging ou à produção. Cada um tem um arquivo próprio, com a
evidência, a causa e a correção proposta. Os bugs que o harness do runbook pega
estão em [`bugs-pegos-pelo-runbook.md`](../bugs-pegos-pelo-runbook.md).

- **Nome do arquivo:** `AAAA-MM-DD-<resumo-curto>.md`, com a data em que o bug
  foi reportado.
- **Dados pessoais:** nunca entram nos arquivos. Os payloads vão com nome,
  e-mail, telefone e CPF trocados por marcadores.
- **Consultas à staging ou à produção:** só de leitura.

| Data | Bug | Ambiente | Status |
|---|---|---|---|
| 05/11/2026 | [TC-041: o Cliente da Jornada fica sem Account quando a Account de Y nasce depois da PAC](2026-11-05-tc041-cliente-da-jornada-sem-account.md) | `mrv-staging` | corrigido no commit `60408ea09e` e na `mrv-devDan` (TC-041: 15 de 16 conformes, só o AS divergia; depois, 16 de 16); falta o reteste da QA |
| 05/11/2026 | [A jornada é resolvida para a Account que guarda o prospect de outra pessoa](2026-11-05-jornada-resolvida-para-account-do-prospect-de-outra-pessoa.md) | `mrv-staging` | corrigido na `mrv-devDan`, sem commit (variante TC-024-CLI: 15 divergentes no HEAD, 15 conformes com a correção; campanha completa de 775 RUNs sem regressão, só o TC-041 no AS, de outro bug); falta commit, merge e reteste da QA |
| 31/10/2026 | [Bug 1142660: Account com IdProspect inválido não cria Lead a partir dos dados aprovados](2026-10-31-bug-1142660-account-com-prospect-invalido-nao-cria-lead.md) | `mrv-staging` | corrigido no commit `66f1613e17` e na `mrv-devDan` (variante TC-005-PSL: 13 divergentes sem a correção, 13 conformes com ela); falta o reteste da QA |
| 30/10/2026 | [TC-017: a Opportunity fica em X quando a Account de Y nasce depois da PAC](2026-10-30-tc017-oportunidade-fica-em-x-quando-y-nasce-depois-da-pac.md) | `mrv-staging` | corrigido na `mrv-devDan` e verificado pelo perfil AS; falta o reteste da QA |
| 29/10/2026 | [A jornada que chega antes da Account vai para a fila manual](2026-10-29-jornada-antes-da-account-vai-para-fila-manual.md) | `mrv-staging` | corrigido pelo mapeamento para 500 (31/10) |
