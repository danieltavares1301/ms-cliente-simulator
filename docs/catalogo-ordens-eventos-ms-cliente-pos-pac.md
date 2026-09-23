# Catálogo de ordens de eventos do MS Cliente no Pós-PAC

> **Origem:** este documento foi consolidado originalmente em
> `com_salesforce_mrv/.github/skills/salesforce-unificacao-clientes/catalogo-ordens-eventos-ms-cliente-pos-pac.md`
> (repositório Salesforce), como contrato funcional para o simulador que hoje
> vive neste repositório. Foi copiado para cá em 2026-09-23 para ficar junto
> do código que ele especifica. A seção 16, ao final, é um adendo exclusivo
> desta cópia: mapeia cada ordem descrita abaixo ao estado real de
> implementação do simulador TypeScript/Next.js.

**Data de consolidação:** 2026-09-12  
**Objetivo:** servir como contrato funcional para um simulador do MS Cliente capaz de reproduzir as ordens, reentregas e corridas observadas na Unificação de Clientes 2.2.  
**Escopo:** eventos `cliente-*`, `contato-*` e `endereco-*` produzidos pelo MS Cliente, combinados com os eventos externos `pac-*` e `jornadausuario-*` que delimitam o Pós-PAC no Salesforce.

## 1. Como ler este catálogo

As sequências estão divididas em três grupos:

1. **Perfis formais:** constam no runbook e possuem alias no executor atual.
2. **Ordens reais complementares:** observadas em staging ou reconstruídas durante a investigação, mas não reproduzidas integralmente pelo executor atual.
3. **Perfis candidatos de robustez:** representam contenção ou janelas operacionais relevantes e devem ser implementados separadamente no simulador.

O simulador não deve considerar apenas o `eventTime`. Para cada evento devem ser controlados independentemente:

- `eventTime`: horário declarado pelo produtor;
- instante de publicação;
- instante de entrega ao Salesforce;
- número da tentativa/reentrega;
- execução sequencial ou concorrente;
- identidade presente no payload naquele instante;
- valores de contato carregados no evento.

## 2. Vocabulário

| Símbolo | Significado |
|---|---|
| `X` | cliente que iniciou a jornada/PAC |
| `Y` | cliente aprovado ou identificado posteriormente |
| `PROS-X` | Id Prospect/Lead associado inicialmente a X |
| `PROS-Y` | Id Prospect/Lead definitivo de Y |
| `IDCLI-X` | identificador do cadastro X no MS Cliente |
| `IDCLI-Y` | identificador do cadastro Y no MS Cliente |
| `C0/D0` | e-mail/celular anteriores ou obsoletos |
| `C/D` | e-mail/celular canônicos aprovados na PAC |
| `PA` | `ORDEM-PARCIAIS-ANTES` |
| `CA` | `ORDEM-CLIENTE-ANTES` |
| `ME` | `ORDEM-MESMO-EVENTTIME` |
| `PM` | `ORDEM-PAC-MUTAVEL` |
| `RE` | `ORDEM-PAC-APROVADA-REENTREGUE` |
| `IM` | `ORDEM-INTERVENCAO-MANUAL-POS-PAC` |
| `CQ` | `ORDEM-CORRIDA-QUEUEABLE-VS-PAC` |
| `IA` | `ORDEM-PARCIAIS-ANTES-IDENTIDADE-ANTIGA` |

## 3. Contrato de transporte

### 3.1 Envelope Event Grid

Todos os eventos publicados pelo simulador devem usar um envelope equivalente a:

```json
[
  {
    "id": "EVENT-ID-UNICO",
    "subject": "MS_Clientes",
    "eventType": "cliente-update",
    "eventTime": "2026-09-12T12:00:00.000Z",
    "dataVersion": "1.0",
    "metadataVersion": "1",
    "topic": "/simulador/unificacao-2.2/RUN-ID",
    "data": {}
  }
]
```

Para uma reentrega real, preserve `id`, `eventType`, `eventTime` e conteúdo. Para uma nova versão lógica do registro, gere novo `id` e avance `dataalteracao`.

### 3.2 Eventos e endpoints Salesforce

| Família | Exemplos | Endpoint |
|---|---|---|
| MS Cliente | `cliente-insert`, `cliente-update`, `contato-insert`, `contato-update`, `endereco-insert`, `endereco-update` | `/services/apexrest/Cliente` |
| MS ProponenteCredito | `pac-insert`, `pac-update` | `/services/apexrest/PAC` |
| Jornada/Event Grid | `jornadausuario-insert`, `jornadausuario-update` | `/services/apexrest/MaquinaEstado` |

