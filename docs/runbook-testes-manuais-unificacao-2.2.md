# Runbook integrado de testes - Unificações 2.1, 1.3 e 2.2

> **Origem:** copiado de `com_salesforce_mrv/docs/runbook-testes-manuais-unificacao-2.2.md`
> (repositório Salesforce) em 2026-09-23, para ficar junto do simulador que
> executa os TCs descritos aqui. Ver
> [`docs/tc-005-conta-y-sem-lead.md`](tc-005-conta-y-sem-lead.md) para a
> implementação do TC-005 sobre o catálogo de ordens O01-O14 do simulador.

## 1. Objetivo

Este runbook transforma os 70 casos da aba **Cenários de Testes** da US 918914 em instruções executáveis. Ele foi escrito para outro agente ou QA iniciar a jornada pelo fluxo correto, preparar massa sintética, acionar os pontos de entrada reais na `mrv_devDan`, validar o estado final e reunir evidências técnicas do Salesforce.

Os cenários não começam todos na mesma versão da unificação. A coluna **Fluxo** da planilha determina a cadeia obrigatória:

- **Iniciar Jornada de Unidade:** começa na **Unificação 2.1** e, após a aprovação da PAC, continua na **2.2**.
- **Venda Genérica:** o início da jornada e a criação/atualização da Account pertencem à **2.1**; a deduplicação do Lead principal e o vínculo `IdCliente × IdProspect` pertencem à **1.3**; após a aprovação da PAC, os eventos pertencem à **2.2**.

Preparar manualmente Account, Lead, vínculo ou Opportunity no estado esperado é **fixture**, não execução da versão responsável por produzi-los. Um resultado só comprova 2.1 ou 1.3 quando o respectivo ponto de entrada real é acionado e suas evidências são coletadas.

Fontes normativas:

- Planilha `Hom. Unificação de Leads - USER STORY 918914 - [Unificação de clientes 2.2] Regra de validação APÓS a aprovação da PAC.xlsx`.
- Skill `salesforce-unificacao-clientes`, especialmente `references/unificacao-2.2-pos-pac.md`.
- Regra mestra: nunca sobrescrever dados de uma pessoa com dados de outra. Na dúvida, preservar os registros existentes.

Este documento não substitui a planilha. Quando houver conflito, registre a divergência e não aprove o caso silenciosamente.

## 2. Regras de segurança

1. Execute DML e testes somente na `mrv_devDan`.
2. A `mrv_staging` é somente leitura. Não crie, altere ou exclua dados nela.
3. Use apenas PII sintética. Não copie nomes, CPF, e-mail, celular ou endereço de staging.
4. Prefixe nomes com `QA UNIF22 <TC> <RUN>` para permitir rastreio e limpeza.
5. Antes de cada caso, consulte CPF, e-mail, celular, IdCliente e IdProspect. Todos os valores declarados como “inexistentes” precisam retornar zero registros.
6. Não reutilize massa de outro TC. Os testes alteram relacionamentos e contaminariam o resultado seguinte.
7. Não exclua massa preexistente da org. Limpe somente registros criados para o `RUN` atual e apenas depois de salvar evidências.
8. Não execute um caso marcado **Bloqueado** como se fosse aprovado. Registre `BLOCKED` e a dependência indicada neste runbook.
9. Todo TC executável deve seguir o fluxo CLI completo: precheck, setup, endpoints, ordem dos eventos, snapshots, logs, jobs e callbacks.
10. `PASS-CLI` exige todas as evidências CLI obrigatórias. `FAIL-CLI` pode ser emitido assim que uma asserção obrigatória falhar e a falha estiver materializada por payload/comando, resposta ou estado observado e ID do log/job correspondente. UI da Partner Community e monitores Azure são evidências complementares e não bloqueiam o veredito CLI.
11. **Regra transversal sem exceção por número de cenário:** todo TC executável de TC-001 a TC-070 deve possuir três RUNs independentes e sequenciais: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`. Um ou dois perfis constituem execução parcial e não permitem concluir o TC como PASS.
12. Em cada RUN, execute novamente toda a cadeia aplicável desde o início: 2.1 → 2.2 para Jornada de Unidade; 2.1 → 1.3 → 2.2 para Venda Genérica. Não reutilize como prova uma Account/Lead criada por outro RUN.
13. O trecho 1.3 já mapeado pode conservar suas massas, colisões e asserts, mas deve chamar o caminho real `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable`. Criar diretamente Lead/Account/IdProspect apenas monta fixture e não valida a 1.3.

## 3. Convenção de massa sintética

### 3.1 Identificador da execução

Use `RUN=<TC>-<AAAAMMDD>-<HHMM>`, por exemplo `TC001-20260822-1830`.

| Símbolo | Uso |
|---|---|
| X | Pessoa que iniciou a jornada |
| Y | Pessoa aprovada na PAC ou segundo proponente |
| Z | Terceira pessoa usada para colisão ou troca posterior |
| A/B | E-mail/celular originais |
| C/D | E-mail/celular novos |

Nomes:

- X: `QA UNIF22 <TC> CLIENTE X <RUN>`
- Y: `QA UNIF22 <TC> CLIENTE Y <RUN>`
- Z: `QA UNIF22 <TC> CLIENTE Z <RUN>`

Contatos:

- E-mail A: `qa.unif22.<tc>.a.<run>@example.com`
- E-mail C: `qa.unif22.<tc>.c.<run>@example.com`
- Celular B: `3198TTTRRRR`
- Celular D: `3197TTTRRRR`

`TTT` é o número do TC e `RRRR` é um sufixo aleatório de quatro dígitos. Use `example.com`, domínio reservado para documentação. O celular deve ter 11 dígitos e não precisa pertencer a uma linha telefônica real.

### 3.2 CPF válido e não real

Use uma base aleatória de nove dígitos e calcule os dois dígitos verificadores. Nunca escolha CPF observado em outra org. Exemplo de gerador local:

```python
def cpf_sintetico(base: int) -> str:
    digitos = [int(valor) for valor in f"{base:09d}"]
    dv1 = (sum(v * p for v, p in zip(digitos, range(10, 1, -1))) * 10) % 11
    digitos.append(0 if dv1 == 10 else dv1)
    dv2 = (sum(v * p for v, p in zip(digitos, range(11, 1, -1))) * 10) % 11
    digitos.append(0 if dv2 == 10 else dv2)
    return ''.join(map(str, digitos))
