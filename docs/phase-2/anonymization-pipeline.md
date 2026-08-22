# Pipeline offline de anonimização

## Fluxo obrigatório

1. Faça a extração autorizada somente para uma área temporária segura fora do Git.
2. Execute localmente `npm run anonymize:logs -- <entrada.json> <saida.json> --seed <seed>`.
3. O comando valida JSON, transforma apenas campos conhecidos, remove CPF e segredos, e executa o scanner no resultado antes de gravar com criação exclusiva.
4. Execute `npm run validate:fixtures` e revise manualmente estrutura, correlações e conteúdo.
5. Versione somente JSON anonimizado aprovado e elimine a exportação bruta conforme a política corporativa.

O pipeline não contém cliente HTTP, `fetch` ou integração com Salesforce, Neon ou QStash. Os scripts TypeScript usam somente o suporte nativo do Node.js (mínimo 22.18), sem runner ou dependência adicional. Os comandos aceitam apenas caminhos locais explícitos, não sobrescrevem a entrada e não permitem saída em `fixtures/raw`.

## Estratégia de transformação

A mesma seed e o mesmo valor de origem produzem o mesmo token SHA-256 truncado, permitindo correlação sem persistir o valor original. E-mails usam `example.test`; nomes usam `Cliente Simulado <token>`; contatos, endereços e IDs técnicos recebem prefixos `TEL-SIM`, `END-SIM`, `CEP-SIM`, `CLI-SIM`, `PRO-SIM` ou `EVT-SIM`.

Não existe faixa oficial reservada de CPF. Por isso o anonymizer offline remove
campos de CPF/cadastro nacional. As fixtures de contrato, cujo schema exige a
chave `numerocpf` nos cenários de match, geram em runtime um documento
determinístico de 11 dígitos deliberadamente não real e inválido no checksum de
CPF. Esse formato não usa proveniência para escapar do scanner. Antes do E2E
Salesforce da Fase 4, deverá existir mapping de CPF de teste válido formalmente
aprovado caso a org exija checksum.

Credenciais, authorization, tokens, client secrets e sessões são removidos. Texto livre, mensagens, descrições e stack traces são rejeitados, não transformados: remova-os antes de repetir o comando.

## Scanner e limites

O scanner percorre objetos, arrays e strings, sinaliza chaves sensíveis e padrões plausíveis de CPF com checksum, e-mail externo ao domínio de teste, telefone brasileiro, JWT/Bearer, URL com credenciais e IDs Salesforce de 15/18 caracteres. O resultado inclui somente caminho, categoria e mensagem genérica; valores nunca são retornados nem impressos.

Marcadores sintéticos documentados, `run_`, `step_`, domínios `example.test` e allowlist explícita são aceitos. O scanner reduz risco, mas não prova anonimização completa: formatos inesperados, imagens, blobs e semântica indireta podem escapar. Revisão humana é obrigatória antes do commit. Logs brutos, credenciais e exports temporários são proibidos no repositório, mesmo que o scanner não os identifique.
