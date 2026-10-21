# Resultado do runbook — ordens reais da aprovação, sem os commits (dev revertida), 11/10

> **Campanha sem os commits.** Rodou na dev revertida, com `ClienteService`,
> `NotificacaoCliente` e `NotificacaoPAC` iguais a `c04b6add92` e
> `NotificacaoMaquinaEstado` igual a `9f0ba21f38`, os dois de 03/09. Faltavam
> nelas os cinco commits abaixo, do branch da 2.2
> (`GV_918914_UnificPosAprovPAC`). A campanha com os commits, depois que as
> quatro voltaram à ponta da 2.2, está em
> [`resultado-runbook-completo-com-commits-2026-10-11.md`](resultado-runbook-completo-com-commits-2026-10-11.md).

| Commit | Data | Título | Classes que ele muda |
|---|---|---|---|
| `1f6844e910` (commit 4) | 08/09 | Guard de identidade em NotificacaoCliente para eventos parciais pós-PAC | `ClienteService`, `NotificacaoCliente`, `NotificacaoPAC` |
| `72cbd884f6` (commit 3) | 09/09 | Novo Lead não é criado em cenário de aprovação de PAC com CPF divergente (UNABLE TO LOCK ROW) | `NotificacaoCliente` |
| `9210581ea5` | 09/09 | PAC enviado para fila manual indevidamente com erro "Cliente(Account) não encontrado no Salesforce" | `ClienteService`, `NotificacaoMaquinaEstado` |
| `7c86318a05` | 10/09 | Preserva vínculo histórico da Opp em jornadausuario-* sem idCliente | `NotificacaoMaquinaEstado` |
| `3f2919f5e7` | 21/09 | Corrige falso positivo no guard de identidade de payload parcial (contato-update/endereco-update) | `ClienteService`, `NotificacaoCliente` |

Os títulos são os dos commits, sem o prefixo `[918914] - [UNIFICAÇÃO DE LEADS]`.
Os commits também mudam as classes de teste, que não alteram o comportamento
medido. O que cada um muda no código está na seção 2.1 do
[estado da dev](estado-da-mrv-devDan.md).

Execução de 2026-10-11T16:48:19.433Z a 2026-10-11T17:14:27.295Z (UTC), por `npm run runbook`.

