# Passagem de contexto: reproduzir o bug original do TC-001 (commit 4)

Atualizado em **2026-10-01**. Leia este documento primeiro se estiver assumindo
a investigação sem acesso à conversa anterior.

## 1. Objetivo e estado atual

O usuário quer **reproduzir na sandbox `mrv-devDan`, usando os scripts deste
simulador, a alteração indevida da Account X durante a aprovação de uma PAC
para outra pessoa Y**. A reprodução deve partir do incidente real de staging,
não de uma massa arbitrária que apenas produza um sintoma semelhante.

**Estado atual (2026-10-01, tarde): bug 4 REPRODUZIDO na dev, com a mesma
impressão digital de staging.** A alteração de X não veio do `/Cliente`. Veio
do `ProponenteTrigger`, disparado por um `notificacaopendencia-insert`
(endpoint `/Pendencia`) que chegou enquanto o Proponente principal da PAC
ainda apontava para X com o e-mail de Y. Detalhes na seção 1.1.

Até a manhã de 01/10, três tentativas na dev tinham preservado X: faltava o
evento de pendência, que não aparece nas buscas por Account porque o log é
indexado pelo `Id__c` do Proponente.

### 1.1 Causa identificada e reprodução (2026-10-01)

Cadeia em staging, por consultas somente leitura (rótulos X/Y, horários UTC):

| Momento | Evidência | Efeito |
|---|---|---|
| 17:50:28 e 17:52:38 | `pac-update` `EM_ANALISE_CREDITO` (`a0dHZ00000NAMfLYAX`, `a0dHZ00000NAMTwYAP`): Proponente principal ("PROP28", mesmo `Id__c` desde 04/09) com CPF Y, PROS-X, e-mail de Y e **sem IdCliente**. | `getClientePosPac` cai em ID_PROSPECT e acha X. O `deveDescartarMatchPosPac` de 2 argumentos (pré-commit 4) não descarta com IdCliente vazio. O Proponente fica com `Proponente__c = X` e `EmailAtualizado__c` = e-mail de Y (CPF divergente: payload é a fonte). X ainda intacto. |
| 17:52:43 | `cliente-insert` cria Y; os quatro parciais são descartados ("Evento descartado" nos stacktraces). | Nenhuma escrita em X. |
| 17:52:43 (log persistido 17:52:45) | `notificacaopendencia-insert` do PROP28 (`a0dHZ00000NAQVTYA5`, `eventTime` 17:52:42.87Z), usuário de integração APIM. | `NotificacaoPendencias` liga `EnviarNotificacaoPendencia__c`. O `ProponenteTrigger` chama `ProponenteTriggerHandler.sincronizarEmailContatoPendencia`, que copia `EmailAtualizado__c` para o Person Contact da Account do Proponente (X). O `AccountHistory` registra `PersonEmail` de X às 17:52:43, pelo mesmo usuário. |
| 17:52:43 | `ClienteTriggerHandler.afterUpdate` de X chama `refletirAlteracoesDadosProponentes`. | Cerca de 20 Proponentes de X ficam com `LastModifiedDate` 17:52:43 e o e-mail de Y. Consequência, não causa. |
| 17:52:46 e 17:52:57 | Reentregas do mesmo evento: uma com `UNABLE_TO_LOCK_ROW`, outra pelo usuário Guest do site. | Sem efeito adicional em X. |
| 17:52:48 | PAC aprovada com IDCLI-Y. | Proponente reparentado para Y; X continua com o e-mail de Y. |

Impressão digital: `Contact.DataHoraAtualizacaoEmailPendencia__c` de X vale
`2026-09-08T14:52:38Z`. É o `DataAlteracaoEvento__c` do PROP28 no segundo
`pac-update` (`14:52:38.127`, horário local sem fuso lido como GMT), e esse
campo só é gravado por `sincronizarEmailContatoPendencia`.

Reprodução na dev, no mesmo estado revertido, com massa sintética e cleanup
sem resíduo:

| Run | Opções | Resultado |
|---|---|---|
| `TC001-CA-1a7b28` | `--pendencia` | X intacto até a pendência; logo depois, `PersonEmail` de X = e-mail de Y. |
| `TC001-CA-3cec0d` | nenhuma (controle) | X intacto do início ao fim, embora o Proponente apontasse para X com o e-mail de Y até a PAC aprovada. |
| `TC001-CA-c3aabb` | `--pendencia --data-proponente-staging` | Igual ao primeiro, e o carimbo de X (`11:09:09`) é o `DataAlteracaoEvento__c` do Proponente, como em staging. |