O túnel usado pelo executor existente não transporta esses eventos de entrada. Ele serve somente para o callback de saída do Salesforce ao mock GraphQL do MS Cliente. Um simulador novo pode publicar no Event Grid real ou chamar os endpoints Apex REST diretamente com autenticação apropriada.

### 3.3 Campos de identidade mínimos

| Evento | Campos relevantes |
|---|---|
| `cliente-*` | `idcliente`, `idprospectsalesforce`, `numerocpf`, `nomecompleto`, `dataalteracao` |
| `contato-*` | `idcliente`, `idprospectsalesforce`, `tipocontato`, `descricao`, `dataalteracao` |
| `endereco-*` | `idcliente`, `idprospectsalesforce`, tipo/endereço, `dataalteracao` |
| `pac-*` | `idJornadaPac`, `status`, `dataAlteracao`, `proponentes[].idCliente`, `proponentes[].idProponente`, CPF e contatos |
| `jornadausuario-*` | `Cliente.idCliente`, `Cliente.IdProspectSalesforce`, Proponentes e dados da Opportunity |

## 4. Resumo das ordens

| ID | Ordem | Estado | Reprodução atual |
|---|---|---|---|
| O01 | Parciais antes | Formal | Executor `PA` |
| O02 | Cliente antes | Formal | Executor `CA` |
| O03 | Mesmo `eventTime` | Formal | Executor `ME` |
| O04 | PAC mutável | Formal | Executor `PM` |
| O05 | PAC aprovada reentregue | Formal | Executor `RE`, com gap físico reduzido |
| O06 | Intervenção manual Pós-PAC | Formal | Executor `IM`, reprodução parcial |
| O07 | Corrida Queueable versus PAC | Formal | Executor `CQ`, concorrência aproximada |
| O08 | Parciais com identidade antiga | Formal | Executor `IA` |
| O09 | Ordem composta Clarice | Real complementar | Não reproduzida integralmente |
| O10 | Rajada concorrente Cliente/PAC | Stress técnico | Script separado `.tmp_repro_concorrente.py` |
| O11 | Jornada sem `idCliente` antes do carimbo | Real complementar | Não implementada no executor principal |
| O12 | Contenção da Account Y logo após insert | Perfil candidato | Não implementada no executor principal |
| O13 | Evento tardio do MS Cliente após PAC aprovada | Perfil de robustez | Combinação manual |
| O14 | Reentrega genérica do mesmo evento | Perfil de idempotência | Combinação manual |
| O15 | Ordem temporal invertida por fuso | Perfil de relógio | Combinação manual |

## 5. Perfis formais

### O01 — Parciais antes (`PA`)

```text
pac-insert
→ contato-insert/update(PROS-X)
→ contato-insert/update(PROS-X)
→ endereco-insert/update(PROS-X)
→ cliente-insert/update(PROS-X)
→ Queueable/callback
→ cliente-update(PROS-Y)
→ pac-update aprovado
→ jornadausuario-update
```

**Identidade dos parciais:** normalmente `IDCLI-Y + PROS-X`.  
**Objetivo:** validar que contato/endereço de Y chegando antes da criação/vinculação de Y não altera X.  
**Asserts:** zero DML indevido em X; Y criada/reutilizada corretamente; vínculo e contatos finais convergentes.

### O02 — Cliente antes (`CA`)

```text
pac-insert
→ cliente-insert/update(PROS-X)
→ [Queueable em execução]
→ contato-insert/update(PROS-X)
→ contato-insert/update(PROS-X)
→ endereco-insert/update(PROS-X)
→ cliente-update(PROS-Y)
→ pac-update aprovado
→ jornadausuario-update
```

**Objetivo:** exercitar parciais que chegam durante ou logo após o processamento assíncrono iniciado pelo evento de cliente.  
**Controle de timing:** permitir atraso configurável entre `cliente-*` e cada parcial, inclusive zero.

### O03 — Mesmo `eventTime` (`ME`)

```text
pac-insert
→ cliente-* ─────────────── eventTime=T
→ contato-* Email ───────── eventTime=T
→ contato-* Celular ─────── eventTime=T
→ endereco-* ────────────── eventTime=T
→ cliente-update(PROS-Y)
→ pac-update aprovado
→ jornadausuario-update
```

Execute também permutações da ordem física, preservando o mesmo `eventTime`:

```text
cliente → contato-email → contato-celular → endereço
contato-email → cliente → endereço → contato-celular
endereço → contato-celular → cliente → contato-email
```

