import {
  connectToTargetOrg,
  detectLockSignals,
  dispatchConcurrentRequest,
  logStructured,
  parseCliArguments,
  readCliFlag,
  sleep,
} from '../stress-o10-concurrent-events-lib.ts';
import { Execucao, contaDaPessoa, resumirEstado } from './engine.ts';
import type { EventGridEnvelope } from '../../src/contracts/event-grid.ts';

/**
 * Diagnóstico ad-hoc (fora do catálogo dos 44 TCs), 3ª variante da corrida
 * do TC-001 (commit `72cbd884f6`, "Novo Lead não é criado ... UNABLE TO
 * LOCK ROW"): ataca a real precondição de `ClienteService.
 * prospectPertenceAOutraConta` para gerar MÚLTIPLOS `insertLeadQueueable`
 * concorrentes tentando `update` a MESMA linha de Account.
 *
 * As 2 primeiras variantes deste diagnóstico (`corrida-insert-update.ts`,
 * `corrida-cliente-pac.ts`) competiam pela CRIAÇÃO do mesmo `IdCliente`
 * novo — mas o `upsert` por External ID mata a corrida na camada de DML
 * síncrona (`DUPLICATE_VALUE`) antes de qualquer Queueable ser enfileirado;
 * confirmado ao vivo (`AsyncApexJob`: no máximo 1-2 `NotificacaoCliente`
 * enfileirados por rajada, sempre sequenciais, 0 erros).
 *
 * Esta variante usa a Account Y já existente (criada uma única vez, sem
 * corrida) e dispara N eventos `cliente-update(Y, idprospectsalesforce=
 * <prospect de uma Account F_i diferente>)` CONCORRENTES — um prospect
 * estrangeiro DIFERENTE por requisição. Por
 * `ClienteService.prospectPertenceAOutraConta` (`ClienteService.cls`,
 * branch `GV_918914_UnificPosAprovPAC`), cada evento independente:
 *   1. casa a Account Y por `Id__c` (não descartado por
 *      `deveDescartarMatchPosPac`, que só age no match por `ID_PROSPECT`);
 *   2. detecta que o prospect do payload pertence a uma Account (F_i)
 *      diferente da atual (Y) → `criarLeadDoCliente=true`;
 *   3. dispara `executar()` → `Database.upsert` na MESMA Account Y →
 *      enfileira seu PRÓPRIO `insertLeadQueueable`, que faz `update
 *      Account(Id=Y.Id, IdProspectSalesforce__c=<novo Lead>)`.
 *
 * Diferente das 2 primeiras variantes, aqui N transações distintas e bem-
 * sucedidas (sem colisão de `upsert` por External ID, já que só o payload/
 * prospect muda, não o `IdCliente`) devem cada uma enfileirar seu próprio
 * Queueable — criando a real condição de N Queueables concorrentes
 * competindo pelo MESMO `update Account(Id=Y.Id, ...)`, a superfície exata
 * do retry lock removido no revert (`updateAccountComRetryLock`).
 *
 * `npx tsx scripts/runbook/diagnostico-tc001-corrida-prospect-estrangeiro.ts [--concorrencia 8]`
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cli = parseCliArguments(argv);
  const concorrencia = Number(readCliFlag(argv, 'concorrencia') ?? '8');

  const conexao = await connectToTargetOrg(cli);
  const execucao = new Execucao(conexao, 'TC-001-DIAG-RACE-PROSPECT', 'PA', cli.requestTimeoutMs);

  await execucao.preparar();
  await execucao.precheck();

  // Y já existe, limpo, sem divergência (Id__c e IdProspect próprios).
  await execucao.criarAccount('accountY', {
    pessoa: execucao.y,
    idCliente: execucao.y.idCliente,
    idProspect: execucao.y.idProspect,
  });
  const contaY = execucao.fixtures.get('accountY')!.registro as { Id: string };

  // N Accounts "estrangeiras" (F_i), cada uma com seu próprio prospect real
  // e persistido — a precondição exata de `prospectPertenceAOutraConta`.
  const estrangeiras: Array<{ idProspect: string }> = [];
  for (let i = 0; i < concorrencia; i += 1) {
    const pessoa = execucao.novaPessoa(`F${i}`);
    await execucao.criarAccount(`accountF${i}`, {
      pessoa,
      idCliente: pessoa.idCliente,
      idProspect: pessoa.idProspect,
    });
    estrangeiras.push({ idProspect: pessoa.idProspect });
  }

  logStructured('diag-race-prospect-config', {
    run: execucao.run,
    idClienteY: execucao.y.idCliente,
    contaY: contaY.Id,
    concorrencia,
    prospectsEstrangeiros: estrangeiras.map((e) => e.idProspect),
  });

  const agora = new Date().toISOString().replace(/\.\d+Z$/, '.000Z');
  const clienteUpdateEnvelope = (idProspectEstrangeiro: string, sufixo: string): EventGridEnvelope =>
    [
      {
        id: `EVT-${execucao.run}-${sufixo}`,
        subject: 'MS_Clientes',
        eventType: 'cliente-update',
        eventTime: agora,
        dataVersion: '1.0',
        metadataVersion: '1',
        topic: `/qa/unificacao-2.2/diag-race-prospect/${execucao.run}`,
        data: {
          idcliente: execucao.y.idCliente,
          idprospectsalesforce: idProspectEstrangeiro,
          numerocpf: execucao.y.cpf,
          nomecompleto: execucao.y.nome,
          dataalteracao: agora,
        },
      },
    ] as unknown as EventGridEnvelope;

  const access = await conexao.safetyGuard.validate();
  const disparos = estrangeiras.map((estrangeira, index) =>
    dispatchConcurrentRequest(
      access,
      {
        index,
        variantKey: 'cliente-update',
        eventType: 'cliente-update',
        eventLabel: `diag-race-prospect-${index}`,
        envelope: clienteUpdateEnvelope(estrangeira.idProspect, `foreign-${index}`),
        payloadSummary: { dataalteracao: agora },
      },
      cli.requestTimeoutMs,
      'Cliente',
    ),
  );
  const resultados = await Promise.all(disparos);
  logStructured('diag-race-prospect-resultado-http', {
    total: resultados.length,
    sucessos: resultados.filter((r) => r.ok).length,
    falhas: resultados
      .filter((r) => !r.ok)
      .map((r, i) => ({ index: i, status: r.httpStatus, corpo: r.responseText.slice(0, 300) })),
  });

  const textoAgregado = resultados.map((r) => r.responseText).join('\n');
  const sinaisDeLock = detectLockSignals(textoAgregado);
  const recordCurrentlyUnavailable = /RECORD CURRENTLY UNAVAILABLE/i.test(textoAgregado);

  await sleep(25_000);

  try {
    const final = await execucao.snapshot();
    const contaYFinal = contaDaPessoa(final, execucao.y, execucao.y.idCliente);
    logStructured('diag-race-prospect-estado-final', {
      contaYFinal,
      resumo: resumirEstado(final),
      sinaisDeLock,
      recordCurrentlyUnavailable,
    });
    logStructured('diag-race-prospect-veredito', {
      totalAccounts: final.accounts.length,
      totalLeads: final.leads.length,
      leadsNovosParaY: final.leads.filter((lead) => lead.DescricaoOrigem__c === 'InsertClientePAC').length,
    });
  } finally {
    const cleanup = await execucao.limpar();
    logStructured('diag-race-prospect-cleanup', cleanup);
  }
}

main().catch((error: unknown) => {
  logStructured('diag-race-prospect-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
