import { randomInt, randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { EventGridEnvelope } from '../../src/contracts/event-grid.ts';
import {
  asAllowlistedQuery,
  getLeadGestaoVendasRecordTypeId,
  getPersonAccountRecordTypeId,
} from '../../src/salesforce/rest-client.ts';
import { generateSyntheticCpf } from '../../src/synthetic/cpf.ts';
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

export type Perfil = 'PA' | 'CA' | 'ME';
export const PERFIS: readonly Perfil[] = ['PA', 'CA', 'ME'];
export const NOMES_PERFIS: Record<Perfil, string> = {
  PA: 'ORDEM-PARCIAIS-ANTES',
  CA: 'ORDEM-CLIENTE-ANTES',
  ME: 'ORDEM-MESMO-EVENTTIME',
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
    restantes: number | null;
    erros: string[];
  } | null;
};

const PRODUTO_UNIDADE_ATIVA = '37dd20e6-4b3c-ea11-801d-005056856875';
const LEAD_STATUS_PADRAO = 'Pendente de Distribuição';
const LEAD_MARCA_PADRAO = '1';

const accountCampos =
  'Id, Id__c, IdProspectSalesforce__c, CPF__pc, FirstName, LastName, PersonEmail, Celular__c, DataAlteracaoEvento__c, CreatedDate, LastModifiedDate';
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
    CreatedDate: z.string(),
    LastModifiedDate: z.string(),
  })
  .passthrough();
export type AccountRegistro = z.infer<typeof accountSchema>;

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
  .object({ Id: z.string(), Status__c: texto })
  .passthrough();
