# Tarefa 8.4 — O06 implementado e validado ao vivo (script standalone aprovado explicitamente)

## Decisão de arquitetura (discutida e aprovada antes da implementação)

O06 ("Intervenção manual Pós-PAC") exige interpor duas ações `[MANUAL]` no
meio de uma sequência de eventos automatizados. Duas abordagens foram
avaliadas:

- **Opção A** — checkpoint administrativo no motor de dispatch declarativo
  (novo estado de run, nova operação allowlisted, novo endpoint admin).
- **Opção B** — script standalone (mesmo precedente do O10/O12), que executa
  os eventos automatizados via REST direto e as duas ações "manuais" como
  chamadas REST diretas na Account, no ponto exato da sequência.

**Opção B foi escolhida e aprovada explicitamente pelo usuário**, pelo mesmo
motivo que já levou o O10 a ficar fora do catálogo (o orquestrador é
sequencial por design) e porque o próprio catálogo já marca essas ações como
manuais — nunca foram pensadas como fluxo self-service via API. Construir um
mecanismo de pausa no motor compartilhado (usado por outros 45 cenários)
seria um risco desproporcional ao ganho.

## Adaptação de cronologia (mesmo princípio já usado no O05)

A cronologia literal do catálogo assume que a PAC chega **antes** de existir
qualquer Account. O achado real do O05 (a PAC exige Account/Opportunity já
existentes — `NotificacaoPAC` rejeita com HTTP 400 "Oportunidade não
encontrada" caso contrário) também se aplica aqui. A Account X (a identidade
que a PAC referencia) foi criada como **pré-condição de setup**, não "depois"
da PAC.

Cronologia implementada (`scripts/manual-intervention-o06.ts`):

```
Setup: Account X + Opportunity (pre-condicao real da PAC)
1. pac-insert aprovado (Proponente principal de X, C/D)
2. [MANUAL] cria Account Y com IdProspectSalesforce__c = valor provisorio (placeholder)
3. cliente-update(X) — reforco real via /Cliente
4. contato-insert Email divergente, em Y
5. [MANUAL] limpa IdProspectSalesforce__c de Y (PATCH REST direto)
6. pac-update aprovado REENTREGUE (mesmo id de PAC/Proponente, referenciando X, dataAlteracao mais nova)
7. cliente-update(X) final
8. cliente-update(Y) final, apos o prospect provisorio ter sido limpo
```

## Resultado real observado em `mrv-devDan`

Todos os 6 dispatches HTTP (steps 1, 3, 4, 6, 7, 8) retornaram `200 OK`; as
duas ações manuais (steps 2 e 5) foram aplicadas sem erro.

**Estado final:**

- **Account X**: `PersonEmail`/`Celular__c` permaneceram exatamente com os
  valores aprovados pela PAC (`aprovado.<seed>@simulador.mrv.invalid`,
  `11988887777`) — X permaneceu íntegra durante toda a sequência, imune às
  manipulações feitas em Y.
- **Account Y**: `PersonEmail` refletiu corretamente o `contato-insert`
  divergente publicado no passo 4. O achado mais relevante: depois de
  **limpar manualmente** `IdProspectSalesforce__c` (passo 5) e então enviar
  um `cliente-update(Y)` comum sem `idprospectsalesforce` no payload (passo
  8), a Account Y terminou com um **GUID de prospect novo, auto-gerado pelo
  Apex** (`084b6938-9430-b4d7-a53f-aa37b2e60cee` na execução real) — nenhum
  erro, nenhum estado órfão.

## Achado real: auto-cura de identidade após intervenção manual

Isso confirma, com evidência real, que o sistema **"cura" automaticamente**
uma Account cujo prospect foi manualmente zerado: um `cliente-update`
subsequente, mesmo sem informar `idprospectsalesforce`, faz o Apex atribuir
um novo identificador de prospect à Account — o mesmo mecanismo de geração de
identidade observado no perfil O12 (onde uma Account em situação de
"prospect divergente" também recebe um GUID novo, não reaproveitado). Isso é
uma evidência positiva de resiliência: a intervenção manual (criar com
placeholder, depois limpar) não deixa a Account presa num estado inválido —
o próximo evento real de `/Cliente` reconcilia a identidade automaticamente.

Nem o cenário de intervenção manual, nem a reentrega da PAC, afetaram a
integridade de X — confirmando que a Opção B (script fora do motor
declarativo) reproduziu fielmente a intenção do perfil O06 sem qualquer
mudança no motor compartilhado.

## Validação

- `npm test`: 763/763 (sem novos testes automatizados dedicados — o O06,
  como O10/O12, é uma ferramenta diagnóstica de validação ao vivo).
- `npm run typecheck` / `npm run lint` / `npm run build`: limpos.
- Execução real única, completa, contra `mrv-devDan`, com todos os 6
  dispatches HTTP retornando 200 e as 2 ações manuais aplicadas sem erro.
- Resíduo zero confirmado por consulta direta pós-cleanup
  (`accountXCountAfterCleanup: 0`, `accountYCountAfterCleanup: 0`).

## Reaproveitamento generalizado

`dispatchConcurrentRequest` (em `stress-o10-concurrent-events-lib.ts`) foi
generalizado para aceitar um parâmetro de endpoint alvo (`Cliente` | `PAC` |
`MaquinaEstado`, default `Cliente` para preservar compatibilidade com
O10/O12), permitindo que o O06 despachasse tanto para `/Cliente` quanto para
`/PAC` sem duplicar a lógica de fetch/detecção de sinais de lock. Essa
generalização também é um pré-requisito direto para o O07 (que precisa
disparar `cliente-update` e `pac-update` verdadeiramente concorrentes).

## Pendência

O09 ("Ordem composta Clarice") depende da combinação de O06 (concluído
aqui) + O07 (corrida Queueable vs PAC, ainda pendente). Com O06 pronto, O07
é o próximo item que desbloqueia o O09.
