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

> **Substituído (2026-09-27).** O TC-005 agora roda pelo runner do runbook
> (`npm run runbook -- --tcs TC-005`, em `scripts/runbook/`), nos perfis PA,
> CA e ME do runbook, com os eventos em datas posteriores aos marcadores da
> massa. O script descrito abaixo foi removido; o texto fica como registro.

`scripts/tc-005-account-y-sem-lead.ts` (`npm run runbook:tc005`) executava
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

## Causa-raiz: o que realmente cria o Lead de Y (reteste de 2026-09-27)

**O Lead de Y nasce quando um `cliente-update(Y)` é aplicado**, ou seja,
quando a `dataalteracao` dele é posterior ao `DataAlteracaoEvento__c` da
Account. Não importa se um contato chegou antes, nem se o payload traz
`idprospectsalesforce`. Com data igual ao marcador, o Apex descarta o evento
como "sucesso sem alteração" (`docs/phase-0/contract-matrix.md`) e nenhum
Lead é criado. É o mesmo mecanismo descrito no O09 do catálogo
("`cliente-update(PROS-X)` dispara `insertLeadQueueable`").

Isolamento feito com `scripts/tc-005-isolamento-causa-raiz.ts`
(`npm run retest:tc005 -- --repeticoes 2`) na `mrv-devDan`. Cada variante
usa X e Y novas, com o marcador de Y em `t0`, e espera até 90 s pelo Lead:

| Variante | Sequência | Lead criado | `cliente-update` aplicado |
|---|---|---|---|
| V1 | `cliente-update(Y)` sozinho, data posterior ao marcador, com PROS-X | 2/2 (6–12 s) | 2/2 |
| V2 | `cliente-update(Y)` sozinho, data posterior, sem `idprospectsalesforce` | 2/2 | 2/2 |
| V3 | `cliente-update(Y)` sozinho, data igual ao marcador | 0/2 | 0/2 |
| V4 | `contato-insert` antes + `cliente-update` com data igual ao marcador | 0/2 | 0/2 |
| V5 | `contato-insert` antes + `cliente-update` com data posterior | 2/2 | 2/2 |
| V6 | `contato-insert` sozinho | 0/2 | — |

Os jobs assíncronos confirmam a leitura. Só nas variantes aplicadas (V1, V2
e V5) rodaram os Queueables de `NotificacaoCliente`. Na V3 não rodou job
nenhum, e nas V4 e V6 rodou só o `ReconciliacaoContatosLeadQueueable` do
contato. Os 6 Leads criados foram apagados pelo próprio reteste, sem
resíduo.

### Hipótese anterior (refutada pelo reteste)

Nas 9 ordens em que o script do TC-005 espera "sem Lead", o
`cliente-update(Y)` sai com `dataalteracao` igual ao marcador gravado no
setup de Y (`t0`). Nas 4 que criam Lead, ele sai em `t0 + 5s`. A divisão
Lead/sem Lead abaixo vinha dessa diferença de data, que é um artefato do
próprio script, e não da ordem de chegada. O texto original segue como
registro:

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

> **Inválida (2026-09-27).** A tabela abaixo reflete a hipótese refutada.
> O script precisa ser reescrito: o `cliente-update(Y)` de toda ordem deve
> sair com data posterior ao marcador de Y, e o esperado passa a ser
> "exatamente um Lead para Y com C/D", como diz o runbook.

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

Essa convergência mostra só que o script concordava com o próprio artefato
de data (ver "Hipótese anterior"), não que o resultado do runbook foi
atingido.

## Simplificações honestas assumidas

- O03 (mesmo eventTime) executa uma permutação representativa (dispatch
  físico: cliente-update, contato-email, contato-celular, pac-update), não
  as três permutações completas do catálogo original.
- O11 (transição de idCliente) é adaptado como um `jornadausuario-update`
  simples após a PAC, não uma reentrega completa da jornada.
- O07/O09 reaproveitam a mesma limitação de autenticação (mesmo bearer
  token, sessão serializada) já documentada em
  [`docs/phase-8/tarefa-8-4-o07.md`](phase-8/tarefa-8-4-o07.md).
