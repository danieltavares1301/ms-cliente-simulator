# PAC conflito de Proponentes Principais

Execução real da variação **3/5** do universo `/PAC`, cobrindo o bloqueio de
sincronização de contatos quando o mesmo payload aprovado contém **dois**
`Proponente__c` distintos (`Id__c` diferentes), ambos
`tipoClassificacao='Principal'`, ambos resolvidos para a **mesma Account**, mas
com email/celular divergentes.

## Execução real em `mrv-devDan`

- org validada manualmente: `00DHZ000006mzDp2AI` (`mrv-devDan`, sandbox)
- setup real via REST:
  - `Account` Person Account sintética
  - `Opportunity` sintética vinculada
- dispatch real: `POST /services/apexrest/PAC`
- polling pós-dispatch: **2s** até observar PAC + 2 Proponentes persistidos
- cleanup manual real: `Proponente__c -> PropostaAnaliseCredito__c -> Opportunity -> Account`

## Identificadores reais

- `executionId`: `manual-pac-conflict-C-2026092213230354`
- `Account.Id__c`: `CLI-SIM-d28eadfb1c-611de3f9e4`
- `Opportunity.Id__c`: `OPP-SIM-d28eadfb1c-611de3f9e4`
- `PAC.Id__c`: `PAC-SIM-d28eadfb1c-611de3f9e4`
- `Proponente 1.Id__c`: `PROP-SIM-d28eadfb1c-611de3f9e4`
- `Proponente 2.Id__c`: `PROP-SIM-X-d28eadfb1c-611de3f9e4`
- `email/celular A`: `cliente.611de3f9e4@simulador.mrv.invalid` / `11971579108`
- `email/celular B`: `pac.611de3f9e4@simulador.mrv.invalid` / `11929922889`

## Evidência antes do dispatch

`Account`

```json
{"Id":"001HZ000011Q2WjYAK","Id__c":"CLI-SIM-d28eadfb1c-611de3f9e4","CPF__pc":"13863233492","LastName":"Cliente Simulado Base 611de3f9e4","PersonEmail":null,"PersonMobilePhone":null,"Celular__c":null}
```

`Opportunity`

```json
{"Id":"006HZ00000TzN8gYAF","Id__c":"OPP-SIM-d28eadfb1c-611de3f9e4","AccountId":"001HZ000011Q2WjYAK","Name":"Opportunity Sintética PAC","StageName":"Simulação","CloseDate":"2026-09-30","PACAtual__c":null}
```

`PropostaAnaliseCredito__c`

```json
{"totalSize":0}
```

`Proponente__c`

```json
{"totalSize":0}
```

## Dispatch real

- `POST /services/apexrest/PAC`
- HTTP: `200 OK`
- body: vazio

## Evidência após o dispatch

`Account`

```json
{"Id":"001HZ000011Q2WjYAK","Id__c":"CLI-SIM-d28eadfb1c-611de3f9e4","CPF__pc":"13863233492","LastName":"Cliente Simulado Base 611de3f9e4","PersonEmail":null,"PersonMobilePhone":null,"Celular__c":null}
```

`PropostaAnaliseCredito__c`

```json
{"Id":"a0kHZ00000BLhjZYAT","Id__c":"PAC-SIM-d28eadfb1c-611de3f9e4","Oportunidade__c":"006HZ00000TzN8gYAF","Status__c":"CREDITO_APROVADO_CONDICIONADO"}
```

`Proponente__c` 1

```json
{"Id":"a0jHZ00000CFgw5YAD","Id__c":"PROP-SIM-d28eadfb1c-611de3f9e4","Proponente__c":"001HZ000011Q2WjYAK","PropostaAnaliseCredito__c":"a0kHZ00000BLhjZYAT","IdCliente__c":"CLI-SIM-d28eadfb1c-611de3f9e4","CpfProponente__c":"13863233492","TipoClassificacao__c":"Principal","EmailAtualizado__c":"cliente.611de3f9e4@simulador.mrv.invalid","Celular__c":"11971579108","DataAlteracaoEvento__c":"2026-09-22T13:23:03.000Z","NomeCompleto__c":"Cliente Simulado Base 611de3f9e4"}
```

`Proponente__c` 2

```json
{"Id":"a0jHZ00000CFgw6YAD","Id__c":"PROP-SIM-X-d28eadfb1c-611de3f9e4","Proponente__c":"001HZ000011Q2WjYAK","PropostaAnaliseCredito__c":"a0kHZ00000BLhjZYAT","IdCliente__c":"CLI-SIM-d28eadfb1c-611de3f9e4","CpfProponente__c":"13863233492","TipoClassificacao__c":"Principal","EmailAtualizado__c":"pac.611de3f9e4@simulador.mrv.invalid","Celular__c":"11929922889","DataAlteracaoEvento__c":"2026-09-22T13:23:03.000Z","NomeCompleto__c":"Cliente Simulado Base 611de3f9e4"}
```

## Resultado real observado

- a PAC foi criada normalmente e ficou vinculada à `Opportunity`;
- **os dois `Proponente__c` foram criados normalmente**;
- ambos apontaram para a **mesma Account** (`Proponente__c.Proponente__c =
  001HZ000011Q2WjYAK`);
- os dois registros preservaram os contatos divergentes do payload;
- a `Account` **não recebeu nenhum** dos dois conjuntos de contatos:
  `PersonEmail`, `PersonMobilePhone` e `Celular__c` permaneceram `null`;
- portanto, o comportamento real bateu com a leitura do Apex:
  **o conflito bloqueia a sincronização de contatos para a Account inteira, mas
  não bloqueia o upsert dos Proponentes**.

Observação adicional: assim como em outras execuções PAC já documentadas, o
`NomeCompleto__c` persistido nos dois `Proponente__c` continuou refletindo o
nome base da Account sintética, não um valor divergente derivado do payload.

## Cleanup real

Registros removidos manualmente:

- `Proponente__c:a0jHZ00000CFgw5YAD`
- `Proponente__c:a0jHZ00000CFgw6YAD`
- `PropostaAnaliseCredito__c:a0kHZ00000BLhjZYAT`
- `Opportunity:006HZ00000TzN8gYAF`
- `Account:001HZ000011Q2WjYAK`

## Verificação final de resíduos

Após o cleanup, queries diretas nas quatro chaves externas retornaram:

```json
{"account":0,"opportunity":0,"proposta":0,"proponentes":0}
```
