# Tarefa 8.4 — O07 implementado e validado ao vivo (com limite honesto de auth)

## Escopo deste incremento

Implementa e valida ao vivo contra `mrv-devDan` o perfil **O07** ("Corrida
Queueable versus PAC"), como ferramenta diagnóstica dedicada
(`scripts/stress-o07-corrida-queueable-vs-pac.ts`), no mesmo precedente
arquitetural do O10/O12/O06.

## Achado real nº 1: contextos de autenticação independentes não são
## alcançáveis neste ambiente

O catálogo exige, textualmente: *"conexões HTTP e contextos de autenticação
independentes; não reutilizar uma única sessão serializada"*. Antes de
escrever o script, isso foi testado diretamente: `sf org display
--target-org mrv-devDan --json` foi chamado duas vezes em sequência.

**Resultado real:** as duas chamadas retornaram **exatamente o mesmo token
de acesso** (mesmo comprimento, mesmo valor, comparação de igualdade
verdadeira). Não há como obter um token OAuth genuinamente independente
nesta org sandbox sem uma Connected App/External Client App dedicada com
fluxo de autenticação próprio — infraestrutura que não existe hoje e está
fora do escopo desta tarefa (implicaria criar/configurar credenciais reais
na org, o que exige aprovação explícita por tocar em metadata Salesforce).

**Decisão registrada nesta implementação:** o script reutiliza o mesmo
bearer token entre as duas requisições concorrentes — a mesma limitação já
documentada honestamente no O10
(`docs/phase-6/o10-stress-concorrencia.md`, seção "Sobre a limitação 'duas
threads podem ser serializadas pela mesma sessão Salesforce'"). O que o
script consegue garantir é independência de **transporte** (duas conexões
`fetch` distintas, disparadas via `Promise.all`), não de **autenticação**.
Isso é uma limitação real do ambiente de teste, não do simulador.

## Desenho da corrida

Duas variantes formais do catálogo, executadas via `--variant cq-x`/`cq-y`:

```
Setup: Account + Opportunity (pre-condicao real confirmada no O05)
1. contato-insert (Email C0, divergente do C/D que a PAC vai aprovar)
2. CORRIDA GENUINA (Promise.all, disparo simultaneo):
   - cliente-update (CQ-X: mesmo idprospectsalesforce da Account;
     CQ-Y: idprospectsalesforce DIFERENTE, simulando identidade Y)
   - pac-update aprovado (Proponente principal com C/D)
```

## Resultado real observado em `mrv-devDan`

| Variante | `cliente-update` | `pac-update` | Janela real da corrida | Vencedor (email/celular) | `IdProspectSalesforce__c` final | Erro de lock/DML |
|---|---|---|---|---|---|---|
| CQ-X | 200 OK (584ms) | 200 OK (5.795ms) | 5,8s (ambos iniciados no mesmo instante) | PAC (`aprovado.*`) | Inalterado (o mesmo do setup) | Não observado |
| CQ-Y | 200 OK (1.057ms) | 200 OK (6.635ms) | 6,6s (ambos iniciados no mesmo instante) | PAC (`aprovado.*`) | Inalterado — **a tentativa de troca de prospect no `cliente-update` foi ignorada** | Não observado |

## Achado real nº 2: não existe contenção de campo genuína entre `cliente-update` e `pac-update`

`cliente-update` (via `/Cliente`) só escreve `LastName`/`CPF__pc`/watermark de
`IdProspectSalesforce__c` (quando em branco); a sincronização de
`PersonEmail`/`Celular__c` só acontece pelo caminho da PAC aprovada
(confirmado no O04). Como os dois eventos não escrevem os mesmos campos, não
há uma "corrida" no sentido de "qual valor sobrevive" — o `LastName` do
`cliente-update` e o `PersonEmail`/`Celular__c` da PAC coexistem
tranquilamente, mesmo disparados no mesmo instante. Isso não invalida o
experimento: confirma, com evidência real, que a corrida de identidade que
o catálogo descreve (`insertLeadQueueable` competindo com a projeção da PAC)
não se manifesta como um conflito de escrita de campo simples — seria
necessário observar o nível de `AsyncApexJob`/logs de transação para provar
sobreposição real de execução assíncrona, o que está fora do alcance de um
script que só observa o estado final via SOQL.

## Achado real nº 3: tentativa de troca de prospect (CQ-Y) foi corretamente bloqueada

Na variante CQ-Y, o `cliente-update` carregou deliberadamente um
`idprospectsalesforce` diferente do já existente na Account. O estado final
mostrou o prospect **inalterado** — confirmando ao vivo a regra já
encontrada por leitura de código (`NotificacaoCliente.cls`): o campo só é
carimbado quando está em branco (`String.isBlank(clienteExistente.
IdProspectSalesforce__c)`). Uma tentativa de sobrescrever um prospect já
existente através de `cliente-update` é silenciosamente ignorada.

## Validação

- `npm test`: 763/763 (sem novos testes automatizados dedicados — o O07,
  como O06/O10/O12, é uma ferramenta diagnóstica de validação ao vivo).
- `npm run typecheck` / `npm run lint` / `npm run build`: limpos.
- Duas execuções reais completas contra `mrv-devDan` (`cq-x` e `cq-y`), sem
  erro de lock/DML em nenhuma, resíduo zero confirmado por consulta direta
  pós-cleanup em ambas.

## Pendência

Com O06 e O07 concluídos, o **O09** ("Ordem composta Clarice") pode ser
composto reaproveitando os dois scripts — próximo item da Tarefa 8.4.
