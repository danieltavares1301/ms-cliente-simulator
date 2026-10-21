# Simulador MS Clientes

Projeto independente para simular, de forma controlada, os contratos do MS Clientes usados pela Unificação 2.2 na sandbox autorizada.

## Estado

Versão **0.28.0**, a mesma do deploy no Vercel em 2026-10-11. O projeto tem
duas partes:

- **API do simulador**, no Vercel. Executa por `POST /api/v1/runs` os 45
  cenários declarados em `src/scenarios/definitions.ts`, com orquestração por
  QStash e persistência no Neon. Também recebe os callouts que o Salesforce
  faz de volta: GraphQL `atualizarCliente`, token, PAC Crédito e Contestação.
- **Scripts locais** (`scripts/`), que falam direto com a `mrv-devDan` pela
  Salesforce CLI:
  - o harness do runbook da Unificação 2.2, com 44 TCs executáveis (39 no
    `--todos`; os 053 a 057, de proponente adicional, ficam fora do modelo)
    nos perfis PA, CA e ME, os perfis opcionais C1 a C4 do bug 4 e os perfis
    opcionais AR, AM, FW, RC, EP e RL, com as ordens reais da aprovação. O
    esperado segue a planilha oficial;
  - as ferramentas das ordens O06, O07, O09, O10 e O12;
  - os diagnósticos do TC-001;
  - as consultas somente leitura de `mrv-staging` (`scripts/analise-staging/`).

As fases 0 a 7 estão implementadas, e os itens que ainda faltam estão marcados
com `[ ]` nos checkpoints do plano. Na Fase 8, com a Tarefa 8.4, todas as
ordens do catálogo de O01 a O14 ganharam cenário ou script. O O15 segue
bloqueado, e as tarefas 8.1 a 8.3 seguem abertas.

Os trabalhos mais recentes:

- a investigação do bug 4 do TC-001, reproduzido na `mrv-devDan` em 01/10;
- a campanha do runbook de 02/10, com 121 de 132 RUNs conformes;
- a análise de quem publica cada evento que o Salesforce recebe (MS Clientes,
  MS de crédito e Plataforma BFF);
- os perfis do harness com as ordens reais da aprovação e a campanha deles
  de 11/10 ([relatório](docs/resultado-runbook-ordens-reais-2026-10-11.md));
- as duas campanhas completas de 11/10, com os 44 TCs nos 13 perfis (545
  RUNs cada): uma sem e outra com os cinco commits da 2.2 que a dev revertida
  não tinha. O que mudou entre elas está no
  [catálogo de bugs pegos pelo runbook](docs/bugs-pegos-pelo-runbook.md);
- a comparação com a planilha oficial, o harness alinhado a ela e a campanha
  alinhada de 12/10 (484 RUNs), que trouxe o B10 para a matriz
  ([convergência](docs/convergencia-planilha-runbook-2.2.md));
- os contratos da API alargados para os formatos reais, no Vercel desde
  11/10 (seção 7.4 do doc de origem dos eventos).

Para assumir o trabalho sem contexto, leia nesta ordem:

1. a seção "Regras críticas" do [plano técnico](plano-api-simulador-ms-clientes-2.2.md);
2. a [passagem de contexto do bug 4](docs/handoff-investigacao-tc001-bug4.md);
3. o [estado da `mrv-devDan`](docs/estado-da-mrv-devDan.md), que diz em que
   ponto dos branches da unificação está o código da dev;
