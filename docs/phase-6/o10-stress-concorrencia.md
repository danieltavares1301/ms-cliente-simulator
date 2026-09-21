# O10 — Rajada concorrente (uniforme + mix de tipos)

## Objetivo

Implementar o perfil **O10 ("Rajada concorrente Cliente/PAC")** no recorte
viável do MVP atual, em **duas leituras complementares**:

1. **modo uniforme**: **N requisições `cliente-update`** realmente simultâneas
   contra a mesma Person Account (`mesmo idcliente`);
2. **modo misto**: a adaptação correta do catálogo para o MVP, com
   `cliente-update`, `contato-insert` (Email), `contato-insert` (Celular) e
   `endereco-insert` competindo ao mesmo tempo pela **mesma linha de Account**.

Tudo isso sem tentar encaixar a rajada na orquestração sequencial baseada em
`ScenarioDefinition`.

O princípio seguido foi o mesmo do catálogo: **não antecipar o resultado do
Apex**. O script publica a rajada real, consulta o estado final observado na
`mrv-devDan` e registra explicitamente se algum `UNABLE_TO_LOCK_ROW` ou
`DmlException` apareceu.

## Decisão arquitetural

### Por que isto não entrou em `src/scenarios/definitions.ts`

O pipeline declarativo atual (`definitions.ts` + QStash + `claimDispatch`) é
**sequencial por design**. Ele bloqueia steps de ordinal maior enquanto os
anteriores não terminarem, o que inviabiliza o dispatch fisicamente paralelo
que o perfil O10 exige.

Por isso, o O10 foi implementado como **ferramenta diagnóstica dedicada**, não
como cenário do catálogo:

- script TypeScript permanente:
  `scripts/stress-o10-concurrent-events.ts`
- wrapper executável do repositório:
  `npm run stress:o10`
- helper de execução local:
  `scripts/run-stress-o10-concurrent-events.cjs`

Os nomes antigos (`...concurrent-cliente-update...`) foram mantidos como
**shims de compatibilidade**, mas o ponto de manutenção passa a ser o par
`...concurrent-events...`, porque o escopo agora cobre mais de um tipo de
evento.

### Reaproveitamento seguro de módulos existentes

O script **não altera** os módulos compartilhados do simulador. Ele apenas
reutiliza:

- `renderScenarioFixture()` para obter um fixture válido de setup/cleanup;
- `createSalesforceRestClient()`;
- `createSalesforceTestDataAdapter()`;
- `createSalesforceSafetyGuard()`.

O fixture base reaproveitado foi o de `evento-duplicado`, mas com
`scenarioKey` sobrescrito localmente para `o10-stress-concorrencia`, mantendo
somente o que interessa aqui:

- `CREATE_SYNTHETIC_ACCOUNT` com `matchBy: 'ID_CLIENTE'`;
- cleanup allowlisted de Account/Lead;
- envelope base `cliente-update`.

## Como o script funciona

Fluxo resumido:

1. obtém `accessToken` / `instanceUrl` reais via
   `sf org display --target-org mrv-devDan --json`;
2. valida sandbox/host/org com o mesmo `Safety Guard` já usado no simulador;
3. cria **1 Person Account sintética** via `CREATE_SYNTHETIC_ACCOUNT`;
4. monta a rajada conforme `--event-mix`:
   - `uniform` → 12× `cliente-update`;
   - `mixed` (novo padrão) → round-robin de `cliente-update`,
     `contato-insert:Email`, `contato-insert:Celular` e
     `endereco-insert:COBRANCA`;
5. dispara todas as requisições com `Promise.all` contra
   `/services/apexrest/Cliente`;
6. aguarda 15s;
7. consulta estado final da Account, Leads e `LogIntegracao__c`, incluindo os
   campos independentes `PersonEmail`, `Celular__c`/`PersonMobilePhone`,
   `BillingStreet` e os timestamps por família de evento;
8. remove os registros criados/afetados e confirma cleanup por consulta direta.

### Parâmetros suportados

O script aceita CLI/env para:

- `orgAlias`
- `sfCommand`
- `concurrency`
- `waitMs`
- `requestTimeoutMs`
- `eventTimeStepMs`
- `eventMix` (`mixed` | `uniform`)
- `seed`
- `runId`
- `eventStartAt`

### Escolha adotada para a execução real

Para as execuções documentadas abaixo, usei:

