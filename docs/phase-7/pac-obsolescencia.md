# PAC obsolescência — variação 2 de 5

## Escopo deste incremento

Esta variação cobre dois níveis distintos de obsolescência no universo `/PAC`,
sempre validados contra a org real `mrv-devDan`:

1. **obsolescência no nível da PAC inteira**: o `pac-update` inteiro é
   descartado quando `dataalteracao` da PAC chega estritamente menor que o
   `DataAlteracaoEventoSTR__c` já persistido;
2. **obsolescência no nível do Proponente**: dentro do mesmo payload, um
   Proponente pode ser ignorado por `dataAlteracao` antiga enquanto outro, com
   `dataAlteracao` mais nova, continua sendo processado normalmente.

## Cenários publicados

### A. `pac-update-obsoleto-nivel-pac`

- setup: `CREATE_SYNTHETIC_ACCOUNT` (`PRIMARY`) + `CREATE_SYNTHETIC_OPPORTUNITY`
- step 1: `pac-insert` não aprovado, com um Proponente principal
- step 2: `pac-update` aprovado, **mesmo `id` da PAC**, mas com
  `dataalteracao` **mais antiga** que a persistida no step 1
- asserts automatizados:
  - PAC continua vinculada à Opportunity
  - `Status__c` continua `EM_ANALISE_CREDITO`
  - `Account.PersonEmail` e `Account.Celular__c` continuam nulos
  - o Proponente original continua único

### B. `pac-update-obsoleto-nivel-proponente`

- setup: duas Accounts sintéticas (`PRIMARY` + `CONTROL`) + Opportunity
- step 1: `pac-insert` não aprovado com **dois** Proponentes principais,
  cada um amarrado a uma Account diferente
- step 2: `pac-update` com `dataalteracao` da PAC **mais nova** que a do step
  1, mas:
  - Proponente da `PRIMARY`: `dataAlteracao` **mais antiga** → deve ser
    ignorado
  - Proponente da `CONTROL`: `dataAlteracao` **mais nova** → deve ser
    atualizado
- asserts automatizados:
  - PAC continua vinculada à Opportunity
  - `PRIMARY` mantém email/celular do step 1
  - `CONTROL` assume email/celular do step 2

## Execução real em `mrv-devDan`

Os dois cenários foram executados com:

- setup real via adapter allowlisted;
- dispatch real em `/services/apexrest/PAC`;
- espera explícita entre os steps;
- queries diretas antes/depois;
- verify automatizado do simulador;
- cleanup real;
- query final de resíduos = `0`.

Arquivo de evidência local da sessão:

- `C:\Users\preda\.copilot\session-state\355f720b-e0f3-4d72-adb5-5a1dc454f1e2\files\pac-obsolescencia-real.json`

---

## Cenário A — `pac-update-obsoleto-nivel-pac`

### Identificadores reais

- `Account.Id__c`: `CLI-SIM-deb6efb569-a1e0676dd7`
- `Opportunity.Id__c`: `OPP-SIM-deb6efb569-a1e0676dd7`
- `PAC.Id__c`: `PAC-SIM-deb6efb569-a1e0676dd7`
- `Proponente.Id__c`: `PROP-SIM-deb6efb569-a1e0676dd7`

### Step 1 — `pac-insert` baseline

`PropostaAnaliseCredito__c` após o insert:

```json
{
  "Id": "a0kHZ00000BLeAbYAL",
  "Id__c": "PAC-SIM-deb6efb569-a1e0676dd7",
  "Oportunidade__c": "006HZ00000TzKQwYAN",
  "Status__c": "EM_ANALISE_CREDITO",
  "DataAlteracaoEventoSTR__c": "2026-09-22T12:29:59.000Z"
}
```

`Proponente__c` após o insert:

```json
{
  "Id": "a0jHZ00000CFfrxYAD",
  "Id__c": "PROP-SIM-deb6efb569-a1e0676dd7",
  "IdCliente__c": "CLI-SIM-deb6efb569-a1e0676dd7",
  "EmailAtualizado__c": "cliente.a1e0676dd7@simulador.mrv.invalid",
  "Celular__c": "11909026624",
  "DataAlteracaoEvento__c": "2026-09-22T12:29:59.000Z"
}
```

