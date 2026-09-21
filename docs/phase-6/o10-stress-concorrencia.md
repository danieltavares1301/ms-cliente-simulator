# O10 — Rajada concorrente `cliente-update`

## Objetivo

Implementar o perfil **O10 ("Rajada concorrente Cliente/PAC")** no recorte
viável do MVP atual: **N requisições `cliente-update` realmente simultâneas
contra a mesma Person Account** (`mesmo idcliente`), sem tentar encaixar isso
na orquestração sequencial baseada em `ScenarioDefinition`.

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
  `scripts/stress-o10-concurrent-cliente-update.ts`
- wrapper executável do repositório:
  `npm run stress:o10`
- helper de execução local:
  `scripts/run-stress-o10-concurrent-cliente-update.cjs`

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
4. dispara **12 `cliente-update` concorrentes** com `Promise.all` contra
   `/services/apexrest/Cliente`;
5. aguarda 15s;
6. consulta estado final da Account, Leads e `LogIntegracao__c`;
7. remove os registros criados/afetados e confirma cleanup por consulta direta.

### Parâmetros suportados

O script aceita CLI/env para:

- `orgAlias`
- `sfCommand`
- `concurrency`
- `waitMs`
- `requestTimeoutMs`
- `eventTimeStepMs`
- `seed`
- `runId`
- `eventStartAt`

### Escolha adotada para a execução real

Para as execuções documentadas abaixo, usei:

- **concorrência = 12**
- **`eventTimeStepMs = 0`**
- ou seja: **todas as 12 requisições compartilharam o mesmo
  `eventTime` / `dataalteracao`**

Motivo: esse modo é o mais agressivo no recorte atual e está alinhado à
recomendação do catálogo de exercitar a dimensão de **mesmo `eventTime`**.

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
