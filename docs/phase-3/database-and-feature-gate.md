# Banco runtime e feature gate — incremento 3.0

## Feature gate

`ORCHESTRATION_ENABLED` aceita somente `true` ou `false` e usa `false` quando
omitida. Com a flag desligada, os endpoints atuais e o health não exigem os
novos segredos. O health informa somente `orchestration: disabled`.

Com a flag ligada, a configuração falha de forma fechada se qualquer item
abaixo estiver ausente ou inválido:

- `SIMULATOR_ADMIN_API_KEY` (mínimo de 32 caracteres);
- `IDEMPOTENCY_HASH_PEPPER` (mínimo de 32 caracteres);
- `PUBLIC_APP_BASE_URL` (HTTPS, sem credenciais, query ou fragment);
- `QSTASH_TOKEN` (mínimo de 32 caracteres);
- `QSTASH_CURRENT_SIGNING_KEY` (mínimo de 32 caracteres);
- `QSTASH_NEXT_SIGNING_KEY` (mínimo de 32 caracteres).

`QSTASH_URL` e `DATABASE_URL` continuam na configuração base. Nenhuma dessas
variáveis usa prefixo público, é retornada pelo health ou é registrada. O estado
`configured` indica somente validação sintática; o health não abre conexão nem
consulta Neon ou QStash.

## Runtime Neon

`src/db/runtime.ts` cria, sob demanda e apenas no servidor, um client stateless
`@neondatabase/serverless` com `drizzle-orm/neon-http`. Importar o módulo não lê
configuração, não cria conexão e não executa query. A factory não mantém
singleton global nem registra a URL; cada consumidor solicita explicitamente o
database/repository depois de validar o feature gate.

Referência oficial:
[Drizzle com Neon](https://orm.drizzle.team/docs/connect-neon).

## Migrations

As migrations são versionadas em `drizzle/`. `0000` permanece imutável e
`0001_sleepy_magneto.sql`:

- adiciona `scenario_run.request_fingerprint`;
- converte estados antigos dos passos para o enum dedicado `step_status`;
- preserva runs antigos com fingerprint `legacy:<uuid>`, que causa conflito
  seguro em vez de replay indevido.

Validação estrutural, sem conexão:

```bash
npm run db:migrate:check
npm run db:generate
```

Aplicação manual em um branch Neon autorizado:

```powershell
$env:DATABASE_URL = 'postgresql://<usuario>:<senha>@<host>/<database>?sslmode=require'
npm run db:migrate
Remove-Item Env:DATABASE_URL
```

`db:migrate` recusa URL ausente, protocolo não PostgreSQL ou senha vazia e chama
o fluxo oficial `drizzle-kit migrate`. Ele não roda em `prebuild`, build ou
deploy. Não use `push` para substituir migrations revisadas.

Referência oficial:
[Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate).

## Idempotência e recuperação

A chave recebida é persistida somente como HMAC-SHA256 com
`IDEMPOTENCY_HASH_PEPPER`. O corpo usa serialização canônica (objetos com chaves
ordenadas e arrays com ordem preservada) e SHA-256 em `request_fingerprint`.

A unicidade `(requested_by, idempotency_key_hash)` decide o vencedor
concorrente. O repository retorna `CREATED`, `REPLAY` ou `CONFLICT` depois de
comparar o fingerprint.

`neon-http` não oferece transação interativa. A implementação não promete
atomicidade entre run e passos:

1. o run é inserido com `ON CONFLICT DO NOTHING`;
2. todos os passos são inseridos em uma única instrução SQL idempotente;
3. uma leitura verifica chaves, ordinais e metadados estruturais;
4. se houver falha entre 1 e 2, repetir a mesma chave/fingerprint recupera os
   passos ausentes; divergência gera `RunRecoveryError`.

Auditoria também é uma operação explícita e separada. Um futuro orquestrador
deve repetir a criação antes de fazer dispatch e registrar auditoria do recovery.
No incremento 3.3, cancelamento e retry seguem a mesma estratégia: updates
condicionais e constraints decidem o vencedor; publicação/cancelamento QStash
ocorre fora da operação SQL e deixa estado/auditoria recuperáveis em falha.

## Teste PostgreSQL local

Os testes usam `@electric-sql/pglite` com `drizzle-orm/pglite`, nunca SQLite.
Cada teste abre banco vazio e aplica as migrations reais `0000` + `0001` pelo
migrator Drizzle. Isso valida DDL, enums, checks, repository, replay, conflito,
concorrência e recovery sem Docker.

PGlite valida a semântica PostgreSQL local, mas não substitui um smoke test de
rede/TLS no branch Neon antes da habilitação em ambiente.
