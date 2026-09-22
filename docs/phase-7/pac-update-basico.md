# PAC update básico — variação 1 de 5

## Escopo deste incremento

Primeira variação dedicada de `/PAC` após a conclusão da Tarefa 7.1 original.
O foco aqui não é mais `pac-insert`, e sim o comportamento real de
`pac-update` em duas formas:

1. update **sem** `proponentes[]`, que apaga os `Proponente__c` existentes;
2. update **reenviando** `proponentes[]`, que preserva o upsert e atualiza os
   contatos.

## Achado arquitetural principal

O comportamento abaixo foi confirmado ao vivo em `mrv-devDan` e precisa ficar
documentado com destaque:

```apex
if (this.listaObjetoProponentes != null) {
    // upsert/sincronização normal
} else if (isUpdate()) {
    this.apagarProponentes();
}
```

Ou seja: **`pac-update` sem `proponentes[]` não é um “update parcial inocente”;
ele deleta os proponentes já vinculados à PAC**. Isso não é um bug do
simulador — é o comportamento real do Apex de produção.

## Execução real em `mrv-devDan`

As duas variações abaixo foram executadas manualmente contra a org real usando:

- setup sintético (Account Person Account + Opportunity);
- dispatch sequencial real em `/services/apexrest/PAC`;
- espera explícita entre os steps;
- queries SOQL antes/depois;
- cleanup manual ao final;
- verificação final de resíduos = `0`.

---

## Cenário A — `pac-update-altera-status-sem-proponentes`

### Identificadores reais

- `executionId`: `manual-pac-update-A-2026092212144045654e`
- `Account.Id__c`: `CLI-SIM-A-2026092212144045654e`
- `Opportunity.Id__c`: `OPP-SIM-A-2026092212144045654e`
- `PAC.Id__c`: `PAC-SIM-A-2026092212144045654e`
- `Proponente.Id__c`: `PROP-SIM-A-2026092212144045654e`

### Step 1 — `pac-insert` com um Proponente principal

- `dispatch /PAC = 200`
- `status` enviado: `EM_ANALISE_CREDITO`

### Evidência SOQL após o step 1

`PropostaAnaliseCredito__c`

```json
{"Id":"a0kHZ00000BLbizYAD","Id__c":"PAC-SIM-A-2026092212144045654e","Oportunidade__c":"006HZ00000TzGvBYAV","Status__c":"EM_ANALISE_CREDITO"}
```

`Proponente__c`

```json
{"Id":"a0jHZ00000CFepRYAT","Id__c":"PROP-SIM-A-2026092212144045654e","Proponente__c":"001HZ000011PwcaYAC","PropostaAnaliseCredito__c":"a0kHZ00000BLbizYAD","IdCliente__c":"CLI-SIM-A-2026092212144045654e","CpfProponente__c":"71084963725","TipoClassificacao__c":"Principal","EmailAtualizado__c":"cliente.2026092212144045654e@simulador.mrv.invalid","Celular__c":"11947523806","DataAlteracaoEvento__c":"2026-09-22T12:15:40.000Z","NomeCompleto__c":"Cliente Simulado A 2026092212144045654e"}
```

`Account`

```json
{"Id":"001HZ000011PwcaYAC","Id__c":"CLI-SIM-A-2026092212144045654e","CPF__pc":"71084963725","LastName":"Cliente Simulado A 2026092212144045654e","PersonEmail":null,"PersonMobilePhone":null,"Celular__c":null}
```

Conclusão intermediária: o insert criou a PAC e o Proponente principal, mas
como o status ainda não era aprovado, a Account continuou sem email/celular.

### Step 2 — `pac-update` no mesmo `id`, sem `proponentes[]`

- `dispatch /PAC = 200`
- `status` enviado: `CREDITO_APROVADO_CONDICIONADO`
- `proponentes[]`: **omitido deliberadamente**

### Evidência SOQL após o step 2

`PropostaAnaliseCredito__c`

```json
{"Id":"a0kHZ00000BLbizYAD","Id__c":"PAC-SIM-A-2026092212144045654e","Oportunidade__c":"006HZ00000TzGvBYAV","Status__c":"CREDITO_APROVADO_CONDICIONADO"}
```

`Account`

```json
{"Id":"001HZ000011PwcaYAC","Id__c":"CLI-SIM-A-2026092212144045654e","CPF__pc":"71084963725","LastName":"Cliente Simulado A 2026092212144045654e","PersonEmail":null,"PersonMobilePhone":null,"Celular__c":null}
```

### Confirmação direta exigida da deleção do Proponente

Query direta executada após o step 2:

```soql
SELECT Id FROM Proponente__c WHERE Id__c = 'PROP-SIM-A-2026092212144045654e'
```

Resultado real:

- `totalSize = 0`

### Resultado observado

- a PAC **foi atualizada** com sucesso para
  `Status__c='CREDITO_APROVADO_CONDICIONADO'`;
- o `Proponente__c` criado no step 1 **deixou de existir** após o update sem
  `proponentes[]`;
- a Account permaneceu sem email/celular, reforçando que a sincronização de
  contatos não roda nesse ramo sem `listaObjetoProponentes`.

### Cleanup real

Registros removidos manualmente:

- `PropostaAnaliseCredito__c:a0kHZ00000BLbizYAD`
- `Opportunity:006HZ00000TzGvBYAV`
- `Account:001HZ000011PwcaYAC`

Observação: não houve `Proponente__c` para remover no cleanup porque ele já
havia sido apagado pelo próprio `pac-update`.

---

## Cenário B — `pac-update-reenviando-proponentes`

### Identificadores reais

