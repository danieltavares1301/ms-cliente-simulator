# Validação do incremento 2.3

## RED registrado

Em 2026-08-22, os testes foram escritos e executados antes da implementação com
`npm.cmd --prefix "D:\Documentos\Trabalho\Ambientes\MRV\MS Cliente" test -- src/redaction/scanner.test.ts src/redaction/anonymizer.test.ts src/redaction/cli.test.ts`.

O RED falhou como esperado: os módulos `scanner`, `anonymizer` e os dois comandos
offline ainda não existiam. Resultado: 3 arquivos e 3 suites falharam durante o
import, sem coleta de testes. A primeira tentativa executada fora do diretório do
repositório foi descartada por não exercer este projeto.

## Cobertura de casos

- chaves sensíveis em objetos e arrays aninhados;
- CPF com checksum, e-mail externo, telefone brasileiro, JWT/Bearer, URL com
  credenciais e IDs Salesforce de 15/18 caracteres;
- marcadores sintéticos, `run_`, `step_`, `example.test`, domínio aprovado,
  allowlist explícita e CPF com checksum inválido;
- findings e exceções sem o valor detectado;
- transformação determinística, consistência de correlação, remoção de CPF e
  segredos, prefixos sintéticos e rejeição de texto livre/stack trace;
- CLI sem I/O para URL, exit code não zero, proteção de input e `fixtures/raw`,
  JSON inválido sem vazamento e validação com/sem fixtures.

## GREEN e quality gates

- testes direcionados: 3 arquivos e 16 testes aprovados;
- `format` e `format:check`: verdes;
- `validate:fixtures`: verde, com mensagem clara para diretório ainda ausente;
- `validate:scenarios`: 1 teste aprovado;
- suite completa: 11 arquivos e 81 testes aprovados;
- `lint` e `typecheck`: verdes;
- `build`: verde, executando `validate:scenarios` e depois `validate:fixtures` no
  `prebuild`;
- `db:generate`: nenhuma alteração; `db:check`: verde;
- `npm audit --offline --audit-level=high`: verde, sem acesso de rede e sem
  vulnerabilidade disponível no cache local.
