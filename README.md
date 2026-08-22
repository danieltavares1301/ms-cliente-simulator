# Simulador MS Clientes

Projeto independente para simular, de forma controlada, os contratos do MS Clientes usados pela Unificação 2.2 na sandbox autorizada.

## Estado

Versão **0.3.0**. O incremento 3.3 adiciona cancelamento e retry administrativos,
máquina de estados pura e auditoria sanitizada. O cancelamento usa
`client.messages.cancel`, e retries preservam tentativas anteriores. Os quatro
cenários `CORE` permanecem `READY`; callback/verifier e qualquer Salesforce real
continuam fora deste incremento.

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

| Endpoint                                  | Status       | Observação                                                                           |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `GET /api/v1/health`                      | Implementado | Health atual, sem valores de configuração.                                           |
| `GET /api/v1/openapi`                     | Implementado | OpenAPI 3.1 gerado em TypeScript e servido da memória.                               |
| `GET /api/v1/scenarios`                   | Implementado | Lista metadados sanitizados dos quatro cenários `CORE` `READY`.                      |
| `GET /api/v1/scenarios/{scenarioKey}`     | Implementado | Detalhe sanitizado, sem payload renderizado ou CPF.                                  |
| `POST /api/v1/runs`                       | Implementado | Criação/replay idempotente; non-dry agenda QStash e `dryRun` publica zero mensagens. |
| `GET /api/v1/runs`                        | Implementado | Listagem paginada com filtros seguros e máximo de 100 itens.                         |
| `GET /api/v1/runs/{runId}`                | Implementado | Estado sanitizado de uma execução.                                                   |
| `GET /api/v1/runs/{runId}/steps`          | Implementado | Passos sanitizados, paginados e ordenados.                                           |
| `POST /api/v1/runs/{runId}/cancellations` | Implementado | Cancelamento idempotente de mensagens pendentes; `RUNNING` não reabre o run.         |
| `POST /api/v1/runs/{runId}/retries`       | Implementado | Nova tentativa somente para steps `FAILED`, com histórico preservado.                |
| `POST /api/ms-clientes/graphql`           | Futuro       | Contrato `application/graphql`; parser e handler ainda não existem.                  |

Cada operação no OpenAPI possui `x-implementation-status` com `implemented`,
`phase-2` ou `future`. O endpoint interno de dispatch não é incluído no
documento público.

### Runs administrativos

Com `ORCHESTRATION_ENABLED=false`, todos os endpoints de runs retornam `503
ORCHESTRATION_DISABLED` antes de acessar banco ou integrações; health e catálogo
continuam disponíveis. Quando habilitados, exigem um único header
`Authorization: Bearer <SIMULATOR_ADMIN_API_KEY>`. A chave nunca é usada como
`requestedBy`, persistida ou retornada.

Exemplo de `dryRun`, sem segredo literal:

```bash
curl -X POST http://localhost:3000/api/v1/runs \
  -H "Authorization: Bearer $SIMULATOR_ADMIN_API_KEY" \
  -H "Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{"scenarioKey":"match-id-cliente","scenarioVersion":1,"variables":{"seed":"TC001-A","eventStartAt":"2026-08-21T10:00:00Z"},"execution":{"dryRun":true,"speed":1,"stopOnFailure":true}}'
```

`dryRun` pode persistir somente metadados de auditoria do run e dos passos. A
expressão “não cria registros” refere-se a registros Salesforce: nenhum setup,
verify, cleanup, agendamento ou publicação externa é executado. O preview
autenticado não inclui envelopes/payloads brutos.

Runs com `dryRun=false` usam `QStashRunScheduler` quando a feature está ligada.
O destino é sempre derivado de `PUBLIC_APP_BASE_URL`; falhas parciais ficam
visíveis como `PARTIAL`/`FAILED` e em auditoria, sem rollback fictício. O
receiver interno aceita somente assinatura QStash e não é publicado no OpenAPI.
`dryRun=true` continua sem construir cliente ou publicar mensagens.

