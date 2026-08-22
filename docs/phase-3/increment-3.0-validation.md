# Validação do incremento 3.0

## RED registrado

Em 2026-08-22, os testes foram escritos e executados antes da implementação:

```bash
npm test -- src/config/server-env.test.ts src/health.test.ts src/db/schema.test.ts src/db/idempotency.test.ts src/db/runtime.test.ts src/db/run-repository.integration.test.ts
```

O RED teve 2 suítes sem coleta e 19 testes falhos. As causas observadas foram:
módulos de idempotência/repository/runtime inexistentes, PGlite ainda não
instalado, feature gate ausente, health sem o novo estado e schema sem
fingerprint/enum de passos.

## Migration e implementação

- migration incremental: `drizzle/0001_sleepy_magneto.sql`;
- runtime: Neon serverless + Drizzle `neon-http`, criado somente sob demanda;
- domínio e interface `RunRepository` separados do schema Drizzle;
- implementação com create/find/list/steps/audit e compare-and-set de status;
- HMAC-SHA256 para chave e SHA-256 de JSON canônico para fingerprint;
- recovery idempotente documentado, sem alegar transação interativa;
- nenhum endpoint de runs e nenhuma integração QStash neste incremento.

## GREEN e gates

O teste direcionado após a implementação aprovou 7 arquivos e 70 testes,
incluindo aplicação de `0000` + `0001` em bancos PGlite vazios.

- suíte completa: 17 arquivos e 146 testes aprovados;
- integração PGlite: migration real, constraints, CRUD, paginação, auditoria,
  compare-and-set de run/passo, concorrência, replay, conflito e recovery;
- `lint`, `typecheck` e `format:check`: verdes, sem warnings;
- `validate:scenarios`: 1 teste aprovado;
- `validate:fixtures`: 4 fixtures aprovadas;
- build Next.js de produção: verde e sem conexão externa;
- `db:generate`: executado duas vezes, sem nova alteração;
- `db:migrate:check`: verde;
- `db:migrate` sem `DATABASE_URL`: recusado como esperado;
- `npm audit --audit-level=high`: exit code zero para high/critical. Permanecem
  quatro vulnerabilidades moderadas transitivas do `drizzle-kit`; a correção
  automática sugerida faria downgrade incompatível e não foi aplicada.

## Limitações verificadas

- PGlite não valida rede, TLS, latência ou disponibilidade do Neon.
- Run, passos e auditoria são instruções separadas; retry com a mesma
  chave/fingerprint é o mecanismo de recuperação.
- O health valida configuração, mas intencionalmente não testa dependências.
- O fluxo manual de migration deve ser executado em branch Neon autorizado.