- **concorrência = 12**
- **`eventTimeStepMs = 0`**
- **mesmo `eventTime` / `dataalteracao` para toda a rajada**
- **`event-mix=mixed` como novo padrão**
- **`event-mix=uniform` preservado explicitamente para comparação histórica**

Motivo: esse modo é o mais agressivo no recorte atual e está alinhado à
mesma lógica do `PINNED_EVENT_TIME` documentado no O03: variar a ordem e o tipo
do evento sem variar o carimbo lógico do produtor.

## Execução real em `mrv-devDan`

### Ambiente

- **Org:** `mrv-devDan`
- **Organization Id:** `00DHZ000006mzDp2AI`
- **Instância:**
  `https://mrvcomercial--danieldev.sandbox.my.salesforce.com`
- **Comando validado do repositório:** `npm run stress:o10`

### Observação honesta sobre a primeira tentativa

A primeira execução real do script expôs um **bug de cleanup no próprio script**
(consulta de campos insuficientes antes do `cleanup`). O comportamento de
concorrência já observado nessa tentativa foi **12× HTTP 200** com vencedor
`Cliente Concorrente 12`, mas eu **não a considerei rodada limpa de validação**
até corrigir o cleanup e repetir o experimento.

As rodadas abaixo são as **rodadas limpas** consideradas para a conclusão.

## Rodadas limpas registradas

| Rodada | Modo de execução | `runId` | `idcliente` sintético | Vencedor final | HTTP 2xx | `UNABLE_TO_LOCK_ROW` / `DmlException` | `LogIntegracao__c` | Cleanup |
|---|---|---|---|---|---:|---|---:|---|
| A | `node .generated/o10-cjs/...` | `run_o10_mublgdu9` | `CLI-SIM-bb750033fe-943fc41986` | `Cliente Concorrente 12` | 12/12 | não observado | 12 entradas `cliente-update` `success` | Account/Lead = 0 |
| B | `node .generated/o10-cjs/...` | `run_o10_mublijq8` | `CLI-SIM-eba6c088be-ed89df3534` | `Cliente Concorrente 10` | 12/12 | não observado | 12 entradas `cliente-update` `success` | Account/Lead = 0 |
| C | `npm run stress:o10` | `run_o10_mublkqsn` | `CLI-SIM-dc716494f0-ce1604e077` | `Cliente Concorrente 11` | 12/12 | não observado | 12 entradas `cliente-update` `success` | Account/Lead = 0 |

### Evidência HTTP por requisição concorrente

Nas três rodadas limpas:

```text
01 -> 200 OK
02 -> 200 OK
03 -> 200 OK
04 -> 200 OK
05 -> 200 OK
06 -> 200 OK
07 -> 200 OK
08 -> 200 OK
09 -> 200 OK
10 -> 200 OK
11 -> 200 OK
12 -> 200 OK
```

Corpo de resposta HTTP observado: **vazio** em todas as 12 respostas de cada
rodada.

### Estado final observado

#### Rodada A

- `Account.LastName = Cliente Concorrente 12`
- `DataAlteracaoEvento__c = 2026-09-21T18:44:04.000+0000`
- `leadCount = 0`

#### Rodada B

- `Account.LastName = Cliente Concorrente 10`
- `DataAlteracaoEvento__c = 2026-09-21T18:45:45.000+0000`
- `leadCount = 0`

#### Rodada C

- `Account.LastName = Cliente Concorrente 11`
- `DataAlteracaoEvento__c = 2026-09-21T18:47:27.000+0000`
- `leadCount = 0`

## Conclusão observada

### O que aconteceu de fato

1. **Todas as 12 requisições concorrentes retornaram HTTP 200** em todas as
   rodadas limpas.
2. **Nenhuma resposta HTTP** trouxe `UNABLE_TO_LOCK_ROW` ou `DmlException`.
3. **Nenhum Lead** foi criado nessas rajadas.
4. O **vencedor final variou entre execuções**:
   - rodada A → `Cliente Concorrente 12`
   - rodada B → `Cliente Concorrente 10`
   - rodada C → `Cliente Concorrente 11`

Isso mostra que o resultado **não foi determinístico** entre execuções, mesmo
mantendo:

- mesma concorrência (`12`)
- mesmo padrão de payload
- mesmo `eventTime`/`dataalteracao` compartilhado por toda a rajada

### Leitura prática do resultado

