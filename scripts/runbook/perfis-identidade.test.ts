import { describe, expect, it } from 'vitest';

import {
  ehPerfilIdentidade,
  ehPerfilOrdemReal,
  Execucao,
  NOMES_PERFIS,
  origemDoEvento,
  PERFIS,
  PERFIS_IDENTIDADE,
  PERFIS_ORDEM_REAL,
  perfilAplicavel,
  relogioDoCredito,
  TODOS_PERFIS,
  type AccountRegistro,
  type Aprovacao,
  type EvidenciaDoPerfil,
  type Snapshot,
} from './engine.ts';
import { Verificador } from './verificacoes.ts';
import type { TargetOrgConnection } from '../stress-o10-concurrent-events-lib.ts';

// O construtor da Execucao só guarda a conexão; nada aqui toca a org.
const semConexao = {} as TargetOrgConnection;

const contaX: AccountRegistro = {
  Id: '001HZ000000XXXXAAA',
  Id__c: 'IDCLI-X',
  IdProspectSalesforce__c: 'PROS-X',
  CPF__pc: '12345678909',
  LastName: 'QA UNIF22 X',
  PersonEmail: 'qa.x@example.com',
  Celular__c: '31980000000',
  DataAlteracaoEvento__c: '2026-10-01T12:00:00.000+0000',
  DataAlteracaoEventoContatoEmail__c: '2026-10-01T12:00:00.000+0000',
  DataAlteracaoEventoContatoCelular__c: '2026-10-01T12:00:00.000+0000',
  ContatoDataHoraAtualizacaoEmailPendencia: null,
  CreatedDate: '2026-10-01T12:00:00.000+0000',
  LastModifiedDate: '2026-10-01T12:00:00.000+0000',
};

function estado(
  contas: AccountRegistro[],
  proponente: Snapshot['proponente'] = null,
): Snapshot {
  return { accounts: contas, leads: [], oportunidade: null, pac: null, proponente };
}

function verificador(final: Snapshot) {
  const execucao = new Execucao(semConexao, 'TC-001', 'C1', 1_000);
  execucao.fixtures.set('accountX', { objeto: 'Account', registro: contaX });
  const aprovacao: Aprovacao = {
    pessoa: execucao.y,
    email: 'qa.y@example.com',
    celular: '31970000000',
    tipoEventoCliente: 'cliente-insert',
  };
  return { execucao, aprovacao, v: new Verificador(execucao, aprovacao, final, null, null) };
}

describe('perfis', () => {
  it('mantém só PA, CA e ME na campanha padrão', () => {
    expect(PERFIS).toEqual(['PA', 'CA', 'ME']);
    expect(PERFIS_IDENTIDADE).toEqual(['C1', 'C2', 'C3', 'C4']);
    expect(PERFIS_ORDEM_REAL).toEqual(['AR', 'AM', 'FW', 'RC', 'EP', 'RL']);
    expect(TODOS_PERFIS).toEqual([...PERFIS, ...PERFIS_IDENTIDADE, ...PERFIS_ORDEM_REAL]);
    for (const perfil of TODOS_PERFIS) expect(NOMES_PERFIS[perfil]).toBeTruthy();
    expect(PERFIS.some(ehPerfilIdentidade)).toBe(false);
    expect(PERFIS_IDENTIDADE.every(ehPerfilIdentidade)).toBe(true);
    expect(PERFIS_ORDEM_REAL.every(ehPerfilOrdemReal)).toBe(true);
    expect([...PERFIS, ...PERFIS_IDENTIDADE].some(ehPerfilOrdemReal)).toBe(false);
  });

  it('roda o AM só quando a pessoa aprovada já existe no MS Clientes', () => {
    const { aprovacao } = verificador(estado([contaX]));
    expect(perfilAplicavel('AM', { ...aprovacao, tipoEventoCliente: 'cliente-update' })).toBe(true);
    expect(perfilAplicavel('AM', { ...aprovacao, tipoEventoCliente: 'cliente-insert' })).toBe(false);
    for (const perfil of TODOS_PERFIS.filter((p) => p !== 'AM')) {
      expect(perfilAplicavel(perfil, { ...aprovacao, tipoEventoCliente: 'cliente-insert' })).toBe(true);
    }
  });

  it('gera celulares de 11 dígitos com 7 aleatórios e o prefixo de cada contato', () => {
    const execucao = new Execucao(semConexao, 'TC-005', 'CA', 1_000);
    const { celularB, celularD, celularF, celularG } = execucao.contatos;
    expect(celularB).toMatch(/^3198\d{7}$/);
    expect(celularD).toMatch(/^3197\d{7}$/);
    expect(celularF).toMatch(/^3196\d{7}$/);
    expect(celularG).toMatch(/^3195\d{7}$/);
    // Fixo residencial do WebJob: DDD 31 e 8 dígitos, com o sorteio do RUN.
    expect(execucao.contatos.telefone).toMatch(/^3132\d{6}$/);
    expect(execucao.contatos.telefone.slice(4)).toBe(celularB.slice(5));
    // Os quatro compartilham o sufixo do RUN, e RUNs diferentes sorteiam outro.
    expect(new Set([celularB, celularD, celularF, celularG].map((celular) => celular.slice(4))).size).toBe(1);
    const sufixos = new Set(
      Array.from({ length: 20 }, () => new Execucao(semConexao, 'TC-005', 'CA', 1_000).contatos.celularB),
    );
    expect(sufixos.size).toBeGreaterThan(15);
  });

  it('usa o perfil no id do RUN sem mudar o formato dos TCs', () => {
    expect(new Execucao(semConexao, 'TC-005', 'C4', 1_000).run).toMatch(/^TC005-C4-[0-9a-f]{6}$/);
    expect(new Execucao(semConexao, 'TC-001', 'PA', 1_000).run).toMatch(/^TC001-PA-[0-9a-f]{6}$/);
    // O diagnóstico do bug 4 continua com o formato TC001-CA-xxxxxx.
    expect(new Execucao(semConexao, 'TC-001-EVIDENCIA', 'CA', 1_000).run).toMatch(
      /^TC001-CA-[0-9a-f]{6}$/,
    );
  });
});

