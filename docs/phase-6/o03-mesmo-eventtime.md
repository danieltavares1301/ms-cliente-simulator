# O03 — Mesmo `eventTime`

## Objetivo

Implementar o perfil **O03** do catálogo de ordens do MS Cliente para publicar
os quatro eventos viáveis do MVP (`cliente-insert`, `contato-insert` Email,
`contato-insert` Celular e `endereco-insert`) com o **mesmo `eventTime`
lógico**, porém em **três ordens físicas de dispatch** diferentes.

O objetivo desta fase foi validar contra `mrv-devDan` se o empate temporal
realmente converge para o mesmo estado final, sem depender de `CreatedDate` nem
da ordem de entrega.

## Decisões de design do incremento

1. **`eventTime` desacoplado de `scheduledAt`**
   - `scheduledAt` continua modelando apenas o instante físico planejado do
     dispatch.
   - o novo `GeneratedValue` `PINNED_EVENT_TIME` fixa o `eventTime` lógico do
     envelope e o `dataalteracao` do payload no mesmo instante do início do
     run.
   - isso permite permutar a ordem física mantendo o mesmo carimbo lógico do
     produtor.

2. **Suporte explícito a `endereco-insert` nas fixtures**
   - `renderedFixtureStepSchema` agora aceita `endereco-insert`;
   - o renderer passa a produzir envelopes válidos de endereço;
   - o Test Data Adapter valida `tipoendereco='COBRANCA'` e exige
     `logradouro`.

3. **Checks de Account parametrizados**
   - adicionados:
     - `ACCOUNT_EMAIL_EQUALS_EXPECTED`
     - `ACCOUNT_MOBILE_EQUALS_EXPECTED`
     - `ACCOUNT_BILLING_STREET_EQUALS_EXPECTED`
   - isso permite provar convergência da **Account principal** sem depender de
     uma Account de controle.

## Explicação técnica observada

A implementação do simulador ficou alinhada à hipótese levantada na investigação
prévia: o Apex pós-PAC mantém campos independentes de data de alteração por
família de evento (`cliente`, `contato-email`, `contato-celular`, `endereco`).

Na prática, isso significa que um empate temporal entre tipos diferentes **não
entra em conflito no mesmo carimbo persistido**. Cada evento atualiza seu
próprio eixo de dados, e o simulador agora consegue reproduzir isso com
`eventTime` idêntico e ordem física diferente.

## Execução real em `mrv-devDan`

### Ambiente

- **Org**: `mrv-devDan`
- **Organization Id**: `00DHZ000006mzDp2AI`
- **Instância**: `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`

### Cenários executados

Todos os três cenários abaixo usaram:

- setup com **1 Person Account sintética** (`matchBy: ID_CLIENTE`);
- `eventTime = dataalteracao = 2026-09-21T18:00:00.000Z` nos quatro eventos;
- dispatch físico com `delayMs` crescente para reproduzir a permutação;
- espera de 10 segundos antes do `verify()`;
- cleanup automatizado e validação final de ausência de resíduos.

#### 1. `ordem-mesmo-eventtime-cliente-primeiro`

Ordem física:

1. `cliente-insert`
2. `contato-email`
3. `contato-celular`
4. `endereco-insert`

Resultado observado:

- setup criou **1** Account sintética;
- os **4 dispatches** retornaram **HTTP 200 OK**;
- `verify()` aprovou **7/7 checks**;
- estado final da Account:
  - `LastName = Cliente Simulado 0d58c0f517`
  - `CPF__pc = 71441419292`
  - `PersonEmail = cliente.0d58c0f517@simulador.mrv.invalid`
  - `Celular__c = 11918411505`
  - `PersonMobilePhone = 5511918411505`
  - `BillingStreet = Rua Simulada 0d58c0f517`
  - `DataAlteracaoEvento__c = 2026-09-21T18:00:00.000+0000`
- **nenhum Lead** foi criado (`leadState.totalSize = 0`).

#### 2. `ordem-mesmo-eventtime-contato-primeiro`

Ordem física:

1. `contato-email`
2. `cliente-insert`
3. `endereco-insert`
4. `contato-celular`

Resultado observado:

- setup criou **1** Account sintética;
- os **4 dispatches** retornaram **HTTP 200 OK**;
- `verify()` aprovou **7/7 checks**;
- estado final da Account:
  - `LastName = Cliente Simulado d05eb5afb7`
  - `CPF__pc = 20091072689`
  - `PersonEmail = cliente.d05eb5afb7@simulador.mrv.invalid`
  - `Celular__c = 11971671726`
  - `PersonMobilePhone = 5511971671726`
  - `BillingStreet = Rua Simulada d05eb5afb7`
  - `DataAlteracaoEvento__c = 2026-09-21T18:00:00.000+0000`
- **nenhum Lead** foi criado (`leadState.totalSize = 0`).

#### 3. `ordem-mesmo-eventtime-endereco-primeiro`

Ordem física:

1. `endereco-insert`
2. `contato-celular`
3. `cliente-insert`
4. `contato-email`

Resultado observado:

- setup criou **1** Account sintética;
- os **4 dispatches** retornaram **HTTP 200 OK**;
- `verify()` aprovou **7/7 checks**;
- estado final da Account:
  - `LastName = Cliente Simulado 2cf81e2c0e`
  - `CPF__pc = 11977051472`
  - `PersonEmail = cliente.2cf81e2c0e@simulador.mrv.invalid`
  - `Celular__c = 11919780150`
  - `PersonMobilePhone = 5511919780150`
  - `BillingStreet = Rua Simulada 2cf81e2c0e`
  - `DataAlteracaoEvento__c = 2026-09-21T18:00:00.000+0000`
- **nenhum Lead** foi criado (`leadState.totalSize = 0`).

## Conclusão observada

**Os três cenários convergiram para o mesmo padrão de estado final.**

O valor concreto de nome/CPF/e-mail/celular/logradouro muda conforme a seed de
cada run, mas o comportamento observado foi o mesmo nas três permutações:

- 1 Person Account final por `Id__c`;
- nome e CPF vindos do `cliente-insert`;
- e-mail vindo do `contato-email`;
- celular vindo do `contato-celular`;
- logradouro vindo do `endereco-insert`;
- nenhum Lead adicional criado;
- nenhum indício de dependência de `CreatedDate` ou da ordem física de entrega
  dentro deste recorte.

## Evidência de cleanup

Após as execuções, foi feita uma consulta direta em `mrv-devDan` para os três
`Id__c` e os três CPFs sintéticos usados nos testes:

- `SELECT Id, Id__c FROM Account WHERE Id__c IN (...)` → **0 registros**
- `SELECT Id, CPF__c FROM Lead WHERE CPF__c IN (...)` → **0 registros**

Ou seja: os registros usados no diagnóstico foram removidos com sucesso ao fim
do fluxo.

## Limitações conhecidas

- este MVP cobre apenas o núcleo viável de `cliente/contato/endereco`;
- **PAC** e **jornadausuario** continuam fora de escopo nesta fase;
- portanto, a conclusão aqui vale para a convergência de campos na Account
  principal, não para corridas com `/PAC` ou `/MaquinaEstado`.