**Objetivo:** provar que empate temporal não depende de `CreatedDate` nem da ordem de entrega.

### O04 — PAC mutável (`PM`)

```text
pac-insert/update inicial com C0/D0
→ contato-* do MS Cliente com C0/D0
→ cliente-* e processamento de vínculo
→ pac-update CREDITO_APROVADO_CONDICIONADO com C/D
→ cliente-update(PROS-Y)
→ jornadausuario-update
```

**Objetivo:** garantir que os contatos aprovados mais recentes prevaleçam sobre os valores anteriores do MS Cliente.  
**Variação obrigatória:** `C0/D0 != C/D`. Em MATCH puro, registrar que o perfil degenerou por dados idênticos.

### O05 — PAC aprovada reentregue (`RE`)

```text
pac-update EM_ANALISE_CREDITO sem idCliente, com C/D
→ pac-update CREDITO_APROVADO_CONDICIONADO com C/D
→ gap real configurável (referência observada: >= 30 min; houve casos de ~3 h)
→ cliente-insert(PROS-X), sem contatos
→ contato-insert Email/Celular divergentes de C/D
→ pac-update EM_ANALISE_CREDITO reentregue, sem idCliente
→ cliente-update(PROS-X)
→ pac-update aprovado reentregue
→ cliente-update(PROS-Y)
→ jornadausuario-update
```

**Reentrega:** quando a intenção for simular at-least-once, reutilize o mesmo envelope. Quando os contatos/status mudarem, publique nova versão lógica.  
**Limite do executor atual:** usa diferença de timestamps e espera física curta; não mantém necessariamente o gap real de 30 minutos ou horas.

### O06 — Intervenção manual Pós-PAC (`IM`)

```text
pac-update aprovado com C/D
→ [MANUAL] criar Account Y com IdProspectSalesforce provisório
→ cliente-insert(PROS-X)
→ contato-insert Email/Celular divergentes de C/D
→ [MANUAL] limpar IdProspectSalesforce da Account Y
→ pac-update reentregue
→ cliente-update(PROS-X)
→ cliente-update(PROS-Y)
→ jornadausuario-update
```

**Responsabilidade do simulador:** emitir os eventos e expor hooks para o orquestrador executar as duas ações humanas.  
**Limite do executor atual:** a massa pode ser preparada como fixture e apenas a limpeza é simulada durante o RUN; isso não equivale integralmente à cronologia humana real.

### O07 — Corrida Queueable versus PAC (`CQ`)

```text
contato-insert(PROS-X) com C0/D0 divergentes de C/D
→ cliente-insert(PROS-X)
→ cliente-update(PROS-Y) ─┐
                          ├─ disparo concorrente, janela alvo <= 5 s
→ pac-update aprovado ────┘
→ aguardar Queueables POS_VINCULO e POS_PAC_APROVADA
→ jornadausuario-update
```

**Objetivo:** fazer o `insertLeadQueueable` e a projeção da PAC competirem pela mesma Account/Lead.  
**Implementação recomendada no simulador:** conexões HTTP e contextos de autenticação independentes; não reutilizar uma única sessão serializada. Registrar timestamps de envio, aceite HTTP, início e fim observados no Salesforce.  
**Limite conhecido:** liberar duas threads simultaneamente não garante concorrência interna no Salesforce.

**Duas variantes obrigatórias:**

```text
CQ-X: cliente-update(PROS-X) || pac-update aprovado
CQ-Y: cliente-update(PROS-Y) || pac-update aprovado
```

`CQ-X` corresponde à identidade de retorno observada no caso real. `CQ-Y` corresponde ao comportamento atual do executor Python depois que ele aguarda a criação do Lead Y. O simulador deve manter as duas variantes separadas.

### O08 — Parciais com identidade antiga (`IA`)

```text
contato-insert(idcliente=IDCLI-X, PROS-X, email=C)
→ contato-insert(idcliente=IDCLI-X, PROS-X, celular=D)
→ endereco-insert(idcliente=IDCLI-X, PROS-X)
→ cliente-insert(idcliente=IDCLI-Y, PROS-X)
→ Queueable/callback
→ cliente-update(idcliente=IDCLI-Y, PROS-Y)
→ pac-update aprovado
→ jornadausuario-update
```

**Característica central:** os parciais carregam identidade antiga válida de X, mas dados novos de Y.  
**Não substituir por payload sem identidade:** `contato-*` sem `idcliente` foi uma hipótese descartada; o vetor real observado usa `IDCLI-X`.  
**Asserts:** todos os campos funcionais e timestamps de X permanecem invariantes; Y recebe C/D.

