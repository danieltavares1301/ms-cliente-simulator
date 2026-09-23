# Simulador MS Clientes

Projeto independente para simular, de forma controlada, os contratos do MS Clientes usados pela Unificação 2.2 na sandbox autorizada.

## Estado

Versão **0.5.2**. A Fase 5 entrega a infraestrutura do callback GraphQL
simulado no lado do simulador: parser com AST oficial (`graphql`), políticas de
resposta, correlação com runs recentes por `id`/`idProspectSalesforce`,
persistência sanitizada em `graphql_callback`, feature flag dedicada e endpoint
interno protegido por autenticação configurável. Esta versão também adiciona um
endpoint fake de emissão de token OAuth2 para redirecionamento temporário da
Named Credential compartilhada `ServicoClientes` na sandbox pessoal
autorizada. O target fake continua default; o dispatch real e o Test Data
Adapter da Fase 4 permanecem disponíveis.
Nenhum cenário atual do catálogo dispara esse callback em round-trip real ainda:
os quatro cenários `CORE` seguem com `expectedCallbacks.max = 0`, então esta
fase deixa a infraestrutura pronta e testada para expansões futuras das Fases
6/7. A Tarefa 5.0 (Named Credential/External Credential + alteração
`MSClienteService.cls`) continua fora de escopo deste commit.

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

Cada operação no OpenAPI possui `x-implementation-status` com `implemented`,
`phase-2` ou `future`. Endpoints internos/protegidos (`/api/v1/internal/dispatches`,
`/api/ms-clientes/graphql`, `/api/ms-clientes/token`,
`/api/ms-clientes/pac-credito`, `/api/ms-clientes/contestacao-insert` e
`/api/ms-clientes/contestacao-documentos`) não são publicados no OpenAPI público.

### Emissor fake de token OAuth2

O endpoint `POST /api/ms-clientes/token` existe **somente para desenvolvimento**
e simula uma resposta Client Credentials OAuth2 para viabilizar o
redirecionamento temporário da Named Credential compartilhada
`ServicoClientes` em `mrv-devDan`.

- aceita `application/x-www-form-urlencoded` e tolera corpo ausente/parcial;
- ignora `client_id` e `client_secret` por decisão explícita do fluxo de dev;
- responde `200` com
  `{"access_token":"<GRAPHQL_CALLBACK_SHARED_SECRET>","token_type":"Bearer","expires_in":3600}`;
- fica desligado por padrão e retorna `503 AZURE_TOKEN_SIMULATOR_DISABLED`
  quando `AZURE_TOKEN_SIMULATOR_ENABLED=false`.

> **Risco crítico:** não há autenticação própria além da feature flag. Enquanto
> esse endpoint estiver habilitado, qualquer requisição pública que o atingir
> recebe o valor de `GRAPHQL_CALLBACK_SHARED_SECRET`; isso torna o segredo
> efetivamente público e reduz o modo `SHARED_SECRET` do callback GraphQL a uma
> trava operacional/liga-desliga, não a uma proteção real de segredo. Detalhes
> operacionais, impactos colaterais e rollback estão em
> [`docs/phase-5/servico-clientes-redirect-risks.md`](docs/phase-5/servico-clientes-redirect-risks.md).

### Callback PAC Crédito simulado

O endpoint `POST /api/ms-clientes/pac-credito` existe **somente para
desenvolvimento** e recebe o callback fire-and-forget hoje emitido por
`EnvioPACCreditoQueue.cls` para o Azure Service Bus. Ele:

- exige `Authorization` com prefixo literal `SharedAccessSignature`;
- valida apenas a **estrutura** desse header, não a assinatura criptográfica;
- aceita o JSON Apex com `IdSalesforcePac`, `IdPac`, `IdJornada` opcional/nulo
  e `DataCriacao`;
- responde `201` com `{ "accepted": true, "requestId": "..." }` quando aceita o
  payload;
- registra log estruturado sem expor o header sensível.

O racional, o raio de impacto restrito ao fluxo PAC Crédito e o precedente de
uso de credenciais falsas estão documentados em
[`docs/phase-7/pac-credito-callback-redirect-risks.md`](docs/phase-7/pac-credito-callback-redirect-risks.md).