Todos os eventos responderam HTTP 200, sem erros correlacionados.

O que isso implica:

- O guard novo de `NotificacaoCliente` (`validarIdentidadePayloadParcialContraAccount`)
  não participa. Em staging, os parciais já eram descartados pelo guard anterior.
- Quem corta a cadeia é a linha do commit 4 em `NotificacaoPAC` que passa o
  CPF para `deveDescartarMatchPosPac`. No HEAD da branch (com `9210581ea5`), a
  PAC sem IdCliente com CPF Y que acha X pelo prospect é descartada e o evento
  lança "Cliente(Account) não encontrado" até Y existir. **Não testado ao
  vivo**: a dev roda o estado revertido.
- `sincronizarEmailContatoPendencia` continua sem guard de identidade no
  HEAD. Projeta o e-mail do Proponente na Account para a qual ele aponta, sem
  conferir CPF nem IdCliente. Qualquer outro caminho que deixe um Proponente
  de Y ligado a X reabre o sintoma.
- **Caminho ainda aberto, comprovado na dev.** No run `TC001-CA-dd0c75`
  (`--idcliente-x-na-analise`), as PACs em análise trazem o IdCliente de X
  com o CPF de Y, padrão já visto no TC-002 (skill, ajuste de 28/08). O match
  é por ID_CLIENTE, o guard do commit 4 não se aplica, e X recebe o e-mail de
  Y logo após a pendência, com o mesmo carimbo. Nesse caminho a dev tem o
  mesmo código do HEAD:
  - `getClientePosPac`, `ProponenteTrigger`, `ProponenteTriggerHandler` e
    `EventGrid` são idênticos;
  - a `NotificacaoPAC` difere só na linha do guard, que não age em match por
    IdCliente;
  - a `NotificacaoPendencias` difere só no tratamento de erro.

  Isso não é um teste do HEAD implantado, mas indica que o HEAD repete o bug
  nesse caminho.
- **Mais dois caminhos confirmados na dev (01/10, tarde)**, ambos com o
  IdCliente de X nas PACs em análise. Controle sem pendência e sem
  contestação: `TC001-CA-fd53fa`, X preservado.
  - **Caminho 3, `TC001-CA-97b306` (`--pendencia-antes`):** a pendência
    chega quando o Proponente ainda é de X e só regrava o e-mail dele. Com a
    flag já ligada, a primeira PAC de Y altera X sem pendência nova. O
    carimbo é a data do Proponente nessa PAC.
  - **Caminho 4, `TC001-CA-698f77` (`--contestacao-pendente`):** com uma
    contestação pendente na PAC, `ClienteService.sincronizarContatosContestacao`
    grava o e-mail de Y em X na primeira PAC de Y. Esse método confere só o
    IdCliente. O carimbo de pendência fica vazio, e o marcador
    `DataAlteracaoEventoContatoEmail__c` de X fica igual à data da PAC. O
    método é idêntico entre dev e HEAD.
  - Nos dois, o Lead X também recebeu o e-mail de Y; nos caminhos com
    pendência nova, não. O guard só na pendência não cobre o caminho 4: o
    plano no repositório Salesforce agora inclui a checagem de CPF na
    contestação.

Permissão: o usuário do CLI não tinha FLS de leitura em
`Contact.DataHoraAtualizacaoEmailPendencia__c` na dev. Com autorização do
usuário, a leitura foi incluída no `AcessoDeAPI` (arquivo local em
`com_salesforce_mrv`, sem commit) e implantada na dev (deploy
`0AfHZ00000QaIsH0AV`) a partir da versão da org mais essa entrada. Uma nova
recuperação confirmou uma adição e nenhuma remoção. Divergência preexistente,
não implantada: `PropostaAnaliseCredito__c.QuantidadeProponentes__c` tem
`editable=true` no arquivo e `false` na dev.

Não estamos corrigindo Apex neste momento, nem tentando resolver erros de PR
ou deploy de outras features. O arquivo de erros do PR 113762 é fora de escopo.

## 2. Contexto funcional mínimo

