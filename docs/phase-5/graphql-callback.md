# Callback GraphQL simulado — Fase 5

## Escopo deste incremento

Esta fase implementa **somente o lado do simulador** para receber o callback
GraphQL real usado pelo Apex `MSClienteService.cls` / `GraphQLCreator.cls`.
Inclui:

- parser baseado em AST oficial (`graphql.parse()`), sem regex;
- políticas de resposta HTTP/GraphQL reutilizando `src/contracts/graphql.ts`;
- correlação com runs recentes e persistência sanitizada em `graphql_callback`;
- endpoint protegido por feature flag + modo de autenticação configurável;
- health/configuração/documentação.

**Fora de escopo:** Tarefa 5.0 (Named Credential / External Credential /
alteração em `MSClienteService.cls`). Esse trabalho depende de aprovação
separada e não faz parte deste commit.

## Contrato real confirmado

O Apex envia `POST` com `Content-Type: application/graphql` e corpo textual:

```graphql
mutation{
  atualizarCliente(
    cliente:{
      id:"ABC123",
      nomeCompleto:"Fulano",
      cadastroNacional:"12345678900",
      idProspectSalesforce:"XYZ789"
    }
  ){id}
}
```

Observações suportadas pelo simulador:

- operação **mutation anônima**;
- único campo `atualizarCliente`;
- único argumento `cliente:{...}` do tipo `ObjectValue`;
- seleção de retorno exatamente `{id}`;
- ordem dos campos dentro de `cliente` é irrelevante;
- `String`/`Date`/`Decimal` chegam serializados como literais GraphQL válidos;
- `orgaoEmissorDocumento`, `nacionalidade`, `sexo` e `estadoCivil` podem vir
  como enums GraphQL sem aspas;
- `cliente.id` e `cliente.idProspectSalesforce` são comparados com
  `trim()+uppercase()` por robustez, mesmo que o Apex já envie uppercase.

Opcionalmente, o simulador também aceita `application/json` com:

```json
{ "query": "mutation{atualizarCliente(cliente:{id:\"ABC123\"}){id}}" }
```

Esse wrapper é útil para testes locais; o contrato real continua sendo
`application/graphql`.

## Autenticação e feature gate

- `GRAPHQL_CALLBACK_ENABLED=false` por padrão;
- só pode ser ligado com `ORCHESTRATION_ENABLED=true`;
- o operador escolhe o modo via `GRAPHQL_CALLBACK_AUTH_MODE`, sem trocar
  código:
  - `SHARED_SECRET` (default): mantém o comportamento original com
    `GRAPHQL_CALLBACK_SHARED_SECRET` (mín. 32 caracteres), comparação em tempo
    constante e segredo exclusivo do simulador;
  - `AZURE_BEARER_STRUCTURAL`: existe porque a org `mrv-devDan` decidiu
    reaproveitar a Named Credential compartilhada `VFlexMsClientes` apontando
    para o simulador, enquanto o Apex `MSClienteService.atualizarCliente`
    continua enviando manualmente `Authorization: Bearer <token>` com um token
    OAuth real do Azure AD obtido pela Named Credential separada
    `callout:ServicoClientes`; como esse token muda a cada chamada, ele nunca
    bateria com um segredo estático dedicado;
- no modo `AZURE_BEARER_STRUCTURAL`, o simulador aceita apenas Bearers que
  parecem um JWT Azure AD bem formado: prefixo `Bearer `, 3 segmentos
  base64url, payload JSON, `exp` futuro e `iss` contendo
  `microsoftonline.com` ou `sts.windows.net`;
- essa checagem é **estrutural/heurística**, não criptográfica: não valida
  assinatura, `aud`, `tid`, `appid` nem JWKS;
- tokens/headers/payloads brutos nunca são logados, persistidos ou retornados;
- com a feature desligada, o endpoint responde `503` sem tocar banco.

Se o uso compartilhado da org crescer no futuro e o callback puder voltar a
usar uma Named Credential dedicada, o modo `SHARED_SECRET` continua documentado
como a alternativa mais segura.

O health público expõe somente o resumo:

- `graphqlCallback: "disabled"` ou
- `graphqlCallback: "configured"`.

## Políticas de resposta

As políticas vêm de `graphqlResponsePolicySchema` e são aplicadas pelo
simulador sem duplicar contrato:

- `SUCCESS_200`
- `SUCCESS_201`
- `GRAPHQL_ERROR_200`
- `HTTP_400`
- `HTTP_401`
- `HTTP_429`
- `HTTP_500`
- `INVALID_JSON_200`
- `EMPTY_BODY_200`
- `DELAYED_RESPONSE`

Quando não há run correlacionado (ou o run não define override), o comportamento
seguro por padrão é **`SUCCESS_200`**.

`DELAYED_RESPONSE` aceita atraso configurável por run, mas o simulador impõe
**limite de 4 segundos**. O objetivo é manter folga em relação ao timeout de
12s do Apex (`request.setTimeout(12000)`) e aos budgets típicos de function,
evitando esperas indefinidas.

## Correlação com runs

A correlação usa `fixture_snapshot.identifiers.accountIdCliente` e
`fixture_snapshot.identifiers.accountIdProspect`, comparando contra:

- `cliente.id`
- `cliente.idProspectSalesforce`

Normalização:

- trim nas extremidades;
- uppercase;
- hashes HMAC-SHA256 com o mesmo pepper técnico já usado para idempotência.

Para manter a solução simples e suficiente ao volume atual do simulador, a busca
varre **somente os 50 runs não-dry mais recentes**, ordenados por `createdAt`
desc. Isso é uma limitação consciente de escala: aceitável hoje, mas deve ser
revisitada se o catálogo crescer ou se o callback passar a trafegar em maior
volume.

Mesmo quando não há correlação, o simulador persiste o callback de forma
sanitizada com `runId=null`.

## Persistência sanitizada

A tabela `graphql_callback` guarda apenas metadados técnicos:

- hashes de correlação (`idClienteHash`, `idProspectHash`,
  `normalizedCorrelationKeyHash`);
- `policy`, `httpStatus`, `durationMs`;
- `requestRedacted` e `responseRedacted`.

Não são persistidos:

- segredo de autenticação;
- body bruto da requisição;
- JSON bruto da resposta;
- stack traces;
- campos de negócio em claro.

Os dados de negócio do catálogo continuam fictícios por design (ADR 0005), mas
mesmo assim o callback foi implementado com persistência sanitizada.

## Integração com lifecycle

Se um run correlacionado estiver em `WAITING_ASYNC` e atingir o mínimo
`expectedCallbacks.min` antes de `asyncWaitDeadline`, o repositório pode avançar
o run para `VERIFYING`.

**Estado atual do catálogo:** os 4 cenários `CORE` mantêm
`expectedCallbacks.max = 0`, então nenhum cenário da versão atual dispara esse
callback em round-trip real. Esta fase entrega a infraestrutura pronta e
testada isoladamente, sem regressão do lifecycle existente, para ser usada
quando os cenários futuros de Lead/árvore forem adicionados.