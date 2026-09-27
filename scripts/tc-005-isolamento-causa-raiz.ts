import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { EventGridEnvelope } from '../src/contracts/event-grid.ts';
import {
  asAllowlistedQuery,
  getPersonAccountRecordTypeId,
} from '../src/salesforce/rest-client.ts';
import { generateSyntheticCpf } from '../src/synthetic/cpf.ts';
import {
  connectToTargetOrg,
  countLeadsById,
  dispatchConcurrentRequest,
  findRunCreatedLeadIds,
  literal,
  logStructured,
  parseCliArguments,
  parseSalesforceDateTime,
  readCliFlag,
  sleep,
  type TargetOrgConnection,
} from './stress-o10-concurrent-events-lib.ts';

/**
 * Reteste de isolamento da causa-raiz do TC-005 ("Account Y existente, Lead
 * Y ausente").
 *
 * `docs/tc-005-conta-y-sem-lead.md` concluiu que o Lead de Y só nasce quando
 * um `contato-*` chega antes do primeiro `cliente-update(Y)`. Porém, nas
 * ordens em que o script esperava "sem Lead", o `cliente-update(Y)` saía com
 * `dataalteracao` igual ao `DataAlteracaoEvento__c` gravado no setup de Y, e
 * o Apex trata data igual ao marcador como sucesso sem alteração
 * (`docs/phase-0/contract-matrix.md`). As duas explicações coincidiam.
 *
 * Cada variante isola uma combinação — contato antes ou não, e data do
 * `cliente-update` igual ou posterior ao marcador — sobre a massa do TC-005:
 * Account X com prospect sintético; Account Y com CPF Y, `IDCLI-Y`, marcador
 * em t0 e `IdProspectSalesforce__c` em branco, sem Lead. Só eventos do
 * `/Cliente`: sem PAC, para não misturar outra variável nem outro callout.
 *
 * Uso: `npm run retest:tc005 -- [--variantes V1,V3] [--repeticoes 2]
 * [--timeout-lead-ms 90000]`.
 */

type Step =
  | { kind: 'contato-insert' }
  | {
      kind: 'cliente-update';
      data: 'igual-ao-marcador' | 'posterior-ao-marcador';
      comProspectX: boolean;
    };

type Variant = { id: string; descricao: string; steps: readonly Step[] };

const variants: readonly Variant[] = [
  {
    id: 'V1',
    descricao: 'cliente-update(Y) sozinho, data posterior ao marcador, com PROS-X',
    steps: [
      { kind: 'cliente-update', data: 'posterior-ao-marcador', comProspectX: true },
    ],
  },
  {
    id: 'V2',
    descricao:
      'cliente-update(Y) sozinho, data posterior ao marcador, sem idprospectsalesforce',
    steps: [
      { kind: 'cliente-update', data: 'posterior-ao-marcador', comProspectX: false },
    ],
  },
  {
    id: 'V3',
    descricao:
      'cliente-update(Y) sozinho, data igual ao marcador (réplica das ordens "sem Lead")',
    steps: [
      { kind: 'cliente-update', data: 'igual-ao-marcador', comProspectX: true },
    ],
  },
  {
    id: 'V4',
    descricao: 'contato-insert antes + cliente-update com data igual ao marcador',
    steps: [
      { kind: 'contato-insert' },
      { kind: 'cliente-update', data: 'igual-ao-marcador', comProspectX: true },
    ],
  },
  {
    id: 'V5',
    descricao:
      'contato-insert antes + cliente-update com data posterior (padrão O01/O08)',
    steps: [
      { kind: 'contato-insert' },
      { kind: 'cliente-update', data: 'posterior-ao-marcador', comProspectX: true },
    ],
  },
  {
    id: 'V6',
    descricao: 'contato-insert sozinho, sem cliente-update',
    steps: [{ kind: 'contato-insert' }],
  },
];

const compositeResponseSchema = z.object({
  compositeResponse: z.array(
    z.object({ body: z.object({ id: z.string(), success: z.literal(true) }) }),
  ),
});

const accountObservationSchema = z.object({
  records: z.array(
    z
      .object({
        Id: z.string(),
        IdProspectSalesforce__c: z.string().nullable(),
        DataAlteracaoEvento__c: z.string().nullable(),
        LastName: z.string().nullable(),
        CreatedDate: z.string(),
      })
      .passthrough(),
  ),
});