`Account` após o insert:

```json
{
  "Id": "001HZ000011Q5rDYAS",
  "Id__c": "CLI-SIM-deb6efb569-a1e0676dd7",
  "PersonEmail": null,
  "PersonMobilePhone": null,
  "Celular__c": null
}
```

### Step 2 — `pac-update` com `dataalteracao` obsoleta na PAC

`PropostaAnaliseCredito__c` após o update obsoleto:

```json
{
  "Id": "a0kHZ00000BLeAbYAL",
  "Id__c": "PAC-SIM-deb6efb569-a1e0676dd7",
  "Oportunidade__c": "006HZ00000TzKQwYAN",
  "Status__c": "EM_ANALISE_CREDITO",
  "DataAlteracaoEventoSTR__c": "2026-09-22T12:29:59.000Z"
}
```

`Proponente__c` após o update obsoleto:

```json
{
  "Id": "a0jHZ00000CFfrxYAD",
  "Id__c": "PROP-SIM-deb6efb569-a1e0676dd7",
  "IdCliente__c": "CLI-SIM-deb6efb569-a1e0676dd7",
  "EmailAtualizado__c": "cliente.a1e0676dd7@simulador.mrv.invalid",
  "Celular__c": "11909026624",
  "DataAlteracaoEvento__c": "2026-09-22T12:29:59.000Z"
}
```

`Account` após o update obsoleto:

```json
{
  "Id": "001HZ000011Q5rDYAS",
  "Id__c": "CLI-SIM-deb6efb569-a1e0676dd7",
  "PersonEmail": null,
  "PersonMobilePhone": null,
  "Celular__c": null
}
```

### Resultado real observado

- `dispatch /PAC` retornou **200** nos dois steps;
- a PAC **não** aceitou o segundo `dataalteracao`:
  `DataAlteracaoEventoSTR__c` permaneceu
  `2026-09-22T12:29:59.000Z`;
- `Status__c` permaneceu `EM_ANALISE_CREDITO` (não virou
  `CREDITO_APROVADO_CONDICIONADO`);
- o `Proponente__c` original permaneceu intacto;
- a Account seguiu sem email/celular;
- `verify.passed = true`;
- cleanup real removeu 4 registros e a query final confirmou `totalSize = 0`
  para PAC, Proponente e Account.

Conclusão: a teoria foi confirmada exatamente como descrita no Apex — quando a
obsolescência acontece no **nível da PAC**, o payload inteiro é descartado
silenciosamente.

---

## Cenário B — `pac-update-obsoleto-nivel-proponente`

### Identificadores reais

- `Account PRIMARY.Id__c`: `CLI-SIM-a5555a3d2e-8d4b5996d6`
- `Account CONTROL.Id__c`: `CLI-SIM-X-a5555a3d2e-8d4b5996d6`
- `Opportunity.Id__c`: `OPP-SIM-a5555a3d2e-8d4b5996d6`
- `PAC.Id__c`: `PAC-SIM-a5555a3d2e-8d4b5996d6`
- `Proponente PRIMARY.Id__c`: `PROP-SIM-a5555a3d2e-8d4b5996d6`
- `Proponente CONTROL.Id__c`: `PROP-SIM-X-a5555a3d2e-8d4b5996d6`

### Step 1 — `pac-insert` com dois Proponentes principais

`PropostaAnaliseCredito__c` após o insert:

```json
{
  "Id": "a0kHZ00000BLdPtYAL",
  "Id__c": "PAC-SIM-a5555a3d2e-8d4b5996d6",
  "Oportunidade__c": "006HZ00000TzEqCYAV",
  "Status__c": "EM_ANALISE_CREDITO",
  "DataAlteracaoEventoSTR__c": "2026-09-22T12:44:59.000Z"
}
```

`Proponentes__c` após o insert:

```json
[
  {
    "Id": "a0jHZ00000CFftZYAT",
    "Id__c": "PROP-SIM-a5555a3d2e-8d4b5996d6",
    "IdCliente__c": "CLI-SIM-a5555a3d2e-8d4b5996d6",
    "EmailAtualizado__c": "cliente.8d4b5996d6@simulador.mrv.invalid",
    "Celular__c": "11972240497",
    "DataAlteracaoEvento__c": "2026-09-22T12:44:59.000Z"
  },
  {
    "Id": "a0jHZ00000CFftaYAD",
    "Id__c": "PROP-SIM-X-a5555a3d2e-8d4b5996d6",
    "IdCliente__c": "CLI-SIM-X-a5555a3d2e-8d4b5996d6",
    "EmailAtualizado__c": "cliente-x.8d4b5996d6@simulador.mrv.invalid",
    "Celular__c": "11996017205",
    "DataAlteracaoEvento__c": "2026-09-22T12:44:59.000Z"
  }
]
```

### Step 2 — `pac-update` com um Proponente obsoleto e outro válido

`PropostaAnaliseCredito__c` após o update:

```json
{
  "Id": "a0kHZ00000BLdPtYAL",
  "Id__c": "PAC-SIM-a5555a3d2e-8d4b5996d6",
  "Oportunidade__c": "006HZ00000TzEqCYAV",
  "Status__c": "EM_ANALISE_CREDITO",
  "DataAlteracaoEventoSTR__c": "2026-09-22T12:45:05.000Z"
}
```

`Proponentes__c` após o update:

```json
[
  {
    "Id": "a0jHZ00000CFftZYAT",
    "Id__c": "PROP-SIM-a5555a3d2e-8d4b5996d6",
    "IdCliente__c": "CLI-SIM-a5555a3d2e-8d4b5996d6",
    "EmailAtualizado__c": "cliente.8d4b5996d6@simulador.mrv.invalid",
    "Celular__c": "11972240497",
    "DataAlteracaoEvento__c": "2026-09-22T12:44:59.000Z"
  },
  {
    "Id": "a0jHZ00000CFftaYAD",
    "Id__c": "PROP-SIM-X-a5555a3d2e-8d4b5996d6",
    "IdCliente__c": "CLI-SIM-X-a5555a3d2e-8d4b5996d6",
    "EmailAtualizado__c": "pac.8d4b5996d6@simulador.mrv.invalid",
    "Celular__c": "11934122276",
    "DataAlteracaoEvento__c": "2026-09-22T12:45:05.000Z"
  }
]
```

### Resultado real observado

- `dispatch /PAC` retornou **200** nos dois steps;
- a PAC **aceitou** o update do step 2 no nível global:
  `DataAlteracaoEventoSTR__c` avançou de
  `2026-09-22T12:44:59.000Z` para `2026-09-22T12:45:05.000Z`;
- o Proponente da `PRIMARY` permaneceu com os valores do step 1
  (`cliente.8d4b5996d6@simulador.mrv.invalid` / `11972240497`);
- o Proponente da `CONTROL` foi atualizado com os valores do step 2
  (`pac.8d4b5996d6@simulador.mrv.invalid` / `11934122276`);
- `verify.passed = true`;
- cleanup real removeu 6 registros e a query final confirmou `totalSize = 0`
  para PAC, Proponentes e Accounts.

Conclusão: a teoria também foi confirmada aqui — a obsolescência é avaliada
**por Proponente individual**, não em bloco. O payload foi processado, a PAC
persistiu o timestamp novo, mas apenas o Proponente com `dataAlteracao` mais
nova foi atualizado.

## Decisão de design derivada

Para representar esse comportamento no simulador, o adapter passou a:

- consultar todos os `Proponente__c` owned da fixture PAC por `Id__c`, e não só
  o principal;
- aceitar cleanup owned com múltiplos `idExterno`/`idCliente`;
- expor checks específicos para o Proponente da `PRIMARY` e da `CONTROL`,
  permitindo provar cenários mistos no mesmo payload.

## Resumo final desta variação

- **Cenário A:** PAC obsoleta → payload inteiro descartado.
- **Cenário B:** PAC válida + Proponente misto → PAC persiste, um Proponente é
  ignorado e o outro é atualizado.

Isso fecha a **variação 2 de 5** do bloco `pac-update-*`.