### Callbacks de Contestação simulados

Os endpoints `POST /api/ms-clientes/contestacao-insert` e
`POST /api/ms-clientes/contestacao-documentos` existem **somente para
desenvolvimento** e recebem os dois callouts fire-and-forget emitidos por
`ContestacaoTriggerHandler.cls` após insert de `Contestacao__c`. Eles:

- exigem `Authorization` com prefixo literal `Bearer `;
- validam apenas a **estrutura** desse header, não o JWT nem a assinatura;
- usam feature flags separadas para rollback granular
  (`CONTESTACAO_INSERT_CALLBACK_ENABLED` e
  `CONTESTACAO_DOCUMENTOS_CALLBACK_ENABLED`, ambas dependentes de
  `ORCHESTRATION_ENABLED=true`);
- aceitam somente payloads JSON estritos com strings opcionais/anuláveis;
- registram logs estruturados com `responseStatusCode`, sem expor o bearer
  recebido.

`contestacao-insert` responde `201` com `{ "id": "..." }`, preservando o
contrato esperado pelo Apex para desserialização de `ContestacaoResponse`.
`contestacao-documentos` responde `201` com
`{ "accepted": true, "requestId": "..." }`, já que o Apex só usa o corpo em
caminhos de erro.

O racional, o incidente real que motivou o redirecionamento e a validação
end-to-end ficam em
[`docs/phase-7/contestacao-callout-real-leak-and-redirect.md`](docs/phase-7/contestacao-callout-real-leak-and-redirect.md).

### Callback GraphQL simulado

O endpoint `POST /api/ms-clientes/graphql` recebe o contrato real confirmado do
Apex via `application/graphql` (ou, opcionalmente, `application/json` com
`{"query": "..."}`), autentica com um segredo exclusivo do simulador e nunca
persiste o body bruto. O parser exige exatamente a mutation anônima
`atualizarCliente(cliente:{...}){id}` e aceita campos em qualquer ordem,
incluindo enums GraphQL sem aspas. A correlação com runs usa
`trim()+uppercase()` sobre `cliente.id`/`cliente.idProspectSalesforce` e busca
somente os **50 runs não-dry mais recentes**, o que é suficiente para o volume
atual do simulador; detalhes e limitações estão em
[`docs/phase-5/graphql-callback.md`](docs/phase-5/graphql-callback.md).

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

O lifecycle Salesforce também usa claims CAS recuperáveis: `SETUP` precede o
agendamento, e uma entrega terminal retoma `VERIFY`/`CLEANUP` sem reenviar o
target. `ALWAYS` executa cleanup mesmo após verify negativo. O resultado final
é `SUCCEEDED` quando dispatch, verify e cleanup passam; `FAILED` quando verify
falha sem falha de cleanup; e `PARTIAL` quando cleanup falha. Runs legados sem
`fixture_snapshot` falham fechados. A fixture nunca é exposta pelas respostas
de listagem/detalhe.

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
URLs com credenciais. Por padrão, o dispatch continua usando o target fake;
nenhuma credencial Salesforce é necessária enquanto
`SALESFORCE_DISPATCH_ENABLED=false`.

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
- `AZURE_TOKEN_SIMULATOR_ENABLED`: `false` por padrão. Só pode ser `true`
  quando `ORCHESTRATION_ENABLED=true` e `GRAPHQL_CALLBACK_SHARED_SECRET` está
  configurado com pelo menos 32 caracteres. Serve apenas para o endpoint fake
  `POST /api/ms-clientes/token`.
- `PAC_CREDITO_CALLBACK_ENABLED`: `false` por padrão. Só pode ser `true`
  quando `ORCHESTRATION_ENABLED=true`. Serve apenas para o endpoint fake
  `POST /api/ms-clientes/pac-credito`.
- `CONTESTACAO_INSERT_CALLBACK_ENABLED`: `false` por padrão. Só pode ser
  `true` quando `ORCHESTRATION_ENABLED=true`. Serve apenas para o endpoint fake
  `POST /api/ms-clientes/contestacao-insert`.
