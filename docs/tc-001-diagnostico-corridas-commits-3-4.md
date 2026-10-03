# TC-001 — Diagnóstico dos bugs dos commits 3 e 4 (`GV_918914_UnificPosAprovPAC`)

## Retificação e evidência específica do commit 4 — 2026-10-01

**O experimento anterior com IdCliente compartilhado NÃO reproduz o incidente
original do commit 4.** Ele demonstra uma alteração em uma massa artificial,
mas não comprova a causa do relato do QA, nem que o commit 4 corrige esse caso.
As conclusões contrárias nas seções históricas abaixo ficam retificadas por esta seção.

Consultas somente de leitura em `mrv-staging`, usando a jornada
`006HZ00000TVyX3YAL`, Account Y `001HZ00000zFuZsYAK`, Account X
`001HZ00000txIvnYAE` e Lead X `00QHZ00000XxSq72AF`, confirmaram:

- X e Y têm **IdClientes distintos e CPFs distintos**.
- Logs PAC `a0dHZ00000NAMfLYAX` / `a0dHZ00000NAMTwYAP`:
  `EM_ANALISE_CREDITO`, CPF Y, PROS-X, sem IdCliente no Proponente.
- Log `a0dHZ00000NAKYtYAP`: `cliente-insert` com IDCLI-Y, CPF Y e PROS-X.
- Logs de contato/endereço no mesmo segundo de recebimento (17:52:43Z)
  também carregam IDCLI-Y e PROS-X. A ordem de commit entre esses eventos
  não pode ser determinada apenas pela precisão de segundos do CreatedDate.
- Log `a0dHZ00000NAMTyYAP`: retorno `cliente-update` com IDCLI-Y e PROS-Y.
- Log `a0dHZ00000NAOjzYAH`: PAC aprovada com IDCLI-Y, CPF Y e PROS-X.
- `AccountHistory` registra alteração de `PersonEmail` em X às
  **2026-09-08T17:52:43Z**. O novo valor coincide com o contato de e-mail
  enviado para Y e com o e-mail do Proponente da PAC; difere do valor anterior
  de X. Isso confirma o sintoma histórico, mas não identifica isoladamente
  a transação que escreveu esse campo.

Diagnóstico: [diagnostico-tc001-evidencia-staging.ts](../scripts/runbook/diagnostico-tc001-evidencia-staging.ts).
Usa dados sintéticos, preserva as relações de identidade observadas e envia
PAC sem IdCliente diretamente ao Apex com Safety Guard preso à dev. O schema
restrito do simulador exige IdCliente no Proponente e não representa esse
payload real. Não são copiados nomes, CPFs ou contatos pessoais para a dev.

```powershell
npx.cmd tsx scripts\runbook\diagnostico-tc001-evidencia-staging.ts --org-alias mrv-devDan
npx.cmd tsx scripts\runbook\diagnostico-tc001-evidencia-staging.ts --org-alias mrv-devDan --concorrente
```

