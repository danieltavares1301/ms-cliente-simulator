# Critério de aceite da Unificação 2.2

O critério de aceite conhecido em **2026-10-11** para a camada de identidade e
contatos da 2.2. Serve de alvo para a reescrita enxuta proposta no
[inventário dos commits da 2.2](inventario-commits-2.2.md). Junta o que o
[runbook](runbook-testes-manuais-unificacao-2.2.md) define, onde a ponta da 2.2
está frente a ele e o que ainda precisa de decisão.

- **O que está definido:** seções 1 a 3, tiradas do runbook e da planilha.
- **Onde estamos:** seção 4, pelas duas campanhas de 11/10
  ([catálogo de bugs](bugs-pegos-pelo-runbook.md)).
- **O que falta:** seções 5 a 7, com as decisões em aberto e uma proposta de
  critério para a reescrita.

## 1. Fonte e regra mestra

- **A planilha manda.** A fonte normativa é a planilha da US 918914
  (`Hom. Unificação de Leads - USER STORY 918914 - [Unificação de clientes 2.2]
  Regra de validação APÓS a aprovação da PAC.xlsx`, em
  `docs/unificacao-clientes/` no checkout do `com_salesforce_mrv`), com 70
  cenários; 13 deles (022 e 030 a 041) são da US 1026579. O runbook os
  transforma em passos executáveis, mas não a substitui. A skill
  `salesforce-unificacao-clientes` traz as regras canônicas.
- **O runbook não converge por inteiro com a planilha.** Em 11 TCs ele ou o
  harness executam outro cenário ou cobram o que ela não pede, e o harness deixa
  de conferir parte do que ela pede
  ([convergência entre a planilha e o runbook](convergencia-planilha-runbook-2.2.md)).
  Há também duas versões do runbook: a do projeto, com três perfis
  obrigatórios, e a do `com_salesforce_mrv`, com seis.
- **Regra mestra:** "nunca sobrescrever dados de uma pessoa com dados de outra.
  Na dúvida, preservar os registros existentes."
- **Conflito:** quando o runbook, a planilha e o código divergem, a divergência
  é registrada, e o caso não é aprovado em silêncio.

## 2. O que conta como aprovado

### 2.1 Vereditos

| Veredito | Quando |
|---|---|
| `PASS-CLI` | CLI completo (seção 2.2), com todas as evidências da seção 6.3 do runbook |
| `PASS-COM-LACUNA-DE-LOG` | igual ao `PASS-CLI`, mas algum `LogIntegracao__c` não persistiu, e o pacote substitutivo da seção 6.3.1 está completo |
| `FAIL-CLI` | uma asserção obrigatória falhou, comprovada por payload ou comando, resposta ou estado observado e o ID do log ou job |
| `BLOCKED` | a dependência funcional ou técnica do TC continua aberta |
| `INCONCLUSIVO` | falta evidência obrigatória, sem substituição e sem falha comprovada |
| `DIAGNOSTICO` | execução parcial, como a 2.1 ou a 1.3 montadas por DML direto; não dá `PASS-CLI` nem `FAIL-CLI` |

### 2.2 CLI completo

Pela seção 4.4 do runbook, um TC só é CLI completo quando a mesma execução
comprova:

1. prechecks por CPF, e-mail, celular, IdCliente e IdProspect antes do DML, e
   só os registros preexistentes da planilha montados como massa;
2. a 2.1 pelo ponto de entrada real, `PesquisarContaController.getAccountForLead`;
3. na Venda Genérica, a 1.3 pelo caminho real, `PermutaCadastroCliente` /
   `VG_MSClienteCriarAtualizarInvocable`;
4. `/PAC`, `/Cliente` e `/MaquinaEstado` acionados quando aplicáveis, com a
   ordem invertida validada nos cenários divergentes;
5. Account, Lead, Proponente, PAC e Opportunity no estado esperado em cada
   fronteira, X e Z preservados, sem duplicidade e com
   `Account.IdProspectSalesforce__c == Lead.Id__c` (ou o Caso C justificado);