- `executionId`: `manual-pac-update-B-2026092212144033df9a`
- `Account.Id__c`: `CLI-SIM-B-2026092212144033df9a`
- `Opportunity.Id__c`: `OPP-SIM-B-2026092212144033df9a`
- `PAC.Id__c`: `PAC-SIM-B-2026092212144033df9a`
- `Proponente.Id__c`: `PROP-SIM-B-2026092212144033df9a`

### Step 1 — `pac-insert` com um Proponente principal

- `dispatch /PAC = 200`
- `status` enviado: `EM_ANALISE_CREDITO`
- email/celular do Proponente:  
  `cliente.2026092212144033df9a@simulador.mrv.invalid` / `11951038972`

### Evidência SOQL após o step 1

`PropostaAnaliseCredito__c`

```json
{"Id":"a0kHZ00000BLbkbYAD","Id__c":"PAC-SIM-B-2026092212144033df9a","Oportunidade__c":"006HZ00000TzBe0YAF","Status__c":"EM_ANALISE_CREDITO"}
```

`Proponente__c`

```json
{"Id":"a0jHZ00000CFesfYAD","Id__c":"PROP-SIM-B-2026092212144033df9a","Proponente__c":"001HZ000011Q5ZMYA0","PropostaAnaliseCredito__c":"a0kHZ00000BLbkbYAD","IdCliente__c":"CLI-SIM-B-2026092212144033df9a","CpfProponente__c":"70981672543","TipoClassificacao__c":"Principal","EmailAtualizado__c":"cliente.2026092212144033df9a@simulador.mrv.invalid","Celular__c":"11951038972","DataAlteracaoEvento__c":"2026-09-22T12:15:40.000Z","NomeCompleto__c":"Cliente Simulado B 2026092212144033df9a"}
```

`Account`

```json
{"Id":"001HZ000011Q5ZMYA0","Id__c":"CLI-SIM-B-2026092212144033df9a","CPF__pc":"70981672543","LastName":"Cliente Simulado B 2026092212144033df9a","PersonEmail":null,"PersonMobilePhone":null,"Celular__c":null}
```

Conclusão intermediária: o Proponente principal foi criado, mas a Account ainda
não tinha sido sincronizada no status não aprovado.

### Step 2 — `pac-update` reenviando o mesmo Proponente principal

- `dispatch /PAC = 200`
- `status` enviado: `CREDITO_APROVADO_CONDICIONADO`
- **mesmo** `Proponente.Id__c`
- novos contatos enviados:  
  `pac.2026092212144033df9a@simulador.mrv.invalid` / `11935480912`

### Evidência SOQL após o step 2

`PropostaAnaliseCredito__c`

```json
{"Id":"a0kHZ00000BLbkbYAD","Id__c":"PAC-SIM-B-2026092212144033df9a","Oportunidade__c":"006HZ00000TzBe0YAF","Status__c":"CREDITO_APROVADO_CONDICIONADO"}
```

`Proponente__c`

```json
{"Id":"a0jHZ00000CFesfYAD","Id__c":"PROP-SIM-B-2026092212144033df9a","Proponente__c":"001HZ000011Q5ZMYA0","PropostaAnaliseCredito__c":"a0kHZ00000BLbkbYAD","IdCliente__c":"CLI-SIM-B-2026092212144033df9a","CpfProponente__c":"70981672543","TipoClassificacao__c":"Principal","EmailAtualizado__c":"pac.2026092212144033df9a@simulador.mrv.invalid","Celular__c":"11935480912","DataAlteracaoEvento__c":"2026-09-22T12:15:45.000Z","NomeCompleto__c":"Cliente Simulado B 2026092212144033df9a"}
```

`Account`

```json
{"Id":"001HZ000011Q5ZMYA0","Id__c":"CLI-SIM-B-2026092212144033df9a","CPF__pc":"70981672543","LastName":"Cliente Simulado B 2026092212144033df9a","PersonEmail":"pac.2026092212144033df9a@simulador.mrv.invalid","PersonMobilePhone":"5511935480912","Celular__c":"11935480912"}
```

### Resultado observado

- a PAC foi atualizada para
  `Status__c='CREDITO_APROVADO_CONDICIONADO'`;
- o `Proponente__c` permaneceu **único** (`totalSize = 1`) e manteve o mesmo
  `Id` Salesforce (`a0jHZ00000CFesfYAD`) entre os dois steps;
- os campos do `Proponente__c` foram atualizados com os novos valores de
  email/celular;
- a Account sincronizou os mesmos novos valores, confirmando o ramo de PAC
  aprovada com `proponentes[]` reenviado.

### Cleanup real

Registros removidos manualmente:

- `Proponente__c:a0jHZ00000CFesfYAD`
- `PropostaAnaliseCredito__c:a0kHZ00000BLbkbYAD`
- `Opportunity:006HZ00000TzBe0YAF`
- `Account:001HZ000011Q5ZMYA0`

---

## Verificação final de resíduos

Após os cleanups, foram executadas queries diretas para os quatro objetos
(`Account`, `Opportunity`, `PropostaAnaliseCredito__c`, `Proponente__c`) nas
duas chaves externas usadas, e todas retornaram `totalSize = 0`.

## Decisões de design no simulador

- foram criados **dois cenários distintos**, não um cenário genérico;
- a verificação automática do simulador agora cobre:
  - `PROPONENTE_NOT_PRESENT`;
  - `PROPONENTE_COUNT_BY_ID_EXTERNO_IS_ONE`;
  - `PROPOSTA_ANALISE_CREDITO_STATUS_EQUALS_EXPECTED`;
- o helper PAC passou a suportar `pac-update` com e sem `proponentes[]`,
  preservando o mesmo `Id__c` externo entre os steps.
