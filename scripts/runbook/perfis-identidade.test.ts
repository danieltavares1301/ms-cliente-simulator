import { describe, expect, it } from 'vitest';

import {
  ehPerfilIdentidade,
  Execucao,
  NOMES_PERFIS,
  PERFIS,
  PERFIS_IDENTIDADE,
  TODOS_PERFIS,
  type AccountRegistro,
  type Aprovacao,
  type EvidenciaIdentidade,
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
    expect(TODOS_PERFIS).toEqual([...PERFIS, ...PERFIS_IDENTIDADE]);
    for (const perfil of TODOS_PERFIS) expect(NOMES_PERFIS[perfil]).toBeTruthy();
    expect(PERFIS.some(ehPerfilIdentidade)).toBe(false);
    expect(PERFIS_IDENTIDADE.every(ehPerfilIdentidade)).toBe(true);
  });

  it('gera celulares de 11 dígitos com 7 aleatórios e o prefixo de cada contato', () => {
    const execucao = new Execucao(semConexao, 'TC-005', 'CA', 1_000);
    const { celularB, celularD, celularF, celularG } = execucao.contatos;
    expect(celularB).toMatch(/^3198\d{7}$/);
    expect(celularD).toMatch(/^3197\d{7}$/);
    expect(celularF).toMatch(/^3196\d{7}$/);
    expect(celularG).toMatch(/^3195\d{7}$/);
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
    const evidencia: EvidenciaIdentidade = {
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
    const evidencia: EvidenciaIdentidade = {
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
    const evidencia: EvidenciaIdentidade = {
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
    const evidencia: EvidenciaIdentidade = {
      precondicao: estado([contaX], semDadosDeY),
      contestacoesAntes: null,
    };
    const v = new Verificador(execucao, aprovacao, estado([contaX], semDadosDeY), null, null);
    expect(v.evidenciasDoPerfil('C1', evidencia, false)[0]!.ok).toBe(false);
  });
});
