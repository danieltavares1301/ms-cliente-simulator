# TC-017: a Opportunity fica em X quando a Account de Y nasce depois da PAC

- **Reportado por:** QA, em 30/10/2026, no TC-017 da unificação 2.2, na
  `mrv-staging`.
- **Análise e correção:** no `com_salesforce_mrv`, em
  `docs/unificacao-clientes/2026-10-31-tc017-oportunidade-fica-em-x-quando-y-nasce-depois-da-pac.md`
  (cópia local, fora do git). A correção faz o `cliente-*` que cria ou acha a
  Account da pessoa trazer a Opportunity cuja PAC atual está aprovada
  (`NotificacaoCliente.trazerOportunidadesDasPacsAprovadas`). Em 31/10, ela
  estava no working tree do `GV_909649_918914`, sem commit, e implantada na
  `mrv-devDan`.
- **Status:** corrigido na `mrv-devDan` e verificado pelo simulador (seção 3).
  Falta o reteste da QA na staging.

## 1. O bug, em uma frase

Quando a pessoa aprovada é nova, a Account dela nasce do `cliente-insert` que
a própria aprovação dispara. Se a PAC aprovada e a jornada são processadas
antes de a Account existir, nenhuma das duas move a Opportunity, e nada a
movia depois: ela ficava na Account X.

## 2. Por que o simulador não pegou

Todos os perfis mandavam o `cliente-insert` de Y, esperavam os jobs e só
então a PAC aprovada e a jornada. A PAC sempre achava a Account de Y e movia a
Opportunity. A asserção "Opportunity na Account aprovada" já rodava em todo
TC, mas a ordem serializada nunca a exercitava.

## 3. O perfil AS e a verificação (31/10)

**O perfil AS** (`scripts/runbook/engine.ts`, `cadeiaSimultanea`) manda, em
sequência e sem esperar jobs:

1. a PAC aprovada, já com o IdCliente de Y;
2. o `jornadausuario-update` com o IdCliente de Y e o CPF vazio no
   `ProponenteCredito`, sem reentrega (na Venda Genérica, não há jornada);
3. o `cliente-insert` de Y, por último.

Na staging, os três saíram juntos, e o `cliente-insert` esperou o lock que a
PAC tinha no Proponente. Mandados em paralelo na dev, ou a PAC ou a jornada
acabava vendo a Account de Y, e a corrida não se reproduzia. Por isso o perfil
reproduz o resultado dela, em sequência. Ele vale só nos TCs com
`cliente-insert`: 23 dos que o `--todos` roda, mais o 054 a 057, que ficam
fora do modelo e foram pedidos por `--tcs`. Fora do `--todos`, como todo
perfil opcional, ele só roda com `--perfis AS`.

**Sem a correção** (as classes do HEAD implantadas por alguns minutos na
`mrv-devDan`): **20 divergentes em 27**, todos só na Opportunity, que ficou
em X. Foram 7 TCs de Venda de Unidade (001, 002, 016, 017, 018, 023 e 049)
e 13 de Venda Genérica (040 a 048 e 054 a 057).

**Com a correção:** **27 conformes em 27**.
- **Quem moveu:** pelo log, o `cliente-insert` em 8 RUNs e a PAC aprovada em
  6. Os 6 da PAC são os TCs em que a Account de Y já existia, achada pelo CPF
  (009, 020, 022, 024, 025 e 027).
- **Sem log de movimento:** os outros 13. Na janela, a dev gravou só 15 logs
  de `cliente-insert` para 27 eventos. Na Venda Genérica, sem jornada, só o
  `cliente-*` pode ter movido a Opportunity.

**Os 7 conformes também sem a correção** (004, 009, 020, 022, 024, 025 e 027)
são os TCs em que a Account de Y já existe e a PAC a acha pelo CPF. Neles, o
bug não se aplica.

**Variantes fora do modelo, com a correção:** **4 conformes em 4** (TC-001-XSI,
TC-002-INT, TC-040-IDP e TC-040-IDX).
- **O TC-040-IDX era o caso de risco:** as PACs de Y levam o IdCliente de X no
  `idProponente`. Se a PAC aprovada ligasse o Proponente à Account X por esse
  IdCliente, a correção não o acharia, porque só olha os Proponentes sem
  Account. Isso não acontece: a PAC grava o Proponente sem Account ("Nenhuma
  Account da pessoa da PAC"), e a Opportunity chega à Account de Y. O log do
  `cliente-insert` desse RUN também faltou.
- **Ficaram de fora o TC-001-MSI e o TC-001-MPC:** o AS troca a jornada por uma
  com o IdCliente de Y, e as duas variantes perderiam o que testam.

**Arquivos:** `../campanhas-runbook/as-todos-sem-correcao-2026-10-31.jsonl`,
`../campanhas-runbook/as-todos-com-correcao-2026-10-31.jsonl` e
`../campanhas-runbook/as-variantes-com-correcao-2026-10-31.jsonl`.

## 4. O que fica em aberto

- **O reteste da QA na staging,** depois que a correção chegar ao `develop`.
- **Os logs de `cliente-insert` que a dev não gravou** (12 de 27 na rodada com
  a correção): não investigado.
- **O ponto 8.7 do doc da MRV:** a PAC, que decidiu "sem Account" antes de
  esperar o lock, regrava `Proponente__c = null`. A asserção "Proponente
  principal na Account aprovada", que roda em todo TC, pegaria isso se o eco
  não religasse o Proponente. No AS, ela passou nos 27.
