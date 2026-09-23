# Tarefa 8.1 — Auditoria de minimização de logs, payload bruto e segredos

## Escopo

Levantamento exaustivo de todos os pontos de log estruturado do simulador
(`console.log`/`console.error`/`console.warn`/`console.info`/`console.debug`
fora de arquivos de teste), avaliando cada um quanto a:

1. vazamento de segredos (tokens, SAS, Bearer, credenciais);
2. vazamento de payload bruto não sanitizado;
3. vazamento de dados livres/PII-adjacentes (texto livre submetido por
   usuários reais, distinto de identificadores/IDs de negócio).

## Metodologia

Busca exaustiva (`Select-String` recursivo em `src/**/*.ts`, excluindo
`*.test.ts`) por todas as chamadas de `console.*`. Resultado: **4 pontos de
log** em todo o código de produção do simulador.

## Achados

### 1. `src/graphql/handler.ts:121` — `console.error`

```ts
console.error('Failed to resume Salesforce lifecycle after GraphQL callback', error);
```

**Avaliação**: loga um objeto `Error` interno (falha ao retomar o lifecycle
após um callback GraphQL já persistido) — não contém payload bruto da
requisição nem segredos. **Sem achado.**

### 2. `src/ms-clientes/pac-credito-handler.ts:133` — `console.log`

Payload logado: `IdSalesforcePac`, `IdPac`, `IdJornada`, `DataCriacao`
(`pacCreditoRequestSchema`) — todos identificadores/IDs de negócio ou
timestamps, sem campo de texto livre. **Sem achado.**

### 3. `src/ms-clientes/contestacao-insert-handler.ts:130` — **achado real (corrigido)**

Payload logado (antes da correção): `...parsed.data`, incluindo o campo
`descricao` — **texto livre submetido por usuários reais**, confirmado em
tráfego real de `mrv-staging` durante a análise de logs da Fase 7
(`docs/staging-logs-analysis.md`), com exemplos como:

- `"mudar de sexo de masculino para feminino"`
- `"mudar o nome de winter 27 teste para WINTER 27 TESTE"`

Como este endpoint recebe tráfego real redirecionado de `mrv-devDan`
(Tarefa 7.0/7.1b), esse texto livre — potencialmente contendo detalhes
pessoais sensíveis do titular dos dados — seria persistido em texto puro no
stream de logs do Vercel, sem nenhuma política de retenção/redação.

**Correção aplicada** (TDD, RED confirmado antes da correção, GREEN depois):
o campo `descricao` é removido do payload logado e substituído por um
booleano `descricaoProvided`, preservando a observabilidade (saber se uma
descrição foi enviada) sem expor o conteúdo.

### 4. `src/ms-clientes/contestacao-documentos-handler.ts:130` — **achado real (corrigido)**

Mesmo padrão do achado 3: o campo `MotivoContestacao` (texto livre,
ex. `"Documento ilegível"`) era logado via `...parsed.data`. Mesma
correção aplicada: campo removido do log, substituído por
`motivoContestacaoProvided`.

## Verificação da camada de persistência (redação já existente)

A camada de orquestração (`src/runs/orchestration.ts`,
`src/db/drizzle-run-repository.ts`) já usa `requestRedacted`/
`responseRedacted` para armazenar apenas metadados de transporte
(`eventId`, `eventType`, `expectedHttpStatus`, `transport`, código de
status) em vez do payload bruto do evento — implementado desde a Fase 3
(`docs/phase-3/*`). O envelope completo (`eventEnvelope`) é armazenado
separadamente e nunca inclui segredos (o envelope é gerado pelo próprio
simulador a partir de fixtures sintéticas).

Nenhum segredo (SAS token, Bearer, client secret) é logado em nenhum ponto
verificado — os handlers de callback (`pac-credito`, `contestacao-*`)
validam o header `Authorization` apenas estruturalmente (prefixo), sem
nunca incluí-lo no log, e os testes de cada handler já afirmam
explicitamente `expect(rawLog).not.toContain('Bearer'/'SharedAccessSignature')`.

## Conclusão

- **2 achados reais corrigidos** (vazamento de texto livre em 2 dos 4 pontos
  de log de produção), com TDD completo e sem regressão (755/755 testes).
- **2 pontos sem achado** (já seguros).
- Nenhum segredo foi encontrado em nenhum ponto de log.
- A camada de persistência de runs já segue disciplina de redação desde a
  Fase 3, consistente com esta auditoria.

Este item do critério de aceite da Tarefa 8.1 ("logs passam por revisão de
minimização, payload bruto e segredos") está **concluído**.