**Atualização de 2026-10-01, à tarde: reproduzido.** Faltava o
`notificacaopendencia-insert` do Proponente principal (log
`a0dHZ00000NAQVTYA5`). Ele ligou `EnviarNotificacaoPendencia__c`, e o
`ProponenteTriggerHandler.sincronizarEmailContatoPendencia` copiou o e-mail
de Y para X, porque as PACs em análise sem IdCliente tinham deixado o
Proponente apontando para X. Com `--pendencia`, X é alterado na dev
exatamente nesse passo; sem o evento, X é preservado. Cadeia, impressão
digital e runs no
[handoff](handoff-investigacao-tc001-bug4.md#11-causa-identificada-e-reprodução-2026-10-01).

Antes disso, três tentativas em 2026-10-01: duas sequenciais (a segunda com PAC previamente
vinculada a X) e uma concorrente (também com essa PAC prévia). Em todas:
X sem mudança nos campos comparados, nova Account Y e um Lead Y, nenhum erro
correlacionado e cleanup com zero resíduo. **Bug original ainda não reproduzido
na dev.** O replay simplifica campos cadastrais, comprime os intervalos e não
reconstitui todas as automações/condições históricas da org; não é uma prova
de ausência do bug. Logs da execução permanecem no workspace da sessão.

Origem: texto original dos dois bugs em
`com_salesforce_mrv/docs/textos-originais-bugs-tc001-commits-3-4.md`, ambos
relacionados ao cenário **TC-001** do
[runbook](runbook-testes-manuais-unificacao-2.2.md) ("CPF divergente com os
mesmos contatos"):

- **Commit 4** (`1f6844e910`, "Guard de identidade em `NotificacaoCliente`"):
  a Account do CPF X era atualizada indevidamente durante a aprovação de uma
  PAC com CPF divergente (Y), em vez de X permanecer intocada.
- **Commit 3** (`72cbd884f6`, "retry lock no `insertLeadQueueable`"): QA
  reportou que o Lead do cliente Y não foi criado em staging; a causa
  documentada é `UNABLE_TO_LOCK_ROW`.

Para investigar, os dois commits foram **revertidos manualmente** na branch
`GV_918914_UnificPosAprovPAC` em `mrv-devDan`, e este documento registra as
tentativas de reprodução contra esse estado revertido, usando 4 scripts de
diagnóstico ad-hoc em `scripts/runbook/diagnostico-tc001-*.ts` (fora do
catálogo dos 44 TCs).

## Resultado resumido

| Bug | Hipótese testada | Resultado |
|---|---|---|
| Commit 4 (guard de identidade) | `IdCliente` do evento de aprovação de Y **igual** ao de X | ✅ **Reproduzido** — Account X foi corrompida com os dados de Y |
| Commit 4 (guard de identidade) | `IdCliente` de Y **distinto** de X (premissa literal do TC-001/runbook) | ❌ Não reproduzido — o guard herdado de um commit anterior (`c47170d879`) já protege esse caminho |
| Commit 3 (retry lock) | Corrida `cliente-insert`/`cliente-update` para o mesmo `IdCliente` novo | 🟡 Parcial — erro `DUPLICATE_VALUE` idêntico ao de staging reproduzido, mas o Lead sempre acabou sendo criado |
| Commit 3 (retry lock) | Corrida `/Cliente` + `/PAC` misturados no mesmo `IdCliente`/PAC | 🟡 Parcial — novo erro real de lock (`Record Currently Unavailable`) reproduzido, ainda não é `UNABLE_TO_LOCK_ROW` literal |
| Commit 3 (retry lock) | N `cliente-update` concorrentes citando prospects de contas estrangeiras diferentes | ⚠️ **Achado novo, mais grave**: corrida silenciosa sem nenhum erro, Leads duplicados órfãos |

**Não foi possível reproduzir o `UNABLE_TO_LOCK_ROW` literal** mesmo em
concorrência de até 25 requisições simultâneas — ver hipótese revisada ao
final.

## 1. Guard de identidade (commit 4, `1f6844e910`)

Script: `npm run diag:tc001-idcliente-compartilhado`.

O runbook e o harness dos 44 TCs sempre atribuem a Y um `IdCliente` **novo e
distinto** de X. Rodando o TC-001 nos 3 perfis (`PA`/`CA`/`ME`) contra o
estado revertido, os 3 vieram **CONFORME** — Account X permaneceu intacta.
Isso acontece porque a busca de identidade nunca encontra Account X por
match forte quando `IdCliente` diverge; o guard antigo em
`ClienteService.deveDescartarMatchPosPac` (existente desde `c47170d879`,
**anterior** ao commit revertido) já bloqueia esse caminho independente do
guard removido.

Isolando a variável — um teste ad-hoc em que o evento de aprovação de Y usa
o **mesmo `IdCliente` de X** — reproduziu o bug exatamente como descrito: a
única Account (`Id__c` = IdCliente de X) teve seu `CPF__pc` sobrescrito para
o CPF de Y, e o Lead vinculado ficou com o CPF de X. Zero resíduo confirmado
após o cleanup.

**Conclusão:** o guard removido protege um cenário real, mas mais estreito
do que o TC-001 documenta literalmente — só se manifesta quando o `IdCliente`
do evento de aprovação de Y coincide com o de X (não quando o MS Cliente
sempre gera um `IdCliente` novo para Y, como o runbook assume).

## 2. Retry lock (commit 3, `72cbd884f6`)

### 2.1 Evidência real em `mrv-staging`

Consultado diretamente via `LogIntegracao__c` (Account Y real,
`Id__c=16e121ad-83f0-4b72-e360-08df0e20d528`, 2026-09-09T03:17:13Z):

- `cliente-insert` (sucesso) e `cliente-update` (erro) chegaram para o
  MESMO `IdCliente` novo com ~2,5s de diferença de `eventTime` — entrega
  duplicada/quase-simultânea do MS Cliente.
- Erro real: `Upsert failed... DUPLICATE_VALUE, valor duplicado
  encontrado: Id__c duplica o valor no registro com ID: ...`.
- Resultado real: **zero Lead criado**, **zero `AsyncApexJob`** nos 45
  minutos seguintes — o Queueable nunca chegou a rodar.

### 2.2 Reprodução por corrida na criação (`diag:tc001-race-insert-update`, `diag:tc001-race-cliente-pac`)

Disparando `cliente-insert`/`cliente-update` (e depois também `pac-update`)
concorrentes para o mesmo `IdCliente` novo via `Promise.all`:

- **Erro `DUPLICATE_VALUE` idêntico ao de staging reproduzido**
  consistentemente, inclusive em rajadas maiores (até 15 requisições, 14
  falhas).
- Um **segundo erro de lock real e distinto** apareceu ao misturar `/Cliente`
  e `/PAC` na mesma rajada: `System.QueryException: Record Currently
  Unavailable: The record you are attempting to edit, or one of its
  related records, is currently being modified by another user.` — mensagem
  clássica de contenção de lock do Salesforce, **não** capturada pelo
  detector `detectLockSignals` (que só reconhece o texto
  `UNABLE_TO_LOCK_ROW`).
- Em nenhuma tentativa o resultado final foi "zero Lead": a transação
  vencedora sempre teve seu Queueable executado sem erro
  (`AsyncApexJob.NumberOfErrors = 0`), porque as 14 concorrentes perdedoras
  falham na camada de DML síncrona (`upsert` por External ID), **antes** de
  qualquer Queueable ser enfileirado.

### 2.3 Achado novo: corrida silenciosa via `prospectPertenceAOutraConta` (`diag:tc001-race-prospect-estrangeiro`)

A limitação do item 2.2 é estrutural: como o `upsert` por `IdCliente` mata a
corrida na criação antes do Queueable, no máximo 1-2 `insertLeadQueueable`
concorrentes existem por rajada — nunca o suficiente para colidir entre si.

Para atingir a real precondição de `ClienteService.
prospectPertenceAOutraConta` (lida diretamente do código-fonte da branch
`GV_918914_UnificPosAprovPAC`), o desenho mudou: criar a Account Y **uma
única vez, sem corrida**, e depois disparar **N `cliente-update`
concorrentes**, cada um citando o prospect de uma Account "estrangeira"
**diferente** (já existente, com seu próprio `IdProspectSalesforce__c`).
Isso evita a colisão de `upsert` (o `IdCliente` do evento não muda) e faz
cada requisição, independentemente, detectar "prospect pertence a outra
conta" → `criarLeadDoCliente=true` → seu próprio `insertLeadQueueable`.

**Resultado ao vivo (concorrência 8, depois 25):**

- Todas as requisições HTTP tiveram sucesso (200).
- `AsyncApexJob` confirmou **múltiplos Queueables `NotificacaoCliente`
  genuinamente sobrepostos no tempo** (janelas de `CreatedDate`/
  `CompletedDate` sobrepostas), **todos com 0 erros**.
- Cada execução criou seu **próprio Lead novo** (8 de 8, depois 24 de 25).
- A Account Y só ficou vinculada ao **último Lead a terminar** ("last write
  wins" silencioso).
- **Resultado real: N-1 Leads duplicados e órfãos**, nunca vinculados a
  nenhuma Account, sem nenhum erro visível em log — um bug de integridade
  de dados silencioso, mais grave e mais fácil de reproduzir do que o
  `UNABLE_TO_LOCK_ROW` documentado, embora atinja a mesma superfície de
  código (a `update` da Account dentro do `insertLeadQueueable`,
  desprotegida pelo retry lock revertido).
- Zero resíduo confirmado após o cleanup em ambas as rodadas.

> ⚠️ **Importante:** este achado foi testado contra o estado **revertido**
> dos commits 3 e 4 (sem o retry lock). **Não foi validado ainda se o fix
> original (`72cbd884f6`) também previne esta corrida específica** — o
> retry lock só age quando `UNABLE_TO_LOCK_ROW` é lançado, e esta corrida
> nunca produziu esse erro (a plataforma serializou as escritas
> silenciosamente). É plausível que o "last write wins" order continue
> ocorrendo mesmo com o fix aplicado, já que o propósito documentado do
> commit é proteger contra *rollback* por falha de lock, não impedir
> múltiplos `insertLeadQueueable` concorrentes de sobrescrever o vínculo
> uns dos outros. Recomenda-se revalidar este cenário específico contra o
> estado corrigido antes de tratá-lo como risco de produção confirmado.

### 2.4 Por que o `UNABLE_TO_LOCK_ROW` literal não foi reproduzido, e próxima hipótese

Mesmo em concorrência 25, a plataforma **serializou silenciosamente** as N
escritas concorrentes na mesma linha de Account (fila de lock, sem erro) em
vez de rejeitar alguma com `UNABLE_TO_LOCK_ROW`. Isso sugere que a
condição de erro documentada no commit `72cbd884f6` — "impede que
`UNABLE_TO_LOCK_ROW` ao sincronizar o Proponente principal faça rollback do
novo Lead/Account" (ver
`.github/skills/salesforce-unificacao-clientes/references/unificacao-2.2-pos-pac.md`,
seção de bugs corrigidos) — não é uma corrida entre eventos `cliente-*`
entre si, mas sim uma corrida **entre transações de componentes
diferentes**: o `update` do `insertLeadQueueable` (assíncrono, roda alguns
segundos depois do HTTP retornar) colidindo com
`NotificacaoPAC.reconciliarIdProponentePrincipalPos` (síncrono, dentro do
processamento de um `pac-update`) tentando `update` a MESMA Account ou o
mesmo `Proponente__c`, **cronometrados para coincidir com a janela real de
execução do Queueable** — não apenas disparados juntos no mesmo instante
HTTP, como testado em 2.2. Não testado ainda; é o próximo passo caso a
investigação continue.

## Scripts

| Script | Comando | O que faz |
|---|---|---|
| `diagnostico-tc001-idcliente-compartilhado.ts` | `npm run diag:tc001-idcliente-compartilhado` | Aprova Y usando o MESMO `IdCliente` de X; verifica se a Account X é corrompida. |
| `diagnostico-tc001-corrida-insert-update.ts` | `npm run diag:tc001-race-insert-update -- --rajada 8 --ondas 4 --intervalo-ms 1200` | Rajada + ondas de `cliente-insert`/`cliente-update` concorrentes para o mesmo `IdCliente` novo. |
| `diagnostico-tc001-corrida-cliente-pac.ts` | `npm run diag:tc001-race-cliente-pac -- --rajada 8 --ondas 4 --intervalo-ms 1200` | Mistura `cliente-insert`/`cliente-update`/`pac-update` na mesma rajada concorrente. |
| `diagnostico-tc001-corrida-prospect-estrangeiro.ts` | `npm run diag:tc001-race-prospect-estrangeiro -- --concorrencia 8` | N `cliente-update` concorrentes citando prospects de Accounts estrangeiras diferentes contra uma Account Y já existente. |

Todos os 4 scripts são diagnósticos ad-hoc, fora do catálogo dos 44 TCs
(mesmo padrão de acesso "requer ambiente local com acesso real à org" do
O06/O07/O09/O10/O12 — ver seção "Ferramentas diagnósticas standalone" do
README) e exigem o estado **revertido** dos commits 3 e 4 em `mrv-devDan`
para reproduzir os sintomas; contra o estado corrigido (HEAD real da
branch), o comportamento esperado é não reproduzir nenhum dos sintomas
acima.