## 6. Ordens reais complementares

### O09 — Ordem composta Clarice

Esta é a cronologia completa reconstruída do caso de staging de 2026-09-02. Ela combina intervenção humana, contato obsoleto, PAC aprovada e Queueable em janela intermediária:

```text
[MANUAL] Account Y criada com PROS provisório
→ contato-insert Email/Celular C0/D0
→ [MANUAL] Admin limpa IdProspectSalesforce
→ pac-update CREDITO_APROVADO_CONDICIONADO com C/D
→ projeção inicial observada na Account
→ cliente-update(PROS-X) dispara insertLeadQueueable
→ Queueable lê estado ainda divergente e cria Lead com D0
→ nova etapa/entrega associada à PAC conclui Account com C/D
→ reconciliação POS_PAC_APROVADA executa em outra transação
→ jornadausuario-update
```

**Resultado esperado:** Account e Lead terminam com C/D; a origem `POS_PAC_APROVADA` deve sobreviver à fronteira assíncrona e permitir sobrescrever divergências no Lead.

**Estado de reprodução:** nenhum perfil atual reproduz a cadeia inteira. `IM` cobre as ações humanas e `CQ` cobre a competição, mas a ordem relativa é diferente.

**Cuidado de modelagem:** não assumir que uma única transação Apex torna e-mail visível antes do celular. Para o simulador, modele a janela como duas entregas/transações independentes até que logs de transação comprovem outra origem.

### O10 — Rajada concorrente Cliente/PAC

```text
pac-insert prepara Opportunity/PAC/Proponente
→ barreira de concorrência
→ 6 × cliente-update ─┐
                      ├─ 12 requisições simultâneas sobre a mesma cadeia
→ 6 × pac-update ─────┘
→ aguardar Queueables
→ consultar DmlException/UNABLE_TO_LOCK_ROW e estado final
```

**Objetivo:** stress de lock sobre Account, Opportunity e Proponente; não representa uma ordem funcional canônica.  
**Artefato existente:** `.tmp_repro_concorrente.py`.  
**Recomendação:** parametrizar quantidade, intervalo aleatório, reutilização do mesmo `eventTime`, chaves de idempotência e percentual de reentrega.

### O11 — Jornada sem `idCliente` antes do carimbo

```text
jornadausuario-insert/update(Cliente.idCliente=null, PROS válido)
→ possíveis reentregas ainda sem idCliente
→ MS Cliente conclui/carimba IDCLI-Y
→ jornadausuario-update(Cliente.idCliente=IDCLI-Y, mesmo PROS)
```

**Padrão observado:** 21 tentativas com `idCliente=null` foram para erro/fila manual; a entrega posterior com `idCliente` preenchido teve sucesso.  
**Responsabilidade do simulador:** controlar o momento em que o identificador passa de `null` para preenchido e permitir reentregas antes/depois dessa transição.  
**Nota:** `jornadausuario-*` é entregue pelo Event Grid ao `/MaquinaEstado`; o simulador do MS Cliente deve expor esse estado ao orquestrador, mesmo que não seja o produtor direto do evento.

## 7. Perfil candidato de contenção

### O12 — Contenção da Account Y logo após insert

```text
cliente-insert(idcliente=IDCLI-Y, PROS-X)
→ Account Y criada
→ [CONCORRENTE] automações/integrações mantêm lock em Account Y
→ insertLeadQueueable cria Lead Y
→ insertLeadQueueable tenta vincular Account Y
→ UNABLE_TO_LOCK_ROW
→ retry controlado
→ vínculo Account Y ↔ Lead Y concluído
```

**Objetivo:** provar que contenção transitória não apaga o Lead Y pelo rollback do savepoint.  
**Estado:** documentado como proposta `ORDEM-CONTENCAO-ACCOUNT-Y-POS-INSERT`, ainda sem alias no executor principal.  
**Implementação recomendada:** um worker independente deve obter lock/atualizar Account Y durante a execução do Queueable. Apenas requisições HTTP paralelas sem lock controlado podem não reproduzir o erro.

## 8. Perfis temporais e de idempotência

### O13 — Evento tardio do MS Cliente após PAC aprovada

```text
pac-update aprovado com C/D
→ Account e Lead convergem para C/D
→ [ATRASO] contato-update ou cliente-update com C0/D0
→ jornadausuario-update
```

Execute duas variantes:

1. `dataalteracao` do evento tardio é anterior à PAC: C0/D0 deve ser rejeitado.
2. `dataalteracao` do evento tardio é realmente posterior à PAC: aplicar a regra de negócio vigente para contato mais novo, sem usar apenas a ordem de chegada.

