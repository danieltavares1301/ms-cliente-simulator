import { describe, expect, it } from 'vitest';

import { bugsDoRun, matrizDeBugs } from './classificar-bugs.ts';
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

describe('bugsDoRun', () => {
  it('separa a escrita em X pela pendência (B1), pela contestação (B2) e pela PAC recusada (B8)', () => {
    expect(ids(run('TC-001', 'AR', ['Account X intacta']))).toEqual(['B1']);
    expect(ids(run('TC-001', 'C4', ['Account X intacta']))).toEqual(['B2']);
    const recusada = run('TC-040', 'AR', ['Account X intacta, sem IdProspect'], {
      eventos: [
        {
          rotulo: 'pac-analise-1',
          eventType: 'pac-update',
          eventTime: '',
          rejeicaoEsperada: true,
          httpStatus: 400,
          ok: false,
          resposta: '',
        },
      ],
    });
    expect(ids(recusada)).toEqual(['B8']);
  });

  it('atribui o Lead novo do FW à repetição do WebJob só quando o AR do TC passa nele', () => {
    const lead = 'Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC';
    const fw = run('TC-001', 'FW', ['Account X intacta', lead]);
    expect(ids(fw, [fw, run('TC-001', 'AR', ['Account X intacta'])])).toEqual(['B1', 'B6']);
    // Com o AR falhando na mesma asserção, é consequência de X alterada.
    expect(ids(fw, [fw, run('TC-001', 'AR', ['Account X intacta', lead])])).toEqual(['B1']);
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
