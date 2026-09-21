import {
  exec as execCallback,
  execFile as execFileCallback,
} from 'node:child_process';
import { promisify } from 'node:util';

import { z } from 'zod';

import {
  type EventGridEnvelope,
} from '../src/contracts/event-grid.ts';
import type {
  SalesforceAccess,
  SalesforceOAuthAccessProvider,
} from '../src/salesforce/oauth-client.ts';
import {
  asAllowlistedQuery,
  createSalesforceRestClient,
  escapeSoqlLiteral,
} from '../src/salesforce/rest-client.ts';
import { createSalesforceSafetyGuard } from '../src/salesforce/safety-guard.ts';
import { createSalesforceTestDataAdapter } from '../src/salesforce/test-data-adapter.ts';
import { renderScenarioFixture } from '../src/scenarios/renderer.ts';
import {
  buildConcurrentDispatchPlan,
  parseCliArguments,
  resolveFieldWinners,
  type ConcurrentDispatchPlanEntry,
} from './stress-o10-concurrent-events-lib.ts';

const execFile = promisify(execFileCallback);
const exec = promisify(execCallback);

const DEFAULT_ORG_ALIAS = 'mrv-devDan';
const TARGET_ORG_ID = '00DHZ000006mzDp2AI';
const SCRIPT_SCENARIO_KEY = 'o10-stress-concorrencia';

const sfOrgDisplaySchema = z
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

const accountQuerySchema = z
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

const leadQuerySchema = z
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

const logQuerySchema = z
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

type RequestResult = {
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

function logStructured(event: string, payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...payload,
    }),
  );
}