6. logs, Queueables e callbacks sem erro, correlacionados ao RUN;
7. os três perfis obrigatórios (seção 2.3), em sequência e com massas
   independentes;
8. a cadeia de retorno completa: `cliente-update` com o PROS-Y, `pac-update` e
   máquina. O callback HTTP sozinho não substitui os eventos.

### 2.3 Perfis obrigatórios

Pela seção 4.1.1 do runbook, todo TC executável roda nos três perfis:

| Perfil | Ordem | Objetivo |
|---|---|---|
| PA (`ORDEM-PARCIAIS-ANTES`) | contato e endereço com o PROS-X, depois `cliente-insert`, Queueable, `cliente-update` com o PROS-Y, `pac-update` e máquina | descarte defensivo e zero DML em X antes de Y existir |
| CA (`ORDEM-CLIENTE-ANTES`) | `cliente-insert` com o PROS-X, Queueable em concorrência com os parciais, depois o PROS-Y, `pac-update` e máquina | convergência para Y quando o cliente chega primeiro |
| ME (`ORDEM-MESMO-EVENTTIME`) | cliente, contato e endereço com o mesmo `EventTime`, em ordens alternadas | empate de timestamp sem duplicidade nem sobrescrita |

### 2.4 Critérios de sucesso de cada execução

Pela seção 4.6.5 do runbook:

- callback `MicroServicoCliente_ATUALIZAR_CLIENTE=success`;
- Queueable e Future `Completed`, com `NumberOfErrors=0`;
- eventos com HTTP 200 e, quando o log existe, `Status2__c=success`;
- X e Z preservados;
- Account Y e Lead Y no resultado esperado do TC;
- Proponente principal na Account Y, com `IdProponente__c` igual ao PROS-Y;
- Opportunity em Y, na fase esperada;
- PAC no status enviado;
- nenhum log `error` correlacionado ao RUN.

### 2.5 O esperado de cada TC

Cada TC tem o seu "Esperado" nas seções 7 a 10 do runbook. O harness o codifica
em `scripts/runbook/cenarios.ts`, com as verificações de
`scripts/runbook/verificacoes.ts`:

| Verificação | Asserção no harness |
|---|---|
| X e Z preservados | "Account X intacta", "Lead X intacto", "Lead Z intacto", "Account Y2 intacta" |
| Account de Y | "Account aprovada é nova", "Account aprovada é a … (mesmo Salesforce Id)", "Account aprovada com o IdCliente aprovado", "Account aprovada com os contatos da PAC", "Caso C: Account aprovada sem IdProspect" |
| Lead de Y | "Lead novo vinculado, …" (com ou sem e-mail e celular aprovados, origem `InsertClientePAC`), "Lead … reutilizado e vinculado" (CPF preenchido, contatos preservados) |
| Vínculo e duplicidade | "Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c)", "N Lead(s) com o CPF aprovado", "N Account(s) com o CPF aprovado" |
| Comuns | "PAC no status aprovado", "Proponente principal na Account aprovada com PROS-Y", "Opportunity na Account aprovada", "Nenhum job assíncrono com erro na janela do RUN", "Nenhum LogIntegracao__c error correlacionado", "Todos os eventos responderam HTTP 200" |
| Descarte defensivo (PA) | "PA: Account X intacta depois dos parciais", "PA: nenhuma Account/Lead criada pelos parciais" |

## 3. Escopo dos TCs

Dos 70 TCs da planilha:

- **44 executáveis:** 001 a 007, 009 a 027, 038 a 049, 053 a 057 e 062. São
  os que o harness roda.
- **17 bloqueados na planilha:** os do segundo proponente (030 a 037, 051 e
  063), as priorizações de 066 a 070, a alteração cadastral pós-PAC na Venda de
  Unidade (059) e a reemissão de contrato (061).