**Objetivo:** separar evento atrasado de atualização legítima. A chegada depois da PAC não significa automaticamente que o dado é mais novo.

### O14 — Reentrega genérica do mesmo evento

```text
evento E entregue e processado com sucesso
→ gap configurável
→ evento E reentregue com o mesmo id, eventTime e payload
→ opcionalmente repetir N vezes
```

Aplicar a `cliente-*`, `contato-*`, `endereco-*`, `pac-*` e `jornadausuario-*`.  
**Objetivo:** validar a semântica at-least-once do Event Grid e a idempotência de cada handler.  
**Assert:** nenhuma duplicidade, nenhum vínculo novo e nenhuma regressão de contato; logs podem registrar a reentrega, mas o estado funcional deve permanecer estável.

### O15 — Ordem temporal invertida por fuso

```text
contato-insert C0/D0 com timestamp UTC e sufixo Z
→ pac-update aprovado C/D emitido depois em horário real
→ dataAlteracao da PAC chega em BRT sem offset
→ parser interpreta a PAC como aproximadamente 3 h mais antiga
→ regra temporal pode escolher incorretamente C0/D0
```

Execute em pares:

```text
PAC_CORRETA: dataAlteracao=UTC com Z
PAC_SEM_OFFSET: mesmo instante real convertido para BRT, sem Z
```

**Objetivo:** garantir que o simulador consiga reproduzir a inversão de precedência entre fontes e verificar a normalização de timestamps sem offset. Isso é uma ordem lógica, não uma mudança na ordem física das requisições.

## 9. Variações combinatórias do simulador

Além da ordem-base, cada perfil deve aceitar estas dimensões:

| Dimensão | Valores sugeridos |
|---|---|
| Identidade nos parciais | `IDCLI-Y/PROS-Y`, `IDCLI-Y/PROS-X`, `IDCLI-X/PROS-X` |
| CPF | ausente, CPF-X, CPF-Y |
| Contatos | iguais à PAC, divergentes, nulos, parcialmente preenchidos |
| `eventTime` | crescente, igual, atrasado, futuro, BRT sem offset, UTC com `Z` |
| Entrega | sequencial, paralela, duplicada, atrasada, reentregue |
| Gap | 0 s, sub-segundo, 3–5 s, 30 min lógico, 3 h lógico |
| Estado da Account Y | inexistente, existente sem Lead, com Lead órfão, vínculo provisório, vínculo limpo manualmente |
| Estado da PAC | análise, aprovada, aprovada reentregue, contatos alterados entre versões |
| Resultado HTTP | sucesso, timeout ambíguo, erro transitório, reenvio após timeout |

Não combine todas as dimensões em uma única bateria cartesiana. Use pares direcionados por risco e preserve um `RUN-ID` único por cadeia.

## 10. Requisitos do simulador

### 10.1 Orquestração

- Publicar eventos individualmente e em lote.
- Separar `eventTime` do horário de envio.
- Agendar delays reais ou relógio lógico acelerado.
- Reenviar exatamente o mesmo envelope.
- Gerar nova versão lógica com novo ID.
- Disparar eventos concorrentes com conexões independentes.
- Pausar em checkpoints para intervenção humana/API administrativa.
- Receber o `PROS-Y` retornado pelo callback e usá-lo nos eventos seguintes.

### 10.2 Observabilidade

Registrar por evento:

- `RUN-ID`, perfil e passo;
- hash SHA-256 do payload;
- `event.id`, `eventType` e `eventTime`;
- horário de envio e resposta;
- tentativa/reentrega;
- status HTTP e corpo sanitizado;
- IDs Salesforce correlacionados;
- estado da Account, Lead, Proponente, PAC e Opportunity nos checkpoints;
- `AsyncApexJob` e `LogIntegracao__c` correlacionados.

### 10.3 Segurança operacional

- Nunca executar massa sintética em produção.
- Não apontar a Named Credential compartilhada para dois mocks simultâneos.
- Restaurar endpoint e processos temporários em `finally`.
- Usar CPFs, e-mails e celulares sintéticos.
- Não limpar dados por CPF/e-mail isolados; usar allowlist de IDs criados pelo RUN.
- Interromper a cadeia no primeiro erro funcional e preservar evidências antes da limpeza.

## 11. Critérios de aceitação comuns

