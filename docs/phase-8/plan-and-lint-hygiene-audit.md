# Auditoria de higiene do plano e do lint (2026-09-23)

Auditoria solicitada pelo usuário em duas perguntas sequenciais:

1. "Todas as implementadas do plano anteriores à Fase 7 foram desenvolvidas
   no projeto?"
2. "Todos os achados e sabedoria adquirida nesse chat estão em docs no
   repo? Para que outro agente entre no repo e consiga saber tudo que você
   descobriu aqui."

## Pergunta 1 — as Fases 0-6 foram genuinamente implementadas?

**Resposta: sim.** Evidência cruzada:

- `npm run typecheck` limpo; `npm test` e `npm run build` já confirmados
  verdes em checkpoints anteriores desta sessão.
- `src/db/run-repository.integration.test.ts` usa
  [`@electric-sql/pglite`](https://github.com/electric-sql/pglite) (Postgres
  WASM em memória) com `drizzle-orm/pglite/migrator` para aplicar as
  migrations reais a cada execução de teste — sem depender de Docker,
  `.env.local` ou `DATABASE_URL`. Isso confirma de forma objetiva os
  critérios "Migration sobe em banco vazio" e "Migration pode ser aplicada
  no CI" da Tarefa 1.3, que originalmente pareciam não verificáveis
  localmente (ver [`docs/phase-1/persistence-validation.md`](../phase-1/persistence-validation.md),
  que documentava a validação como pendente por falta de Docker — superada
  pela adoção posterior do PGlite).
- Cada `docs/phase-N/checkpoint.md` (Fases 0, 2, 3, 4) já documentava, à
  época, quais critérios estavam `Concluído` e quais estavam
  `Pendente`/`Concluído preliminar`, com evidência específica por item. A
  Fase 6 já tinha, desde antes desta auditoria, um Checkpoint 6 honesto que
  distingue `[x]` de `[ ]` com justificativa (aprovação de QA e alguns itens
  de Regra 6.6 dependentes da Fase 7).

**Achado real desta pergunta**: o **plano principal**
(`plano-api-simulador-ms-clientes-2.2.md`) nunca teve seus próprios
checkboxes de tarefas/checkpoints das Fases 0-5 marcados como `[x]`,
mesmo quando o trabalho estava concluído e confirmado pelos documentos de
checkpoint dedicados. Isso é uma lacuna de higiene documental, não uma
lacuna de implementação: o trabalho real sempre esteve corretamente
registrado em `docs/phase-N/checkpoint.md`, só não tinha sido
retroativamente refletido no plano principal. A disciplina de manter os
checkboxes do próprio plano sincronizados só passou a ser seguida de forma
consistente a partir da Fase 6/7 desta sessão.

**Correção aplicada**: os checkboxes das Fases 0-5 no plano principal foram
sincronizados nesta auditoria, item a item, cruzando cada um com a
evidência do respectivo `docs/phase-N/checkpoint.md`. Nenhum item foi
marcado `[x]` sem evidência correspondente.

## Pergunta 2 — toda a sabedoria adquirida está descobrível no repo?

Resposta detalhada: nenhum achado técnico relevante estava genuinamente
perdido, mas havia uma lacuna real de **navegabilidade**. Ver a seção
"33. Auditoria de descobribilidade e higiene documental" do plano principal
para o relato completo dessa investigação (índice do README parado na Fase
5, regras críticas de processo dispersas em texto narrativo).

Esta seção documenta especificamente o achado técnico levantado durante essa
investigação que não se encaixava na discussão de navegabilidade em si: o
estado real do lint.

### Achado: `npm run lint` falhava com 41 erros

Ao validar a saúde geral do projeto como parte desta auditoria, rodar
`npm run lint` produzia 41 erros, todos da regra
`@typescript-eslint/no-require-imports`, localizados exclusivamente em:

- `.generated/o10-cjs/**` — saída de build CommonJS gerada para a ferramenta
  de diagnóstico de estresse de concorrência do cenário O10 (Fase 6);
- `scripts/*.cjs` — os próprios scripts standalone que orquestram esse
  diagnóstico.

Nenhum arquivo do código de produção (rotas Next.js, handlers, serviços,
persistência) estava envolvido. A causa raiz é que `eslint.config.mjs`
definia `globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts'])` sem
excluir esses dois caminhos, que são intencionalmente CommonJS (usam
`require()`) porque são ferramentas de diagnóstico standalone, não parte do
bundle Next.js.

Isso divergia do critério de aceite da Tarefa 1.1 ("CI executa todos os
comandos básicos") — hoje, qualquer pipeline que rode `npm run lint`
isoladamente falharia, mesmo com o código de produção limpo.

**Correção aplicada**: `.generated/**` e `scripts/*.cjs` adicionados ao
`globalIgnores` de `eslint.config.mjs`. Após a correção, `npm run lint`
retorna `0 errors` (restam apenas 3 warnings pré-existentes de variáveis não
utilizadas em `scripts/stress-o10-concurrent-events.ts` e
`src/salesforce/test-data-adapter.ts`, que não bloqueiam CI e estão fora do
escopo desta auditoria).

## Conclusão

Ambos os achados desta auditoria eram reais, de baixo risco, e foram
corrigidos no mesmo lote de mudanças: checkboxes sincronizados no plano
principal e `eslint.config.mjs` corrigido. Nenhuma mudança de comportamento
em runtime foi feita — apenas documentação e configuração de tooling.
