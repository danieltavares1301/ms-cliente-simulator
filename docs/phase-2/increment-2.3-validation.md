# Validação do incremento 2.3

## Histórico e política vigente

O incremento original introduziu scanner e transformação offline. A política do
ADR-0005, implementada em `0.2.1`, substitui a classificação ampla: a API pública
atual usa `scanSecrets`, `assertNoSecrets` e `sanitizeSecrets`.

## Cobertura vigente

- chaves de credencial em objetos e arrays aninhados;
- password/senha, token, cookie, apiKey, signingKey, subscriptionKey,
  connectionString, privateKey e famílias equivalentes;
- JWT/Bearer e URL com credenciais;
- findings e exceções sem o valor detectado;
- preservação de CPF, e-mail, telefone, nome, endereço, CEP e IDs de negócio;
- CLI opcional sem I/O de rede, com rejeição de URL, UNC, device path,
  sobrescrita e saída em `fixtures/raw`;
- validação de schemas Zod, determinismo, namespace, placeholders e segredos.

CPF válido e demais dados de negócio não dependem de allowlist. Essa ausência de
classificação não substitui autorização, minimização, revisão operacional ou
LGPD. Arquivos brutos continuam fora do Git.