> **Escopo:** a massa de cada TC foi montada por DML direto e a cadeia 2.2
> foi exercitada inteira (PAC, eventos de cliente/contato/endereço na ordem
> do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update` e
> máquina). A 2.1 (`PesquisarContaController.getAccountForLead`) e a 1.3
> (`PermutaCadastroCliente`) reais não foram chamadas, então pelo runbook
> (§4.2) cada RUN é um **diagnóstico do recorte 2.2**, nunca `PASS-CLI`.

**237 RUNs:** 178 conformes, 59 divergentes, 0 com erro de execução.

> **Perfis AR, AM, FW, RC, EP e RL (ordens reais da aprovação):** a ordem que o
> MS de crédito, o WebJob e o MS Clientes produzem. "—" no AM é TC em que ele
> não se aplica (a pessoa aprovada ainda não existe no MS Clientes). Veja a
> seção 7.2 de `docs/origem-dos-eventos-no-salesforce.md` e o estado da dev em
> `docs/estado-da-mrv-devDan.md`.

## Análise

Campanha dos seis perfis das ordens reais da aprovação nos 44 TCs executáveis,
com `npm run runbook -- --todos --perfis AR,AM,FW,RC,EP,RL --paralelo 6`. O
AM rodou só nos 17 TCs em que a pessoa aprovada já existe no MS Clientes.

- **Estado da dev:** o de 27/09, com quatro classes centrais da 2.2 na versão
  de 03/09, sem os cinco commits da tabela do início
  ([estado da dev](estado-da-mrv-devDan.md)).
- **Execução:** uma queda de rede derrubou um RUN, que foi refeito. Nenhum RUN
  terminou em erro, e o resíduo ficou zerado.

| Perfil | RUNs | Conformes | Divergentes |
|---|---:|---:|---:|
| AR | 44 | 21 | 23 |
| AM | 17 | 16 | 1 |
| FW | 44 | 18 | 26 |
| RC | 44 | 41 | 3 |
| EP | 44 | 41 | 3 |
| RL | 44 | 41 | 3 |

### 1. RC, EP e RL: só as divergências já conhecidas

As três divergências de cada um são os TCs 045, 046 e 049. Eles divergem
também no CA desde 27/09: o Lead candidato sem CPF não é reutilizado quando a
Account Y é nova ([relatório de 27/09](resultado-runbook-recorte-2.2-2026-09-27.md)).

- **RC:** em todos os TCs, a data da PAC aprovada ficou em UTC, e o contato
  atrasado foi descartado. A compensação de 3h da `NotificacaoPAC` funciona
  na dev (seção 6.4 do [doc de origem](origem-dos-eventos-no-salesforce.md)).
- **EP:** o parcial atrasado, com o prospect da jornada, não trocou o vínculo
  nem criou registro em nenhum TC.
- **RL:** a repostagem em lote não alterou nem criou Account ou Lead.

### 2. A pendência grava na Account que a PAC em análise achou (AR, FW e AM)

Na ordem real, a pendência sai na aprovação e chega antes da PAC aprovada. Ao
processá-la, o Salesforce copia o e-mail do Proponente para a Account à qual
ele está ligado, que é a que a PAC em análise achou. O efeito depende do TC:

- **Bug 4, X alterada.** São 19 TCs, todos em que Y não tem Account no
  Salesforce e a jornada tem prospect: 001, 002, 016, 017, 018, 023, 041 a
  049 e 054 a 057. A PAC em análise, sem IdCliente, acha X pelo prospect, e
  a pendência grava em X. "Account X intacta" diverge em AR e FW. Nos TCs em
  que Y já tem Account, a PAC em análise acha Y pelo CPF, e X fica intacta.
  - Em seis deles (002, 017, 043, 044, 046 e 047), o Lead X também recebe o
    e-mail de Y.
  - Em três (002, 017 e 043), o Lead novo de Y fica sem o e-mail aprovado,
    que agora colide com X.
- **Account duplicada errada (TC-038).** Sem IdCliente, a PAC em análise
  acha a Account Y2, que não tem IdCliente, em vez da Y1. A pendência grava o
  e-mail e o carimbo na Y2, que o TC manda preservar.
- **Lead de outra pessoa (TC-021, inclusive no AM).** A Account Y ainda está
  ligada ao Lead de Z, pelo prospect divergente. A pendência atualiza a
  Account Y, e o reflexo copia o e-mail e o nome de Y para o Lead Z. O Lead
  novo de Y fica sem e-mail. Acontece mesmo quando a PAC traz o IdCliente.
- **Sem prospect na jornada (TC-040).** A PAC em análise de Y é recusada com
  400 ("Cliente(Account) não encontrado"). O Proponente fica com os dados de
  X, e a pendência regrava o próprio e-mail de X, com carimbo. A reentrega
  da PAC depois da aprovação voltou 200 sem mudar o status.

Um guard de identidade na sincronização da pendência resolveria o bug 4, mas
talvez não os casos 038 e 021. No 038, a Y2 tem o mesmo CPF de Y. No 021, a
Account é a certa, e o problema é o reflexo para o Lead de outra pessoa.

### 3. A pendência antes dos eventos de cliente muda a escolha do Lead (TC-013)

No TC-013, o Lead candidato sem CPF, achado pelo celular, deixa de ser
reutilizado no AR e no FW, e nasce um Lead novo só com o e-mail. A causa foi
isolada com execuções avulsas:

| Execução | Veredito |
|---|---|
| CA e C1 (pendência depois dos parciais) | conformes |
| AR com o e-mail antes do celular | diverge |
| AR com a pendência depois das chamadas do WebJob | conforme |

Ou seja: é a pendência chegando antes dos eventos de cliente, como o crédito a
publica, que muda a decisão. O mecanismo no Apex ainda não foi lido. No
TC-046, a mesma asserção diverge também no CA, então lá não dá para atribuir.

### 4. A repetição do WebJob leva contatos de outra pessoa ao Lead novo de Y (FW)

Em 11 TCs (001, 007, 010, 016, 018, 025, 038, 041, 042, 054 e 057), só no FW,
o Lead novo de Y termina com e-mail ou celular que o TC manda deixar de fora,
porque pertencem a X ou a Z.

- **Mecanismo:** na repetição, os parciais chegam com o prospect da jornada
  depois de o Lead de Y existir, e a Account Y os reflete no Lead.
- **Evidência:** no TC-001, o detalhe do FW mostra o Lead de Y mudando
  `Email` e `MobilePhone` durante a repetição.
- **TC-040:** a repetição criou um segundo Lead com o CPF de Y.

A dev não tem o guard de parciais do commit 4
(`validarIdentidadePayloadParcialContraAccount`), que mira justamente parcial
com prospect de outra pessoa. Só rodando o FW com a ponta implantada dá para
saber se ele resolve.

> **Revisão de 11/10, depois da campanha com os commits:**
>
> - são 13 TCs: o 017 e o 043 também têm o efeito. No FW deles, o Lead novo
>   tem o celular de outra pessoa. Esta análise os atribuiu ao bug 4 porque o
>   AR do mesmo TC falhava na mesma asserção, por outro motivo (e-mail vazio);
> - o mecanismo acima não se confirma nos logs de integração. Os parciais da
>   repetição são descartados ("prospect divergente de outra conta"), e quem
>   grava no Lead de Y é o `cliente-update` da repetição, que roda de novo o
>   `criarLeadDoCliente`;
> - com os commits, o efeito continua nos mesmos 13 TCs. Veja o B6 no
>   [catálogo de bugs](bugs-pegos-pelo-runbook.md#b6).

## Resumo por TC

| TC | Cenário | AR (APROVACAO-REAL-PESSOA-NOVA) | AM (APROVACAO-REAL-PESSOA-EXISTENTE) | FW (FALHA-E-REPETICAO-DO-WEBJOB) | RC (RELOGIO-DO-CREDITO) | EP (ECO-ANTES-DO-PARCIAL) | RL (REPOSTAGEM-EM-LOTE) |
|---|---|---|---|---|---|---|---|
| TC-001 | CPF divergente com os mesmos contatos | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-002 | CPF, e-mail e celular divergentes | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-003 | Match com dados idênticos | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-004 | Jornada sem CPF e PAC inclui CPF | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-005 | Account Y existente, Lead Y ausente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-006 | Account Y e Lead Y órfão existentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-007 | Contatos de Y pertencem ao Lead Z | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-009 | Account Y incompleta e Lead Y existente | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-010 | Colisão apenas de e-mail | ✅ conforme | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-011 | Colisão apenas de celular | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-012 | Fallback por e-mail em Lead sem CPF | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-013 | Fallback por celular em Lead sem CPF | ❌ diverge | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-014 | Sem compatibilidade; IdCliente em minúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-015 | Sem compatibilidade; IdCliente em maiúsculas | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-016 | Y inexistente e colisão total | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-017 | Y inexistente; celular colide | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-018 | Y inexistente; e-mail colide | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-019 | Lead Y livre por CPF, contatos diferentes | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-020 | Account Y só com CPF; nenhum Lead | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-021 | Account Y com prospect divergente | ❌ diverge | ❌ diverge | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-022 | Account Y incompleta e Lead Y órfão | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-023 | Account Y inexistente e Lead Y órfão | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-024 | Lead Y preso a outra Account | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-025 | Múltiplas Accounts Y; selecionar a mais recente | ✅ conforme | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-026 | Dois Leads Y; reutilizar o livre | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-027 | Todos os Leads Y estão presos | ✅ conforme | — | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-038 | Accounts Y duplicadas; priorizar a que tem IdCliente | ❌ diverge | ✅ conforme | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-039 | Nova jornada do mesmo cliente Y | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-040 | Venda Genérica aprova CPF Y diferente | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-041 | Venda Genérica com colisão total | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-042 | Venda Genérica; e-mail colide | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-043 | Venda Genérica; celular colide | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-044 | Venda Genérica reutiliza Lead Y por CPF | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-045 | Venda Genérica reutiliza Lead sem CPF por e-mail | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-046 | Venda Genérica reutiliza Lead sem CPF por celular | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-047 | Venda Genérica reutiliza Lead por CPF forte | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-048 | Lead Y preso com compatibilidade total | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-049 | Venda de Unidade reutiliza Lead livre por contatos | ❌ diverge | — | ❌ diverge | ❌ diverge | ❌ diverge | ❌ diverge |
| TC-053 | Proponente com Account/IdCliente existente | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-054 | Proponente X aprovado como Y na Venda Genérica | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-055 | Priorizar Lead Y por CPF na Venda Genérica | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-056 | Repetição funcional do TC-055 | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-057 | Proponente Y colide totalmente com X | ❌ diverge | — | ❌ diverge | ✅ conforme | ✅ conforme | ✅ conforme |
| TC-062 | Account Y com IdCliente e sem IdProspect | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme | ✅ conforme |

## Divergências e erros

### TC-001 — CPF divergente com os mesmos contatos

**AR** (`TC001-AR-863078`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:47:34.000+0000"}]`

**FW** (`TC001-FW-7a35f3`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc001.a.tc001-fw-7a35f3@example.com","celular 31981654623"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:47:34.000+0000"}]`

### TC-002 — CPF, e-mail e celular divergentes

**AR** (`TC002-AR-7e9f8d`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-ar-7e9f8d@example.com","depois":"qa.unif22.tc002.c.tc002-ar-7e9f8d@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-ar-7e9f8d@example.com","depois":"qa.unif22.tc002.c.tc002-ar-7e9f8d@example.com"}]`