- **X:** pessoa que iniciou a jornada; possui Account e Lead vinculados.
- **Y:** pessoa de CPF diferente, aprovada na PAC; deve ganhar sua própria
  Account e seu próprio Lead, sem alterar X.
- **Id Cliente:** `Account.Id__c`, identidade externa do MS Clientes.
- **PROS-X / PROS-Y:** `Lead.Id__c`, referenciado em
  `Account.IdProspectSalesforce__c`.
- O vínculo Account → Lead é lógico:
  `Account.IdProspectSalesforce__c == Lead.Id__c`; não é um lookup Lead → Account.
- Os primeiros eventos de Y podem carregar **PROS-X**, da jornada original,
  antes do retorno do novo **PROS-Y**.
- **Neste incidente, IDCLI-X e IDCLI-Y são diferentes, assim como os CPFs.**
  Não confundir compartilhamento de prospect com compartilhamento de Id Cliente.

Esperado: nova Account Y, novo Lead Y, vínculo entre eles, Account X e Lead X
preservados. O sintoma relatado é alteração da Account X; não exige
necessariamente sobrescrita de CPF para caracterizar a falha.

Referências:

- [Runbook integrado](runbook-testes-manuais-unificacao-2.2.md), seção TC-001.
- [Relatório histórico e retificação](tc-001-diagnostico-corridas-commits-3-4.md).
- [Textos originais dos bugs](textos-originais-bugs-tc001-commits-3-4.md).

## 3. Dois bugs distintos: não misturar as evidências

| Identificador usado na conversa | Commit | Sintoma |
|---|---|---|
| Bug/commit 4 | `1f6844e910` | Account X alterada indevidamente; guard de identidade em `NotificacaoCliente`. **Foco atual.** |
| Bug/commit 3 | `72cbd884f6` | Lead Y não criado; correção envolvendo retry de lock no `insertLeadQueueable`. Investigação anterior, não concluída. |

As URLs inicialmente disponíveis eram do **bug 3**, e não bastavam para
explicar o bug 4. O usuário forneceu os registros específicos do bug 4 em
2026-10-01. A mesma Account X aparece nos dois relatos; a Account Y é diferente.

## 4. Registros reais do bug 4, em staging

| Papel | Registro |
|---|---|
| Jornada | [Opportunity 006HZ00000TVyX3YAL](https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Opportunity/006HZ00000TVyX3YAL/view) |
| Account Y | [001HZ00000zFuZsYAK](https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Account/001HZ00000zFuZsYAK/view) |
| Lead X | [00QHZ00000XxSq72AF](https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Lead/00QHZ00000XxSq72AF/view) |
| Account X | [001HZ00000txIvnYAE](https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Account/001HZ00000txIvnYAE/view) |

Consultas realizadas em 2026-10-01:

- Accounts X e Y têm Id Clientes distintos e CPFs distintos.
- Lead X está vinculado à Account X pela chave de prospect.
- Account Y foi criada em **2026-09-08T17:52:43Z**.
- A Opportunity consultada atualmente aponta para Y; foi criada em 04/09.
- A PAC da jornada já existia desde 04/09:
  `PropostaAnaliseCredito__c.Id = a0kHZ00000BDELNYA5`.
- Estado atual e LastModifiedDate não equivalem ao estado inicial do incidente.
  X teve alterações posteriores; reconstruir o passado pelos logs/histórico.

### Sequência real encontrada

Horários abaixo são UTC, salvo valores de payload explicitamente diferentes.

| Recebimento (`CreatedDate`) | Log `LogIntegracao__c.Id` | Evento / identidade |
|---|---|---|
| 08/09 17:50:28 | `a0dHZ00000NAMfLYAX` | `pac-update`, `EM_ANALISE_CREDITO`; Proponente com CPF Y, PROS-X e Id Cliente vazio. |
| 08/09 17:52:38 | `a0dHZ00000NAMTwYAP` | Outra PAC em análise, mesma combinação de identidade. |
| 08/09 17:52:43 | `a0dHZ00000NAKYtYAP` | `cliente-insert`: IDCLI-Y, CPF Y, PROS-X. Cria Account Y. |
| 08/09 17:52:43 | `a0dHZ00000NAKYuYAP` | `contato-insert` Celular: IDCLI-Y, PROS-X. |
| 08/09 17:52:43 | `a0dHZ00000NAKQWYA5` | `contato-insert` Email: IDCLI-Y, PROS-X. |
| 08/09 17:52:43 | `a0dHZ00000NAKQXYA5` | `endereco-insert` Principal: IDCLI-Y, PROS-X. |
| 08/09 17:52:43 | `a0dHZ00000NAI5rYAH` | `endereco-insert` Cobranca: IDCLI-Y, PROS-X. |
| 08/09 17:52:47 | `a0dHZ00000NAMTyYAP` | `cliente-update`: IDCLI-Y, CPF Y, PROS-Y. |
| 08/09 17:52:48 | `a0dHZ00000NAOjzYAH` | PAC aprovada: IDCLI-Y, CPF Y e PROS-X no Proponente. |