1. X permanece intacto quando a identidade final pertence a Y.
2. Existe no máximo uma Account e um Lead para cada identidade esperada.
3. `Account.IdProspectSalesforce__c` aponta para o Lead correto.
4. Account, Lead e Proponente Principal convergem para os contatos canônicos esperados.
5. PAC e Opportunity permanecem vinculadas à Account correta.
6. Reentregas são idempotentes.
7. Eventos antigos não sobrescrevem dados mais novos sem regra explícita.
8. Timeout ambíguo é reconciliado antes de qualquer reenvio.
9. `UNABLE_TO_LOCK_ROW` transitório não deixa Lead/Account em estado parcial.
10. Todos os jobs assíncronos terminam ou geram evidência operacional acionável.

## 12. Divergências entre runbook e executor existente

O simulador novo deve seguir a intenção funcional deste catálogo, sem copiar silenciosamente estas simplificações do executor atual:

| Perfil | Runbook/caso real | Executor atual | Decisão para o simulador |
|---|---|---|---|
| `RE` | `EM_ANALISE_CREDITO`, Principal sem `idCliente`, gap mínimo de 30 min | `pac_payload(final=False)` gera `ANALISE_NAO_INICIADA`; na maioria dos TCs mantém `IDCLI-X`; espera física curta | suportar status, identidade e gap reais; permitir relógio acelerado sem alterar timestamps |
| `IM` | criação humana da Account e limpeza posterior durante a cadeia | Account pode nascer na fixture; apenas a limpeza ocorre durante o RUN | expor dois checkpoints administrativos independentes |
| `CQ` | retorno `cliente-update(PROS-X)` entra na janela da PAC | executor aguarda Lead Y e dispara `cliente-update(PROS-Y)` | implementar `CQ-X` e `CQ-Y` |
| Concorrência | transações realmente sobrepostas | duas threads podem ser serializadas pela mesma sessão Salesforce | usar conexões/contextos independentes e confirmar sobreposição por logs |

## 13. Perfis que não devem ser tratados como ordens válidas

| Nome/experimento | Motivo |
|---|---|
| `ORDEM-PARCIAIS-ANTES-SEM-IDCLIENTE` / `SI` | hipótese descartada; o vetor real usa identidade antiga `IDCLI-X` e virou `IA` |
| Trigger de latência `TEMP DEVDAN` | tentativa artificial que não reproduziu B5-C e foi revertida |
| Pré-população artificial da Account no `CQ` | alterou a semântica do match e produziu falha diferente |
| Apenas alterar `eventTime` sem mudar ordem física | não reproduz concorrência nem reentrega real |

## 14. Fontes

- Runbook de testes manuais (repositório Salesforce)
- Guia do executor automatizado (repositório Salesforce)
- Descrição funcional dos contatos da PAC vigente (repositório Salesforce)
- Análise de cenários afetados pelo B5-C (repositório Salesforce)
- Plano do `jornadausuario-*` sem `idCliente` (repositório Salesforce)
- Plano do `UNABLE_TO_LOCK_ROW` no `insertLeadQueueable` (repositório Salesforce)
- Executor atual: `.tmp_unif22_campaign.py` (repositório Salesforce)
- Stress concorrente: `.tmp_repro_concorrente.py` (repositório Salesforce)

## 15. Pendências de implementação do simulador

1. Implementar O01–O08 como presets estáveis.
2. Implementar O09 como cenário composto com checkpoints externos e duas transações independentes para a janela PAC/Queueable.
3. Incorporar O10 como modo de stress, separado dos testes funcionais.
4. Implementar O11 com transição explícita `idCliente=null → IDCLI-Y`.
5. Implementar O12 com mecanismo real de contenção/lock, não apenas chamadas simultâneas.
6. Implementar O13–O15 como presets combináveis de atraso, idempotência e relógio.
7. Atualizar o guia do executor existente, que ainda descreve somente PA/CA/ME e 132 RUNs.

## 16. Estado real de implementação no simulador TypeScript (auditoria 2026-09-23)

Esta seção não faz parte do documento original. Foi adicionada ao copiá-lo para
este repositório, para responder objetivamente: **as ordens deste catálogo
foram mapeadas durante o desenvolvimento? É possível executar todas elas com o
simulador hoje?**

**Atualização (2026-09-23, Tarefa 8.4):** `O04`, `O11` e `O13` foram
implementados e validados ao vivo contra `mrv-devDan` — ver
[`docs/phase-8/tarefa-8-4-o04-o11-o13.md`](phase-8/tarefa-8-4-o04-o11-o13.md).

