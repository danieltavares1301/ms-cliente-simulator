# ADR-0001: Hosting e runtime

## Status

Accepted

## Date

2026-08-22

## Context

O simulador precisa expor APIs HTTP e GraphQL com baixo custo operacional, validação forte e possibilidade de uma interface administrativa futura, sem compartilhar ciclo de vida com o repositório Salesforce.

## Decision

Usar Vercel Functions com Node.js LTS, TypeScript e Next.js Route Handlers. O projeto permanecerá neste diretório independente. A entrada será validada na borda e os contratos serão versionados.

## Alternatives Considered

- **Projeto dentro do repositório Salesforce:** rejeitado por acoplar deploy, dependências e segredos.
- **Servidor dedicado/VM:** rejeitado pelo custo operacional desnecessário para o simulador.
- **JavaScript sem tipos:** rejeitado por reduzir a segurança dos contratos externos.

## Consequences

- Funções devem ser stateless; estado durável não pode depender de memória do processo.
- Limites e timeouts do plano Vercel precisam ser confirmados antes de simular atraso superior ao timeout Salesforce.
- Preview não terá credenciais Salesforce; ambientes e segredos serão isolados.
- A inicialização Node pertence à Fase 1 e não foi executada nesta decisão.
