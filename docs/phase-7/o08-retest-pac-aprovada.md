# O08 retestado com PAC aprovada — resposta definitiva da Fase 7

## Pergunta que este incremento precisava responder

Depois que o fluxo `/Cliente` do O08 cria a Account **Y** sem contatos
(enquanto os `contato-insert` antigos ficam presos em **X**), o contexto
futuro de PAC/reconciliação consegue **corrigir Y**?

**Resposta curta:** sim. Em `mrv-devDan`, a PAC aprovada preencheu **Y** e
também o **Lead novo de Y** com os contatos do Proponente principal, sem apagar
os contatos antigos de **X**.

## Cenário publicado

- **Chave:** `cpf-divergente-identidade-antiga-pac-aprovada`
- **Escopo:** `EXTENDED`
- **Tags:** `regression`, `fase-7`, `o08`, `retest-pac`, `pos-pac`
- **Base:** mesmos 3 passos do O08 original (`contato-email-x`,
  `contato-celular-x`, `cliente-insert-y`)
- **Passo adicional:** `pac-insert-aprovada-y`

## Leitura de código que guiou o payload

Antes da execução real, foi revisado o Apex em modo somente leitura:

- `NotificacaoPAC.criarInstanciaProponente` chama
  `ClienteService.getClientePosPac(idCliente, cpf, idProponente)`;
- `ClienteService.getClientePosPac` tenta resolver na ordem:
  **`ID_CLIENTE` -> `CPF` -> `ID_PROSPECT`**;
- `ClienteService.deveDescartarMatchPosPac` **só descarta** quando o match veio
  por `ID_PROSPECT` e diverge do `idCliente`/`cpf` do payload.

Decisão prática desta variante:

- o Proponente principal do PAC foi enviado com
  `idCliente = Y` e `cpf = Y`;
- `idProponente` foi omitido de propósito, porque **não é necessário** para
  esse caminho e evitaria qualquer fallback inútil por identidade antiga.

Resultado: o Apex encontrou **Y diretamente por `idCliente`** e o descarte
defensivo por `ID_PROSPECT` **não foi acionado**.

## Execução real em `mrv-devDan`

Fixture executada:

- `runId`: `run_phase7o08_1790075956651`
- `controlIdCliente` (X):
  `CLI-SIM-X-c1e9cb5164-5540bef3b9`
- `yIdCliente` (Y): `CLI-SIM-c1e9cb5164-5540bef3b9`
- `opportunityExternalId`: `OPP-SIM-c1e9cb5164-5540bef3b9`
- `pacExternalId`: `PAC-SIM-c1e9cb5164-5540bef3b9`
- `proponenteExternalId`: `PROP-SIM-c1e9cb5164-5540bef3b9`

Todos os 4 dispatches retornaram **`200 OK`**:

- `contato-email-x`
- `contato-celular-x`
- `cliente-insert-y`
- `pac-insert-aprovada-y`

## Evidência 1 — estado logo após o passo 3 (`cliente-insert-y`)

### Account X

- `Id`: `001HZ000011Psx7YAC`
- `PersonEmail`: `colisao.5540bef3b9@simulador.mrv.invalid`
- `Celular__c`: `11919221813`

### Account Y

- `Id`: `001HZ000011Q6f1YAC`
- `Id__c`: `CLI-SIM-c1e9cb5164-5540bef3b9`
- `PersonEmail`: `null`
- `PersonMobilePhone`: `null`
- `Celular__c`: `null`

### Lead novo de Y

- `Id`: `00QHZ00000bf0YM2AY`
- `Id__c`: `cfd6400e-0afe-8668-8a49-a78df55e9f00`
- `Email`: `null`
- `MobilePhone`: `null`
- `CelularSemFormatacao__c`: `null`

Conclusão intermediária: o comportamento isolado do O08 original foi
reconfirmado. **Y nasce vazia** e o **Lead novo também nasce vazio**.

## Evidência 2 — estado após o passo 4 (`pac-insert` aprovado)

### Account X permaneceu com os contatos antigos

- `PersonEmail`: `colisao.5540bef3b9@simulador.mrv.invalid`
- `Celular__c`: `11919221813`

### Account Y foi populada pelo PAC

- `PersonEmail`: `pac.5540bef3b9@simulador.mrv.invalid`
- `PersonMobilePhone`: `5511988109789`
- `Celular__c`: `11988109789`
- `DataAlteracaoEventoContatoEmail__c`: `2026-09-22T11:19:21.000+0000`
- `DataAlteracaoEventoContatoCelular__c`: `2026-09-22T11:19:21.000+0000`

### Lead novo de Y também foi reconciliado

- `Email`: `pac.5540bef3b9@simulador.mrv.invalid`
- `MobilePhone`: `11988109789`
- `CelularSemFormatacao__c`: `11988109789`

### Registros PAC observados

#### PropostaAnaliseCredito__c

- `Id`: `a0kHZ00000BLXx7YAH`
- `Id__c`: `PAC-SIM-c1e9cb5164-5540bef3b9`
- `Status__c`: `CREDITO_APROVADO_CONDICIONADO`

#### Proponente__c

- `Id`: `a0jHZ00000CFbA1YAL`
- `Id__c`: `PROP-SIM-c1e9cb5164-5540bef3b9`
- `Proponente__c`: `001HZ000011Q6f1YAC` (**Y**)
- `PropostaAnaliseCredito__c`: `a0kHZ00000BLXx7YAH`
- `IdCliente__c`: `CLI-SIM-c1e9cb5164-5540bef3b9`
- `CpfProponente__c`: `34852125988`
- `TipoClassificacao__c`: `Principal`
- `EmailAtualizado__c`: `pac.5540bef3b9@simulador.mrv.invalid`
- `Celular__c`: `11988109789`

## Descoberta adicional relevante

A `Opportunity` sintética do setup começou vinculada a **X**, mas depois do
fluxo PAC foi observada com:

- `AccountId = 001HZ000011Q6f1YAC` (**Y**)
- `PACAtual__c = a0kHZ00000BLXx7YAH`

Ou seja, além de sincronizar contatos, o fluxo real também **reassociou a
Opportunity para Y** nesta execução. Esse efeito foi documentado, mas não virou
assert obrigatório do cenário nesta entrega.

## Conclusão de produto / desenho

O contexto de PAC/reconciliação **está presente, é real e já responde a
pergunta em aberto da sessão**:

- o `/Cliente` sozinho não consegue projetar os contatos para Y no O08;
- a PAC aprovada corrige isso por um caminho diferente, pós-PAC;
- o resultado final observado ao vivo finalmente bate com a intenção do
  catálogo: **X mantém os contatos antigos e Y passa a receber os contatos
  aprovados**.

Portanto, a hipótese levantada na documentação da Fase 6 foi **confirmada**.

## Limpeza real

Nenhum resíduo foi deixado em `mrv-devDan`. A limpeza final removeu:

- `Proponente__c`: `a0jHZ00000CFbA1YAL`
- `PropostaAnaliseCredito__c`: `a0kHZ00000BLXx7YAH`
- `Opportunity`: `006HZ00000Tz8pZYAR`
- `Lead`: `00QHZ00000bf0YM2AY`
- `Account X`: `001HZ000011Psx7YAC`
- `Account Y`: `001HZ000011Q6f1YAC`