No recorte testado, o Apex aceitou todas as entregas e o estado final da
Account refletiu **uma das requisições concorrentes**, mas não de forma
determinística entre runs.

Em outras palavras:

> houve **corrida observável no estado final**, mas **não houve surfacing de
> erro de lock** via HTTP nem em `LogIntegracao__c`.

## Sobre a limitação "duas threads podem ser serializadas pela mesma sessão Salesforce"

O catálogo alerta para a possibilidade de **serialização pela mesma sessão
Salesforce**. Com a evidência coletada, a leitura mais honesta é:

- o script realmente disparou **12 `fetch()` independentes em `Promise.all`**;
- porém todos os requests ainda reutilizaram **o mesmo bearer token obtido via
  Salesforce CLI**;
- logo, **este experimento não refuta** a hipótese de serialização interna por
  sessão.

O que os dados permitem afirmar:

- houve **sobreposição observável no lado cliente** (as durações individuais se
  espalharam em janelas de ~0,6s a ~5s, não em estrita sequência fixa);
- houve **variação do vencedor final** entre rodadas;
- **não** houve `UNABLE_TO_LOCK_ROW` surfaced.

Portanto, a limitação do catálogo fica **confirmada como ainda plausível**:

> com um único token/sessão, o experimento mostra corrida no resultado final,
> mas **não prova** que o Salesforce tenha processado tudo em transações
> plenamente paralelas e independentes.

## Cleanup confirmado

O próprio script consulta a org após o `cleanup` e registra:

- `accountCountAfterCleanup = 0`
- `leadCountAfterCleanup = 0`

Além disso, foi feita uma **consulta direta externa** após a rodada C:

```text
SELECT Id, Id__c, LastName
FROM Account
WHERE Id__c = 'CLI-SIM-dc716494f0-ce1604e077'
--> totalSize = 0

SELECT Id, Id__c, CPF__c
FROM Lead
WHERE Id__c = 'PRO-SIM-dc716494f0-ce1604e077'
   OR CPF__c = '95125961485'
--> totalSize = 0
```

Ou seja: os registros sintéticos usados no diagnóstico **não ficaram na org**.

## Complemento corretivo — mix real de tipos

O catálogo original do O10 pede:

```text
→ 6 × cliente-update ─┐
                      ├─ 12 requisições simultâneas sobre a mesma cadeia
→ 6 × pac-update ─────┘
```

Como o MVP atual não possui `/PAC`, a adaptação correta passou a ser um **mix
real de tipos já suportados**, todos apontando para a **mesma Account**:

- `cliente-update` → `nomecompleto = Cliente Concorrente NN`
- `contato-insert` Email →
  `descricao = concorrente-NN@simulador.mrv.invalid`
- `contato-insert` Celular → `descricao = 1199000000NN`
- `endereco-insert` → `logradouro = Rua Concorrente NN`, sem `idcidade`

Com `concurrency = 12`, o modo `mixed` distribui a rajada em **3 eventos de
cada variante**, todos com o mesmo `eventTime`/`dataalteracao`.

### Rodadas mistas executadas em `mrv-devDan`

| Rodada | `runId` | `idcliente` sintético | HTTP 2xx | Locks / `DmlException` | `LogIntegracao__c` | Cleanup |
|---|---|---|---:|---|---|---|
| M1 | `run_o10_mixed_a` | `CLI-SIM-b7da4fa847-8cfe1b2d62` | 12/12 | não observado | 3× `cliente-update`, 6× `contato-insert`, 3× `endereco-insert` — todos `success` | Account/Lead = 0 |
| M2 | `run_o10_mixed_b` | `CLI-SIM-fc9201dd79-f281b17a25` | 12/12 | não observado | 3× `cliente-update`, 6× `contato-insert`, 3× `endereco-insert` — todos `success` | Account/Lead = 0 |
| M3 | `run_o10_mixed_c` | `CLI-SIM-dd6df737b1-391846087a` | 12/12 | não observado | 3× `cliente-update`, 6× `contato-insert`, 3× `endereco-insert` — todos `success` | Account/Lead = 0 |

Em todas as três rodadas:

- **todas as 12 respostas HTTP foram `200 OK`**;
- **nenhuma** resposta/corpo/log surfacou `UNABLE_TO_LOCK_ROW` ou
  `DmlException`;
