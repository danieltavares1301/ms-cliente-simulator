import { randomUUID } from 'node:crypto';

import { z } from 'zod';

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
 * Diagnóstico ad-hoc (fora do catálogo dos 44 TCs), 2ª variante da corrida
 * do TC-001 (commit `72cbd884f6`, "Novo Lead não é criado ... UNABLE TO
 * LOCK ROW"): mistura eventos `/Cliente` (`cliente-insert`/`cliente-update`)
 * e `/PAC` (`pac-update`) na MESMA rajada concorrente, todos referenciando
 * o mesmo `idCliente`/`idProspect` de Y.
 *
 * Racional: `NotificacaoCliente` e `NotificacaoPAC` são classes/endpoints
 * REST distintos, cada um numa transação própria; um `cliente-*` e um
 * `pac-update` concorrentes fazem DML na MESMA linha de Account por
 * caminhos de código diferentes — uma superfície de lock mais próxima do
 * `UNABLE_TO_LOCK_ROW` real do que `cliente-*` correndo só contra si mesmo
 * (que só reproduziu `DUPLICATE_VALUE` na 1ª variante deste diagnóstico).
 *
 * `npx tsx scripts/runbook/diagnostico-tc001-corrida-cliente-pac.ts [--rajada 8] [--ondas 4] [--intervalo-ms 1200]`
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cli = parseCliArguments(argv);
  const rajada = Number(readCliFlag(argv, 'rajada') ?? '8');
  const ondas = Number(readCliFlag(argv, 'ondas') ?? '4');
  const intervaloMs = Number(readCliFlag(argv, 'intervalo-ms') ?? '1200');

  const conexao = await connectToTargetOrg(cli);
  const execucao = new Execucao(conexao, 'TC-001-DIAG-RACE-PAC', 'PA', cli.requestTimeoutMs);

  await execucao.preparar();
  await execucao.precheck();
  await execucao.xSincronizado();

  // Opportunity vinculada a X, pré-requisito do endpoint /PAC (achado real
  // da Tarefa 8.4 O05: PAC exige Account+Opportunity pré-existentes).
  const contaX = execucao.fixtures.get('accountX')?.registro.Id;
  if (contaX === undefined) throw new Error('xSincronizado() não criou accountX.');
  const oportunidadeResposta = z
    .object({ compositeResponse: z.array(z.object({ body: z.object({ id: z.string() }) })) })
    .parse(
      await conexao.restClient.composite([
        {
          method: 'POST',
          url: '/services/data/v61.0/sobjects/Opportunity',
          referenceId: 'createOpportunity',
          body: {
            Name: `QA UNIF22 ${execucao.run}`,
            StageName: 'Simulação',
            CloseDate: '2027-12-31',
            Id__c: execucao.oportunidadeExterna,
            AccountId: contaX,
          },
        },
      ]),
    );
  execucao.criados.Opportunity.push(oportunidadeResposta.compositeResponse[0]!.body.id);

  const idClienteY = execucao.y.idCliente;
  const idProspectJornada = execucao.x.idProspect; // igual ao real: IdProspectSalesforce = prospect de X.
  const agora = new Date().toISOString().replace(/\.\d+Z$/, '.000Z');

  const clienteEnvelope = (
    eventType: 'cliente-insert' | 'cliente-update',
    sufixo: string,
  ): EventGridEnvelope =>
    [
      {
        id: `EVT-${execucao.run}-${sufixo}-${randomUUID().slice(0, 8)}`,
        subject: 'MS_Clientes',
        eventType,
        eventTime: agora,
        dataVersion: '1.0',
        metadataVersion: '1',
        topic: `/qa/unificacao-2.2/diag-race-pac/${execucao.run}`,
        data: {
          idcliente: idClienteY,
          idprospectsalesforce: idProspectJornada,
          numerocpf: execucao.y.cpf,
          nomecompleto: execucao.y.nome,
          dataalteracao: agora,
        },
      },
    ] as unknown as EventGridEnvelope;

  const pacEnvelope = (sufixo: string): EventGridEnvelope =>
    [
      {
        id: `EVT-${execucao.run}-${sufixo}-${randomUUID().slice(0, 8)}`,
        subject: 'MS_Clientes',
        eventType: 'pac-update',
        eventTime: agora,
        dataVersion: '1.0',
        metadataVersion: '1',
        topic: `/qa/unificacao-2.2/diag-race-pac/${execucao.run}`,
        data: {
          id: execucao.pacExterno,
          idjornadapac: execucao.oportunidadeExterna,
          status: 'CREDITO_APROVADO_CONDICIONADO',
          dataalteracao: agora,
          proponentes: [
            {
              id: execucao.proponenteExterno,
              idPac: execucao.pacExterno,
              idCliente: idClienteY,
              cpf: execucao.y.cpf,
              tipoClassificacao: 'Principal',
              dataAlteracao: agora,
              nomeCompleto: execucao.y.nome,
              email: execucao.contatos.emailA,
              telefoneCelular: execucao.contatos.celularB,
              idProponente: idProspectJornada,
            },
          ],
        },
      },
    ] as unknown as EventGridEnvelope;

  logStructured('diag-race-pac-config', {
    run: execucao.run,
    idClienteY,
    idProspectJornada,
    cpfY: execucao.y.cpf,
    rajada,
    ondas,
    intervaloMs,
  });

  const access = await conexao.safetyGuard.validate();

  // Rajada inicial: cliente-insert, cliente-update e pac-update disparados
  // juntos, alternando os 3 tipos, competindo pela mesma linha de Account.
  const tipos: Array<{ alvo: 'Cliente' | 'PAC'; eventType: string; envelope: EventGridEnvelope }> =
    Array.from({ length: rajada }, (_valor, index) => {
      const resto = index % 3;
      if (resto === 0) {
        return { alvo: 'Cliente' as const, eventType: 'cliente-insert', envelope: clienteEnvelope('cliente-insert', `rajada-${index}`) };
      }
      if (resto === 1) {
        return { alvo: 'Cliente' as const, eventType: 'cliente-update', envelope: clienteEnvelope('cliente-update', `rajada-${index}`) };
      }
      return { alvo: 'PAC' as const, eventType: 'pac-update', envelope: pacEnvelope(`rajada-${index}`) };
    });

  const resultadosRajada = await Promise.all(
    tipos.map((item, index) =>
      dispatchConcurrentRequest(
        access,
        {
          index,
          variantKey: 'cliente-update',
          eventType: item.eventType as never,
          eventLabel: `diag-race-pac-rajada-${index}-${item.eventType}`,
          envelope: item.envelope,
          payloadSummary: { dataalteracao: agora },
        },
        cli.requestTimeoutMs,
        item.alvo,
      ),
    ),
  );
  logStructured('diag-race-pac-rajada-inicial', {
    total: resultadosRajada.length,
    sucessos: resultadosRajada.filter((r) => r.ok).length,
    falhas: resultadosRajada
      .filter((r) => !r.ok)
      .map((r, i) => ({ tipo: tipos[i]?.eventType, status: r.httpStatus, corpo: r.responseText.slice(0, 300) })),
  });

  // Ondas subsequentes: cliente-update e pac-update concorrentes espaçadas
  // no tempo, tentando colidir com a janela assíncrona real do Queueable
  // e/ou com o reflexo pós-upsert da PAC na Account.
  const resultadosOndas: Array<{ onda: number; sucessos: number; falhas: number }> = [];
  for (let onda = 1; onda <= ondas; onda += 1) {
    await sleep(intervaloMs);
    const disparosOnda = Array.from({ length: rajada }, (_valor, index) =>
      index % 2 === 0
        ? dispatchConcurrentRequest(
            access,
            {
              index,
              variantKey: 'cliente-update',
              eventType: 'cliente-update',
              eventLabel: `diag-race-pac-onda-${onda}-${index}-cliente`,
              envelope: clienteEnvelope('cliente-update', `onda-${onda}-${index}`),
              payloadSummary: { dataalteracao: agora },
            },
            cli.requestTimeoutMs,
            'Cliente',
          )
        : dispatchConcurrentRequest(
            access,
            {
              index,
              variantKey: 'cliente-update',
              eventType: 'pac-update' as never,
              eventLabel: `diag-race-pac-onda-${onda}-${index}-pac`,
              envelope: pacEnvelope(`onda-${onda}-${index}`),
              payloadSummary: { dataalteracao: agora },
            },
            cli.requestTimeoutMs,
            'PAC',
          ),
    );
    const resultadosOnda = await Promise.all(disparosOnda);
    resultadosOndas.push({
      onda,
      sucessos: resultadosOnda.filter((r) => r.ok).length,
      falhas: resultadosOnda.filter((r) => !r.ok).length,
    });
    logStructured('diag-race-pac-onda', {
      onda,
      sucessos: resultadosOnda.filter((r) => r.ok).length,
      falhas: resultadosOnda
        .filter((r) => !r.ok)
        .map((r) => ({ status: r.httpStatus, corpo: r.responseText.slice(0, 300) })),
    });
  }

  const textoAgregado = resultadosRajada.map((r) => r.responseText).join('\n');
  const sinaisDeLock = detectLockSignals(textoAgregado);

  await sleep(20_000);

  try {
    const final = await execucao.snapshot();
    const contaY = contaDaPessoa(final, execucao.y, idClienteY);
    logStructured('diag-race-pac-estado-final', {
      contaY,
      resumo: resumirEstado(final),
      sinaisDeLock,
    });
    logStructured('diag-race-pac-veredito', {
      bugReproduzido: final.leads.length === 0 && contaY !== undefined,
      totalAccounts: final.accounts.length,
      totalLeads: final.leads.length,
      ondas: resultadosOndas,
    });
  } finally {
    const cleanup = await execucao.limpar();
    logStructured('diag-race-pac-cleanup', cleanup);
  }
}

main().catch((error: unknown) => {
  logStructured('diag-race-pac-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