describe('Account X intacta (checagem reforçada)', () => {
  it('passa quando nada mudou, mesmo com LastModifiedDate novo', () => {
    const { v } = verificador(
      estado([{ ...contaX, LastModifiedDate: '2026-10-01T12:05:00.000+0000' }]),
    );
    expect(v.preservado('accountX').ok).toBe(true);
  });

  it('pega a escrita da pendência pelo carimbo, mesmo com o mesmo e-mail', () => {
    const { v } = verificador(
      estado([{ ...contaX, ContatoDataHoraAtualizacaoEmailPendencia: '2026-10-01T09:00:00.000+0000' }]),
    );
    const resultado = v.preservado('accountX');
    expect(resultado.ok).toBe(false);
    expect(resultado.detalhe).toEqual([
      {
        campo: 'ContatoDataHoraAtualizacaoEmailPendencia',
        antes: null,
        depois: '2026-10-01T09:00:00.000+0000',
      },
    ]);
  });

  it('pega a escrita da contestação pelo marcador de e-mail', () => {
    const { v } = verificador(
      estado([{ ...contaX, DataAlteracaoEventoContatoEmail__c: '2026-10-01T12:01:10.000+0000' }]),
    );
    const resultado = v.preservado('accountX');
    expect(resultado.ok).toBe(false);
    expect(resultado.detalhe).toEqual([
      {
        campo: 'DataAlteracaoEventoContatoEmail__c',
        antes: '2026-10-01T12:00:00.000+0000',
        depois: '2026-10-01T12:01:10.000+0000',
      },
    ]);
  });
});

