# Validação de persistência — Fase 1

## Escopo deste incremento

- schema PostgreSQL tipado em Drizzle;
- migration SQL inicial gerada e versionada;
- contratos puros para tabelas, colunas, enums, chaves, unicidade e checks;
- validação estrutural das migrations com `drizzle-kit check`.

Não foram criados conexão ativa, repositórios, CRUD, integração Salesforce,
QStash ou callbacks HTTP.

## Evidências locais

A geração e a validação estrutural são executadas offline:

```bash
npm run db:generate
npm run db:check
npm test
```

O host local não dispõe de Docker. Portanto, nenhuma aplicação da migration em
PostgreSQL real foi executada ou deve ser inferida a partir dessas evidências.

## Validação pendente

Na próxima etapa de validação, a migration deverá ser aplicada por CI em uma
instância PostgreSQL descartável ou em um branch Neon autorizado. Esse fluxo
deverá registrar aplicação, rollback/recriação e inspeção das constraints. Esta
validação permanece **pendente** e não está marcada como executada neste
checkpoint.
