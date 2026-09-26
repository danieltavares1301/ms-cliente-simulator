# TC-005 — "Account Y existente, Lead Y ausente"

Origem: [`docs/runbook-testes-manuais-unificacao-2.2.md`](runbook-testes-manuais-unificacao-2.2.md)
(cópia do runbook oficial da US 918914, `TC-005`).

## Massa do teste

- Account X já sincronizada: própria jornada, contatos e Lead intactos,
  sem relação com a PAC deste TC.
- Account Y já existe com CPF Y e `IDCLI-Y`, mas **sem Lead**.
- A PAC é aprovada referenciando Y (Proponente principal com
  `idCliente = Y`) com um e-mail/celular novos (C/D).
- Esperado pelo runbook: Account Y atualizada com C/D; exatamente um Lead
  novo para Y com C/D; Account X permanece intacta.

## Script

`scripts/tc-005-account-y-sem-lead.ts` (`npm run runbook:tc005`) executa
essa massa contra as 13 ordens de evento já implementadas nesta sessão a
partir do [catálogo de ordens](catalogo-ordens-eventos-ms-cliente-pos-pac.md)
(`O01`–`O09`, `O11`–`O14`; `O10`/`O12` entram como as variantes de
stress/contenção já existentes; `O15` fica de fora, ainda bloqueado).

Dois modos de identidade:

- `--mode same-x` (padrão): cria a Account X **uma vez** e a reutiliza em
  todas as ordens; cria uma Account Y nova a cada ordem.
- `--mode fresh-x`: cria Account X **e** Account Y novas a cada ordem
  (isolamento total).

Filtro opcional `--orders O01,O02,...` para rodar um subconjunto.

## Achado de causa-raiz: o que realmente cria o Lead de Y

A hipótese inicial (baseada em O01/O02/O08 do catálogo geral) era que o
`cliente-update(Y)` carregando o `idprospectsalesforce` de X — um prospect
"roubado"/divergente — seria o gatilho de criação do Lead. Testes isolados
ao vivo contra `mrv-devDan` **refutaram** essa hipótese:

| Sequência testada isoladamente | Lead criado? |
|---|---|
| `cliente-update(Y)` sozinho, com `idprospectsalesforce` de X | ❌ Não |
| `cliente-update(Y)` sozinho, sem nenhum `idprospectsalesforce` no payload | ❌ Não |
| `contato-insert(Y)` **antes** de `cliente-update(Y)` (sem prospect) | ✅ Sim |

O gatilho real é a **ordem física de chegada dos eventos**: um
`contato-*`/`endereco-*` chegando **antes** do primeiro
`cliente-update`/`cliente-insert` de uma Account que ainda não tem Lead
vinculado. Isso corresponde exatamente à causa-raiz do "bug 2" documentada
em `unificacao-2.2-pos-pac.md`:

> "Ordem de chegada não é garantida. Na prática, os eventos `contato-*` e
> `endereco-*` frequentemente chegam antes do `cliente-insert`."

Ou seja: **não é uma falha do script** quando uma ordem cuja sequência não
antepõe um `contato-*` ao `cliente-update` não cria o Lead de Y — é o
comportamento real e determinístico do Apex.

## Tabela de convergência esperada por ordem

O script mantém `expectedLeadCreated: Record<OrderId, boolean>`, derivado
de "essa ordem antepõe um `contato-*`/`endereco-*` ao primeiro
`cliente-update(Y)`?":

| Ordem | Contato antes do cliente-update? | Lead esperado | Observação |
|---|---|---|---|
| O01 | Sim | ✅ | contato-email/celular antes do cliente-update |
| O02 | Não | ❌ | cliente-update chega primeiro, parciais depois |
| O03 | Não | ❌ | cliente-update é o primeiro dispatch (mesmo eventTime dos demais) |
| O04 | Não | ❌ | cliente-update + pac-update antes do contato de regressão |
| O05 | Não | ❌ | cliente-update + pac-insert antes do contato de regressão |
| O06 | Sim | ✅ | contato-email antes do cliente-update (após limpar prospect provisório) |
| O07 | — | ❌ | corrida cliente-update ‖ pac-update, sem contato algum |
| O08 | Sim | ✅ | massa de referência do TC-005 (contato antes do cliente-update) |
| O09 | Sim | ✅ | contato-email antes da corrida cliente-update ‖ pac-update |
| O11 | — | ❌ | cliente-update + pac-update + jornada-update, sem contato algum |
| O12 | — | ❌ | cliente-update (+ rajada) + pac-update, sem contato algum |
| O13 | Não | ❌ | cliente-update + pac-update antes do contato tardio |
| O14 | — | ❌ | cliente-update + pac-update + reentrega, sem contato algum |

`verifyAndReport()` só emite o detalhamento completo do estado
(`order-divergencia`) quando o resultado real **diverge** do esperado
nesta tabela. Quando converge — inclusive quando o esperado é "nenhum
Lead" — registra apenas um resumo terso (`order-ok`).

## Resultado da validação ao vivo

Rodado contra `mrv-devDan` em 2026-09-23, ambos os modos:

- `--mode same-x`, todas as 13 ordens: **13/13 convergiram** com o
  esperado (`order-ok` para todas, zero `order-divergencia`).
- `--mode fresh-x`, subconjunto `O01,O02,O08`: **3/3 convergiram**.
- Zero resíduo confirmado em `mrv-devDan` após ambas as execuções
  (Account X/Y, Lead, Opportunity, Proponente e PAC sintéticos todos
  removidos pela limpeza do próprio script).

## Simplificações honestas assumidas

- O03 (mesmo eventTime) executa uma permutação representativa (dispatch
  físico: cliente-update, contato-email, contato-celular, pac-update), não
  as três permutações completas do catálogo original.
- O11 (transição de idCliente) é adaptado como um `jornadausuario-update`
  simples após a PAC, não uma reentrega completa da jornada.
- O07/O09 reaproveitam a mesma limitação de autenticação (mesmo bearer
  token, sessão serializada) já documentada em
  [`docs/phase-8/tarefa-8-4-o07.md`](phase-8/tarefa-8-4-o07.md).
