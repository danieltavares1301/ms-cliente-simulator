# A jornada é resolvida para a Account que guarda o prospect de outra pessoa

- **Reportado por:** QA, em 05/11/2026, na `mrv-staging`. Teste que começa na 2.1 (Iniciar Jornada de Unidade) e termina na 2.2. Sem número de bug informado até aqui.
- **Plano de correção:** no `com_salesforce_mrv`, em
  `docs/unificacao-clientes/plano-correcao-maquina-estado-prospect-preso-a-outra-account.md`
  (cópia local, fora do git).
- **Status:** reproduzido pelo simulador (seção 2) e **corrigido** (seção 3) no commit `1946fd8901` do `GV_909649_918914` (commit 36 do [mapa](../mapa-commits-reescrita-2.2.md)), implantado na `mrv-devDan` e na `mrv-staging`. Falta o merge para a `develop` e o reteste da QA/Isabela (plano, seção 11).

## 1. O bug, em uma frase

Quando o prospect do Lead da jornada está gravado na Account de **outra pessoa** (com IdCliente e CPF diferente), a 2.1
cria a Account da pessoa sem prospect, como deve. Mas os `jornadausuario-insert` e `-update` da BFF e as PACs em análise
identificam o cliente só pelo prospect (sem IdCliente e sem CPF): o `/MaquinaEstado` e o `/PAC` acham a Account **dessa
outra pessoa**, e a Opportunity e o Proponente da jornada nascem e ficam nela. Os eventos respondem 200 e a cadeia os leva
para a Account certa mais tarde, então o estado final parece correto.

## 2. Reprodução (05/11/2026)

**A variante `TC-024-CLI`** (`scripts/runbook/cenarios.ts`, fora do modelo) monta a saída da 2.1: a Account da pessoa
só com CPF e contatos (sem IdCliente e sem prospect), o Lead com o prospect `P` e a Account Z, de outra pessoa, com
IdCliente e o mesmo `P`. A jornada abre como a da BFF: `jornadausuario-insert` e `jornadausuario-update`, sem IdCliente
e sem CPF, só com `P`. Em seguida vai o `pac-insert` em análise, também sem IdCliente e sem CPF, só com `P` em
`idProponente` (como os `pac-update` de 19:24 da staging). Depois segue a cadeia normal (`cliente-insert`, contatos,
PAC aprovada e máquina).

**Antes dos RUNs,** o corpo das 7 classes envolvidas (`NotificacaoMaquinaEstado`, `ClienteService`, `ClienteSelector`,
`LeadSelector`, `NotificacaoCliente`, `NotificacaoPAC` e `UnificacaoLeadService`) na `mrv-devDan` conferiu com o HEAD
do `GV_909649_918914` (`66f1613e17`).

| TC | Perfis | Veredito |
|---|---|---|
| TC-024-CLI, **sem a correção** (jornada + `/PAC`) | os 15 aplicáveis (todos menos AM e AS) | **15 DIVERGENTES** |
| TC-024-CLI, **com a correção** | os 15 | **15 CONFORMES** |

Nos 15 perfis divergem as **mesmas 3 asserções**, e só elas:

- `jornadausuario-insert` (sem IdCliente e sem CPF) cria a Opportunity na Account da pessoa da jornada: a Opportunity
  nasceu na **Account dona do prospect** (Z);
- `jornadausuario-update` inicial mantém a Opportunity na Account da pessoa da jornada: continuou na Z;
- `pac-insert` em análise (sem IdCliente e sem CPF) liga o Proponente à Account da pessoa da jornada: o Proponente foi
  ligado à **Account dona do prospect** (Z). É o ponto cego do `/PAC`, que usa a mesma busca.

Passam: Account aprovada é a da pessoa, sem prospect (Caso C), Account Z e Lead intactos, uma Account e um Lead por
CPF, PAC aprovada, Proponente e Opportunity na Account aprovada no fim, contatos da PAC, IdCliente, sem job nem log com
erro. Todos os eventos respondem HTTP 200. Resíduo na dev: 0.

