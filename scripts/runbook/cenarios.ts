import { randomUUID } from 'node:crypto';

import type { Aprovacao, Assercao, Execucao } from './engine.ts';
import type { Verificador } from './verificacoes.ts';

/**
 * Os 44 TCs executáveis do runbook (`docs/runbook-testes-manuais-
 * unificacao-2.2.md`): os 70 da planilha menos os marcados como Bloqueado e
 * os `BLOCKED-FUNCIONAL` (008, 028, 029, 050, 052, 058, 060, 064, 065), que
 * aguardam decisão de PO/QA. Cada um roda nos perfis PA, CA e ME.
 *
 * Massa, aprovação e esperado seguem o texto de cada TC. Contatos seguem a
 * convenção §3.1: A/B de X, C/D inéditos; E/F são contatos próprios de um
 * Lead Y preexistente e G, o celular próprio de um Lead candidato.
 */

export type Cenario = {
  id: string;
  titulo: string;
  fluxo: 'JORNADA_UNIDADE' | 'VENDA_GENERICA';
  /** Adaptação ou leitura do texto do runbook registrada no relatório. */
  observacao?: string;
  /** MATCH: a pessoa aprovada é a própria X, que pode mudar. */
  xAlteravel?: boolean;
  massa: (e: Execucao) => Promise<void>;
  aprovacao: (e: Execucao) => Aprovacao;
  esperado: (v: Verificador, e: Execucao) => Assercao[];
};

function aprovarY(
  e: Execucao,
  contatos: { email: string; celular: string },
  tipoEventoCliente: Aprovacao['tipoEventoCliente'],
  extras: Partial<Aprovacao> = {},
): Aprovacao {
  return { pessoa: e.y, ...contatos, tipoEventoCliente, ...extras };
}

async function contaYComIdCliente(e: Execucao, ref = 'accountY'): Promise<void> {
  await e.criarAccount(ref, {
    pessoa: e.y,
    idCliente: e.y.idCliente,
    idProspect: null,
  });
}

async function contaYSoCpf(e: Execucao, ref = 'accountY'): Promise<void> {
  await e.criarAccount(ref, { pessoa: e.y, idCliente: null, idProspect: null });
}

async function leadYLivre(
  e: Execucao,
  contatos: { email: string | null; celular: string | null } = {
    email: e.contatos.emailE,
    celular: e.contatos.celularF,
  },
): Promise<void> {
  await e.criarLead('leadY', {
    pessoa: e.y,
    idProspect: e.y.idProspect,
    ...contatos,
  });
}

async function candidatoSemCpf(
  e: Execucao,
  contatos: { email: string | null; celular: string | null },
): Promise<void> {
  const candidato = e.novaPessoa('CAND');
  await e.criarLead('leadCandidato', {
    pessoa: candidato,
    cpf: false,
    idProspect: candidato.idProspect,
    ...contatos,
  });
}

/** Lead Y (CPF Y) preso a outra Account (Caso C). */
async function leadYPresoA(
  e: Execucao,
  refLead: string,
  refConta: string,
  dono: ReturnType<Execucao['novaPessoa']>,
  contatos: { email: string | null; celular: string | null } = {
    email: e.emailExtra(refLead),
    celular: null,
  },
): Promise<void> {
  const prospect = randomUUID();
  await e.criarLead(refLead, { pessoa: e.y, idProspect: prospect, ...contatos });
  await e.criarAccount(refConta, {
    pessoa: dono,
    idCliente: dono.idCliente,
    idProspect: prospect,
  });
}

/** Lead novo só com CPF e origem InsertClientePAC (colisão com X). */
function leadSoCpf(v: Verificador): Assercao {
  return v.leadNovo({ email: null, celular: null, origemInsertClientePac: true });
}

