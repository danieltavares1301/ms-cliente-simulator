import {
  exec as execCallback,
  execFile as execFileCallback,
} from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

import { z } from 'zod';

import {
  eventGridEnvelopeSchema,
  type EventGridEnvelope,
  type EventGridEvent,
} from '../src/contracts/event-grid.ts';
import type {
  SalesforceAccess,
  SalesforceOAuthAccessProvider,
} from '../src/salesforce/oauth-client.ts';
import { escapeSoqlLiteral } from '../src/salesforce/rest-client.ts';

const execFile = promisify(execFileCallback);
const exec = promisify(execCallback);

export const DEFAULT_ORG_ALIAS = 'mrv-devDan';
export const TARGET_ORG_ID = '00DHZ000006mzDp2AI';
export const DEFAULT_SF_COMMAND =
  process.platform === 'win32' ? 'C:\\Program Files\\sf\\bin\\sf.cmd' : 'sf';
export const DEFAULT_CONCURRENCY = 12;
export const DEFAULT_WAIT_MS = 15_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export const eventMixSchema = z.enum(['mixed', 'uniform']);

export type EventMixMode = z.infer<typeof eventMixSchema>;

export type CliOptions = {
  orgAlias: string;
  sfCommand: string;
  concurrency: number;
  waitMs: number;
  requestTimeoutMs: number;
  eventTimeStepMs: number;
  eventMix: EventMixMode;
  seed: string;
  runId: string;
  eventStartAt: string;
};

export type DispatchPlanVariantKey =
  | 'cliente-update'
  | 'contato-insert-email'
  | 'contato-insert-celular'
  | 'endereco-insert';

export type DispatchPayloadSummary = {
  dataalteracao: string;
  nomecompleto?: string;
  numerocpf?: string;
  email?: string;
  celular?: string;
  personMobilePhone?: string;
  billingStreet?: string;
};

export type ConcurrentDispatchPlanEntry = {
  index: number;
  variantKey: DispatchPlanVariantKey;
  eventType: EventGridEvent['eventType'];
  eventLabel: string;
  envelope: EventGridEnvelope;
  payloadSummary: DispatchPayloadSummary;
};

type DispatchPlanOptions = Pick<
  CliOptions,
  'concurrency' | 'eventMix' | 'eventTimeStepMs'
>;

type BaseClienteUpdateEvent = Extract<
  EventGridEvent,
  {
    eventType: 'cliente-update';
  }
>;

type FinalAccountSnapshot = {
  LastName?: string | null;
  CPF__pc?: string | null;
  PersonEmail?: string | null;
  Celular__c?: string | null;
  PersonMobilePhone?: string | null;
  BillingStreet?: string | null;
};

type FieldWinnerRequest = Pick<
  ConcurrentDispatchPlanEntry,
  'index' | 'variantKey' | 'eventType' | 'eventLabel'
>;

export type FieldWinner = {
  field: string;
  finalValue: string | null;
  request: FieldWinnerRequest | null;
};

export type FieldWinners = {
  lastName: FieldWinner;
  personEmail: FieldWinner;
  mobile: FieldWinner;
  billingStreet: FieldWinner;
};

const mixedVariantOrder = [
  'cliente-update',
  'contato-insert-email',
  'contato-insert-celular',
  'endereco-insert',
] as const satisfies readonly DispatchPlanVariantKey[];

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32);
}

