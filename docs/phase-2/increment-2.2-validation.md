# Validação do incremento 2.2

## RED registrado

Em 2026-08-22, os testes foram escritos e executados antes da implementação com
`npm.cmd test -- src/scenarios/catalog.test.ts src/scenarios/routes.test.ts
src/contracts/api-contracts.test.ts src/openapi.test.ts`.

O RED falhou como esperado: as rotas e o catálogo ainda não existiam, o schema
de detalhe estava ausente, os metadados rejeitavam `description` e
`availability`, e o OpenAPI ainda marcava scenarios como `phase-2`. Resultado:
4 arquivos falharam, com 4 testes falhos, 18 aprovados e 2 suites sem coleta.

## Escopo e segurança

- O catálogo contém quatro skeletons `CORE`, versão 1, com disponibilidade
  `CONTRACT_ONLY`; templates completos pertencem ao incremento 2.4.
- Definições são validadas no import e no `prebuild`, ordenadas por identidade
  `key@version` e congeladas recursivamente.
- Listagem não expõe templates; detalhe publica somente variáveis declarativas e
  passos sanitizados. Não há banco, fixtures renderizadas, sanitizador ou runs.

## GREEN e quality gates

- teste direcionado: 4 arquivos e 34 testes aprovados;
- `npm.cmd run format` e `npm.cmd run format:check`: verdes;
- `npm.cmd run validate:scenarios`: 1 teste aprovado;
- `npm.cmd test`: 8 arquivos e 65 testes aprovados;
- `npm.cmd run lint` e `npm.cmd run typecheck`: verdes;
- `npm.cmd run build`: verde, incluindo `validate:scenarios` no `prebuild`;
- `npm.cmd run db:generate`, duas vezes: nenhuma alteração; `db:check`: verde;
- `npm.cmd audit --audit-level=high`: verde para high/critical; permanecem quatro
  vulnerabilidades moderadas transitivas de `drizzle-kit`, cuja correção
  automática exige alteração incompatível.
