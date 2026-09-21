# Fase 6 — `contato-antes-cliente-colisao`

## Objetivo

Registrar o cenário combinado em que:

- eventos `contato-insert` chegam antes do `cliente-insert`;
- a nova identidade **Y** reutiliza o `idprospectsalesforce` antigo de **X**;
- o Apex cria a Account **Y** “do nada” durante os contatos;
- quando o `cliente-insert` chega depois, o prospect ainda pertence à Account
  **X**;
- `insertLeadQueueable` cria um novo Lead para **Y**;
- a Regra 6.6 remove apenas o campo de contato que colide com outro Lead.

Resultado modelado no simulador:

- Account **X** permanece intacta;
- Account **Y** é criada;
- o novo Lead de **Y** fica com **Email excluído** e **Celular preservado**.

## Regras de negócio replicadas

### O01 — contatos antes do cliente

1. `contato-insert` chega usando `IDCLI-Y + PROS-X`;
2. como `IDCLI-Y` ainda não existe, o Apex faz upsert e cria a Account **Y**;
3. nesse caminho, `IdProspectSalesforce__c` ainda não é carimbado em **Y**;
4. quando chega `cliente-insert(Y, PROS-X)`, o match por `Id__c` encontra **Y**;
5. o prospect continua pertencendo à Account **X** de controle;
6. o fluxo cai em `criarLeadDoCliente=true`.

### Regra 6.6 — colisão parcial de contato

1. o novo Lead herda `Email` e `MobilePhone` da Account **Y**;
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

Restrições:

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

Isso evita que os contatos preliminares de O01 contaminem checks de Account/Lead
que pertencem semanticamente ao `cliente-insert` final.

### Lead de colisão não interfere no CPF principal

O CPF do Lead `COLLISION` não participa do `setupCpf` do fluxo principal. Isso
impede falsos `INVALID_FIXTURE` e mantém a consistência do CPF de **Y** isolada
do Lead auxiliar.

## Cenário publicado

- **key**: `contato-antes-cliente-colisao`
- **version**: `1`
- **scope**: `EXTENDED`
- **tags**: `regression`, `o01`, `regra-6-6`, `lead`, `colisao`
- **asyncPolicy**: `{ min: 1, max: 1, waitTimeoutMs: 30000, missingCallbackResult: 'PARTIAL' }`

## Limitações conhecidas

- `endereco-insert` ainda não é suportado como step renderizado; fica para um
  incremento futuro;
- o cenário continua verificando apenas os campos de negócio relevantes para a
  regressão atual;
- o callback assíncrono permanece esperado, mas sua ausência continua sendo
  tratada como `PARTIAL`, não `FAILED`.
