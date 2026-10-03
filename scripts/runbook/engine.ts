import { randomInt, randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { EventGridEnvelope } from '../../src/contracts/event-grid.ts';
import {
  asAllowlistedQuery,
  getLeadGestaoVendasRecordTypeId,
  getPersonAccountRecordTypeId,
  SalesforceRestError,
} from '../../src/salesforce/rest-client.ts';
import { generateSyntheticCpf } from '../../src/synthetic/cpf.ts';
import {
  causaDeRede,
  comRetentativas,
  ehFalhaDeRede,
  FalhaDeRede,
  type OpcoesDeRede,
} from './rede.ts';
import {
  dispatchConcurrentRequest,
  literal,
  logStructured,
  parseSalesforceDateTime,
  sleep,
  type TargetOrgConnection,
} from '../stress-o10-concurrent-events-lib.ts';

/**
 * Motor do recorte 2.2 do runbook de testes da Unificação 2.2
 * (`docs/runbook-testes-manuais-unificacao-2.2.md`).
 *
 * Cada RUN monta a massa do TC como fixture (DML direto, que o runbook §4.2
 * chama de "recorte 2.2": não comprova a 2.1 nem a 1.3), cria Opportunity e
 * PAC de X e executa a cadeia 2.2 no perfil pedido (§4.1.1): eventos de
 * cliente/contato/endereço na ordem do perfil, espera do Queueable/callback,
 * `cliente-update(PROS-Y)`, `pac-update` e máquina. Depois compara o estado
 * final com o esperado do TC e limpa só o que o RUN criou (§6.5).
 */

export type Perfil = 'PA' | 'CA' | 'ME' | 'C1' | 'C2' | 'C3' | 'C4';
/** Perfis obrigatórios do runbook (§4.1.1): a campanha padrão roda só estes. */
export const PERFIS: readonly Perfil[] = ['PA', 'CA', 'ME'];
/**
 * Perfis opcionais do bug 4 do TC-001 (`docs/handoff-investigacao-tc001-bug4.md`,
 * seção 1.1): ordem CA mais duas PACs em análise com os dados da pessoa aprovada
 * e um gatilho que projeta o contato do Proponente na Account.
 */
export const PERFIS_IDENTIDADE: readonly Perfil[] = ['C1', 'C2', 'C3', 'C4'];
export const TODOS_PERFIS: readonly Perfil[] = [...PERFIS, ...PERFIS_IDENTIDADE];
export const NOMES_PERFIS: Record<Perfil, string> = {
  PA: 'ORDEM-PARCIAIS-ANTES',
  CA: 'ORDEM-CLIENTE-ANTES',
  ME: 'ORDEM-MESMO-EVENTTIME',
  C1: 'CAMINHO-1-PAC-SEM-IDCLIENTE-E-PENDENCIA',
  C2: 'CAMINHO-2-PAC-COM-IDCLIENTE-DA-JORNADA-E-PENDENCIA',
  C3: 'CAMINHO-3-PENDENCIA-ANTES-DA-PAC',
  C4: 'CAMINHO-4-CONTESTACAO-PENDENTE',
};

export function ehPerfilIdentidade(perfil: Perfil): boolean {
  return PERFIS_IDENTIDADE.includes(perfil);
}

/** Evidências do perfil de identidade, para as asserções de validade do RUN. */
export type EvidenciaIdentidade = {
  /** Estado logo depois das PACs em análise, antes do gatilho dos perfis C1/C2. */
  precondicao: Snapshot | null;
  /** Contestações pendentes antes das PACs em análise (perfil C4). */
  contestacoesAntes: number | null;
};

export type Pessoa = {
  papel: string;
  nome: string;
  cpf: string;
  idCliente: string;
  idProspect: string;
};

export type Contatos = {
  /** E-mail A e celular B: contatos originais de X. */
  emailA: string;
  celularB: string;
  /** E-mail C e celular D: contatos novos, inéditos na org. */
  emailC: string;
  celularD: string;
  /** E-mail E e celular F: contatos próprios de um Lead Y preexistente. */
  emailE: string;
  celularF: string;
  /** Celular G: celular próprio de um Lead candidato. */
  celularG: string;
};

export type Aprovacao = {
  /** Quem a PAC aprova: Y, ou a própria pessoa da jornada nos MATCH. */
  pessoa: Pessoa;
  email: string;
  celular: string;
  /** IdCliente enviado nos eventos, quando difere do da massa (caixa). */
  idClienteEvento?: string;
  tipoEventoCliente: 'cliente-insert' | 'cliente-update';
  /** MATCH: contato/endereço são `-update` da própria pessoa. */
  match?: boolean;
  /** Prospect da jornada nos eventos; `null` omite o campo (TC-040, TC-062). */
  prospectDaJornada?: string | null;
};

export type Assercao = { nome: string; ok: boolean; detalhe?: unknown };

export type ResultadoRun = {
  tc: string;
  titulo: string;
  perfil: Perfil;
  run: string;
  inicio: string;
  fim: string;
  veredito: 'CONFORME' | 'DIVERGENTE' | 'ERRO';
  assercoes: Assercao[];
  eventos: Array<{
    rotulo: string;
    eventType: string;
    eventTime: string;
    httpStatus: number | null;
    ok: boolean;
    resposta: string;
  }>;
  prospectY: string | null;
  /** Snapshot final resumido: evidência do estado (runbook §6.3, item 10). */
  estadoFinal?: ReturnType<typeof resumirEstado>;
  jobsComErro: Array<Record<string, unknown>>;
  logsComErro: Array<Record<string, unknown>>;
  erro: string | null;
  cleanup: {
    apagados: Record<string, string[]>;
    /** `null`: o resíduo não pôde ser verificado (ex.: a descoberta falhou). */
    restantes: number | null;
    erros: string[];
  } | null;
  /** Causa da falha de rede que interrompeu o RUN: sem veredito, o runner o refaz. */
  falhaDeRede?: string;
  /** Tentativas anteriores do mesmo par que caíram por falha de rede. */
  quedasDeRede?: Array<{ run: string; causa: string }>;
  /** Duração de cada fase do RUN, para acompanhar o tempo da campanha. */
  tempos?: {
    massaMs: number;
    cadeiaMs: number;
    /** Parte da cadeia gasta esperando jobs assíncronos. */
    esperaJobsMs: number;
    verificacaoMs: number;
    cleanupMs: number;
    totalMs: number;
  };
  /** No pool paralelo: a tentativa que acusou job com erro e foi refeita em sequência. */
  tentativaParalela?: { run: string; falhas: string[] };
};

const PRODUTO_UNIDADE_ATIVA = '37dd20e6-4b3c-ea11-801d-005056856875';
const LEAD_STATUS_PADRAO = 'Pendente de Distribuição';
const LEAD_MARCA_PADRAO = '1';

const accountCampos =
  'Id, Id__c, IdProspectSalesforce__c, CPF__pc, FirstName, LastName, PersonEmail, Celular__c, DataAlteracaoEvento__c, DataAlteracaoEventoContatoEmail__c, DataAlteracaoEventoContatoCelular__c, CreatedDate, LastModifiedDate';
const leadCampos =
  'Id, Id__c, CPF__c, FirstName, LastName, Email, MobilePhone, CelularSemFormatacao__c, DescricaoOrigem__c, CreatedDate, LastModifiedDate';

const texto = z.string().nullable().optional();

const accountSchema = z
  .object({
    Id: z.string(),
    Id__c: texto,
    IdProspectSalesforce__c: texto,
    CPF__pc: texto,
    FirstName: texto,
    LastName: texto,
    PersonEmail: texto,
    Celular__c: texto,
    DataAlteracaoEvento__c: texto,
    DataAlteracaoEventoContatoEmail__c: texto,
    DataAlteracaoEventoContatoCelular__c: texto,
    /**
     * `Contact.DataHoraAtualizacaoEmailPendencia__c` do Person Contact, anexado
     * pelo motor: só `sincronizarEmailContatoPendencia` grava esse campo.
     */
    ContatoDataHoraAtualizacaoEmailPendencia: texto,
    CreatedDate: z.string(),
    LastModifiedDate: z.string(),
  })
  .passthrough();
export type AccountRegistro = z.infer<typeof accountSchema>;

const contatoSchema = z
  .object({ AccountId: z.string(), DataHoraAtualizacaoEmailPendencia__c: texto })
  .passthrough();

const leadSchema = z
  .object({
    Id: z.string(),
    Id__c: texto,
    CPF__c: texto,
    FirstName: texto,
    LastName: texto,
    Email: texto,
    MobilePhone: texto,
    CelularSemFormatacao__c: texto,
    DescricaoOrigem__c: texto,
    CreatedDate: z.string(),
    LastModifiedDate: z.string(),
  })
  .passthrough();
export type LeadRegistro = z.infer<typeof leadSchema>;

const oportunidadeSchema = z
  .object({ Id: z.string(), AccountId: texto, StageName: texto })
  .passthrough();
const pacSchema = z
  .object({ Id: z.string(), Status__c: texto, DataAlteracaoEvento__c: texto })
  .passthrough();
const proponenteSchema = z
  .object({
    Id: z.string(),
    Proponente__c: texto,
    IdCliente__c: texto,
    IdProponente__c: texto,
    CpfProponente__c: texto,
    TipoClassificacao__c: texto,
    EmailAtualizado__c: texto,
    EnviarNotificacaoPendencia__c: z.boolean().nullable().optional(),
  })
  .passthrough();
const jobSchema = z
  .object({
    Status: texto,
    NumberOfErrors: z.number().nullable().optional(),
    ExtendedStatus: texto,
    JobType: texto,
    ApexClass: z.object({ Name: z.string() }).nullable().optional(),
  })
  .passthrough();
const logSchema = z
  .object({ Id: z.string(), EventType__c: texto, Status2__c: texto })
  .passthrough();
const idSchema = z.object({ Id: z.string() }).passthrough();

function registros<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    totalSize: z.number(),
    records: z.array(schema),
  });
}