- **9 `BLOCKED-FUNCIONAL`:** a planilha se contradiz, contraria a regra
  mestra ou depende de uma busca que o Apex não tem, e o runbook os segura até
  PO/QA decidir. O 059 e o 061, bloqueados na planilha, pedem a mesma mutação
  Y→Z do 052, do 058 e do 060:

| TC | Título | O que falta decidir |
|---|---|---|
| 008 | Account Y incompleta e Lead Y livre | premissas e critérios descrevem topologias diferentes; escolher uma |
| 028 | Múltiplas Accounts Y e Lead Y livre | o destino dos IdProspects preexistentes e o `LastModifiedDate` como desempate |
| 029 | Jornada incompleta e troca X para Y | se a Account X é um rascunho descartável da mesma pessoa |
| 050 | Reutilizar Account Y e substituir prospect obsoleto | uma chave de localização suportada; hoje a Account só é achável por e-mail e celular |
| 052 | Proponente sem IdCliente muda de Y para Z | se registros sem IdCliente são descartáveis (mutação Y→Z) |
| 058 | Proponente Y sem IdCliente aprovado como Z | o mesmo conflito do 052 |
| 060 | Alteração cadastral pós-PAC em Venda Genérica | identidade e sistema de origem da alteração depois da PAC |
| 064 | Account com identificador armazenado no campo errado | se existe regra de correção; a regra canônica não autoriza corrigir |
| 065 | IdCliente igual a IdProspect e colisão total | se o TC valida a prevenção, a remediação (`AccountIdProspectSanitizationBatch`) ou as duas |

## 4. Onde a ponta da 2.2 está

### 4.1 O que já foi aprovado

- **Na planilha:** só os TCs 001 a 004 estão como "Passou"; 005 e 006, "Em
  andamento".
- **Pela cadeia real, em agosto:** TC-003 e TC-044 (27/08) e TC-022 e TC-026
  (28/08), em `PASS-COM-LACUNA-DE-LOG` nos perfis PA, CA e ME, com a 2.1 (e a
  1.3, no 044) executadas pelo caminho real. O código era o de agosto, antes
  de boa parte dos commits da 2.2.

### 4.2 O harness

O harness monta a 2.1 e a 1.3 por DML, então dá só `DIAGNOSTICO` do recorte da
2.2, nunca `PASS-CLI`. Na campanha de 11/10 com a ponta da 2.2:

| Perfil | Conformes | Divergências |
|---|---:|---|
| PA | 40 de 44 | K1 (040), K2 (045, 046, 049) |
| CA | 41 de 44 | K2 (045, 046, 049) |
| ME | 40 de 44 | K1 (040), K2 (045, 046, 049) |
| C1 a C4 | 23, 3, 3 e 3 de 44 | B1, B2, B3, B8 |
| AR | 21 de 44 | B3, B4, B5, B8, B9, K2 |
| AM | 16 de 17 | B4 |
| FW | 18 de 44 | B3 a B9, K2 |
| RC, EP e RL | 41 de 44 cada | K2 |

- **Nos perfis obrigatórios, o harness só acusa K1 e K2**, conhecidos desde
  27/09. Frente à planilha, o quadro muda
  ([convergência](convergencia-planilha-runbook-2.2.md), seção 4):
  - o K1 é regra do runbook; a planilha não fala de HTTP nem de descarte;
  - o K2 do 046 é artefato da massa: com o celular B da planilha, o candidato é
    reutilizado. O K2 do 045 e do 049 tem base;
  - **o TC-026 esconde um bug nos perfis obrigatórios (B10):** o Lead Y2
    reutilizado recebe o celular de X, o que a planilha proíbe. O harness não
    confere os contatos do Y2.