As asserções olham a Account da Opportunity **logo depois** do insert e do primeiro update, e a do Proponente logo depois
da PAC, e não só no fim, porque no fim a cadeia já os moveu para a Account certa (como na staging: ficou cerca de cinco minutos na Account errada).

**Arquivos:** `../campanhas-runbook/tc-024-cli-sem-correcao-com-pac.jsonl` (15 RUNs, com a PAC; a dev conferida igual ao
HEAD de novo antes). Antes de incluir o `/PAC`, a mesma variante deu 15 divergentes em 2 asserções
(`tc-024-cli-sem-correcao.jsonl`; `tc-024-cli-pa-teste1.jsonl` é o primeiro RUN, em PA).

**Para repetir:**

```bash
npm run runbook -- --org-alias mrv-devDan --tcs TC-024-CLI --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL,RP,RE,RF,AS --paralelo 5 --saida ../campanhas-runbook/tc-024-cli-<data>.jsonl
```

O harness descarta sozinho os perfis que não se aplicam (AM e AS).

## 3. A correção e a verificação (05/11/2026)

**Regra de negócio (Isabela, área de negócios):** o CPF é a chave principal; o Id Prospect é o plano B, usado só quando
nenhuma Account é achada pelo CPF; e, mesmo como plano B, só vale se o CPF da Account achada não divergir do CPF do Lead.
Sem Account pelo CPF e com prospect divergente, o evento falha e é reentregue, em vez de associar à Account errada.

**Mudança** (no `com_salesforce_mrv`, `GV_909649_918914`, commit `1946fd8901`): `ClienteService.obterCpfDaPessoa( idCliente,
cpfDoEvento, prospect )`. Com CPF ou IdCliente no evento, devolve o CPF do evento como veio. Sem os dois, devolve o CPF
(só dígitos) do Lead dono do prospect. `NotificacaoMaquinaEstado` e `NotificacaoPAC.criarInstanciaProponente` passam esse
CPF a `getClientePosPac` e a `deveDescartarMatchPosPac`, que **não mudaram**. O `/Cliente` ficou de fora (todo evento
traz IdCliente). Plano: `com_salesforce_mrv/docs/unificacao-clientes/plano-correcao-maquina-estado-prospect-preso-a-outra-account.md`.

**Deploy:** só na `mrv-devDan`, `0AfHZ00000RIJ9W0AX` (6 classes, NoTestRun, depois de `--dry-run` limpo), por pacote mdapi
temporário. A `NotificacaoMaquinaEstadoTest` da dev tinha 2 testes que não estão no HEAD (de outra branch, 30/10); foram
mantidos, e os 4 testes novos entraram por cima do corpo da dev.

- **Testes Apex** (8 classes: `ClienteService`, `ClienteSelector`, `NotificacaoCliente`, `NotificacaoPAC`,
  `NotificacaoMaquinaEstado`, `UnificacaoLeadService`, `PesquisarContaController`, `VG_MSClienteCriarAtualizarInvocable`):
  245 testes antes (242 passando), **256 depois (253 passando)**. Os 11 novos passam (3 em `ClienteServiceTest`, 4 em
  `NotificacaoMaquinaEstadoTest`, 4 em `NotificacaoPACTest`). As 3 falhas são as mesmas de antes
  (`jornadaVendaGenericaSemOportunidadeAguardaReenvioTest` e 2 de `PesquisarContaControllerTest`, peculiaridades da dev).
  Nenhum teste que passava deixou de passar.
- **Provas dos dois lados:** a variante diverge nos 15 perfis com o HEAD e fica **conforme nos 15** com a correção
  (`../campanhas-runbook/tc-024-cli-com-correcao.jsonl`).
