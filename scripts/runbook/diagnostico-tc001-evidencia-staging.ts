import { z } from 'zod';

import { asAllowlistedQuery } from '../../src/salesforce/rest-client.ts';
import {
  connectToTargetOrg,
  literal,
  logStructured,
  parseCliArguments,
  parseSalesforceDateTime,
} from '../stress-o10-concurrent-events-lib.ts';
import { Execucao } from './engine.ts';

type EnvelopeReal = Array<{
  id: string; subject: string; eventType: string; eventTime: string;
  dataVersion: string; metadataVersion: string; topic: string;
  data: Record<string, unknown>;
}>;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const concorrente = argv.includes('--concorrente');
  // Staging, log a0dHZ00000NAQVTYA5: notificacaopendencia-insert do Proponente
  // principal chegou entre as PACs em análise e a PAC aprovada.
  const comPendencia = argv.includes('--pendencia');
  // Nos logs de staging, proponente.dataAlteracao vem no horário local (UTC-3)
  // sem fuso, e ProponenteTriggerHandler.parseDataAlteracaoEvento o lê como GMT.
  const dataProponenteStaging = argv.includes('--data-proponente-staging');
  const dataProponente = (iso: string) => dataProponenteStaging
    ? new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().replace(/Z$/, '')
    : iso;
  // Variante fora do incidente (skill, ajuste de 28/08 do TC-002): antes do
  // cliente-insert a PAC pode trazer o idCliente da jornada X com o CPF de Y.
  // O match vira ID_CLIENTE, onde o guard do commit 4 não se aplica.
  const idClienteXNaAnalise = argv.includes('--idcliente-x-na-analise');
  // Caminho 3: a pendência chega enquanto o Proponente ainda é de X, então a
  // flag já está ligada quando a PAC de Y troca o e-mail do Proponente.
  const pendenciaAntes = argv.includes('--pendencia-antes');
  // Caminho 4: contestação pendente na PAC. ClienteService.sincronizarContatosContestacao
  // só confere o IdCliente; use com --idcliente-x-na-analise.
  const comContestacao = argv.includes('--contestacao-pendente');
  const cli = parseCliArguments(argv);
  const conexao = await connectToTargetOrg(cli);
  const e = new Execucao(conexao, 'TC-001-EVIDENCIA', 'CA', cli.requestTimeoutMs);
  const resultados: Array<{ etapa: string; camposXAlterados: string[] }> = [];
  let contestacaoId: string | null = null;
  try {
    await e.preparar();
    await e.precheck();
    await e.xSincronizado();
    const antes = await e.snapshot();
    const contaX = antes.accounts.find(({ Id }) => Id === e.fixture('accountX').Id);
    const leadX = antes.leads.find(({ Id }) => Id === e.fixture('leadX').Id);
    if (!contaX || !leadX) throw new Error('Fixture X incompleta.');
    const resposta = z.object({
      compositeResponse: z.array(z.object({ body: z.object({ id: z.string() }) })),
    }).parse(await conexao.restClient.composite([{
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Opportunity',
      referenceId: 'createOpportunity',
      body: {
        Name: `QA UNIF22 ${e.run}`,
        StageName: 'Simulação',
        CloseDate: '2027-12-31',
        Id__c: e.oportunidadeExterna,
        AccountId: contaX.Id,
      },
    }]));
    e.criados.Opportunity.push(resposta.compositeResponse[0]!.body.id);
    const envelope = (
      tipo: string,
      rotulo: string,
      quando: string,
      data: Record<string, unknown>,
    ): EnvelopeReal => [{
      id: `EVT-${e.run}-${rotulo}`,
      subject: 'MS_Clientes',
      eventType: tipo,
      eventTime: quando,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: `/qa/unificacao-2.2/${e.run}`,
      data,
    }];
    // O contrato restrito do simulador exige IdCliente no Proponente e somente COBRANCA.
    // Os logs reais incluem PAC sem IdCliente e endereco Principal: envio diagnostico direto.
    async function enviar(alvo: 'Cliente' | 'PAC' | 'Pendencia', env: EnvelopeReal, rotulo: string) {
      const access = await conexao.safetyGuard.validate();
      const r = await fetch(new URL(`/services/apexrest/${alvo}`, access.instanceUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${access.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(env), signal: AbortSignal.timeout(cli.requestTimeoutMs),
      });
      const texto = await r.text();
      e.eventos.push({
        rotulo, eventType: env[0]!.eventType, eventTime: env[0]!.eventTime,
        httpStatus: r.status, ok: r.ok, resposta: texto,
      });
      logStructured('evidencia-http', { rotulo, status: r.status, ok: r.ok });
      if (!r.ok) throw new Error(`${rotulo}: ${texto.slice(0, 500)}`);
    }
    // Escritor fora do /Cliente: ProponenteTriggerHandler.sincronizarEmailContatoPendencia
    // grava Contact.Email e DataHoraAtualizacaoEmailPendencia__c (campo que só ele
    // grava) da Account apontada pelo Proponente.
    async function estadoCausal() {
      const contato = z.object({
        records: z.array(z.object({
          Email: z.string().nullable(),
          DataHoraAtualizacaoEmailPendencia__c: z.string().nullable(),
        })),
      }).parse(await conexao.restClient.query<unknown>(asAllowlistedQuery(
        `SELECT Email, DataHoraAtualizacaoEmailPendencia__c FROM Contact WHERE AccountId = ${literal(contaX!.Id)}`,
      ))).records[0];
      const proponente = z.object({
        records: z.array(z.object({
          Proponente__c: z.string().nullable(),
          EnviarNotificacaoPendencia__c: z.boolean(),
          EmailAtualizado__c: z.string().nullable(),
          DataAlteracaoEvento__c: z.string().nullable(),
        })),
      }).parse(await conexao.restClient.query<unknown>(asAllowlistedQuery(
        `SELECT Proponente__c, EnviarNotificacaoPendencia__c, EmailAtualizado__c, DataAlteracaoEvento__c FROM Proponente__c WHERE Id__c = ${literal(e.proponenteExterno)}`,
      ))).records[0];
      const contaDoProponente = !proponente?.Proponente__c ? null
        : proponente.Proponente__c === contaX!.Id ? 'X'
          : e.criados.Account.includes(proponente.Proponente__c) ? 'fixture' : 'Y';
      const carimbo = contato?.DataHoraAtualizacaoEmailPendencia__c ?? null;
      const segundos = (valor: string | null | undefined) => {
        if (!valor) return null;
        try {
          return Math.floor(parseSalesforceDateTime(valor) / 1_000);
        } catch {
          return null;
        }
      };
      const carimboSeg = segundos(carimbo);
      const dataProponenteSeg = segundos(proponente?.DataAlteracaoEvento__c?.replace(/Z?$/, 'Z'));
      return {
        contatoX: {
          emailEhDeY: contato?.Email === e.contatos.emailC,
          emailEhDeX: contato?.Email === e.contatos.emailA,
          carimboPendencia: carimbo,
          // Em staging o carimbo de X (14:52:38) é o DataAlteracaoEvento__c do Proponente.
          carimboIgualDataDoProponente: carimboSeg === null || dataProponenteSeg === null
            ? null
            : carimboSeg === dataProponenteSeg,
        },
        proponente: proponente ? {
          conta: contaDoProponente,
          pendencia: proponente.EnviarNotificacaoPendencia__c,
          emailEhDeY: proponente.EmailAtualizado__c === e.contatos.emailC,
          dataAlteracao: proponente.DataAlteracaoEvento__c,
        } : null,
      };
    }
    // sincronizarContatosContestacao grava PersonEmail e o marcador
    // DataAlteracaoEventoContatoEmail__c com o DataAlteracaoEvento__c da PAC.
    async function estadoContestacao() {
      const conta = z.object({
        records: z.array(z.object({ DataAlteracaoEventoContatoEmail__c: z.string().nullable() })),
      }).parse(await conexao.restClient.query<unknown>(asAllowlistedQuery(
        `SELECT DataAlteracaoEventoContatoEmail__c FROM Account WHERE Id = ${literal(contaX!.Id)}`,
      ))).records[0];
      const pacAtual = z.object({
        records: z.array(z.object({ Id: z.string(), DataAlteracaoEvento__c: z.string().nullable() })),
      }).parse(await conexao.restClient.query<unknown>(asAllowlistedQuery(
        `SELECT Id, DataAlteracaoEvento__c FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(e.pacExterno)}`,
      ))).records[0];
      const pendentes = pacAtual
        ? z.object({ totalSize: z.number() }).parse(await conexao.restClient.query<unknown>(asAllowlistedQuery(
          `SELECT Id FROM Contestacao__c WHERE PAC__c = ${literal(pacAtual.Id)} AND Solucionada__c = false`,
        ))).totalSize
        : 0;
      const marcador = conta?.DataAlteracaoEventoContatoEmail__c ?? null;
      const dataPac = pacAtual?.DataAlteracaoEvento__c ?? null;
      return {
        pendentes,
        marcadorEmailX: marcador,
        dataPac,
        marcadorEmailXIgualDataDaPac: marcador && dataPac
          ? Math.floor(parseSalesforceDateTime(marcador) / 1_000)
            === Math.floor(parseSalesforceDateTime(dataPac) / 1_000)
          : null,
      };
    }
    async function conferir(etapa: string) {
      const s = await e.snapshot();
      const causal = await estadoCausal();
      const contestacao = comContestacao ? { contestacao: await estadoContestacao() } : {};
      const atual = s.accounts.find(({ Id }) => Id === contaX!.Id);
      const atualLead = s.leads.find(({ Id }) => Id === leadX!.Id);
      const campos = [
        'Id__c', 'IdProspectSalesforce__c', 'CPF__pc', 'FirstName',
        'LastName', 'PersonEmail', 'Celular__c', 'DataAlteracaoEvento__c',
      ];
      const camposXAlterados = atual
        ? campos.filter((campo) => atual[campo] !== contaX![campo])
        : ['ACCOUNT_X_AUSENTE'];
      const camposLead = ['Id__c', 'CPF__c', 'Email', 'MobilePhone', 'LastName'];
      const camposLeadXAlterados = atualLead
        ? camposLead.filter((campo) => atualLead[campo] !== leadX![campo])
        : ['LEAD_X_AUSENTE'];
      resultados.push({ etapa, camposXAlterados });
      logStructured('evidencia-snapshot', {
        run: e.run, etapa, camposXAlterados, camposLeadXAlterados,
        emailXRecebeuContatoDaPac: atual?.PersonEmail === e.contatos.emailC,
        ...causal,
        ...contestacao,
        accountsY: s.accounts.filter(({ CPF__pc }) => CPF__pc === e.y.cpf).length,
        leadsY: s.leads.filter(({ CPF__c }) => CPF__c === e.y.cpf).length,
      });
    }
    function pac(status: string, segundos: number, idCliente?: string, pessoaX = false) {
      const quando = e.t(segundos);
      return envelope('pac-update', `pac-${segundos}`, quando, {
        id: e.pacExterno, idjornadapac: e.oportunidadeExterna,
        status, dataalteracao: quando,
        proponentes: [{
          id: e.proponenteExterno, idPac: e.pacExterno,
          ...(idCliente ? { idCliente } : {}),
          cpf: pessoaX ? e.x.cpf : e.y.cpf, idProponente: e.x.idProspect,
          tipoClassificacao: 'Principal', dataAlteracao: dataProponente(quando),
          nomeCompleto: pessoaX ? e.x.nome : e.y.nome,
          email: pessoaX ? e.contatos.emailA : e.contatos.emailC,
          telefoneCelular: e.contatos.celularB,
        }],
      });
    }
    // Mesmo formato do log a0dHZ00000NAQVTYA5: proponente.id do Principal,
    // idProponente PROS-X, nome e e-mail de Y. O mapeamento só grava Id__c,
    // ReplyTo__c, Pendencias__c, Pendencias2__c e TipoNotificacao__c, e o
    // endpoint liga EnviarNotificacaoPendencia__c.
    function pendencia(segundos: number, pessoaX = false) {
      return envelope('notificacaopendencia-insert', `pendencia-${segundos}`, e.t(segundos), {
        idPac: e.pacExterno, idJornada: e.oportunidadeExterna,
        replyTo: e.emailExtra('replyto'), descricaoCentral: 'QA UNIF22 CENTRAL',
        proponente: {
          id: e.proponenteExterno, idProponente: e.x.idProspect,
          nome: pessoaX ? e.x.nome : e.y.nome,
          email: pessoaX ? e.contatos.emailA : e.contatos.emailC,
          textoPendencias: `QA UNIF22 pendencia sintetica ${e.run}`,
          textoPendenciasSemDescricao: 'QA UNIF22 pendencia sintetica',
        },
        idProcessoProduto: '1000001', tipoNotificacao: 'DESLIGAMENTO',
      });
    }
    logStructured('evidencia-config', {
      run: e.run, idsClienteDistintos: e.x.idCliente !== e.y.idCliente,
      cpfsDistintos: e.x.cpf !== e.y.cpf,
      origem: 'Opportunity 006HZ00000TVyX3YAL; incidente 2026-09-08', concorrente,
      pendencia: comPendencia, dataProponenteStaging, idClienteXNaAnalise,
      pendenciaAntes, contestacaoPendente: comContestacao,
    });
    // A PAC real ja existia desde 04/09, vinculada a jornada de X.
    await enviar('PAC', pac('EM_ANALISE_CREDITO', -10, e.x.idCliente, true),
      'pac-original-x');
    await conferir('apos-pac-original-x');
    if (pendenciaAntes) {
      // Proponente ainda com os dados de X: a sincronização só regrava o e-mail de X.
      await enviar('Pendencia', pendencia(-5, true), 'notificacaopendencia-antes');
      await conferir('apos-pendencia-antes');
    }
    if (comContestacao) {
      const pacId = (await e.snapshot()).pac?.Id;
      if (!pacId) throw new Error('PAC da jornada não encontrada para abrir a contestação.');
      // Mesmo caminho do test-data-adapter. O after insert dispara um @future que
      // avisa o MS (na dev, Endpoints__c.ContestacaoInsert__c aponta para o simulador).
      const criada = z.object({
        compositeResponse: z.array(z.object({ body: z.object({ id: z.string() }) })),
      }).parse(await conexao.restClient.composite([{
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Contestacao__c',
        referenceId: 'createContestacao',
        body: { Id__c: `CONT-QA-UNIF22-${e.run}`, PAC__c: pacId },
      }]));
      contestacaoId = criada.compositeResponse[0]!.body.id;
      await e.aguardarJobs(60_000);
      await conferir('apos-contestacao');
    }
    // Os dois pac-update anteriores ao cliente tinham CPF Y, PROS-X e nenhum IdCliente.
    if (idClienteXNaAnalise) {
      await enviar('PAC', pac('EM_ANALISE_CREDITO', 0, e.x.idCliente), 'pac-analise-idcliente-x-1');
      await conferir('apos-pac-analise-1');
      await enviar('PAC', pac('EM_ANALISE_CREDITO', 5, e.x.idCliente), 'pac-analise-idcliente-x-2');
      await conferir('apos-pac-analise-2');
    } else {
      await enviar('PAC', pac('EM_ANALISE_CREDITO', 0), 'pac-analise-sem-idcliente-1');
      await conferir('apos-pac-analise-1');
      await enviar('PAC', pac('EM_ANALISE_CREDITO', 5), 'pac-analise-sem-idcliente-2');
      await conferir('apos-pac-analise-2');
    }
    const clienteData = (segundos: number, prospect: string) => ({
      idcliente: e.y.idCliente, idprospectsalesforce: prospect,
      numerocpf: e.y.cpf, nomecompleto: e.y.nome, dataalteracao: e.t(segundos),
    });
    const pendentes: Array<Promise<void>> = [];
    const inserir = enviar('Cliente', envelope('cliente-insert', 'insert-y', e.t(10),
      clienteData(10, e.x.idProspect.toUpperCase())), 'cliente-insert-y');
    if (concorrente) pendentes.push(inserir);
    else {
      await inserir;
      await conferir('apos-cliente-insert');
    }
    for (const tipo of ['Celular', 'Email'] as const) {
      const envio = enviar('Cliente', envelope('contato-insert', `contato-${tipo}`, e.t(11), {
        idcliente: e.y.idCliente, idprospectsalesforce: e.x.idProspect.toUpperCase(),
        tipocontato: tipo, descricao: tipo === 'Email' ? e.contatos.emailC : e.contatos.celularB,
        dataalteracao: e.t(11),
      }), `contato-${tipo}`);
      if (concorrente) pendentes.push(envio);
      else {
        await envio;
        await conferir(`apos-contato-${tipo}`);
      }
    }
    for (const tipo of ['Principal', 'Cobranca'] as const) {
      const envio = enviar('Cliente', envelope('endereco-insert', `endereco-${tipo}`, e.t(12), {
        idcliente: e.y.idCliente, idprospectsalesforce: e.x.idProspect.toUpperCase(),
        tipoendereco: tipo, logradouro: 'Rua QA UNIF22', numero: '100',
        bairro: 'Centro', numerocep: '30110000', dataalteracao: e.t(12),
      }), `endereco-${tipo}`);
      if (concorrente) pendentes.push(envio);
      else await envio;
    }
    if (comPendencia) {
      // Em staging chegou junto do lote de cliente (eventTime 17:52:42.87Z),
      // antes de a PAC aprovada reparentar o Proponente para Y.
      const envio = enviar('Pendencia', pendencia(13), 'notificacaopendencia-insert');
      if (concorrente) pendentes.push(envio);
      else {
        await envio;
        await conferir('apos-pendencia');
      }
    }
    if (concorrente) {
      const assentados = await Promise.allSettled(pendentes);
      const falhas = assentados.filter((r) => r.status === 'rejected');
      if (falhas.length > 0) throw new AggregateError(
        falhas.map((r) => r.reason), 'Falha na entrega concorrente dos eventos reais.',
      );
      await conferir('apos-entrega-concorrente');
    }
    await e.aguardarJobs(90_000);
    await conferir('apos-queueable');
    const pos = await e.snapshot();
    const y = pos.accounts.find(({ CPF__pc }) => CPF__pc === e.y.cpf);
    if (!y?.IdProspectSalesforce__c) throw new Error('Y sem prospect apos Queueable.');
    await enviar('Cliente', envelope('cliente-update', 'retorno-y', e.t(20),
      clienteData(20, y.IdProspectSalesforce__c)), 'cliente-update-pros-y');
    await enviar('PAC', pac('CREDITO_APROVADO_CONDICIONADO', 25, e.y.idCliente),
      'pac-aprovada-idcliente-y');
    await e.aguardarJobs(90_000);
    await conferir('final');
    const erros = await e.errosCorrelacionados(await e.snapshot());
    logStructured('evidencia-veredito', {
      run: e.run,
      accountXAlterada: resultados.some(({ camposXAlterados }) => camposXAlterados.length > 0),
      primeiraEtapaComXAlterado:
        resultados.find(({ camposXAlterados }) => camposXAlterados.length > 0)?.etapa ?? null,
      pendenciaEnviada: comPendencia,
      etapas: resultados, jobsComErro: erros.jobs, logsComErro: erros.logs,
    });
  } finally {
    // Contestacao__c.PAC__c é lookup SetNull: apagar a PAC não leva a contestação junto.
    const contestacaoCleanup = contestacaoId === null ? null : await (async () => {
      const erros: string[] = [];
      try {
        await conexao.restClient.deleteRecord('Contestacao__c', contestacaoId);
      } catch (erro) {
        erros.push(erro instanceof Error ? erro.message : String(erro));
      }
      const restantes = z.object({ totalSize: z.number() }).parse(
        await conexao.restClient.query<unknown>(asAllowlistedQuery(
          `SELECT Id FROM Contestacao__c WHERE Id = ${literal(contestacaoId)}`,
        )),
      ).totalSize;
      return { restantes, erros };
    })();
    const limpeza = await e.limpar();
    logStructured('evidencia-cleanup', {
      run: e.run, ...limpeza,
      ...(contestacaoCleanup ? { contestacao: contestacaoCleanup } : {}),
    });
    if (limpeza.restantes !== 0 || limpeza.erros.length > 0
      || (contestacaoCleanup && (contestacaoCleanup.restantes !== 0 || contestacaoCleanup.erros.length > 0))) {
      throw new Error('Cleanup incompleto; consulte evidencia-cleanup.');
    }
  }
}

main().catch((erro: unknown) => {
  logStructured('evidencia-fatal', { mensagem: erro instanceof Error ? erro.message : String(erro) });
  process.exitCode = 1;
});
