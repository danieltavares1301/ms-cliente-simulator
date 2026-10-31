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
| 30/10/2026 | [TC-017: a Opportunity fica em X quando a Account de Y nasce depois da PAC](2026-10-30-tc017-oportunidade-fica-em-x-quando-y-nasce-depois-da-pac.md) | `mrv-staging` | corrigido na `mrv-devDan` e verificado pelo perfil AS; falta o reteste da QA |
| 29/10/2026 | [A jornada que chega antes da Account vai para a fila manual](2026-10-29-jornada-antes-da-account-vai-para-fila-manual.md) | `mrv-staging` | corrigido pelo mapeamento para 500 (31/10) |