const leadObservationSchema = z.object({
  records: z.array(
    z
      .object({
        Id: z.string(),
        Id__c: z.string().nullable(),
        CreatedDate: z.string(),
      })
      .passthrough(),
  ),
});

const asyncJobSchema = z.object({
  records: z.array(
    z
      .object({
        JobType: z.string().nullable(),
        Status: z.string().nullable(),
        NumberOfErrors: z.number().nullable(),
        ExtendedStatus: z.string().nullable(),
        CreatedDate: z.string(),
        ApexClass: z.object({ Name: z.string() }).nullable(),
      })
      .passthrough(),
  ),
});

const recordIdsSchema = z.object({
  totalSize: z.number().int().nonnegative(),
  records: z.array(z.object({ Id: z.string() }).passthrough()),
});

type Massa = {
  token: string;
  t0: string;
  posterior: string;
  idClienteX: string;
  idProspectX: string;
  cpfX: string;
  idClienteY: string;
  cpfY: string;
};

type VariantResult = {
  variante: string;
  repeticao: number;
  descricao: string;
  dispatches: Array<{
    evento: string;
    httpStatus: number | null;
    ok: boolean;
    resposta: string;
  }>;
  leadCriado: boolean | null;
  leads: Array<{ Id: string; Id__c: string | null; CreatedDate: string }>;
  segundosAteLead: number | null;
  prospectFinalY: string | null;
  marcadorFinalY: string | null;
  clienteUpdateAplicado: boolean | null;
  jobsAssincronos: Array<{
    classe: string | null;
    tipo: string | null;
    status: string | null;
    erros: number | null;
    detalhe: string | null;
  }>;
  cleanup: {
    leadsApagados: string[];
    accountsRestantes: number | null;
    leadsRestantes: number | null;
    erros: string[];
  } | null;
  erro: string | null;
  falhaOperacional: boolean;
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

function toSoqlDateTime(milliseconds: number): string {
  return new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parsePositiveInteger(raw: string, name: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} precisa ser um inteiro positivo (recebido: ${raw}).`);
  }
  return value;
}

function selectVariants(filter: string | undefined): readonly Variant[] {
  if (filter === undefined) return variants;
  const requested = filter.split(',').map((value) => value.trim().toUpperCase());
  const unknown = requested.filter(
    (id) => !variants.some((variant) => variant.id === id),
  );
  if (unknown.length > 0 || requested.length === 0) {
    throw new Error(
      `--variantes inválidas: ${unknown.join(', ') || '(vazio)'}; use ${variants
        .map((variant) => variant.id)
        .join(', ')}.`,
    );
  }
  return variants.filter((variant) => requested.includes(variant.id));
}

function createMassa(): Massa {
  const token = randomUUID().replace(/-/g, '').slice(0, 10);
  const t0 = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  return {
    token,
    t0,
    posterior: new Date(Date.parse(t0) + 5_000).toISOString(),
    idClienteX: `CLI-TC005R-X-${token}`,
    idProspectX: `PRO-TC005R-X-${token}`,
    cpfX: generateSyntheticCpf(`${token}:x`, 'tc-005-reteste'),
    idClienteY: `CLI-TC005R-Y-${token}`,
    cpfY: generateSyntheticCpf(`${token}:y`, 'tc-005-reteste'),
  };
}

async function createAccountX(
  conn: TargetOrgConnection,
  recordTypeId: string,
  massa: Massa,
): Promise<string> {
  const raw = await conn.restClient.composite([
    {
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Account',
      referenceId: 'createAccount',
      body: {
        RecordTypeId: recordTypeId,
        LastName: `QA UNIF22 TC005R CLIENTE X ${massa.token}`,
        Id__c: massa.idClienteX,
        IdProspectSalesforce__c: massa.idProspectX,
        CPF__pc: massa.cpfX,
        DataAlteracaoEvento__c: massa.t0,
      },
    },
  ]);
  const response = compositeResponseSchema.safeParse(raw);
  if (!response.success) {
    // Em falha, a Composite API devolve em `body` a lista de erros da
    // Salesforce (errorCode/message), que é o que interessa diagnosticar.
    throw new Error(
      `Criação da Account X falhou: ${JSON.stringify(raw).slice(0, 800)}`,
    );
  }
  return response.data.compositeResponse[0]!.body.id;
}

/**
 * O catálogo de operações do rest client exige `IdProspectSalesforce__c` não
 * vazio para criar Account, mas a massa do TC-005 precisa de Y com o campo em
 * branco (um placeholder bloqueia a criação do Lead). O POST é direto, mas
 * passa pelo Safety Guard imediatamente antes da escrita.
 */
async function createAccountYWithoutProspect(
  conn: TargetOrgConnection,
  recordTypeId: string,
  massa: Massa,
  timeoutMs: number,
): Promise<string> {
  const access = await conn.safetyGuard.validate();
  const response = await fetch(
    new URL('/services/data/v61.0/sobjects/Account', access.instanceUrl),
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        authorization: `Bearer ${access.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        RecordTypeId: recordTypeId,
        LastName: `QA UNIF22 TC005R CLIENTE Y ${massa.token}`,
        Id__c: massa.idClienteY,
        CPF__pc: massa.cpfY,
        DataAlteracaoEvento__c: massa.t0,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`POST Account Y falhou (${response.status}): ${await response.text()}`);
  }
  return z.object({ id: z.string() }).parse(await response.json()).id;
}