```

Gere CPFs distintos para X, Y e Z e valide ausência na org antes do DML. Evite sequências repetidas e valores usados em exemplos públicos.

### 3.3 Identificadores técnicos

Gere UUIDs diferentes para:

- `IDCLI-X`, `IDCLI-Y`, `IDCLI-Z` → `Account.Id__c`.
- `PROS-X`, `PROS-Y`, `PROS-Z` → `Lead.Id__c` e `Account.IdProspectSalesforce__c`.
- IDs dos envelopes Event Grid.

O vínculo lógico correto é sempre:

```text
Account.IdProspectSalesforce__c == Lead.Id__c
```

Nunca use o mesmo UUID como IdCliente e IdProspect, exceto nos TCs que simulam explicitamente essa inconsistência.

## 4. Política de execução CLI

### 4.0 Mapa canônico de fluxo e versões

Esta classificação foi refeita a partir das colunas **Plano financiamento** e **Fluxo** da planilha:

| TCs | Fluxo da planilha | Cadeia obrigatória por RUN |
|---|---|---|
| `TC-001` a `TC-039` | `INICIAR JORNADA DE UNIDADE` | **2.1 → 2.2** |
| `TC-040` a `TC-048` | `INICIAR VENDA GENÉRICA` | **2.1 → 1.3 → 2.2** |
| `TC-049` a `TC-050` | `INICIAR JORNADA DE UNIDADE` | **2.1 → 2.2** |
| `TC-051` a `TC-058` | `INICIAR VENDA GENÉRICA` | **2.1 → 1.3 → 2.2** |
| `TC-059` | `INICIAR JORNADA DE UNIDADE` | **2.1 → 2.2** |
| `TC-060` a `TC-064` | `INICIAR VENDA GENÉRICA` | **2.1 → 1.3 → 2.2** |
| `TC-065` a `TC-070` | `INICIAR JORNADA DE UNIDADE` | **2.1 → 2.2** |

Assim, os 70 cenários ficam distribuídos em:

- **48 cenários de Jornada de Unidade:** 2.1 antes da PAC e 2.2 depois da PAC.
- **22 cenários de Venda Genérica:** 2.1 no início/Account, 1.3 na deduplicação e no vínculo, e 2.2 depois da PAC.

#### Responsabilidade de cada versão

| Versão | O que o RUN precisa executar | Evidência mínima |
|---|---|---|
| **2.1** | Iniciar a jornada a partir do Lead pelo ponto real `PesquisarContaController.getAccountForLead`, que chama `ClienteService.createOrUpdateClienteByLeadUnificacao`. | Retorno do controller, log `Lead-IniciarJornada`, Account criada/reutilizada, CPF e `IdProspectSalesforce__c` resultantes. |
| **1.3** | Na Venda Genérica, executar o caminho real de `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable` para decidir Lead principal, Caso C, fallback, Regra 6.6 e vínculo `IdCliente × IdProspect`. | Resultado do invocable/Flow, log `MicroServicoCliente_CRIAR_ATUALIZAR_CLIENTE`, Salesforce Id do Lead antes/depois, contagem de Leads e vínculo final. |
| **2.2** | Após a PAC, publicar a cadeia real em `/PAC`, `/Cliente` e `/MaquinaEstado`, incluindo Queueable, callback e eventos de retorno. | HTTP, payloads, snapshots, `LogIntegracao__c`, jobs e convergência final. |

#### O que pode permanecer do teste anterior da 1.3

Podem permanecer sem alteração:

- topologias X/Y/Z e colisões por CPF, e-mail e celular;
- prioridade de Lead por CPF forte;
- Caso C para Lead preso;
- fallback por Lead sem CPF e sem Account;
- Regra 6.6 na criação;
- asserts de preservação, duplicidade e vínculo `Account.IdProspectSalesforce__c == Lead.Id__c`.

Não pode permanecer como prova de 1.3 o setup que grava diretamente Account, Lead ou `IdProspectSalesforce__c`. Esse setup é útil para testar isoladamente o recorte 2.2, mas o veredito deve ser identificado como **recorte 2.2**, nunca como E2E completo do TC.

### 4.1 CLI completo

Este é o modo obrigatório e suficiente para executar e concluir tecnicamente qualquer TC não bloqueado no ambiente disponível.

1. Gere um RUN e faça precheck por CPF, e-mail, celular, IdCliente e IdProspect.
2. Prepare somente os registros que a planilha exige como **preexistentes** (Lead X de entrada e candidatos/colisões Y/Z). Não antecipe por DML direto a Account ou o vínculo que 2.1/1.3 devem produzir.
3. Salve snapshots iniciais de X/Y/Z e dos vínculos existentes.
4. Execute a **2.1** pelo ponto real `PesquisarContaController.getAccountForLead`; valide o retorno de `ClienteService.createOrUpdateClienteByLeadUnificacao`, a Account criada/reutilizada e o vínculo com `Lead.Id__c`.
5. Se o fluxo for **Venda Genérica**, execute também a **1.3** pelo caminho real `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable`; valide deduplicação, Lead principal, Caso C/fallback/Regra 6.6 e vínculo `IdCliente × IdProspect`.
6. Crie ou prossiga com Opportunity/PAC/Proponente sintéticos usando exatamente os IDs produzidos pelas etapas anteriores. Se a Opportunity for criada diretamente pela API, registre-a como fixture de transição, sem atribuir essa criação à 2.1 ou à 1.3.
7. Acione a **2.2** em `/PAC`, `/Cliente` e `/MaquinaEstado`, conforme o cenário, com Event Ids e timestamps exclusivos.
8. Nos cenários divergentes, envie `contato-*` e `endereco-*` antes de `cliente-*` e valide o descarte defensivo.
9. Aguarde e correlacione Queueables e `callMSClienteFuture`.
10. Salve snapshots depois da 2.1, depois da 1.3 quando aplicável e em cada marco da 2.2.
11. Valide logs, vínculos, preservação de X/Z e ausência de duplicidade em cada fronteira.
12. Compare separadamente com a planilha e com as regras canônicas de 2.1, 1.3 e 2.2.
13. Salve todas as evidências para `PASS-CLI`; para `FAIL-CLI`, salve ao menos a asserção que falhou, o payload/comando que a provocou e a evidência persistida da falha.

Nos TCs pós-PAC sensíveis à ordem, a execução CLI completa exige a cadeia assíncrona aplicável inteira. Uma resposta HTTP simulada do MS Clientes comprova apenas o callout; ela não substitui os eventos de retorno que o ecossistema publicaria. Envie e valide explicitamente:

1. `cliente-insert` ou `cliente-update` inicial com `PROS-X`;
2. todos os `contato-*` e `endereco-*` aplicáveis;
3. `Lead-ClienteInsertPAC` e callback concluídos;
4. `cliente-update` de retorno com `PROS-Y`;
5. `pac-update` posterior, mantendo no payload o prospect original quando essa for a condição real do cenário;
6. `jornadausuario-update` ou evento de máquina aplicável;
7. convergência final de Account, Lead, Proponente, PAC e Opportunity.

#### 4.1.1 Perfis obrigatórios de ordenação assíncrona

Para **todo TC executável da Unificação 2.2**, execute os três perfis abaixo com massa nova, independentemente de ser MATCH, NO-MATCH, reuso, criação, fallback, Caso C, Venda Genérica ou Venda de Unidade. A ausência dessa exigência no texto individual de um cenário não representa dispensa.

PA, CA e ME variam somente a ordem dos eventos da etapa **2.2**. Eles não substituem as etapas pré-PAC. Antes dos eventos de cada perfil, repita com massa nova:

- Jornada de Unidade: `2.1 → perfil 2.2`;
- Venda Genérica: `2.1 → 1.3 → perfil 2.2`.

| Perfil | Ordem de chegada a reproduzir | Objetivo obrigatório |
|---|---|---|
| `ORDEM-PARCIAIS-ANTES` | `contato/endereco(PROS-X)` → `cliente-insert(PROS-X)` → Queueable/callback → `cliente-update(PROS-Y)` → `pac-update` → máquina | provar descarte defensivo e zero DML em X antes da criação de Y |
| `ORDEM-CLIENTE-ANTES` | `cliente-insert(PROS-X)` → Queueable em concorrência com `contato/endereco(PROS-X)` → `cliente-update(PROS-Y)` → `pac-update` → máquina | provar consistência eventual e convergência para Y quando o cliente chega primeiro |
| `ORDEM-MESMO-EVENTTIME` | cliente, contato e endereço com o mesmo `EventTime`, alternando a ordem real das requisições | provar que empate de timestamp não gera duplicidade, sobrescrita ou resultado dependente de `CreatedDate` |

Adapte os identificadores ao cenário: em MATCH, `PROS-X == PROS-Y`, nenhum novo vínculo é esperado e Queueable/callback podem ser não aplicáveis. Mesmo assim, PA, CA e ME continuam obrigatórios. Quando um eventType não existir no contrato específico do cenário, marque somente esse evento como não aplicável, com justificativa; o RUN do perfil continua obrigatório usando toda a cadeia válida restante.

Ordens observadas em `mrv_staging` e que fundamentam essa matriz:

| Data UTC | Ordem observada |
|---|---|
| 2026-08-21 18:30 | contatos/endereço → `cliente-insert` → `cliente-update` |
| 2026-08-20 12:53 | cliente, contatos e endereços no mesmo segundo → `cliente-update` |
| 2026-08-22 14:43 | `cliente-insert` → contatos/endereço → `cliente-update` → `pac-update` → máquina |

Não conclua nenhum TC com `PASS-CLI` ou `PASS-COM-LACUNA-DE-LOG` antes de terminar os três perfis. Execute-os sequencialmente, nunca ao mesmo tempo, e use massa independente em cada RUN. Se um evento obrigatório não existir no ambiente simulado, publique seu payload manualmente com chaves e timestamps do RUN.

### 4.2 Execução parcial

Qualquer execução que omita uma versão aplicável da cadeia, uma validação CLI obrigatória ou um dos três perfis PA/CA/ME é parcial e não conclui o TC.

O roteiro abaixo é apenas um **diagnóstico do recorte 2.2**. Ele não comprova o TC E2E quando a 2.1 ou a 1.3 tiver sido preparada por DML direto:

1. Prepare X/Y/Z conforme o TC.
2. Para CPF divergente, publique primeiro um `contato-*` e um `endereco-*` de Y usando `PROS-X`. Ambos devem retornar HTTP 200 sem alterar X nem criar estrutura parcial de Y.
3. Publique `cliente-insert` ou `cliente-update` de Y usando `PROS-X` como prospect da jornada.
4. Aguarde `Queueable` e `callMSClienteFuture`; consulte o `PROS-Y` final.
5. Publique os contatos definitivos usando `PROS-Y`.
6. Consulte o estado final e os logs.

Registre execução parcial como `INCONCLUSIVO` ou `DIAGNOSTICO`, sem `PASS-CLI`/`FAIL-CLI`.

As etapas 2 e 3 são obrigatórias para afirmar que a proteção pós-PAC contra ordem invertida foi validada. Uma execução que começa por `cliente-*` cobre a criação/vinculação, mas não cobre a causa-raiz da sobrescrita por evento parcial.

### 4.3 Casos bloqueados

Prepare a massa apenas se isso ajudar o diagnóstico. Não altere o status enquanto a dependência funcional ou técnica continuar aberta. Quando o caso for desbloqueado, sua primeira execução conclusiva deve seguir o CLI completo.

### 4.4 Definição de CLI completo

Um TC é CLI completo somente quando todos os itens aplicáveis forem comprovados na mesma execução:

1. Prechecks por todas as chaves realizados antes do DML.
2. Somente os registros definidos como preexistentes na planilha foram montados como fixture.
3. A 2.1 foi executada por `PesquisarContaController.getAccountForLead` e seu resultado foi salvo.
4. Nos TCs de Venda Genérica, a 1.3 foi executada por `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable`, com evidência da decisão de Lead e do vínculo.
5. `/PAC`, `/Cliente` e `/MaquinaEstado` foram acionados quando aplicáveis à 2.2.
6. A ordem invertida de eventos foi validada nos cenários divergentes.
7. Respostas HTTP, retornos Apex/Flow e payloads sanitizados foram registrados.
8. Account, Lead, Proponente, PAC e Opportunity ficaram no estado esperado em cada fronteira.
9. X/Z e vínculos preexistentes foram preservados quando exigido.
10. Logs Salesforce, Queueables e callbacks concluíram sem erro e foram correlacionados ao RUN; quando um log não persistiu, o pacote substitutivo da seção 6.3.1 ficou completo.
11. Duplicidades e vínculo `Account.IdProspectSalesforce__c == Lead.Id__c` foram validados, ou o Caso C foi justificado.
12. O resultado foi confrontado separadamente com as regras de 2.1, 1.3 e 2.2 aplicáveis ao fluxo.
13. Todas as evidências CLI foram salvas antes da limpeza.
14. Os perfis `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME` foram executados sequencialmente, com massas e cadeias pré-PAC independentes. EventType formalmente não aplicável foi justificado dentro de cada RUN, sem eliminar o perfil.
15. A cadeia de retorno aplicável incluiu `cliente-update(PROS-Y)`, `pac-update` e máquina; callback HTTP isolado não foi aceito como substituto.

Se qualquer item CLI aplicável não puder ser comprovado nem pela evidência primária nem pelo pacote substitutivo da seção 6.3.1, e nenhuma falha obrigatória tiver sido materializada, a execução é `INCONCLUSIVA`. Uma falha obrigatória comprovada permite `FAIL-CLI` por fail-fast. Quando somente a persistência do log estiver ausente e todos os critérios substitutivos forem atendidos, use `PASS-COM-LACUNA-DE-LOG`.

### 4.5 Pré-requisitos obrigatórios

Não inicie um TC até confirmar acesso operacional a:

1. Salesforce CLI autenticada na `mrv_devDan`.
2. Permissão para Apex anônimo, DML sintético, SOQL e endpoints Apex REST.
3. Capacidade de consultar `LogIntegracao__c` e `AsyncApexJob`.
4. Diretório temporário para payloads sanitizados e evidências.

Partner Community, interface, contrato renderizado e monitores Azure podem ser validados depois como extensão funcional. Sua ausência deve ser registrada em **Evidências complementares não executadas**, mas não bloqueia `PASS-CLI`/`FAIL-CLI`.

### 4.6 Simulação controlada do MS Clientes

Esta simulação possui duas direções independentes:

| Direção | Como simular | O que comprova |
|---|---|---|
| Salesforce → MS Clientes (1.3) | mock HTTPS para GraphQL `criarAtualizarCliente` | chamada da Venda Genérica, IdCliente devolvido e continuação da deduplicação/vinculação |
| Salesforce → MS Clientes (2.2) | mock HTTPS para o callback GraphQL `atualizarCliente` | request/callout, parser da resposta e log funcional do callback |
| MS Clientes/Azure → Salesforce | publicação manual dos envelopes em `/Cliente`, `/PAC` e `/MaquinaEstado` | regras de negócio e convergência da cadeia assíncrona |

O mock GraphQL **não** publica eventos de retorno. Depois do callback, o executor deve enviar manualmente `cliente-update(PROS-Y)`, `pac-update` e máquina. Sem esses eventos, a execução é parcial.

#### 4.6.1 Salvaguardas obrigatórias

1. Execute somente em `mrv_devDan`; staging permanece somente leitura.
2. Altere apenas `VFlexMsClientes`. Nunca altere `ServicoClientes`.
3. Capture e valide o endpoint original antes da alteração.
4. Não envie PII real ao mock. Use somente a massa sintética do RUN.
5. Instale/inicie o mock e o túnel fora do repositório, em `$TMPDIR`.
6. Só altere o Named Credential depois que um `POST` no túnel retornar HTTP 200 e o JSON esperado.
7. Registre restauração automática com `trap`; restaure também em falha/interrupção.
8. Confirme por Tooling API que o endpoint oficial voltou antes de concluir o relatório.

#### 4.6.2 Respostas GraphQL simuladas

Na etapa 1.3, `VG_MSClienteCriarAtualizarInvocable` espera:

```json
{
  "data": {
    "criarAtualizarCliente": {
      "id": "<IDCLI-DO-RUN>"
    }
  }
}
```

Na etapa 2.2, o callback espera:

```json
{
  "data": {
    "atualizarCliente": {
      "id": "CLI-SIMULADO-<TC>-<RUN>"
    }
  }
}
```

O `id` da resposta precisa ser não nulo para validar o parser. Na 1.3, ele deve ser o `IDCLI` sintético reservado para o cliente do RUN. O `PROS-Y` usado nos eventos posteriores deve ser sempre consultado na Account/Lead resultante; não derive `PROS-Y` do IdCliente retornado.

Exemplo de mock local:

```bash
MOCK_PORT=8765

