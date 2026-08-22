# ADR-0005: Política de validação de dados de negócio

## Status

Accepted

## Date

2026-08-22

## Context

O simulador precisa reproduzir contratos Salesforce com formatos realistas. A
classificação automática de CPF, e-mail, telefone, nome, endereço, CEP e IDs de
negócio como reais, fake ou sintéticos produzia bloqueios enganosos e tornava
fixtures compatíveis com o contrato dependentes de allowlists.

## Decision

- A aplicação não verifica a procedência real/fake de dados de negócio.
- CPF, e-mail, celular, telefone, nome, endereço, CEP e IDs de negócio são
  permitidos em fixtures e exports sanitizados sem finding por formato ou chave.
- O renderer gera CPF sintético determinístico com checksum válido para
  compatibilidade Salesforce e mantém IDs técnicos namespaced por `runId`.
- Secret scanning continua bloqueando credenciais e segredos técnicos, incluindo
  password/senha, token, JWT/Bearer, cookie, apiKey, signingKey,
  subscriptionKey, connectionString, privateKey e equivalentes. Famílias
  inequívocas também são bloqueadas quando recebem prefixos arbitrários, sem
  diferença por caixa ou separadores.
- Schemas Zod, proibição de `Authorization` em logs, ausência de payload bruto e
  minimização da persistência permanecem obrigatórios.
- Arquivos brutos e exports temporários permanecem fora do Git.

## Consequences

A ausência de classificação automática não torna dados reais seguros ou
recomendados. Autorização de uso, seleção da fonte, minimização, retenção,
revisão e conformidade LGPD continuam sob responsabilidade operacional. O
sanitizador opcional remove segredos, mas não anonimiza dados de negócio.