function isoSegundos(ms: number): string {
  return new Date(Math.floor(ms / 1_000) * 1_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, '.000Z');
}

function lista(valores: readonly string[]): string {
  return [...new Set(valores)].map(literal).join(', ');
}

// Espera de jobs: o HTTP de um evento só volta depois do commit, então os jobs
// que ele enfileirou já estão no AsyncApexJob; um job encadeado nasce no mesmo
// commit em que o anterior termina. Duas leituras vazias seguidas bastam.
const INTERVALO_JOBS_MS = 1_500;
const LEITURAS_VAZIAS_JOBS = 2;

type ConstantesDaOrg = {
  recordTypeConta: string;
  recordTypeLead: string;
  /** Dono dos jobs que os eventos do RUN enfileiram; `null` desliga o filtro. */
  usuarioCli: string | null;
};

/** Constantes da org, lidas uma vez por processo e compartilhadas pelo pool. */
const cacheConstantes = new Map<string, Promise<ConstantesDaOrg>>();

async function usuarioDoToken(
  conexao: TargetOrgConnection,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const access = await conexao.safetyGuard.validate();
    let resposta: Response;
    try {
      resposta = await fetch(new URL('/services/oauth2/userinfo', access.instanceUrl), {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { authorization: `Bearer ${access.accessToken}` },
      });
    } catch (error) {
      throw new FalhaDeRede('userinfo', causaDeRede(error));
    }
    if (!resposta.ok) return null;
    const corpo = z
      .object({ user_id: z.string().regex(/^005[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/) })
      .safeParse(await resposta.json());
    return corpo.success ? corpo.data.user_id : null;
  } catch (error) {
    // Sem rede, falha de verdade: um null aqui ficaria em cache e desligaria o
    // filtro de jobs pelo resto da campanha.
    if (ehFalhaDeRede(error)) throw error;
    return null;
  }
}

function constantesDaOrg(
  conexao: TargetOrgConnection,
  timeoutMs: number,
  rede: OpcoesDeRede,
): Promise<ConstantesDaOrg> {
  const chave = conexao.access.instanceUrl;
  const existente = cacheConstantes.get(chave);
  if (existente !== undefined) return existente;
  const promessa = comRetentativas(
    () =>
      Promise.all([
        getPersonAccountRecordTypeId(conexao.restClient),
        getLeadGestaoVendasRecordTypeId(conexao.restClient),
        usuarioDoToken(conexao, timeoutMs),
      ]),
    rede,
  ).then(([recordTypeConta, recordTypeLead, usuarioCli]) => ({
    recordTypeConta,
    recordTypeLead,
    usuarioCli,
  }));
  cacheConstantes.set(chave, promessa);
  // Uma falha não fica em cache: o próximo RUN tenta de novo.
  promessa.catch(() => cacheConstantes.delete(chave));
  return promessa;
}

/** Executa tarefas em lotes que podem rodar juntos, um lote depois do outro. */
async function emEtapas(etapas: ReadonlyArray<ReadonlyArray<() => Promise<void>>>): Promise<void> {
  for (const etapa of etapas) {
    await Promise.all(etapa.map((tarefa) => tarefa()));
  }
}