Cancelamento aceita corpo vazio ou `{ "reasonCode": "OPERATOR_REQUEST" }`;
valores possíveis são `OPERATOR_REQUEST`, `INCIDENT_RESPONSE` e `SUPERSEDED`.
Retry aceita corpo vazio ou `{ "stepKeys": ["cliente-update"] }`. Não há texto
livre. Runs `SUCCEEDED`, `FAILED` e `PARTIAL` não são canceláveis; `FAILED` e
`PARTIAL` podem reservar retry de steps `FAILED`. Falha ao cancelar no QStash
mantém `CANCELLING` com auditoria técnica, sem falso `CANCELLED`.

Claims de agendamento inicial e reservas de retry usam leases UTC persistidas.
Replays não publicam durante uma lease válida; após expiração, um CAS retoma
somente steps sem `qstashMessageId`, preservando o mesmo número de tentativa em
retries. O `deduplicationId` QStash permanece determinístico, mas não é a única
garantia: há uma janela at-least-once entre publicar e persistir o `messageId`,
na qual uma republicação pode ocorrer. O claim idempotente do dispatch torna a
duplicata segura. Mensagens publicadas nessa janela não podem ser canceladas por
ID enquanto o ID não tiver sido persistido; late dispatch/cancel convergem pelo
estado durável, sem reabrir steps terminais.

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
URLs com credenciais. O projeto não exige tokens Salesforce nem credenciais de
client Salesforce.

- `APP_ENV`: `development`, `test` ou `production`; quando omitida, usa
  `development`.
- `TARGET_ENV`: obrigatoriamente `mrv-devDan`.
- `TARGET_SALESFORCE_BASE_URL`: URL HTTPS sem credenciais, query ou fragment.
- `TARGET_SALESFORCE_ORG_ID`: obrigatoriamente `00DHZ000006mzDp2AI`.
- `DATABASE_URL`: URL `postgres` ou `postgresql` com senha não vazia.
- `QSTASH_URL`: URL HTTPS sem credenciais, query ou fragment.
- `ORCHESTRATION_ENABLED`: `false` por padrão. Quando `true`, exige os segredos
  server-only e a URL pública HTTPS descritos em
  [database-and-feature-gate.md](docs/phase-3/database-and-feature-gate.md).

As URLs HTTPS têm a barra final removida durante a normalização. O health valida
a configuração a cada requisição, falha de forma fechada quando ela é inválida
e responde com `dependencies.configuration: "ok"` e
`orchestration: disabled|configured` quando válida, sem retornar valores de
ambiente. `npm run build` não exige configuração real nem acessa integrações.
O `Client` e o `Receiver` QStash são construídos de forma lazy somente durante
agendamento ou recepção com a feature habilitada.

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
npm run db:migrate:check
npm run db:migrate
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
por um fluxo controlado de CI/Neon. `db:migrate` exige `DATABASE_URL` e nunca
roda automaticamente no build/deploy.

## Documentação

- [Plano técnico](plano-api-simulador-ms-clientes-2.2.md)
- [Matriz de contratos](docs/phase-0/contract-matrix.md)
- [Checkpoint 0](docs/phase-0/checkpoint.md)
- [Validação de persistência da Fase 1](docs/phase-1/persistence-validation.md)
- [Validação do incremento 2.1](docs/phase-2/increment-2.1-validation.md)
- [Validação do incremento 2.4](docs/phase-2/increment-2.4-validation.md)
- [Validação do incremento 3.0](docs/phase-3/increment-3.0-validation.md)
- [Validação do incremento 3.1](docs/phase-3/increment-3.1-validation.md)
- [Validação do incremento 3.2](docs/phase-3/increment-3.2-validation.md)
- [Validação do incremento 3.3](docs/phase-3/increment-3.3-validation.md)
- [Checkpoint preliminar da Fase 3](docs/phase-3/checkpoint.md)
- [Banco e feature gate da Fase 3](docs/phase-3/database-and-feature-gate.md)
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
