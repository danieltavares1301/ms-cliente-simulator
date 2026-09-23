# Tarefa 8.4 — O04, O11 e O13 implementados e validados ao vivo

## Escopo deste incremento

Primeira leva da Tarefa 8.4 (reproduzir integralmente o catálogo de ordens de
eventos O01-O15): implementa e valida ao vivo contra `mrv-devDan` os perfis
**O04** (PAC mutável), **O11** (variante da transição `idCliente`) e **O13**
(evento tardio pós-PAC aprovada, 2 variantes). `O06`, `O07`, `O09`, `O12` e
`O15` permanecem pendentes — ver seção final.

## Achado de contrato corrigido antes da implementação

Ao tentar usar `contato-update` como `eventType` de um step (necessário para
O13), a fixture falhava validação com `invalid_union` em `steps[2].eventType`.
Causa raiz: `renderedFixtureStepSchema` em `src/contracts/fixtures.ts` definia
um enum de `eventType` para steps `CLIENTE` mais estreito
(`cliente-insert`/`cliente-update`/`contato-insert`/`endereco-insert`) do que
o `eventTypeSchema` geral em `event-grid.ts` (que já suportava os 6 tipos
desde a Fase 5). Isso significa que **nenhum cenário do catálogo jamais usou
`contato-update`/`endereco-update` como `eventType` de step antes desta
tarefa** — não por decisão de design, mas por uma lacuna de schema nunca
exercitada. Corrigido adicionando `contato-update`/`endereco-update` ao enum
de `renderedFixtureStepSchema`, alinhando com `event-grid.ts`.

## O04 — PAC aprovada sobrescreve contato anterior do MS Cliente

**Cenário:** `pac-aprovada-sobrescreve-contato-anterior`

Sequência: `contato-insert` (Email C0) → `contato-insert` (Celular D0) →
`pac-insert` aprovado com Proponente principal carregando C/D e uma
`dataAlteracao` (tanto no nível da PAC quanto do Proponente) **cronologicamente
mais antiga** que os dois eventos de contato anteriores.

**Resultado real observado em `mrv-devDan`:** a Account convergiu para os
contatos da PAC (`PersonEmail = cliente.<seed>@simulador.mrv.invalid`, o valor
C/D), **mesmo com a PAC sendo cronologicamente mais antiga**. Isso confirma
uma investigação de código prévia (nenhuma classe/trigger de PAC/Proponente
compara a `dataAlteracao` recebida contra `Account.DataAlteracaoEventoContato
Email__c`/`Celular__c` antes de sobrescrever — esses campos são gravados e
lidos exclusivamente por `NotificacaoCliente.cls`). A sincronização PAC →
Account é **incondicional**, não "o mais recente vence" como o catálogo
original supunha.

## O11 — variante com `idCliente` explicitamente preenchido

**Cenário:** `e2e-evento-atual-reentregue-com-idcliente-preenchido`

Complementa `e2e-evento-atual-reentregue-apos-cliente-insert` (que mantém
`idCliente = null` na reentrega). Esta variante reenvia o mesmo `envelopeId`
de `jornadausuario-insert`, mas com `Cliente.idCliente` explicitamente
preenchido (`IDCLI-Y`) na segunda tentativa, testando o caminho de match
direto por `Id__c` em vez de match só por prospect
(`ClienteSelector.obterMapMultiplasChavesECliente`, que casa por `Id__c OR
IdProspectSalesforce__c`).

**Resultado real observado:** a reentrega com `idCliente` preenchido também
teve sucesso — a Opportunity foi criada e vinculada à Account correta, com
`IdProspectSalesforce__c` carimbado. Não há uma lógica de "transição" especial
no Apex (`NotificacaoMaquinaEstado.cls`); o match por `Id__c` funciona porque
o `OR` na query já cobre esse caso desde que a Account exista.

## O13 — evento tardio pós-PAC aprovada (2 variantes)

**Cenários:** `pac-aprovada-evento-tardio-anterior-rejeitado` e
`pac-aprovada-evento-tardio-posterior-regride-contato`

