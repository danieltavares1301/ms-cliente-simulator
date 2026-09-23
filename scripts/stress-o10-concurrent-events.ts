import type {
  SalesforceAccess,
} from '../src/salesforce/oauth-client.ts';
import {
  asAllowlistedQuery,
  createSalesforceRestClient,
} from '../src/salesforce/rest-client.ts';
import { createSalesforceSafetyGuard } from '../src/salesforce/safety-guard.ts';
import { createSalesforceTestDataAdapter } from '../src/salesforce/test-data-adapter.ts';
import { renderScenarioFixture } from '../src/scenarios/renderer.ts';
import {
  accountQuerySchema,
  buildConcurrentDispatchPlan,
  createAccountStateQuery,
  createLeadStateQuery,
  createStaticAccessProvider,
  detectLockSignals,
  dispatchConcurrentRequest,
  leadQuerySchema,
  loadOrgAccess,
  logQuerySchema,
  logStructured,
  parseCliArguments,
  resolveFieldWinners,
  sleep,
} from './stress-o10-concurrent-events-lib.ts';
import type { z } from 'zod';

const SCRIPT_SCENARIO_KEY = 'o10-stress-concorrencia';

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
