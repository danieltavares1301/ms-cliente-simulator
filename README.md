# Simulador MS Clientes

Projeto independente para simular, de forma controlada, os contratos do MS Clientes usados pela Unificação 2.2 na sandbox autorizada.

## Estado

A **Fase 0 documental está concluída**. A **Fase 1 — Fundação do projeto**
disponibiliza a base API-only em Next.js/TypeScript, o health, a validação segura
da configuração server-side e o schema PostgreSQL inicial com migration
versionada. O incremento **2.1** publica os contratos Zod e o documento OpenAPI
3.1 antes dos handlers funcionais. Nenhuma metadata Salesforce foi criada ou
alterada.

## Quick Start

Pré-requisito: Node.js LTS compatível com a versão declarada em `package.json`.

```bash
npm install
npm run dev
```

Configure o ambiente conforme a seção abaixo e consulte
`GET http://localhost:3000/api/v1/health`. O projeto não possui página ou
interface web.

## API contract-first

| Endpoint                              | Status       | Observação                                                               |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `GET /api/v1/health`                  | Implementado | Health atual, sem valores de configuração.                               |
| `GET /api/v1/openapi`                 | Implementado | OpenAPI 3.1 gerado em TypeScript e servido da memória.                   |
| `GET /api/v1/scenarios`               | Fase 2       | Somente contrato; catálogo será implementado no próximo incremento.      |
| `GET /api/v1/scenarios/{scenarioKey}` | Fase 2       | Somente contrato de metadados/detalhe.                                   |
| `/api/v1/runs` e sub-recursos         | Futuro       | Criação, consulta, passos, cancelamento e retry não estão implementados. |
| `POST /api/ms-clientes/graphql`       | Futuro       | Contrato `application/graphql`; parser e handler ainda não existem.      |

Cada operação no OpenAPI possui `x-implementation-status` com `implemented`,
`phase-2` ou `future`. O endpoint interno de dispatch não é incluído no
documento público.

Os schemas Zod em `src/contracts/` são estritos na borda pública. O envelope
Event Grid aceita exatamente um dos seis eventos de cliente, contato ou
endereço e exige `idcliente`. `eventTime` e `dataalteracao`, quando presente,
aceitam somente UTC no formato comprovadamente compatível com o Apex
(`yyyy-MM-ddTHH:mm:ss[.000]Z`). O Apex de origem aceita lotes e
`dataalteracao` ausente, mas o simulador restringe a cardinalidade por decisão
do MVP. Frações diferentes de `.000` não são prometidas porque
`EventGrid.parseDateTime` remove explicitamente apenas `.000Z`.

O contrato GraphQL modela o input que o Apex pode emitir, as políticas futuras
e as respostas JSON de sucesso/erro. Ele não altera o `/Cliente`, o GraphQL
existente nem implementa parsing textual.

## Configuração server-side

Use `.env.example` como referência e mantenha valores reais apenas em arquivos
locais ignorados pelo Git ou no gerenciador seguro do ambiente. Nunca versione
URLs com credenciais. O projeto não exige neste incremento tokens Salesforce,
credenciais de client Salesforce nem token QStash.

- `APP_ENV`: `development`, `test` ou `production`; quando omitida, usa
  `development`.
- `TARGET_ENV`: obrigatoriamente `mrv-devDan`.
- `TARGET_SALESFORCE_BASE_URL`: URL HTTPS sem credenciais, query ou fragment.
- `TARGET_SALESFORCE_ORG_ID`: obrigatoriamente `00DHZ000006mzDp2AI`.
- `DATABASE_URL`: URL `postgres` ou `postgresql` com senha não vazia.
- `QSTASH_URL`: URL HTTPS sem credenciais, query ou fragment.

As URLs HTTPS têm a barra final removida durante a normalização. O health valida
a configuração a cada requisição, falha de forma fechada quando ela é inválida
e responde somente com `dependencies.configuration: "ok"` quando válida, sem
retornar valores de ambiente. `npm run build` não exige configuração real nem
acessa as integrações.

## Comandos de desenvolvimento

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
npm run db:generate
npm run db:check
```

## Schema e migrations

O schema tipado está em `src/db/schema.ts` e as migrations geradas ficam em
`drizzle/`. Os comandos de geração e validação são offline: não carregam a
configuração server-side, não abrem conexão e não aplicam alterações em banco.

```bash
npm run db:generate
npm run db:check
```

`db:generate` deve ser idempotente quando o schema não muda. O projeto não
oferece `db:push` intencionalmente: migrations devem ser revisadas e aplicadas
por um fluxo controlado de CI/Neon.

## Documentação

- [Plano técnico](plano-api-simulador-ms-clientes-2.2.md)
- [Matriz de contratos](docs/phase-0/contract-matrix.md)
- [Checkpoint 0](docs/phase-0/checkpoint.md)
- [Validação de persistência da Fase 1](docs/phase-1/persistence-validation.md)
- [Validação do incremento 2.1](docs/phase-2/increment-2.1-validation.md)
- [Escopo de acesso proposto](docs/security/access-scope.md)
- [ADRs](docs/decisions/)

As decisões registradas preservam o isolamento entre ambientes, proíbem PII e segredos no repositório e mantêm qualquer alteração Apex ou de metadata condicionada a aprovação explícita.
