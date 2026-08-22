# ADR-0002: Autenticação nas duas direções

## Status

Accepted

## Date

2026-08-22

## Context

O simulador publica eventos e gerencia fixtures no Salesforce, enquanto o Salesforce chama o GraphQL simulado. As duas direções têm públicos, privilégios e ciclos de segredo diferentes. Credenciais do MS Clientes real não podem alcançar o simulador.

## Decision

- **Vercel → Salesforce:** External Client App ou Connected App dedicada, OAuth Client Credentials ou JWT conforme padrão aprovado, usuário de integração exclusivo e Permission Set mínimo.
- **Salesforce → Vercel:** Named Credential `VFlexMsClientesPosPac` e External Credential dedicados, com audience e material criptográfico exclusivos do simulador.
- Manter o mesmo DeveloperName do Named Credential entre orgs e variar destino/autenticação por configuração.
- Alterar somente `MSClienteService`, após aprovação explícita. Não reutilizar `ServicoClientes` nem redirecionar globalmente `VFlexMsClientes`.

## Alternatives Considered

- **Reutilizar bearer do serviço real:** rejeitado por audience, segregação e risco de vazamento.
- **Redirecionar `VFlexMsClientes`:** rejeitado porque outros fluxos compartilham esse Named Credential.
- **Usar External/Connected App Salesforce para autenticar o callback:** rejeitado; ela resolve a direção oposta.
- **Credencial de usuário humano:** rejeitada por rastreabilidade e rotação inadequadas.

## Consequences

- Há duas identidades e duas políticas de rotação independentes.
- Tokens/chaves ficam apenas nos cofres das plataformas e nunca em logs ou Git.
- O simulador valida issuer/audience/expiração/identidade do callback.
- Nenhuma app, credencial, usuário ou metadata foi criada na Fase 0.
