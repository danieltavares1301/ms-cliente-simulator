import { describe, expect, it } from 'vitest';

import { bugsDoRun, comparacao, matrizDeBugs } from './classificar-bugs.ts';
import type { Perfil, ResultadoRun } from './engine.ts';

function run(
  tc: string,
  perfil: Perfil,
  falhas: string[],
  extras: Partial<ResultadoRun> = {},
): ResultadoRun {
  return {
    tc,
    titulo: tc,
    perfil,
    run: `${tc}-${perfil}`,
    inicio: '',
    fim: '',
    veredito: falhas.length ? 'DIVERGENTE' : 'CONFORME',
    assercoes: falhas.map((nome) => ({ nome, ok: false })),
    eventos: [],
    prospectY: null,
    jobsComErro: [],
    logsComErro: [],
    erro: null,
    cleanup: null,
    ...extras,
  };
}

const ids = (resultado: ResultadoRun, todos: ResultadoRun[] = [resultado]) =>
  [...bugsDoRun(resultado, matrizDeBugs(todos).porPar).keys()].sort();

const recusa: ResultadoRun['eventos'][number] = {
  rotulo: 'pac-analise-1',
  eventType: 'pac-update',
  eventTime: '',
  rejeicaoEsperada: true,
  httpStatus: 400,
  ok: false,
  resposta: '',
};

describe('bugsDoRun', () => {
  it('separa a escrita em X pela pendência (B1), pela contestação (B2) e pela PAC recusada (B8)', () => {
    expect(ids(run('TC-001', 'AR', ['Account X intacta']))).toEqual(['B1']);
    expect(ids(run('TC-001', 'C4', ['Account X intacta']))).toEqual(['B2']);
    const recusada = run('TC-040', 'AR', ['Account X intacta, sem IdProspect'], { eventos: [recusa] });
    expect(ids(recusada)).toEqual(['B8']);
  });

  it('atribui o Lead novo do FW à repetição do WebJob só quando o AR do TC passa nele', () => {
    const lead = 'Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC';
    const fw = run('TC-001', 'FW', ['Account X intacta', lead]);
    expect(ids(fw, [fw, run('TC-001', 'AR', ['Account X intacta'])])).toEqual(['B1', 'B6']);
    // Com o AR falhando na mesma asserção, é consequência de X alterada.
    expect(ids(fw, [fw, run('TC-001', 'AR', ['Account X intacta', lead])])).toEqual(['B1']);
  });

  it('no FW, separa pelo tipo de problema o que vem da repetição (B6) do que o AR também tem', () => {
    const lead = 'Lead novo vinculado, com o e-mail aprovado, sem celular';
    const comLead = (tc: string, perfil: Perfil, detalhe: string[], extras: Partial<ResultadoRun> = {}) =>
      run(tc, perfil, ['Account X intacta', lead], {
        assercoes: [
          { nome: 'Account X intacta', ok: false },
          { nome: lead, ok: false, detalhe },
        ],
        ...extras,
      });
    // O AR tem o e-mail vazio pela colisão com X; o celular de outra pessoa é só do FW.
    const fw = comLead('TC-017', 'FW', ['celular 31987793522']);
    expect(ids(fw, [fw, comLead('TC-017', 'AR', ['e-mail vazio'])])).toEqual(['B1', 'B6']);
    const mesmoProblema = comLead('TC-002', 'FW', ['e-mail vazio'], { eventos: [recusa] });
    const ar = comLead('TC-002', 'AR', ['e-mail vazio'], { eventos: [recusa] });
    expect(ids(mesmoProblema, [mesmoProblema, ar])).toEqual(['B8']);
  });

  it('liga ao B9 os contatos alterados do Lead Y reutilizado', () => {
    const nome = 'Lead leadY reutilizado e vinculado (contatos preservados)';
    const comDetalhe = (detalhe: string) =>
      run('TC-047', 'AR', [nome], { assercoes: [{ nome, ok: false, detalhe: [detalhe] }] });
    expect(ids(comDetalhe('contatos alterados: qa@example.com / 31974847314'))).toEqual(['B9']);
    expect(ids(comDetalhe('Lead vinculado 00QA ≠ leadY 00QB'))).toEqual(['?']);
  });

  it('separa o Lead candidato já conhecido (K2) do que a pendência causa (B5)', () => {
    const candidato = 'Lead leadCandidato reutilizado e vinculado (CPF preenchido)';
    expect(ids(run('TC-046', 'CA', [candidato]))).toEqual(['K2']);
    expect(ids(run('TC-013', 'AR', [candidato]))).toEqual(['B5']);
  });

  it('marca como desconhecido o que não tem regra', () => {
    expect(ids(run('TC-005', 'CA', ['Todos os eventos responderam HTTP 200']))).toEqual(['?']);
    expect(ids(run('TC-040', 'PA', ['Todos os eventos responderam HTTP 200']))).toEqual(['K1']);
    const parouNaRecusa = run('TC-040', 'C1', ['Todos os eventos responderam HTTP 200'], {
      erro: 'pac-analise-1 respondeu 400: Cliente(Account) nÃ£o encontrado no Salesforce.',
    });
    expect(ids(parouNaRecusa)).toEqual(['B8']);
    expect(ids(run('TC-005', 'CA', ['Opportunity na Account aprovada']))).toEqual(['?']);
  });
});

describe('comparacao', () => {
  it('conta os conformes por perfil, os pares de cada bug e agrupa as células que mudaram', () => {
    const antes = [
      run('TC-001', 'AR', ['Account X intacta']),
      run('TC-002', 'AR', ['Account X intacta']),
      run('TC-003', 'AR', []),
    ];
    const depois = [
      run('TC-001', 'AR', ['Account X intacta'], { eventos: [recusa] }),
      run('TC-002', 'AR', ['Account X intacta'], { eventos: [recusa] }),
      run('TC-003', 'AR', []),
    ];
    const texto = comparacao(antes, depois);
    expect(texto).toContain('| AR | 1 de 3 | 1 de 3 |');
    expect(texto).toContain('| B1 | 2 | 0 |');
    expect(texto).toContain('| B8 | 0 | 2 |');
    expect(texto).toContain('| B1 | B8 | 2 | AR: 001, 002 |');
    expect(texto).not.toContain('003');
  });
});
