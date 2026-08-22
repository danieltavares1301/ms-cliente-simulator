# Simulador MS Clientes

Projeto independente para simular, de forma controlada, os contratos do MS Clientes usados pela Unificação 2.2 na sandbox autorizada.

## Estado

A **Fase 0 documental está concluída**. O primeiro incremento da **Fase 1 —
Fundação do projeto** disponibiliza a base API-only em Next.js/TypeScript e o
health básico. Nenhuma metadata Salesforce foi criada ou alterada.

## Quick Start

Pré-requisito: Node.js LTS compatível com a versão declarada em `package.json`.

```bash
npm install
npm run dev
```

Consulte `GET http://localhost:3000/api/v1/health`. O projeto não possui página
ou interface web.

O arquivo `.env.example` documenta a configuração deste incremento. Ainda não
há variáveis obrigatórias; validação completa de ambiente, banco e QStash serão
implementados em incrementos posteriores.

## Comandos da Fase 1

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run format:check
npm run typecheck
npm test
npm run test:watch
```

## Documentação

- [Plano técnico](plano-api-simulador-ms-clientes-2.2.md)
- [Matriz de contratos](docs/phase-0/contract-matrix.md)
- [Checkpoint 0](docs/phase-0/checkpoint.md)
- [Escopo de acesso proposto](docs/security/access-scope.md)
- [ADRs](docs/decisions/)

As decisões registradas preservam o isolamento entre ambientes, proíbem PII e segredos no repositório e mantêm qualquer alteração Apex ou de metadata condicionada a aprovação explícita.