const proponenteSchema = z
  .object({
    Id: z.string(),
    Proponente__c: texto,
    IdCliente__c: texto,
    IdProponente__c: texto,
    CpfProponente__c: texto,
    TipoClassificacao__c: texto,
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
  readonly criados: Record<'Account' | 'Lead' | 'Opportunity', string[]> = {
    Account: [],
    Lead: [],
    Opportunity: [],
  };
  readonly eventos: ResultadoRun['eventos'] = [];
  readonly tMassa: string;
  private readonly t0: number;
  private recordTypeConta = '';
  private recordTypeLead = '';
  private idOportunidade: string | null = null;
  private inicioServidorMs: number | null = null;

  constructor(
    readonly conexao: TargetOrgConnection,
    readonly tc: string,
    readonly perfil: Perfil,
    private readonly timeoutRequisicaoMs: number,
  ) {
    const numero = tc.replace(/\D/g, '').padStart(3, '0');
    const sufixo = randomUUID().replace(/-/g, '').slice(0, 6);
    this.run = `TC${numero}-${perfil}-${sufixo}`;
    const rrrr = String(randomInt(0, 10_000)).padStart(4, '0');
    const email = (letra: string) =>
      `qa.unif22.tc${numero}.${letra}.${this.run.toLowerCase()}@example.com`;
    this.contatos = {
      emailA: email('a'),
      emailC: email('c'),
      emailE: email('e'),
      celularB: `3198${numero}${rrrr}`,
      celularD: `3197${numero}${rrrr}`,
      celularF: `3196${numero}${rrrr}`,
      celularG: `3195${numero}${rrrr}`,
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

  private async consultar<T extends z.ZodTypeAny>(
    schema: T,
    soql: string,
  ): Promise<z.infer<T>[]> {
    return registros(schema).parse(
      await this.restClient.query<unknown>(asAllowlistedQuery(soql)),
    ).records;
  }

  async preparar(): Promise<void> {
    this.recordTypeConta = await getPersonAccountRecordTypeId(this.restClient);
    this.recordTypeLead = await getLeadGestaoVendasRecordTypeId(this.restClient);
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
    const contas = await this.consultar(
      idSchema,
      `SELECT Id FROM Account WHERE CPF__pc IN (${lista(cpfs)}) OR Id__c IN (${lista(idClientes)}) OR IdProspectSalesforce__c IN (${lista(prospects)}) OR PersonEmail IN (${lista(emails)}) OR Celular__c IN (${lista(celulares)})`,
    );
    const leads = await this.consultar(
      idSchema,
      `SELECT Id FROM Lead WHERE CPF__c IN (${lista(cpfs)}) OR Id__c IN (${lista(prospects)}) OR Email IN (${lista(emails)}) OR CelularSemFormatacao__c IN (${lista(celulares)})`,
    );
    if (contas.length > 0 || leads.length > 0) {
      throw new Error(
        `Precheck: chaves sintéticas já existem na org (${contas.length} Account, ${leads.length} Lead).`,
      );
    }
  }

  private async post(objeto: 'Account', corpo: Record<string, unknown>) {
    // POST direto: o catálogo de operações do rest client não cria Account
    // sem prospect nem com contatos. O guard valida a org logo antes.
    const access = await this.conexao.safetyGuard.validate();
    const resposta = await fetch(
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
    const access = await this.conexao.safetyGuard.validate();
    const resposta = await fetch(
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

  private async recarregarFixture(ref: string): Promise<void> {
    const fixture = this.fixtures.get(ref)!;
    if (fixture.objeto === 'Account') {
      const [registro] = await this.consultar(
        accountSchema,
        `SELECT ${accountCampos} FROM Account WHERE Id = ${literal(fixture.registro.Id)}`,
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
    const [registro] = await this.consultar(
      accountSchema,
      `SELECT ${accountCampos} FROM Account WHERE Id = ${literal(id)}`,
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
        await this.restClient.composite([
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
        ]),
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
        await this.restClient.composite([
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
        ]),
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
    alvo: 'Cliente' | 'PAC' | 'MaquinaEstado',
    envelope: EventGridEnvelope,
    rotulo: string,
  ): Promise<void> {
    const evento = envelope[0]!;
    const access = await this.conexao.safetyGuard.validate();
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
      idCliente: string;
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
          idCliente: proponente.idCliente,
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
    const desde = new Date((this.inicioServidorMs ?? Date.now()) - 5_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const limite = Date.now() + timeoutMs;
    let assentadosSeguidos = 0;
    await sleep(3_000);
    while (Date.now() < limite) {
      const pendentes = await this.consultar(
        jobSchema,
        `SELECT Status, NumberOfErrors, ExtendedStatus, JobType, ApexClass.Name FROM AsyncApexJob WHERE CreatedDate >= ${desde} AND JobType IN ('Queueable', 'Future') AND Status IN ('Queued', 'Preparing', 'Processing', 'Holding')`,
      );
      assentadosSeguidos = pendentes.length === 0 ? assentadosSeguidos + 1 : 0;
      if (assentadosSeguidos >= 2) return;
      await sleep(3_000);
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
    const accounts = await this.consultar(
      accountSchema,
      `SELECT ${accountCampos} FROM Account WHERE CPF__pc IN (${lista(cpfs)}) OR Id__c IN (${lista(idClientes)}) OR IdProspectSalesforce__c IN (${lista(prospects)})${idsContas} ORDER BY CreatedDate`,
    );
    const prospectsAtuais = accounts.flatMap(({ IdProspectSalesforce__c }) =>
      IdProspectSalesforce__c ? [IdProspectSalesforce__c] : [],
    );
    const leads = await this.consultar(
      leadSchema,
      `SELECT ${leadCampos} FROM Lead WHERE CPF__c IN (${lista(cpfs)}) OR Id__c IN (${lista([...prospects, ...prospectsAtuais])}) OR Email IN (${lista(emails)}) OR CelularSemFormatacao__c IN (${lista(celulares)})${idsLeads} ORDER BY CreatedDate`,
    );
    const [oportunidade] = await this.consultar(
      oportunidadeSchema,
      `SELECT Id, AccountId, StageName FROM Opportunity WHERE Id__c = ${literal(this.oportunidadeExterna)}`,
    );
    const [pac] = await this.consultar(
      pacSchema,
      `SELECT Id, Status__c FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(this.pacExterno)}`,
    );
    const [proponente] = await this.consultar(
      proponenteSchema,
      `SELECT Id, Proponente__c, IdCliente__c, IdProponente__c, CpfProponente__c, TipoClassificacao__c FROM Proponente__c WHERE Id__c = ${literal(this.proponenteExterno)}`,
    );
    return {
      accounts,
      leads,
      oportunidade: oportunidade ?? null,
      pac: pac ?? null,
      proponente: proponente ?? null,
    };
  }

  /**
   * Executa a cadeia 2.2 no perfil do RUN (runbook §4.1.1) e devolve o
   * snapshot intermediário (depois dos parciais, só no PA) e o final.
   */
  async executarCadeia(
    aprovacao: Aprovacao,
    timeoutJobsMs: number,
  ): Promise<{ intermediario: Snapshot | null; final: Snapshot; prospectY: string | null }> {
    await this.criarOportunidade();
    const pessoa = aprovacao.pessoa;
    const idClienteEvento = aprovacao.idClienteEvento ?? pessoa.idCliente;
    const prospectJornada =
      aprovacao.prospectDaJornada === undefined
        ? this.x.idProspect
        : aprovacao.prospectDaJornada;

    // PAC/Proponente de X antes da cadeia (runbook, TC-001).
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
    if (this.perfil === 'PA') {
      // Parciais com timestamp anterior ao cliente (runbook §5).
      await this.enviar('Cliente', contato('Email', this.t(0)), 'contato-email');
      await this.enviar('Cliente', contato('Celular', this.t(0)), 'contato-celular');
      await this.enviar('Cliente', endereco(this.t(0)), 'endereco');
      await sleep(2_000);
      intermediario = await this.snapshot();
      await this.enviar('Cliente', cliente(this.t(5)), aprovacao.tipoEventoCliente);
    } else if (this.perfil === 'CA') {
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

    await this.aguardarJobs(timeoutJobsMs);

    // PROS-Y é sempre lido na Account resultante (runbook §4.6.2).
    const aposCliente = await this.snapshot();
    const contaAprovada = contaDaPessoa(aposCliente, pessoa, idClienteEvento);
    const prospectY = contaAprovada?.IdProspectSalesforce__c ?? null;

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
    return { intermediario, final: await this.snapshot(), prospectY };
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
        `SELECT Status, NumberOfErrors, ExtendedStatus, JobType, ApexClass.Name FROM AsyncApexJob WHERE CreatedDate >= ${desde} AND JobType IN ('Queueable', 'Future')`,
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

  /**
   * Runbook §6.5: apaga só o que o RUN criou — as fixtures (allowlist) e o
   * que o Apex criou para as chaves sintéticas do RUN, sempre com
   * `CreatedDate` a partir da primeira fixture. Dependências primeiro, depois
   * Lead e por último Account; continua após erro e confere o resíduo.
   */
  async limpar(): Promise<NonNullable<ResultadoRun['cleanup']>> {
    const erros: string[] = [];
    const apagados: Record<string, string[]> = {};
    const desde = this.inicioServidorMs;
    const criadoNoRun = (registro: { CreatedDate?: unknown }) =>
      desde !== null &&
      typeof registro.CreatedDate === 'string' &&
      parseSalesforceDateTime(registro.CreatedDate) >= desde - 1_000;

    let alvo: Record<string, string[]> = {
      Proponente__c: [],
      PropostaAnaliseCredito__c: [],
      Opportunity: [...this.criados.Opportunity],
      Lead: [...this.criados.Lead],
      Account: [...this.criados.Account],
    };
    try {
      const estado = await this.snapshot();
      const pacs = await this.consultar(
        z.object({ Id: z.string(), CreatedDate: z.string() }).passthrough(),
        `SELECT Id, CreatedDate FROM PropostaAnaliseCredito__c WHERE Id__c = ${literal(this.pacExterno)}`,
      );
      const idsPac = pacs.filter(criadoNoRun).map(({ Id }) => Id);
      const proponentes = await this.consultar(
        z.object({ Id: z.string(), CreatedDate: z.string() }).passthrough(),
        `SELECT Id, CreatedDate FROM Proponente__c WHERE Id__c = ${literal(this.proponenteExterno)}${idsPac.length ? ` OR PropostaAnaliseCredito__c IN (${lista(idsPac)})` : ''}`,
      );
      alvo = {
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
    } catch (error) {
      erros.push(`descoberta: ${mensagem(error)}`);
    }

    for (const objeto of [
      'Proponente__c',
      'PropostaAnaliseCredito__c',
      'Opportunity',
      'Lead',
      'Account',
    ] as const) {
      apagados[objeto] = [];
      for (const id of alvo[objeto] ?? []) {
        try {
          await this.restClient.deleteRecord(objeto, id);
          apagados[objeto]!.push(id);
        } catch (error) {
          erros.push(`${objeto} ${id}: ${mensagem(error)}`);
        }
      }
    }

    let restantes: number | null = null;
    try {
      restantes = 0;
      for (const [objeto, ids] of Object.entries(alvo)) {
        if (ids.length === 0) continue;
        restantes += (
          await this.consultar(
            idSchema,
            `SELECT Id FROM ${objeto} WHERE Id IN (${lista(ids)})`,
          )
        ).length;
      }
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
        }
      : null,
  };
}

export function logRun(resultado: ResultadoRun): void {
  logStructured('runbook-run', resultado as unknown as Record<string, unknown>);
}

export { FalhaDeEvento, mensagem };
