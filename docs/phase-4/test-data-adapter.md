# Fase 4–6 — Test Data Adapter Salesforce

## Estado

O incremento 0.4.1 entregou o adapter isolado. No incremento 0.4.3 ele passa a
participar do state machine de runs e das entregas QStash quando
`SALESFORCE_TEST_DATA_ENABLED=true`, que por sua vez exige orchestration e
dispatch Salesforce habilitados. No incremento 0.6.0 o vocabulário allowlisted
foi expandido para também preparar, verificar e limpar `Lead`, sem ainda
amarrar essas operações a cenários novos do catálogo. O lifecycle durável está
detalhado em [lifecycle.md](lifecycle.md).

O health informa somente `testData: disabled|configured`; não abre conexão com
Salesforce.

## Fronteira de entrada

`setup`, `verify` e `cleanup` aceitam exclusivamente uma fixture validada pelo
`renderedScenarioFixtureSchema`, acompanhada do mesmo `runId` e
`scenarioKey`. Os cenários publicados continuam sendo os quatro `CORE` atuais:

- `match-id-cliente`;
- `match-cpf-sem-id-cliente`;
- `no-match-cliente-insert`;
- `cliente-update-nova-estrutura`.

O adapter agora aceita fixtures renderizadas compatíveis com esse contrato e
com o mesmo `runId` e `scenarioKey`, inclusive para operações futuras de Lead.
Não há entrada para SOQL, nome de objeto, campo ou URL. As consultas são
montadas internamente com campos fixos e literais escapados.

## Allowlist atual

Objetos permitidos: `Account` e `Lead`.

Setup permitido:

- `CREATE_SYNTHETIC_ACCOUNT`, com match por `ID_CLIENTE` ou `CPF`;
- `ENSURE_ACCOUNT_ABSENT`.
- `CREATE_SYNTHETIC_LEAD`, com `Id__c` sintético prefixado por `LEAD-SIM-`
  (explícito ou derivado da fixture), `RecordType` `GestaoVendas`,
  `ManipularFase__c=true`, `Status='Pendente de Distribuição'`,
  `PermitirCriarLead__c=true`, `Marca__c='1'` e apenas os campos confirmados:
  `Id__c`, `FirstName`, `LastName`, `CPF__c`, `MobilePhone`,
  `CelularSemFormatacao__c`, `Email`, `CidadeInteresse__c`, `Marca__c`,
  `RecordTypeId`, `ManipularFase__c`, `Status`, `PermitirCriarLead__c` e
  `DescricaoOrigem__c`.
- `ENSURE_LEAD_ABSENT`, com busca allowlisted somente por `Id__c`, `CPF__c`,
  `Email` e `CelularSemFormatacao__c`.

Verificações permitidas:

- `ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE`;
- `ACCOUNT_COUNT_BY_CPF_IS_ONE`;
- `ACCOUNT_NAME_EQUALS_EVENT`;
- `ACCOUNT_CLIENT_ID_EQUALS_EVENT`;
- `ACCOUNT_IS_PERSON_ACCOUNT`;
- `ACCOUNT_CPF_EQUALS_EVENT`;
- `NO_OTHER_ACCOUNT_UPDATED`;
- `LEAD_COUNT_BY_ID_EXTERNO_IS_ONE`;
- `LEAD_CPF_EQUALS_EVENT`;
- `LEAD_EMAIL_EQUALS_EXPECTED`;
- `LEAD_MOBILE_EQUALS_EXPECTED`;
- `LEAD_EMAIL_EXCLUDED`;
- `LEAD_MOBILE_EXCLUDED`;
- `LEAD_DESCRICAO_ORIGEM_EQUALS`;
- `LEAD_NOT_CREATED`;
- `LEAD_NOT_REQUIRED` e `PROPONENTE_NOT_REQUIRED`, como passes no-op explícitos.

Cleanup permitido:

- `DELETE_OWNED_RECORDS` com target `ACCOUNT`.
- `DELETE_OWNED_RECORDS` com target `LEAD`.

`Proponente__c`, PAC, Opportunity, objetos genéricos, DML genérico e SOQL livre
permanecem bloqueados. O catálogo ainda não dispara as operações de Lead; elas
existem como fundação allowlisted para os próximos incrementos da Fase 6.

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

Para `Lead`, o ownership segue duas trilhas explícitas:

1. **Lead criado diretamente pelo simulador via setup**: o `Id__c` deve usar o
   prefixo `LEAD-SIM-`, e o cleanup só remove o registro quando ele é
   reencontrado pelo `Id` persistido do próprio run.
2. **Lead criado pelo fluxo Apex (`insertLeadQueueable`)**: o cleanup nunca
   infere ownership por CPF ou e-mail. Ele só aceita a lista explícita de
   Salesforce IDs retornada por `setup`/`verify`/query anterior e reconsulta por
   `Id IN (...)` antes de excluir.

Em ambos os casos continuam valendo `.strict()`, SOQL montado internamente e
escaping via `escapeSoqlLiteral`.

Os dados de negócio das fixtures são fictícios por decisão do ADR-0005. Este
incremento não adiciona classificação, scanner ou filtro de CPF, nome, e-mail,
telefone ou outros dados de negócio.

## Limitações conhecidas

- Não há teste contra org real; os testes usam clientes/fetch mocks.
- `NO_OTHER_ACCOUNT_UPDATED` limita a observação ao conjunto localizado pelos
  identificadores fortes da fixture (`Id__c` e `CPF__pc`).
- Ainda não há cenários publicados que consumam o vocabulário de Lead.
- Não há suporte a `Proponente__c`, PAC, Opportunity ou outros targets.