4. a [origem dos eventos que o Salesforce recebe](docs/origem-dos-eventos-no-salesforce.md);
5. a seção [Repositórios relacionados](#repositórios-relacionados), para achar
   o código dos outros sistemas.

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
livre. Runs `SUCCEEDED`, `FAILED` e `PARTIAL` não são canceláveis, exceto
`PARTIAL` com massa de teste e cleanup falho, que pode ser cancelado para
repetir a limpeza. `FAILED` e `PARTIAL` podem reservar retry de steps `FAILED`,
exceto runs com massa de teste Salesforce, que respondem
`409 RETRY_NOT_SUPPORTED`: a compensação já apagou a massa, então repetir exige
um run novo. Falha ao cancelar no QStash mantém `CANCELLING` com auditoria
técnica, sem falso `CANCELLED`.

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
falha sem falha de cleanup; e `PARTIAL` quando cleanup falha. Quando a
compensação de um run com massa de teste falha, a resposta
`503 LIFECYCLE_CLEANUP_FAILED` faz o QStash reentregar, e cada reentrega repete
a limpeza. A compensação também descobre, com a consulta do verify, registros
que o Apex criou em resposta aos eventos, mesmo quando o verify não chegou a
rodar. Runs legados sem `fixture_snapshot` falham fechados. A fixture nunca é
exposta pelas respostas de listagem/detalhe.

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

## Ferramentas diagnósticas standalone (scripts)

O [catálogo de ordens de eventos do MS Cliente no Pós-PAC](docs/catalogo-ordens-eventos-ms-cliente-pos-pac.md)
distingue dois níveis de acesso para reproduzir uma ordem:

- **Self-service via API**: `O01`, `O02`, `O03`, `O04`, `O05`, `O08`, `O11`,
  `O13`, `O14` são cenários formais do catálogo (`GET /api/v1/scenarios`) e
  podem ser executados por qualquer agente com acesso de rede ao simulador
  implantado, via `POST /api/v1/runs` (ver seção
  [Runs administrativos](#runs-administrativos)). Não exigem clonar o
  repositório nem ter a Salesforce CLI instalada — a única barreira é a
  chave administrativa (`Authorization`).
- **Requer ambiente local com acesso real à org**: `O06`, `O07`, `O09`,
  `O10`, `O12` são ferramentas diagnósticas dedicadas (fora do catálogo
  declarativo, por decisão arquitetural documentada em cada doc abaixo).
  Elas chamam a Salesforce **diretamente**, não passam pelo simulador
  implantado, e exigem:
  - clonar este repositório e rodar `npm install`;
  - ter a [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)
    instalada e **autenticada** contra `mrv-devDan`
    (`sf org login web --alias mrv-devDan` ou equivalente) — não há como
    fazer isso via API, exige credenciais reais de acesso à org;
  - rodar o comando `npm run` correspondente.

  Desde a versão 2.152 da CLI, o `sf org display` esconde o token de acesso.
  Os scripts (`loadOrgAccess`, em `scripts/stress-o10-concurrent-events-lib.ts`)
  pegam então o token com `sf org auth show-access-token`, sem imprimi-lo.

| Ordem | Comando | O que faz |
|---|---|---|
| `O06` | `npm run manual-intervention:o06` | Intervenção manual pós-PAC: cria uma Account com prospect provisório, publica contatos divergentes, limpa o campo manualmente e reentrega a PAC aprovada. |
| `O07` | `npm run stress:o07 -- --variant cq-x` (ou `cq-y`) | Corrida genuína `cliente-update`/`pac-update` via `Promise.all`, nas duas variantes formais do catálogo. |
| `O09` | `npm run composite:o09` | Composição de O06 + O07 na ordem descrita pelo perfil "Ordem composta Clarice". |
| `O10` | `npm run stress:o10 -- --event-mix mixed\|uniform` | Rajada concorrente de `cliente-update`/`contato-*`/`endereco-*` contra a mesma Account, para stress de lock. |
| `O12` | `npm run stress:o12 -- --concurrency <n>` | Contenção da Account Y logo após um `cliente-insert` real, com rajada concorrente escalonável. |

Nenhum desses 5 scripts é coberto pela suíte automatizada (`npm test`) —
são ferramentas de validação ao vivo contra `mrv-devDan`, documentadas
individualmente em `docs/phase-6/o10-stress-concorrencia.md` e
`docs/phase-8/tarefa-8-4-o06.md` / `-o07.md` / `-o09.md` / `-o12.md`. Nunca
execute nenhum deles contra staging/produção; o Safety Guard interno
bloqueia qualquer host fora de `mrv-devDan`, mas a autenticação em si já
deve apontar exclusivamente para essa sandbox.

**`O15` permanece bloqueado** — nenhum comando o executa hoje; ver seção 16
do catálogo copiado para a decisão de arquitetura pendente.

### Runbook da Unificação 2.2 (recorte 2.2)

`npm run runbook -- --tcs TC-005,TC-006 [--perfis PA,CA,ME] [--saida resultados.jsonl]`
(ou `--todos`) roda os **TCs executáveis** do
[runbook](docs/runbook-testes-manuais-unificacao-2.2.md) na `mrv-devDan`, cada
um nos três perfis obrigatórios (`ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES`
e `ORDEM-MESMO-EVENTTIME`), com massa nova por RUN. Os TCs bloqueados, os
`BLOCKED-FUNCIONAL` e os de proponente adicional (053 a 057, fora do modelo do
harness) ficam de fora. Requer o mesmo ambiente local autenticado
descrito acima.

- **Massa:** entra como fixture, e a cadeia 2.2 roda inteira (PAC, eventos na
  ordem do perfil, Queueable/callback, `cliente-update(PROS-Y)`, `pac-update`
  e máquina). A 2.1 e a 1.3 reais não são chamadas, então cada RUN é um
  diagnóstico do recorte 2.2 (runbook §4.2).
- **Contatos sintéticos:** os e-mails seguem o formato
  `qa.unif22.tcNNN.<letra>.<run>@example.com`. Os celulares têm 11 dígitos: um
  prefixo por contato (`3198`, `3197`, `3196` e `3195`) e 7 dígitos aleatórios
  por RUN. Antes eram só 4 dígitos aleatórios, depois do número do TC. Com
  isso, sobras antigas davam ERRO falso no precheck, e RUNs simultâneos do
  mesmo TC podiam sortear o mesmo celular.
- **Cada RUN:** confere o esperado do TC e os critérios comuns (X intacto,
  vínculo, Proponente, Opportunity, PAC, jobs e logs sem erro). No fim, apaga
  só o que criou (§6.5). Se a cadeia parou no meio, o cleanup espera os jobs
  dela antes de procurar o que o Apex criou. Quando essa procura falha, o
  resíduo fica `null` ("não verificado") em vez de 0.
- **"Account X intacta":** compara também os marcadores de contato de X
  (`DataAlteracaoEventoContatoEmail__c` e `DataAlteracaoEventoContatoCelular__c`)
  e o carimbo `DataHoraAtualizacaoEmailPendencia__c` do Person Contact. Assim,
  uma escrita indevida aparece mesmo quando o valor coincide, como no TC-001,
  em que Y usa os contatos de X. Ler o carimbo exige FLS para o usuário do CLI
  (permission set `AcessoDeAPI` na `mrv-devDan`); sem ela, todo RUN termina em
  erro com essa explicação.
- **Retomada:** o JSONL de saída serve também para retomar. Um par TC×perfil
  cujo último resultado tem veredito não roda de novo; um que terminou em ERRO
  roda. O relatório vale pelo último resultado de cada par.
- **Paralelo (opcional):** `--paralelo N` (até 10) roda N RUNs ao mesmo tempo.
  O padrão continua sequencial, como pede o runbook (§4.1.1); usar o pool é um
  desvio consciente. Em 02/10, a campanha completa com `--paralelo 6` repetiu
  os vereditos de 27/09 (121 conformes e 11 divergentes, sem nenhuma asserção
  diferente) em cerca de 19 minutos de parede, contra 98 em sequência
  ([relatório](docs/resultado-runbook-recorte-2.2-2026-10-02.md)). A
  correlação de jobs olha a janela da org. Por isso, um RUN que acusa job com
  erro no pool é refeito em sequência antes de virar divergência, e o resultado
  final traz `tentativaParalela`.
- **Queda de rede** (`scripts/runbook/rede.ts`), em sequência ou no pool:
  - Leituras e exclusões tentam de novo por cerca de 1 minuto. Uma exclusão
    que volta 404 depois de uma queda conta como feita.
  - Escritas e eventos não se repetem, porque poderiam duplicar. Um evento sem
    resposta HTTP é ERRO de infraestrutura, não divergência.
  - A primeira falha fecha um portão, e nenhum RUN novo começa até a org
    responder a uma sondagem de `/services/data/`. Os logs
    `runbook-rede-*` registram a causa, por exemplo `SELF_SIGNED_CERT_IN_CHAIN`.
  - O RUN que caiu é refeito inteiro, com massa nova, até 3 tentativas por
    par; o resultado final traz `quedasDeRede`.
  - Se a rede não voltar em 10 minutos, o runner para de iniciar RUNs e lista
    em `runbook-interrompido` os pares sem resultado. Rodar de novo com o mesmo
    `--saida` completa a campanha.
- **Tempo de cada RUN:**
  - a espera de jobs consulta a cada 1,5 s e só considera os jobs do usuário
    do CLI (`INTERVALO_JOBS_MS` e `LEITURAS_VAZIAS_JOBS` em `engine.ts`);
  - os snapshots fazem as consultas independentes em paralelo;
  - o PROS-Y é lido com uma consulta só;
  - o cleanup apaga em etapas paralelas, sempre na ordem das dependências.

  Cada resultado traz `tempos` por fase, e o relatório mostra as médias.
- **Relatório:** `npm run runbook:relatorio -- --entrada resultados.jsonl --saida relatorio.md`.

Código em `scripts/runbook/`: `engine.ts` (motor), `verificacoes.ts`,
`cenarios.ts` (as 44 especificações), `pool.ts` (pool e refação de RUNs),
`rede.ts` (falhas de rede) e `run.ts`. O script antigo do TC-005
foi substituído pelo runner. A causa-raiz do Lead de Y, confirmada pelo
reteste `npm run retest:tc005`, está em
[`docs/tc-005-conta-y-sem-lead.md`](docs/tc-005-conta-y-sem-lead.md).

#### Perfis C1 a C4: bug 4 do TC-001

Os TCs do runbook são um escopo fechado, então os caminhos do bug 4 não
viraram TCs novos: são perfis opcionais que rodam sobre os TCs existentes. A
campanha padrão (`--todos`, perfis PA, CA e ME) não muda. Exemplo:

`npm run runbook -- --tcs TC-001,TC-005 --perfis C1,C2,C3,C4`

Cada perfil C usa a ordem do CA nos eventos de cliente. Antes deles, envia
duas `pac-update` em análise com os dados da pessoa aprovada do TC (CPF e
contatos) e um gatilho que projeta o contato do Proponente na Account:

| Perfil | PACs em análise | Gatilho |
|---|---|---|
| C1 | sem IdCliente (o incidente) | pendência depois dos eventos de cliente |
| C2 | com o IdCliente da jornada (X) | pendência depois dos eventos de cliente |
| C3 | com o IdCliente da jornada (X) | pendência antes das PACs, com o Proponente ainda de X |
| C4 | com o IdCliente da jornada (X) | contestação pendente na PAC |

**O que o RUN confere:**

- **O esperado do TC e os critérios comuns.** Inclui a "Account X intacta"
  reforçada, que é o que acusa o bug.
- **A validade do perfil.** As PACs em análise chegaram ao Proponente, e o
  detalhe mostra se ele ficou em X, na conta aprovada ou em outra. Também
  confere que o gatilho aconteceu e, em C1 e C2, que X estava intacta antes da
  pendência. Essa última checagem atribui à pendência qualquer mudança
  posterior; o próprio perfil CA do TC serve de controle sem gatilho.

**Como ler o resultado:**

- **Na `mrv-devDan` revertida, antes dos guards:** a "Account X intacta"
  diverge nos TCs em que o caminho alcança X. Exemplos: o TC-001 nos quatro
  perfis; o TC-005 em C2, C3 e C4. No TC-005 em C1, o CPF de Y acha a conta
  de Y, e o caminho não chega a X.
- **Com os guards do plano de correção do repositório Salesforce:** todos
  devem sair conformes.
- **Nos TCs de MATCH** (X pode mudar, como o TC-003), o gatilho é uma
  sincronização legítima da própria pessoa.
- **Contexto e evidências:** [handoff do bug 4](docs/handoff-investigacao-tc001-bug4.md),
  seção 1.1.

O perfil C4 cria uma `Contestacao__c` e a apaga no cleanup. O trigger dela
chama `Endpoints__c.ContestacaoInsert__c`. Confira antes que o endpoint
aponta para o simulador, nunca para uma API da MRV.

#### Perfis das ordens reais da aprovação: AR, AM, FW, RC, EP e RL

Também são opcionais e rodam sobre os TCs existentes. Reproduzem as ordens
de eventos que o código do MS de crédito, do WebJob dele e do MS Clientes
produz de verdade (seção 7.2 do
[doc de origem dos eventos](docs/origem-dos-eventos-no-salesforce.md)).
Exemplo:

`npm run runbook -- --tcs TC-001,TC-005 --perfis AR,AM,FW,RC,EP,RL`

| Perfil | Ordem real | O que manda |
|---|---|---|
| AR | 1 e 5: aprovação de pessoa nova | PACs em análise sem IdCliente; a pendência na hora, de novo pela 2ª rota (mesmo `id`, sem `metadataVersion`) e mais uma vez no fim; as chamadas do WebJob em ordem (cliente com `SistemaOrigem` Crédito, celular, e-mail, telefone, endereços Principal e Cobrança); o eco; a PAC aprovada |
| AM | 2: aprovação de quem já é cliente | PACs em análise com IdCliente; a PAC aprovada sai na hora e de novo depois do WebJob. Só roda nos TCs com `cliente-update` |
| FW | 4: falha e repetição do WebJob | como o AR, mas a 1ª tentativa cai depois do celular. Depois do eco, a repetição manda `cliente-update` com o prospect da jornada, como o MS Clientes faz, e os parciais |
| RC | 6: relógio do crédito | ordem CA com as PACs no horário do crédito (Brasília rotulado como UTC, e sem fuso na data); depois da PAC aprovada, um `contato-update` de antes dela |
| EP | 7: eco antes do parcial | ordem CA, mas o celular chega depois do eco, ainda com o prospect da jornada |
| RL | 8: repostagem em lote | ordem CA completa e, depois, a repostagem do cliente, dos contatos e do endereço com as datas gravadas |

Detalhes que valem para todos:

- **Venda Genérica:** AR, AM e FW não mandam a máquina, porque a Plataforma
  BFF não publica a jornada genérica nesse ponto.
- **Origem:** os eventos levam o `subject` real de cada publicador, e o JSONL
  traz o `publicador` de cada evento.
- **PAC de quem ainda não existe:** quando o Salesforce não acha a pessoa
  (sem IdCliente, sem conta pelo CPF e sem prospect, como no TC-040), o
  código da unificação recusa a PAC em análise com 400 "Cliente(Account) não
  encontrado". AR, AM e FW tratam essa recusa como esperada: o evento fica
  marcado com `rejeicaoEsperada` e é reentregue depois da aprovação, como o
  Event Grid faria. A reentrega tem de voltar 200 sem mudar o status da PAC.

**O que o RUN confere,** além do esperado do TC e dos critérios comuns:

- **AR, AM e FW:** o mesmo que o C1. As PACs em análise chegaram ao
  Proponente (ou foram recusadas e reentregues), a pendência foi aplicada e X
  estava intacta antes dela.
- **FW e EP:** o prospect da Account aprovada não muda, e nenhuma Account ou
  Lead nasce do evento atrasado. O detalhe lista o que ele alterou. Se Y
  ainda não tinha Lead antes do evento, não há o que preservar.
- **RC:** a data da PAC aprovada ficou gravada em UTC, e o contato atrasado
  foi descartado.
- **RL:** a repostagem não altera nem cria Account ou Lead.

**Resultado na `mrv-devDan` revertida (11/10):** 237 RUNs, 178 conformes. RC,
EP e RL só repetem as divergências conhecidas do CA. AR, FW e AM mostram a
pendência gravando na Account que a PAC em análise achou, e o FW mostra os
contatos de outra pessoa indo para o Lead novo de Y. A análise está no
[relatório](docs/resultado-runbook-ordens-reais-2026-10-11.md).

**Com os commits (11/10, depois das 20:43 UTC):** os mesmos vereditos. No AR e
no FW, X não recebe mais o e-mail de Y, mas ainda recebe o carimbo da
pendência. Nos TCs 047, 055 e 056, o Lead Y reutilizado perde os contatos dele
([relatório](docs/resultado-runbook-completo-com-commits-2026-10-11.md)).

**Alinhado à planilha (12/10):** com o esperado da planilha oficial, divergem
nos perfis obrigatórios o K1, o K2 (045 e 049) e o B10 (026, o Lead Y
reutilizado recebe o celular de X). O K2 do 046 saiu, por ser artefato de massa,
e o B9 ficou só no 047, no AR e no FW
([relatório](docs/resultado-runbook-completo-alinhado-2026-10-12.md)).

`npm run runbook:relatorio` monta as colunas com os perfis presentes no JSONL.
`npm run runbook:bugs -- --entrada resultados.jsonl` liga cada divergência a um
bug do [catálogo](docs/bugs-pegos-pelo-runbook.md) e imprime a matriz TC ×
perfil; o que sai como `?` ainda não tem bug atribuído. Com
`--comparar anterior.jsonl`, mostra também o que mudou desde a campanha
anterior.

### Diagnósticos TC-001 (commits 3 e 4 revertidos, `GV_918914_UnificPosAprovPAC`)

**Para assumir a investigação sem contexto:** leia primeiro a
[passagem de contexto do bug 4](docs/handoff-investigacao-tc001-bug4.md),
com evidências reais, tentativas, retificações, comandos e limitações.

Scripts ad-hoc em `scripts/runbook/diagnostico-tc001-*.ts` (fora do
catálogo dos 44 TCs, mesmo nível de acesso do O06/O07/O09/O10/O12) tentam
reproduzir os dois bugs do TC-001 corrigidos pelos commits `1f6844e910`
(guard de identidade) e `72cbd884f6` (retry lock), contra o estado
revertido desses commits em `mrv-devDan`. Esse estado está descrito na seção
2 do [estado da `mrv-devDan`](docs/estado-da-mrv-devDan.md).
Quatro dos scripts têm atalho no npm:

```bash
npm run diag:tc001-idcliente-compartilhado
npm run diag:tc001-race-insert-update -- --rajada 8 --ondas 4 --intervalo-ms 1200
npm run diag:tc001-race-cliente-pac -- --rajada 8 --ondas 4 --intervalo-ms 1200
npm run diag:tc001-race-prospect-estrangeiro -- --concorrencia 8
```

**Reteste com evidência real do commit 4 (2026-10-01):** o incidente usa
IdClientes distintos, não compartilhados. O diagnóstico
`npx tsx scripts/runbook/diagnostico-tc001-evidencia-staging.ts --org-alias mrv-devDan`
(opcional `--concorrente`) reconstrói as relações dos logs com dados sintéticos.
As três primeiras tentativas preservaram X, porque faltava o
`notificacaopendencia-insert`. Com `--pendencia --data-proponente-staging`, X
muda com a mesma impressão digital de staging, e o controle sem a pendência
preserva X: o bug 4 está reproduzido. A causa e as variantes
(`--idcliente-x-na-analise`, `--pendencia-antes` e `--contestacao-pendente`)
estão na seção 1.1 do handoff.

Resultado, achados e a hipótese revisada para o `UNABLE_TO_LOCK_ROW` não
reproduzido (incluindo um achado novo — corrida silenciosa de Leads
duplicados órfãos, sem nenhum erro visível):
[`docs/tc-001-diagnostico-corridas-commits-3-4.md`](docs/tc-001-diagnostico-corridas-commits-3-4.md).

### Consultas somente leitura em `mrv-staging`

`scripts/analise-staging/` reúne as consultas que sustentam a
[análise de origem dos eventos](docs/origem-dos-eventos-no-salesforce.md). Elas
mostram, por exemplo:

- quem publica cada evento;
- o formato real de cada origem;
- quem dispara os eventos do MS Clientes;
- as reentregas;
- o `Estado` das jornadas;
- se o código implantado compara datas de origens diferentes;
- o fuso do `eventTime` de cada origem;
- a ordem real dos eventos na aprovação de uma PAC.

Rodam direto no `node`, sem `npm install`, com a Salesforce CLI autenticada
como `mrv-staging`. Exemplo:

```bash
node scripts/analise-staging/origem-eventos.ts
```

A seção 2 do doc lista os oito scripts. Eles só aceitam SELECT, só falam com
`mrv-staging` ou `mrv-devDan` e mascaram valores com cara de dado pessoal,
então nunca alteram nada em staging.

A mesma pasta tem o `versao-implantada.ts`, que sustenta o
[estado da `mrv-devDan`](docs/estado-da-mrv-devDan.md). Ele compara o código
implantado na dev com os branches da unificação no `com_salesforce_mrv`:

```bash
node scripts/analise-staging/versao-implantada.ts
```

Além do SELECT, ele baixa os metadados da org para uma pasta temporária
(retrieve) e lê o repositório Salesforce só com comandos git de leitura, sem
trocar de branch.

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

## Repositórios relacionados

O simulador imita sistemas cujo código está em outros repositórios. Nesta
máquina, eles ficam ao lado deste diretório:

| Repositório | Caminho | O que é |
|---|---|---|
| `com_salesforce_mrv` | `../com_salesforce_mrv` | Apex e metadados da org. As regras críticas do plano valem aqui: nada de commit, e mudança na org só com aprovação |
| `com_plataforma_bff` | `../com_plataforma_bff` | Plataforma BFF: publica `jornadausuario-*` e chama `POST /apexrest/Lead` |
| `cliente` | `../cliente` | MS Clientes real: publica `cliente-*`, `contato-*` e `endereco-*` |
| `com_proponente_credito` | `../com_proponente_credito` | MS de crédito ("MS Proponente Crédito", Java/Spring): publica `pac-*`, `notificacaopendencia-*`, `paccontestacao-*`, `pendencia-*` e `processo-*` no tópico `pacs` |
| `com_proposta` | `../com_proposta` | MS Proposta ("Gerador de Propostas"): simulação e proposta. Não publica `pac-*`; só recebe o `pac-update`, para sincronizar o rating pós-PAC |
| `com_analise_credito_web_job` | `../com_analise_credito_web_job` | "Análise Crédito Web Job": depois da aprovação, cria o cliente no MS Clientes e grava o IdCliente no crédito. Também recebe o callback PAC Crédito do Salesforce |

- **Branch do Salesforce:** o checkout local do `com_salesforce_mrv` pode estar
  na branch de outra frente. Não troque a branch. Para ler o código da
  unificação, use `git show origin/GV_918914_UnificPosAprovPAC:<arquivo>`.
- **MS de crédito:** é o `com_proponente_credito`. O serviço se identifica como
  `proponentecredito` na rota da API
  (`/v1.0/qualidadedecredito/proponentecredito/...`) e no prefixo do subject
  dos eventos (`EventGridPublisher.java:41`).
- **WebJob do crédito:** quem chama o MS Clientes depois da aprovação de uma
  PAC é o `com_analise_credito_web_job`, que consome uma fila do Service Bus
  alimentada pelo MS de crédito. O fluxo e a ordem das chamadas estão nas
  seções 3.7 e 3.8 do [doc de origem dos eventos](docs/origem-dos-eventos-no-salesforce.md).
- **Caminhos do Windows:** o projeto começou no Windows. O plano, a passagem
  de contexto do bug 4 e outros docs ainda citam caminhos de lá, como
  `D:\Documentos\Trabalho\Ambientes\MRV\MS Cliente`,
  `C:\Users\preda\...\com_salesforce_mrv` e `%TEMP%\claude\...`, e comandos
  `sf.cmd`/`npm.cmd`. Use os caminhos relativos acima, e `sf`/`npm` no lugar
  dos `.cmd`.
- **Arquivos fora do git do Salesforce:** a skill
  `salesforce-unificacao-clientes`, citada como fonte normativa pelo plano e
  pelo runbook, não está em nenhum ref git do `com_salesforce_mrv`. Em 11/10,
  ela e a pasta `docs/unificacao-clientes/` foram copiadas para o checkout
  desta máquina, em `.github/skills/salesforce-unificacao-clientes/` e
  `docs/unificacao-clientes/`, como arquivos não rastreados. Seguem só no
  Windows o `docs/plano-correcao-guard-identidade-email-pendencia-proponente.md`
  e as evidências brutas citadas nas seções 8 e 10 da passagem do bug 4.
  Quem precisar delas tem que pedir uma cópia ao dono do projeto.

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
- [Runbook integrado de testes — Unificações 2.1, 1.3 e 2.2](docs/runbook-testes-manuais-unificacao-2.2.md) —
  os 70 casos de teste (`TC-001`–`TC-070`) da US 918914, origem do TC-005
  implementado em [`docs/tc-005-conta-y-sem-lead.md`](docs/tc-005-conta-y-sem-lead.md).
- [Resultado do runbook — recorte 2.2, 2026-09-27](docs/resultado-runbook-recorte-2.2-2026-09-27.md) —
  132 RUNs dos 44 TCs executáveis na `mrv-devDan`: 121 conformes, com
  divergência reproduzível no TC-040 (HTTP 400 para contato antes do cliente
  sem correlação) e nos TCs 045, 046 e 049 (Lead candidato sem CPF não
  reutilizado quando a Account Y é nova).
- [Resultado do runbook — recorte 2.2, 2026-10-02](docs/resultado-runbook-recorte-2.2-2026-10-02.md) —
  a mesma campanha com `--paralelo 6`: vereditos idênticos aos de 27/09 em
  cerca de 19 minutos, com uma queda de rede refeita e as mudanças da dev
  desde 27/09.
- [Passagem de contexto do bug 4 do TC-001](docs/handoff-investigacao-tc001-bug4.md) —
  causa, reprodução, estado do harness e da `mrv-devDan` em 02/10.
- [Resultado do runbook — ordens reais da aprovação, sem os commits, 2026-10-11](docs/resultado-runbook-ordens-reais-2026-10-11.md) —
  os perfis AR, AM, FW, RC, EP e RL nos 44 TCs, na dev revertida: o bug 4
  pela pendência, a pendência antes dos eventos de cliente mudando a escolha
  do Lead, os contatos de X no Lead de Y depois da repetição do WebJob e a PAC
  em análise recusada para quem ainda não existe.
- [Bugs pegos pelo runbook](docs/bugs-pegos-pelo-runbook.md) — cada bug que o
  harness pega na `mrv-devDan`, com causa e evidência, os cinco commits da 2.2
  que a dev revertida não tinha e as matrizes TC × perfil sem e com eles. É
  atualizado a cada campanha, com `npm run runbook:bugs`.
- [Resultado do runbook — campanha completa sem os commits, 2026-10-11](docs/resultado-runbook-completo-sem-commits-2026-10-11.md) —
  os 44 TCs nos 13 perfis (545 RUNs, 331 conformes) na dev revertida, sem os
  cinco commits da 2.2 (`1f6844e910`, `72cbd884f6`, `9210581ea5`,
  `7c86318a05` e `3f2919f5e7`), com o detalhe de cada divergência.
- [Resultado do runbook — campanha completa com os commits, 2026-10-11](docs/resultado-runbook-completo-com-commits-2026-10-11.md) —
  a mesma campanha com as quatro classes na ponta da 2.2: os mesmos
  vereditos, o bug 4 fora do C1, do AR e do FW, e o efeito novo no Lead Y
  reutilizado.
- [Inventário dos commits da 2.2](docs/inventario-commits-2.2.md) — os 47
  commits do branch `GV_918914_UnificPosAprovPAC`, um a um: o que corrigem, se
  o harness cobre, em que regra da versão enxuta caem e se sobrevivem na
  ponta. É a base para reescrever a camada de identidade e contatos.
- [Critério de aceite da Unificação 2.2](docs/criterio-de-aceite-unificacao-2.2.md) —
  o que o runbook e a planilha definem como aprovado, onde a ponta da 2.2 está
  frente a isso, as decisões pendentes e a proposta de critério para a
  reescrita.
- [Resultado do runbook — campanha completa alinhada à planilha, 2026-10-12](docs/resultado-runbook-completo-alinhado-2026-10-12.md) —
  os 39 TCs no modelo do harness, nos 13 perfis (484 RUNs, 295 conformes),
  com o esperado da planilha oficial: o B10 na matriz e as verificações da
  Account aprovada e do Proponente passando em todos os RUNs.
- [Convergência entre a planilha e o runbook da 2.2](docs/convergencia-planilha-runbook-2.2.md) —
  a planilha oficial (70 TCs) comparada com o runbook e com o harness: o que
  converge, os 11 TCs que divergem, o bug que o harness não confere (B10) e o
  que o B9 e o K2 do 046 deviam à massa do harness.
- [Estado da `mrv-devDan`](docs/estado-da-mrv-devDan.md) — em que ponto dos
  branches da unificação (2.2, 2.1 e 1.3) está cada arquivo implantado na dev.
  Desde 20/10, é o ponto zero da reescrita: a 1.3 mais a etapa 1. Guarda
  também os estados anteriores, como as quatro classes que ficaram em 03/09
  de 27/09 a 11/10, e o que o simulador achou neles. É atualizado a cada
  mudança na dev.
- [Origem dos eventos que o Salesforce recebe](docs/origem-dos-eventos-no-salesforce.md) —
  quem publica cada evento (MS Clientes, MS de crédito, Plataforma BFF), o
  que o código do MS Clientes publica e quem dispara cada evento, o formato
  real de cada origem, por que a ordem varia no Salesforce e a correção do
  `Estado` = UF do §9 da análise de staging. A seção 7 traz o plano de
  mudanças no simulador e as ordens de eventos que ainda faltam.

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
- [Tarefa 8.4 — O07 implementado e validado ao vivo](docs/phase-8/tarefa-8-4-o07.md)
- [Tarefa 8.4 — O09 implementado e validado ao vivo](docs/phase-8/tarefa-8-4-o09.md)

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
