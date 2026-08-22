# Simulador MS Clientes

Projeto independente para simular, de forma controlada, os contratos do MS Clientes usados pela Unificação 2.2 na sandbox autorizada.

## Estado

Versão **0.2.1**. As Fases 0, 1 e 2 estão funcionalmente concluídas. A Fase 2
entrega quatro cenários `CORE` `READY`, fixtures declarativas allowlisted,
renderer determinístico e validação offline de contratos, determinismo e
segredos técnicos. CPF, e-mail, telefone, nome, endereço, CEP e IDs Salesforce
não são classificados pelo scanner por formato ou chave de negócio. Nenhuma metadata
Salesforce foi criada ou alterada; runs, CRUD de banco, QStash e handlers
Salesforce continuam fora deste incremento.

## Quick Start

Pré-requisito: Node.js LTS compatível com a versão declarada em `package.json`.

```bash
npm install
npm run dev
```

Configure o ambiente conforme a seção abaixo e consulte
`GET http://localhost:3000/api/v1/health`. O projeto não possui página ou
interface web.

Exemplos rápidos do catálogo, sem payload bruto:

```bash
curl http://localhost:3000/api/v1/scenarios
curl http://localhost:3000/api/v1/scenarios/match-id-cliente
```

## API contract-first

| Endpoint                              | Status       | Observação                                                               |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `GET /api/v1/health`                  | Implementado | Health atual, sem valores de configuração.                               |
| `GET /api/v1/openapi`                 | Implementado | OpenAPI 3.1 gerado em TypeScript e servido da memória.                   |
| `GET /api/v1/scenarios`               | Implementado | Lista metadados sanitizados dos quatro cenários `CORE` `READY`.          |
| `GET /api/v1/scenarios/{scenarioKey}` | Implementado | Detalhe sanitizado, sem payload renderizado ou CPF.                      |
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
do MVP. As variantes UTC com e sem `.000` foram verificadas na org alvo;
frações diferentes de `.000` não são prometidas. `datanascimento`, quando
presente em eventos de cliente, aceita somente `yyyy-MM-dd`, formato consumido
por `Date.valueOf` no `parseDate` do Apex.

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
npm run validate:scenarios
npm run validate:fixtures
npm run sanitize:export -- <entrada.json> <saida.json>
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
- [Validação do incremento 2.4](docs/phase-2/increment-2.4-validation.md)
- [Checkpoint da Fase 2](docs/phase-2/checkpoint.md)
- [Sanitização opcional de exports](docs/phase-2/secret-sanitization-pipeline.md)
- [Política de validação de dados de negócio](docs/decisions/0005-business-data-validation-policy.md)
- [Escopo de acesso proposto](docs/security/access-scope.md)
- [ADRs](docs/decisions/)

As decisões registradas preservam o isolamento entre ambientes e bloqueiam
segredos técnicos. A API não verifica procedência real/fake de dados de negócio;
responsabilidade operacional, minimização e LGPD continuam aplicáveis. Arquivos
brutos permanecem fora do Git, e qualquer alteração Apex ou de metadata depende
de aprovação explícita.
