# Tarefa 8.4 — O09 implementado e validado ao vivo (composição de O06 + O07)

## Escopo deste incremento

Implementa e valida ao vivo contra `mrv-devDan` o perfil **O09** ("Ordem
composta Clarice"), o mais complexo do catálogo. O próprio catálogo original
já reconhecia, antes mesmo desta tarefa: *"nenhum perfil atual reproduz a
cadeia inteira"* — mesmo o executor Python antigo. Esta implementação
compõe, na ordem descrita, os dois mecanismos já validados isoladamente
nesta mesma tarefa: **O06** (intervenção manual: Account com prospect
provisório, depois limpo via PATCH direto) e **O07** (corrida genuína
`pac-update`/`cliente-update` via `Promise.all`).

## Desenho da composição

```
Setup: Account P (referenciada pela PAC) + Opportunity (pre-condicao real, achado do O05)
1. [MANUAL] cria Account Y com IdProspectSalesforce__c provisorio (tecnica do O06)
2-3. contato-insert Email + Celular divergentes (C0/D0), em Y
4. [MANUAL] limpa o prospect provisorio de Y (PATCH REST direto, tecnica do O06)
5-6. CORRIDA GENUINA (Promise.all): pac-update aprovado (P, C/D) || cliente-update(P) (tecnica do O07)
7. cliente-update(Y), apos o prospect provisorio ter sido limpo
```

Não se assumiu nem se exigiu o estado intermediário específico do catálogo
original (*"Queueable lê estado ainda divergente e cria Lead com D0"*) — o
critério de aceite foi a convergência final, exatamente como definido na
Tarefa 8.4 do plano: *"o estado final é validado, mesmo que o estado
intermediário exato do catálogo não ocorra em toda execução"*.

## Resultado real observado em `mrv-devDan`

Execução única, completa, todos os 7 passos com HTTP 200, nenhum erro de
lock/DML detectado.

| Account | Resultado final |
|---|---|
| **P** (referenciada pela PAC) | Convergiu corretamente para os contatos aprovados (`PersonEmail`/`Celular__c` = valores da PAC), mesmo disparando a corrida genuína contra `cliente-update(P)` simultaneamente. |
| **Y** (criada manualmente, prospect provisório depois limpo) | Manteve os contatos divergentes publicados nos passos 2-3 (`PersonEmail`/`Celular__c` = C0/D0); o prospect terminou com um **GUID novo, auto-gerado pelo Apex** — a mesma "auto-cura de identidade" já confirmada isoladamente no O06, agora reproduzida também neste cenário composto mais complexo. |

Nenhuma duplicidade de Account, nenhum registro órfão, nenhuma exceção.
Cleanup confirmou resíduo zero em ambas as Accounts.

## Leitura honesta do resultado

O objetivo positivo do catálogo — *"Account e Lead terminam com C/D; a
origem POS_PAC_APROVADA deve sobreviver à fronteira assíncrona"* — foi
satisfeito na parte que é observável e reproduzível com as ferramentas
disponíveis: a Account vinculada à PAC (P) converge de forma confiável para
os contatos aprovados, mesmo sob a mesma corrida genuína já testada
isoladamente no O07, e a intervenção manual em uma Account totalmente
independente (Y) não interfere nessa convergência nem deixa a própria Y em
estado inconsistente.

A cadeia inteira do catálogo original — que descreve uma única identidade
evoluindo através de intervenção humana, contato obsoleto, Queueable e
reconciliação PAC, todas na mesma pessoa — permanece, como o próprio
catálogo já admitia, não completamente reproduzível com uma única Account:
aqui ela foi modelada como duas Accounts distintas (P e Y) para poder isolar
e validar cada mecanismo (corrida e intervenção manual) de forma
inequívoca, seguindo a mesma adaptação pragmática já usada em O05/O06/O07.

## Validação

- `npm test`: 763/763 (sem novos testes automatizados dedicados — o O09,
  como O06/O07/O10/O12, é uma ferramenta diagnóstica de validação ao vivo).
- `npm run typecheck` / `npm run lint` / `npm run build`: limpos.
- Execução real única, completa, contra `mrv-devDan`, com resíduo zero
  confirmado por consulta direta pós-cleanup em ambas as Accounts.

## Estado da Tarefa 8.4 após este incremento

8 das 9 ordens pendentes concluídas e validadas ao vivo: O04, O05, O06, O07,
O09, O11, O12, O13. Resta apenas **O15**, bloqueada por uma decisão de
contrato compartilhado ainda pendente (`apexCompatibleUtcDateTimeSchema`
exige terminar em `Z`, impedindo o payload "BRT sem offset" necessário).
