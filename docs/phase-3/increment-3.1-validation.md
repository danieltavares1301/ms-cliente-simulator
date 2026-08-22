# Validação do incremento 3.1

## RED registrado

Em 2026-08-22, os testes de handlers, serviço e repository foram escritos e
executados antes da implementação:

```bash
npm test -- src/runs/orchestration.test.ts src/runs/handlers.test.ts src/db/run-repository.integration.test.ts
```

O RED teve três arquivos falhos: duas suítes não foram coletadas porque
`handlers` e `orchestration` ainda não existiam, e três testes PGlite falharam
porque filtros e paginação de passos ainda não estavam implementados.

Na retomada do trabalho parcial, dois testes adicionais registraram RED para o
contrato `<uuid>` de `Idempotency-Key`: o handler aceitava uma chave textual e o
OpenAPI não declarava `format: uuid`. Ambos passaram após alinhar schema e
documento ao plano.

## API e segurança

- `POST /api/v1/runs`;
- `GET /api/v1/runs`;
- `GET /api/v1/runs/{runId}`;
- `GET /api/v1/runs/{runId}/steps`.

Com a feature desligada, esses endpoints retornam `503
ORCHESTRATION_DISABLED` antes de construir o repository. Com a feature ligada,
um único bearer token é obrigatório. Headers ausentes, duplicados, combinados,
malformados ou inválidos recebem o mesmo `401`; a comparação usa digests de
tamanho fixo e `timingSafeEqual`.

O ator persistido é o identificador técnico constante
`simulator-admin-api`, nunca o token. Respostas usam `Cache-Control: no-store`,
erros uniformes e não incluem request/body bruto, token, fingerprint ou hash de
idempotência.

## Orquestração e idempotência

O serviço valida cenário/versão `READY`, variáveis declarativas e o
`eventStartAt` UTC antes de renderizar. O UUID do run é gerado antes da fixture.
O fingerprint SHA-256 usa o body validado, timestamp normalizado e serialização
canônica; a chave é armazenada somente como HMAC-SHA256.

Mesmo ator, chave e body retornam o run original sem duplicar passos. A mesma
chave com body diferente retorna `409`. Os passos são derivados da fixture,
mas persistem somente metadados e IDs técnicos; envelopes e payloads não são
armazenados.

`dryRun=true` não chama scheduler, publisher, Salesforce, setup, verify,
cleanup nem qualquer dependência externa. Ele pode persistir run/passos para
auditoria e retorna preview autenticado sem payload bruto. Neste critério,
“records” significa registros Salesforce, não os registros de auditoria do
run.

`Scheduler` e `DispatchPublisher` são interfaces para o próximo incremento.
Não há QStash. Em produção, `dryRun=false` retorna `503
SCHEDULER_NOT_CONFIGURED` antes de abrir o repository ou persistir o run. Testes
podem injetar um scheduler fake.

## GREEN e gates

- RED direcionado: 2 suítes sem coleta e 3 testes falhos;
- RED da retomada: 2 testes falhos antes da correção do contrato UUID;
- teste direcionado após implementação: 3 arquivos e 20 testes aprovados;
- teste UUID/OpenAPI após correção: 2 arquivos e 19 testes aprovados;
- suíte completa: 19 arquivos e 162 testes aprovados;
- `npm run lint`, `npm run typecheck` e `npm run format:check`: aprovados;
- `npm run build`: aprovado, incluindo prebuild e as três rotas de runs;
- `validate:scenarios`, `validate:fixtures`, `db:check` e
  `db:migrate:check`: aprovados sem rede;
- `npm audit --offline --audit-level=high`: 0 vulnerabilidades.

Nenhuma migration Neon, rede externa, código Apex ou metadata Salesforce foi
alterada.

## Limitações

- PGlite valida PostgreSQL local, não rede/TLS Neon.
- Dispatch, QStash, cancelamento e retry permanecem futuros.
- A interface injetável permite testar non-dry; o handler de produção
  intencionalmente não configura scheduler neste incremento.
