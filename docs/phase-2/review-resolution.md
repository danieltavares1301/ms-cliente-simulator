# Resolução da revisão da Fase 2

Em 2026-08-22, os achados válidos da revisão sobre `c6b7a55` foram resolvidos:

- os comandos offline rejeitam URLs, UNC (`\\server\share` e `//server/share`)
  e device paths do Windows antes de I/O; a validação também impede leitura de
  arquivo que resolva fora da raiz de fixtures escolhida;
- os handlers públicos implementados de cenários não declaram `bearerAuth` nem
  respostas `401`/`403`; os endpoints futuros preservam o contrato de segurança;
- o scanner executa detectores de credencial, JWT/Bearer, URL com credenciais,
  Salesforce ID e PII antes das permissões sintéticas, cujos formatos agora são
  restritos;
- scanner e anonimizador compartilham a mesma classificação de chaves opacas de
  credenciais, sem diferença por caixa, separadores ou camelCase. Campos como
  `password`, `senha`, `passphrase`, `apiKey`, `secret`, `clientSecret`,
  `credential(s)`, `privateKey` e tokens de acesso, renovação ou sessão são
  reportados apenas por categoria/caminho e removidos deterministicamente,
  inclusive em objetos e arrays aninhados;
- chaves técnicas como `scenarioKey`, `stepKey` e `idempotencyKeyHash` são
  preservadas; hashes/digests não são confundidos com credenciais brutas. A CLI
  revalida o resultado final e não cria o arquivo se ainda houver dado sensível;
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
