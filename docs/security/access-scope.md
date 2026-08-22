# Escopo mínimo de acesso proposto

## Estado e princípio

Proposta para o Permission Set:

- **Label:** `ps GIA ExecutarSimuladorUnificacaoClientesGv`
- **API Name:** `PsGiaExecutarSimuladorUnificacaoClientesGv`

Nenhuma metadata, identidade, credencial ou permissão Salesforce foi criada ou alterada. O escopo abaixo ainda exige revisão e aprovação do time GIA antes da integração real. Conceder via Permission Set, não por Profile; negar `Modify All Data`, `View All Data` e qualquer acesso não enumerado.

## Permissões de sistema e Apex

| Área | Proposta mínima |
|---|---|
| System Permission | `API Enabled`. |
| Apex Class Access | `NotificacaoCliente` para `POST /Cliente`. |
| Apex fora do MVP | Sem acesso a classes REST de `/PAC` ou `/MaquinaEstado`. |
| Callback | Acesso ao principal da External Credential dedicada somente quando `VFlexMsClientesPosPac` for aprovado e configurado. |
| Demais classes | Sem concessão explícita; `MSClienteService` não é endpoint invocado diretamente pelo usuário de integração. |

## CRUD allowlisted

O Test Data Adapter e o Outcome Verifier exporão operações nomeadas; nunca aceitarão objeto, campo, SOQL, SOSL ou DML livres vindos da request.

| Objeto | Create | Read | Update | Delete | Finalidade allowlisted |
|---|:---:|:---:|:---:|:---:|---|
| Account | Sim | Sim | Sim | Sim | Precondição sintética, efeito dos eventos, assertions e cleanup owned pelo `runId`. |
| Lead | Sim | Sim | Sim | Sim | Precondição/duplicidade, vínculo final, assertions e cleanup owned pelo `runId`. |
| Proponente__c | Sim | Sim | Sim | Sim | Fixture efetiva, leitura de contatos, sincronização do identificador final e cleanup. |
| PropostaAnaliseCredito__c | Sim | Sim | Não | Sim | Scaffolding master-detail; somente existência, ownership e cleanup. |
| Opportunity | Sim | Sim | Não | Sim | Raiz do scaffolding; somente existência, ownership e cleanup. |
| Organization | Não | Sim | Não | Não | Safety Guard da org alvo, sandbox e instância esperadas. |

`Update` de PropostaAnaliseCredito__c/Opportunity não está proposto. Se a implementação de fixture provar necessidade, o time GIA deve aprovar uma revisão documentada antes da concessão.

## FLS

A **matriz campo-a-campo é requisito de entrada para qualquer integração real**. Ela deve ser gerada a partir da metadata efetivamente implantada na org alvo e cruzada com:

1. campos mínimos de criação exigidos por schema, record types, validation rules, flows e triggers;
2. campos lidos/escritos pelas operações REST/Composite nomeadas;
3. campos consultados pelas assertions predefinidas;
4. campos de ownership/correlação derivados de `runId`;
5. campos usados pelo Safety Guard em `Organization`.

Até essa aprovação, nenhum FLS é considerado concedido. Não se inferem aqui campos obrigatórios nem permissões apenas pela presença em classes/testes. Como evidência para a revisão, o código usa contatos efetivos e identificador final de Proponente__c, e a metadata confirma os relacionamentos master-detail, mas isso não substitui a análise da org.

## Operações REST/Composite propostas

- Consultar `Organization` apenas para o Safety Guard.
- Criar, consultar e remover fixtures nomeadas, respeitando a matriz CRUD acima.
- Atualizar somente Account, Lead e Proponente__c nos fluxos allowlisted.
- Consultar outcomes predefinidos de Account, Lead e Proponente__c.
- Consultar Opportunity e PropostaAnaliseCredito__c somente para existência/ownership.
- Remover exclusivamente registros cuja propriedade pelo `runId` tenha sido comprovada, na ordem Proponente__c → PropostaAnaliseCredito__c → Opportunity; demais registros seguem a dependência validada da fixture.

## Negado por padrão

- Staging, pré-produção e produção.
- `/PAC`, `/MaquinaEstado`, SOQL/SOSL livre, DML genérico e Salesforce CLI no runtime.
- Leitura de `LogIntegracao__c`, salvo nova justificativa e aprovação.
- IDs de usuário, exportação de logs brutos, hosts ou segredos em
  documentação/configuração versionada. Dados de negócio exigem autorização,
  minimização e revisão LGPD; não são classificados pela API.
- Qualquer registro sem ownership comprovado e qualquer destino que falhe o Safety Guard.