- `CONTESTACAO_DOCUMENTOS_CALLBACK_ENABLED`: `false` por padrão. Só pode ser
  `true` quando `ORCHESTRATION_ENABLED=true`. Serve apenas para o endpoint fake
  `POST /api/ms-clientes/contestacao-documentos`.
- `GRAPHQL_CALLBACK_ENABLED`: `false` por padrão. Só pode ser `true` quando
  `ORCHESTRATION_ENABLED=true`.
- `GRAPHQL_CALLBACK_AUTH_MODE`: opcional; default `SHARED_SECRET`. O operador
  escolhe entre `SHARED_SECRET` e `AZURE_BEARER_STRUCTURAL` por variável de
  ambiente, sem trocar código.
- `GRAPHQL_CALLBACK_SHARED_SECRET`: exigido somente quando
  `AZURE_TOKEN_SIMULATOR_ENABLED=true`, e também quando
  `GRAPHQL_CALLBACK_ENABLED=true` com modo `SHARED_SECRET`; mínimo de 32
  caracteres e exclusivo do simulador.
- `AZURE_BEARER_STRUCTURAL`: existe para o cenário em que a org `mrv-devDan`
  reaproveita a Named Credential compartilhada `VFlexMsClientes` apontando para
  o simulador, enquanto o Apex continua enviando manualmente um Bearer OAuth
  real obtido no Azure AD por outra Named Credential. Nesse modo o simulador
  faz apenas checagem estrutural do JWT (`Bearer`, base64url, `exp`, `iss` com
  indícios de Azure AD); isso **não** substitui validação criptográfica via
  JWKS. Se o callback voltar a ter uma Named Credential dedicada, o modo
  `SHARED_SECRET` continua sendo a recomendação mais segura.
- `SALESFORCE_DISPATCH_ENABLED`: `false` por padrão. Só pode ser `true` quando
  `ORCHESTRATION_ENABLED=true`. O valor é persistido por run; desligar a flag
  depois atua como kill switch (`503`) e nunca redireciona um run Salesforce
  para o target fake. Runs criados em modo fake permanecem fake.
- `SALESFORCE_TEST_DATA_ENABLED`: `false` por padrão. Só pode ser `true` quando
  `ORCHESTRATION_ENABLED=true` e `SALESFORCE_DISPATCH_ENABLED=true`. O adapter
  reutiliza o mesmo OAuth do dispatch e não adiciona segredos.
- `SALESFORCE_CLIENT_ID` e `SALESFORCE_CLIENT_SECRET`: exigidos somente quando
  `SALESFORCE_DISPATCH_ENABLED=true`.
- `SALESFORCE_TOKEN_URL`: exigida somente quando
  `SALESFORCE_DISPATCH_ENABLED=true`; deve ser HTTPS, sem
  credenciais/query/fragment, usar exatamente `/services/oauth2/token` e ter o
  mesmo host do target ou `test.salesforce.com`.

As URLs HTTPS têm a barra final removida durante a normalização. O health valida
a configuração a cada requisição, falha de forma fechada quando ela é inválida
e responde com `dependencies.configuration: "ok"`,
`orchestration: disabled|configured`,
`azureTokenSimulator: disabled|configured`,
`graphqlCallback: disabled|configured` e `testData: disabled|configured`
quando válida, sem retornar valores de ambiente nem testar conexão.
`npm run build` não exige configuração real nem acessa integrações.
O `Client` e o `Receiver` QStash são construídos de forma lazy somente durante
agendamento ou recepção com a feature habilitada. Quando o dispatch real é
ligado, requests Salesforce não seguem redirects, expiram em 30 segundos, e o
token OAuth fica apenas em memória do processo e é invalidado sob
demanda após `401`, já que o fluxo Client Credentials do Salesforce não expõe
`expires_in` de forma confiável nesse cenário.

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

- [Plano técnico](plano-api-simulador-ms-clientes-2.2.md) — inclui a seção
  "Regras críticas" (leitura obrigatória antes de qualquer trabalho no
  projeto).
