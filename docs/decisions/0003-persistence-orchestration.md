# ADR-0003: Persistência e orquestração

## Status

Accepted

## Date

2026-08-22

## Context

Os cenários precisam sobreviver a reinícios serverless, preservar ordem, reagendar passos, correlacionar callbacks e aguardar Queueable/Future antes das assertions. Memória de Function e timers locais não oferecem essas garantias.

## Decision

Usar Neon PostgreSQL como fonte durável de runs, passos, tentativas e callbacks; usar Upstash QStash para dispatch assinado, atraso e reentrega. Cada passo será idempotente e cada mensagem terá correlação persistida. Sequências imediatas usam o mesmo orquestrador.

## Alternatives Considered

- **Somente memória da Function:** rejeitada por perda de estado e concorrência.
- **`setTimeout` na Function:** rejeitado porque não sobrevive ao encerramento do runtime.
- **Banco sem fila durável:** rejeitado por exigir polling/agendador próprio e enfraquecer reentrega.
- **QStash como fonte de verdade:** rejeitado; entrega não substitui estado transacional e auditoria.

## Consequences

- Dispatch interno exige assinatura QStash válida e deduplicação.
- HTTP `200` do Apex não conclui necessariamente o run; o estado pode aguardar assíncronos/callback.
- Banco e fila não armazenam PII real nem payload bruto; retenção e redaction serão aplicadas.
- Indisponibilidade parcial deve produzir estado auditável, sem duplicar efeitos.