- **nenhum Lead** foi criado (`leadCount = 0`);
- a contenção apareceu no **estado final da mesma Account**, agora com
  **vencedor por campo** em vez de um único vencedor global.

### Vencedor por campo nas rodadas mistas

| Rodada | `LastName` / `CPF__pc` | `PersonEmail` | `Celular__c` / `PersonMobilePhone` | `BillingStreet` |
|---|---|---|---|---|
| M1 | índice **9** (`cliente-update`) → `Cliente Concorrente 09` | índice **2** (`contato-insert:Email`) → `concorrente-02@simulador.mrv.invalid` | índice **7** (`contato-insert:Celular`) → `11990000007` / `5511990000007` | índice **4** (`endereco-insert`) → `Rua Concorrente 04` |
| M2 | índice **5** (`cliente-update`) → `Cliente Concorrente 05` | índice **6** (`contato-insert:Email`) → `concorrente-06@simulador.mrv.invalid` | índice **3** (`contato-insert:Celular`) → `11990000003` / `5511990000003` | índice **4** (`endereco-insert`) → `Rua Concorrente 04` |
| M3 | índice **9** (`cliente-update`) → `Cliente Concorrente 09` | índice **2** (`contato-insert:Email`) → `concorrente-02@simulador.mrv.invalid` | índice **11** (`contato-insert:Celular`) → `11990000011` / `5511990000011` | índice **8** (`endereco-insert`) → `Rua Concorrente 08` |

### Leitura prática do experimento misto

O comportamento observado foi diferente do experimento uniforme em um ponto
importante:

- no **modo uniforme**, existe um **vencedor global** (`LastName`) porque todas
  as 12 requisições escrevem o mesmo eixo de dados;
- no **modo misto**, surgem **quatro disputas independentes** sobre a mesma
  linha de Account, uma por família de campo (`cliente`, `email`, `celular`,
  `endereço`).

Mesmo assim, o resultado líquido permaneceu consistente com o diagnóstico
anterior:

1. a linha de Account sofre **corrida real**;
2. os **vencedores variam entre execuções**;
3. o Apex/integração **não surfacou erro de lock** nem no HTTP nem no
   `LogIntegracao__c`.

Ou seja: o complemento corretivo **não mudou a conclusão sobre locks**, mas
melhorou a fidelidade do O10 ao catálogo, provando que **tipos diferentes
também competem pelo mesmo lock de linha** e podem terminar com vencedores
diferentes por campo.

### Cleanup externo confirmado para o experimento misto

Após a rodada M3, foi feita uma consulta direta na org cobrindo **as três**
execuções mistas:

```text
SELECT Id, Id__c, LastName
FROM Account
WHERE Id__c IN (
  'CLI-SIM-b7da4fa847-8cfe1b2d62',
  'CLI-SIM-fc9201dd79-f281b17a25',
  'CLI-SIM-dd6df737b1-391846087a'
)
--> totalSize = 0

SELECT Id, Id__c, CPF__c
FROM Lead
WHERE Id__c IN (
  'PRO-SIM-b7da4fa847-8cfe1b2d62',
  'PRO-SIM-fc9201dd79-f281b17a25',
  'PRO-SIM-dd6df737b1-391846087a'
)
   OR CPF__c IN ('21210501406', '24961141178', '95853024469')
--> totalSize = 0
```

Portanto, o cleanup permaneceu íntegro também no modo `mixed`.

## Decisões de design tomadas sozinho

1. **manter o O10 fora do catálogo declarativo**  
   porque o orquestrador atual é sequencial por design.

2. **usar o mesmo `eventTime`/`dataalteracao` por padrão**  
   para maximizar contenção no recorte atual.

3. **adicionar um wrapper `npm run stress:o10`**  
   porque o `node` local em modo TypeScript strip-only não executa diretamente
   alguns módulos reaproveitados do domínio Salesforce; o wrapper compila um
   runner CommonJS descartável em `.generated/`.

4. **filtrar `LogIntegracao__c` por `idcliente` + `eventId`**  
   para evitar contaminar a leitura com runs muito recentes usando os mesmos
   rótulos `Cliente Concorrente NN`.

5. **renomear o script principal para `...concurrent-events...`**  
   porque o modo `mixed` deixou de ser semanticamente um stress apenas de
   `cliente-update`; os nomes antigos foram mantidos como shims de
   compatibilidade para não quebrar referências locais já existentes.