- [Análise de logs reais de `mrv-staging`](docs/staging-logs-analysis.md) —
  documento mais denso em evidência real: taxas de erro observadas, casos de
  drift de versão `mrv-staging`/`mrv-devDan` e a base de toda a Tarefa 7.2.
- [Catálogo de ordens de eventos do MS Cliente no Pós-PAC](docs/catalogo-ordens-eventos-ms-cliente-pos-pac.md) —
  contrato funcional original (15 ordens `O01`–`O15`), com adendo mapeando
  cada ordem ao estado real de implementação no catálogo de cenários.

### Fase 0 — Validação e configuração técnica

- [Checkpoint 0](docs/phase-0/checkpoint.md)
- [Matriz de contratos](docs/phase-0/contract-matrix.md)

### Fase 1 — Fundação do projeto

- [Validação de persistência da Fase 1](docs/phase-1/persistence-validation.md)

### Fase 2 — Contratos e fixtures

- [Checkpoint da Fase 2](docs/phase-2/checkpoint.md)
- [Validação do incremento 2.1](docs/phase-2/increment-2.1-validation.md)
- [Validação do incremento 2.2](docs/phase-2/increment-2.2-validation.md)
- [Validação do incremento 2.3](docs/phase-2/increment-2.3-validation.md)
- [Validação do incremento 2.4](docs/phase-2/increment-2.4-validation.md)
- [Resolução de review da Fase 2](docs/phase-2/review-resolution.md)
- [Sanitização opcional de exports](docs/phase-2/secret-sanitization-pipeline.md)

### Fase 3 — Orquestração de runs

- [Checkpoint preliminar da Fase 3](docs/phase-3/checkpoint.md)
- [Banco e feature gate da Fase 3](docs/phase-3/database-and-feature-gate.md)
- [Validação do incremento 3.0](docs/phase-3/increment-3.0-validation.md)
- [Validação do incremento 3.1](docs/phase-3/increment-3.1-validation.md)
- [Validação do incremento 3.2](docs/phase-3/increment-3.2-validation.md)
- [Validação do incremento 3.3](docs/phase-3/increment-3.3-validation.md)
- [Resolução de review da Fase 3](docs/phase-3/review-resolution.md)

### Fase 4 — Integração Salesforce

- [Checkpoint parcial da Fase 4](docs/phase-4/checkpoint.md)
- [Test Data Adapter da Fase 4](docs/phase-4/test-data-adapter.md)
- [Lifecycle do Test Data Adapter](docs/phase-4/lifecycle.md)
- [Resolução de review da Fase 4](docs/phase-4/review-resolution.md)

### Fase 5 — GraphQL simulado

- [Callback GraphQL simulado da Fase 5](docs/phase-5/graphql-callback.md)
- [Riscos de redirecionamento do `ServicoClientes`](docs/phase-5/servico-clientes-redirect-risks.md)

### Fase 6 — Cenários de regressão 2.2 (MVP)

- [O01 — CPF divergente, contato primeiro](docs/phase-6/o01-cpf-divergente-contato-primeiro.md)
- [Cliente-insert com prospect divergente](docs/phase-6/cliente-insert-prospect-divergente.md)
- [Contato antes de cliente (colisão)](docs/phase-6/contato-antes-cliente-colisao.md)
- [O03 — Mesmo `eventTime`](docs/phase-6/o03-mesmo-eventtime.md)
- [O08 — CPF divergente, identidade antiga](docs/phase-6/o08-cpf-divergente-identidade-antiga.md)
- [O10 — Stress de concorrência](docs/phase-6/o10-stress-concorrencia.md)
- [O14 — Evento duplicado e obsoleto](docs/phase-6/o14-evento-duplicado-e-obsoleto.md)
- [Falhas GraphQL e echo de prospect](docs/phase-6/graphql-falhas-e-echo-prospect.md)
- [Bugfix: mismatch de datetime no replay de Account](docs/phase-6/bugfix-account-replay-datetime-mismatch.md)
- [Bugfix: resume de verify/callback assíncrono](docs/phase-6/bugfix-async-callback-verify-resume.md)
- [Bugfix: suposição de índice no setup de Lead](docs/phase-6/bugfix-lead-setup-index-assumption.md)
- [Bugfix: passos multi-instrução fora de ordem](docs/phase-6/bugfix-multi-instruction-steps-out-of-order.md)
- [Bugfix: corrida de `WAITING_ASYNC` com dispatch múltiplo](docs/phase-6/bugfix-waiting-async-race-multi-dispatch.md)

