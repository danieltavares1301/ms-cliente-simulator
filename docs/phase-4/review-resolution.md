# Resolução da revisão — Fase 4

Versão 0.4.3.

- Todos os requests Salesforce usam `redirect: error` e timeout de 30 s,
  inferior à lease de lifecycle de 60 s. O endpoint OAuth aceita somente o
  host exato do target ou `test.salesforce.com`, no path exato de token.
- A migration 0005 persiste modo de dispatch, habilitação de test data e o
  UUID de claim. Completion e reclaim usam CAS, bloqueando workers expirados e
  mudanças concorrentes para estados terminais/cancelamento.
- IDs Salesforce retornados por setup/verify são persistidos como metadados
  técnicos. Cleanup consulta e remove somente esses IDs e valida o marcador
  `CLI-SIM-` quando `Id__c` estiver preenchido.
- `STALE` significa perda do claim e nunca autoriza cleanup destrutivo. Em
  reclaim, somente o vencedor persiste IDs de `CREATED`/`REPLAY`; o worker
  expirado não remove a fixture que o sucessor adotou.
- Cancelamento explícito permanece sem órfãos: o repository só retorna
  `CANCELLED` ao UUID ainda persistido, grava seus IDs antes da compensação e
  trata qualquer claim substituído como `STALE`. O serviço de cancelamento e o
  cleanup terminal continuam responsáveis pelos IDs duráveis.
- A política `ALWAYS` compensa falha de setup, scheduling, dispatch, verify e
  cancelamento seguro. Falha de cleanup resulta em `PARTIAL` e pode ser
  retomada.
- Runs preservam `FAKE|SALESFORCE` e `test_data_enabled` da criação. Flags
  atuais são kill switches; nunca promovem run fake nem pulam lifecycle.
- Verificação de Account exige `IsPersonAccount`, nome e CPF compatíveis com o
  evento nos cenários de criação.

Não foi adicionado filtro de PII: os dados de negócio continuam fictícios e
fora da persistência técnica exposta.