function buildEnvelope(
  step: Step,
  massa: Massa,
  variantId: string,
  repetition: number,
): EventGridEnvelope {
  const suffix = `${variantId}-R${repetition}-${massa.token}`;
  if (step.kind === 'contato-insert') {
    return [
      {
        id: `EVT-TC005R-CONTATO-EMAIL-${suffix}`,
        subject: 'MS_Clientes',
        eventType: 'contato-insert',
        eventTime: massa.t0,
        dataVersion: '1.0',
        metadataVersion: '1',
        topic: '/simulator/ms-clientes',
        data: {
          idcliente: massa.idClienteY,
          dataalteracao: massa.t0,
          tipocontato: 'Email',
          descricao: `reteste.${massa.token}@simulador.mrv.invalid`,
        },
      },
    ] as EventGridEnvelope;
  }
  const dataalteracao =
    step.data === 'igual-ao-marcador' ? massa.t0 : massa.posterior;
  return [
    {
      id: `EVT-TC005R-CLIENTE-UPDATE-${suffix}`,
      subject: 'MS_Clientes',
      eventType: 'cliente-update',
      eventTime: dataalteracao,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: massa.idClienteY,
        ...(step.comProspectX ? { idprospectsalesforce: massa.idProspectX } : {}),
        numerocpf: massa.cpfY,
        dataalteracao,
        nomecompleto: 'QA UNIF22 TC005R CLIENTE Y',
      },
    },
  ] as EventGridEnvelope;
}

async function observe(
  conn: TargetOrgConnection,
  accountYId: string,
  cpfY: string,
) {
  const [account] = accountObservationSchema.parse(
    await conn.restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, IdProspectSalesforce__c, DataAlteracaoEvento__c, LastName, CreatedDate FROM Account WHERE Id = ${literal(accountYId)}`,
      ),
    ),
  ).records;
  const conditions = [`CPF__c = ${literal(cpfY)}`];
  if (account?.IdProspectSalesforce__c) {
    conditions.push(`Id__c = ${literal(account.IdProspectSalesforce__c)}`);
  }
  const leads = leadObservationSchema.parse(
    await conn.restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, CreatedDate FROM Lead WHERE ${conditions.join(' OR ')}`,
      ),
    ),
  ).records;
  const createdSince = account ? parseSalesforceDateTime(account.CreatedDate) : 0;
  return {
    account,
    leads: leads.filter(
      (lead) => parseSalesforceDateTime(lead.CreatedDate) >= createdSince,
    ),
  };
}

