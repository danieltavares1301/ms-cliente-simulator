# Textos originais dos bugs — commits 3 e 4 (TC-001)

Textos exatos enviados pelo usuário, sem paráfrase, referentes aos dois bugs do cenário TC-001 corrigidos pelos commits `1f6844e910` e `72cbd884f6` na branch `GV_918914_UnificPosAprovPAC`.

## Commit 4 — `1f6844e910` (Guard de identidade em `NotificacaoCliente`)

Turno 361, 2026-09-08T19:03:30Z:

> olhe este bug:
>
> ```
> bug de unificação 2.2 relacionado ao cenário TC-001 do runbook:
>
> **Título:**
>
> Atualização indevida da Account original (CPF X) em cenário de aprovação de PAC com CPF divergente
>
> **Descrição:**
>
> Durante a execução do cenário **TC-001 - Aprovação de PAC com CPF divergente**, foi identificado que a Account vinculada ao CPF original da jornada (CPF X) sofreu atualização de dados.
>
> Conforme o requisito, quando a PAC for aprovada para um CPF diferente (CPF Y), o sistema deve criar uma nova Account e um novo Lead para o CPF aprovado, preservando integralmente os registros já existentes do CPF original.
>
> **Comportamento esperado:**
>
> - Criar uma nova Account para o CPF Y.
> - Criar um novo Lead para o CPF Y.
> - Associar o novo Lead à nova Account.
> - Manter a Account do CPF X sem qualquer alteração.
> - Manter o Lead original sem qualquer alteração.
> **Comportamento observado:**
>
> - A Account do CPF X foi atualizada durante o processamento da aprovação da PAC com CPF divergente.
> - O requisito de preservação dos dados da Account original não foi atendido.
> **Impacto:**O sistema altera informações de um cliente já existente quando deveria criar novos registros para o CPF aprovado, gerando risco de inconsistência de dados e sobrescrita indevida de informações históricas.
>
> **Resultado do teste:** Falhou.
>
> Isso evidencia que o sistema está priorizando ou reutilizando a Account existente do CPF X em algum ponto do processamento, em vez de garantir a criação e utilização exclusiva dos registros relacionados ao CPF Y.
> =================
> Analise e me dê a causa do bug
> ```

## Commit 3 — `72cbd884f6` (retry lock no `insertLeadQueueable`)

Turno 395, 2026-09-09T03:29:20Z:

> QA reportou que não foi criado o lead do cliente Y no cenário TC001 em staging:
>
> Cliente Y:
> [https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Account/001HZ00000zHGd7YAG/view](https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Account/001HZ00000zHGd7YAG/view)
>
> Cliente X:
> [https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Account/001HZ00000txIvnYAE/view](https://mrvcomercial--staging.sandbox.lightning.force.com/lightning/r/Account/001HZ00000txIvnYAE/view)

Seguido, no turno 396 (2026-09-09T03:35:06Z), apenas por:

> faça um plano para esta correção