- **Sem regressão:** campanha completa (`--todos`, `--paralelo 6`, 775 RUNs, 20:03 a 21:31 BRT), comparada com a de 03/11
  (`completa-correcao-bug-1142660-2026-11-03.jsonl`): **774 conformes, 1 divergente, 0 erros, resíduo 0**. Pares novos: os
  15 da variante, todos conformes. Nenhuma asserção que passava passou a falhar. O único par que era conforme e divergiu é
  o **TC-041 no AS**, por outro bug, já reproduzido em 05/11 antes desta correção: a asserção do Cliente da Jornada (`CR`
  vazio na Account de Y), do TC-041
  (`com_salesforce_mrv/docs/unificacao-clientes/2026-11-05-tc041-cliente-da-jornada-fica-sem-cliente-quando-y-nasce-depois-da-pac.md`,
  seção 3.3), cuja correção ainda não existe. Arquivos: `../campanhas-runbook/completa-correcao-prospect-outra-pessoa-2026-11-05.jsonl`
  e `docs/resultado-runbook-completo-correcao-prospect-outra-pessoa-2026-11-05.md`.

**Deploy em `mrv-staging` (05/11/2026, 21:35 BRT), a pedido explícito do usuário**, fora da pipeline: deploy
`0AfHZ00000RIM5m0AH`, 6 classes, NoTestRun, depois de `--dry-run` limpo. A staging era igual à `origin/develop`
(`f6d9e7728a`) nas 7 classes lidas. `NotificacaoPAC` e `NotificacaoPACTest` eram iguais ao HEAD e subiram como estão; as outras
4 (`ClienteService`, `ClienteServiceTest`, `NotificacaoMaquinaEstado`, `NotificacaoMaquinaEstadoTest`) diferiam do HEAD, e
receberam as mudanças por merge de 3 vias (base = HEAD, sem conflito): o merge só acrescentou as linhas da correção
(+30, +82, +2 e +92) e não removeu nada que a staging já tinha. Conferido depois: o corpo em staging é igual ao merge, e
`LeadSelector` (não alterada) continua igual à `develop`. A staging tem o mapeamento `Cliente_Account_nao_encontrado` (500).
O próximo deploy do `develop` pela pipeline sobrescreve estas classes. Testes Apex **não** foram rodados em staging.

## 4. Limites da reprodução

- A 2.1 real não é chamada: a massa é a saída dela, por DML.
- O `pac-insert` da variante sai sem IdCliente e sem CPF, com o prospect em `idProponente`, como a PAC em análise da
  staging; a PAC de X das outras variantes continua com IdCliente e CPF.
- O `jornadausuario-insert` do harness leva só `cliente` (prospect), `id`, `estado` (`UNIDADES`), `idunidade`,
  `jornadalead`, `origem` e `tipojornada`. O real traz mais campos; a Opportunity nasceu com esses.
- Na staging, a Opportunity foi criada às 19:21:56 por um usuário de integração e não existe log
  `jornadausuario-insert` dessa jornada. A reprodução mostra que o insert, sozinho, a cria na Account errada, o que
  é compatível com a staging, mas não prova que foi esse o caminho lá.
- Falta o RUN de controle com o prospect na própria Account da pessoa, que deve ficar conforme.

## 5. Próximos passos

1. Merge para a `develop` e reteste manual da Isabela na staging, com a lista da seção 11 do plano (cenário novo obrigatório,
   TC-024, 027, 048, 021, 001 a 004, 039, e a confirmação dos TC-025 e 038, que mudam de propósito).
2. A `develop` tem o mapeamento `Cliente_Account_nao_encontrado` (HTTP 500) e este branch não; na dev ele existe. Sem ele, o
   "Account não encontrada" do `/MaquinaEstado` volta 400 (fila manual), e não 500 (reentrega).
3. Falta o RUN de controle da variante, com o prospect na própria Account da pessoa (deve ficar conforme).
4. Os logs da dev: sobram 28 MB de 200 (depois desta campanha).