Os logs consultados acima estavam em `success`. Isso não prova preservação de X.
Os parciais tinham indicação de descarte nos stacktraces e não tinham
`Cliente__c` preenchido; não assumir que eles foram os responsáveis pela escrita.

`eventTime` dos eventos de cliente mostra cliente, celular, email, endereço
Principal e endereço Cobranca nessa ordem de emissão, separados por frações
de segundo. **Emissão não determina ordem de execução/commit**: todos foram
persistidos como logs no mesmo segundo.

Os `eventTime`/`dataAlteracao` dos payloads PAC exibem horários próximos de
14:50/14:52, enquanto os logs foram recebidos às 17:50/17:52 UTC. Não
normalizar essa diferença silenciosamente em um replay que pretenda fidelidade
temporal; o diagnóstico atual comprime e substitui esses horários.

### Evidência objetiva da alteração de X

Consulta de `AccountHistory` da Account X:

- `Field = PersonEmail`.
- `CreatedDate = 2026-09-08T17:52:43Z`.
- `OldValue` diferente de `NewValue`.
- `NewValue` igual ao e-mail no contato de Y e no Proponente dos três logs PAC.

Isso **confirma o sintoma histórico**. Não comprova, sozinho, qual trigger,
Flow, integração, usuário ou transação foi responsável pela alteração.

Não registramos CPF, nome, e-mail ou telefone pessoais neste documento.
Consultas devem comparar relações/igualdades e mostrar somente rótulos X/Y.

## 5. Ambientes, segurança e estado do código

- **Staging:** somente consultas. Nunca enviar eventos, executar DML, deploy
  ou testes destrutivos nessa org.
- **Dev:** `mrv-devDan`, host
  `mrvcomercial--danieldev.sandbox.my.salesforce.com`.
- Usar massa sintética e chaves novas por execução; nunca copiar PII de staging.
- `connectToTargetOrg` valida a sandbox e a org autorizada antes de escrever.
- Não mudar a branch Salesforce de outro trabalho, nem restaurar/deployar
  correções sem autorização. O checkout local já mudou durante a investigação;
  o HEAD local não é prova do código que está rodando na org.
- Em 01/10, consulta Tooling de `NotificacaoCliente` na dev mostrou:
  `LastModifiedDate = 2026-09-27T21:29:34Z`, sem
  `validarIdentidadePayloadParcialContraAccount` e sem
  `updateAccountComRetryLock`. É o estado com reversões manuais que o usuário
  preparou. Reconfirmar isso antes de novos testes; não assumir que permaneceu igual.
- Reconfirmado em 01/10, à tarde: `NotificacaoPAC` (27/09 21:31:07Z) e
  `ClienteService` (27/09 21:28:41Z) usam o `deveDescartarMatchPosPac` de dois
  argumentos (pré-commit 4); `ProponenteTrigger` está ativo e chama
  `sincronizarEmailContatoPendencia`. `NotificacaoPendencias` aparece com
  `IsValid=false`, mas recompilou e executou normalmente.
- Ausência de esses métodos não prova equivalência completa ao código histórico
  de staging em 08/09. Outras correções continuaram presentes.

Repo do simulador nesta máquina:
`D:\Documentos\Trabalho\Ambientes\MRV\MS Cliente`.

Repo Salesforce nesta máquina:
`C:\Users\preda\OneDrive\Documentos\TRABALHO\com_salesforce_mrv`.

Leia a skill `salesforce-unificacao-clientes`, especialmente a referência
`references/unificacao-2.2-pos-pac.md`, no repo Salesforce. Ela traz o mapa
de código, regras das orgs e receitas de correlação dos logs.

