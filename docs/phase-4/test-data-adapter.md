# Fase 4 — Test Data Adapter Salesforce

## Estado

O incremento 0.4.1 entregou o adapter isolado. No incremento 0.4.3 ele passa a
participar do state machine de runs e das entregas QStash quando
`SALESFORCE_TEST_DATA_ENABLED=true`, que por sua vez exige orchestration e
dispatch Salesforce habilitados. O lifecycle durável está detalhado em
[lifecycle.md](lifecycle.md).

O health informa somente `testData: disabled|configured`; não abre conexão com
Salesforce.

## Fronteira de entrada

`setup`, `verify` e `cleanup` aceitam exclusivamente uma fixture validada pelo
`renderedScenarioFixtureSchema`, acompanhada do mesmo `runId` e
`scenarioKey`. Os únicos cenários aceitos são os quatro `CORE` atuais:

- `match-id-cliente`;
- `match-cpf-sem-id-cliente`;
- `no-match-cliente-insert`;
- `cliente-update-nova-estrutura`.

Não há entrada para SOQL, nome de objeto, campo ou URL. As consultas são
montadas internamente com campos fixos e literais escapados.

## Allowlist atual

Objeto permitido: somente `Account`.

Setup permitido:

- `CREATE_SYNTHETIC_ACCOUNT`, com match por `ID_CLIENTE` ou `CPF`;
- `ENSURE_ACCOUNT_ABSENT`.

Verificações permitidas:

- `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`;
- `ACCOUNT_COUNT_BY_CPF_IS_ONE`;
- `ACCOUNT_NAME_EQUALS_EVENT`;
- `ACCOUNT_CLIENT_ID_EQUALS_EVENT`;
- `ACCOUNT_IS_PERSON_ACCOUNT`;
- `ACCOUNT_CPF_EQUALS_EVENT`;
- `NO_OTHER_ACCOUNT_UPDATED`;
- `LEAD_NOT_REQUIRED` e `PROPONENTE_NOT_REQUIRED`, como passes no-op explícitos.

Cleanup permitido:

- `DELETE_OWNED_RECORDS` com target `ACCOUNT`.

Lead, `Proponente__c`, PAC, Opportunity, objetos genéricos, DML genérico e SOQL
livre permanecem bloqueados. Novas operações só devem ser adicionadas quando
existirem cenários que efetivamente as utilizem.

## Segurança e idempotência

Cada chamada REST valida novamente host, org e sandbox pelo
`SalesforceSafetyGuard`. Um `401` invalida o token OAuth em memória e permite
uma única nova tentativa. Erros técnicos não incluem token, segredo nem corpo
de resposta.

O setup consulta o identificador forte antes de criar. Registro compatível
gera `REPLAY`; registro incompatível gera `SETUP_CONFLICT`, sem update ou
delete. `ENSURE_ACCOUNT_ABSENT` falha com `PRECONDITION_FAILED` diante de
qualquer match.

Setup e verify devolvem os IDs Salesforce encontrados ou criados; o lifecycle
os persiste em `response_redacted`. Cleanup recebe somente esses IDs, reconsulta
por `Id` e exige que `Id__c`, quando preenchido, seja exatamente o identificador
`CLI-SIM-` da fixture. Isso permite remover com segurança o registro do cenário
por CPF ainda com `Id__c` nulo, sem inferir ownership por CPF. Sem IDs
persistidos, cleanup é no-op fail-safe. Divergência falha fechada com
`OWNERSHIP_MISMATCH`.

Os dados de negócio das fixtures são fictícios por decisão do ADR-0005. Este
incremento não adiciona classificação, scanner ou filtro de CPF, nome, e-mail,
telefone ou outros dados de negócio.

## Limitações conhecidas

- Não há teste contra org real; os testes usam clientes/fetch mocks.
- `NO_OTHER_ACCOUNT_UPDATED` limita a observação ao conjunto localizado pelos
  identificadores fortes da fixture (`Id__c` e `CPF__pc`).
- Não há suporte a Lead, Proponente, PAC, Opportunity ou outros targets.