async function listAsyncJobs(conn: TargetOrgConnection, sinceMs: number) {
  const jobs = asyncJobSchema.parse(
    await conn.restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT ApexClass.Name, JobType, Status, NumberOfErrors, ExtendedStatus, CreatedDate FROM AsyncApexJob WHERE CreatedDate >= ${toSoqlDateTime(sinceMs)} AND JobType IN ('Queueable', 'Future') ORDER BY CreatedDate LIMIT 50`,
      ),
    ),
  );
  return jobs.records.map((job) => ({
    classe: job.ApexClass?.Name ?? null,
    tipo: job.JobType,
    status: job.Status,
    erros: job.NumberOfErrors,
    detalhe: job.ExtendedStatus?.slice(0, 300) ?? null,
  }));
}

/**
 * Apaga só o que o run criou: as Accounts criadas aqui e os Leads que o Apex
 * criou para elas — descobertos pelo `IdProspectSalesforce__c` das Accounts ou
 * pelo CPF sintético do run, sempre com `CreatedDate` a partir da Account mais
 * antiga do run. Continua após erro para não deixar o resto para trás.
 */
async function cleanup(
  conn: TargetOrgConnection,
  accountIds: readonly string[],
  cpfs: readonly string[],
): Promise<NonNullable<VariantResult['cleanup']>> {
  const erros: string[] = [];
  let leadIds: string[] = [];
  if (accountIds.length > 0) {
    try {
      const accounts = accountObservationSchema.parse(
        await conn.restClient.query<unknown>(
          asAllowlistedQuery(
            `SELECT Id, IdProspectSalesforce__c, DataAlteracaoEvento__c, LastName, CreatedDate FROM Account WHERE Id IN (${accountIds.map(literal).join(', ')})`,
          ),
        ),
      );
      const runStartedAt = Math.min(
        ...accounts.records.map((account) =>
          parseSalesforceDateTime(account.CreatedDate),
        ),
      );
      const byCpf = leadObservationSchema
        .parse(
          await conn.restClient.query<unknown>(
            asAllowlistedQuery(
              `SELECT Id, Id__c, CreatedDate FROM Lead WHERE CPF__c IN (${cpfs.map(literal).join(', ')})`,
            ),
          ),
        )
        .records.filter(
          (lead) => parseSalesforceDateTime(lead.CreatedDate) >= runStartedAt,
        )
        .map((lead) => lead.Id);
      const byProspect = await findRunCreatedLeadIds(conn.restClient, accountIds);
      leadIds = [...new Set([...byProspect, ...byCpf])];
    } catch (error) {
      erros.push(`descoberta de Leads: ${message(error)}`);
    }
  }
  for (const leadId of leadIds) {
    try {
      await conn.restClient.deleteRecord('Lead', leadId);
    } catch (error) {
      erros.push(`Lead ${leadId}: ${message(error)}`);
    }
  }
  for (const accountId of accountIds) {
    try {
      await conn.restClient.deleteRecord('Account', accountId);
    } catch (error) {
      erros.push(`Account ${accountId}: ${message(error)}`);
    }
  }

  let accountsRestantes: number | null = null;
  let leadsRestantes: number | null = null;
  try {
    accountsRestantes =
      accountIds.length === 0
        ? 0
        : recordIdsSchema.parse(
            await conn.restClient.query<unknown>(
              asAllowlistedQuery(
                `SELECT Id FROM Account WHERE Id IN (${accountIds.map(literal).join(', ')})`,
              ),
            ),
          ).totalSize;
    leadsRestantes = await countLeadsById(conn.restClient, leadIds);
  } catch (error) {
    erros.push(`verificação de resíduo: ${message(error)}`);
  }
  return { leadsApagados: leadIds, accountsRestantes, leadsRestantes, erros };
}

async function runVariant(
  conn: TargetOrgConnection,
  recordTypeId: string,
  variant: Variant,
  repetition: number,
  requestTimeoutMs: number,
  leadTimeoutMs: number,
): Promise<VariantResult> {
  const massa = createMassa();
  const createdAccountIds: string[] = [];
  const result: VariantResult = {
    variante: variant.id,
    repeticao: repetition,
    descricao: variant.descricao,
    dispatches: [],
    leadCriado: null,
    leads: [],
    segundosAteLead: null,
    prospectFinalY: null,
    marcadorFinalY: null,
    clienteUpdateAplicado: null,
    jobsAssincronos: [],
    cleanup: null,
    erro: null,
    falhaOperacional: false,
  };

  try {
    createdAccountIds.push(await createAccountX(conn, recordTypeId, massa));
    const accountYId = await createAccountYWithoutProspect(
      conn,
      recordTypeId,
      massa,
      requestTimeoutMs,
    );
    createdAccountIds.push(accountYId);

    for (const [index, step] of variant.steps.entries()) {
      if (index > 0) await sleep(2_000);
      const envelope = buildEnvelope(step, massa, variant.id, repetition);
      const access = await conn.safetyGuard.validate();
      const dispatched = await dispatchConcurrentRequest(
        access,
        {
          index,
          variantKey: 'cliente-update',
          eventType: envelope[0]!.eventType,
          eventLabel: `${variant.id}-${step.kind}`,
          envelope,
          payloadSummary: { dataalteracao: envelope[0]!.eventTime },
        },
        requestTimeoutMs,
        'Cliente',
      );
      result.dispatches.push({
        evento: `${step.kind}${step.kind === 'cliente-update' ? ` (${step.data})` : ''}`,
        httpStatus: dispatched.httpStatus,
        ok: dispatched.ok,
        resposta: dispatched.responseText.slice(0, 300),
      });
      if (!dispatched.ok) {
        throw new Error(
          `dispatch ${step.kind} falhou (${dispatched.httpStatus ?? dispatched.transportError})`,
        );
      }
    }

    // Criação de Lead é assíncrona (insertLeadQueueable): espera o prazo
    // inteiro antes de concluir "sem Lead" (regra 6 do plano).
    const startedWaitingAt = Date.now();
    let observation = await observe(conn, accountYId, massa.cpfY);
    while (
      observation.leads.length === 0 &&
      Date.now() - startedWaitingAt < leadTimeoutMs
    ) {
      await sleep(5_000);
      observation = await observe(conn, accountYId, massa.cpfY);
    }
    result.leadCriado = observation.leads.length > 0;
    result.leads = observation.leads.map(({ Id, Id__c, CreatedDate }) => ({
      Id,
      Id__c,
      CreatedDate,
    }));
    result.segundosAteLead = result.leadCriado
      ? Math.round((Date.now() - startedWaitingAt) / 1000)
      : null;
    result.prospectFinalY = observation.account?.IdProspectSalesforce__c ?? null;
    result.marcadorFinalY = observation.account?.DataAlteracaoEvento__c ?? null;
    // O Apex pode dividir `nomecompleto` entre FirstName e LastName; o sinal
    // de que o cliente-update foi aplicado é o LastName ter mudado.
    result.clienteUpdateAplicado = variant.steps.some(
      (step) => step.kind === 'cliente-update',
    )
      ? observation.account?.LastName !==
        `QA UNIF22 TC005R CLIENTE Y ${massa.token}`
      : null;
    if (observation.account) {
      result.jobsAssincronos = await listAsyncJobs(
        conn,
        parseSalesforceDateTime(observation.account.CreatedDate) - 5_000,
      );
    }
  } catch (error) {
    result.erro = message(error);
    result.falhaOperacional = true;
  } finally {
    result.cleanup = await cleanup(conn, createdAccountIds, [massa.cpfX, massa.cpfY]);
    if (
      result.cleanup.erros.length > 0 ||
      result.cleanup.accountsRestantes !== 0 ||
      result.cleanup.leadsRestantes !== 0
    ) {
      result.falhaOperacional = true;
    }
  }

  logStructured('tc005-reteste-variante', result);
  return result;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const options = parseCliArguments(argv);
  const repetitions = parsePositiveInteger(
    readCliFlag(argv, 'repeticoes') ?? '1',
    'repeticoes',
  );
  const leadTimeoutMs = parsePositiveInteger(
    readCliFlag(argv, 'timeout-lead-ms') ?? '90000',
    'timeout-lead-ms',
  );
  const selected = selectVariants(readCliFlag(argv, 'variantes'));

  const conn = await connectToTargetOrg(options);
  const recordTypeId = await getPersonAccountRecordTypeId(conn.restClient);
  logStructured('tc005-reteste-config', {
    orgAlias: options.orgAlias,
    instanceUrl: conn.access.instanceUrl,
    variantes: selected.map((variant) => variant.id),
    repeticoes: repetitions,
    timeoutLeadMs: leadTimeoutMs,
  });

  const results: VariantResult[] = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const variant of selected) {
      results.push(
        await runVariant(
          conn,
          recordTypeId,
          variant,
          repetition,
          options.requestTimeoutMs,
          leadTimeoutMs,
        ),
      );
    }
  }

  logStructured('tc005-reteste-resumo', {
    porVariante: selected.map((variant) => {
      const runs = results.filter((result) => result.variante === variant.id);
      return {
        variante: variant.id,
        descricao: variant.descricao,
        leadCriado: `${runs.filter((run) => run.leadCriado).length}/${runs.length}`,
        clienteUpdateAplicado: `${runs.filter((run) => run.clienteUpdateAplicado).length}/${runs.length}`,
        falhasOperacionais: runs.filter((run) => run.falhaOperacional).length,
      };
    }),
  });

  if (results.some((result) => result.falhaOperacional)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logStructured('tc005-reteste-fatal-error', { message: message(error) });
  process.exitCode = 1;
});