## 6. Tentativas e o que realmente provam

| Tentativa | Resultado | Limite da conclusão |
|---|---|---|
| Harness TC-001, PA/CA/ME, 27/09 | 3 conformes; X preservado | Recorte 2.2 com fixtures; não reproduz todos os eventos/estado do incidente. |
| Diagnóstico Id Cliente compartilhado, 27/09 | Account X terminou com CPF Y | **Massa artificial. Não é reprodução do bug 4 original.** |
| Replay da evidência, run `TC001-CA-6a0261`, 01/10 | X preservado; Account Y e Lead Y criados | Sequencial, inicialmente sem PAC previamente vinculada a X. |
| Replay, run `TC001-CA-4501f5`, 01/10 | Mesmo resultado | Sequencial, agora com PAC previamente vinculada a X. |
| Replay, run `TC001-CA-2bcc06`, 01/10 | Mesmo resultado | Eventos cliente/parciais concorrentes, PROS-X em maiúsculas; PAC prévia. |
| Replay com pendência, `TC001-CA-1a7b28`, 01/10 | **X alterado** logo após o `notificacaopendencia-insert` | Sequencial; formato de data do harness. |
| Controle, `TC001-CA-3cec0d`, 01/10 | X preservado | Mesmo script, sem `--pendencia`. |
| Replay com pendência e data no formato de staging, `TC001-CA-c3aabb`, 01/10 | **X alterado**; carimbo igual ao de staging | Ver seção 1.1. |
| Variante com IdCliente de X nas PACs em análise, `TC001-CA-dd0c75`, 01/10 | **X alterado** após a pendência | Não é o incidente: caminho que o guard do commit 4 não cobre. |
| Controle da variante (IdCliente de X, sem pendência e sem contestação), `TC001-CA-fd53fa`, 01/10 | X preservado | Base dos caminhos 3 e 4. |
| Caminho 3, pendência antes da PAC de Y, `TC001-CA-97b306`, 01/10 | **X alterado** na primeira PAC de Y | Sem pendência nova. |
| Caminho 4, contestação pendente, `TC001-CA-698f77`, 01/10 | **X alterado** na primeira PAC de Y | Escritor: `sincronizarContatosContestacao`. |

Nos três replays: HTTP 200, nenhum erro correlacionado retornado pelo helper,
cleanup `restantes = 0`, sem erros de limpeza. Isso não significa que todos os
campos, automações e logs possíveis foram verificados.

### Investigações anteriores do bug 3 e achados separados

- Corrida insert/update para um mesmo IDCLI-Y novo reproduziu `DUPLICATE_VALUE`,
  mas o Lead Y foi criado. Não reproduziu a consequência "Lead ausente".
- Cliente + PAC concorrentes reproduziram também
  `System.QueryException: Record Currently Unavailable`.
  Não é a exceção literal `UNABLE_TO_LOCK_ROW` do commit 3.
- Experimento com prospects de contas estrangeiras diferentes criou múltiplos
  Leads de mesmo CPF: 8 Leads em concorrência 8; 24 em concorrência 25;
  Account Y vinculada a somente um deles. É um achado separado, com massa
  artificial; não é reprodução fiel de nenhum dos dois incidentes originais.
- Não concluir execução paralela de jobs apenas por CreatedDate/CompletedDate
  sobrepostos: essas datas incluem tempo em fila.
- Não concluir que um Queueable nunca rodou porque não há AsyncApexJob
  antigo disponível: retenção/expurgo podem explicar ausência de registros.
- Não afirmar que retry de lock elimina duplicação silenciosa: isso não foi testado.

## 7. Script atual e comandos para continuar

Script recomendado:
[diagnostico-tc001-evidencia-staging.ts](../scripts/runbook/diagnostico-tc001-evidencia-staging.ts).

```powershell
Set-Location 'D:\Documentos\Trabalho\Ambientes\MRV\MS Cliente'
sf.cmd org display --target-org mrv-devDan --json
npm.cmd run typecheck
npx.cmd eslint scripts\runbook\diagnostico-tc001-evidencia-staging.ts
npx.cmd tsx scripts\runbook\diagnostico-tc001-evidencia-staging.ts --org-alias mrv-devDan
npx.cmd tsx scripts\runbook\diagnostico-tc001-evidencia-staging.ts --org-alias mrv-devDan --concorrente
# Reprodução do bug 4 (seção 1.1):
npx.cmd tsx scripts\runbook\diagnostico-tc001-evidencia-staging.ts --org-alias mrv-devDan --pendencia --data-proponente-staging
```