**Resposta curta: não, nem todas — mas a maioria já está.** Onze ordens
(O01–O08, O11, O12, O14) estão solidamente implementadas e validadas ao vivo
contra `mrv-devDan`. O10 existe como ferramenta de stress separada, assim
como O06, O07 e O12. O13 foi implementada e validada ao vivo, mas via um
mecanismo real diferente do hipotetizado originalmente (ver seção da própria
ordem). Apenas O09 ainda não tem cenário correspondente (depende de compor
O06+O07, ambos já concluídos). O15 está bloqueado por uma decisão de
contrato compartilhado (ver tabela abaixo).

| ID | Estado no simulador | Evidência |
|---|---|---|
| O01 — Parciais antes | ✅ Implementado | `cpf-divergente-contato-primeiro` (tag `o01`); ver [`docs/phase-6/o01-cpf-divergente-contato-primeiro.md`](phase-6/o01-cpf-divergente-contato-primeiro.md) |
| O02 — Cliente antes | ✅ Implementado | `contato-antes-cliente-colisao` (tag `o02`); ver [`docs/phase-6/contato-antes-cliente-colisao.md`](phase-6/contato-antes-cliente-colisao.md) |
| O03 — Mesmo `eventTime` | ✅ Implementado, 3 permutações físicas | `ordem-mesmo-eventtime-cliente-primeiro`, `-contato-primeiro`, `-endereco-primeiro` (tag `o03`); ver [`docs/phase-6/o03-mesmo-eventtime.md`](phase-6/o03-mesmo-eventtime.md) |
| O04 — PAC mutável | ✅ Implementado e validado ao vivo (2026-09-23) | `pac-aprovada-sobrescreve-contato-anterior`. Achado real: a sincronização PAC → Account é incondicional — não há comparação de data cross-objeto contra o histórico de contato do MS Cliente. Ver [`docs/phase-8/tarefa-8-4-o04-o11-o13.md`](phase-8/tarefa-8-4-o04-o11-o13.md). |
| O05 — PAC aprovada reentregue | ✅ Implementado e validado ao vivo (2026-09-23), cronologia redesenhada | `pac-aprovada-reentregue-restaura-contato-regredido`. Achado real: a premissa original do catálogo ("PAC antes de Cliente") é fisicamente impossível — `/PAC` rejeita com HTTP 400 quando a Opportunity referenciada não existe. Redesenhado para provar que a reentrega da PAC aprovada cura uma regressão de contato causada por um `contato-insert` independente do MS Cliente. Ver [`docs/phase-8/tarefa-8-4-o05.md`](phase-8/tarefa-8-4-o05.md). |
| O06 — Intervenção manual Pós-PAC | ✅ Implementado e validado ao vivo (2026-09-23), script standalone aprovado explicitamente | `scripts/manual-intervention-o06.ts`. Decisão de arquitetura discutida e aprovada: script fora do motor declarativo (Opção B), não checkpoint no motor (Opção A) — mesmo precedente do O10/O12. Achado real: após limpar manualmente o prospect provisório de uma Account e enviar um `cliente-update` comum, o Apex atribui um novo GUID de prospect automaticamente (auto-cura de identidade). Ver [`docs/phase-8/tarefa-8-4-o06.md`](phase-8/tarefa-8-4-o06.md). |
| O07 — Corrida Queueable vs PAC | ✅ Implementado e validado ao vivo (2026-09-23), CQ-X e CQ-Y | `scripts/stress-o07-corrida-queueable-vs-pac.ts`. Limite real confirmado ao vivo: `sf org display` sempre retorna o mesmo token de sessão em cache — contextos de autenticação genuinamente independentes exigiriam uma Connected App dedicada (fora do escopo). Achados reais: `cliente-update`/`pac-update` não disputam os mesmos campos (PAC sempre "vence" o contato); tentativa de troca de prospect no CQ-Y foi corretamente bloqueada. Ver [`docs/phase-8/tarefa-8-4-o07.md`](phase-8/tarefa-8-4-o07.md). |
| O08 — Parciais identidade antiga | ✅ Implementado, com reteste PAC | `cpf-divergente-identidade-antiga` (tag `o08`); reteste com PAC aprovada em `cpf-divergente-identidade-antiga-pac-aprovada` e no cross-endpoint `e2e-opportunity-permanece-conta-aprovada`. Ver [`docs/phase-6/o08-cpf-divergente-identidade-antiga.md`](phase-6/o08-cpf-divergente-identidade-antiga.md) e [`docs/phase-7/o08-retest-pac-aprovada.md`](phase-7/o08-retest-pac-aprovada.md). |
| O09 — Ordem composta Clarice | ❌ Não implementado | Nenhuma combinação reproduz a cadeia inteira; o próprio catálogo original já não esperava isso de nenhum perfil formal isolado. Depende de O06 + O07. |
| O10 — Rajada concorrente | ✅ Implementado, fora da API de cenários | `scripts/stress-o10-concurrent-events.ts` (standalone, Node/TS), não é um cenário do catálogo `/scenarios`. Ver [`docs/phase-6/o10-stress-concorrencia.md`](phase-6/o10-stress-concorrencia.md). |
| O11 — Jornada sem `idCliente` antes do carimbo | ✅ Implementado e validado ao vivo (2026-09-23) | `e2e-evento-atual-reentregue-com-idcliente-preenchido`, complementando a reentrega já coberta. Achado real: não há lógica de "transição" especial no Apex; o match por `Id__c` funciona porque a query já usa `OR` entre `Id__c`/`IdProspectSalesforce__c`. Ver [`docs/phase-8/tarefa-8-4-o04-o11-o13.md`](phase-8/tarefa-8-4-o04-o11-o13.md). |
| O12 — Contenção da Account Y | ✅ Implementado e validado ao vivo (2026-09-23), concorrência 12 e 30 | `scripts/stress-o12-contencao-account-y.ts`. Achados reais: (1) `cliente-insert` isolado não cria Lead — exige o padrão "prospect divergente" já usado por O01/O02/O08; (2) `UNABLE_TO_LOCK_ROW` não apareceu em nenhuma execução (mesmo limite já observado no O10), mas o Lead foi sempre criado e vinculado corretamente mesmo sob carga concorrente pesada; (3) bug real corrigido no caminho: importar funções do script principal do O10 disparava uma execução real completa dele como efeito colateral. Ver [`docs/phase-8/tarefa-8-4-o12.md`](phase-8/tarefa-8-4-o12.md). |
| O13 — Evento tardio pós-PAC aprovada | ✅ Implementado e validado ao vivo (2026-09-23) | `pac-aprovada-evento-tardio-anterior-rejeitado` e `pac-aprovada-evento-tardio-posterior-regride-contato`. Achado real: o mecanismo é diferente do hipotetizado (obsolescência avaliada inteiramente dentro do `/Cliente`, sem qualquer conhecimento da PAC), mas a mesma classe de risco foi reproduzida — um evento tardio genuinamente mais novo regride um contato já aprovado pela PAC. Ver [`docs/phase-8/tarefa-8-4-o04-o11-o13.md`](phase-8/tarefa-8-4-o04-o11-o13.md). |
| O14 — Reentrega genérica | ✅ Implementado | `evento-duplicado` (tag `o14`), `maquina-estado-update-reentrega-mesmo-evento` e o cross-endpoint `e2e-evento-atual-reentregue-apos-cliente-insert`. Ver [`docs/phase-6/o14-evento-duplicado-e-obsoleto.md`](phase-6/o14-evento-duplicado-e-obsoleto.md). |
| O15 — Ordem temporal invertida por fuso | ❌ Bloqueado por contrato compartilhado | `apexCompatibleUtcDateTimeSchema` (`src/contracts/event-grid.ts`) exige que o timestamp termine em `Z`, impedindo o envio do payload "BRT sem offset" necessário — mesmo já confirmado, lendo `EventGrid.parseDateTime`/`TV_Utils.parseToDateMillis`, que o Apex real aceitaria e interpretaria esse payload incorretamente como GMT. Requer decisão: afrouxar o schema compartilhado (risco: afeta os 44 cenários do catálogo) ou criar um modo de payload literal/raw dedicado a este teste. |

### Notas sobre a lacuna de concorrência real (O07, O09, O12)

O simulador modela ordem e reentrega com precisão (`eventTime` lógico
separado do instante de dispatch físico, `delayMs` configurável, reentrega
por reenvio do mesmo envelope), mas **não modela concorrência HTTP real**
dentro do catálogo de cenários orientado por `steps`/`delayMs` — esse array é
sempre sequencial-com-atraso, nunca dois disparos verdadeiramente paralelos.
A única exceção é o script de stress do O10
(`scripts/stress-o10-concurrent-events.ts`), construído especificamente para
gerar concorrência real via conexões HTTP independentes, mas ele testa
contenção de lock (`UNABLE_TO_LOCK_ROW`), não a corrida de identidade que O07,
O09 e O12 descrevem. Implementar essas três ordens exigiria estender o motor
de dispatch para aceitar steps com `delayMs` idêntico e disparo
verdadeiramente paralelo (múltiplas conexões/contextos), hoje ausente.