function literal(value: string): string {
  return `'${escapeSoqlLiteral(value)}'`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tryParseJson(text: string): unknown {
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function detectLockSignals(value: string): {
  detectedLockError: boolean;
  detectedDmlException: boolean;
} {
  const normalized = value.toUpperCase();
  return {
    detectedLockError: normalized.includes('UNABLE_TO_LOCK_ROW'),
    detectedDmlException: normalized.includes('DMLEXCEPTION'),
  };
}

async function loadOrgAccess(
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

function createStaticAccessProvider(
  access: SalesforceAccess,
): SalesforceOAuthAccessProvider {
  return {
    getAccess: async () => access,
    invalidateToken: () => {
      // Salesforce CLI fornece o token pronto; o script não o reemite.
    },
  };
}

function createFixtureInput(options: ReturnType<typeof parseCliArguments>) {
  const baseFixture = renderScenarioFixture({
    scenarioKey: 'evento-duplicado',
    version: 1,
    seed: options.seed,
    runId: options.runId,
    eventStartAt: options.eventStartAt,
  });

  return {
    runId: options.runId,
    scenarioKey: SCRIPT_SCENARIO_KEY,
    fixture: {
      ...baseFixture,
      scenarioKey: SCRIPT_SCENARIO_KEY,
    },
  } as const;
}

async function dispatchConcurrentRequest(
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

function createAccountStateQuery(idCliente: string): string {
  return (
    `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, ` +
    `PersonEmail, PersonMobilePhone, Celular__c, BillingStreet, ` +
    `DataAlteracaoEvento__c, DataAlteracaoEventoContatoEmail__c, ` +
    `DataAlteracaoEventoContatoCelular__c, DataAlteracaoEventoEndereco__c, ` +
    `CreatedDate, LastModifiedDate FROM Account WHERE Id__c = ${literal(idCliente)}`
  );
}

function createLeadStateQuery(idProspect: string, cpf: string): string {
  return (
    `SELECT Id, Id__c, CPF__c, LastName, Email, MobilePhone, ` +
    `CreatedDate, LastModifiedDate FROM Lead WHERE Id__c = ${literal(
      idProspect,
    )} OR CPF__c = ${literal(cpf)}`
  );
}

async function main(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
  const fixtureInput = createFixtureInput(options);
  const baseEnvelope = fixtureInput.fixture.steps[0]?.envelope;

  if (!baseEnvelope || baseEnvelope[0]?.eventType !== 'cliente-update') {
    throw new Error('Fixture base inválida para stress O10.');
  }

  const baseEvent = baseEnvelope[0];
  const cpf = baseEvent.data.numerocpf ?? '';
  const orgAccess = await loadOrgAccess(options.sfCommand, options.orgAlias);
  const access: SalesforceAccess = {
    accessToken: orgAccess.accessToken,
    instanceUrl: orgAccess.instanceUrl,
  };
  const oauthClient = createStaticAccessProvider(access);
  const safetyGuard = createSalesforceSafetyGuard({
    oauthClient,
    targetSalesforceBaseUrl: access.instanceUrl,
    targetSalesforceOrgId: orgAccess.orgId,
  });
  const restClient = createSalesforceRestClient({
    oauthClient,
    safetyGuard,
  });
  const testDataAdapter = createSalesforceTestDataAdapter({ restClient });

  const startedAt = new Date();
  let ownedRecordIds: string[] = [];
  let cleanupOutcome:
    | {
        status: string;
        deletedCount: number;
        accountCountAfterCleanup: number;
        leadCountAfterCleanup: number;
      }
    | undefined;

  logStructured('o10-config', {
    orgAlias: options.orgAlias,
    sfCommand: options.sfCommand,
    orgId: orgAccess.orgId,
    instanceUrl: access.instanceUrl,
    concurrency: options.concurrency,
    waitMs: options.waitMs,
    requestTimeoutMs: options.requestTimeoutMs,
    eventTimeStepMs: options.eventTimeStepMs,
    eventMix: options.eventMix,
    runId: options.runId,
    seed: options.seed,
    eventStartAt: options.eventStartAt,
    eventTimeMode:
      options.eventTimeStepMs === 0
        ? 'SAME_EVENT_TIME'
        : 'STAGGERED_EVENT_TIME',
    architecturalChoice:
      'Script dedicado; não usa ScenarioDefinition/orquestração sequencial.',
  });

  try {
    const setupResult = await testDataAdapter.setup(fixtureInput);
    ownedRecordIds = [...setupResult.recordIds];
    logStructured('setup-result', {
      status: setupResult.status,
      createdCount: setupResult.createdCount,
      replayedCount: setupResult.replayedCount,
      recordIds: setupResult.recordIds,
      accountIdCliente: fixtureInput.fixture.identifiers.accountIdCliente,
      accountIdProspect: fixtureInput.fixture.identifiers.accountIdProspect,
      cpf: baseEvent.data.numerocpf ?? null,
    });

    const dispatchPlan = buildConcurrentDispatchPlan(baseEnvelope, {
      concurrency: options.concurrency,
      eventMix: options.eventMix,
      eventTimeStepMs: options.eventTimeStepMs,
    });

    logStructured('dispatch-plan', {
      total: dispatchPlan.length,
      eventMix: options.eventMix,
      countsByVariant: Object.fromEntries(
        Object.entries(
          dispatchPlan.reduce<Record<string, number>>((accumulator, entry) => {
            accumulator[entry.variantKey] =
              (accumulator[entry.variantKey] ?? 0) + 1;
            return accumulator;
          }, {}),
        ).sort(([left], [right]) => left.localeCompare(right)),
      ),
      sameEventTime:
        dispatchPlan.every(
          (entry) =>
            entry.envelope[0].eventTime === dispatchPlan[0]?.envelope[0].eventTime,
        ) && dispatchPlan.length > 0,
      entries: dispatchPlan.map((entry) => ({
        index: entry.index,
        variantKey: entry.variantKey,
        eventType: entry.eventType,
        eventLabel: entry.eventLabel,
        eventTime: entry.envelope[0].eventTime,
        payloadSummary: entry.payloadSummary,
      })),
    });

    const requestResults = await Promise.all(
      dispatchPlan.map((entry) =>
        dispatchConcurrentRequest(access, entry, options.requestTimeoutMs),
      ),
    );

    for (const result of requestResults) {
      logStructured('dispatch-result', result);
    }

    logStructured('post-dispatch-wait', {
      waitMs: options.waitMs,
      reason: 'Aguardar processamento assíncrono antes das consultas finais.',
    });
    await sleep(options.waitMs);

    const accountState = accountQuerySchema.parse(
      await restClient.query<unknown>(
        asAllowlistedQuery(
          createAccountStateQuery(fixtureInput.fixture.identifiers.accountIdCliente),
        ),
      ),
    );

    const leadState = leadQuerySchema.parse(
      await restClient.query<unknown>(
        asAllowlistedQuery(
          createLeadStateQuery(
            fixtureInput.fixture.identifiers.accountIdProspect,
            cpf,
          ),
        ),
      ),
    );

    for (const leadRecord of leadState.records) {
      ownedRecordIds.push(leadRecord.Id);
    }

    let matchedLogs: z.infer<typeof logQuerySchema>['records'] = [];
    let logQueryError: string | null = null;
    try {
      const logState = logQuerySchema.parse(
        await restClient.query<unknown>(
          asAllowlistedQuery(
            'SELECT Id, CreatedDate, EventType__c, Status2__c, BodyRequest__c, Response__c ' +
              'FROM LogIntegracao__c WHERE CreatedDate = TODAY ORDER BY CreatedDate DESC LIMIT 200',
          ),
        ),
      );

      const filters = [
        fixtureInput.fixture.identifiers.accountIdCliente,
        ...requestResults.map((result) => result.eventId),
      ];
      const startedAtMs = startedAt.getTime() - 60_000;
      matchedLogs = logState.records.filter((record) => {
        const createdAtMs =
          record.CreatedDate === undefined || record.CreatedDate === null
            ? Number.NaN
            : Date.parse(record.CreatedDate);
        if (Number.isFinite(createdAtMs) && createdAtMs < startedAtMs) {
          return false;
        }
        const haystacks = [record.BodyRequest__c, record.Response__c].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        );
        return filters.some((filterValue) =>
          haystacks.some((haystack) => haystack.includes(filterValue)),
        );
      });
    } catch (error) {
      logQueryError =
        error instanceof Error ? error.message : 'Falha ao consultar LogIntegracao__c';
    }

    const aggregatedText = [
      ...requestResults.map((result) => result.responseText),
      ...matchedLogs.flatMap((record) => [record.BodyRequest__c ?? '', record.Response__c ?? '']),
    ].join('\n');
    const detected = detectLockSignals(aggregatedText);
    const httpStatusCounts = Object.entries(
      requestResults.reduce<Record<string, number>>((accumulator, result) => {
        const key = String(result.httpStatus ?? 'FETCH_ERROR');
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {}),
    ).sort(([left], [right]) => left.localeCompare(right));

    const finalAccount = accountState.records[0] ?? null;
    const fieldWinners = resolveFieldWinners(finalAccount, dispatchPlan);

    logStructured('final-state', {
      accountCount: accountState.totalSize,
      account: finalAccount,
      fieldWinners,
      leadCount: leadState.totalSize,
      leads: leadState.records,
      matchedLogCount: matchedLogs.length,
      matchedLogs: matchedLogs.map((record) => ({
        id: record.Id,
        createdDate: record.CreatedDate ?? null,
        eventType: record.EventType__c ?? null,
        status: record.Status2__c ?? null,
        bodyRequestPreview: record.BodyRequest__c?.slice(0, 500) ?? null,
        responsePreview: record.Response__c?.slice(0, 500) ?? null,
      })),
      logQueryError,
      summary: {
        successCount: requestResults.filter((result) => result.ok).length,
        non2xxCount: requestResults.filter((result) => !result.ok).length,
        httpStatusCounts,
        requestCountsByVariant: Object.fromEntries(
          Object.entries(
            requestResults.reduce<Record<string, number>>((accumulator, result) => {
              accumulator[result.variantKey] =
                (accumulator[result.variantKey] ?? 0) + 1;
              return accumulator;
            }, {}),
          ).sort(([left], [right]) => left.localeCompare(right)),
        ),
        detectedLockError:
          detected.detectedLockError ||
          requestResults.some((result) => result.detectedLockError),
        detectedDmlException:
          detected.detectedDmlException ||
          requestResults.some((result) => result.detectedDmlException),
      },
    });
  } finally {
    try {
      const accountBeforeCleanup = accountQuerySchema.parse(
        await restClient.query<unknown>(
          asAllowlistedQuery(
            createAccountStateQuery(fixtureInput.fixture.identifiers.accountIdCliente),
          ),
        ),
      );
      const leadBeforeCleanup = leadQuerySchema.parse(
        await restClient.query<unknown>(
          asAllowlistedQuery(
            createLeadStateQuery(
              fixtureInput.fixture.identifiers.accountIdProspect,
              cpf,
            ),
          ),
        ),
      );
      ownedRecordIds.push(
        ...accountBeforeCleanup.records.map((record) => record.Id),
        ...leadBeforeCleanup.records.map((record) => record.Id),
      );
      const cleanupResult = await testDataAdapter.cleanup(
        fixtureInput,
        ownedRecordIds,
      );
      const accountAfterCleanup = accountQuerySchema.parse(
        await restClient.query<unknown>(
          asAllowlistedQuery(
            createAccountStateQuery(fixtureInput.fixture.identifiers.accountIdCliente),
          ),
        ),
      );
      const leadAfterCleanup = leadQuerySchema.parse(
        await restClient.query<unknown>(
          asAllowlistedQuery(
            createLeadStateQuery(
              fixtureInput.fixture.identifiers.accountIdProspect,
              cpf,
            ),
          ),
        ),
      );
      cleanupOutcome = {
        status: cleanupResult.status,
        deletedCount: cleanupResult.deletedCount,
        accountCountAfterCleanup: accountAfterCleanup.totalSize,
        leadCountAfterCleanup: leadAfterCleanup.totalSize,
      };
      logStructured('cleanup-result', cleanupOutcome);
    } catch (error) {
      logStructured('cleanup-error', {
        message:
          error instanceof Error ? error.message : 'Falha desconhecida no cleanup.',
      });
      throw error;
    }
  }

  if (
    cleanupOutcome === undefined ||
    cleanupOutcome.accountCountAfterCleanup > 0 ||
    cleanupOutcome.leadCountAfterCleanup > 0
  ) {
    throw new Error('Cleanup não confirmou remoção completa dos registros de teste.');
  }
}

void main().catch((error) => {
  logStructured('fatal-error', {
    message: error instanceof Error ? error.message : 'Falha desconhecida.',
  });
  process.exitCode = 1;
});
