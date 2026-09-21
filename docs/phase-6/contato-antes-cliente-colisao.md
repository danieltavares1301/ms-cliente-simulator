# Fase 6 — `contato-antes-cliente-colisao`

## Objetivo

Registrar o cenário combinado em que:

- o `cliente-insert` cria a Account **Y** com um prospect que já pertence à
  Account **X** de controle, disparando a criação assíncrona de um Lead;
- eventos `contato-insert` chegam logo em seguida (durante/após o
  processamento assíncrono do Lead), atualizando **Y** e sendo reconciliados
  no Lead;
- a Regra 6.6 remove apenas o campo de contato que colide com outro Lead.

Resultado modelado no simulador:

- Account **X** permanece intacta;
- Account **Y** é criada;
- o novo Lead de **Y** fica com **Email excluído** e **Celular preservado**.

## Correção de rota: de O01 para O02

O desenho original desta tarefa seguiu o perfil **O01 — Parciais antes**
(catálogo de referência), assumindo que os eventos `contato-insert` chegando
com `IDCLI-Y + PROS-X` **antes** do `cliente-insert` criariam a Account **Y**
"do nada" via upsert. A validação end-to-end contra `mrv-devDan` revelou duas
limitações reais do Apex que invalidam essa suposição:

1. **Divergência de prospect descarta silenciosamente eventos de contato.**
   Em `NotificacaoCliente.getSObjectExistente`, quando `idprospectsalesforce`
   do payload já pertence a outra Account (aqui, **X**), `deveDescartarMatchPosPac`
   retorna `true`. Para `cliente-insert`/`cliente-update`, isso ativa
   `criarLeadDoCliente = true` (fluxo normal). Mas para `contato-insert`, o
   mesmo sinal ativa `this.descartarEvento = true`, e o método retorna **sem
   nenhuma escrita** — o evento é descartado por completo, silenciosamente.
   Ou seja: enviar `contato-insert` com `idprospectsalesforce = PROS-X` nunca
   chega a criar nem atualizar a Account.
2. **Person Account exige `LastName`, que só é preenchido por `cliente-insert`/
   `cliente-update`.** Mesmo removendo `idprospectsalesforce` do payload de
   contato (evitando o descarte acima), o upsert de uma Account **inexistente**
   via `contato-insert` falha com `REQUIRED_FIELD_MISSING: LastName`, pois
   `preencherAtributosAccountEventTypeContatoInsertOrContatoUpdate` nunca
   define esse campo — só `preencherAtributosAccountEventTypeClientInsertOrClientUpdate`
   o faz.

Essas duas descobertas (confirmadas ao vivo contra `mrv-devDan`, reproduzindo
o `setup()`/dispatch/`verify()` diretamente) mostram que o padrão real e
executável neste MVP (sem PAC/jornada) é o **O02 — Cliente antes**: o
`cliente-insert` precisa chegar primeiro (criando a Account **Y** com
`LastName`, sem herdar o prospect de **X**, e enfileirando o
`insertLeadQueueable` de forma assíncrona); os `contato-insert` chegam depois,
encontram **Y** já existente (match por `Id__c`, sem enviar
`idprospectsalesforce`) e atualizam os campos normalmente. A `key` do cenário
(`contato-antes-cliente-colisao`) foi mantida para não exigir uma nova rodada
de referências em testes/documentação, mas a tag e a descrição foram
corrigidas de `o01` para `o02`.

A chegada dos eventos de contato ocorre com atraso propositalmente maior
(`delayMs: 3_000`/`5_000`) em relação ao `cliente-insert` (`delayMs: 0`), dando
tempo ao `insertLeadQueueable` (criação do Lead) e à
`ReconciliacaoContatosLeadQueueable` subsequente (disparada a cada
`contato-insert` bem-sucedido) de convergirem antes da verificação. Validado
com sucesso ao vivo: mesmo que o Lead seja criado pelo Queueable antes dos
contatos chegarem (corrida esperada pelo próprio catálogo de referência para o
perfil O02), a reconciliação assíncrona posterior preenche os campos vazios do
Lead a partir da Account, aplicando a mesma lógica de colisão da Regra 6.6.

## Regras de negócio replicadas

### O02 — cliente antes dos contatos parciais

1. `cliente-insert(Y, PROS-X)` chega primeiro; como **Y** não existe, é criada
   via upsert, sem herdar `IdProspectSalesforce__c` (só é carimbado em
   contas já existentes);
2. o prospect `PROS-X` continua pertencendo à Account **X** de controle;
3. `prospectPertenceAOutraConta` detecta a divergência e ativa
   `criarLeadDoCliente = true`, enfileirando `insertLeadQueueable`;
4. os `contato-insert` seguintes (sem `idprospectsalesforce`) encontram **Y**
   por `Id__c` e atualizam `PersonEmail`/`Celular__c` normalmente;
5. cada `contato-insert` bem-sucedido dispara
   `ReconciliacaoContatosLeadQueueable`, que propaga os contatos da Account
   para o Lead (política padrão `PREENCHER_CONTATOS_VAZIOS`), fechando a
   janela de corrida com o Queueable de criação do Lead.

### Regra 6.6 — colisão parcial de contato

1. o Lead (criado direto ou reconciliado depois) herda `Email`/`MobilePhone`
   da Account **Y**;
2. se outro Lead já possui o mesmo e-mail, **Email** é removido;
3. se o celular não colide, **MobilePhone/CelularSemFormatacao__c** são
   preservados;
4. a regra é assimétrica e independente por campo.

## Extensões de contrato

### Novos `eventType` renderizados

`renderedFixtureStepSchema.eventType` agora aceita:

- `cliente-insert`
- `cliente-update`
- `contato-insert`

O envelope renderizado também passou a aceitar `contatoInsertEventSchema`.

### `CREATE_SYNTHETIC_LEAD.role`

`CREATE_SYNTHETIC_LEAD` agora suporta:

- `PRIMARY` — Lead principal do fixture;
- `COLLISION` — Lead auxiliar usado para forçar colisão de contato.

Restrições (ambas cobertas por teste dedicado):

- no máximo um `PRIMARY`;
- no máximo um `COLLISION`.

### Novos identificadores renderizados

Quando existe um setup `CREATE_SYNTHETIC_LEAD` com `role: 'COLLISION'`, a
fixture renderizada expõe:

- `collisionLeadIdExterno`

Ele é validado explicitamente no Test Data Adapter e deve continuar com prefixo
`LEAD-SIM-` para obedecer à política de ownership do cleanup.

## Novos `GeneratedValue`s

Foram adicionados:

- `COLLISION_LEAD_ID_EXTERNO`
- `COLLISION_CPF`
- `COLLISION_EMAIL`
- `CLEAN_CELULAR`

### Formatos

- `COLLISION_LEAD_ID_EXTERNO` → `LEAD-SIM-COL-${namespaceToken}-${seedToken}`
- `COLLISION_CPF` → CPF sintético determinístico derivado de
  `generateSyntheticCpf("${seed}:collision", runId)`
- `COLLISION_EMAIL` → `colisao.${seedToken}@simulador.mrv.invalid`
- `CLEAN_CELULAR` → celular determinístico de 11 dígitos com prefixo `119`

## Decisão de design: `expectedOutcomes` com valor gerado

O cenário precisava afirmar `LEAD_MOBILE_EQUALS_EXPECTED` com um valor conhecido
apenas durante a renderização. Antes deste incremento, `expectedOutcomes` era
copiado literalmente do catálogo e os checks com `value` aceitavam apenas
`string`.

### O que mudou

1. o contrato **de definição** do cenário passou a aceitar `value` como:
   - string estática; ou
   - referência `GENERATED`;
2. o contrato **renderizado** continua aceitando apenas string final;
3. `renderScenarioFixture()` agora aplica `resolveTemplate()` também nos checks
   de `expectedOutcomes`.

### Motivo

Isso preserva retrocompatibilidade total dos cenários existentes e evita vazar
placeholders `GENERATED` para a fixture final, mantendo a saída pronta para o
adapter de verificação.

## Ajustes no Test Data Adapter

### Validação por tipo de step

- `cliente-insert` / `cliente-update` continuam exigindo `nomecompleto`;
- `contato-insert` deixa de exigir `nomecompleto`;
- `contato-insert` valida `tipocontato` e `descricao`.

### Escolha do evento “de negócio”

Para verificação final (`verify`), o adapter passou a usar o último step de
cliente (`cliente-insert` / `cliente-update`) como fonte principal de:

- `idcliente`
- `numerocpf`
- `nomecompleto`

Isso evita que os contatos de O02 contaminem checks de Account/Lead que
pertencem semanticamente ao `cliente-insert`.

### Lead de colisão não interfere no CPF principal

O CPF do Lead `COLLISION` não participa do `setupCpf` do fluxo principal. Isso
impede falsos `INVALID_FIXTURE` e mantém a consistência do CPF de **Y** isolada
do Lead auxiliar.

## Cenário publicado

- **key**: `contato-antes-cliente-colisao` (mantida por conveniência; o padrão
  real implementado é O02, não O01 — ver seção "Correção de rota" acima)
- **version**: `1`
- **scope**: `EXTENDED`
- **tags**: `regression`, `o02`, `regra-6-6`, `lead`, `colisao`
- **asyncPolicy**: `{ min: 1, max: 1, waitTimeoutMs: 30000, missingCallbackResult: 'PARTIAL' }`

## Validação end-to-end (evidência real)

Executado ao vivo contra `mrv-devDan` (chamando `setup()`/dispatch real via
`/services/apexrest/Cliente`/`verify()`/`cleanup()` diretamente, fora do
orquestrador, para inspecionar o resultado com precisão antes do cleanup):

- Todos os 9 checks de `expectedOutcomes` passaram, incluindo
  `LEAD_EMAIL_EXCLUDED=true` (colisão real de e-mail com o Lead auxiliar) e
  `LEAD_MOBILE_EQUALS_EXPECTED=true` (celular preservado e propagado via
  `ReconciliacaoContatosLeadQueueable`);
- também validado via API pública do simulador (`POST /api/v1/runs`, run real
  não-dry-run) com o orquestrador completo, incluindo o callback GraphQL
  assíncrono (`GRAPHQL_CALLBACK_THRESHOLD_REACHED` → `VERIFY_STARTED` →
  `VERIFY_SUCCEEDED` → `CLEANUP_SUCCEEDED` → run `SUCCEEDED`).

## Limitações conhecidas

- este incremento não validou `endereco-insert`; o suporte ao step renderizado
  e a validação ao vivo de endereço foram concluídos depois no incremento O03;
- o cenário continua verificando apenas os campos de negócio relevantes para a
  regressão atual;
- o callback assíncrono permanece esperado, mas sua ausência continua sendo
  tratada como `PARTIAL`, não `FAILED`;
- o perfil O01 real (contato genuinamente antes do cliente-insert, sem que a
  Account já exista) não é reproduzível neste MVP sem depender de um evento de
  cliente anterior que já tenha carimbado `LastName` — isso está fora do
  escopo atual (sem PAC/Proponente/Opportunity) e fica registrado aqui como
  conhecimento adquirido para desenho de futuros cenários O01 genuínos.