IDCLI_RUN='<IDCLI-DO-RUN>' python3 -u - <<'PY' >"$TMPDIR/ms-clientes-mock.log" 2>&1 &
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
    request_body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
    method = "criarAtualizarCliente" if b"criarAtualizarCliente" in request_body else "atualizarCliente"
    body = json.dumps({"data": {method: {"id": os.environ["IDCLI_RUN"]}}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
    self.send_header("Content-Length", str(len(body)))
        self.end_headers()
    self.wfile.write(body)

    def log_message(self, format, *args):
        print(format % args, flush=True)

HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
PY
MOCK_PID=$!
```

Publique o mock com um túnel HTTPS temporário. O exemplo pressupõe `cloudflared` disponível em `$TMPDIR/cloudflared`:

```bash
"$TMPDIR/cloudflared" tunnel \
  --url "http://127.0.0.1:$MOCK_PORT" \
  --no-autoupdate \
  >"$TMPDIR/cloudflared.log" 2>&1 &
TUNNEL_PID=$!

# Execute somente depois de o log informar que o túnel foi criado.
MOCK_URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' \
  "$TMPDIR/cloudflared.log" | head -1)

test -n "$MOCK_URL"
curl --fail --silent --show-error \
  --request POST "$MOCK_URL" \
  --data 'mutation { atualizarCliente { id } }' | jq .
```

Não prossiga se o hostname não resolver, o HTTP não for 200 ou o JSON não tiver `data.atualizarCliente.id`.

#### 4.6.3 Redirecionamento e restauração do Named Credential

Uma atualização simples do campo `Endpoint` falha porque `NamedCredential` exige o objeto composto `Metadata`. Preserve o metadata completo e altere somente `Metadata.endpoint`.

```bash
set -euo pipefail

NC_ID='0XA4T000000TNbyWAG'
OFFICIAL_ENDPOINT='https://apis.mrv.com.br/v2.0/clientes/graphql/'

ORIGINAL_ENDPOINT=$(sf data query \
  --target-org mrv_devDan \
  --use-tooling-api \
  --query "SELECT Endpoint FROM NamedCredential WHERE Id='$NC_ID'" \
  --json | jq -r '.result.records[0].Endpoint')

test "$ORIGINAL_ENDPOINT" = "$OFFICIAL_ENDPOINT"

update_named_credential_endpoint() {
  local target_endpoint="$1"
  local org token instance metadata payload http_code

  org=$(sf org display --target-org mrv_devDan --json)
  token=$(printf '%s' "$org" | jq -r '.result.accessToken')
  instance=$(printf '%s' "$org" | jq -r '.result.instanceUrl')
  metadata=$(sf data query \
    --target-org mrv_devDan \
    --use-tooling-api \
    --query "SELECT Metadata FROM NamedCredential WHERE Id='$NC_ID'" \
    --json | jq -c --arg endpoint "$target_endpoint" \
      '.result.records[0].Metadata | .endpoint=$endpoint')
  payload=$(jq -nc --argjson metadata "$metadata" '{Metadata:$metadata}')

  http_code=$(curl --silent --show-error \
    --output "$TMPDIR/named-credential-response.json" \
    --write-out '%{http_code}' \
    --request PATCH \
    "$instance/services/data/v67.0/tooling/sobjects/NamedCredential/$NC_ID" \
    --header "Authorization: Bearer $token" \
    --header 'Content-Type: application/json' \
    --data "$payload")

  test "$http_code" = '204'
}

restore_simulation() {
  update_named_credential_endpoint "$ORIGINAL_ENDPOINT"
  kill "$TUNNEL_PID" "$MOCK_PID" 2>/dev/null || true
}

trap restore_simulation EXIT INT TERM
update_named_credential_endpoint "$MOCK_URL"
```

Depois da execução, a confirmação final é obrigatória:

```bash
sf data query \
  --target-org mrv_devDan \
  --use-tooling-api \
  --query "SELECT Endpoint FROM NamedCredential WHERE Id='$NC_ID'" \
  --json | jq -r '.result.records[0].Endpoint'
```

A saída deve ser exatamente o endpoint oficial.

#### 4.6.4 Cadeia manual de eventos de retorno

Depois do evento inicial e da conclusão do Queueable/Future:

1. Consulte `Account.IdProspectSalesforce__c` de `IDCLI-Y` e `Lead.Id__c` de CPF Y.
2. Confirme `Account.IdProspectSalesforce__c == Lead.Id__c`; esse valor é `PROS-Y`.
3. Envie `cliente-update` para `/Cliente` usando `IDCLI-Y` e `PROS-Y`.
4. Envie `pac-update` para `/PAC` usando `IDCLI-Y`; quando o cenário reproduzir retorno atrasado, mantenha `PROS-X` em `proponentes[].idProponente` para provar que `PROS-Y` não será restaurado para o valor antigo.
5. Envie `jornadausuario-update` para `/MaquinaEstado` usando `IDCLI-Y` e `PROS-Y`.
6. Salve snapshots após cada etapa.

Payload mínimo de `cliente-update`:

```json
[
  {
    "id": "<EVENT-ID-CLIENTE-UPDATE>",
    "subject": "cliente",
    "data": {
      "IdCliente": "<IDCLI-Y>",
      "IdProspectSalesforce": "<PROS-Y>",
      "NomeCompleto": "<NOME-Y>",
      "NumeroCPF": "<CPF-Y>",
      "DataAlteracao": "<UTC-ISO-8601>"
    },
    "eventType": "cliente-update",
    "eventTime": "<UTC-ISO-8601>",
    "dataVersion": "1.0"
  }
]
```

Payload mínimo de `pac-update`. O formato legado de `dataAlteracao` dentro de `data`/`proponentes` não deve ter `Z`; mantenha `eventTime` em UTC com `Z`:

```json
[
  {
    "id": "<EVENT-ID-PAC-UPDATE>",
    "subject": "proponentecredito/PacEventGridDTO",
    "data": {
      "id": "<ID-EXTERNO-PAC>",
      "idJornadaPac": "<ID-EXTERNO-OPPORTUNITY>",
      "dataAlteracao": "2026-08-23T12:00:00.000",
      "status": "CREDITO_APROVADO_CONDICIONADO",
      "diasValidade": 30,
      "proponentes": [
        {
          "id": "<ID-EXTERNO-PROPONENTE>",
          "idPac": "<ID-EXTERNO-PAC>",
          "idProponente": "<PROS-X>",
          "idCliente": "<IDCLI-Y>",
          "cpf": "<CPF-Y>",
          "nomeCompleto": "<NOME-Y>",
          "email": "<EMAIL-APROVADO>",
          "telefoneCelular": "<CELULAR-APROVADO>",
          "tipoClassificacao": "Principal",
          "dataAlteracao": "2026-08-23T12:00:00.000"
        }
      ]
    },
    "eventType": "pac-update",
    "eventTime": "2026-08-23T12:00:00Z",
    "dataVersion": "1.0"
  }
]
```

Payload mínimo de máquina. `IdCorretor` deve ser um User Id válido e ativo da sandbox:

```json
[
  {
    "id": "<EVENT-ID-MAQUINA>",
    "subject": "Maquina de Estado",
    "data": {
      "id": "<ID-EXTERNO-OPPORTUNITY>",
      "dataalteracao": "2026-08-23T12:01:00",
      "Cliente": {
        "idCliente": "<IDCLI-Y>",
        "IdProspectSalesforce": "<PROS-Y>",
        "contatos": []
      },
      "estado": "DOCUMENTACAO",
      "Origem": "Web",
      "IdCorretor": "<USER-ID-ATIVO>"
    },
    "eventType": "jornadausuario-update",
    "eventTime": "2026-08-23T12:01:00Z",
    "dataVersion": "1.0"
  }
]
```

Envie cada arquivo para seu endpoint correspondente:

```bash
sf api request rest '/services/apexrest/Cliente' \
  --target-org mrv_devDan --method POST \
  --header 'Content-Type: application/json' \
  --body @cliente-update.json --include

sf api request rest '/services/apexrest/PAC' \
  --target-org mrv_devDan --method POST \
  --header 'Content-Type: application/json' \
  --body @pac-update.json --include

sf api request rest '/services/apexrest/MaquinaEstado' \
  --target-org mrv_devDan --method POST \
  --header 'Content-Type: application/json' \
  --body @maquina-estado.json --include
```

Os arquivos devem ficar fora do repositório e ser removidos após salvar as evidências.

#### 4.6.5 Critérios de sucesso da simulação

- callback `MicroServicoCliente_ATUALIZAR_CLIENTE=success` com o JSON simulado;
- Queueable e Future `Completed`, `NumberOfErrors=0`;
- eventos manuais aplicáveis com HTTP 200; quando o log existir, `LogIntegracao__c.Status2__c=success`;
- X/Z preservados;
- Account Y e Lead Y no resultado esperado do TC;
- Proponente principal em Account Y com `IdProponente__c=PROS-Y`;
- Opportunity em Account/Lead Y e fase esperada;
- PAC no status enviado;
- zero logs `error` correlacionados ao RUN; ausência de log não invalida o teste quando execução e estado final forem comprovados pela evidência substitutiva da seção 6.3;
- Named Credential restaurado e processos temporários encerrados.

## 5. Payload base pós-PAC

```json
[
  {
    "id": "<EVENT-ID>",
    "subject": "MS_Clientes",
    "data": {
      "idcliente": "<IDCLI-Y>",
      "idprospectsalesforce": "<PROSPECT-DA-JORNADA>",
      "nomecompleto": "<NOME-Y>",
      "numerocpf": "<CPF-Y>",
      "datanascimento": "1987-09-22",
      "dataalteracao": "<UTC-ISO-8601>",
      "categoria": "Nao identificado",
      "codsap": "0"
    },
    "eventType": "cliente-insert",
    "eventTime": "<UTC-ISO-8601>",
    "dataVersion": "1.0",
    "metadataVersion": "1",
    "topic": "/qa/unificacao-2.2/<TC>/<RUN>"
  }
]
```

Contatos devem ser envelopes Event Grid completos e separados:

```json
[
  {
    "id": "<EVENT-ID-CONTATO>",
    "subject": "MS_Clientes",
    "data": {
      "idcliente": "<IDCLI-Y>",
      "idprospectsalesforce": "<PROSPECT-DO-PASSO>",
      "tipocontato": "Email",
      "descricao": "<EMAIL>",
      "dataalteracao": "<UTC-ISO-8601>"
    },
    "eventType": "contato-insert",
    "eventTime": "<UTC-ISO-8601>",
    "dataVersion": "1.0",
    "metadataVersion": "1",
    "topic": "/qa/unificacao-2.2/<TC>/<RUN>"
  }
]
```

Repita com `tipocontato=Celular`. Para validar o descarte de endereço anterior ao cliente, use um envelope completo `endereco-insert` contendo `idcliente`, `idprospectsalesforce=PROS-X`, `dataalteracao` e os campos de endereço aceitos pelo contrato da org.

Exemplo de envio autenticado pela CLI:

```bash
sf api request rest '/services/apexrest/Cliente' \
  --target-org mrv_devDan \
  --method POST \
  --header 'Content-Type: application/json' \
  --body @payload.json \
  --include
```

Salve `payload.json` fora do repositório e remova-o após a evidência. Este comando faz parte da execução CLI e deve usar Event Ids e timestamps exclusivos do RUN. A resposta esperada para evento aceito ou descarte defensivo é HTTP 200. HTTP 4xx/5xx é falha no escopo CLI. Use timestamps crescentes; na ordem invertida, o evento parcial deve ter timestamp anterior ao `cliente-*`.

## 6. Evidências e perfis de log

### 6.1 Consultas mínimas

Substitua os placeholders por literais sintéticos antes de executar. Faça as consultas antes do setup e depois do processamento.

```sql
SELECT Id, CPF__pc, PersonEmail, PersonMobilePhone, Id__c,
       IdProspectSalesforce__c, CreatedDate, LastModifiedDate
FROM Account
WHERE CPF__pc IN (:cpfX, :cpfY, :cpfZ)
  OR Id__c IN (:idCliX, :idCliY, :idCliZ)
  OR IdProspectSalesforce__c IN (:prosX, :prosY, :prosZ)
  OR PersonEmail IN (:emailA, :emailC)
  OR PersonMobilePhone IN (:celularB, :celularD, :celularBComPais, :celularDComPais)
ORDER BY CreatedDate
```

```sql
SELECT Id, CPF__c, CPFNaoFormatado__c, Email, MobilePhone,
     CelularSemFormatacao__c, CelularFormatado__c, Id__c, DescricaoOrigem__c,
       CreatedDate, LastModifiedDate
FROM Lead
WHERE CPF__c IN (:cpfX, :cpfY, :cpfZ)
  OR CPFNaoFormatado__c IN (:cpfX, :cpfY, :cpfZ)
  OR Id__c IN (:prosX, :prosY, :prosZ)
  OR Email IN (:emailA, :emailC)
  OR MobilePhone IN (:celularB, :celularD)
  OR CelularSemFormatacao__c IN (:celularB, :celularD)
ORDER BY CreatedDate
```

Valide vínculos existentes antes de classificar um Lead como livre:

```sql
SELECT Id, CPF__pc, Id__c, IdProspectSalesforce__c
FROM Account
WHERE IdProspectSalesforce__c IN (:prospectIdsDosLeadsEncontrados)
```

```sql
SELECT Id, EventType__c, Status2__c, idObjeto__c, Cliente__c,
       CreatedDate, StackTrace__c
FROM LogIntegracao__c
WHERE CreatedDate >= :inicioExecucao
  AND CreatedDate <= :fimExecucao
  AND (Cliente__c IN :accountIds OR idObjeto__c IN :idClientes)
ORDER BY CreatedDate
```

Consulte `Lead-ClienteInsertPAC` separadamente, pois ele pode não ter `Cliente__c` nem `idObjeto__c`:

```sql
SELECT Id, EventType__c, Status2__c, CreatedDate, StackTrace__c
FROM LogIntegracao__c
WHERE EventType__c = 'Lead-ClienteInsertPAC'
  AND CreatedDate >= :inicioExecucao
  AND CreatedDate <= :fimExecucao
ORDER BY CreatedDate
```

```sql
SELECT Id, Status, JobType, MethodName, NumberOfErrors,
       CreatedDate, CompletedDate, ExtendedStatus
FROM AsyncApexJob
WHERE CreatedDate >= :inicioExecucao
  AND CreatedDate <= :fimExecucao
  AND (JobType = 'Queueable' OR MethodName = 'callMSClienteFuture')
ORDER BY CreatedDate
```

Correlacione a janela com o resultado no Lead/Account. Não coloque PII em novas mensagens de log.

### 6.2 Perfis reutilizados pelos TCs

**LOG-NOVA-ESTRUTURA**

- `cliente-insert` ou `cliente-update`: `Status2__c=success`, `Cliente__c=Account Y`, `idObjeto__c=IDCLI-Y`.
- `Lead-ClienteInsertPAC`: `success` na mesma janela.
- `contato-*`/`endereco-*` enviados: `success` e vinculados à Account Y.
- Queueable e `callMSClienteFuture`: `Completed`, `NumberOfErrors=0`.
- Nenhum log `error` relacionado ao RUN.

**LOG-REUSO-LEAD**

- Mesmo perfil de cliente.
- `Lead-ClienteInsertPAC=success` quando a queueable fizer o vínculo.
- O Lead preexistente mantém o mesmo Salesforce Id; não deve existir segundo Lead do CPF.

**LOG-MATCH**

- `cliente-*` e contatos com `success` na Account já existente.
- Não exigir `Lead-ClienteInsertPAC` quando nenhum vínculo/criação de Lead for necessário.
- Não pode surgir nova Account ou Lead.

**LOG-CASO-C**

- `cliente-*=success` na Account processada.
- `Lead-ClienteInsertPAC` pode existir e terminar `success`, mas não cria nem transfere Lead.
- Account processada permanece sem IdProspect; vínculo do Lead preso permanece intacto.

**LOG-CLI**

- Validar os endpoints Salesforce aplicáveis: `/PAC`, `/Cliente` e `/MaquinaEstado`.
- Validar Proponente, PAC e Opportunity quando indicados.
- Correlacionar `LogIntegracao__c`, Queueables e callbacks pelo RUN.
- Confirmar HTTP esperado, ausência de logs Salesforce `error` e estado final dos objetos.
- Se um `LogIntegracao__c` não for criado pelo defeito conhecido de batching do `IntegrationLogTriggerHandler`, registrar a ausência e usar HTTP + snapshots + timestamps/jobs como evidência substitutiva. Não classificar como falha funcional apenas pela ausência do log.

**LOG-BLOQUEADO**

- Não existe perfil de aprovação. Salvar evidência do bloqueio, dependência, etapa e mensagem apresentada.

### 6.3 Evidência obrigatória por execução

1. Ambiente, usuário, branch/commit, executor e horário UTC inicial/final.
2. Valores sintéticos de X/Y/Z e consulta de ausência/colisão por CPF, e-mail, celular, IdCliente e IdProspect antes do setup.
3. Snapshot inicial dos registros realmente preexistentes; separar explicitamente o que é fixture do que deve ser produzido pelo fluxo.
4. Evidência 2.1: entrada/retorno de `PesquisarContaController.getAccountForLead`, log `Lead-IniciarJornada` e snapshot da Account/Lead resultantes.
5. Nos TCs de Venda Genérica, evidência 1.3: entrada/retorno de `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable`, log do MS Clientes, decisão do Lead e vínculo antes/depois.
6. Snapshot da fronteira pré-PAC, antes de iniciar os eventos 2.2.
7. Payload integral sanitizado, Event Id, EventType, ordem, timestamp e resposta HTTP de cada evento 2.2.
8. Execução de `/PAC`, `/Cliente` e `/MaquinaEstado` quando aplicáveis ao TC.
9. Snapshot intermediário após eventos parciais/fora de ordem, comprovando descarte ou ausência de DML quando esperado.
10. Snapshot final de Account, Lead, Proponente, PAC e Opportunity aplicáveis.
11. Comparação antes/depois de X/Z e comprovação de preservação pelo mesmo Salesforce Id.
12. Contagem final de Accounts/Leads e validação do vínculo `Account.IdProspectSalesforce__c == Lead.Id__c` ou justificativa de Caso C.
13. IDs e status dos `LogIntegracao__c`, incluindo consulta separada de `Lead-ClienteInsertPAC`. Se algum log não existir, registrar explicitamente o eventType/Event Id sem log e anexar evidência substitutiva: HTTP 200, payload, snapshot antes/depois e `LastModifiedDate`/`EventTime__c` coerente; para processamento assíncrono, incluir também os jobs aplicáveis.
14. IDs de Queueables/callbacks, `Status=Completed` e `NumberOfErrors=0`.
15. Comparação explícita com cada critério tecnicamente observável da planilha e com as responsabilidades de 2.1, 1.3 e 2.2 aplicáveis.
16. Vereditos separados por etapa (`2.1`, `1.3`, `2.2`) e consolidado: `PASS-CLI`, `PASS-COM-LACUNA-DE-LOG`, `FAIL-CLI`, `BLOCKED`, `INCONCLUSIVO` ou `DIAGNOSTICO`.
17. Para cada perfil de ordem obrigatório, RUN/massa próprios, cronologia por `CreatedDate`, `EventTime`, Event Id e momento de conclusão do Queueable.
18. Payload e resultado do `cliente-update(PROS-Y)`, do `pac-update` e da máquina, incluindo snapshots antes e depois da convergência do Proponente e da Opportunity.

### 6.3.1 Hierarquia de evidências quando o log não existe

Um evento pode ser considerado executado e aprovado mesmo sem `LogIntegracao__c` quando **todos** os itens aplicáveis abaixo forem comprovados:

1. O endpoint retornou HTTP 200 para o Event Id registrado.
2. O payload integral sanitizado foi preservado.
3. O objeto alvo possui alteração compatível com o evento (`LastModifiedDate`, `EventTime__c`, status ou vínculo).
4. O estado final atende integralmente aos asserts do TC e não há duplicidade/sobrescrita indevida.
5. Queueable/Future aplicáveis terminaram `Completed` e `NumberOfErrors=0`.
6. Não existe log `error` ou job com erro correlacionado ao RUN.
7. A ausência do log foi registrada como incidente de observabilidade separado do veredito funcional.

Se algum desses itens não puder ser comprovado, use `INCONCLUSIVO`. Se todos forem comprovados e o único item ausente for a persistência do log, o veredito é `PASS-COM-LACUNA-DE-LOG`.

### 6.4 Evidências complementares opcionais

Quando houver acesso, acrescente sem bloquear o veredito CLI:

- Partner Community e fluxo visual da jornada;
- “Clientes da Jornada” e contrato renderizado;
- monitores externos de Jornadas, PAC, PAC-Processos, `analiseproposta-update` e Clientes;
- fila manual/reentrega do Event Grid.

A ausência dessas evidências deve constar no relatório como **não validado fora do Salesforce**, mas não torna a execução CLI inconclusiva.

### 6.5 Limpeza por allowlist

1. Durante o setup, registre cada Salesforce Id criado em uma allowlist do RUN, separada por objeto.
2. Antes de excluir, faça um dry-run consultando exatamente esses IDs e confirme prefixo do nome, CPF sintético e horário da execução.
3. Nunca limpe por CPF, e-mail, celular ou prefixo isoladamente; outra execução pode compartilhar uma chave de colisão intencional.
4. Exclua primeiro dependências criadas pelo RUN, depois Lead e por último Account. Inclua Proponente, PAC e Opportunity somente se também foram criados pelo RUN e estiverem na allowlist.
5. Não exclua Logs de Integração nem registros preexistentes reutilizados.
6. Registre no relatório os IDs removidos e os registros preservados.

## 7. Cenários TC-001 a TC-020

**Fluxo confirmado na planilha para todo este bloco:** `INICIAR JORNADA DE UNIDADE`. Cada RUN deve começar pela 2.1 real (`PesquisarContaController.getAccountForLead`) e continuar na 2.2 após a PAC. Quando a massa disser que X já possui Account, a 2.1 deve localizar/reutilizar essa Account; não pule a chamada por o vínculo já existir.

### TC-001 - CPF divergente com os mesmos contatos [Planilha: Passou]

- **Modo:** CLI completo obrigatório, com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** Lead X e Account X vinculados por `PROS-X`, com CPF X, e-mail A, celular B e `IDCLI-X`. Y não pode existir.
- **Execução `ORDEM-PARCIAIS-ANTES`:** criar Opportunity e PAC/Proponente de X; enviar contato/endereço de Y com `PROS-X` antes do cliente e comprovar zero DML; enviar `cliente-insert` de Y/`IDCLI-Y`; aguardar Queueable/callback; enviar `cliente-update` com `PROS-Y`, `pac-update` e máquina.
- **Execução `ORDEM-CLIENTE-ANTES`:** criar massa nova; enviar `cliente-insert` de Y com `PROS-X`; enviar contatos/endereço com `PROS-X` durante/depois do Queueable; enviar `cliente-update` com `PROS-Y`; enviar `pac-update` ainda contendo `PROS-X` no Proponente e `IDCLI-Y`; finalizar com máquina.
- **Esperado:** X intacto; nova Account Y; novo Lead Y somente com CPF, sem e-mail/celular, `DescricaoOrigem__c=InsertClientePAC`; novo `PROS-Y`; Account Y → Lead Y; Proponente principal com `PROS-Y`.
- **Snapshots obrigatórios:** antes dos eventos; após os eventos parciais; após Queueable/callback; após `cliente-update`; após `pac-update`; após máquina.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`; `cliente-insert`, eventos parciais, `Lead-ClienteInsertPAC`, callback, `cliente-update`, `pac-update` e `jornadausuario-update` em `success`; nenhum encaminhamento manual de Clientes.

### TC-002 - CPF, e-mail e celular divergentes [Planilha: Passou]

- **Modo:** CLI completo obrigatório.
- **Massa:** X completo e sincronizado. Y, e-mail C e celular D inexistentes.
- **Execução:** iniciar com X; aprovar PAC para Y usando C/D.
- **Esperado:** X intacto; Account Y e Lead Y novos; Lead Y recebe CPF Y, e-mail C e celular D; vínculo e callback corretos.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-003 - Match com dados idênticos [Planilha: Passou]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** Lead X e Account X vinculados, CPF X, e-mail A, celular B e `IDCLI-X`; sem duplicatas.
- **Execução:** em cada RUN, aprovar PAC com exatamente CPF/e-mail/celular/IDCLI/PROS de X. Variar a ordem de `cliente-update`, `contato-update` e `endereco-update` conforme o perfil; no empate, usar o mesmo `EventTime` e alternar a ordem das requisições. Finalizar com `pac-update` e máquina.
- **Esperado:** atualizar/reafirmar X; zero novas Accounts; zero novos Leads; vínculo original mantido.
- **Logs:** `LOG-MATCH` + `LOG-CLI`; Queueable/callback são não aplicáveis se o vínculo já estiver completo, mas todos os eventos enviados devem ficar em `success`.
- **Resultado integrado em 27/08/2026:** PA, CA e ME em `PASS-COM-LACUNA-DE-LOG`, com 2.1 e 2.2 executadas pelo caminho real.
- **Evidência detalhada:** [resultado integrado do TC-003](resultado-execucao-tc003-integrado-2026-08-27.md).

### TC-004 - Jornada sem CPF e PAC inclui CPF [Planilha: Passou]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** Lead X e Account X com e-mail A/celular B, sem CPF e sem IdCliente conforme a planilha.
- **Execução:** iniciar cada jornada sem CPF/IdCliente, mantendo PROS-X e os mesmos contatos; aprovar PAC com CPF X e IDCLI-X. Variar a ordem de `cliente-insert`, `contato-update` e `endereco-update` conforme o perfil; no empate, usar o mesmo `EventTime` e alternar a ordem real das requisições. Finalizar com `pac-update` e máquina.
- **Esperado:** reutilizar Lead/Account; preencher CPF e IdCliente; manter contatos; não criar duplicatas.
- **Logs:** `LOG-MATCH` + `LOG-CLI`. Validar que o vínculo final usa o IdProspect do Lead reutilizado; Queueable/callback são não aplicáveis se o PROS já estiver corretamente vinculado.

### TC-005 - Account Y existente, Lead Y ausente [Planilha: Em andamento]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y já existe com CPF Y e `IDCLI-Y`, sem Lead Y; C/D inéditos.
- **Execução:** aprovar a PAC de X para Y com e-mail C/celular D, variando `cliente-update`, contato e endereço conforme os três perfis. Após Queueable/callback, enviar `cliente-update(PROS-Y)`, `pac-update` e máquina.
- **Esperado:** reutilizar e atualizar Account Y; criar um Lead Y com C/D; vincular sem tocar X; uma Account e um Lead para Y.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.
- **Atenção:** relacionado ao bug 1075785. O Salesforce Id da Account Y deve permanecer o mesmo.

### TC-006 - Account Y e Lead Y órfão existentes [Planilha: Em andamento]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y com `IDCLI-Y`, sem IdProspect; Lead Y livre com CPF Y, e-mail C, celular D e `PROS-Y`.
- **Execução:** aprovar PAC para Y com C/D.
- **Esperado:** reutilizar o Lead Y e a Account Y; Account Y recebe `PROS-Y`; nenhum segundo Lead; X intacto.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Atenção:** bug 1075785; compare o Salesforce Id do Lead antes/depois.

### TC-007 - Contatos de Y pertencem ao Lead Z [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y com `IDCLI-Y`, sem Lead. Lead Z/Account Z possuem e-mail C e celular D. CPF Y não existe em Lead.
- **Execução:** aprovar Y com C/D.
- **Esperado:** Account Y atualizada; novo Lead Y somente com CPF e `InsertClientePAC`; Lead/Account Z e X intactos.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-008 - Account Y incompleta e Lead Y livre [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após definição funcional.
- **Contradição da planilha:** as premissas dizem Account Y apenas com CPF, sem IdCliente/IdProspect, e pedem vínculo com Lead Y; os critérios dizem Account Y já com IdCliente e Lead Y já vinculado a uma Account com IdCliente, esperando que Y permaneça sem novo prospect.
- **Ação permitida:** documentar as duas topologias separadamente, sem executar uma delas como se representasse o TC oficial.
- **Alternativa A proposta:** Account Y incompleta + Lead Y livre → comportamento do TC-009, `LOG-REUSO-LEAD`.
- **Alternativa B proposta:** Account Y com IdCliente + Lead Y preso → Caso C, `LOG-CASO-C`.
- **Critério de desbloqueio:** QA/PO deve escolher uma única topologia e atualizar premissas/critério da planilha.

### TC-009 - Account Y incompleta e Lead Y existente [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Account Y somente com CPF, sem IdCliente/IdProspect. Lead Y com CPF Y e `PROS-Y`; valide explicitamente que nenhuma Account aponta para `PROS-Y`. Salve e-mail/celular do Lead Y.
- **Execução:** aprovar Y usando A/B.
- **Esperado:** reutilizar Account Y e Lead Y livre; preencher `IDCLI-Y`; vincular `PROS-Y`; preservar e-mail/celular do Lead Y; X intacto; nenhuma nova Account/Lead.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Atenção:** se alguma Account já apontar para `PROS-Y`, a massa pertence ao Caso C e este TC é inválido.

### TC-010 - Colisão apenas de e-mail [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com e-mail A/celular B. Account Y existe com `IDCLI-Y`, sem Lead Y. Celular D é inédito.
- **Execução:** aprovar Y com e-mail A e celular D.
- **Esperado:** novo Lead Y com CPF Y e celular D, sem e-mail; Account Y → Lead Y; X intacto.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-011 - Colisão apenas de celular [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Account Y existe com `IDCLI-Y`; sem Lead Y. E-mail C é inédito.
- **Execução:** aprovar Y com e-mail C e celular B.
- **Esperado:** Lead Y com CPF Y e e-mail C, sem celular; vínculo em Account Y; X intacto.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-012 - Fallback por e-mail em Lead sem CPF [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com e-mail A/celular B. Account Y com `IDCLI-Y`, sem IdProspect. Criar outro Lead candidato, livre, sem CPF/Account, também com e-mail A e celular próprio. Assim existem dois Leads com A: o original preso a X e o candidato livre.
- **Execução:** aprovar Y com e-mail A e celular C, diferente de B.
- **Esperado:** excluir o Lead X pelo guard `ehLeadOriginal`, reutilizar o candidato livre pelo e-mail A, preencher CPF Y e, se vazio, `Id__c`; vincular à Account Y; não criar segundo Lead.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Regressão obrigatória:** comprovar o mesmo Salesforce Id do Lead candidato antes/depois, CPF Y preenchido, Account Y apontando para seu `Id__c`, Lead X intacto e zero Lead adicional para CPF Y.

### TC-013 - Fallback por celular em Lead sem CPF [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Account Y com `IDCLI-Y`, sem IdProspect. Criar outro Lead candidato livre, sem CPF/Account, também com celular B; não criar Lead CPF Y. Assim existem dois Leads com B: o original preso a X e o candidato livre.
- **Execução:** aprovar Y com e-mail C e celular B.
- **Esperado:** reutilizar candidato por celular; preencher CPF Y e Guid se necessário; Account Y → candidato.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Regressão obrigatória:** comprovar o mesmo Salesforce Id do Lead candidato antes/depois, CPF Y preenchido, Account Y apontando para seu `Id__c`, Lead X intacto e zero Lead adicional para CPF Y.

### TC-014 - Sem compatibilidade; IdCliente em minúsculas [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y com `IDCLI-Y` textual em minúsculas; nenhum Lead/contato compatível com Y/C/D.
- **Execução:** aprovar Y usando o mesmo IdCliente com variação de capitalização, se o contrato permitir caracteres alfabéticos.
- **Esperado:** reutilizar Account Y; criar Lead Y completo C/D; não criar Account duplicada.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.
- **Regressão obrigatória:** salvar o Salesforce Id da Account Y antes/depois, contar uma única Account para CPF/IdCliente e registrar os valores armazenado/recebido com capitalização oposta.

### TC-015 - Sem compatibilidade; IdCliente em maiúsculas [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes e massa nova com capitalização inversa ao TC-014: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Esperado:** match do IdCliente independente de capitalização; mesma Account Y; novo Lead Y completo.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.
- **Atenção:** se `Id__c` for case-sensitive na org, registrar `FAIL/REQUISITO` em vez de ajustar dados manualmente.

### TC-016 - Y inexistente e colisão total [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Nenhuma Account/Lead Y.
- **Execução:** aprovar Y com A/B.
- **Esperado:** nova Account Y; Lead Y somente CPF, sem A/B, com `InsertClientePAC`; X intacto.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-017 - Y inexistente; celular colide [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Y e e-mail C inexistentes.
- **Execução:** aprovar Y com e-mail C e celular B.
- **Esperado:** Account Y nova; Lead Y com CPF/e-mail C e sem celular; X intacto.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-018 - Y inexistente; e-mail colide [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Y e celular D inexistentes.
- **Execução:** aprovar Y com e-mail A e celular D.
- **Esperado:** Account Y nova; Lead Y com CPF/celular D e sem e-mail; X intacto.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-019 - Lead Y livre por CPF, contatos diferentes [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y com `IDCLI-Y`, sem IdProspect. Lead Y livre com CPF Y, `PROS-Y` e contatos próprios E/F diferentes dos aprovados.
- **Execução:** aprovar Y com C/D.
- **Esperado:** reutilizar Lead Y por CPF forte e vinculá-lo; preservar seus contatos conforme a planilha; atualizar Account Y com dados PAC; sem segundo Lead.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-020 - Account Y só com CPF; nenhum Lead [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y somente com CPF Y, sem IdCliente/IdProspect. C/D inéditos; nenhum Lead Y.
- **Execução:** aprovar Y com `IDCLI-Y`, C/D.
- **Esperado:** reutilizar a Account Y; preencher IdCliente; criar Lead Y completo; vincular IdProspect; não criar segunda Account.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

## 8. Cenários TC-021 a TC-040

**Classificação deste bloco:** TC-021 a TC-039 são `INICIAR JORNADA DE UNIDADE` e exigem **2.1 → 2.2**. TC-040 é `INICIAR VENDA GENÉRICA` e exige **2.1 → 1.3 → 2.2**.

### TC-021 - Account Y com prospect divergente [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado. Account Y com CPF/`IDCLI-Y`, mas `IdProspectSalesforce__c=PROS-Z`, associado a Lead Z de outra identidade. Não existe Lead Y; C/D inéditos.
- **Execução:** aprovar Y com C/D e o prospect da jornada X.
- **Esperado:** preservar X e Lead Z; atualizar Account Y; criar Lead Y completo; substituir o vínculo inválido da Account Y por `PROS-Y`; Proponente usa `PROS-Y`.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`; stack deve indicar prospect divergente sem registrar PII.

### TC-022 - Account Y incompleta e Lead Y órfão [E2E integrado concluído em 28/08/2026 UTC]

- **Modo:** CLI completo obrigatório com três RUNs independentes: `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`.
- **Massa:** X sincronizado com A/B. Account Y somente com CPF, sem IdCliente/IdProspect. Lead Y livre com CPF Y e contatos próprios E/F.
- **Execução:** aprovar Y com A/B.
- **Esperado:** Account Y recebe `IDCLI-Y` e `PROS-Y`; Lead Y é reutilizado pelo CPF e mantém E/F; Opportunity deve terminar na Account Y; X intacto.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`; validar eventos `jornadausuario-*` sem erro/fila manual.
- **Resultado do recorte 2.2:** PA, CA e ME em `PASS-COM-LACUNA-DE-LOG`; mesmas Account/Lead Y reutilizadas em cada massa, E/F preservados, Opportunity/Proponente em Y e zero erro funcional.
- **Veredito E2E atual:** PA, CA e ME em `PASS-COM-LACUNA-DE-LOG` na campanha `R7005701`, executando **2.1 → 2.2** com massas independentes.
- **Observabilidade:** `pac-insert`, `pac-update` e `jornadausuario-update` ausentes nos três RUNs; cliente, Queueable e callback presentes em `success`.
- **Evidência detalhada:** [resultado da execução TC-022 em 24/08/2026](resultado-execucao-tc022-2026-08-24.md).
- **Evidência E2E atual:** [resultado automatizado TC-022 campanha R7005701](resultado-automatizado-unif22-tc022-r7005701.md).
- **Relação com TC-019:** TC-022 usa A/B já pertencentes ao Lead X, o que bloqueia indiretamente a reflexão Account → Lead. Seu PASS não invalida a falha do TC-019 com C/D inéditos.

### TC-023 - Account Y inexistente e Lead Y órfão [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** X sincronizado com A/B. Sem Account Y. Lead Y livre com CPF Y, `PROS-Y` e contatos E/F.
- **Execução:** aprovar Y com A/B.
- **Esperado:** criar Account Y; reutilizar Lead Y sem mudar E/F; vincular `PROS-Y`; X intacto; um Lead Y.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-024 - Lead Y preso a outra Account [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** X sincronizado. Account Y somente com CPF, sem IdCliente/IdProspect. Lead Y com CPF Y está vinculado por `PROS-Y` à Account Z.
- **Execução:** aprovar Y com `IDCLI-Y` e contatos A/B.
- **Esperado:** atualizar/completar Account Y, mas deixá-la sem IdProspect; Lead Y e Account Z intactos; nenhum novo Lead Y; não transferir prospect.
- **Logs:** `LOG-CASO-C` + `LOG-CLI`.

### TC-025 - Múltiplas Accounts Y; selecionar a mais recente [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório. Não use apenas `/Cliente` para executar o TC.
- **Massa:** X sincronizado. Criar Account Y1 e Y2 com mesmo CPF, sem IdCliente; modificar Y2 por último e registrar `CreatedDate`/`LastModifiedDate`. Não criar Lead Y. A/B pertencem a X.
- **Execução:** aprovar Y com A/B e `IDCLI-Y`.
- **Esperado da planilha:** selecionar Y2, preencher IdCliente, criar Lead Y somente com CPF e vinculá-lo; Y1 intacta.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI` na Account selecionada.
- **Atenção:** a planilha não é consistente sobre “mais recente” significar criação ou modificação. Registre ambos os timestamps. Se o sistema selecionar outra conta, marque `FAIL/REQUISITO`, sem corrigir dados durante o teste.

### TC-026 - Dois Leads Y; reutilizar o livre [E2E integrado concluído em 28/08/2026 UTC]

- **Modo:** três RUNs CLI completos e independentes: PA, CA e ME.
- **Massa:** Account Y com `IDCLI-Y`, sem IdProspect. Lead Y1 com CPF Y preso à Account Z; Lead Y2 com CPF Y livre. Ambos têm IdProspect distintos.
- **Execução:** aprovar Y com A/B.
- **Esperado:** reutilizar Y2 e vincular à Account Y; Y1/Account Z intactos; nenhum terceiro Lead Y.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Resultado do recorte 2.2:** PA, CA e ME em `PASS-COM-LACUNA-DE-LOG`; Y2 livre selecionado, Y1/Account Z preservados, exatamente dois Leads Y e Opportunity/Proponente em Y2 nas três massas.
- **Veredito E2E atual:** PA, CA e ME em `PASS-COM-LACUNA-DE-LOG` na campanha `R7011017`, executando **2.1 → 2.2** com massas independentes.
- **Observabilidade:** logs de cliente, Queueable e callback presentes; `pac-insert`, `pac-update` e `jornadausuario-update` ausentes.
- **Evidência detalhada:** [resultado da execução TC-026 em 24/08/2026](resultado-execucao-tc026-2026-08-24.md).
- **Evidência E2E atual:** [resultado automatizado TC-026 campanha R7011017](resultado-automatizado-unif22-tc026-r7011017.md).
- **Relação com TC-019:** A/B já pertencem ao Lead X e bloqueiam indiretamente a reflexão; o PASS não invalida o bug com C/D inéditos.

### TC-027 - Todos os Leads Y estão presos [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Account Y somente com CPF, sem IdCliente/IdProspect. Criar dois Leads com CPF Y, cada um vinculado a outra Account. A/B pertencem a X.
- **Execução:** aprovar Y com `IDCLI-Y`.
- **Esperado:** completar Account Y, mas mantê-la sem IdProspect; não criar terceiro Lead; preservar os dois vínculos existentes.
- **Logs:** `LOG-CASO-C` + `LOG-CLI`.

### TC-028 - Múltiplas Accounts Y e Lead Y livre [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após confirmar os vínculos preexistentes.
- **Massa descrita na planilha:** duas ou mais Accounts com CPF Y, todas sem IdCliente e todas com IdProspects preexistentes; datas de modificação diferentes; Lead Y livre com CPF Y/`PROS-Y` e contatos próprios.
- **Risco:** selecionar a Account mais recente e gravar `PROS-Y` substitui o IdProspect já existente. A planilha não identifica os proprietários dos prospects antigos nem explica por que podem ser removidos.
- **Ação permitida:** preparar Accounts e Leads totalmente sintéticos, mapear quem possui cada prospect e salvar snapshots; não disparar a substituição como teste conclusivo.
- **Esperado da planilha após desbloqueio:** somente a Account mais recentemente modificada recebe `IDCLI-Y`/`PROS-Y`; demais Accounts e Leads antigos permanecem intactos; nenhum prospect é roubado.
- **Logs futuros:** `LOG-REUSO-LEAD` + `LOG-CLI` na Account selecionada.
- **Critério de desbloqueio:** PO/QA deve definir o destino dos IdProspects preexistentes e confirmar `LastModifiedDate` como desempate.

### TC-029 - Jornada incompleta e troca X para Y [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após decisão funcional.
- **Massa:** Lead X sem Account; Account X somente com CPF, sem IdCliente/IdProspect; nenhuma estrutura Y.
- **Ação permitida:** preparar consultas e documentar a topologia; não aprovar a mutação como comportamento válido.
- **Esperado conforme planilha:** reaproveitar a estrutura incompleta permitida pelo fluxo, atualizar a Account para Y, gerar IdCliente/IdProspect e manter o Lead X histórico sem sobrescrever sua identidade.
- **Risco:** fazer uma Account de CPF X representar Y contradiz a diretriz “nunca sobrescrever cliente com dados de outro”.
- **Critério de desbloqueio:** PO/QA deve reconciliar a expectativa com a regra defensiva e definir se a Account X é comprovadamente um rascunho descartável da mesma pessoa.

### TC-030 - Segundo proponente novo em Venda de Unidade [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** jornada de unidade com proponente principal; Y/C/D totalmente inéditos.
- **Execução futura:** incluir Y como segundo proponente antes da PAC.
- **Esperado futuro:** criar Lead Y com CPF/C/D e IdProspect; criar/atualizar Proponente; preservar principal; sem duplicidades.
- **Logs:** `LOG-BLOQUEADO` agora. Quando liberado, `LOG-CLI` com Jornadas, PAC, PAC-Processos, `analiseproposta-update` e Clientes.

### TC-031 - Troca do segundo proponente sem IdCliente [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** segundo proponente X com Lead/Account vinculados, ambos sem IdCliente; PAC será aprovada para Y.
- **Execução futura:** incluir X como segundo proponente e aprovar Y.
- **Esperado conforme planilha:** reutilizar os registros incompletos, atualizar identidade para Y, vincular IdCliente/IdProspect e sincronizar Proponente.
- **Logs:** `LOG-BLOQUEADO`; após liberação, `LOG-CLI`.
- **Atenção:** mudança de CPF em registros existentes é sensível à regra “não sobrescrever outra pessoa”. Exigir confirmação funcional antes de executar como aprovação.

### TC-032 - Segundo proponente com Account Y existente [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Account Y com CPF/`IDCLI-Y`; segundo proponente ainda não incluído.
- **Execução futura:** adicionar Y à Venda de Unidade e enviar PAC.
- **Esperado:** reutilizar Account Y; não criar duplicata; associar Proponente/PAC corretamente.
- **Logs:** `LOG-BLOQUEADO`; após liberação, `LOG-MATCH` + `LOG-CLI`.

### TC-033 - Segundo proponente X aprovado como Y [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** segundo proponente X com Account/IdCliente; nenhuma Account/Lead Y; contatos de Y colidem com X conforme a planilha.
- **Execução futura:** incluir X e aprovar PAC para Y.
- **Esperado:** preservar X; criar Account Y; criar Lead Y somente CPF; novo IdProspect; Proponente aponta para Y.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-034 - Segundo proponente prioriza Lead por CPF [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Lead Y livre com CPF Y; outros Leads possuem e-mail C e/ou celular D usados na inclusão.
- **Execução futura:** adicionar segundo proponente Y com C/D.
- **Esperado:** priorizar Lead Y pelo CPF, criar/reutilizar Account Y, preservar contatos e Leads terceiros, sem novo Lead Y.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-035 - Repetição funcional do TC-034 [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa/execução/esperado/logs:** iguais ao TC-034, mas com massa nova.
- **Atenção:** a planilha repete o conteúdo. Registrar se a duplicação é intencional antes de retirar o bloqueio.

### TC-036 - Segundo proponente Y colide totalmente com X [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Lead/Account X sincronizados com A/B; Y inexistente usando A/B.
- **Execução futura:** incluir segundo proponente Y.
- **Esperado:** X intacto; Account Y nova; Lead Y somente CPF com `InsertClientePAC`; vínculos de Y isolados.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-037 - Segundo proponente muda de Y para Z [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** segundo proponente Y com Lead/Account sem IdCliente e contatos A/B; PAC aprova Z com A/B.
- **Execução futura:** incluir Y e aprovar Z.
- **Esperado conforme planilha:** reutilizar estrutura incompleta, atualizar para Z, vincular IdCliente/IdProspect, sincronizar Proponente.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-CLI`.
- **Atenção:** mesma ressalva de identidade do TC-031.

### TC-038 - Accounts Y duplicadas; priorizar a que tem IdCliente [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** X sincronizado. Duas Accounts com CPF Y: Y1 possui `IDCLI-Y`; Y2 só CPF. Nenhum Lead Y; A/B colidem com X.
- **Execução:** aprovar Y usando `IDCLI-Y`.
- **Esperado:** selecionar Y1 por IdCliente; criar Lead Y somente CPF; vincular Y1; Y2 e X intactos.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI` em Y1.

### TC-039 - Nova jornada do mesmo cliente Y [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead/Account Y sincronizados com CPF Y, e-mail A e celular B; C/D não existem em outros Leads.
- **Execução:** iniciar nova jornada para Y e aprovar a PAC com e-mail C/celular D.
- **Esperado:** reutilizar os mesmos registros e identificadores; atualizar contatos para C/D conforme o fluxo; Proponente e UI coerentes; zero duplicatas.
- **Logs:** `LOG-MATCH` + `LOG-CLI`.

### TC-040 - Venda Genérica aprova CPF Y diferente [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** iniciar a Venda Genérica para X com e-mail A/celular B, sem Lead X; Y e Lead Y inexistentes. Como não existe Lead X, A/B não representam colisão na base de Leads.
- **Execução 2.1:** iniciar a jornada e validar a criação/atualização da Account de X.
- **Execução 1.3:** passar pelo fluxo de Venda Genérica e validar a deduplicação do Lead principal e o vínculo `IdCliente × IdProspect` antes da PAC.
- **Execução 2.2:** aprovar PAC para Y mantendo A/B e executar PA, CA e ME com massas completas independentes.
- **Esperado:** Account Y e Lead Y completos com CPF Y/A/B; novo IdCliente/IdProspect; “Clientes da Jornada” mostra Y; cliente X permanece sem IdProspect.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

## 9. Cenários TC-041 a TC-060

**Classificação deste bloco:** TC-041 a TC-048, TC-051 a TC-058 e TC-060 são Venda Genérica (**2.1 → 1.3 → 2.2**). TC-049, TC-050 e TC-059 são Jornada de Unidade (**2.1 → 2.2**).

Nos TCs de Venda Genérica deste bloco, mantenha o teste já mapeado da árvore 1.3, mas execute-o pelo caminho real. A Account resultante da 2.1 deve alimentar `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable`; somente depois prossiga para os eventos 2.2.

### TC-041 - Venda Genérica com colisão total [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead X da Venda Genérica com CPF X/A/B. Y não existe.
- **Execução:** aprovar a PAC para CPF Y com A/B.
- **Esperado:** Account Y nova; Lead Y somente CPF, sem A/B, `InsertClientePAC`; Lead X intacto; Proponente e “Clientes da Jornada” apontam para Y.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-042 - Venda Genérica; e-mail colide [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead X com CPF X/A/B; Y e celular D inexistentes.
- **Execução:** aprovar Y com e-mail A e celular D.
- **Esperado:** Account Y nova; Lead Y com CPF/celular D, sem e-mail; X intacto; UI mostra Y.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-043 - Venda Genérica; celular colide [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead X com CPF X/A/B; Y e e-mail C inexistentes.
- **Execução:** aprovar Y com e-mail C e celular B.
- **Esperado:** Account Y nova; Lead Y com CPF/e-mail C, sem celular; X intacto.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-044 - Venda Genérica reutiliza Lead Y por CPF [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** jornada X; Lead Y livre com CPF Y/`PROS-Y`, sem Account; sem Account Y.
- **Execução:** aprovar Y com C/D.
- **Esperado:** criar Account Y; reutilizar Lead Y; vincular `PROS-Y`; não criar segundo Lead; UI/Proponente mostram Y.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Resultado integrado em 27/08/2026:** PA, CA e ME em `PASS-COM-LACUNA-DE-LOG`, com 2.1, 1.3 e 2.2 executadas pelo caminho real.
- **Evidência detalhada:** [resultado integrado do TC-044](resultado-execucao-tc044-integrado-2026-08-27.md).

### TC-045 - Venda Genérica reutiliza Lead sem CPF por e-mail [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** jornada X. Sem Lead CPF Y. Lead candidato livre sem CPF/Account com e-mail C e `PROS-CAND`; celular D inédito.
- **Execução:** aprovar Y com C/D.
- **Esperado:** Account Y nova; reutilizar candidato por e-mail; preencher CPF Y e manter/gerar IdProspect; não criar outro Lead.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-046 - Venda Genérica reutiliza Lead sem CPF por celular [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** jornada X. Sem Lead CPF Y. Lead candidato livre sem CPF/Account com celular D; e-mail C inédito.
- **Execução:** aprovar Y com C/D.
- **Esperado:** Account Y nova; reutilizar candidato por celular; preencher CPF Y/Guid se necessário; sem duplicata.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-047 - Venda Genérica reutiliza Lead por CPF forte [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** jornada X. Lead Y livre com CPF Y e contatos E/F diferentes de C/D; sem Account Y.
- **Execução:** aprovar Y com C/D.
- **Esperado:** criar Account Y; priorizar e reutilizar Lead Y por CPF; preservar seus dados conforme os critérios da planilha; sem segundo Lead.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-048 - Lead Y preso com compatibilidade total [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead Y com CPF Y/C/D já vinculado à Account Z com IdCliente; nenhuma Account destinada ao novo `IDCLI-Y`.
- **Execução:** aprovar a Venda Genérica para Y usando C/D e novo `IDCLI-Y`.
- **Esperado:** não roubar Lead Y; criar Account Y, mantê-la sem IdProspect; não criar outro Lead Y; Account Z/vínculo original intactos; UI exibe cliente aprovado.
- **Logs:** `LOG-CASO-C` + `LOG-CLI`.

### TC-049 - Venda de Unidade reutiliza Lead livre por contatos [Planilha: Não iniciado]

- **Fluxo:** Jornada de Unidade, **2.1 → 2.2**; não executar a 1.3 da Venda Genérica.
- **Modo:** CLI completo obrigatório.
- **Massa:** jornada X. Lead candidato livre, sem Account e sem CPF, com C/D. Y/Account Y inexistentes.
- **Execução:** aprovar Y com C/D.
- **Esperado:** criar Account Y; reutilizar candidato por fallback de contatos; preencher CPF Y; vincular e não duplicar.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.
- **Atenção:** se o texto da massa na planilha indicar CPF Y já preenchido no candidato, a decisão passa a ser reuso por CPF forte; registre qual variante foi efetivamente usada.

### TC-050 - Reutilizar Account Y e substituir prospect obsoleto [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após definição da chave de localização.
- **Massa descrita na planilha:** existe uma Account sem IdCliente, com IdProspect antigo, localizada apenas pelos mesmos e-mail/celular C/D aprovados; não existe Lead CPF Y. Não adicione CPF Y à Account para forçar o match.
- **Conflito técnico:** `getClientePosPac` busca Account por IdCliente, CPF e IdProspect, não por e-mail/celular. O caminho canônico não consegue localizar essa Account pela chave exigida na planilha.
- **Ação permitida:** comprovar por consultas que a Account existe apenas por contato e registrar o resultado atual sem alterar o vínculo.
- **Critério de desbloqueio:** definir uma chave suportada de localização ou implementar formalmente a busca por contato, com proteção contra homônimos/contatos compartilhados.
- **Logs:** `LOG-BLOQUEADO` até a definição.

### TC-051 - Proponente adicional novo na Venda Genérica [Planilha: Bloqueado]

- **Fluxo após desbloqueio:** Venda Genérica, **2.1 → 1.3 → 2.2**.
- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** cliente principal da Venda Genérica; Y/C/D totalmente inéditos.
- **Execução futura:** incluir segundo proponente e enviar PAC.
- **Esperado:** Lead/Account/Proponente Y criados e vinculados; principal preservado; sem duplicidade.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-052 - Proponente sem IdCliente muda de Y para Z [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após decisão funcional.
- **Massa:** Lead/Account Y vinculados entre si, sem IdCliente; PAC será aprovada para Z.
- **Ação permitida:** documentar a topologia e os snapshots; não validar mutação Y→Z como PASS.
- **Esperado conforme planilha:** reutilizar registros incompletos, atualizar identidade para Z, vincular IdCliente e manter relacionamento.
- **Risco/critério de desbloqueio:** alterar Lead/Account de Y para Z contradiz a diretriz defensiva; exigir decisão de PO/QA sobre a natureza descartável dos registros sem IdCliente.

### TC-053 - Proponente com Account/IdCliente existente [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Account Y com `IDCLI-Y` e, conforme a planilha, Lead/vínculo existente quando aplicável.
- **Execução:** adicionar Y à Venda Genérica e enviar PAC.
- **Esperado:** reutilizar Account Y; preservar vínculos; associar Proponente/PAC; nenhuma nova Account.
- **Logs:** `LOG-MATCH` + `LOG-CLI`.
- **Atenção:** o título da planilha menciona “venda de unidade”, embora o plano/fluxo sejam Venda Genérica. Registrar a inconsistência textual.

### TC-054 - Proponente X aprovado como Y na Venda Genérica [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** proponente X com Account/IdCliente; Y inexistente; contatos de Y colidem com X conforme a planilha.
- **Execução:** incluir X e aprovar PAC para Y.
- **Esperado:** X intacto; Account Y nova; Lead Y somente CPF; novo IdProspect; Proponente/UI em Y.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-055 - Priorizar Lead Y por CPF na Venda Genérica [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead Y livre com CPF Y/`PROS-Y`; e-mail C pertence ao Lead X e celular D ao Lead Z, ambos de CPFs diferentes.
- **Execução:** adicionar/aprovar proponente Y com C/D.
- **Esperado:** reutilizar Lead Y por CPF; criar/reutilizar Account Y; não alterar contatos do Lead Y nem Leads X/Z; sem novo Lead Y.
- **Logs:** `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-056 - Repetição funcional do TC-055 [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa/execução/esperado/logs:** iguais ao TC-055, com massa nova.
- **Atenção:** registrar duplicação aparente da planilha.

### TC-057 - Proponente Y colide totalmente com X [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Lead/Account X sincronizados com A/B; Y inexistente usando A/B.
- **Execução:** incluir/aprovar Y na Venda Genérica.
- **Esperado:** Account Y nova; Lead Y somente CPF com `InsertClientePAC`; X intacto; novo vínculo Y.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-058 - Proponente Y sem IdCliente aprovado como Z [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após decisão funcional.
- **Massa:** Lead/Account Y vinculados, sem IdCliente, com A/B; PAC aprova Z usando A/B.
- **Ação permitida:** capturar snapshots e documentar o comportamento atual; não aprovar mutação Y→Z.
- **Esperado conforme planilha:** reutilizar estrutura incompleta, atualizar CPF para Z, vincular IdCliente, manter contatos e sincronizar Proponente.
- **Risco/critério de desbloqueio:** mesmo conflito de identidade do TC-052; exigir decisão funcional explícita.

### TC-059 - Alteração cadastral pós-PAC em Venda de Unidade [Planilha: Bloqueado]

- **Fluxo após desbloqueio:** Jornada de Unidade, **2.1 → 2.2**; não executar a 1.3 da Venda Genérica.
- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** segundo proponente Y com Lead/Account sem IdCliente, A/B; PAC aprova Z; negociação altera para C/D.
- **Execução futura:** reproduzir a troca de aprovado e editar contatos na etapa indicada.
- **Esperado conforme planilha:** reutilizar registros, atualizar CPF/contatos, vincular IdCliente e refletir em “Clientes da Jornada”.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-CLI` com `cliente-*` e `contato-update`.

### TC-060 - Alteração cadastral pós-PAC em Venda Genérica [Planilha: Não iniciado]

- **Fluxo:** Venda Genérica, **2.1 → 1.3 → 2.2**.
- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após decisão funcional.
- **Massa:** proponente Y com Lead/Account sem IdCliente, A/B; PAC aprova Z; C/D não podem colidir com terceiros.
- **Ação permitida:** documentar a topologia e a sequência proposta; não executar como aprovação conclusiva.
- **Esperado conforme planilha:** mesmos registros passam a refletir Z/C/D; IdCliente/IdProspect vinculados; Proponente e UI atualizados; principal intacto.
- **Risco/critério de desbloqueio:** além da mutação Y→Z, o caso altera contatos depois da PAC. Exigir definição de identidade e sistema de origem antes de testar; C/D devem continuar inéditos quando liberado.

## 10. Cenários TC-061 a TC-070

**Classificação deste bloco:** TC-061 a TC-064 são Venda Genérica (**2.1 → 1.3 → 2.2**). TC-065 a TC-070 são Jornada de Unidade (**2.1 → 2.2**).

### TC-061 - Alteração na assinatura e reemissão de contrato [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Lead/Account Y sem IdCliente/IdProspect, A/B; cliente principal X intacto; PAC aprova Z.
- **Execução futura:** na assinatura, alterar e-mail para C/celular D e reemitir o contrato.
- **Esperado conforme planilha:** Lead/Account/Proponente passam a Z/C/D, recebem IdCliente/IdProspect; contrato reemitido reflete os novos dados; X intacto.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-CLI` e evidência do contrato.
- **Atenção:** título/status e fluxo da planilha precisam ser confirmados, pois misturam Venda Genérica, assinatura e regra pós-PAC.

### TC-062 - Account Y com IdCliente e sem IdProspect [Planilha: Não iniciado]

- **Modo:** CLI completo obrigatório.
- **Massa:** Account Y com CPF/`IDCLI-Y`, sem IdProspect; nenhum Lead CPF Y; C/D inéditos.
- **Execução:** aprovar PAC para Y sem `idprospectsalesforce` válido no payload.
- **Esperado:** reutilizar Account Y; criar Lead Y completo C/D; gerar `PROS-Y`; vincular e enviar callback; uma Account e um Lead Y.
- **Logs:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`; ramo `vincularLeadExistente` deve resultar em `Lead-ClienteInsertPAC=success`.

### TC-063 - Segundo proponente totalmente novo na Venda Genérica [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** jornada genérica com principal; Y/C/D inexistentes em Salesforce e MS Clientes.
- **Execução futura:** incluir segundo proponente Y via Salesforce.
- **Esperado:** Account, Lead e Proponente Y novos; IdCliente/IdProspect gerados e vinculados; UI mostra Y; principal preservado.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.

### TC-064 - Account com identificador armazenado no campo errado [Planilha: Não iniciado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após definição da regra de correção.
- **Massa:** Account Y com CPF Y e valor de prospect colocado em `Id__c`, sem Lead Y. Salvar snapshot completo. Use IDs sintéticos exclusivos.
- **Execução proposta:** aprovar PAC para Y com o IdCliente correto e C/D.
- **Esperado descrito na planilha:** localizar/preservar Account Y, corrigir IdCliente, criar Lead Y, gerar/vincular novo IdProspect e atualizar Proponente/UI.
- **Logs esperados se a regra existir:** `LOG-NOVA-ESTRUTURA` + `LOG-CLI`.
- **Atenção:** a própria planilha diz “Avaliar bem o resultado”. A regra canônica não autoriza inferir que um IdCliente contém um IdProspect nem corrigi-lo automaticamente. Até decisão explícita, classifique como `BLOCKED-FUNCIONAL`, capture o comportamento atual e não aprove.

### TC-065 - IdCliente igual a IdProspect e colisão total [Planilha: Não iniciado]

- **Fluxo:** Jornada de Unidade, **2.1 → 2.2**; não executar a 1.3 da Venda Genérica.
- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após separar prevenção e remediação.
- **Massa:** X sincronizado com A/B. Account Y com CPF Y e `Id__c == IdProspectSalesforce__c == ID-INCONSISTENTE`; nenhum Lead Y.
- **Conflito:** a planilha espera que o evento repare automaticamente a Account inconsistente. A regra canônica diz que o guard previne novas gravações; registros já divergentes são remediados separadamente por `AccountIdProspectSanitizationBatch`.
- **Diagnóstico preventivo permitido:** em outra Account limpa, envie payload com `idprospectsalesforce == idcliente` e confirme que o valor não é gravado. Esse diagnóstico não conclui o TC.
- **Remediação:** só executar o batch com autorização específica, escopo sintético e evidência antes/depois; não misturar o batch com o teste do evento.
- **Critério de desbloqueio:** PO/QA deve decidir se TC-065 valida prevenção, remediação ou ambos em etapas separadas.

### TC-066 - Dois Leads livres; priorizar o que tem CPF [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Lead Y1 com CPF Y/A/B/`PROS-Y1`, livre; Lead Y2 sem CPF com A/B/`PROS-Y2`, livre; sem Account Y.
- **Execução futura:** incluir segundo proponente com CPF Y.
- **Esperado:** priorizar Y1 por CPF; criar Account Y; vincular `PROS-Y1`; Y2 intacto; sem novo Lead.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-067 - Dois Leads com Accounts; priorizar o que tem CPF [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Lead Y1 com CPF Y/A/B vinculado à Account Y1; Lead Y2 sem CPF com A/B vinculado à Account Y2.
- **Execução futura:** incluir segundo proponente CPF Y.
- **Esperado:** reutilizar Lead Y1 e Account Y1; preservar Y2/Account Y2; Proponente associado a Y1; zero transferências.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-MATCH`/`LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-068 - Accounts duplicadas; priorizar última modificação [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após confirmar o critério de ordenação.
- **Massa preparada quando desbloquear:** Account Y1 e Y2 com mesmo CPF/A/B; Leads vinculados sem CPF; alterar Y2 por último e registrar timestamps.
- **Execução futura:** incluir segundo proponente CPF Y.
- **Esperado da planilha:** selecionar Y2 por `LastModifiedDate`, reutilizar seu Lead/IdProspect, preservar Y1.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-MATCH` + `LOG-CLI` na Y2.
- **Atenção:** não há definição canônica inequívoca desse desempate. Exigir aceite funcional antes de marcar PASS.

### TC-069 - CPF do Lead prevalece em Accounts duplicadas [Planilha: Bloqueado]

- **Modo:** `BLOCKED`; CLI completo obrigatório após desbloqueio.
- **Massa preparada quando desbloquear:** Account A com CPF Y e IdProspect; Account B mais recente, sem IdProspect; Lead Y com CPF Y/A/B relacionado à Account B.
- **Execução futura:** incluir segundo proponente CPF Y.
- **Esperado da planilha:** priorizar Lead Y e Account B pelo CPF/relacionamento; não escolher A apenas por ter IdProspect; não transferir o Lead.
- **Logs:** `LOG-BLOQUEADO`; depois `LOG-REUSO-LEAD` + `LOG-CLI`.

### TC-070 - Accounts duplicadas e Lead sem CPF [Planilha: Bloqueado]

- **Modo:** `BLOCKED-FUNCIONAL`; CLI completo obrigatório após definição da regra de priorização.
- **Topologia para diagnóstico:** Account A com CPF Y e IdProspect; Account B mais recente, sem IdProspect; Lead sem CPF/A/B vinculado à B.
- **Ação permitida:** preparar consultas e documentar os candidatos. Não disparar automação que reassocie registros até decisão do negócio.
- **Resultado atual:** indefinido. As alternativas abertas são priorizar Account mais recente, Account com IdProspect, vínculo atual Lead-Account, bloquear para saneamento ou reassociar o Lead.
- **Logs:** `LOG-BLOQUEADO`. Se o comportamento atual for observado em ambiente controlado, registrar todos os IDs/timestamps e qualquer detecção de inconsistência, sem classificá-lo como PASS.
- **Critério para desbloqueio:** Product Owner/QA deve escolher uma regra única e atualizar a planilha, a skill e os testes automatizados antes da execução manual conclusiva.

## 11. Modelo de relatório para o agente executor

Crie um relatório por TC com esta estrutura:

```markdown
# Execução <TC> - <RUN>

- Ambiente: mrv_devDan
- Fluxo da planilha: INICIAR JORNADA DE UNIDADE | INICIAR VENDA GENÉRICA
- Cadeia obrigatória: 2.1 → 2.2 | 2.1 → 1.3 → 2.2
- Modo: CLI | BLOCKED | INCONCLUSIVO | DIAGNOSTICO
- Início/fim UTC:
- Executor:
- Branch/commit observado:
- Resultado 2.1:
- Resultado 1.3: N/A | PASS | FAIL | INCONCLUSIVO
- Resultado 2.2:
- Resultado consolidado: PASS-CLI | PASS-COM-LACUNA-DE-LOG | FAIL-CLI | BLOCKED | INCONCLUSIVO | DIAGNOSTICO

## Massa

| Papel | CPF | E-mail | Celular | Account Id | IdCliente | Lead Id | IdProspect |
|---|---|---|---|---|---|---|---|
| X | | | | | | | |
| Y | | | | | | | |
| Z | | | | | | | |

## Pré-validação

- Consultas de ausência/colisão:
- Snapshot de registros preservados:
- Fixtures criadas diretamente (não contam como execução de versão):

## Fronteiras da unificação

| Etapa | Ponto de entrada real | Entrada | Resultado e evidência |
|---|---|---|---|
| 2.1 | `PesquisarContaController.getAccountForLead` | | |
| 1.3, somente Venda Genérica | `PermutaCadastroCliente` / `VG_MSClienteCriarAtualizarInvocable` | | |
| 2.2 | `/PAC`, `/Cliente`, `/MaquinaEstado` | | |

## Passos executados

1. ...

## Resultado observado

- Account:
- Lead:
- Proponente:
- Opportunity/Clientes da Jornada:
- Contrato, se aplicável:

## Evidências complementares opcionais

- Partner Community/UI:
- Clientes da Jornada:
- Contrato renderizado:
- Monitores Azure:
- Fila manual:

## Eventos enviados

| RUN/perfil | Event Id | EventType | Ordem de chegada | EventTime | HTTP | Payload sanitizado |
|---|---|---|---:|---|---:|---|

## Convergência assíncrona

| Momento | Account X | Account Y | Lead Y/PROS-Y | Proponente | Opportunity |
|---|---|---|---|---|---|
| Após eventos parciais | | | | | |
| Após Queueable/callback | | | | | |
| Após `cliente-update` | | | | | |
| Após `pac-update` | | | | | |
| Após máquina | | | | | |

## Logs

| EventType | Status | Cliente | IdObjeto | CreatedDate | Observação |
|---|---|---|---|---|---|

## Jobs assíncronos

| Job | Tipo | Status | Erros |
|---|---|---|---|

## Aderência

- Critérios da planilha atendidos:
- Critérios da planilha não atendidos:
- Regra da skill aplicada: CPF forte | fallback | Caso C | Regra 6.6 | MATCH
- Diretriz “não sobrescrever outra pessoa” preservada:
- Divergências entre planilha, skill e observado:

## Veredito

Compare cada assert CLI deste runbook com o observado. `PASS-CLI` e `FAIL-CLI` exigem execução CLI completa. Se faltar qualquer evidência CLI aplicável, use `INCONCLUSIVO`. Evidências externas ausentes devem ser anotadas, mas não bloqueiam o veredito CLI. Liste qualquer divergência, sem alterar dados para fazê-la desaparecer.
```

## 12. Checklist final da campanha

1. Todos os 70 TCs receberam relatório CLI ou justificativa `BLOCKED`.
2. Nenhum teste foi executado na `mrv_staging`.
3. Nenhuma PII real foi usada ou copiada para evidências.
4. Todos os registros preservados têm comparação antes/depois.
5. Todo Lead reutilizado foi comprovado pelo mesmo Salesforce Id.
6. Toda criação foi validada contra duplicidade de CPF.
7. Toda Account final tem IdProspect válido ou justificativa explícita de Caso C.
8. Nenhuma Account tem `IdProspectSalesforce__c == Id__c` fora dos setups intencionalmente inconsistentes.
9. Proponente, PAC e Opportunity aplicáveis foram validados por consulta.
10. UI, “Clientes da Jornada”, contrato e monitores externos não validados foram registrados como evidências complementares ausentes.
11. Casos duplicados ou ambíguos foram sinalizados no relatório.
12. A limpeza removeu apenas a massa criada pelo RUN e ocorreu depois das evidências.
13. Nenhum TC recebeu `PASS-CLI` sem completar todas as evidências CLI; `PASS-COM-LACUNA-DE-LOG` exigiu o pacote substitutivo integral da seção 6.3.1; nenhum `FAIL-CLI` foi emitido sem payload/comando e resposta/estado observado da asserção que falhou.
14. Todos os TCs executados possuem payloads, respostas HTTP e, quando aplicáveis, logs/Queueables/callbacks correlacionados por RUN ou ausência de log documentada com evidência substitutiva.
15. Todos os TCs executados possuem avaliação separada de aderência à planilha e à skill.
16. Qualquer evidência CLI obrigatória ausente sem pacote substitutivo completo e sem falha comprovada resultou em `INCONCLUSIVO`; ausência exclusiva de log com substituição completa resultou em `PASS-COM-LACUNA-DE-LOG`.
17. Todo TC com cliente + contato/endereço foi executado nos perfis `ORDEM-PARCIAIS-ANTES`, `ORDEM-CLIENTE-ANTES` e `ORDEM-MESMO-EVENTTIME`, com massas independentes ou justificativa formal de eventType não aplicável.
18. Todo fluxo pós-PAC aplicável incluiu os eventos de retorno `cliente-update`, `pac-update` e máquina; nenhum callback HTTP isolado foi tratado como E2E.
19. Cada TC aplicável contém execução com eventos no mesmo `EventTime` e ordem de requisição variada.
20. Cada RUN de Jornada de Unidade começou na 2.1 real e continuou na 2.2; nenhum setup direto de Account/Lead foi contado como 2.1.
21. Cada RUN de Venda Genérica percorreu 2.1 → 1.3 → 2.2; a árvore 1.3 foi executada pelo invocable/Flow real e não simulada por gravação direta do vínculo.
22. Relatórios de recorte indicam explicitamente a versão coberta e nunca recebem veredito E2E completo.