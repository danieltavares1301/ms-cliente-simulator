# ADR-0004: Ciclo de dados de teste e escopo do MVP

## Status

Accepted

## Date

2026-08-22

## Context

O E2E exige precondições Salesforce reais, mas endpoints genéricos de DML/SOQL ampliariam excessivamente o risco. O fluxo principal depende de Proponente__c e de sua cadeia de relacionamentos, embora PAC e máquina de estado não integrem o primeiro MVP funcional.

## Decision

- Executar setup, assertions e cleanup por Salesforce REST/Composite com operações tipadas e allowlisted.
- Identificar/correlacionar cada registro sintético com namespace derivado de `runId`; cleanup falha fechado sem prova de ownership.
- MVP funcional cobre Account, Lead, Proponente__c, os seis eventos `/Cliente` e callback `atualizarCliente`.
- Opportunity e PropostaAnaliseCredito__c são scaffolding obrigatório para criar Proponente__c.
- Criar na ordem Opportunity → PropostaAnaliseCredito__c → Proponente__c e remover na ordem inversa.
- Não validar funcionalmente `/PAC`, `/MaquinaEstado` nem a associação final da Opportunity no MVP.

## Alternatives Considered

- **Apex REST genérico de dados de teste:** rejeitado por expor DML arbitrário.
- **SOQL/SOSL vindo da request:** rejeitado por segurança e falta de contrato.
- **Salesforce CLI no runtime:** rejeitado por credenciais e operação inadequadas.
- **Excluir o scaffolding do MVP:** rejeitado porque os master-detail impedem fixture representativa de Proponente__c.
- **Incluir PAC/Máquina de Estado agora:** rejeitado para reduzir o primeiro incremento funcional.

## Consequences

- A allowlist e a FLS campo-a-campo devem ser aprovadas antes do E2E.
- Assertions funcionais ficam em Account, Lead e Proponente__c; scaffolding só prova existência, ownership e remoção.
- Fixtures usam dados sintéticos/anonimizados e não carregam PII ou IDs Salesforce reais.
- Mesma seed em runs diferentes não reutiliza identificadores persistidos.