Ambos partem da mesma base: `contato-insert` (Email C0) → `pac-insert`
aprovado (Account sincroniza para C/D) → um `contato-update` tardio
(dataalteracao anterior ao watermark na variante 1; genuinamente posterior na
variante 2).

**Resultado real observado:**

- **Variante 1 (anterior):** o evento tardio foi corretamente **rejeitado**
  pela regra de obsolescência de `NotificacaoCliente.cls` (`<=` descarta). A
  Account permaneceu com o e-mail da PAC (C/D).
- **Variante 2 (posterior):** o evento tardio foi **aceito** e **regrediu** o
  e-mail da Account de volta para o valor antigo do MS Cliente (C0),
  desfazendo a sincronização da PAC aprovada.

**Achado real, distinto da hipótese original do catálogo:** o mecanismo não é
o mesmo hipotetizado (contato-insert vs pac-update cross-endpoint direto).
Investigação de código confirmou que a regra de obsolescência do `/Cliente`
(`NotificacaoCliente.cls:96-105`) compara a `dataalteracao` recebida **apenas**
contra o histórico de eventos `contato-*` da própria Account
(`DataAlteracaoEventoContatoEmail__c`/`Celular__c`) — nunca contra o fato de a
PAC ter sido aprovada, porque a sincronização PAC → Account (confirmada em
`pac-aprovada-sincroniza-contatos`, Fase 7) não atualiza esses campos de
watermark. Ou seja: **qualquer evento `contato-update` genuinamente mais novo
que o último `contato-*` conhecido pode reverter silenciosamente uma
sincronização de PAC aprovada**, independentemente de quando a PAC foi
processada. Essa é a mesma classe de risco descrita no catálogo original
("evento tardio pode reverter um estado aprovado"), mas via um mecanismo real
diferente do hipotetizado — exatamente o cenário previsto pelo princípio
orientador da Tarefa 8.4 ("nem todas resultarão no mesmo bug, mas devem ser
reproduzíveis").

## Validação

- `npm test`: 761/761 (755 pré-existentes + 6 novos testes dedicados).
- `npm run typecheck` / `npm run lint` / `npm run build`: limpos.
- Validação ao vivo contra `mrv-devDan` (Organization Id
  `00DHZ000006mzDp2AI`, instância `mrvcomercial--danieldev`) para os 4
  cenários novos, via chamadas REST diretas replicando exatamente os envelopes
  renderizados pelo simulador (mesma técnica usada nas validações manuais da
  Fase 7). Resultado líquido bateu com a previsão em todos os 4 casos.
- Resíduo zero confirmado por consulta direta pós-cleanup
  (`SELECT COUNT() FROM Account WHERE Id__c IN (...)` → `totalSize = 0`).

## Pendências restantes da Tarefa 8.4

`O05`, `O06`, `O07`, `O09`, `O12` e `O15` continuam sem cenário/mecanismo
correspondente. Notas relevantes levantadas durante esta investigação:

- **O15 tem um bloqueio de contrato real**: `apexCompatibleUtcDateTimeSchema`
  (`src/contracts/event-grid.ts`) exige que `dataalteracao`/`eventTime`/
  `dataaprovacao` terminem em `Z` (regex), o que impede o simulador de enviar
  o payload "BRT sem offset" que O15 precisa para demonstrar a inversão de
  fuso horário — mesmo já tendo confirmado, lendo `EventGrid.parseDateTime`
  (`.replace('.000Z','')` + `DateTime.valueOfGmt`) e
  `TV_Utils.parseToDateMillis`, que o Apex real aceitaria esse payload e o
  interpretaria incorretamente como GMT. Requer decisão: afrouxar o schema
  compartilhado (risco: afeta os 44 cenários do catálogo) ou criar um modo de
  payload literal/raw dedicado a este teste.
- **O06/O07/O09/O12** ainda dependem do trabalho de engenharia descrito na
  Tarefa 8.4 do plano principal (checkpoints administrativos para pausar o
  dispatch; extensão da ferramenta de stress do O10 com contextos de
  autenticação independentes).