`--pendencia` envia o `notificacaopendencia-insert` real (mesmo formato do log
`a0dHZ00000NAQVTYA5`) entre os eventos de cliente e a PAC aprovada.
`--data-proponente-staging` manda o `dataAlteracao` do Proponente como nos
logs de staging (horário local, UTC-3, sem fuso). Os snapshots trazem
`contatoX` (e-mail e carimbo da pendência) e `proponente` (conta apontada,
flag de pendência, e-mail). `--idcliente-x-na-analise` manda o IdCliente de X
nas duas PACs em análise (variante fora do incidente). Sem essa opção, os
eventos são os mesmos da reprodução original.

Os quatro caminhos também viraram os perfis opcionais **C1 a C4 do runner
do runbook**, aplicáveis aos TCs existentes, porque o escopo de TCs é
fechado. Exemplo: `npm run runbook -- --tcs TC-001,TC-005 --perfis
C1,C2,C3,C4`. Estão descritos no README, foram implementados em 01/10 e ainda
não rodaram na dev.

Mais duas opções, também só aditivas:

- `--pendencia-antes` manda a pendência logo depois da PAC original de X,
  com os dados de X.
- `--contestacao-pendente` cria uma `Contestacao__c` pendente na PAC antes
  das PACs de Y. Usa o mesmo caminho do `test-data-adapter` e apaga a
  contestação no cleanup, porque o lookup da PAC é SetNull. O trigger da
  contestação faz um callout para `Endpoints__c.ContestacaoInsert__c`, que em
  01/10 apontava para o simulador. Confira antes de rodar.

Não publicar a saída de `sf org display`: contém access token. Selecionar
somente os campos necessários se precisar mostrar confirmação do ambiente.

O script cria massa, Opportunity e PAC original de X; manda duas PACs em
análise com CPF Y/PROS-X e sem Id Cliente; manda cliente/parciais de Y;
aguarda jobs; lê PROS-Y; manda retorno de cliente e PAC aprovada.
Emite `evidencia-snapshot` por etapa e limpa os registros no `finally`.

Usa envio REST direto ao Apex, não a API hospedada do simulador:
o schema restrito do simulador exige Id Cliente no Proponente e aceita somente
endereço COBRANCA, enquanto os logs reais têm Id Cliente vazio e Principal.
Não alterar o schema público só para este diagnóstico sem avaliar escopo.

Helpers reutilizados:
[engine.ts](../scripts/runbook/engine.ts) e
[stress-o10-concurrent-events-lib.ts](../scripts/stress-o10-concurrent-events-lib.ts).
Não importar scripts que executam `main()` no topo: isso pode iniciar testes
reais involuntariamente.

### Limitações atuais do replay

- Campos cadastrais simplificados; não é cópia completa dos payloads.
- Intervalos históricos comprimidos e datas substituídas; execução sequencial
  tem snapshots que mudam o timing. A variante concorrente não fixa ordem de commit.
- Não reconstitui toda a jornada 2.1, todos os eventos MaquinaEstado, histórico
  do Person Contact, pendências/contestações nem automações de staging.
- Compara um subconjunto de campos, não uma preservação integral do registro.
- `accountXAlterada` considera os campos da Account comparados; mudanças do Lead
  são emitidas nos snapshots, mas não entram nesse booleano final.
- `aguardarJobs` consulta a janela da org, não somente jobs desta execução,
  e o helper atual pode sair por timeout sem lançar erro. Não usar seu retorno
  como prova absoluta de conclusão de todos os jobs.
- Cleanup confere o conjunto descoberto/allowlist; não equivale a auditoria de
  todos os efeitos colaterais possíveis das automações.

## 8. Evidências locais e situação do Git

Logs no workspace da sessão:
`C:\Users\preda\.copilot\session-state\355f720b-e0f3-4d72-adb5-5a1dc454f1e2\files`.

