# Resolução da revisão da Fase 2

Em 2026-08-22, os achados válidos da revisão sobre `c6b7a55` foram resolvidos:

- os comandos offline rejeitam URLs, UNC (`\\server\share` e `//server/share`)
  e device paths do Windows antes de I/O; a validação também impede leitura de
  arquivo que resolva fora da raiz de fixtures escolhida;
- os handlers públicos implementados de cenários não declaram `bearerAuth` nem
  respostas `401`/`403`; os endpoints futuros preservam o contrato de segurança;
- o scanner executa detectores de credencial, JWT/Bearer e URL com credenciais;
  formatos e chaves de dados de negócio não geram finding;
- scanner e sanitizador compartilham a mesma classificação de chaves opacas de
  credenciais, sem diferença por caixa, separadores ou camelCase. Campos como
  `password`, `senha`, `passphrase`, `apiKey`, `secret`, `clientSecret`,
  `credential(s)`, `privateKey` e tokens de acesso, renovação ou sessão são
  reportados apenas por categoria/caminho e removidos deterministicamente,
  inclusive em objetos e arrays aninhados;
- chaves técnicas como `scenarioKey` e `stepKey` são preservadas. A única
  allowlist de hashes contém campos comprovados no schema:
  `idempotencyKeyHash`, `idClienteHash`, `idProspectHash` e
  `normalizedCorrelationKeyHash`. Não existe exceção genérica para sufixos
  `hash`/`digest`; assim, `passwordHash`, `secretHash` e `tokenDigest` continuam
  sendo credenciais;
- `authorizationHeader`, `subscriptionKey`, `connectionString`, `signingKey`,
  `privateKey`, `accessToken`, `refreshToken`, `sessionToken`, `clientSecret`,
  `webhookSecret`, `apiKey`, `cookie` e `setCookie` são detectados também com
  prefixos arbitrários, sem diferença por caixa ou separadores, inclusive sem
  valor, em objetos/arrays aninhados, e removidos pelo sanitizador.
  A CLI revalida o resultado final e não cria o arquivo se ainda houver dado
  sensível;
- fixtures de contrato geram `numerocpf` sintético e determinístico com checksum
  válido para compatibilidade Salesforce. O scanner não possui allowlist de CPF:
  documentos e demais dados de negócio simplesmente não fazem parte do secret
  scanning;
- `datanascimento` aceita somente uma data civil válida em `YYYY-MM-DD`, em
  alinhamento com o `parseDate` Apex e com o OpenAPI.

## Evidência de contrato Apex

Na org alvo de desenvolvimento, via Execute Anonymous, foi comprovado que
`DateTime.valueOfGmt` compila e executa para UTC com e sem milissegundos:
`2026-08-21 10:00:00.000Z` e `2026-08-21 10:00:00Z`. O contrato mantém ambas as
variantes e possui teste explícito para elas. Esta evidência registra somente
org, operação e formatos testados; não inclui usuário, host, payload ou log
sensível.

## TDD

Os testes de regressão foram escritos e executados antes das correções. O RED
reproduziu rejeição ausente de UNC/device/traversal, bypass do scanner por
prefixo, segurança indevida nos endpoints públicos, ausência de validação de
`datanascimento` e divergência do OpenAPI. Após a implementação, os mesmos
testes passaram no GREEN. A regressão bloqueante de credenciais opacas também
foi reproduzida com valores montados em runtime antes da correção; os testes
confirmam ausência desses valores nos achados, erros e arquivos de saída.
No endurecimento final sobre `bd832f6`, o RED também comprovou a exceção genérica
de hash/digest e as novas famílias de chaves. A política posterior registrada no
ADR-0005 substituiu a classificação de dados de negócio: o RED de `0.2.1`
demonstrou a API antiga e enganosa, a alteração indevida de campos de negócio e o
CPF incompatível com checksum. O GREEN cobre 64 namespaces sintéticos,
preservação de dados de negócio e remoção aninhada pelo sanitizador.
O bloqueador sobre `ba70749` teve RED explícito para famílias prefixadas e GREEN
para detecção, mensagens sem valores e remoção aninhada sem falsos positivos.

## Validações finais

- `format` e `format:check`: verdes;
- `validate:scenarios`: 1 teste aprovado;
- `validate:fixtures`: 4 fixtures renderizadas aprovadas;
- suíte completa: 14 arquivos e 122 testes aprovados;
- `lint`, `typecheck` e `build`: verdes;
- `db:generate`: duas execuções sem alteração; `db:check`: verde;
- `npm audit --audit-level=high`: exit code zero para high/critical; permanecem
  quatro vulnerabilidades moderadas transitivas de `drizzle-kit`.