- **Os B1 a B9 só aparecem nos perfis acrescentados** (seção 5), que ainda não
  fazem parte do critério formal. B3, B4, B6 e B7 violam a planilha e a regra
  mestra. B1 e B8 que só mudam carimbos em X violam a planilha no 038 e no 040;
  nos 041 a 049, depende de o carimbo contar como alteração de X. O B9 não tem
  base na planilha: no 047 ela não pede preservar os contatos do Lead Y, e no
  055 e no 056 ele vinha de uma massa incoerente do harness.

## 5. Perfis além do runbook

Acrescentados ao harness em 02/10 (C1 a C4), a partir da investigação do bug
4, e em 11/10 (os demais), a partir da ordem real dos eventos ([origem dos eventos](origem-dos-eventos-no-salesforce.md),
seção 7.2). Cada um roda o "Esperado" do TC mais as asserções próprias:

| Perfil | O que reproduz | Asserções próprias |
|---|---|---|
| C1 | PAC em análise sem IdCliente e pendência (o caminho do incidente) | PACs em análise aplicadas ao Proponente, pendência aplicada, X intacta antes da pendência |
| C2 | PAC em análise com o IdCliente de X e o CPF de Y, já visto no TC-002 da skill | as mesmas do C1 |
| C3 | pendência antes da PAC em análise | PACs aplicadas, pendência aplicada |
| C4 | contestação pendente na PAC | PACs aplicadas, contestação pendente antes das PACs em análise |
| AR | aprovação real, pessoa nova: o crédito, o WebJob e o MS Clientes na ordem deles | PACs em análise aplicadas, ou recusadas e reentregues; pendência aplicada; X intacta antes da pendência |
| AM | aprovação real, pessoa que já é cliente | as mesmas do AR |
| FW | falha e repetição do WebJob | as do AR, mais: a repetição não troca o prospect nem cria Account ou Lead |
| RC | relógio do crédito (data sem fuso, contato atrasado) | data da PAC aprovada em UTC, contato atrasado descartado |
| EP | eco do PROS-Y antes do parcial atrasado | o parcial atrasado não troca o prospect nem cria Account ou Lead |
| RL | repostagem em lote dos mesmos eventos | a repostagem não altera nem cria Account ou Lead |

## 6. Decisões pendentes

| # | Decisão | Situação hoje | Recomendação | Quem decide |
|---|---|---|---|---|
| 1 | Os perfis das ordens reais entram no critério? | só PA, CA e ME são obrigatórios, e eles não pegam nenhum B | tornar obrigatórios AR, AM, FW, RC, EP e RL, que são a ordem da produção, e manter C1 a C4 como regressão do bug 4 | time e PO/QA |
| 2 | K1: contato antes do cliente, sem prospect, no TC-040 | o runbook espera descarte com 200; o Apex devolve 400 (`REQUIRED_FIELD_MISSING`). É regra do runbook: a planilha não fala de HTTP | manter a expectativa: a seção 4.2 do runbook exige 200 nos parciais que chegam antes | PO/QA |
| 3 | K2: Lead candidato sem CPF nos TCs 045, 046 e 049 | a planilha manda reutilizar o candidato no 045 (pelo e-mail) e no 049 (e-mail e celular), e o Apex cria um Lead novo. No 046, com a massa da planilha (celular B), o Apex reutiliza | manter a expectativa no 045 e no 049 e tratar como bug; corrigir a massa do 046 | PO/QA |
| 4 | Contatos do Lead Y reutilizado | a planilha manda preservar no 019, no 026, no 048, no 055 e no 056; no 044, o Lead Y já tem os aprovados; no 047, ela não diz nada, e o harness exige preservar | seguir a planilha: preservar onde ela manda e tirar a exigência do 047, ou pedir a PO/QA uma regra única | PO/QA |
| 5 | Os 9 `BLOCKED-FUNCIONAL` | parados até a escolha de topologia ou regra (seção 3) | decidir antes da reescrita: quase todos mexem na regra de identidade, como a mutação Y→Z de registros sem IdCliente (029, 052, 058 e 060), a chave de localização (050) e a correção de identificadores (064 e 065) | PO/QA |
| 6 | Comportamentos que a planilha não cobre | dez commits da 2.2 corrigem algo que nenhum TC exercita ([inventário](inventario-commits-2.2.md), seção 5) | escrever critério e teste para cada um (lista abaixo) | time |
| 7 | Aceite final pela cadeia real | o harness não chama a 2.1 nem a 1.3; o `PASS-CLI` exige as duas | uma rodada pela cadeia real numa amostra de TCs nos perfis obrigatórios, como em agosto | time e PO/QA |
| 8 | Alinhar o harness com a planilha | em 11 TCs ele executa outro cenário ou cobra o que ela não pede, e não confere parte do que ela pede (o TC-026 esconde o B10) | alinhar massa, execução e asserções antes de usar a matriz como aceite ([convergência](convergencia-planilha-runbook-2.2.md), seção 7); os TCs de proponente adicional (053 a 057) ficam fora até o harness saber incluir proponente | time |
| 9 | Versão do runbook | a do projeto pede três perfis; a do `com_salesforce_mrv`, seis, mais dois condicionais | escolher uma; a planilha não trata de ordem de eventos | time e PO/QA |