**FW** (`TC002-FW-43cf42`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc002.a.tc002-fw-43cf42@example.com","depois":"qa.unif22.tc002.c.tc002-fw-43cf42@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc002.a.tc002-fw-43cf42@example.com","depois":"qa.unif22.tc002.c.tc002-fw-43cf42@example.com"}]`

### TC-007 — Contatos de Y pertencem ao Lead Z

**FW** (`TC007-FW-dc3e60`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc007.c.tc007-fw-dc3e60@example.com"]`

### TC-010 — Colisão apenas de e-mail

**FW** (`TC010-FW-c6d078`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc010.a.tc010-fw-c6d078@example.com"]`

### TC-013 — Fallback por celular em Lead sem CPF

**AR** (`TC013-AR-a45b5f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfXn32AE ≠ leadCandidato 00QHZ00000cfNam2AE"]`

**FW** (`TC013-FW-d05252`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfZFI2A2 ≠ leadCandidato 00QHZ00000cfNHU2A2"]`

### TC-016 — Y inexistente e colisão total

**AR** (`TC016-AR-57a07c`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:55:47.000+0000"}]`

**FW** (`TC016-FW-8ade0e`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc016.a.tc016-fw-8ade0e@example.com","celular 31983820766"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:55:57.000+0000"}]`

### TC-017 — Y inexistente; celular colide

**AR** (`TC017-AR-9f8d62`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-ar-9f8d62@example.com","depois":"qa.unif22.tc017.c.tc017-ar-9f8d62@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-ar-9f8d62@example.com","depois":"qa.unif22.tc017.c.tc017-ar-9f8d62@example.com"}]`

**FW** (`TC017-FW-6a6888`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31987793522"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc017.a.tc017-fw-6a6888@example.com","depois":"qa.unif22.tc017.c.tc017-fw-6a6888@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc017.a.tc017-fw-6a6888@example.com","depois":"qa.unif22.tc017.c.tc017-fw-6a6888@example.com"}]`

### TC-018 — Y inexistente; e-mail colide

**AR** (`TC018-AR-e0b280`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:56:54.000+0000"}]`

**FW** (`TC018-FW-b9ab50`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc018.a.tc018-fw-b9ab50@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T16:56:57.000+0000"}]`

### TC-021 — Account Y com prospect divergente

**AR** (`TC021-AR-b81a87`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-ar-b81a87@example.com","depois":"qa.unif22.tc021.c.tc021-ar-b81a87@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AR-b81a87","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**AM** (`TC021-AM-d29ae3`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-am-d29ae3@example.com","depois":"qa.unif22.tc021.c.tc021-am-d29ae3@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-AM-d29ae3","depois":"UNIF22 TC…`
- Lead novo vinculado, com o e-mail aprovado, com o celular aprovado: `["e-mail vazio"]`

**FW** (`TC021-FW-9e32af`, ❌ diverge):

- Lead Z intacto: `[{"campo":"Email","antes":"qa.unif22.tc021.e.tc021-fw-9e32af@example.com","depois":"qa.unif22.tc021.c.tc021-fw-9e32af@example.com"},{"campo":"LastName","antes":"UNIF22 TC021 CLIENTE Z TC021-FW-9e32af","depois":"UNIF22 TC…`

### TC-023 — Account Y inexistente e Lead Y órfão

**AR** (`TC023-AR-8afdb6`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:00:07.000+0000"}]`

**FW** (`TC023-FW-9adeea`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:00:08.000+0000"}]`

### TC-025 — Múltiplas Accounts Y; selecionar a mais recente

_Observação:_ Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.

**FW** (`TC025-FW-c32a1e`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc025.a.tc025-fw-c32a1e@example.com"]`

### TC-038 — Accounts Y duplicadas; priorizar a que tem IdCliente

**AR** (`TC038-AR-d1767e`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-ar-d1767e@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:03:12.000+0000"}]`

**FW** (`TC038-FW-1e97ab`, ❌ diverge):

- Account Y2 intacta: `[{"campo":"PersonEmail","antes":null,"depois":"qa.unif22.tc038.a.tc038-fw-1e97ab@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:03:17.000+0000"}]`
- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc038.a.tc038-fw-1e97ab@example.com"]`

### TC-040 — Venda Genérica aprova CPF Y diferente

_Observação:_ Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.

**AR** (`TC040-AR-f97cac`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:04:06.000+0000"}]`

**FW** (`TC040-FW-f33814`, ❌ diverge):

- Account X intacta, sem IdProspect: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:04:12.000+0000"}]`
- 1 Lead(s) com o CPF aprovado: `{"encontrados":[{"Id":"00QHZ00000cfXAJ2A2","Id__c":"4193065f-3cf2-f66d-5950-42876f5e8e74"},{"Id":"00QHZ00000cfZOy2AM","Id__c":"2024feab-7978-3c93-4fb2-b3a1f5dab5b1"}]}`

### TC-041 — Venda Genérica com colisão total

**AR** (`TC041-AR-79e914`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:04:58.000+0000"}]`

**FW** (`TC041-FW-56cb36`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc041.a.tc041-fw-56cb36@example.com","celular 31985583538"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:05:00.000+0000"}]`

### TC-042 — Venda Genérica; e-mail colide

**AR** (`TC042-AR-9a36ab`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:05:15.000+0000"}]`

**FW** (`TC042-FW-f6576a`, ❌ diverge):

- Lead novo vinculado, sem e-mail, com o celular aprovado: `["e-mail qa.unif22.tc042.a.tc042-fw-f6576a@example.com"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:05:36.000+0000"}]`

### TC-043 — Venda Genérica; celular colide

**AR** (`TC043-AR-9407a4`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["e-mail vazio"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-ar-9407a4@example.com","depois":"qa.unif22.tc043.c.tc043-ar-9407a4@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-ar-9407a4@example.com","depois":"qa.unif22.tc043.c.tc043-ar-9407a4@example.com"}]`

**FW** (`TC043-FW-0f19b6`, ❌ diverge):

- Lead novo vinculado, com o e-mail aprovado, sem celular: `["celular 31988820364"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc043.a.tc043-fw-0f19b6@example.com","depois":"qa.unif22.tc043.c.tc043-fw-0f19b6@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc043.a.tc043-fw-0f19b6@example.com","depois":"qa.unif22.tc043.c.tc043-fw-0f19b6@example.com"}]`

### TC-044 — Venda Genérica reutiliza Lead Y por CPF

**AR** (`TC044-AR-6340c0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-ar-6340c0@example.com","depois":"qa.unif22.tc044.c.tc044-ar-6340c0@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-ar-6340c0@example.com","depois":"qa.unif22.tc044.c.tc044-ar-6340c0@example.com"}]`

**FW** (`TC044-FW-76c9d0`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc044.a.tc044-fw-76c9d0@example.com","depois":"qa.unif22.tc044.c.tc044-fw-76c9d0@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc044.a.tc044-fw-76c9d0@example.com","depois":"qa.unif22.tc044.c.tc044-fw-76c9d0@example.com"}]`

### TC-045 — Venda Genérica reutiliza Lead sem CPF por e-mail

**AR** (`TC045-AR-f2058b`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-ar-f2058b@example.com","depois":"qa.unif22.tc045.c.tc045-ar-f2058b@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**FW** (`TC045-FW-8b40cb`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc045.a.tc045-fw-8b40cb@example.com","depois":"qa.unif22.tc045.c.tc045-fw-8b40cb@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**RC** (`TC045-RC-d7dd10`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfTgG2AU ≠ leadCandidato 00QHZ00000cfLFn2AM"]`

**EP** (`TC045-EP-576875`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfa4v2AA ≠ leadCandidato 00QHZ00000cfLfU2AU"]`

**RL** (`TC045-RL-f369f0`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfZVU2A2 ≠ leadCandidato 00QHZ00000cfamQ2AQ"]`

### TC-046 — Venda Genérica reutiliza Lead sem CPF por celular

**AR** (`TC046-AR-11ddcc`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfYfq2AE ≠ leadCandidato 00QHZ00000cfXs02AE"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-ar-11ddcc@example.com","depois":"qa.unif22.tc046.c.tc046-ar-11ddcc@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-ar-11ddcc@example.com","depois":"qa.unif22.tc046.c.tc046-ar-11ddcc@example.com"}]`

**FW** (`TC046-FW-172a51`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfLm12AE ≠ leadCandidato 00QHZ00000cfUlz2AE"]`
- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc046.a.tc046-fw-172a51@example.com","depois":"qa.unif22.tc046.c.tc046-fw-172a51@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc046.a.tc046-fw-172a51@example.com","depois":"qa.unif22.tc046.c.tc046-fw-172a51@example.com"}]`

**RC** (`TC046-RC-5cf1df`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfY7w2AE ≠ leadCandidato 00QHZ00000cfMF52AM"]`

**EP** (`TC046-EP-83c16f`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfNfc2AE ≠ leadCandidato 00QHZ00000cfLCY2A2"]`

**RL** (`TC046-RL-39491a`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfPCt2AM ≠ leadCandidato 00QHZ00000cfGas2AE"]`

### TC-047 — Venda Genérica reutiliza Lead por CPF forte

**AR** (`TC047-AR-e705ae`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-ar-e705ae@example.com","depois":"qa.unif22.tc047.c.tc047-ar-e705ae@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-ar-e705ae@example.com","depois":"qa.unif22.tc047.c.tc047-ar-e705ae@example.com"}]`

**FW** (`TC047-FW-55bc59`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc047.a.tc047-fw-55bc59@example.com","depois":"qa.unif22.tc047.c.tc047-fw-55bc59@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`
- Lead X intacto: `[{"campo":"Email","antes":"qa.unif22.tc047.a.tc047-fw-55bc59@example.com","depois":"qa.unif22.tc047.c.tc047-fw-55bc59@example.com"}]`

### TC-048 — Lead Y preso com compatibilidade total

**AR** (`TC048-AR-4b88ab`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-ar-4b88ab@example.com","depois":"qa.unif22.tc048.c.tc048-ar-4b88ab@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**FW** (`TC048-FW-d5111c`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc048.a.tc048-fw-d5111c@example.com","depois":"qa.unif22.tc048.c.tc048-fw-d5111c@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

### TC-049 — Venda de Unidade reutiliza Lead livre por contatos

**AR** (`TC049-AR-c7c5d7`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-ar-c7c5d7@example.com","depois":"qa.unif22.tc049.c.tc049-ar-c7c5d7@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**FW** (`TC049-FW-0e86dc`, ❌ diverge):

- Account X intacta: `[{"campo":"PersonEmail","antes":"qa.unif22.tc049.a.tc049-fw-0e86dc@example.com","depois":"qa.unif22.tc049.c.tc049-fw-0e86dc@example.com"},{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10…`

**RC** (`TC049-RC-e6b358`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfWe82AE ≠ leadCandidato 00QHZ00000cfZX32AM"]`

**EP** (`TC049-EP-70f3f7`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfVDL2A2 ≠ leadCandidato 00QHZ00000cfc532AA"]`

**RL** (`TC049-RL-082a74`, ❌ diverge):

- Lead leadCandidato reutilizado e vinculado (CPF preenchido): `["Lead vinculado 00QHZ00000cfUil2AE ≠ leadCandidato 00QHZ00000cfN6D2AU"]`

### TC-054 — Proponente X aprovado como Y na Venda Genérica

**AR** (`TC054-AR-6d9224`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:09:58.000+0000"}]`

**FW** (`TC054-FW-6efb96`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular: `["e-mail qa.unif22.tc054.a.tc054-fw-6efb96@example.com","celular 31986359354"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:10:23.000+0000"}]`

### TC-055 — Priorizar Lead Y por CPF na Venda Genérica

**AR** (`TC055-AR-604f6f`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:10:32.000+0000"}]`

**FW** (`TC055-FW-953d0e`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:10:32.000+0000"}]`

### TC-056 — Repetição funcional do TC-055

_Observação:_ Duplicação aparente da planilha: mesma massa do TC-055.

**AR** (`TC056-AR-273a02`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:06.000+0000"}]`

**FW** (`TC056-FW-c6f8fd`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:08.000+0000"}]`

### TC-057 — Proponente Y colide totalmente com X

**AR** (`TC057-AR-586348`, ❌ diverge):

- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:53.000+0000"}]`

**FW** (`TC057-FW-8f5d95`, ❌ diverge):

- Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC: `["e-mail qa.unif22.tc057.a.tc057-fw-8f5d95@example.com","celular 31985634762"]`
- Account X intacta: `[{"campo":"ContatoDataHoraAtualizacaoEmailPendencia","antes":null,"depois":"2026-10-11T17:11:56.000+0000"}]`

## Adaptações registradas

- **TC-012:** O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.
- **TC-014:** IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.
- **TC-015:** IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.
- **TC-039:** A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.
- **TC-053:** Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.
- **TC-062:** Eventos vão sem idprospectsalesforce.

## Tempos

Média de 237 RUNs, em segundos: total 39.0; massa 3.6; cadeia 30.3 (dos quais 15.0 esperando jobs); verificação 0.4; cleanup 4.7.

Refeitos depois de queda de rede: TC-017/RC (1 queda).

## Limpeza

Todos os RUNs apagaram a própria massa e o que o Apex criou para ela, sem resíduo (runbook §6.5).

