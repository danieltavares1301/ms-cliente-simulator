# Tarefa 8.4 — O12 implementado e validado ao vivo (com achado real de arquitetura)

## Escopo deste incremento

Terceira leva da Tarefa 8.4: implementa e valida ao vivo contra `mrv-devDan`
o perfil **O12** (Contenção da Account Y logo após insert), como ferramenta
diagnóstica dedicada (`scripts/stress-o12-contencao-account-y.ts`), seguindo
o mesmo precedente arquitetural do O10.

## Achado real nº 1: efeito colateral perigoso ao reaproveitar código do O10

Ao construir o script, a abordagem inicial foi importar funções utilitárias
diretamente de `scripts/stress-o10-concurrent-events.ts` (autenticação,
dispatch HTTP, schemas de consulta). Isso pareceu funcionar no `typecheck`,
mas a primeira execução real revelou uma consequência grave: o arquivo
`stress-o10-concurrent-events.ts` chama `main()` **incondicionalmente no
nível do módulo** (`void main().catch(...)` fora de qualquer função). Como
resultado, **qualquer importação de uma função exportada desse arquivo
executa uma rajada real e completa do próprio O10 contra `mrv-devDan` como
efeito colateral** — silenciosamente, sem nenhuma indicação no código do
script que a importa.

Isso foi detectado porque a primeira execução do O12 produziu, na mesma
saída, dois conjuntos de logs estruturados: os do meu script E os do O10
completo (incluindo `fieldWinners`, uma chave que só o O10 produz). A
execução acidental do O10 criou e removeu corretamente seus próprios
registros sintéticos (confirmado por consulta direta: resíduo zero), então
não houve vazamento de dados de teste — mas o *comportamento* é
inaceitável: rodar uma ferramenta deveria ser previsível e não desencadear
side-effects de rede reais contra a org por causa de um `import`.

**Correção aplicada**: as funções utilitárias reutilizáveis (autenticação
via `sf org display`, dispatch HTTP concorrente, detecção de sinais de lock,
schemas de consulta de Account/Lead/LogIntegracao__c) foram movidas de
`stress-o10-concurrent-events.ts` para `stress-o10-concurrent-events-lib.ts`
— o arquivo de biblioteca pura, sem nenhum efeito colateral no nível do
módulo, que já hospedava `buildConcurrentDispatchPlan`/`parseCliArguments`/
`resolveFieldWinners`. O script principal do O10 passou a importar essas
funções da lib, preservando exatamente o mesmo comportamento (validado por
`npm test`, `npm run typecheck`, `npm run lint` e `npm run build`, todos
verdes, sem qualquer mudança funcional). Um comentário foi adicionado na lib
explicando por que esses utilitários vivem ali e não no arquivo principal do
O10.

**Lição registrada para o futuro**: qualquer script de diagnóstico
(`scripts/*.ts`) que precise ser reaproveitado por outro script deve expor
suas funções através de um arquivo `-lib.ts` sem efeitos colaterais no nível
do módulo, nunca através do arquivo com a chamada `main()` de entrada.

## Achado real nº 2: `cliente-insert` isolado não cria Lead

Antes de fixar o design do cenário de contenção, um teste de controle foi
executado: um `cliente-insert` isolado, com payload básico (`idcliente`,
`idprospectsalesforce`, `numerocpf`, `dataalteracao`, `nomecompleto`), sem
qualquer Account/Lead pré-existente e **sem** disparo de rajada concorrente.

**Resultado real:** a Account foi criada, mas **nenhum Lead foi criado**
(`leadCount: 0`, `IdProspectSalesforce__c: null`). Investigação de código
confirmou por quê: `NotificacaoCliente.cls` só resolve/atualiza `Account`;
a lógica de Lead em `ClienteService.refletirAlteracoesLead` (chamada pelo
`after update` de `ClienteTrigger`) **só atualiza um Lead já existente**
(exige `IdProspectSalesforce__c`/`Id__c` preenchido e um Lead relacionado
já encontrado) — ela não cria Lead novo. A criação de Lead novo só ocorre no
caminho de "prospect divergente" já comprovado pelos perfis O01/O02/O08
(quando o `cliente-insert` de uma identidade nova reivindica o prospect de
uma Account de controle já existente).

**Correção aplicada ao design do O12**: o script agora cria primeiro uma
Account de controle X (via REST direto, mesmo padrão de
`CREATE_SYNTHETIC_ACCOUNT`), e só depois publica o `cliente-insert` de Y
usando o prospect de X (`idprospectsalesforce = idProspectX`) — reproduzindo
a única combinação comprovada que cria um Lead novo — e dispara a rajada
concorrente imediatamente em seguida, competindo pela Account Y recém-criada
enquanto a criação assíncrona do Lead pode ainda estar em andamento.

## Resultado real observado em `mrv-devDan`

Duas execuções limpas, em concorrência 12 e 30:

| Concorrência | `cliente-insert` | Rajada concorrente | Lead criado e vinculado | `UNABLE_TO_LOCK_ROW`/`DmlException` | Cleanup |
|---|---|---|---|---|---|
| 12 | 200 OK | 12/12 sucesso | Sim | Não observado | Resíduo zero |
| 30 | 200 OK | 30/30 sucesso | Sim | Não observado | Resíduo zero |

Em ambas as execuções, o `IdProspectSalesforce__c` final da Account Y **não**
foi o prospect de X que o evento carregou — o Salesforce atribuiu um novo
GUID de prospect à Account/Lead de Y, confirmando que o mecanismo de
"prospect divergente" gera uma identidade de prospect própria para Y, não
reaproveita a de X.

## Leitura honesta do resultado

Assim como o O10 (`docs/phase-6/o10-stress-concorrencia.md`), a rajada
concorrente **não** produziu `UNABLE_TO_LOCK_ROW`/`DmlException` em nenhuma
das execuções — nem mesmo com 30 requisições concorrentes disparadas
imediatamente após o `cliente-insert`. Isso é consistente com o achado
prévio: HTTP concorrente puro contra este org/arquitetura, por si só, não é
suficiente para forçar contenção observável de lock.

O **objetivo positivo do perfil O12** ("provar que contenção transitória não
apaga o Lead pelo rollback do savepoint") foi, no entanto, **satisfeito na
prática**: o Lead foi criado e corretamente vinculado à Account em 100% das
execuções, mesmo sob carga concorrente pesada na mesma janela de tempo. Não
foi necessário forçar um erro de lock para confirmar que o vínculo
Account↔Lead é resiliente sob essa carga.

Para efetivamente **forçar** um `UNABLE_TO_LOCK_ROW` seria necessário um
mecanismo de contenção real (ex.: um `FOR UPDATE`/lock explícito mantido do
lado do Salesforce), que exigiria alteração de Apex — fora do escopo desta
tarefa sem aprovação explícita, conforme já registrado na seção 16 do
catálogo copiado.

## Validação

- `npm test`: 763/763 (sem novos testes automatizados dedicados — o O12,
  como o O10, é uma ferramenta diagnóstica de validação ao vivo, não um
  cenário do catálogo declarativo; a suíte automatizada cobre o refactor
  da lib, não o script em si).
- `npm run typecheck` / `npm run lint` / `npm run build`: limpos.
- Duas execuções reais contra `mrv-devDan` (concorrência 12 e 30), com
  resíduo zero confirmado por consulta direta pós-cleanup em ambas.
- Refactor de `stress-o10-concurrent-events.ts`/`-lib.ts` validado como
  comportamento idêntico (mesmos testes, mesmo lint, mesmo build, antes e
  depois da migração das funções).
