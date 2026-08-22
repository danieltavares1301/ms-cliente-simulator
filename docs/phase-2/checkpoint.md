# Checkpoint da Fase 2

## Critérios

| Critério | Estado | Evidência |
|---|---|---|
| OpenAPI 3.1 e schemas Zod validados | Concluído | `src/openapi.test.ts`, `src/contracts/` e build contract-first. |
| Catálogo versionado funcional | Concluído | Quatro cenários `CORE` versão 1 disponíveis como `READY`; listagem e detalhe não expõem payload. |
| Fixtures determinísticas | Concluído | `renderScenarioFixture` valida entrada, aplica seed, namespace por `runId`, datas UTC e delay. |
| Setup e cleanup allowlisted | Concluído | Somente `CREATE_SYNTHETIC_ACCOUNT`, `ENSURE_ACCOUNT_ABSENT` e `DELETE_OWNED_RECORDS` tipados; não há SOQL, DML ou nomes livres. |
| Envelope Event Grid estrito | Concluído | Cada passo produz exatamente um evento `cliente-insert` ou `cliente-update` validado por Zod. |
| Política de dados e segredos | Concluído | Fixtures aceitam dados de negócio em formatos realistas sem classificação de procedência; `numerocpf` é sintético, determinístico e tem checksum válido para compatibilidade Salesforce. Segredos técnicos continuam bloqueados. |
| Comportamento Apex honesto | Concluído | Os cenários sem match prometem Person Account, mas não Lead/Proponente/callback sem as flags reais de divergência ou vínculo. |
| Validação offline de fixtures | Concluído | `validate:fixtures` renderiza todas as fixtures, verifica determinismo, namespace cruzado, schema, placeholders e ausência de segredos. |

## Limites preservados

- Não há criação, consulta, cancelamento ou retry de runs.
- Não há CRUD de banco, aplicação de migrations ou conexão com Neon.
- Não há publicação QStash nem chamada ao Salesforce.
- Não há implementação GraphQL, alteração Apex ou metadata Salesforce.
- Opportunity e Proponente não são prometidos nos quatro casos, porque os
  payloads básicos não acionam as flags correspondentes no Apex atual.
- A API não determina se CPF, e-mail, telefone, nome, endereço, CEP ou ID de
  negócio é real ou fake. Seleção, base legal, minimização e uso dos dados
  continuam sob responsabilidade operacional e LGPD.

## Gate

Os resultados finais dos comandos estão registrados em
[`increment-2.4-validation.md`](increment-2.4-validation.md).
