# Tarefa 8.4 — O05 implementado e validado ao vivo

## Escopo deste incremento

Segunda leva da Tarefa 8.4: implementa e valida ao vivo contra `mrv-devDan`
o perfil **O05** (PAC aprovada reentregue).

## Achado real que exigiu redesenho da cronologia original

O catálogo original descreve O05 com a PAC chegando **antes** de existir
qualquer `Account`/`Opportunity` no Salesforce
(`pac-update EM_ANALISE_CREDITO sem idCliente` → só depois `cliente-insert`).
Antes de codificar o cenário, essa premissa foi testada ao vivo: um
`pac-insert` foi publicado contra uma Opportunity/Account inexistentes.

**Resultado real:** HTTP 400 imediato —
`NotificacaoException: Oportunidade não encontrada`. Nenhum registro é
criado (nem `Proponente__c` órfão); o Apex rejeita a PAC de forma síncrona
quando a `Opportunity` referenciada (`idjornadapac`) não existe. Isso está em
`NotificacaoPAC.cls` (a classe resolve a `Account` do Proponente principal
via `ClienteService.getClienteUnificacaoLead` antes de montar o
`Proponente__c`, e a Opportunity é resolvida antes disso). Confirma, com
evidência real e não apenas leitura de código, que **a cronologia literal do
catálogo (PAC antes de Cliente) é fisicamente impossível** no Apex atual —
consistente com a Regra Crítica nº 5 do plano (validar contra a org real
antes de aceitar qualquer teoria).

## Redesenho do cenário, preservando a intenção do perfil

A intenção central de O05 — "PAC aprovada reentregue" testando semântica
at-least-once — foi preservada assim:

**Cenário:** `pac-aprovada-reentregue-restaura-contato-regredido`

```
Setup: Account + Opportunity sintéticas (pré-requisito real confirmado)
1. pac-insert aprovado (Proponente principal com C/D)      → Account sincroniza para C/D
2. contato-insert (Email C0) via /Cliente                  → Account REGRIDE para C0 (mesmo mecanismo do O13 variante 2)
3. pac-update aprovado REENTREGUE (mesmo id de PAC/Proponente, C/D, dataAlteracao logicamente mais nova)
```

Em vez de reentregar o evento *idêntico* fisicamente (mesmo `id` de
envelope), o teste reentrega a **mesma identidade lógica** (mesmo `id` de
PAC e de Proponente, mesmos dados aprovados) com uma `dataAlteracao`
logicamente mais nova — o que a regra de obsolescência de
`NotificacaoPAC.cls` (`dtNovaNumber < dtExistenteNumber`) já trata como uma
atualização válida, não obsoleta.

## Resultado real observado em `mrv-devDan`

Antes de codificar o cenário formal, a cronologia foi testada
exploratoriamente via chamadas REST diretas replicando os 3 passos. Depois,
o cenário foi codificado no catálogo e a fixture renderizada oficial foi
validada ao vivo de novo, para garantir que o código committed produz
exatamente o mesmo resultado:

- Após o passo 1: Account sincronizada com o e-mail aprovado (confirmado
  indiretamente pela regressão do passo 2).
- Após o passo 2: `PersonEmail` = valor regressivo do MS Cliente (achado
  idêntico ao O13 variante 2).
- Após o passo 3 (reentrega): `PersonEmail` = **valor aprovado da PAC**,
  restaurado. `PersonMobilePhone`/`Celular__c` inalterados (não regrediram,
  pois nenhum `contato-insert` de Celular foi publicado neste cenário).

**Conclusão:** a reentrega de uma PAC aprovada **cura** divergências
introduzidas por eventos independentes do MS Cliente que chegam depois —
um resultado positivo de resiliência, consistente com a semântica
at-least-once que o perfil O05 pretendia validar, ainda que por um mecanismo
mais simples (reprocessamento determinístico por `dataAlteracao`) do que a
cronologia elaborada do catálogo original.

## Validação

- `npm test`: 763/763 (761 anteriores + 2 novos testes dedicados).
- `npm run typecheck` / `npm run lint` / `npm run build`: limpos.
- Validação ao vivo contra `mrv-devDan` em duas etapas: (1) teste
  exploratório da premissa "PAC antes de Cliente" (rejeitada, HTTP 400,
  zero resíduo), (2) teste exploratório da cronologia redesenhada via REST
  direto, (3) teste final da fixture oficial renderizada pelo código
  committed. Resultado idêntico nas 3 execuções.
- Resíduo zero confirmado por consulta direta pós-cleanup em cada etapa.

## Nota lateral: bug de encoding em script de validação manual

Durante a etapa exploratória, uma tentativa isolada de criar uma
`Opportunity` via `Invoke-RestMethod` com `StageName = 'Simulação'` falhou
com `JSON_PARSER_ERROR` ("Cannot deserialize instance of picklist from
VALUE_STRING value"). Causa: o `ConvertTo-Json`/`Invoke-RestMethod` do
Windows PowerShell, quando não configurado explicitamente, pode corromper
caracteres acentuados no corpo da requisição dependendo do estado do
console. Corrigido forçando `[System.Text.Encoding]::UTF8.GetBytes(...)` no
corpo antes de enviar. Isso é uma particularidade do script de validação
manual (PowerShell local), não do simulador — o simulador em Node.js/Next.js
não tem esse problema (usa `fetch`/`JSON.stringify` com UTF-8 nativo). Não
requer nenhuma correção no código do repositório.
