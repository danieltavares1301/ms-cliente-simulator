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

const ids = (resultado: ResultadoRun, todos: ResultadoRun[] = [resultado], etapa?: number) =>
  [...bugsDoRun(resultado, matrizDeBugs(todos, etapa).porPar, etapa).keys()].sort();

/** RUN com uma asserção que falhou com detalhe. */
const comDetalhe = (tc: string, perfil: Perfil, nome: string, detalhe: unknown) =>
  run(tc, perfil, [nome], { assercoes: [{ nome, ok: false, detalhe }] });

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

  it('liga ao B10 os contatos alterados do Lead Y2 reutilizado (TC-026)', () => {
    const nome = 'Lead leadY2 reutilizado e vinculado (contatos preservados)';
    const resultado = run('TC-026', 'CA', [nome], {
      assercoes: [{ nome, ok: false, detalhe: ['contatos alterados: qa@example.com / 31980155773'] }],
    });
    expect(ids(resultado)).toEqual(['B10']);
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

  it('só liga ao B7 a falha da contagem de Leads com dois ou mais', () => {
    const nome = '1 Lead(s) com o CPF aprovado';
    const encontrados = (n: number) => ({ encontrados: Array.from({ length: n }, (_, i) => ({ Id: `00Q${i}` })) });
    expect(ids(comDetalhe('TC-040', 'FW', nome, encontrados(2)))).toEqual(['B7']);
    expect(ids(comDetalhe('TC-040', 'FW', nome, encontrados(0)))).toEqual(['?']);
    // Antes da R4, a falta de Lead não é o B7: é o que a R4 ainda vai trazer.
    expect(ids(comDetalhe('TC-040', 'FW', nome, encontrados(0)), undefined, 2)).toEqual(['pendente R4']);
    expect(ids(comDetalhe('TC-040', 'FW', nome, encontrados(2)), undefined, 2)).toEqual(['B7']);
  });

  it('antes da R4, rotula como pendente R4 as asserções de Lead, e não como K2, B5, B6, B9 ou B10', () => {
    const lead = [
      'Lead leadCandidato reutilizado e vinculado (CPF preenchido)',
      'Lead leadY reutilizado e vinculado (contatos preservados)',
      'Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC',
      'Account aprovada → Lead (IdProspectSalesforce__c == Lead.Id__c)',
      'Proponente principal na Account aprovada com PROS-Y',
    ];
    for (const nome of lead) {
      expect(ids(run('TC-046', 'FW', [nome]), undefined, 2)).toEqual(['pendente R4']);
      expect(ids(run('TC-046', 'FW', [nome]), undefined, 4)).toEqual(['pendente R4']);
    }
    // Da R4 em diante, valem os rótulos de sempre.
    expect(ids(run('TC-046', 'CA', [lead[0]!]), undefined, 5)).toEqual(['K2']);
    // Fora das asserções de Lead, nada muda.
    expect(ids(run('TC-021', 'AR', ['Lead Z intacto']), undefined, 2)).toEqual(['B4']);
    expect(ids(run('TC-001', 'AR', ['Account X intacta']), undefined, 2)).toEqual(['B1']);
  });

  it('separa a sobrescrita de X pelo cliente-insert (pendente R1) da escrita de contato em X', () => {
    const identidade = [{ campo: 'CPF__pc', antes: '111', depois: '222' }];
    const contato = [{ campo: 'PersonEmail', antes: 'x@example.com', depois: 'y@example.com' }];
    expect(ids(comDetalhe('TC-001', 'PA', 'Account X intacta', identidade), undefined, 2)).toEqual(['pendente R1']);
    expect(ids(comDetalhe('TC-001', 'PA', 'Lead X intacto', [{ campo: 'CPF__c' }]), undefined, 2)).toEqual([
      'pendente R1',
    ]);
    expect(ids(comDetalhe('TC-001', 'AR', 'Account X intacta', contato), undefined, 2)).toEqual(['B1']);
    // Depois da R1, a troca de identidade de X é regressão e precisa de análise.
    expect(ids(comDetalhe('TC-001', 'PA', 'Account X intacta', identidade), undefined, 3)).toEqual(['?']);
  });

  it('com X trocada, liga à R1 o que falha por Y ter sido achada em X, e não ao B7', () => {
    const trocada = { nome: 'Account X intacta', ok: false, detalhe: [{ campo: 'Id__c' }] };
    const comX = (nome: string, detalhe?: unknown) =>
      run('TC-009', 'PA', ['Account X intacta', nome], {
        assercoes: [trocada, { nome, ok: false, detalhe }],
      });
    expect(ids(comX('Account aprovada é nova'), undefined, 2)).toEqual(['pendente R1']);
    expect(ids(comX('Caso C: Account aprovada sem IdProspect'), undefined, 2)).toEqual(['pendente R1']);
    // O Lead X com o CPF de Y conta como um segundo Lead de Y.
    const doisLeads = { encontrados: [{ Id: '00Q1' }, { Id: '00Q2' }] };
    expect(ids(comX('1 Lead(s) com o CPF aprovado', doisLeads), undefined, 2)).toEqual(['pendente R1']);
    expect(ids(comX('Lead leadY reutilizado e vinculado (contatos preservados)'), undefined, 2)).toEqual([
      'pendente R1',
      'pendente R4',
    ]);
  });

  it('liga a R1, R3 e R5 as falhas de evento e de contato que o ponto zero mostrou', () => {
    const http = 'Todos os eventos responderam HTTP 200';
    const evento = (rotulo: string, resposta: string): ResultadoRun['eventos'][number] => ({
      rotulo,
      eventType: '',
      eventTime: '',
      httpStatus: 400,
      ok: false,
      resposta,
    });
    // A PAC da própria X não acha X (TC-004): R1. A PAC em análise de Y recusada segue B8.
    const naoAchou = 'Cliente(Account) não encontrado no Salesforce.';
    const pacDeX = run('TC-004', 'PA', [http], { eventos: [evento('pac-insert-x', naoAchou)] });
    expect(ids(pacDeX, undefined, 2)).toEqual(['pendente R1']);
    expect(ids(run('TC-040', 'C1', [http], { eventos: [evento('pac-analise-1', naoAchou)] }), undefined, 2)).toEqual([
      'B8',
    ]);
    // O prospect de X gravado na Account Y: R5.
    const duplicado = evento(
      'cliente-update',
      'DUPLICATE_VALUE, valor duplicado encontrado: IdProspectSalesforce__c duplica o valor',
    );
    expect(ids(run('TC-005', 'CA', [http], { eventos: [duplicado] }), undefined, 2)).toEqual(['pendente R5']);
    expect(ids(run('TC-005', 'CA', [http], { eventos: [duplicado] }))).toEqual(['?']);
    // O contato atrasado vence a PAC aprovada no RC: R3.
    const rc = run('TC-003', 'RC', [
      'Account aprovada com os contatos da PAC',
      'RC: contato-update atrasado, de antes da aprovação, descartado',
    ]);
    expect(ids(rc, undefined, 2)).toEqual(['pendente R3']);
    expect(ids(rc, undefined, 4)).toEqual(['?']);
    // Lacuna 8: a Opportunity da Venda Genérica fica em X até a R1.
    expect(ids(run('TC-040', 'AR', ['Opportunity na Account aprovada']), undefined, 2)).toEqual(['pendente R1']);
    expect(ids(run('TC-005', 'AR', ['Opportunity na Account aprovada']), undefined, 2)).toEqual(['?']);
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

  it('compara por asserção: acha o bug que some de um par que segue divergente', () => {
    const lead = 'Lead novo vinculado, sem e-mail, sem celular, origem InsertClientePAC';
    const par = (tc: string, falhas: string[]) =>
      run(tc, 'AR', falhas, {
        assercoes: ['Account X intacta', lead].map((nome) => ({ nome, ok: !falhas.includes(nome) })),
      });
    const antes = [par('TC-001', ['Account X intacta', lead]), par('TC-002', [])];
    const depois = [par('TC-001', [lead]), par('TC-002', ['Account X intacta'])];
    const texto = comparacao(antes, depois, { antes: 3, depois: 3 });
    // Pela célula, o 001 só troca "B1 pendente R4" por "pendente R4".
    expect(texto).toContain('| Account X intacta | ok | B1 | 1 | AR: 002 |');
    expect(texto).toContain('| Account X intacta | B1 | ok | 1 | AR: 001 |');
    expect(texto).toContain('Asserções que seguem falhando com outro rótulo: nenhuma.');
  });

  it('classifica cada campanha pela própria etapa', () => {
    const lead = 'Lead leadCandidato reutilizado e vinculado (CPF preenchido)';
    const texto = comparacao([run('TC-046', 'CA', [lead])], [run('TC-046', 'CA', [lead])], { antes: 4, depois: 5 });
    expect(texto).toContain(`| ${lead} | pendente R4 | K2 | 1 | CA: 046 |`);
  });
});