describe('Verificador.evidenciasDoPerfil', () => {
  function proponenteEmX(execucao: Execucao, aprovacao: Aprovacao) {
    return {
      Id: 'a0jHZ000000PROPAAA',
      Proponente__c: contaX.Id,
      CpfProponente__c: aprovacao.pessoa.cpf,
      EmailAtualizado__c: aprovacao.email.toUpperCase(),
      EnviarNotificacaoPendencia__c: true,
      IdCliente__c: execucao.x.idCliente,
      IdProponente__c: 'PROS-X',
      TipoClassificacao__c: 'Principal',
    };
  }

  it('não acrescenta nada nos perfis obrigatórios', () => {
    const { v } = verificador(estado([contaX]));
    expect(v.evidenciasDoPerfil('CA', null, false)).toEqual([]);
  });

  it('valida C1 com o Proponente em X, a pendência ligada e X intacta antes dela', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const proponente = proponenteEmX(execucao, aprovacao);
    const evidencia: EvidenciaDoPerfil = {
      precondicao: estado([contaX], { ...proponente, EnviarNotificacaoPendencia__c: false }),
      contestacoesAntes: null,
    };
    const v = new Verificador(execucao, aprovacao, estado([contaX], proponente), null, null);
    const assercoes = v.evidenciasDoPerfil('C1', evidencia, false);
    expect(assercoes.map(({ nome, ok }) => [nome, ok])).toEqual([
      ['C1: PACs em análise aplicadas ao Proponente', true],
      ['C1: pendência aplicada (flag ligada)', true],
      ['C1: Account X intacta antes da pendência', true],
    ]);
    expect(assercoes[0]!.detalhe).toEqual({ contaDoProponente: 'X' });
  });

  it('acusa C2 quando X já mudou antes da pendência', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const proponente = proponenteEmX(execucao, aprovacao);
    const xAlterada = { ...contaX, PersonEmail: aprovacao.email };
    const evidencia: EvidenciaDoPerfil = {
      precondicao: estado([xAlterada], proponente),
      contestacoesAntes: null,
    };
    const v = new Verificador(execucao, aprovacao, estado([xAlterada], proponente), null, null);
    const antes = v.evidenciasDoPerfil('C2', evidencia, false).at(-1)!;
    expect(antes.nome).toBe('C2: Account X intacta antes da pendência');
    expect(antes.ok).toBe(false);
  });

  it('exige a contestação pendente em C4 e não confere X antes do gatilho', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const proponente = proponenteEmX(execucao, aprovacao);
    const final = estado([contaX], { ...proponente, EnviarNotificacaoPendencia__c: false });
    const v = new Verificador(execucao, aprovacao, final, null, null);
    const comContestacao = v.evidenciasDoPerfil(
      'C4',
      { precondicao: final, contestacoesAntes: 1 },
      false,
    );
    expect(comContestacao.map(({ nome, ok }) => [nome, ok])).toEqual([
      ['C4: PACs em análise aplicadas ao Proponente', true],
      ['C4: contestação pendente antes das PACs em análise', true],
    ]);
    const semContestacao = v.evidenciasDoPerfil('C4', { precondicao: final, contestacoesAntes: 0 }, false);
    expect(semContestacao[1]!.ok).toBe(false);
  });

  it('não confere X antes da pendência quando o TC permite alterar X', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const proponente = proponenteEmX(execucao, aprovacao);
    const evidencia: EvidenciaDoPerfil = {
      precondicao: estado([contaX], proponente),
      contestacoesAntes: null,
    };
    const v = new Verificador(execucao, aprovacao, estado([contaX], proponente), null, null);
    expect(v.evidenciasDoPerfil('C1', evidencia, true)).toHaveLength(2);
  });

  it('acusa C1 quando as PACs em análise não chegaram ao Proponente', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const semDadosDeY = {
      ...proponenteEmX(execucao, aprovacao),
      CpfProponente__c: execucao.x.cpf,
      EmailAtualizado__c: 'qa.x@example.com',
    };
    const evidencia: EvidenciaDoPerfil = {
      precondicao: estado([contaX], semDadosDeY),
      contestacoesAntes: null,
    };
    const v = new Verificador(execucao, aprovacao, estado([contaX], semDadosDeY), null, null);
    expect(v.evidenciasDoPerfil('C1', evidencia, false)[0]!.ok).toBe(false);
  });
});

describe('formato dos eventos', () => {
  it('gera os horários do crédito: Brasília rotulado como UTC no eventTime e sem fuso na data', () => {
    expect(relogioDoCredito('2026-10-11T15:00:25.000Z')).toEqual({
      eventTime: '2026-10-11T12:00:25.0000000Z',
      dataAlteracao: '2026-10-11T12:00:25.000',
    });
    // Perto da meia-noite UTC, o horário de Brasília ainda é o dia anterior.
    expect(relogioDoCredito('2026-10-11T01:30:00.000Z').dataAlteracao).toBe(
      '2026-10-10T22:30:00.000',
    );
  });

  it('atribui cada evento ao sistema que o publica, com o subject real', () => {
    expect(origemDoEvento('cliente-insert')).toEqual({ publicador: 'MS Clientes', subject: 'cliente' });
    expect(origemDoEvento('endereco-update').publicador).toBe('MS Clientes');
    expect(origemDoEvento('pac-update')).toEqual({
      publicador: 'MS de crédito',
      subject: 'proponentecredito/PacEventGridDTO',
    });
    expect(origemDoEvento('notificacaopendencia-insert')).toEqual({
      publicador: 'MS de crédito',
      subject: 'proponentecredito/NotificacaoPendenciasProponenteDTO',
    });
    expect(origemDoEvento('jornadausuario-update')).toEqual({
      publicador: 'Plataforma BFF',
      subject: 'jornadas',
    });
  });
});

