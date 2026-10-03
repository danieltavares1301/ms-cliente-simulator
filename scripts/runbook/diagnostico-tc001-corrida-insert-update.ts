import { randomUUID } from 'node:crypto';

import {
  connectToTargetOrg,
  dispatchConcurrentRequest,
  logStructured,
  parseCliArguments,
  readCliFlag,
  detectLockSignals,
  sleep,
} from '../stress-o10-concurrent-events-lib.ts';
import { Execucao, contaDaPessoa, resumirEstado } from './engine.ts';
import type { EventGridEnvelope } from '../../src/contracts/event-grid.ts';

/**
 * Diagnóstico ad-hoc (fora do catálogo dos 44 TCs): aprofunda a reprodução
 * da condição de corrida real observada em `mrv-staging` (LogIntegracao__c,
 * Id__c `16e121ad-83f0-4b72-e360-08df0e20d528`, 2026-09-09T03:17:13Z) para
 * o bug do commit `72cbd884f6` ("Novo Lead não é criado em cenário de
 * aprovação de PAC com CPF divergente (UNABLE TO LOCK ROW)"):
 *
 * Na staging real, `cliente-insert` (success) e `cliente-update` (error:
 * `DUPLICATE_VALUE ... Id__c duplica o valor no registro`) chegaram para o
 * MESMO `IdCliente` novo com ~2,5s de diferença de `eventTime`. Resultado
 * real: zero Lead criado para Y, zero AsyncApexJob na janela seguinte — o
 * Queueable nunca chegou a rodar.
 *
 * A 1ª rodada deste diagnóstico (2 requisições via `Promise.all`) já
 * reproduziu o erro HTTP idêntico (`DUPLICATE_VALUE`), mas o Lead ainda foi
 * criado (o Queueable da transação vencedora rodou sem contenção). Esta
 * versão amplia o experimento em duas frentes, para tentar também derrubar
 * o Queueable (replicando o "zero Lead" real):
 *
 * 1. Rajada inicial de `N` requisições simultâneas (mix `cliente-insert`/
 *    `cliente-update`) competindo pela CRIAÇÃO do mesmo `IdCliente` novo
 *    (em vez de apenas 2), para aumentar a chance de múltiplas transações
 *    concorrentes colidirem no mesmo `upsert` por External ID.
 * 2. Ondas adicionais de `cliente-update` nos segundos seguintes (onde o
 *    Queueable de fato executa, de forma assíncrona, após a transação que
 *    venceu a rajada inicial já ter comitado), para tentar colidir com a
 *    janela real de `UNABLE_TO_LOCK_ROW` do `insertLeadQueueable`.
 *
 * `npx tsx scripts/runbook/diagnostico-tc001-corrida-insert-update.ts [--rajada 6] [--ondas 3] [--intervalo-ms 1500]`
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cli = parseCliArguments(argv);
  const rajada = Number(readCliFlag(argv, 'rajada') ?? '6');
  const ondas = Number(readCliFlag(argv, 'ondas') ?? '4');
  const intervaloMs = Number(readCliFlag(argv, 'intervalo-ms') ?? '1500');

  const conexao = await connectToTargetOrg(cli);
  const execucao = new Execucao(conexao, 'TC-001-DIAG-RACE', 'PA', cli.requestTimeoutMs);

  await execucao.preparar();
  await execucao.precheck();
  await execucao.xSincronizado();

  const idClienteY = execucao.y.idCliente;
  const idProspectJornada = execucao.x.idProspect; // igual ao real: IdProspectSalesforce = prospect de X.
  const agora = new Date().toISOString().replace(/\.\d+Z$/, '.000Z');

  const envelope = (eventType: 'cliente-insert' | 'cliente-update', sufixo: string): EventGridEnvelope =>
    [
      {
        id: `EVT-${execucao.run}-${sufixo}-${randomUUID().slice(0, 8)}`,
        subject: 'MS_Clientes',
        eventType,
        eventTime: agora,
        dataVersion: '1.0',
        metadataVersion: '1',
        topic: `/qa/unificacao-2.2/diag-race/${execucao.run}`,
        data: {
          idcliente: idClienteY,
          idprospectsalesforce: idProspectJornada,
          numerocpf: execucao.y.cpf,
          nomecompleto: execucao.y.nome,
          dataalteracao: agora,
        },
      },
    ] as unknown as EventGridEnvelope;

  logStructured('diag-race-config', {
    run: execucao.run,
    idClienteY,
    idProspectJornada,
    cpfY: execucao.y.cpf,
    rajada,
    ondas,
    intervaloMs,
  });

  const access = await conexao.safetyGuard.validate();

  // Rajada inicial: metade cliente-insert, metade cliente-update, todas
  // competindo pela criação do MESMO IdCliente novo, disparadas juntas.
  const rajadaInicial = Array.from({ length: rajada }, (_valor, index) => {
    const tipo: 'cliente-insert' | 'cliente-update' = index % 2 === 0 ? 'cliente-insert' : 'cliente-update';
    return dispatchConcurrentRequest(
      access,
      {
        index,
        variantKey: 'cliente-update',
        eventType: tipo,
        eventLabel: `diag-race-rajada-${index}-${tipo}`,
        envelope: envelope(tipo, `rajada-${index}`),
        payloadSummary: { dataalteracao: agora },
      },
      cli.requestTimeoutMs,
      'Cliente',
    );
  });
  const resultadosRajada = await Promise.all(rajadaInicial);
  logStructured('diag-race-rajada-inicial', {
    total: resultadosRajada.length,
    sucessos: resultadosRajada.filter((r) => r.ok).length,
    falhas: resultadosRajada
      .filter((r) => !r.ok)
      .map((r) => ({ status: r.httpStatus, corpo: r.responseText.slice(0, 300) })),
  });

  // Ondas subsequentes: cliente-update concorrentes espaçadas no tempo,
  // tentando colidir com a janela assíncrona real do Queueable.
  const resultadosOndas: Array<{ onda: number; sucessos: number; falhas: number }> = [];
  for (let onda = 1; onda <= ondas; onda += 1) {
    await sleep(intervaloMs);
    const disparos = Array.from({ length: rajada }, (_valor, index) =>
      dispatchConcurrentRequest(
        access,
        {
          index,
          variantKey: 'cliente-update',
          eventType: 'cliente-update',
          eventLabel: `diag-race-onda-${onda}-${index}`,
          envelope: envelope('cliente-update', `onda-${onda}-${index}`),
          payloadSummary: { dataalteracao: agora },
        },
        cli.requestTimeoutMs,
        'Cliente',
      ),
    );
    const resultadosOnda = await Promise.all(disparos);
    resultadosOndas.push({
      onda,
      sucessos: resultadosOnda.filter((r) => r.ok).length,
      falhas: resultadosOnda.filter((r) => !r.ok).length,
    });
    logStructured('diag-race-onda', {
      onda,
      sucessos: resultadosOnda.filter((r) => r.ok).length,
      falhas: resultadosOnda
        .filter((r) => !r.ok)
        .map((r) => ({ status: r.httpStatus, corpo: r.responseText.slice(0, 300) })),
    });
  }

  const textoAgregado = [
    ...resultadosRajada.map((r) => r.responseText),
  ].join('\n');
  const sinaisDeLock = detectLockSignals(textoAgregado);

  await sleep(20_000);

  try {
    const final = await execucao.snapshot();
    const contaY = contaDaPessoa(final, execucao.y, idClienteY);
    logStructured('diag-race-estado-final', {
      contaY,
      resumo: resumirEstado(final),
      sinaisDeLock,
    });
    logStructured('diag-race-veredito', {
      bugReproduzido: final.leads.length === 0 && contaY !== undefined,
      totalAccounts: final.accounts.length,
      totalLeads: final.leads.length,
      ondas: resultadosOndas,
    });
  } finally {
    const cleanup = await execucao.limpar();
    logStructured('diag-race-cleanup', cleanup);
  }
}

main().catch((error: unknown) => {
  logStructured('diag-race-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});