| Arquivo | Conteúdo |
|---|---|
| `tc001-evidencia-staging-run1.log` | Primeira tentativa sequencial. |
| `tc001-evidencia-staging-run2.log` | Segunda tentativa, PAC prévia de X. |
| `tc001-evidencia-staging-run3-concorrente.log` | Entrega concorrente dos eventos cliente/parciais. |
| `tc001-diag-idcliente-compartilhado.log` | Experimento artificial antigo. |
| `tc001-race-pac-run1-rajada9.log` / `tc001-race-pac-run2-rajada15.log` | Corridas Cliente/PAC anteriores. |
| `tc001-race-prospect-run1-concorrencia8.log` / `tc001-race-prospect-run2-concorrencia25.log` | Achado de multiplicação de Leads. |

Logs e consultas da etapa de 01/10 à tarde ficaram no scratchpad temporário
da sessão do Claude Code
(`%TEMP%\claude\D--Documentos-Trabalho-Ambientes-MRV-MS-Cliente\74731de7-baec-4346-97b5-0d0b042150a5\scratchpad\bug4`):
`run-pendencia-2.log`, `run-controle-1.log`,
`run-pendencia-3-formato-staging.log` e as consultas somente leitura de
staging (`staging-ro.mjs`, `q2-evidencia.mjs`), que imprimem apenas rótulos.
Copie o que quiser preservar: essa pasta pode ser apagada.

Alguns logs foram escritos em UTF-16 pelo redirecionamento do Windows PowerShell;
usar leitor com encoding apropriado. Não confundir caracteres de encoding
com conteúdo real dos eventos.

Na última inspeção, README/package.json estavam modificados, diagnósticos e
relatório estavam não versionados. Não houve commit/push desta investigação.
Há alterações e arquivos de outros trabalhos; preservar tudo e revisar
`git status` antes de editar ou fazer commit. Não usar `git add -A`.

## 9. Próximos passos sugeridos, sem causa-raiz presumida

1. Reconsultar a cadeia específica de staging, incluindo `StackTrace__c`,
   histórico do Person Contact, Proponente e Opportunity. Comparar antes/depois
   da alteração do e-mail de X; investigar também escritores fora de `/Cliente`.
2. Verificar `CreatedById` do histórico e correlacionar com logs/automação
   quando disponível. O mesmo segundo não prova causalidade.
3. Comparar o código do commit 4, seu pai, a feature, develop e o código
   efetivamente deployado. Não fazer merge de develop para feature.
4. Investigar especialmente como a PAC com CPF Y, PROS-X e Id Cliente vazio
   se associava à Account X e como atualizações do Proponente/Person Contact
   podiam refletir e-mail em X no código histórico.
5. Acrescentar ao replay somente precondições demonstradas pela evidência.
   Não forçar IDCLI-X em um payload que historicamente traz IDCLI-Y.
6. Se necessário, ampliar snapshots e correlação para identificar uma alteração
   transitória restaurada depois. Separar prova do sintoma de prova da causa.
7. Considerar sucesso somente quando uma execução identificada alterar X com
   a massa/identidade do incidente original, registrando campo, etapa e estado
   anterior/posterior, mais cleanup verificável. Resultado negativo é válido:
   relatar lacunas em vez de mudar a massa até obter um bug diferente.

Situação desses passos em 01/10, à tarde: 1, 2, 4, 5 e 7 foram feitos (seção
1.1). O passo 3 foi feito para o commit 4 e o HEAD; o código implantado em
staging em 08/09 não foi comparado. Próximos passos possíveis, sem autorização
ainda:

- validar na dev o comportamento do HEAD nesse cenário, o que exige implantar
  as classes corrigidas;
- implementar um guard de identidade em `sincronizarEmailContatoPendencia`
  (CPF e IdCliente do Proponente contra a Account). O plano para um agente
  sem contexto está em
  `com_salesforce_mrv\docs\plano-correcao-guard-identidade-email-pendencia-proponente.md`;
- avaliar se a exceção "Cliente(Account) não encontrado" nas PACs em análise
  sem IdCliente leva à fila manual depois das reentregas.

**Mensagem-chave para o próximo agente:** a transação que alterou X em
staging foi o `notificacaopendencia-insert` das 17:52:43, que projetou o
e-mail de Y pelo Proponente ainda ligado a X. O replay com `--pendencia`
reproduz isso na dev com a mesma impressão digital, e o controle sem o evento
preserva X. Id Cliente compartilhado foi uma hipótese artificial já refutada
como representação deste incidente.