describe('Verificador.evidenciasDoPerfil nas ordens reais', () => {
  function contaAprovada(execucao: Execucao, extras: Partial<AccountRegistro> = {}): AccountRegistro {
    return {
      ...contaX,
      Id: '001HZ000000YYYYAAA',
      Id__c: execucao.y.idCliente,
      IdProspectSalesforce__c: 'PROS-Y',
      CPF__pc: execucao.y.cpf,
      PersonEmail: 'qa.y@example.com',
      ...extras,
    };
  }
  const nomesEOk = (assercoes: Array<{ nome: string; ok: boolean }>) =>
    assercoes.map(({ nome, ok }) => [nome, ok]);

  it('AR confere as PACs em análise, a pendência e X antes dela, como o C1', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const proponente = {
      Id: 'a0jHZ000000PROPAAA',
      Proponente__c: contaX.Id,
      CpfProponente__c: aprovacao.pessoa.cpf,
      EmailAtualizado__c: aprovacao.email,
      EnviarNotificacaoPendencia__c: true,
    };
    const evidencia: EvidenciaDoPerfil = {
      precondicao: estado([contaX], { ...proponente, EnviarNotificacaoPendencia__c: false }),
      contestacoesAntes: null,
      antesDoGatilho: null,
      depoisDoGatilho: null,
    };
    const v = new Verificador(execucao, aprovacao, estado([contaX], proponente), null, 'PROS-Y');
    expect(nomesEOk(v.evidenciasDoPerfil('AR', evidencia, false))).toEqual([
      ['AR: PACs em análise aplicadas ao Proponente', true],
      ['AR: pendência aplicada (flag ligada)', true],
      ['AR: Account X intacta antes da pendência', true],
    ]);
  });

  it('FW acusa o prospect trocado e o Lead novo depois da repetição do WebJob', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const antes = estado([contaX, contaAprovada(execucao)]);
    const evidencia = (depois: Snapshot): EvidenciaDoPerfil => ({
      precondicao: null,
      contestacoesAntes: null,
      antesDoGatilho: antes,
      depoisDoGatilho: depois,
    });
    const doGatilho = (final: Snapshot) =>
      new Verificador(execucao, aprovacao, final, null, 'PROS-Y')
        .evidenciasDoPerfil('FW', evidencia(final), false)
        .filter(({ nome }) => nome.startsWith('FW: a repetição'));

    expect(doGatilho(antes).every(({ ok }) => ok)).toBe(true);

    const leadNovo = {
      Id: '00QHZ000000NOVOAAA',
      Id__c: 'PROS-NOVO',
      CPF__c: execucao.y.cpf,
      LastName: 'QA',
      CreatedDate: '2026-10-11T12:00:00.000+0000',
      LastModifiedDate: '2026-10-11T12:00:00.000+0000',
    };
    const trocado: Snapshot = {
      ...estado([contaX, contaAprovada(execucao, { IdProspectSalesforce__c: 'PROS-X' })]),
      leads: [leadNovo],
    };
    const [prospect, novos] = doGatilho(trocado);
    expect(prospect!.ok).toBe(false);
    expect(prospect!.detalhe).toEqual({ esperado: 'PROS-Y', antes: 'PROS-Y', depois: 'PROS-X' });
    expect(novos!.ok).toBe(false);
    expect(novos!.detalhe).toEqual({
      novos: [leadNovo.Id],
      alterados: [{ Id: '001HZ000000YYYYAAA', campos: ['IdProspectSalesforce__c'] }],
    });
  });

  it('EP confere o prospect logo depois do parcial atrasado', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const antes = estado([contaX, contaAprovada(execucao)]);
    const depois = estado([contaX, contaAprovada(execucao, { IdProspectSalesforce__c: 'PROS-X' })]);
    const v = new Verificador(execucao, aprovacao, antes, null, 'PROS-Y');
    const [prospect, novos] = v.evidenciasDoPerfil(
      'EP',
      { precondicao: null, contestacoesAntes: null, antesDoGatilho: antes, depoisDoGatilho: depois },
      false,
    );
    expect(prospect!.nome).toBe(
      'EP: o parcial atrasado (com o prospect da jornada) não troca o prospect da Account aprovada',
    );
    expect(prospect!.ok).toBe(false);
    expect(novos!.ok).toBe(true);
  });

  it('RL acusa qualquer campo funcional alterado pela repostagem', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const antes = estado([contaX, contaAprovada(execucao)]);
    const evidencia: EvidenciaDoPerfil = { precondicao: null, contestacoesAntes: null, antesDoGatilho: antes };
    const repostagem = (final: Snapshot) =>
      new Verificador(execucao, aprovacao, final, null, 'PROS-Y').evidenciasDoPerfil('RL', evidencia, false)[0]!;

    expect(repostagem(antes).ok).toBe(true);
    // LastModifiedDate novo não conta: só os campos funcionais.
    expect(
      repostagem(estado([contaX, contaAprovada(execucao, { LastModifiedDate: '2026-10-11T13:00:00.000+0000' })])).ok,
    ).toBe(true);
    const alterada = repostagem(estado([contaX, contaAprovada(execucao, { PersonEmail: 'velho@example.com' })]));
    expect(alterada.ok).toBe(false);
    expect(alterada.detalhe).toEqual({
      novos: [],
      alterados: [{ Id: '001HZ000000YYYYAAA', campos: ['PersonEmail'] }],
    });
  });

  it('RC confere a data da PAC em UTC e o contato atrasado descartado', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const evidencia: EvidenciaDoPerfil = {
      precondicao: null,
      contestacoesAntes: null,
      dataPacAprovada: '2026-10-11T15:00:25.000Z',
      emailAtrasado: 'qa.atrasado@example.com',
    };
    const final = (dataPac: string, email: string): Snapshot => ({
      ...estado([contaX, contaAprovada(execucao, { PersonEmail: email })]),
      pac: { Id: 'a0kHZ000000PACAAA', Status__c: 'CREDITO_APROVADO_CONDICIONADO', DataAlteracaoEvento__c: dataPac },
    });
    const rc = (snapshot: Snapshot) =>
      nomesEOk(new Verificador(execucao, aprovacao, snapshot, null, 'PROS-Y').evidenciasDoPerfil('RC', evidencia, false));

    expect(rc(final('2026-10-11T15:00:25.000+0000', aprovacao.email))).toEqual([
      ['RC: data da PAC aprovada gravada em UTC (o Apex somou as 3h do horário de Brasília)', true],
      ['RC: contato-update atrasado, de antes da aprovação, descartado', true],
    ]);
    // Sem a compensação, a data fica 3h atrás, e o contato atrasado vence.
    expect(rc(final('2026-10-11T12:00:25.000+0000', 'qa.atrasado@example.com'))).toEqual([
      ['RC: data da PAC aprovada gravada em UTC (o Apex somou as 3h do horário de Brasília)', false],
      ['RC: contato-update atrasado, de antes da aprovação, descartado', false],
    ]);
  });

  it('AR registra as PACs em análise rejeitadas e reentregues quando a pessoa ainda não existia', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const evidencia: EvidenciaDoPerfil = {
      precondicao: estado([contaX]),
      contestacoesAntes: null,
      pacsEmAnaliseRejeitadas: 2,
    };
    const v = new Verificador(execucao, aprovacao, estado([contaX]), null, null);
    const [primeira] = v.evidenciasDoPerfil('AR', evidencia, false);
    expect(primeira!.nome).toBe(
      'AR: PACs em análise rejeitadas (a pessoa ainda não existia) e reentregues depois da aprovação',
    );
    expect(primeira!.ok).toBe(true);
    expect(primeira!.detalhe).toEqual({ rejeitadas: 2, contaDoProponente: null });
  });

  it('EP e FW não cobram nada quando Y ainda não tinha Lead antes do gatilho', () => {
    const { execucao, aprovacao } = verificador(estado([contaX]));
    const antes = estado([contaX, contaAprovada(execucao, { IdProspectSalesforce__c: null })]);
    const depois = estado([contaX, contaAprovada(execucao, { IdProspectSalesforce__c: 'PROS-NOVO' })]);
    for (const perfil of ['EP', 'FW'] as const) {
      const assercoes = new Verificador(execucao, aprovacao, depois, null, null).evidenciasDoPerfil(
        perfil,
        { precondicao: null, contestacoesAntes: null, antesDoGatilho: antes, depoisDoGatilho: depois },
        false,
      );
      const doGatilho = assercoes.filter(({ nome }) => nome.includes('Lead de Y antes'));
      expect(doGatilho).toHaveLength(1);
      expect(doGatilho[0]!.ok).toBe(true);
    }
  });

  it('não acrescenta nada nos perfis obrigatórios', () => {
    const { v } = verificador(estado([contaX]));
    for (const perfil of PERFIS) expect(v.evidenciasDoPerfil(perfil, null, false)).toEqual([]);
  });
});