function nowUtcWithMilliseconds(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

export function addMilliseconds(
  isoString: string,
  milliseconds: number,
): string {
  return new Date(new Date(isoString).getTime() + milliseconds)
    .toISOString()
    .replace(/\.\d{3}Z$/, '.000Z');
}

function parseIntegerArgument(
  candidate: string | undefined,
  fallback: number,
  name: string,
): number {
  if (candidate === undefined || candidate.length === 0) return fallback;
  const parsed = Number.parseInt(candidate, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Valor inválido para ${name}: ${candidate}`);
  }
  return parsed;
}

function parseEventMixArgument(candidate: string | undefined): EventMixMode {
  const parsed = eventMixSchema.safeParse(candidate ?? 'mixed');
  if (!parsed.success) {
    throw new Error(`Modo inválido para event-mix: ${candidate}`);
  }
  return parsed.data;
}

export function parseCliArguments(argv: readonly string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;

    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (!rawKey) continue;
    if (inlineValue !== undefined) {
      args.set(rawKey, inlineValue);
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken !== undefined && !nextToken.startsWith('--')) {
      args.set(rawKey, nextToken);
      index += 1;
      continue;
    }

    args.set(rawKey, 'true');
  }

  const seed =
    args.get('seed') ??
    process.env.O10_STRESS_SEED ??
    `o10-${sanitizeToken(Date.now().toString(36))}`;
  const runId =
    args.get('run-id') ??
    process.env.O10_STRESS_RUN_ID ??
    `run_o10_${sanitizeToken(Date.now().toString(36))}`;
  const eventStartAt =
    args.get('event-start-at') ??
    process.env.O10_STRESS_EVENT_START_AT ??
    nowUtcWithMilliseconds();

  return {
    orgAlias:
      args.get('org-alias') ??
      process.env.SF_TARGET_ORG ??
      process.env.O10_STRESS_ORG_ALIAS ??
      DEFAULT_ORG_ALIAS,
    sfCommand:
      args.get('sf-command') ??
      process.env.SF_CLI_PATH ??
      process.env.O10_STRESS_SF_COMMAND ??
      DEFAULT_SF_COMMAND,
    concurrency: parseIntegerArgument(
      args.get('concurrency') ?? process.env.O10_STRESS_CONCURRENCY,
      DEFAULT_CONCURRENCY,
      'concurrency',
    ),
    waitMs: parseIntegerArgument(
      args.get('wait-ms') ?? process.env.O10_STRESS_WAIT_MS,
      DEFAULT_WAIT_MS,
      'wait-ms',
    ),
    requestTimeoutMs: parseIntegerArgument(
      args.get('request-timeout-ms') ?? process.env.O10_STRESS_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
      'request-timeout-ms',
    ),
    eventTimeStepMs: parseIntegerArgument(
      args.get('event-time-step-ms') ?? process.env.O10_STRESS_EVENT_TIME_STEP_MS,
      0,
      'event-time-step-ms',
    ),
    eventMix: parseEventMixArgument(
      args.get('event-mix') ?? process.env.O10_STRESS_EVENT_MIX ?? 'mixed',
    ),
    seed,
    runId,
    eventStartAt,
  };
}

function padIndex(index: number): string {
  return String(index).padStart(2, '0');
}

function buildConcurrentEmail(index: number): string {
  return `concorrente-${padIndex(index)}@simulador.mrv.invalid`;
}

function buildConcurrentCellphone(index: number): string {
  return `11${String(990000000 + index).padStart(9, '0')}`;
}

function buildEventEnvelopeBase(
  baseEvent: BaseClienteUpdateEvent,
  index: number,
  eventTime: string,
  variantKey: DispatchPlanVariantKey,
) {
  return {
    id: `${baseEvent.id}-o10-${variantKey}-${index}-${randomUUID().slice(0, 8)}`,
    subject: baseEvent.subject,
    eventTime,
    dataVersion: baseEvent.dataVersion,
    metadataVersion: baseEvent.metadataVersion,
    topic: baseEvent.topic,
  } as const;
}

function getBaseClienteUpdateEvent(
  baseEnvelope: EventGridEnvelope,
): BaseClienteUpdateEvent {
  const baseEvent = baseEnvelope[0];
  if (baseEvent?.eventType !== 'cliente-update') {
    throw new Error('Fixture base inválida para stress O10.');
  }
  return baseEvent;
}

function createClienteUpdateEntry(
  baseEvent: BaseClienteUpdateEvent,
  index: number,
  eventTime: string,
): ConcurrentDispatchPlanEntry {
  const nomecompleto = `Cliente Concorrente ${padIndex(index)}`;
  const envelope = eventGridEnvelopeSchema.parse([
    {
      ...buildEventEnvelopeBase(baseEvent, index, eventTime, 'cliente-update'),
      eventType: 'cliente-update',
      data: {
        ...baseEvent.data,
        dataalteracao: eventTime,
        nomecompleto,
      },
    },
  ]);

  return {
    index,
    variantKey: 'cliente-update',
    eventType: 'cliente-update',
    eventLabel: 'cliente-update',
    envelope,
    payloadSummary: {
      dataalteracao: eventTime,
      nomecompleto,
      numerocpf: baseEvent.data.numerocpf,
    },
  };
}

function createContatoEmailEntry(
  baseEvent: BaseClienteUpdateEvent,
  index: number,
  eventTime: string,
): ConcurrentDispatchPlanEntry {
  const email = buildConcurrentEmail(index);
  const envelope = eventGridEnvelopeSchema.parse([
    {
      ...buildEventEnvelopeBase(
        baseEvent,
        index,
        eventTime,
        'contato-insert-email',
      ),
      eventType: 'contato-insert',
      data: {
        idcliente: baseEvent.data.idcliente,
        idprospectsalesforce: baseEvent.data.idprospectsalesforce,
        dataalteracao: eventTime,
        tipocontato: 'Email',
        descricao: email,
      },
    },
  ]);

  return {
    index,
    variantKey: 'contato-insert-email',
    eventType: 'contato-insert',
    eventLabel: 'contato-insert:Email',
    envelope,
    payloadSummary: {
      dataalteracao: eventTime,
      email,
    },
  };
}

function createContatoCelularEntry(
  baseEvent: BaseClienteUpdateEvent,
  index: number,
  eventTime: string,
): ConcurrentDispatchPlanEntry {
  const celular = buildConcurrentCellphone(index);
  const envelope = eventGridEnvelopeSchema.parse([
    {
      ...buildEventEnvelopeBase(
        baseEvent,
        index,
        eventTime,
        'contato-insert-celular',
      ),
      eventType: 'contato-insert',
      data: {
        idcliente: baseEvent.data.idcliente,
        idprospectsalesforce: baseEvent.data.idprospectsalesforce,
        dataalteracao: eventTime,
        tipocontato: 'Celular',
        descricao: celular,
      },
    },
  ]);

  return {
    index,
    variantKey: 'contato-insert-celular',
    eventType: 'contato-insert',
    eventLabel: 'contato-insert:Celular',
    envelope,
    payloadSummary: {
      dataalteracao: eventTime,
      celular,
      personMobilePhone: `55${celular}`,
    },
  };
}

function createEnderecoEntry(
  baseEvent: BaseClienteUpdateEvent,
  index: number,
  eventTime: string,
): ConcurrentDispatchPlanEntry {
  const billingStreet = `Rua Concorrente ${padIndex(index)}`;
  const envelope = eventGridEnvelopeSchema.parse([
    {
      ...buildEventEnvelopeBase(baseEvent, index, eventTime, 'endereco-insert'),
      eventType: 'endereco-insert',
      data: {
        idcliente: baseEvent.data.idcliente,
        idprospectsalesforce: baseEvent.data.idprospectsalesforce,
        dataalteracao: eventTime,
        tipoendereco: 'COBRANCA',
        logradouro: billingStreet,
      },
    },
  ]);

  return {
    index,
    variantKey: 'endereco-insert',
    eventType: 'endereco-insert',
    eventLabel: 'endereco-insert:COBRANCA',
    envelope,
    payloadSummary: {
      dataalteracao: eventTime,
      billingStreet,
    },
  };
}

function createDispatchPlanEntry(
  baseEvent: BaseClienteUpdateEvent,
  index: number,
  eventTime: string,
  variantKey: DispatchPlanVariantKey,
): ConcurrentDispatchPlanEntry {
  switch (variantKey) {
    case 'cliente-update':
      return createClienteUpdateEntry(baseEvent, index, eventTime);
    case 'contato-insert-email':
      return createContatoEmailEntry(baseEvent, index, eventTime);
    case 'contato-insert-celular':
      return createContatoCelularEntry(baseEvent, index, eventTime);
    case 'endereco-insert':
      return createEnderecoEntry(baseEvent, index, eventTime);
  }
}

function pickVariantKey(
  index: number,
  eventMix: EventMixMode,
): DispatchPlanVariantKey {
  if (eventMix === 'uniform') return 'cliente-update';
  return mixedVariantOrder[(index - 1) % mixedVariantOrder.length];
}

export function buildConcurrentDispatchPlan(
  baseEnvelope: EventGridEnvelope,
  options: DispatchPlanOptions,
): ConcurrentDispatchPlanEntry[] {
  const baseEvent = getBaseClienteUpdateEvent(baseEnvelope);

  return Array.from({ length: options.concurrency }, (_value, zeroIndex) => {
    const index = zeroIndex + 1;
    const eventTime = addMilliseconds(
      baseEvent.eventTime,
      zeroIndex * options.eventTimeStepMs,
    );
    return createDispatchPlanEntry(
      baseEvent,
      index,
      eventTime,
      pickVariantKey(index, options.eventMix),
    );
  });
}

function toWinnerRequest(
  entry: ConcurrentDispatchPlanEntry | undefined,
): FieldWinnerRequest | null {
  if (!entry) return null;
  return {
    index: entry.index,
    variantKey: entry.variantKey,
    eventType: entry.eventType,
    eventLabel: entry.eventLabel,
  };
}

export function resolveFieldWinners(
  finalAccount: FinalAccountSnapshot | null | undefined,
  entries: readonly ConcurrentDispatchPlanEntry[],
): FieldWinners {
  const lastNameValue = finalAccount?.LastName ?? null;
  const personEmailValue = finalAccount?.PersonEmail ?? null;
  const billingStreetValue = finalAccount?.BillingStreet ?? null;
  const celularValue = finalAccount?.Celular__c ?? null;
  const personMobileValue = finalAccount?.PersonMobilePhone ?? null;

  const mobileWinner = entries.find(
    (entry) =>
      entry.payloadSummary.celular === celularValue ||
      entry.payloadSummary.personMobilePhone === personMobileValue,
  );

  return {
    lastName: {
      field: 'LastName/CPF__pc',
      finalValue: lastNameValue,
      request: toWinnerRequest(
        entries.find(
          (entry) => entry.payloadSummary.nomecompleto === lastNameValue,
        ),
      ),
    },
    personEmail: {
      field: 'PersonEmail',
      finalValue: personEmailValue,
      request: toWinnerRequest(
        entries.find((entry) => entry.payloadSummary.email === personEmailValue),
      ),
    },
    mobile: {
      field: 'Celular__c/PersonMobilePhone',
      finalValue: celularValue ?? personMobileValue,
      request: toWinnerRequest(mobileWinner),
    },
    billingStreet: {
      field: 'BillingStreet',
      finalValue: billingStreetValue,
      request: toWinnerRequest(
        entries.find(
          (entry) => entry.payloadSummary.billingStreet === billingStreetValue,
        ),
      ),
    },
  };
}

// A partir daqui: utilitarios de orquestracao (auth, dispatch HTTP, schemas de
// consulta) reaproveitados por multiplas ferramentas de stress (O10, O12,
// ...). Vivem aqui, e nao em `stress-o10-concurrent-events.ts`, porque esse
// arquivo chama `main()` incondicionalmente no nivel do modulo; importar
// funcoes dele dispararia uma execucao real e completa do script O10 como
// efeito colateral (achado real durante a implementacao do O12).

export const sfOrgDisplaySchema = z
  .object({
    status: z.number().int(),
    result: z
      .object({
        accessToken: z.string().min(1),
        instanceUrl: z.string().url(),
        id: z.string().min(15).optional(),
        orgId: z.string().min(15).optional(),
        alias: z.string().min(1).optional(),
        username: z.string().min(1).optional(),
      })
      .passthrough(),
  })
  .passthrough()
  .transform(({ result }) => ({
    accessToken: result.accessToken,
    instanceUrl: result.instanceUrl.replace(/\/+$/, ''),
    orgId: result.orgId ?? result.id ?? TARGET_ORG_ID,
    alias: result.alias ?? DEFAULT_ORG_ALIAS,
    username: result.username ?? null,
  }));

export const accountQuerySchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    records: z.array(
      z
        .object({
          Id: z.string(),
          Id__c: z.string().nullable(),
          IdProspectSalesforce__c: z.string().nullable(),
          CPF__pc: z.string().nullable(),
          LastName: z.string().nullable(),
          PersonEmail: z.string().nullable().optional(),
          PersonMobilePhone: z.string().nullable().optional(),
          Celular__c: z.string().nullable().optional(),
          BillingStreet: z.string().nullable().optional(),
          DataAlteracaoEvento__c: z.string().nullable().optional(),
          DataAlteracaoEventoContatoEmail__c: z.string().nullable().optional(),
          DataAlteracaoEventoContatoCelular__c: z.string().nullable().optional(),
          DataAlteracaoEventoEndereco__c: z.string().nullable().optional(),
          LastModifiedDate: z.string().nullable().optional(),
          CreatedDate: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const leadQuerySchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    records: z.array(
      z
        .object({
          Id: z.string(),
          Id__c: z.string().nullable(),
          CPF__c: z.string().nullable(),
          LastName: z.string().nullable(),
          Email: z.string().nullable().optional(),
          MobilePhone: z.string().nullable().optional(),
          CreatedDate: z.string().nullable().optional(),
          LastModifiedDate: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const logQuerySchema = z
  .object({
    totalSize: z.number().int().nonnegative(),
    records: z.array(
      z
        .object({
          Id: z.string(),
          CreatedDate: z.string().nullable().optional(),
          EventType__c: z.string().nullable().optional(),
          Status2__c: z.string().nullable().optional(),
          BodyRequest__c: z.string().nullable().optional(),
          Response__c: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type RequestResult = {
  index: number;
  eventId: string;
  eventType: string;
  eventLabel: string;
  variantKey: string;
  eventTime: string;
  dataalteracao: string;
  payloadSummary: ConcurrentDispatchPlanEntry['payloadSummary'];
  httpStatus: number | null;
  statusText: string;
  durationMs: number;
  ok: boolean;
  responseBody: unknown;
  responseText: string;
  detectedLockError: boolean;
  detectedDmlException: boolean;
  startedAt: string;
  finishedAt: string;
  transportError?: string;
};

export function logStructured(event: string, payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...payload,
    }),
  );
}

export function literal(value: string): string {
  return `'${escapeSoqlLiteral(value)}'`;
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function tryParseJson(text: string): unknown {
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function detectLockSignals(value: string): {
  detectedLockError: boolean;
  detectedDmlException: boolean;
} {
  const normalized = value.toUpperCase();
  return {
    detectedLockError: normalized.includes('UNABLE_TO_LOCK_ROW'),
    detectedDmlException: normalized.includes('DMLEXCEPTION'),
  };
}

export async function loadOrgAccess(
  sfCommand: string,
  orgAlias: string,
): Promise<z.infer<typeof sfOrgDisplaySchema>> {
  const isBatchWrapper = /\.(?:cmd|bat)$/i.test(sfCommand);
  const execution = isBatchWrapper
    ? exec(
        `"${sfCommand}" org display --target-org "${orgAlias}" --json`,
        {
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
        },
      )
    : execFile(
        sfCommand,
        ['org', 'display', '--target-org', orgAlias, '--json'],
        {
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
  const { stdout } = await execution;
  return sfOrgDisplaySchema.parse(JSON.parse(stdout) as unknown);
}

export function createStaticAccessProvider(
  access: SalesforceAccess,
): SalesforceOAuthAccessProvider {
  return {
    getAccess: async () => access,
    invalidateToken: () => {
      // Salesforce CLI fornece o token pronto; o script não o reemite.
    },
  };
}

export async function dispatchConcurrentRequest(
  access: SalesforceAccess,
  planEntry: ConcurrentDispatchPlanEntry,
  timeoutMs: number,
): Promise<RequestResult> {
  const event = planEntry.envelope[0];
  const startedAt = new Date();

  try {
    const response = await fetch(
      new URL('/services/apexrest/Cliente', access.instanceUrl),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${access.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(planEntry.envelope),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    const responseText = await response.text();
    const finishedAt = new Date();
    const detection = detectLockSignals(responseText);

    return {
      index: planEntry.index,
      eventId: event.id,
      eventType: event.eventType,
      eventLabel: planEntry.eventLabel,
      variantKey: planEntry.variantKey,
      eventTime: event.eventTime,
      dataalteracao: planEntry.payloadSummary.dataalteracao,
      payloadSummary: planEntry.payloadSummary,
      httpStatus: response.status,
      statusText: response.statusText || String(response.status),
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      ok: response.ok,
      responseBody: tryParseJson(responseText),
      responseText,
      ...detection,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : 'Unknown fetch error';
    const detection = detectLockSignals(message);
    return {
      index: planEntry.index,
      eventId: event.id,
      eventType: event.eventType,
      eventLabel: planEntry.eventLabel,
      variantKey: planEntry.variantKey,
      eventTime: event.eventTime,
      dataalteracao: planEntry.payloadSummary.dataalteracao,
      payloadSummary: planEntry.payloadSummary,
      httpStatus: null,
      statusText: 'FETCH_ERROR',
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      ok: false,
      responseBody: message,
      responseText: message,
      ...detection,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      transportError: message,
    };
  }
}

export function createAccountStateQuery(idCliente: string): string {
  return (
    `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, ` +
    `PersonEmail, PersonMobilePhone, Celular__c, BillingStreet, ` +
    `DataAlteracaoEvento__c, DataAlteracaoEventoContatoEmail__c, ` +
    `DataAlteracaoEventoContatoCelular__c, DataAlteracaoEventoEndereco__c, ` +
    `CreatedDate, LastModifiedDate FROM Account WHERE Id__c = ${literal(idCliente)}`
  );
}

export function createLeadStateQuery(idProspect: string, cpf: string): string {
  return (
    `SELECT Id, Id__c, CPF__c, LastName, Email, MobilePhone, ` +
    `CreatedDate, LastModifiedDate FROM Lead WHERE Id__c = ${literal(
      idProspect,
    )} OR CPF__c = ${literal(cpf)}`
  );
}