Os comportamentos da decisão 6, com o cenário de catálogo da API que já os
cobre, quando há:

- jornada sem IdCliente leva a Opportunity de volta para X (`12182e7e78`):
  `e2e-opportunity-permanece-conta-aprovada`;
- jornada obsoleta sem cliente vai para a fila manual (`fbd67a1216`):
  `e2e-evento-obsoleto-sem-cliente-ignorado`;
- PAC com o IdCliente no `idProponente` não acha a Account (`fc7077f94d`): sem
  cenário;
- jornadas antigas com IdCliente obsoleto vão para a fila manual
  (`ec9d1a6a7c`): sem cenário próprio;
- dono, equipe e gerente da Opportunity criada pela jornada (`dea0460ade`): sem
  cenário;
- StageName vazio na Venda Genérica (`9f0ba21f38`):
  `maquina-estado-update-estado-nao-reconhecido`;
- jornada e PAC sem IdCliente e sem CPF (`9210581ea5`) e vínculo histórico da
  Opportunity (`7c86318a05`): passam em parte pelos cenários `e2e-*`; o CPF de
  `proponentecredito` não é exercitado em lugar nenhum;
- repetição de DML em `UNABLE_TO_LOCK_ROW` (`fe1d5a610c` e `72cbd884f6`): sem
  cenário; o lock nunca foi reproduzido.

## 7. Proposta de critério para a reescrita

Depende das decisões da seção 6. Com as recomendações acima, a reescrita está
aceita quando:

1. **Harness, já alinhado com a planilha (decisão 8):** os TCs executáveis
   ficam conformes em PA, CA, ME, AR, AM, FW, RC, EP e RL, e C1 a C4 não acusam
   nenhum B. O `npm run runbook:bugs` não mostra B nem `?`, e K1 e K2 seguem o
   que as decisões 2 e 3 definirem.
2. **Fora da planilha:** cada comportamento da decisão 6 tem teste (Apex ou
   cenário da API) passando.
3. **Cadeia real:** uma amostra de TCs, executada pela 2.1 e pela 1.3 reais nos
   perfis obrigatórios, fica em `PASS-CLI` ou `PASS-COM-LACUNA-DE-LOG`.
4. **Sem regressão:** cada passo da reescrita roda a campanha e compara com a
   anterior, sem nenhum par conforme passando a divergir.

Como medir:

```bash
npm run runbook -- --todos --perfis PA,CA,ME,C1,C2,C3,C4,AR,AM,FW,RC,EP,RL --paralelo 6 --saida campanha.jsonl
npm run runbook:relatorio -- --entrada campanha.jsonl --saida docs/resultado-runbook-....md
npm run runbook:bugs -- --entrada campanha.jsonl --comparar campanha-anterior.jsonl
```