function mensagem(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

class FalhaDeEvento extends Error {}

export type Snapshot = {
  accounts: AccountRegistro[];
  leads: LeadRegistro[];
  oportunidade: z.infer<typeof oportunidadeSchema> | null;
  pac: z.infer<typeof pacSchema> | null;
  proponente: z.infer<typeof proponenteSchema> | null;
};

/**
 * Um RUN: massa própria, eventos do perfil, verificação e cleanup. As
 * especificações dos TCs (`cenarios.ts`) usam os métodos de massa e as
 * funções de asserção daqui.
 */
export class Execucao {
  readonly run: string;
  readonly x: Pessoa;
  readonly y: Pessoa;
  readonly z: Pessoa;
  /** Pessoas extras de alguns TCs (Z1, Z2, candidato...). */
  readonly extras = new Map<string, Pessoa>();
  readonly contatos: Contatos;
  readonly oportunidadeExterna: string;
  readonly pacExterno: string;
  readonly proponenteExterno: string;
  /** Fixtures criadas pelo RUN: referência lógica → registro no momento da criação. */
  readonly fixtures = new Map<
    string,
    { objeto: 'Account' | 'Lead'; registro: AccountRegistro | LeadRegistro }
  >();
  readonly criados: Record<'Account' | 'Lead' | 'Opportunity' | 'Contestacao__c', string[]> = {
    Account: [],
    Lead: [],
    Opportunity: [],
    Contestacao__c: [],
  };
  readonly eventos: ResultadoRun['eventos'] = [];
  readonly tMassa: string;
  private readonly t0: number;
  /** Tempo acumulado esperando jobs assíncronos neste RUN. */
  readonly tempos = { esperaJobsMs: 0 };
  private recordTypeConta = '';
  private recordTypeLead = '';
  private usuarioCli: string | null = null;
  private idOportunidade: string | null = null;
  private inicioServidorMs: number | null = null;
  /** A cadeia chegou ao fim e os jobs dela assentaram. */
  private cadeiaConcluida = false;

  constructor(
    readonly conexao: TargetOrgConnection,
    readonly tc: string,
    readonly perfil: Perfil,
    private readonly timeoutRequisicaoMs: number,
    /** Retentativas de leitura/exclusão e aviso de queda (portão do pool). */
    private readonly rede: OpcoesDeRede = {},
  ) {
    const numero = tc.replace(/\D/g, '').padStart(3, '0');
    const sufixo = randomUUID().replace(/-/g, '').slice(0, 6);
    this.run = `TC${numero}-${perfil}-${sufixo}`;
    // Sete dígitos aleatórios no celular (antes: número do TC + 4). Com só 4,
    // sobras antigas e RUNs simultâneos do mesmo TC colidiam no precheck.
    // O TC continua identificável pelo e-mail.
    const aleatorio = String(randomInt(0, 10_000_000)).padStart(7, '0');
    const email = (letra: string) =>
      `qa.unif22.tc${numero}.${letra}.${this.run.toLowerCase()}@example.com`;
    this.contatos = {
      emailA: email('a'),
      emailC: email('c'),
      emailE: email('e'),
      celularB: `3198${aleatorio}`,
      celularD: `3197${aleatorio}`,
      celularF: `3196${aleatorio}`,
      celularG: `3195${aleatorio}`,
    };
    this.x = this.novaPessoa('X');
    this.y = this.novaPessoa('Y');
    this.z = this.novaPessoa('Z');
    this.oportunidadeExterna = `OPP-QA-UNIF22-${this.run}`;
    this.pacExterno = `PAC-QA-UNIF22-${this.run}`;
    this.proponenteExterno = `PROP-QA-UNIF22-${this.run}`;
    this.t0 = Date.now();
    this.tMassa = isoSegundos(this.t0 - 120_000);
  }

  novaPessoa(papel: string): Pessoa {
    const pessoa: Pessoa = {
      papel,
      nome: `QA UNIF22 ${this.tc.replace('-', '')} CLIENTE ${papel} ${this.run}`,
      cpf: generateSyntheticCpf(`${this.run}:${papel}`, `runbook-${this.run}`),
      idCliente: randomUUID(),
      idProspect: randomUUID(),
    };
    if (!['X', 'Y', 'Z'].includes(papel)) this.extras.set(papel, pessoa);
    return pessoa;
  }

  /**
   * E-mail próprio e único do RUN para um Lead da massa cujos contatos o
   * runbook não define: a org exige e-mail ou celular em todo Lead.
   */
  emailExtra(rotulo: string): string {
    const numero = this.tc.replace(/\D/g, '').padStart(3, '0');
    return `qa.unif22.tc${numero}.${rotulo.toLowerCase()}.${this.run.toLowerCase()}@example.com`;
  }

  /** Instante lógico `segundos` depois do início do RUN. */
  t(segundos: number): string {
    return isoSegundos(this.t0 + segundos * 1_000);
  }

  private get restClient() {
    return this.conexao.restClient;
  }

  /** Leitura ou exclusão: repete enquanto a falha for de rede. */
  private comRede<T>(operacao: () => Promise<T>): Promise<T> {
    return comRetentativas(operacao, this.rede);
  }

  /**
   * Escrita: não se repete, porque poderia duplicar; uma queda só avisa o
   * portão do pool, e o RUN é refeito inteiro.
   */
  private async semRepetir<T>(operacao: () => Promise<T>): Promise<T> {
    try {
      return await operacao();
    } catch (error) {
      if (ehFalhaDeRede(error)) this.rede.aoFalhar?.(causaDeRede(error));
      throw error;
    }
  }

  /** `fetch` direto (fora do rest client): sem resposta HTTP vira FalhaDeRede, com a causa. */
  private async fetchDireto(operacao: string, url: URL, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      const falha = new FalhaDeRede(operacao, causaDeRede(error));
      this.rede.aoFalhar?.(falha.causa);
      throw falha;
    }
  }

  /** Valida a org antes de uma escrita direta; a validação é leitura e pode se repetir. */
  private acesso() {
    return this.comRede(() => this.conexao.safetyGuard.validate());
  }

  private async consultar<T extends z.ZodTypeAny>(
    schema: T,
    soql: string,
  ): Promise<z.infer<T>[]> {
    return registros(schema).parse(
      await this.comRede(() => this.restClient.query<unknown>(asAllowlistedQuery(soql))),
    ).records;
  }

  /**
   * Anexa às Accounts o carimbo da sincronização de pendência do Person
   * Contact. Exige leitura de `Contact.DataHoraAtualizacaoEmailPendencia__c`
   * para o usuário do CLI (permission set `AcessoDeAPI` na `mrv-devDan`).
   */
  private async comCarimboPendencia(contas: AccountRegistro[]): Promise<AccountRegistro[]> {
    if (contas.length === 0) return contas;
    let contatos: z.infer<typeof contatoSchema>[];
    try {
      contatos = await this.consultar(
        contatoSchema,
        `SELECT AccountId, DataHoraAtualizacaoEmailPendencia__c FROM Contact WHERE AccountId IN (${lista(contas.map(({ Id }) => Id))})`,
      );
    } catch (error) {
      // Queda de rede não é problema de FLS.
      if (ehFalhaDeRede(error)) throw error;
      throw new Error(
        `Leitura de Contact.DataHoraAtualizacaoEmailPendencia__c falhou (${mensagem(error)}); confira a FLS do usuário do CLI no permission set AcessoDeAPI.`,
      );
    }
    const porConta = new Map(
      contatos.map((contato) => [contato.AccountId, contato.DataHoraAtualizacaoEmailPendencia__c ?? null]),
    );
    return contas.map((conta) => ({
      ...conta,
      ContatoDataHoraAtualizacaoEmailPendencia: porConta.get(conta.Id) ?? null,
    }));
  }

  async preparar(): Promise<void> {
    const constantes = await constantesDaOrg(this.conexao, this.timeoutRequisicaoMs, this.rede);
    this.recordTypeConta = constantes.recordTypeConta;
    this.recordTypeLead = constantes.recordTypeLead;
    this.usuarioCli = constantes.usuarioCli;
  }

  /** Filtro dos jobs do usuário do CLI: ignora os de outras pessoas na mesma org. */
  private get filtroJobsDoUsuario(): string {
    return this.usuarioCli === null ? '' : ` AND CreatedById = ${literal(this.usuarioCli)}`;
  }

  /**
   * Runbook §2.5: toda chave sintética precisa estar ausente na org antes do
   * DML. Uma colisão (improvável) invalida o RUN em vez de contaminá-lo.
   */
  async precheck(): Promise<void> {
    const pessoas = [this.x, this.y, this.z, ...this.extras.values()];
    const cpfs = pessoas.map(({ cpf }) => cpf);
    const idClientes = pessoas.flatMap(({ idCliente }) => [
      idCliente,
      idCliente.toUpperCase(),
    ]);
    const prospects = pessoas.map(({ idProspect }) => idProspect);
    const emails = [
      this.contatos.emailA,
      this.contatos.emailC,
      this.contatos.emailE,
    ];
    const celulares = [
      this.contatos.celularB,
      this.contatos.celularD,
      this.contatos.celularF,
      this.contatos.celularG,
    ];
    const [contas, leads] = await Promise.all([
      this.consultar(
        idSchema,
        `SELECT Id FROM Account WHERE CPF__pc IN (${lista(cpfs)}) OR Id__c IN (${lista(idClientes)}) OR IdProspectSalesforce__c IN (${lista(prospects)}) OR PersonEmail IN (${lista(emails)}) OR Celular__c IN (${lista(celulares)})`,
      ),
      this.consultar(
        idSchema,
        `SELECT Id FROM Lead WHERE CPF__c IN (${lista(cpfs)}) OR Id__c IN (${lista(prospects)}) OR Email IN (${lista(emails)}) OR CelularSemFormatacao__c IN (${lista(celulares)})`,
      ),
    ]);
    if (contas.length > 0 || leads.length > 0) {
      throw new Error(
        `Precheck: chaves sintéticas já existem na org (${contas.length} Account, ${leads.length} Lead).`,
      );
    }
  }

  private async post(objeto: 'Account', corpo: Record<string, unknown>) {
    // POST direto: o catálogo de operações do rest client não cria Account
    // sem prospect nem com contatos. O guard valida a org logo antes.
    const access = await this.acesso();
    const resposta = await this.fetchDireto(
      `POST ${objeto}`,
      new URL(`/services/data/v61.0/sobjects/${objeto}`, access.instanceUrl),
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutRequisicaoMs),
        headers: {
          authorization: `Bearer ${access.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(corpo),
      },
    );
    if (!resposta.ok) {
      throw new Error(
        `POST ${objeto} falhou (${resposta.status}): ${(await resposta.text()).slice(0, 500)}`,
      );
    }
    return z.object({ id: z.string() }).parse(await resposta.json()).id;
  }

  /** PATCH direto numa Account da massa (ex.: forçar a mais recente no TC-025). */
  async tocarAccount(ref: string): Promise<void> {
    const fixture = this.fixtures.get(ref);
    if (fixture?.objeto !== 'Account') throw new Error(`Fixture ${ref} inexistente`);
    const access = await this.acesso();
    const resposta = await this.fetchDireto(
      'PATCH Account',
      new URL(
        `/services/data/v61.0/sobjects/Account/${fixture.registro.Id}`,
        access.instanceUrl,
      ),
      {
        method: 'PATCH',
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutRequisicaoMs),
        headers: {
          authorization: `Bearer ${access.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ Description: `QA UNIF22 ${this.run}` }),
      },
    );
    if (!resposta.ok) {
      throw new Error(`PATCH Account falhou (${resposta.status})`);
    }
    await this.recarregarFixture(ref);
  }

  /**
   * Toma o estado atual da fixture como nova referência, quando um efeito
   * legítimo já é esperado (ex.: pendência da própria X grava o carimbo).
   */
  private async reancorarFixture(ref: string): Promise<void> {
    if (!this.fixtures.has(ref)) throw new Error(`Fixture ${ref} inexistente`);
    await this.recarregarFixture(ref);
  }

  private async recarregarFixture(ref: string): Promise<void> {
    const fixture = this.fixtures.get(ref)!;
    if (fixture.objeto === 'Account') {
      const [registro] = await this.comCarimboPendencia(
        await this.consultar(
          accountSchema,
          `SELECT ${accountCampos} FROM Account WHERE Id = ${literal(fixture.registro.Id)}`,
        ),
      );
      fixture.registro = registro!;
    } else {
      const [registro] = await this.consultar(
        leadSchema,
        `SELECT ${leadCampos} FROM Lead WHERE Id = ${literal(fixture.registro.Id)}`,
      );
      fixture.registro = registro!;
    }
  }

  async criarAccount(
    ref: string,
    campos: {
      pessoa: Pessoa;
      cpf?: boolean;
      idCliente?: string | null;
      idProspect?: string | null;
      email?: string | null;
      celular?: string | null;
    },
  ): Promise<string> {
    const { pessoa } = campos;
    const id = await this.post('Account', {
      RecordTypeId: this.recordTypeConta,
      LastName: pessoa.nome,
      ...(campos.cpf === false ? {} : { CPF__pc: pessoa.cpf }),
      ...(campos.idCliente ? { Id__c: campos.idCliente } : {}),
      ...(campos.idProspect ? { IdProspectSalesforce__c: campos.idProspect } : {}),
      ...(campos.email ? { PersonEmail: campos.email } : {}),
      ...(campos.celular ? { Celular__c: campos.celular } : {}),
      // Marcadores antes de qualquer evento do RUN: todo evento que precisa
      // ser aplicado tem data posterior (achado do reteste do TC-005).
      DataAlteracaoEvento__c: this.tMassa,
      DataAlteracaoEventoContatoEmail__c: this.tMassa,
      DataAlteracaoEventoContatoCelular__c: this.tMassa,
      DataAlteracaoEventoEndereco__c: this.tMassa,
    });
    this.criados.Account.push(id);
    const [registro] = await this.comCarimboPendencia(
      await this.consultar(
        accountSchema,
        `SELECT ${accountCampos} FROM Account WHERE Id = ${literal(id)}`,
      ),
    );
    this.fixtures.set(ref, { objeto: 'Account', registro: registro! });
    if (this.inicioServidorMs === null) {
      this.inicioServidorMs = parseSalesforceDateTime(registro!.CreatedDate);
    }
    return id;
  }

  async criarLead(
    ref: string,
    campos: {
      pessoa: Pessoa;
      cpf?: boolean;
      idProspect: string;
      email?: string | null;
      celular?: string | null;
    },
  ): Promise<string> {
    const { pessoa } = campos;
    const resposta = z
      .object({
        compositeResponse: z.array(
          z.object({ body: z.unknown(), httpStatusCode: z.number() }),
        ),
      })
      .parse(
        await this.semRepetir(() => this.restClient.composite([
          {
            method: 'POST',
            url: '/services/data/v61.0/sobjects/Lead',
            referenceId: 'createLead',
            body: {
              Id__c: campos.idProspect,
              LastName: pessoa.nome,
              ...(campos.cpf === false ? {} : { CPF__c: pessoa.cpf }),
              ...(campos.email ? { Email: campos.email } : {}),
              ...(campos.celular
                ? { MobilePhone: campos.celular, CelularSemFormatacao__c: campos.celular }
                : {}),
              RecordTypeId: this.recordTypeLead,
              ManipularFase__c: true,
              Status: LEAD_STATUS_PADRAO,
              Marca__c: LEAD_MARCA_PADRAO,
              PermitirCriarLead__c: true,
            },
          },
        ])),
      );
    const [resultado] = resposta.compositeResponse;
    const corpo = z.object({ id: z.string() }).safeParse(resultado?.body);
    if (!corpo.success) {
      throw new Error(
        `Criação do Lead ${ref} falhou: ${JSON.stringify(resultado?.body).slice(0, 500)}`,
      );
    }
    const id = corpo.data.id;
    this.criados.Lead.push(id);
    const [registro] = await this.consultar(
      leadSchema,
      `SELECT ${leadCampos} FROM Lead WHERE Id = ${literal(id)}`,
    );
    this.fixtures.set(ref, { objeto: 'Lead', registro: registro! });
    return id;
  }

  /** Account e Lead vinculados (`IdProspectSalesforce__c == Lead.Id__c`). */
  async pessoaSincronizada(
    ref: string,
    pessoa: Pessoa,
    contatos: { email: string | null; celular: string | null },
    opcoes: { cpf?: boolean; idCliente?: boolean } = {},
  ): Promise<void> {
    await this.criarAccount(`account${ref}`, {
      pessoa,
      cpf: opcoes.cpf ?? true,
      idCliente: opcoes.idCliente === false ? null : pessoa.idCliente,
      idProspect: pessoa.idProspect,
      email: contatos.email,
      celular: contatos.celular,
    });
    await this.criarLead(`lead${ref}`, {
      pessoa,
      cpf: opcoes.cpf ?? true,
      idProspect: pessoa.idProspect,
      email: contatos.email,
      celular: contatos.celular,
    });
  }

  /** X sincronizado com os contatos A/B (massa-base da maioria dos TCs). */
  async xSincronizado(
    contatos = { email: this.contatos.emailA, celular: this.contatos.celularB },
  ): Promise<void> {
    await this.pessoaSincronizada('X', this.x, contatos);
  }

  fixture(ref: string) {
    const fixture = this.fixtures.get(ref);
    if (fixture === undefined) throw new Error(`Fixture ${ref} inexistente`);
    return fixture.registro;
  }

  private async criarOportunidade(): Promise<void> {
    const contaX = this.fixtures.get('accountX')?.registro.Id;
    if (contaX === undefined) throw new Error('A massa precisa de accountX');
    const resposta = z
      .object({
        compositeResponse: z.array(z.object({ body: z.unknown() })),
      })
      .parse(
        await this.semRepetir(() => this.restClient.composite([
          {
            method: 'POST',
            url: '/services/data/v61.0/sobjects/Opportunity',
            referenceId: 'createOpportunity',
            body: {
              Name: `QA UNIF22 ${this.run}`,
              StageName: 'Simulação',
              CloseDate: '2027-12-31',
              Id__c: this.oportunidadeExterna,
              AccountId: contaX,
            },
          },
        ])),
      );
    const corpo = z
      .object({ id: z.string() })
      .safeParse(resposta.compositeResponse[0]?.body);
    if (!corpo.success) {
      throw new Error(
        `Criação da Opportunity falhou: ${JSON.stringify(resposta.compositeResponse[0]?.body).slice(0, 500)}`,
      );
    }
    this.idOportunidade = corpo.data.id;
    this.criados.Opportunity.push(corpo.data.id);
  }

  private envelope(
    eventType: string,
    rotulo: string,
    eventTime: string,
    data: Record<string, unknown>,
  ): EventGridEnvelope {
    return [
      {
        id: `EVT-${this.run}-${this.eventos.length + 1}-${rotulo}`,
        subject: 'MS_Clientes',
        eventType,
        eventTime,
        dataVersion: '1.0',
        metadataVersion: '1',
        topic: `/qa/unificacao-2.2/${this.tc}/${this.run}`,
        data,
      },
    ] as unknown as EventGridEnvelope;
  }

  private async enviar(
    alvo: 'Cliente' | 'PAC' | 'MaquinaEstado' | 'Pendencia',
    envelope: EventGridEnvelope,
    rotulo: string,
  ): Promise<void> {
    const evento = envelope[0]!;
    const access = await this.acesso();
    const resultado = await dispatchConcurrentRequest(
      access,
      {
        index: this.eventos.length,
        variantKey: 'cliente-update',
        eventType: evento.eventType,
        eventLabel: rotulo,
        envelope,
        payloadSummary: { dataalteracao: evento.eventTime },
      },
      this.timeoutRequisicaoMs,
      alvo,
    );
    this.eventos.push({
      rotulo,
      eventType: evento.eventType,
      eventTime: evento.eventTime,
      httpStatus: resultado.httpStatus,
      ok: resultado.ok,
      resposta: resultado.responseText.slice(0, resultado.ok ? 300 : 1_000),
    });
    // Sem resposta HTTP, o evento pode ou não ter chegado à org: é falha de
    // infraestrutura, e o RUN inteiro é refeito (não se reenvia o evento).
    if (resultado.httpStatus === null) {
      const falha = new FalhaDeRede(rotulo, resultado.transportError ?? 'sem resposta HTTP');
      this.rede.aoFalhar?.(falha.causa);
      throw falha;
    }
    // Runbook §5: HTTP 4xx/5xx é falha no escopo CLI.
    if (!resultado.ok) {
      throw new FalhaDeEvento(
        `${rotulo} respondeu ${resultado.httpStatus ?? resultado.transportError}: ${resultado.responseText.slice(0, 200)}`,
      );
    }
  }

  private pacEnvelope(
    tipo: 'pac-insert' | 'pac-update',
    status: string,
    quando: string,
    proponente: {
      /** `null` omite o campo, como nas PACs em análise do incidente de staging. */
      idCliente: string | null;
      cpf: string;
      nome: string;
      email: string;
      celular: string;
      idProponente: string | null;
    },
  ): EventGridEnvelope {
    return this.envelope(tipo, tipo, quando, {
      id: this.pacExterno,
      idjornadapac: this.oportunidadeExterna,
      status,
      dataalteracao: quando,
      proponentes: [
        {
          id: this.proponenteExterno,
          idPac: this.pacExterno,
          ...(proponente.idCliente === null ? {} : { idCliente: proponente.idCliente }),
          cpf: proponente.cpf,
          tipoClassificacao: 'Principal',
          dataAlteracao: quando,
          nomeCompleto: proponente.nome,
          email: proponente.email,
          telefoneCelular: proponente.celular,
          ...(proponente.idProponente === null
            ? {}
            : { idProponente: proponente.idProponente }),
        },
      ],
    });
  }

  /**
   * Espera os jobs assíncronos do RUN assentarem (Queueable/Future da
   * criação do Lead, callback e reconciliação). A janela começa na criação
   * da primeira fixture, pelo relógio da Salesforce.
   */
  async aguardarJobs(timeoutMs: number): Promise<void> {
    const inicio = Date.now();
    const desde = new Date((this.inicioServidorMs ?? Date.now()) - 5_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const limite = Date.now() + timeoutMs;
    let assentadosSeguidos = 0;
    try {
      await sleep(INTERVALO_JOBS_MS);
      while (Date.now() < limite) {
        const pendentes = await this.consultar(
          jobSchema,
          `SELECT Status, NumberOfErrors, ExtendedStatus, JobType, ApexClass.Name FROM AsyncApexJob WHERE CreatedDate >= ${desde}${this.filtroJobsDoUsuario} AND JobType IN ('Queueable', 'Future') AND Status IN ('Queued', 'Preparing', 'Processing', 'Holding')`,
        );
        assentadosSeguidos = pendentes.length === 0 ? assentadosSeguidos + 1 : 0;
        if (assentadosSeguidos >= LEITURAS_VAZIAS_JOBS) return;
        await sleep(INTERVALO_JOBS_MS);
      }
    } finally {
      this.tempos.esperaJobsMs += Date.now() - inicio;
    }
  }

  /** Estado atual de tudo que o RUN pode ter criado ou tocado. */
  async snapshot(): Promise<Snapshot> {
    const pessoas = [this.x, this.y, this.z, ...this.extras.values()];
    const cpfs = pessoas.map(({ cpf }) => cpf);
    const idClientes = pessoas.flatMap(({ idCliente }) => [
      idCliente,
      idCliente.toUpperCase(),
      idCliente.toLowerCase(),
    ]);
    const prospects = pessoas.map(({ idProspect }) => idProspect);
    const emails = [this.contatos.emailA, this.contatos.emailC, this.contatos.emailE];
    const celulares = [
      this.contatos.celularB,
      this.contatos.celularD,
      this.contatos.celularF,
      this.contatos.celularG,
    ];
    const idsContas = this.criados.Account.length
      ? ` OR Id IN (${lista(this.criados.Account)})`
      : '';
    const idsLeads = this.criados.Lead.length
      ? ` OR Id IN (${lista(this.criados.Lead)})`
      : '';
    // Duas etapas em paralelo: os Leads e o carimbo dependem das Accounts.
    const [contas, [oportunidade], [pac], [proponente]] = await Promise.all([
      this.consultar(
        accountSchema,
        `SELECT ${accountCampos} FROM Account WHERE CPF__pc IN (${lista(cpfs)}) OR Id__c IN (${lista(idClientes)}) OR IdProspectSalesforce__c IN (${lista(prospects)})${idsContas} ORDER BY CreatedDate`,
      ),
      this.consultar(
        oportunidadeSchema,
        `SELECT Id, AccountId, StageName FROM Opportunity WHERE Id__c = ${literal(this.oportunidadeExterna)}`,
      ),
      this.consultar(
        pacSchema,
        `SELECT Id, Status__c, DataAlteracaoEvento__c FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(this.pacExterno)}`,
      ),
      this.consultar(
        proponenteSchema,
        `SELECT Id, Proponente__c, IdCliente__c, IdProponente__c, CpfProponente__c, TipoClassificacao__c, EmailAtualizado__c, EnviarNotificacaoPendencia__c FROM Proponente__c WHERE Id__c = ${literal(this.proponenteExterno)}`,
      ),
    ]);
    const prospectsAtuais = contas.flatMap(({ IdProspectSalesforce__c }) =>
      IdProspectSalesforce__c ? [IdProspectSalesforce__c] : [],
    );
    const [accounts, leads] = await Promise.all([
      this.comCarimboPendencia(contas),
      this.consultar(
        leadSchema,
        `SELECT ${leadCampos} FROM Lead WHERE CPF__c IN (${lista(cpfs)}) OR Id__c IN (${lista([...prospects, ...prospectsAtuais])}) OR Email IN (${lista(emails)}) OR CelularSemFormatacao__c IN (${lista(celulares)})${idsLeads} ORDER BY CreatedDate`,
      ),
    ]);
    return {
      accounts,
      leads,
      oportunidade: oportunidade ?? null,
      pac: pac ?? null,
      proponente: proponente ?? null,
    };
  }

  /**
   * IdProspect da Account aprovada, com a mesma regra de `contaDaPessoa`
   * (IdCliente em qualquer caixa, senão CPF), sem um snapshot completo.
   */
  private async prospectDaContaAprovada(
    pessoa: Pessoa,
    idClienteEvento: string,
  ): Promise<string | null> {
    const idClientes = [pessoa.idCliente, idClienteEvento].flatMap((idCliente) => [
      idCliente,
      idCliente.toUpperCase(),
      idCliente.toLowerCase(),
    ]);
    const contas = await this.consultar(
      accountSchema,
      `SELECT ${accountCampos} FROM Account WHERE Id__c IN (${lista(idClientes)}) OR CPF__pc = ${literal(pessoa.cpf)} ORDER BY CreatedDate`,
    );
    const estado: Snapshot = { accounts: contas, leads: [], oportunidade: null, pac: null, proponente: null };
    return contaDaPessoa(estado, pessoa, idClienteEvento)?.IdProspectSalesforce__c ?? null;
  }

  /** Opportunity da jornada em X e PAC/Proponente de X antes da cadeia (runbook, TC-001). */
  private async iniciarJornada(prospectJornada: string | null): Promise<void> {
    await this.criarOportunidade();
    await this.enviar(
      'PAC',
      this.pacEnvelope('pac-insert', 'EM_ANALISE_CREDITO', this.t(-60), {
        idCliente: this.x.idCliente,
        cpf: this.x.cpf,
        nome: this.x.nome,
        email: this.contatos.emailA,
        celular: this.contatos.celularB,
        idProponente: prospectJornada,
      }),
      'pac-insert-x',
    );
  }

  /** `pac-update` EM_ANALISE_CREDITO do Proponente principal, com o prospect da jornada. */
  private async enviarPacEmAnalise(
    rotulo: string,
    segundos: number,
    proponente: { idCliente: string | null; pessoa: Pessoa; email: string; celular: string },
    idProponente: string | null,
  ): Promise<void> {
    await this.enviar(
      'PAC',
      this.pacEnvelope('pac-update', 'EM_ANALISE_CREDITO', this.t(segundos), {
        idCliente: proponente.idCliente,
        cpf: proponente.pessoa.cpf,
        nome: proponente.pessoa.nome,
        email: proponente.email,
        celular: proponente.celular,
        idProponente,
      }),
      rotulo,
    );
  }

  /**
   * `notificacaopendencia-insert` (endpoint `/Pendencia`) do Proponente
   * principal, no formato do log de staging `a0dHZ00000NAQVTYA5`. Liga
   * `EnviarNotificacaoPendencia__c`; o mapeamento não grava o e-mail.
   */
  private async enviarPendencia(rotulo: string, segundos: number, pessoa: Pessoa, email: string): Promise<void> {
    await this.enviar(
      'Pendencia',
      this.envelope('notificacaopendencia-insert', rotulo, this.t(segundos), {
        idPac: this.pacExterno,
        idJornada: this.oportunidadeExterna,
        replyTo: this.emailExtra('replyto'),
        descricaoCentral: 'QA UNIF22 CENTRAL',
        proponente: {
          id: this.proponenteExterno,
          idProponente: this.x.idProspect,
          nome: pessoa.nome,
          email,
          textoPendencias: `QA UNIF22 pendencia sintetica ${this.run}`,
          textoPendenciasSemDescricao: 'QA UNIF22 pendencia sintetica',
        },
        idProcessoProduto: '1000001',
        tipoNotificacao: 'DESLIGAMENTO',
      }),
      rotulo,
    );
  }

  /**
   * Contestação pendente na PAC da jornada, pelo mesmo caminho do
   * test-data-adapter. O after insert chama um `@future` com callout para
   * `Endpoints__c.ContestacaoInsert__c` (na dev, o simulador): confira o
   * endpoint antes de rodar. O cleanup apaga a contestação (lookup SetNull).
   */
  private async abrirContestacao(): Promise<string> {
    const [pac] = await this.consultar(
      idSchema,
      `SELECT Id FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(this.pacExterno)}`,
    );
    if (pac === undefined) throw new Error('PAC da jornada não encontrada para abrir a contestação.');
    const resposta = z
      .object({ compositeResponse: z.array(z.object({ body: z.unknown() })) })
      .parse(
        await this.semRepetir(() => this.restClient.composite([
          {
            method: 'POST',
            url: '/services/data/v61.0/sobjects/Contestacao__c',
            referenceId: 'createContestacao',
            body: { Id__c: `CONT-QA-UNIF22-${this.run}`, PAC__c: pac.Id },
          },
        ])),
      );
    const corpo = z.object({ id: z.string() }).safeParse(resposta.compositeResponse[0]?.body);
    if (!corpo.success) {
      throw new Error(
        `Criação da contestação falhou: ${JSON.stringify(resposta.compositeResponse[0]?.body).slice(0, 500)}`,
      );
    }
    this.criados.Contestacao__c.push(corpo.data.id);
    return corpo.data.id;
  }

  /** Contestações pendentes (`Solucionada__c = false`) na PAC da jornada. */
  private async contestacoesPendentes(): Promise<number> {
    const [pac] = await this.consultar(
      idSchema,
      `SELECT Id FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(this.pacExterno)}`,
    );
    if (pac === undefined) return 0;
    return (
      await this.consultar(
        idSchema,
        `SELECT Id FROM Contestacao__c WHERE PAC__c = ${literal(pac.Id)} AND Solucionada__c = false`,
      )
    ).length;
  }

  /**
   * Perfis C1 a C4, antes dos eventos de cliente: duas PACs em análise com os
   * dados da pessoa aprovada (C1 sem IdCliente; C2 a C4 com o IdCliente da
   * jornada) e, conforme o perfil, uma pendência antes (C3) ou uma contestação
   * pendente (C4). A pendência de C1 e C2 vem depois dos parciais.
   */
  private async prepararCaminhoIdentidade(
    aprovacao: Aprovacao,
    prospectJornada: string | null,
    timeoutJobsMs: number,
  ): Promise<EvidenciaIdentidade> {
    let contestacoesAntes: number | null = null;
    if (this.perfil === 'C3') {
      // O Proponente ainda é de X: a sincronização só regrava o e-mail de X e
      // grava o carimbo, o que é legítimo. Daqui em diante X não pode mudar.
      await this.enviarPendencia('notificacaopendencia-antes', -55, this.x, this.contatos.emailA);
      if (this.fixtures.has('accountX')) await this.reancorarFixture('accountX');
    }
    if (this.perfil === 'C4') {
      await this.abrirContestacao();
      await this.aguardarJobs(timeoutJobsMs);
      contestacoesAntes = await this.contestacoesPendentes();
    }
    const proponente = {
      idCliente: this.perfil === 'C1' ? null : this.x.idCliente,
      pessoa: aprovacao.pessoa,
      email: aprovacao.email,
      celular: aprovacao.celular,
    };
    await this.enviarPacEmAnalise('pac-analise-1', -50, proponente, prospectJornada);
    await this.enviarPacEmAnalise('pac-analise-2', -45, proponente, prospectJornada);
    return { precondicao: await this.snapshot(), contestacoesAntes };
  }

  /**
   * Executa a cadeia 2.2 no perfil do RUN (runbook §4.1.1) e devolve o
   * snapshot intermediário (depois dos parciais, só no PA) e o final.
   */
  async executarCadeia(
    aprovacao: Aprovacao,
    timeoutJobsMs: number,
  ): Promise<{
    intermediario: Snapshot | null;
    final: Snapshot;
    prospectY: string | null;
    evidencia: EvidenciaIdentidade | null;
  }> {
    const pessoa = aprovacao.pessoa;
    const idClienteEvento = aprovacao.idClienteEvento ?? pessoa.idCliente;
    const prospectJornada =
      aprovacao.prospectDaJornada === undefined
        ? this.x.idProspect
        : aprovacao.prospectDaJornada;

    await this.iniciarJornada(prospectJornada);
    const evidencia = ehPerfilIdentidade(this.perfil)
      ? await this.prepararCaminhoIdentidade(aprovacao, prospectJornada, timeoutJobsMs)
      : null;
    // Os perfis de identidade usam a ordem do CA nos eventos de cliente.
    const ordem = ehPerfilIdentidade(this.perfil) ? 'CA' : this.perfil;

    const cliente = (quando: string) =>
      this.envelope(aprovacao.tipoEventoCliente, 'cliente', quando, {
        idcliente: idClienteEvento,
        ...(prospectJornada === null ? {} : { idprospectsalesforce: prospectJornada }),
        numerocpf: pessoa.cpf,
        nomecompleto: pessoa.nome,
        dataalteracao: quando,
      });
    const sufixoParcial = aprovacao.match ? 'update' : 'insert';
    const contato = (tipo: 'Email' | 'Celular', quando: string) =>
      this.envelope(`contato-${sufixoParcial}`, `contato-${tipo}`, quando, {
        idcliente: idClienteEvento,
        ...(prospectJornada === null ? {} : { idprospectsalesforce: prospectJornada }),
        tipocontato: tipo,
        descricao: tipo === 'Email' ? aprovacao.email : aprovacao.celular,
        dataalteracao: quando,
      });
    const endereco = (quando: string) =>
      this.envelope(`endereco-${sufixoParcial}`, 'endereco', quando, {
        idcliente: idClienteEvento,
        ...(prospectJornada === null ? {} : { idprospectsalesforce: prospectJornada }),
        tipoendereco: 'COBRANCA',
        logradouro: `Rua QA UNIF22 ${this.run}`,
        numero: '100',
        bairro: 'Centro',
        numerocep: '30110000',
        dataalteracao: quando,
      });

    let intermediario: Snapshot | null = null;
    if (ordem === 'PA') {
      // Parciais com timestamp anterior ao cliente (runbook §5).
      await this.enviar('Cliente', contato('Email', this.t(0)), 'contato-email');
      await this.enviar('Cliente', contato('Celular', this.t(0)), 'contato-celular');
      await this.enviar('Cliente', endereco(this.t(0)), 'endereco');
      await sleep(2_000);
      intermediario = await this.snapshot();
      await this.enviar('Cliente', cliente(this.t(5)), aprovacao.tipoEventoCliente);
    } else if (ordem === 'CA') {
      // Cliente primeiro; parciais durante o Queueable.
      await this.enviar('Cliente', cliente(this.t(0)), aprovacao.tipoEventoCliente);
      await this.enviar('Cliente', contato('Email', this.t(5)), 'contato-email');
      await this.enviar('Cliente', contato('Celular', this.t(5)), 'contato-celular');
      await this.enviar('Cliente', endereco(this.t(5)), 'endereco');
    } else {
      // Mesmo EventTime, ordem física alternada (catálogo O03, 2ª permutação).
      const mesmo = this.t(0);
      await this.enviar('Cliente', contato('Email', mesmo), 'contato-email');
      await this.enviar('Cliente', cliente(mesmo), aprovacao.tipoEventoCliente);
      await this.enviar('Cliente', endereco(mesmo), 'endereco');
      await this.enviar('Cliente', contato('Celular', mesmo), 'contato-celular');
    }
    if (this.perfil === 'C1' || this.perfil === 'C2') {
      // Como em staging: a pendência chega depois dos eventos de cliente e
      // antes de a PAC aprovada levar o Proponente para a Account aprovada.
      await this.enviarPendencia('notificacaopendencia', 10, pessoa, aprovacao.email);
    }

    await this.aguardarJobs(timeoutJobsMs);

    // PROS-Y é sempre lido na Account resultante (runbook §4.6.2).
    const prospectY = await this.prospectDaContaAprovada(pessoa, idClienteEvento);

    await this.enviar(
      'Cliente',
      this.envelope('cliente-update', 'cliente-update-retorno', this.t(20), {
        idcliente: idClienteEvento,
        ...(prospectY === null ? {} : { idprospectsalesforce: prospectY }),
        numerocpf: pessoa.cpf,
        nomecompleto: pessoa.nome,
        dataalteracao: this.t(20),
      }),
      'cliente-update-retorno',
    );
    // pac-update mantém o prospect original no Proponente (runbook §4.6.4).
    await this.enviar(
      'PAC',
      this.pacEnvelope('pac-update', 'CREDITO_APROVADO_CONDICIONADO', this.t(25), {
        idCliente: idClienteEvento,
        cpf: pessoa.cpf,
        nome: pessoa.nome,
        email: aprovacao.email,
        celular: aprovacao.celular,
        idProponente: prospectJornada,
      }),
      'pac-update',
    );
    await this.enviar(
      'MaquinaEstado',
      this.envelope('jornadausuario-update', 'maquina', this.t(30), {
        cliente: {
          idCliente: idClienteEvento,
          idProspectSalesforce: prospectY ?? prospectJornada ?? pessoa.idProspect,
        },
        id: this.oportunidadeExterna,
        dataalteracao: this.t(30),
        estado: 'Documentacao',
        idunidade: PRODUTO_UNIDADE_ATIVA,
      }),
      'jornadausuario-update',
    );
    await this.aguardarJobs(timeoutJobsMs);
    this.cadeiaConcluida = true;
    return { intermediario, final: await this.snapshot(), prospectY, evidencia };
  }

  /** Jobs com erro e logs `error` na janela do RUN (runbook §4.6.5). */
  async errosCorrelacionados(final: Snapshot): Promise<{
    jobs: Array<Record<string, unknown>>;
    logs: Array<Record<string, unknown>>;
  }> {
    const desde = new Date((this.inicioServidorMs ?? Date.now()) - 5_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const jobs = (
      await this.consultar(
        jobSchema,
        `SELECT Status, NumberOfErrors, ExtendedStatus, JobType, ApexClass.Name FROM AsyncApexJob WHERE CreatedDate >= ${desde}${this.filtroJobsDoUsuario} AND JobType IN ('Queueable', 'Future')`,
      )
    )
      .filter(
        (job) => (job.NumberOfErrors ?? 0) > 0 || job.Status === 'Failed',
      )
      .map((job) => ({
        classe: job.ApexClass?.Name ?? null,
        status: job.Status,
        erros: job.NumberOfErrors,
        detalhe: job.ExtendedStatus?.slice(0, 200) ?? null,
      }));
    const contas = final.accounts.map(({ Id }) => Id);
    const idClientes = final.accounts.flatMap(({ Id__c }) => (Id__c ? [Id__c] : []));
    const filtros = [
      contas.length ? `Cliente__c IN (${lista(contas)})` : null,
      idClientes.length ? `idObjeto__c IN (${lista(idClientes)})` : null,
    ].filter((filtro) => filtro !== null);
    const logs =
      filtros.length === 0
        ? []
        : (
            await this.consultar(
              logSchema,
              `SELECT Id, EventType__c, Status2__c FROM LogIntegracao__c WHERE CreatedDate >= ${desde} AND (${filtros.join(' OR ')})`,
            )
          )
            .filter(({ Status2__c }) => Status2__c?.toLowerCase() === 'error')
            .map(({ Id, EventType__c, Status2__c }) => ({
              Id,
              eventType: EventType__c,
              status: Status2__c,
            }));
    return { jobs, logs };
  }

  /** Exclusão com retentativa; um 404 depois de uma queda é a exclusão anterior que chegou à org. */
  private async apagarRegistro(
    objeto: 'Contestacao__c' | 'Proponente__c' | 'PropostaAnaliseCredito__c' | 'Opportunity' | 'Lead' | 'Account',
    id: string,
  ): Promise<void> {
    let houveQueda = false;
    await this.comRede(async () => {
      try {
        await this.restClient.deleteRecord(objeto, id);
      } catch (error) {
        if (houveQueda && error instanceof SalesforceRestError && error.status === 404) return;
        if (ehFalhaDeRede(error)) houveQueda = true;
        throw error;
      }
    });
  }

  /**
   * Runbook §6.5: apaga só o que o RUN criou — as fixtures (allowlist) e o
   * que o Apex criou para as chaves sintéticas do RUN, sempre com
   * `CreatedDate` a partir da primeira fixture. Dependências primeiro e, por
   * último, Lead e Account (em paralelo); continua após erro e confere o resíduo.
   * Sem a descoberta, o resíduo fica `null` (não verificado), e não 0.
   */
  async limpar(timeoutJobsMs = 90_000): Promise<NonNullable<ResultadoRun['cleanup']>> {
    const erros: string[] = [];
    const apagados: Record<string, string[]> = {};
    const desde = this.inicioServidorMs;
    const criadoNoRun = (registro: { CreatedDate?: unknown }) =>
      desde !== null &&
      typeof registro.CreatedDate === 'string' &&
      parseSalesforceDateTime(registro.CreatedDate) >= desde - 1_000;

    // Cadeia interrompida: os jobs dos eventos já enviados ainda podem criar
    // registros (Lead/Account de Y), e a descoberta precisa vir depois deles.
    if (this.eventos.length > 0 && !this.cadeiaConcluida) {
      try {
        await this.aguardarJobs(timeoutJobsMs);
      } catch (error) {
        erros.push(`espera de jobs antes da limpeza: ${mensagem(error)}`);
      }
    }

    // Contestacao__c.PAC__c é lookup SetNull: apagar a PAC não leva a contestação junto.
    let alvo: Record<string, string[]> = {
      Contestacao__c: [...this.criados.Contestacao__c],
      Proponente__c: [],
      PropostaAnaliseCredito__c: [],
      Opportunity: [...this.criados.Opportunity],
      Lead: [...this.criados.Lead],
      Account: [...this.criados.Account],
    };
    let descobriu = false;
    try {
      // Snapshot próprio, e não o final: um job tardio pode ter criado registro depois dele.
      const [estado, pacs] = await Promise.all([
        this.snapshot(),
        this.consultar(
          z.object({ Id: z.string(), CreatedDate: z.string() }).passthrough(),
          `SELECT Id, CreatedDate FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(this.pacExterno)}`,
        ),
      ]);
      const idsPac = pacs.filter(criadoNoRun).map(({ Id }) => Id);
      const proponentes = await this.consultar(
        z.object({ Id: z.string(), CreatedDate: z.string() }).passthrough(),
        `SELECT Id, CreatedDate FROM Proponente__c WHERE Id__c = ${literal(this.proponenteExterno)}${idsPac.length ? ` OR PropostaAnaliseCredito__c IN (${lista(idsPac)})` : ''}`,
      );
      alvo = {
        Contestacao__c: [...this.criados.Contestacao__c],
        Proponente__c: proponentes.filter(criadoNoRun).map(({ Id }) => Id),
        PropostaAnaliseCredito__c: idsPac,
        Opportunity: [...this.criados.Opportunity],
        Lead: [
          ...new Set([
            ...this.criados.Lead,
            ...estado.leads.filter(criadoNoRun).map(({ Id }) => Id),
          ]),
        ],
        Account: [
          ...new Set([
            ...this.criados.Account,
            ...estado.accounts.filter(criadoNoRun).map(({ Id }) => Id),
          ]),
        ],
      };
      descobriu = true;
    } catch (error) {
      // Segue apagando o que o RUN conhece; o resto fica sem verificação.
      erros.push(`descoberta: ${mensagem(error)}`);
    }

    const ordem = [
      'Contestacao__c',
      'Proponente__c',
      'PropostaAnaliseCredito__c',
      'Opportunity',
      'Lead',
      'Account',
    ] as const;
    for (const objeto of ordem) apagados[objeto] = [];
    const apagar = async (objeto: (typeof ordem)[number], id: string) => {
      try {
        await this.apagarRegistro(objeto, id);
        apagados[objeto]!.push(id);
      } catch (error) {
        erros.push(`${objeto} ${id}: ${mensagem(error)}`);
      }
    };
    const emParalelo = (objeto: (typeof ordem)[number]) =>
      (alvo[objeto] ?? []).map((id) => () => apagar(objeto, id));
    // Etapas na ordem das dependências: filhos da PAC, PAC, Opportunity e, por
    // último, Lead e Account, que não têm vínculo físico entre si. Proponentes
    // saem um a um: cada exclusão recalcula o resumo da PAC e trava a linha dela.
    await emEtapas([
      [
        ...emParalelo('Contestacao__c'),
        async () => {
          for (const id of alvo.Proponente__c ?? []) await apagar('Proponente__c', id);
        },
      ],
      emParalelo('PropostaAnaliseCredito__c'),
      emParalelo('Opportunity'),
      [...emParalelo('Lead'), ...emParalelo('Account')],
    ]);

    let restantes: number | null = null;
    if (!descobriu) {
      // Contar só os ids conhecidos daria 0 com Y e a PAC do Apex ainda na org.
      erros.push(
        'resíduo não verificado: sem a descoberta, o que o Apex criou para o RUN não foi procurado',
      );
      return { apagados, restantes, erros };
    }
    try {
      const contagens = await Promise.all(
        Object.entries(alvo)
          .filter(([, ids]) => ids.length > 0)
          .map(
            async ([objeto, ids]) =>
              (await this.consultar(idSchema, `SELECT Id FROM ${objeto} WHERE Id IN (${lista(ids)})`))
                .length,
          ),
      );
      restantes = contagens.reduce((soma, quantidade) => soma + quantidade, 0);
    } catch (error) {
      restantes = null;
      erros.push(`verificação de resíduo: ${mensagem(error)}`);
    }
    return { apagados, restantes, erros };
  }
}

/** A Account da pessoa aprovada: por IdCliente (qualquer caixa) ou, sem ele, por CPF. */
export function contaDaPessoa(
  estado: Snapshot,
  pessoa: Pessoa,
  idClienteEvento = pessoa.idCliente,
): AccountRegistro | undefined {
  const alvos = new Set([
    pessoa.idCliente.toLowerCase(),
    idClienteEvento.toLowerCase(),
  ]);
  return (
    estado.accounts.find(({ Id__c }) => alvos.has((Id__c ?? '').toLowerCase())) ??
    estado.accounts.find(({ CPF__pc }) => CPF__pc === pessoa.cpf)
  );
}

/** Campos que identificam o estado de cada registro, sem o resto do payload. */
export function resumirEstado(estado: Snapshot) {
  return {
    accounts: estado.accounts.map((conta) => ({
      Id: conta.Id,
      Id__c: conta.Id__c ?? null,
      IdProspectSalesforce__c: conta.IdProspectSalesforce__c ?? null,
      CPF__pc: conta.CPF__pc ?? null,
      PersonEmail: conta.PersonEmail ?? null,
      Celular__c: conta.Celular__c ?? null,
      DataAlteracaoEventoContatoEmail__c: conta.DataAlteracaoEventoContatoEmail__c ?? null,
      DataAlteracaoEventoContatoCelular__c: conta.DataAlteracaoEventoContatoCelular__c ?? null,
      ContatoDataHoraAtualizacaoEmailPendencia: conta.ContatoDataHoraAtualizacaoEmailPendencia ?? null,
    })),
    leads: estado.leads.map((lead) => ({
      Id: lead.Id,
      Id__c: lead.Id__c ?? null,
      CPF__c: lead.CPF__c ?? null,
      Email: lead.Email ?? null,
      Celular: lead.CelularSemFormatacao__c ?? lead.MobilePhone ?? null,
      DescricaoOrigem__c: lead.DescricaoOrigem__c ?? null,
    })),
    oportunidadeAccountId: estado.oportunidade?.AccountId ?? null,
    pacStatus: estado.pac?.Status__c ?? null,
    proponente: estado.proponente
      ? {
          Proponente__c: estado.proponente.Proponente__c ?? null,
          IdProponente__c: estado.proponente.IdProponente__c ?? null,
          EnviarNotificacaoPendencia__c: estado.proponente.EnviarNotificacaoPendencia__c ?? null,
        }
      : null,
  };
}

export function logRun(resultado: ResultadoRun): void {
  logStructured('runbook-run', resultado as unknown as Record<string, unknown>);
}

export { FalhaDeEvento, mensagem };