export const CENARIOS: readonly Cenario[] = [
  {
    id: 'TC-001',
    titulo: 'CPF divergente com os mesmos contatos',
    fluxo: 'JORNADA_UNIDADE',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      leadSoCpf(v),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-002',
    titulo: 'CPF, e-mail e celular divergentes',
    fluxo: 'JORNADA_UNIDADE',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v, e) => [
      v.contaNova(),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-003',
    titulo: 'Match com dados idênticos',
    fluxo: 'JORNADA_UNIDADE',
    xAlteravel: true,
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) => ({
      pessoa: e.x,
      email: e.contatos.emailA,
      celular: e.contatos.celularB,
      tipoEventoCliente: 'cliente-update',
      match: true,
    }),
    esperado: (v) => [
      v.contaReutilizada('accountX'),
      v.leadReutilizado('leadX'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-004',
    titulo: 'Jornada sem CPF e PAC inclui CPF',
    fluxo: 'JORNADA_UNIDADE',
    xAlteravel: true,
    massa: (e) =>
      e.pessoaSincronizada(
        'X',
        e.x,
        { email: e.contatos.emailA, celular: e.contatos.celularB },
        { cpf: false, idCliente: false },
      ),
    aprovacao: (e) => ({
      pessoa: e.x,
      email: e.contatos.emailA,
      celular: e.contatos.celularB,
      tipoEventoCliente: 'cliente-insert',
      match: true,
    }),
    esperado: (v, e) => [
      v.contaReutilizada('accountX'),
      v.contaComIdCliente(),
      v.contasDoCpf(1),
      v.leadReutilizado('leadX'),
      v.contaComContatos(e.contatos.emailA, e.contatos.celularB),
    ],
  },
  {
    id: 'TC-005',
    titulo: 'Account Y existente, Lead Y ausente',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-006',
    titulo: 'Account Y e Lead Y órfão existentes',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
      await leadYLivre(e, { email: e.contatos.emailC, celular: e.contatos.celularD });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.leadReutilizado('leadY'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-007',
    titulo: 'Contatos de Y pertencem ao Lead Z',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
      await e.pessoaSincronizada('Z', e.z, {
        email: e.contatos.emailC,
        celular: e.contatos.celularD,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.leadsDoCpf(1),
      leadSoCpf(v),
      v.vinculo(),
      v.preservado('accountZ', 'Account Z intacta'),
      v.preservado('leadZ', 'Lead Z intacto'),
    ],
  },
  {
    id: 'TC-009',
    titulo: 'Account Y incompleta e Lead Y existente',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYSoCpf(e);
      await leadYLivre(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.contaComIdCliente(),
      v.leadReutilizado('leadY', { contatosPreservados: true }),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-010',
    titulo: 'Colisão apenas de e-mail',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.leadsDoCpf(1),
      v.leadNovo({ email: null, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-011',
    titulo: 'Colisão apenas de celular',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularB }, 'cliente-update'),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: null }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-012',
    titulo: 'Fallback por e-mail em Lead sem CPF',
    fluxo: 'JORNADA_UNIDADE',
    observacao:
      'O runbook pede aprovação com "e-mail A e celular C"; na convenção §3.1 C é e-mail, então o celular aprovado é D.',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
      await candidatoSemCpf(e, { email: e.contatos.emailA, celular: e.contatos.celularG });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v) => [
      v.preservado('leadX', 'Lead X intacto (guard ehLeadOriginal)'),
      v.contaReutilizada('accountY'),
      v.leadReutilizado('leadCandidato', { cpfPreenchido: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-013',
    titulo: 'Fallback por celular em Lead sem CPF',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
      await candidatoSemCpf(e, { email: e.contatos.emailE, celular: e.contatos.celularB });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularB }, 'cliente-update'),
    esperado: (v) => [
      v.preservado('leadX', 'Lead X intacto'),
      v.contaReutilizada('accountY'),
      v.leadReutilizado('leadCandidato', { cpfPreenchido: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-014',
    titulo: 'Sem compatibilidade; IdCliente em minúsculas',
    fluxo: 'JORNADA_UNIDADE',
    observacao:
      'IdCliente armazenado em minúsculas na Account Y; eventos enviam o mesmo IdCliente em maiúsculas.',
    massa: async (e) => {
      await e.xSincronizado();
      await e.criarAccount('accountY', {
        pessoa: e.y,
        idCliente: e.y.idCliente.toLowerCase(),
        idProspect: null,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update', {
        idClienteEvento: e.y.idCliente.toUpperCase(),
      }),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-015',
    titulo: 'Sem compatibilidade; IdCliente em maiúsculas',
    fluxo: 'JORNADA_UNIDADE',
    observacao:
      'IdCliente armazenado em maiúsculas na Account Y; eventos enviam em minúsculas. Se Id__c for case-sensitive, é FAIL/REQUISITO.',
    massa: async (e) => {
      await e.xSincronizado();
      await e.criarAccount('accountY', {
        pessoa: e.y,
        idCliente: e.y.idCliente.toUpperCase(),
        idProspect: null,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update', {
        idClienteEvento: e.y.idCliente.toLowerCase(),
      }),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-016',
    titulo: 'Y inexistente e colisão total',
    fluxo: 'JORNADA_UNIDADE',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [v.contaNova(), v.contasDoCpf(1), v.leadsDoCpf(1), leadSoCpf(v), v.vinculo()],
  },
  {
    id: 'TC-017',
    titulo: 'Y inexistente; celular colide',
    fluxo: 'JORNADA_UNIDADE',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v, e) => [
      v.contaNova(),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: null }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-018',
    titulo: 'Y inexistente; e-mail colide',
    fluxo: 'JORNADA_UNIDADE',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v, e) => [
      v.contaNova(),
      v.leadsDoCpf(1),
      v.leadNovo({ email: null, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-019',
    titulo: 'Lead Y livre por CPF, contatos diferentes',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
      await leadYLivre(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.leadReutilizado('leadY', { contatosPreservados: true }),
      v.leadsDoCpf(1),
      v.contaComContatos(e.contatos.emailC, e.contatos.celularD),
    ],
  },
  {
    id: 'TC-020',
    titulo: 'Account Y só com CPF; nenhum Lead',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYSoCpf(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.contaComIdCliente(),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-021',
    titulo: 'Account Y com prospect divergente',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await e.criarLead('leadZ', {
        pessoa: e.z,
        idProspect: e.z.idProspect,
        email: e.contatos.emailE,
        celular: e.contatos.celularG,
      });
      await e.criarAccount('accountY', {
        pessoa: e.y,
        idCliente: e.y.idCliente,
        idProspect: e.z.idProspect,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update'),
    esperado: (v, e) => [
      v.preservado('leadZ', 'Lead Z intacto'),
      v.contaReutilizada('accountY'),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-022',
    titulo: 'Account Y incompleta e Lead Y órfão',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYSoCpf(e);
      await leadYLivre(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.contaComIdCliente(),
      v.leadReutilizado('leadY', { contatosPreservados: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-023',
    titulo: 'Account Y inexistente e Lead Y órfão',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await leadYLivre(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.contasDoCpf(1),
      v.leadReutilizado('leadY', { contatosPreservados: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-024',
    titulo: 'Lead Y preso a outra Account',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYSoCpf(e);
      await leadYPresoA(e, 'leadY', 'accountZ', e.z);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.contaComIdCliente(),
      v.contaSemProspect(),
      v.preservado('leadY', 'Lead Y intacto (não transferido)'),
      v.preservado('accountZ', 'Account Z intacta'),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-025',
    titulo: 'Múltiplas Accounts Y; selecionar a mais recente',
    fluxo: 'JORNADA_UNIDADE',
    observacao:
      'Y2 é criada depois de Y1 e ainda recebe um PATCH, sendo a mais recente por criação e por modificação.',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYSoCpf(e, 'accountY1');
      await contaYSoCpf(e, 'accountY2');
      await e.tocarAccount('accountY2');
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaReutilizada('accountY2'),
      v.contaComIdCliente(),
      v.preservado('accountY1', 'Account Y1 intacta'),
      v.contasDoCpf(2),
      v.leadsDoCpf(1),
      v.leadNovo({ email: null, celular: null }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-026',
    titulo: 'Dois Leads Y; reutilizar o livre',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
      await leadYPresoA(e, 'leadY1', 'accountZ', e.z);
      await e.criarLead('leadY2', {
        pessoa: e.y,
        idProspect: randomUUID(),
        email: e.emailExtra('leadY2'),
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-update'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.leadReutilizado('leadY2'),
      v.preservado('leadY1', 'Lead Y1 intacto'),
      v.preservado('accountZ', 'Account Z intacta'),
      v.leadsDoCpf(2),
    ],
  },
  {
    id: 'TC-027',
    titulo: 'Todos os Leads Y estão presos',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYSoCpf(e);
      await leadYPresoA(e, 'leadY1', 'accountZ1', e.z);
      await leadYPresoA(e, 'leadY2', 'accountZ2', e.novaPessoa('W'));
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.contaComIdCliente(),
      v.contaSemProspect(),
      v.leadsDoCpf(2),
      v.preservado('leadY1', 'Lead Y1 intacto'),
      v.preservado('leadY2', 'Lead Y2 intacto'),
      v.preservado('accountZ1', 'Account Z1 intacta'),
      v.preservado('accountZ2', 'Account Z2 intacta'),
    ],
  },
  {
    id: 'TC-038',
    titulo: 'Accounts Y duplicadas; priorizar a que tem IdCliente',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e, 'accountY1');
      await contaYSoCpf(e, 'accountY2');
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-update'),
    esperado: (v) => [
      v.contaReutilizada('accountY1'),
      v.preservado('accountY2', 'Account Y2 intacta'),
      v.contasDoCpf(2),
      v.leadsDoCpf(1),
      v.leadNovo({ email: null, celular: null }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-039',
    titulo: 'Nova jornada do mesmo cliente Y',
    fluxo: 'JORNADA_UNIDADE',
    xAlteravel: true,
    observacao:
      'A pessoa da jornada e a aprovada são a mesma: modelado como X sincronizado com A/B e aprovado com C/D.',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) => ({
      pessoa: e.x,
      email: e.contatos.emailC,
      celular: e.contatos.celularD,
      tipoEventoCliente: 'cliente-update',
      match: true,
    }),
    esperado: (v, e) => [
      v.contaReutilizada('accountX'),
      v.leadReutilizado('leadX'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.contaComContatos(e.contatos.emailC, e.contatos.celularD),
    ],
  },
  {
    id: 'TC-040',
    titulo: 'Venda Genérica aprova CPF Y diferente',
    fluxo: 'VENDA_GENERICA',
    xAlteravel: true,
    observacao:
      'Sem Lead X e sem prospect na jornada: os eventos vão sem idprospectsalesforce.',
    massa: async (e) => {
      await e.criarAccount('accountX', {
        pessoa: e.x,
        idCliente: e.x.idCliente,
        idProspect: null,
        email: e.contatos.emailA,
        celular: e.contatos.celularB,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert', {
        prospectDaJornada: null,
      }),
    esperado: (v, e) => [
      v.preservado('accountX', 'Account X intacta, sem IdProspect'),
      v.contaNova(),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailA, celular: e.contatos.celularB }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-041',
    titulo: 'Venda Genérica com colisão total',
    fluxo: 'VENDA_GENERICA',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [v.contaNova(), v.leadsDoCpf(1), leadSoCpf(v), v.vinculo()],
  },
  {
    id: 'TC-042',
    titulo: 'Venda Genérica; e-mail colide',
    fluxo: 'VENDA_GENERICA',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v, e) => [
      v.contaNova(),
      v.leadsDoCpf(1),
      v.leadNovo({ email: null, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-043',
    titulo: 'Venda Genérica; celular colide',
    fluxo: 'VENDA_GENERICA',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v, e) => [
      v.contaNova(),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: null }),
      v.vinculo(),
    ],
  },
  {
    id: 'TC-044',
    titulo: 'Venda Genérica reutiliza Lead Y por CPF',
    fluxo: 'VENDA_GENERICA',
    massa: async (e) => {
      await e.xSincronizado();
      // Contatos do Lead Y não definidos no runbook: E/F próprios.
      await leadYLivre(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.leadReutilizado('leadY'),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-045',
    titulo: 'Venda Genérica reutiliza Lead sem CPF por e-mail',
    fluxo: 'VENDA_GENERICA',
    massa: async (e) => {
      await e.xSincronizado();
      await candidatoSemCpf(e, { email: e.contatos.emailC, celular: null });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.leadReutilizado('leadCandidato', { cpfPreenchido: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-046',
    titulo: 'Venda Genérica reutiliza Lead sem CPF por celular',
    fluxo: 'VENDA_GENERICA',
    massa: async (e) => {
      await e.xSincronizado();
      await candidatoSemCpf(e, { email: null, celular: e.contatos.celularD });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.leadReutilizado('leadCandidato', { cpfPreenchido: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-047',
    titulo: 'Venda Genérica reutiliza Lead por CPF forte',
    fluxo: 'VENDA_GENERICA',
    massa: async (e) => {
      await e.xSincronizado();
      await leadYLivre(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.leadReutilizado('leadY', { contatosPreservados: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-048',
    titulo: 'Lead Y preso com compatibilidade total',
    fluxo: 'VENDA_GENERICA',
    massa: async (e) => {
      await e.xSincronizado();
      await leadYPresoA(e, 'leadY', 'accountZ', e.z, {
        email: e.contatos.emailC,
        celular: e.contatos.celularD,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.contaSemProspect(),
      v.preservado('leadY', 'Lead Y intacto (não roubado)'),
      v.preservado('accountZ', 'Account Z intacta'),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-049',
    titulo: 'Venda de Unidade reutiliza Lead livre por contatos',
    fluxo: 'JORNADA_UNIDADE',
    massa: async (e) => {
      await e.xSincronizado();
      await candidatoSemCpf(e, { email: e.contatos.emailC, celular: e.contatos.celularD });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.leadReutilizado('leadCandidato', { cpfPreenchido: true }),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-053',
    titulo: 'Proponente com Account/IdCliente existente',
    fluxo: 'VENDA_GENERICA',
    observacao:
      'Y sincronizado (Account + Lead) com contatos próprios E/F, aprovado com os mesmos contatos.',
    massa: async (e) => {
      await e.xSincronizado();
      await e.pessoaSincronizada('Y', e.y, {
        email: e.contatos.emailE,
        celular: e.contatos.celularF,
      });
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailE, celular: e.contatos.celularF }, 'cliente-update', {
        match: true,
      }),
    esperado: (v) => [
      v.contaReutilizada('accountY'),
      v.leadReutilizado('leadY'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
    ],
  },
  {
    id: 'TC-054',
    titulo: 'Proponente X aprovado como Y na Venda Genérica',
    fluxo: 'VENDA_GENERICA',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [
      v.contaNova(),
      v.leadsDoCpf(1),
      v.leadNovo({ email: null, celular: null }),
      v.vinculo(),
    ],
  },
  ...['TC-055', 'TC-056'].map(
    (id): Cenario => ({
      id,
      titulo:
        id === 'TC-055'
          ? 'Priorizar Lead Y por CPF na Venda Genérica'
          : 'Repetição funcional do TC-055',
      fluxo: 'VENDA_GENERICA',
      ...(id === 'TC-056'
        ? { observacao: 'Duplicação aparente da planilha: mesma massa do TC-055.' }
        : {}),
      massa: async (e) => {
        // E-mail C pertence ao Lead X e celular D ao Lead Z.
        await e.xSincronizado({ email: e.contatos.emailC, celular: e.contatos.celularB });
        await e.criarLead('leadZ', {
          pessoa: e.z,
          idProspect: e.z.idProspect,
          celular: e.contatos.celularD,
        });
        await leadYLivre(e);
      },
      aprovacao: (e) =>
        aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-insert'),
      esperado: (v) => [
        v.leadReutilizado('leadY', { contatosPreservados: true }),
        v.leadsDoCpf(1),
        v.contasDoCpf(1),
        v.preservado('leadZ', 'Lead Z intacto'),
      ],
    }),
  ),
  {
    id: 'TC-057',
    titulo: 'Proponente Y colide totalmente com X',
    fluxo: 'VENDA_GENERICA',
    massa: (e) => e.xSincronizado(),
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailA, celular: e.contatos.celularB }, 'cliente-insert'),
    esperado: (v) => [v.contaNova(), v.leadsDoCpf(1), leadSoCpf(v), v.vinculo()],
  },
  {
    id: 'TC-062',
    titulo: 'Account Y com IdCliente e sem IdProspect',
    fluxo: 'VENDA_GENERICA',
    observacao: 'Eventos vão sem idprospectsalesforce.',
    massa: async (e) => {
      await e.xSincronizado();
      await contaYComIdCliente(e);
    },
    aprovacao: (e) =>
      aprovarY(e, { email: e.contatos.emailC, celular: e.contatos.celularD }, 'cliente-update', {
        prospectDaJornada: null,
      }),
    esperado: (v, e) => [
      v.contaReutilizada('accountY'),
      v.contasDoCpf(1),
      v.leadsDoCpf(1),
      v.leadNovo({ email: e.contatos.emailC, celular: e.contatos.celularD }),
      v.vinculo(),
    ],
  },
];
