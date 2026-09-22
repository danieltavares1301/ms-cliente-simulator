# Vazamento real de dados de teste + redirecionamento do callout de Contestação

## Resumo executivo

Durante a varredura de risco (item deferido do Checkpoint 7.1: "varredura
exaustiva de Flow/Process Builder em `Opportunity`/`Proponente__c`"), foi
descoberto que `Contestacao__c` possui um **trigger real (`ContestacaoTrigger`
→ `ContestacaoTriggerHandler.handlerAfterInsert`)** que dispara em **todo
insert** do objeto e faz **callouts HTTP reais** para dois endpoints
configurados em `Endpoints__c` (custom setting hierárquica), apontando para
`https://apis.mrv.com.br` — domínio de produção real da MRV, com Remote Site
Settings ativas autorizando o callout.

O cenário `pac-update-com-contestacao-pendente-sincroniza-contatos`
(variação 5/5 da Tarefa 7.1b) cria `Contestacao__c` diretamente via setup
allowlisted do simulador. Isso significa que, quando esse cenário rodou ao
vivo contra `mrv-devDan`, **o callout real foi disparado e teve sucesso**,
antes que esse risco fosse identificado.

## Evidência do vazamento real (antes da correção)

- `LogIntegracao__c`: 2 registros com `EventType__c='paccontestacao-insert'`,
  `Status2__c='success'`, `CreatedDate=2026-09-22T14:37:22Z`.
- Confirma que uma requisição HTTP POST real (autenticada via Bearer token
  obtido através do Named Credential `ServicoClientes` — já redirecionado
  para o simulador desde a Fase 5) chegou a
  `https://apis.mrv.com.br/v1.0/qualidadedecredito/proponentecredito/pacs/contestacao`
  e recebeu HTTP 200/201.

### Payload real enviado (`ContestacaoEventGridModel`)

```json
{
  "idPac": "<Id__c sintético da PAC, ex. PAC-SIM-...>",
  "idMotivo": "<IdMotivo__c>",
  "descricao": "<ObservacoesLongo__c>",
  "usuarioSolucao": "<UsuarioSolucao__c>"
}
```

Não inclui CPF/e-mail diretamente, mas é uma chamada real, autenticada, a um
sistema de crédito de produção, criando presumivelmente um registro de
contestação real do outro lado referenciando uma PAC sintética/fictícia.

## Contrato real confirmado (leitura de código, `ContestacaoTriggerHandler.cls`)

- `ContestacaoTrigger` (`after insert`) → `handlerAfterInsert` →
  `@future(callout=true) handlePostEventGrid`.
- Bifurca por `Contestacao__c.contestacaoComDocumentos__c`:
  - `false`/não setado → POST para `Endpoints__c.ContestacaoInsert__c`
    (payload `ContestacaoEventGridModel`: `idPac`, `idMotivo`, `descricao`,
    `usuarioSolucao`).
  - `true` → POST para `Endpoints__c.ContestacaoComDocumentos__c` (payload
    `{IdJornada, MotivoContestacao}`, requer `PropostaAnaliseCredito__c.IdJornada__c`
    preenchido).
- Ambos autenticam via `NotificacaoHelper.autenticacao()` →
  `callout:ServicoClientes` (Named Credential **já redirecionado para o
  simulador desde a Fase 5** — por isso o token usado era o token fake do
  simulador, não um token Azure real).
- Resposta esperada: JSON com campo `id` (`ContestacaoResponse.id`),
  HTTP 200 ou 201 para sucesso.

## Raio de impacto confirmado

- Único consumidor de `Endpoints__c.ContestacaoInsert__c`/
  `ContestacaoComDocumentos__c`: `ContestacaoTriggerHandler.cls`. Nenhuma
  outra classe referencia esses dois campos.
- `Endpoints__c` é uma custom setting hierárquica com outros 10 campos de
  endpoint (`Campanhas__c`, `DocumentosPAC__c`, `NomeDocumento__c`,
  `CupomDesconto__c`, `MotivosContestacao__c`,
  `ReenvioContratoDocuSign__c`, `LiberarEmpreendimentos__c`, etc.) e 2 campos
  de segredo real (`XApiKey__c`, `XApiKeySensia__c`) — **nenhum desses foi
  tocado** (PATCH parcial, só os 2 campos de contestação).

## Correção aplicada (aprovada explicitamente pelo usuário)

PATCH parcial em `Endpoints__c` (`Id=a1U4T000000qit9UAA`, hierarquia
org-default):

- `ContestacaoInsert__c` →
  `https://ms-cliente-simulator.vercel.app/api/ms-clientes/contestacao-insert`
- `ContestacaoComDocumentos__c` →
  `https://ms-cliente-simulator.vercel.app/api/ms-clientes/contestacao-documentos`

Nenhum outro campo do registro foi alterado (confirmado via leitura completa
do registro antes e depois do PATCH).

### Por que nenhuma Remote Site Setting nova foi necessária

O domínio `https://ms-cliente-simulator.vercel.app` já possui uma Remote Site
Setting ativa (`Id=0rp4T000000PGI6QAO`), criada durante a Tarefa 7.0 para o
redirecionamento do `EnvioPACCreditoQueue`. Como o mesmo domínio é reutilizado
aqui, nenhuma RSS adicional precisou ser criada.

### Estado atual (após a implementação no simulador)

Os dois endpoints do simulador agora existem e seguem exatamente o padrão de
`/api/ms-clientes/pac-credito`:

- `POST /api/ms-clientes/contestacao-insert`
- `POST /api/ms-clientes/contestacao-documentos`

Decisão de rollout: **feature flags separadas** para rollback granular por
contrato, sem acoplar os dois branches do Apex a um único toggle:

- `CONTESTACAO_INSERT_CALLBACK_ENABLED`
- `CONTESTACAO_DOCUMENTOS_CALLBACK_ENABLED`

Ambas exigem `ORCHESTRATION_ENABLED=true` e fazem apenas validação estrutural
do header `Authorization: Bearer ...`, coerente com o uso de
`NotificacaoHelper.autenticacao().getToken()` na org de dev. O endpoint
`contestacao-insert` sempre retorna `201` com `{ "id": "<string-nao-vazia>" }`
e o endpoint `contestacao-documentos` retorna `201` com
`{ "accepted": true, "requestId": "..." }`. Os handlers registram logs
estruturados com `responseStatusCode`, sem expor o bearer recebido.

Arquivos implementados:

- `src/contracts/contestacao.ts`
- `src/ms-clientes/contestacao-insert-handler.ts`
- `src/ms-clientes/contestacao-documentos-handler.ts`
- `src/ms-clientes/contestacao-insert-production.ts`
- `src/ms-clientes/contestacao-documentos-production.ts`
- `app/api/ms-clientes/contestacao-insert/route.ts`
- `app/api/ms-clientes/contestacao-documentos/route.ts`
- testes TDD completos em `src/ms-clientes/*.test.ts`

## Pendências / próximos passos

1. [x] Implementar os dois endpoints do simulador (`contestacao-insert`,
   `contestacao-documentos`) com TDD, feature flags separadas e validação
   estrutural do payload/header, espelhando o padrão de
   `/api/ms-clientes/pac-credito`.
2. Revalidar o cenário de contestação ao vivo após a implementação, para
   confirmar callback bem-sucedido sem tocar `apis.mrv.com.br`.
3. Continuar a varredura de risco nos demais itens ainda não verificados
   (`Proponente_1.flow-meta.xml` e os demais Flows/triggers de
   `Opportunity`/`Proponente__c` já mapeados, mas não totalmente lidos).
4. Avaliar se algum time de negócio da MRV precisa ser informado sobre o(s)
   registro(s) de contestação fictícios criados no sistema real de crédito
   durante o incidente (fora do escopo técnico deste simulador).
