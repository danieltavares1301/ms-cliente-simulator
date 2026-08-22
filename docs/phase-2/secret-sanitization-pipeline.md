# Sanitização offline de segredos

## Fluxo opcional

1. Faça a extração autorizada somente para uma área temporária segura fora do Git.
2. Execute localmente `npm run sanitize:export -- <entrada.json> <saida.json>`.
3. O comando valida JSON, remove campos de credenciais e redige JWT, Bearer e
   URLs com credenciais antes de gravar com criação exclusiva.
4. Execute `npm run validate:fixtures` para validar contrato, determinismo,
   namespace e ausência de segredos.
5. Revise o resultado conforme a política operacional e elimine o arquivo bruto.

O sanitizador é opcional e não faz parte do `prebuild`. Ele não contém cliente
HTTP, `fetch` ou integração com Salesforce, Neon ou QStash. Aceita apenas
caminhos locais explícitos, rejeita URLs, UNC e device paths, não sobrescreve a
entrada e não permite saída em `fixtures/raw`.

## Política de transformação

Campos como `authorization`, `password`, `senha`, `token`, `cookie`, `apiKey`,
`signingKey`, `subscriptionKey`, `connectionString`, `privateKey` e famílias
equivalentes são removidos recursivamente. JWT, Bearer e credenciais embutidas
em URL são substituídos por `[REDACTED]`.

CPF, e-mail, celular, telefone, nome, endereço, CEP e IDs de negócio são
preservados. A aplicação não tenta determinar se esses valores são reais,
fictícios ou sintéticos. Isso não significa que dados reais sejam seguros ou
recomendados: autorização, minimização, retenção e LGPD continuam sendo
responsabilidades operacionais.

## Secret scanning e fixtures

`scanSecrets` percorre objetos e arrays e retorna somente caminho, categoria e
mensagem genérica; o valor encontrado nunca integra o finding nem a mensagem de
erro. Chaves de credencial, JWT/Bearer e URL com credenciais continuam
bloqueados, inclusive em estruturas aninhadas.

`validate:fixtures` valida os schemas Zod, determinismo do renderer, namespace de
IDs, placeholders e ausência de segredos. CPF válido, e-mail, telefone, nome,
endereço, CEP e Salesforce ID não geram finding por formato ou chave. Arquivos
brutos e exports temporários continuam proibidos no Git.
