# Checkpoint 0

**Data:** 2026-08-22  
**Resultado:** Fase 0 documental concluída; Fase 1 liberada.

## Decisões confirmadas

- Projeto independente neste diretório; Vercel Functions, Node.js LTS/TypeScript, Neon PostgreSQL e Upstash QStash.
- Alvo exclusivo: alias `mrv-devDan`, Organization Id `00DHZ000006mzDp2AI`, sandbox, instância `BRA6S`.
- Vercel → Salesforce: External Client App ou Connected App dedicada, OAuth Client Credentials ou JWT e usuário técnico exclusivo.
- Salesforce → Vercel: `VFlexMsClientesPosPac` e External Credential dedicados, configurados por org. `ServicoClientes` não será reutilizado.
- Apenas `MSClienteService` poderá migrar para o novo Named Credential, depois de aprovação explícita.
- Setup, assertions e cleanup usarão REST/Composite tipado e allowlisted.
- MVP funcional: Account, Lead e Proponente__c. Opportunity e PropostaAnaliseCredito__c são somente scaffolding. `/PAC` e `/MaquinaEstado` ficam fora do MVP funcional.

## Evidências técnicas

- Os seis `eventType` e o callback estão registrados na [matriz de contratos](contract-matrix.md), a partir das classes e testes Apex.
- `EventGrid` usa `data.DataAlteracao` para rejeitar evento obsoleto e responde `200` também quando não altera o registro.
- `NotificacaoCliente` usa `Proponente__c.Celular__c` e `EmailAtualizado__c`, cria/reutiliza Lead, atualiza `Account.IdProspectSalesforce__c` e sincroniza `Proponente__c.IdProponente__c`.
- Metadata confirma os master-detail `Opportunity` → `PropostaAnaliseCredito__c` → `Proponente__c`; os testes constroem essa cadeia.
- O callback real aceita `200/201` e lê `data.atualizarCliente.id`; erro do callback não reverte o vínculo local.
- O [escopo de acesso](../security/access-scope.md) e os [ADRs](../decisions/) materializam as decisões sem criar credenciais ou metadata.

## Critérios do Checkpoint 0

- [x] Contratos e dependências de fixture validados tecnicamente no código, testes e metadata disponíveis.
- [ ] Guardas e configurações falhando fechado em execução: o desenho está fechado, mas a prova negativa depende do runtime da Fase 1 e ainda não foi executada.
- [x] Nenhuma mudança Apex ou de metadata Salesforce foi aplicada.
- [x] Proposta de `VFlexMsClientesPosPac` e mudança exclusiva de `MSClienteService` está pronta para aprovação, mas não executada.
- [x] Projeto liberado tecnicamente para iniciar a Fase 1.

## Pendências não bloqueantes

| Responsável | Decisão/evidência necessária | Prazo de bloqueio |
|---|---|---|
| Time GIA/Salesforce Security | Aprovar a matriz campo-a-campo de FLS, o Permission Set proposto e a escolha entre External Client App/Connected App e Client Credentials/JWT. | Antes de qualquer integração real da Fase 4. |
| Time GIA/Salesforce Platform | Aprovar criação/configuração de `VFlexMsClientesPosPac`, External Credential e troca do endpoint somente em `MSClienteService`. | Antes do callback E2E; não bloqueia a Fase 1. |
| QA + responsável LGPD | Fornecer/revisar amostra estratificada de 5–10 mensagens por variação estrutural relevante, com minimização e sem versionar logs brutos. | Antes de congelar fixtures e schemas na Fase 2. |
| Engenharia do simulador | Executar testes negativos do Safety Guard, audience, corpo truncado e cardinalidade do envelope após criar o runtime. | Durante Fases 1–2. |
| Dono da plataforma Vercel | Confirmar limites de duração necessários para `DELAYED_RESPONSE` acima de 12 segundos. | Antes do cenário de timeout; não bloqueia fundação. |
| Time GIA + QA | Confirmar campos obrigatórios/valores de picklist da org para criar fixtures mínimas e aprovar a matriz FLS. | Antes do Test Data Adapter E2E. |

Não há pendência de decisão arquitetural que impeça a criação da fundação TypeScript. A conclusão desta fase não autoriza deploy, acesso à org nem alteração Salesforce.