### Fase 7 — Extensão PAC, Máquina de Estado e Opportunity

- [Risco real de vazamento e redirecionamento de callout de Contestação](docs/phase-7/contestacao-callout-real-leak-and-redirect.md)
- [Riscos de redirecionamento do callback PAC Crédito](docs/phase-7/pac-credito-callback-redirect-risks.md)
- [`/PAC` — smoke test de insert mínimo](docs/phase-7/pac-insert-minimo-smoke-test.md)
- [`/PAC` — update básico](docs/phase-7/pac-update-basico.md)
- [`/PAC` — obsolescência](docs/phase-7/pac-obsolescencia.md)
- [`/PAC` — aprovada sincroniza contatos](docs/phase-7/pac-aprovada-sincroniza-contatos.md)
- [`/PAC` — conflito de proponentes principais](docs/phase-7/pac-conflito-proponentes-principais.md)
- [`/PAC` — contestação pendente](docs/phase-7/pac-contestacao-pendente.md)
- [`/PAC` — perdido força cancelado](docs/phase-7/pac-perdido-forca-cancelado.md)
- [O08 — reteste com PAC aprovada](docs/phase-7/o08-retest-pac-aprovada.md)
- [`/MaquinaEstado` — insert mínimo](docs/phase-7/maquina-estado-insert-minimo.md)
- [`/MaquinaEstado` — sem cliente](docs/phase-7/maquina-estado-sem-cliente.md)
- [`/MaquinaEstado` — update](docs/phase-7/maquina-estado-update.md)
- [`/MaquinaEstado` — reentrega](docs/phase-7/maquina-estado-reentrega.md)
- [`/MaquinaEstado` — evento obsoleto](docs/phase-7/maquina-estado-evento-obsoleto.md)
- [`/MaquinaEstado` — estado não reconhecido](docs/phase-7/maquina-estado-estado-nao-reconhecido.md)
- [`/MaquinaEstado` — troca de unidade](docs/phase-7/maquina-estado-troca-unidade.md)
- [Tarefa 7.3 — corridas cross-endpoint E2E](docs/phase-7/tarefa-7-3-corridas-e2e.md)

### Fase 8 — Operação e entrega

- [Auditoria de minimização de logs](docs/phase-8/log-minimization-audit.md)
- [Auditoria de higiene do plano e do lint](docs/phase-8/plan-and-lint-hygiene-audit.md)
- [Tarefa 8.4 — O04, O11 e O13 implementados e validados ao vivo](docs/phase-8/tarefa-8-4-o04-o11-o13.md)
- [Tarefa 8.4 — O05 implementado e validado ao vivo](docs/phase-8/tarefa-8-4-o05.md)
- [Tarefa 8.4 — O12 implementado e validado ao vivo](docs/phase-8/tarefa-8-4-o12.md)
- [Tarefa 8.4 — O06 implementado e validado ao vivo](docs/phase-8/tarefa-8-4-o06.md)

### Segurança, decisões e escopo

- [Política de validação de dados de negócio](docs/decisions/0005-business-data-validation-policy.md)
- [Escopo de acesso proposto](docs/security/access-scope.md)
- [Resumo de correção de CVE (2026-09-13)](docs/security/cve-fix-summary-2026-09-13.md)
- [ADRs](docs/decisions/)


As decisões registradas preservam o isolamento entre ambientes e bloqueiam
segredos técnicos. A API não verifica procedência real/fake de dados de negócio;
responsabilidade operacional, minimização e LGPD continuam aplicáveis. Arquivos
brutos permanecem fora do Git, e qualquer alteração Apex ou de metadata depende
de aprovação explícita.
