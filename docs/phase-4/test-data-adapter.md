# Fase 4 — Test Data Adapter Salesforce

## Estado

O incremento 0.4.1 entrega o adapter isolado. Ele ainda não participa do state
machine de runs nem de mensagens QStash. Sua ativação futura exige
`SALESFORCE_TEST_DATA_ENABLED=true`, que por sua vez exige orchestration e
dispatch Salesforce habilitados.

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

Cleanup só remove Account cujo `Id__c` seja exatamente o identificador da
fixture e comece com `CLI-SIM-`. No cenário por CPF, uma Account ainda sem
`Id__c` antes do evento é preservada. Divergência de ownership falha fechada
com `OWNERSHIP_MISMATCH`; ausência de registros é no-op idempotente.

Os dados de negócio das fixtures são fictícios por decisão do ADR-0005. Este
incremento não adiciona classificação, scanner ou filtro de CPF, nome, e-mail,
telefone ou outros dados de negócio.

## Limitações conhecidas

- O adapter não é invocado automaticamente por runs.
- Não há teste contra org real; os testes usam clientes/fetch mocks.
- `NO_OTHER_ACCOUNT_UPDATED` limita a observação ao conjunto localizado pelos
  identificadores fortes da fixture (`Id__c` e `CPF__pc`).
- Não há suporte a Lead, Proponente, PAC, Opportunity ou outros targets.
