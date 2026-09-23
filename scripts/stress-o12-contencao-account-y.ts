import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { SalesforceAccess } from '../src/salesforce/oauth-client.ts';
import {
  asAllowlistedQuery,
  createSalesforceRestClient,
  getPersonAccountRecordTypeId,
  type SalesforceCompositeRequest,
} from '../src/salesforce/rest-client.ts';
import { createSalesforceSafetyGuard } from '../src/salesforce/safety-guard.ts';
import { generateSyntheticCpf } from '../src/synthetic/cpf.ts';
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
  sleep,
} from './stress-o10-concurrent-events-lib.ts';

const compositeResponseSchema = z.object({
  compositeResponse: z.array(
    z.object({
      body: z.object({ id: z.string(), success: z.literal(true) }),
    }),
  ),
});

/**
 * Ferramenta diagnóstica dedicada ao perfil O12 ("Contenção da Account Y logo
 * após insert"), do catálogo de ordens de eventos do MS Cliente Pós-PAC.
 *
 * Diferente do O10 (que reaproveita uma Account já existente), o O12 exige
 * que a contenção aconteça exatamente na janela entre um `cliente-insert`
 * real (que dispara a criação assíncrona do Lead) e a rajada concorrente.
 * Por isso este script publica primeiro um `cliente-insert` novo e, sem
 * esperar o processamento assíncrono terminar, dispara imediatamente a
 * rajada concorrente contra a mesma Account recém-criada.
 *
 * Achado real (validado ao vivo antes de fixar este design): um
 * `cliente-insert` isolado, sem nenhuma divergência de prospect, NÃO cria
 * Lead (`ClienteService`/`ClienteTriggerHandler` só atualizam um Lead já
 * existente; a criação de Lead novo só ocorre no caminho de "prospect
 * divergente" já provado pelos perfis O01/O02/O08). Por isso este script
 * cria primeiro uma Account de controle (X) com um prospect próprio, e só
 * depois publica o `cliente-insert` de Y usando o MESMO prospect de X
 * (divergência real), reproduzindo a única combinação que comprovadamente
 * cria um Lead novo.
 *
 * Arquitetural: fora do catálogo declarativo pelo mesmo motivo do O10 (o
 * orquestrador `ScenarioDefinition`/QStash é sequencial por design).
 */

async function main(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
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
  const restClient = createSalesforceRestClient({ oauthClient, safetyGuard });

  const token = randomUUID().replace(/-/g, '').slice(0, 10);
  const idClienteX = `CLI-SIM-O12-X-${token}`;
  const idProspectX = `PRO-SIM-O12-X-${token}`;
  const cpfX = generateSyntheticCpf(`${token}:x`, options.runId);
  const idCliente = `CLI-SIM-O12-${token}`;
  const cpf = generateSyntheticCpf(token, options.runId);
  const eventStartAt = options.eventStartAt;

  logStructured('o12-config', {
    orgAlias: options.orgAlias,
    instanceUrl: access.instanceUrl,
    orgId: orgAccess.orgId,
    concurrency: options.concurrency,
    waitMs: options.waitMs,
    idClienteX,
    idProspectX,
    idCliente,
    runId: options.runId,
    architecturalChoice:
      'Script dedicado; Account de controle X + cliente-insert de Y com prospect divergente (padrao ja provado por O01/O02), seguido de rajada concorrente imediata contra Y.',
  });

  const recordTypeId = await getPersonAccountRecordTypeId(restClient);
  const controlRequest: SalesforceCompositeRequest = {
    method: 'POST',
    url: '/services/data/v61.0/sobjects/Account',
    referenceId: 'createAccount',
    body: {
      RecordTypeId: recordTypeId,
      LastName: `Cliente O12 Controle ${token}`,
      Id__c: idClienteX,
      IdProspectSalesforce__c: idProspectX,
      CPF__pc: cpfX,
      DataAlteracaoEvento__c: eventStartAt,
    },
  };
  const controlResponse = compositeResponseSchema.parse(
    await restClient.composite([controlRequest]),
  );
  logStructured('control-account-created', {
    id: controlResponse.compositeResponse[0]!.body.id,
    idClienteX,
    idProspectX,
  });

  const insertEnvelope = [
    {
      id: `EVT-O12-INSERT-${token}`,
      subject: 'MS_Clientes',
      eventType: 'cliente-insert' as const,
      eventTime: eventStartAt,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: idCliente,
        idprospectsalesforce: idProspectX,
        numerocpf: cpf,
        dataalteracao: eventStartAt,
        nomecompleto: `Cliente O12 ${token}`,
      },
    },
  ];

  const insertResult = await dispatchConcurrentRequest(
    access,
    {
      index: 0,
      variantKey: 'cliente-update',
      eventType: 'cliente-insert',
      eventLabel: 'cliente-insert',
      envelope: insertEnvelope,
      payloadSummary: { dataalteracao: eventStartAt },
    },
    options.requestTimeoutMs,
  );
  logStructured('cliente-insert-result', insertResult);
  if (!insertResult.ok) {
    throw new Error('cliente-insert inicial falhou; abortando rajada.');
  }

  // Base cliente-update reaproveitado pelo dispatch plan concorrente; herda
  // idcliente/idprospectsalesforce/numerocpf do insert que acabou de criar a
  // Account, para competir pela MESMA linha enquanto o Queueable de criação
  // do Lead ainda pode estar em execução.
  const baseUpdateEnvelope = [
    {
      id: `EVT-O12-BASE-UPDATE-${token}`,
      subject: 'MS_Clientes',
      eventType: 'cliente-update' as const,
      eventTime: eventStartAt,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: idCliente,
        idprospectsalesforce: idProspectX,
        numerocpf: cpf,
        dataalteracao: eventStartAt,
        nomecompleto: `Cliente O12 ${token}`,
      },
    },
  ];

  const dispatchPlan = buildConcurrentDispatchPlan(baseUpdateEnvelope, {
    concurrency: options.concurrency,
    eventMix: options.eventMix,
    eventTimeStepMs: options.eventTimeStepMs,
  });

  logStructured('dispatch-plan', {
    total: dispatchPlan.length,
    eventMix: options.eventMix,
    entries: dispatchPlan.map((entry) => ({
      index: entry.index,
      variantKey: entry.variantKey,
      eventLabel: entry.eventLabel,
    })),
  });

  const requestResults = await Promise.all(
    dispatchPlan.map((entry) =>
      dispatchConcurrentRequest(access, entry, options.requestTimeoutMs),
    ),
  );
  for (const result of requestResults) logStructured('dispatch-result', result);

  logStructured('post-dispatch-wait', { waitMs: options.waitMs });
  await sleep(options.waitMs);

  const accountState = accountQuerySchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(createAccountStateQuery(idCliente)),
    ),
  );
  const leadState = leadQuerySchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(createLeadStateQuery(idProspectX, cpf)),
    ),
  );

  let matchedLogs: Array<{
    Id: string;
    CreatedDate?: string | null;
    EventType__c?: string | null;
    Status2__c?: string | null;
    BodyRequest__c?: string | null;
    Response__c?: string | null;
  }> = [];
  try {
    const logState = logQuerySchema.parse(
      await restClient.query<unknown>(
        asAllowlistedQuery(
          'SELECT Id, CreatedDate, EventType__c, Status2__c, BodyRequest__c, Response__c ' +
            'FROM LogIntegracao__c WHERE CreatedDate = TODAY ORDER BY CreatedDate DESC LIMIT 200',
        ),
      ),
    );
    const filters = [idCliente, insertResult.eventId, ...requestResults.map((r) => r.eventId)];
    matchedLogs = logState.records.filter((record) => {
      const haystacks = [record.BodyRequest__c, record.Response__c].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      );
      return filters.some((filterValue) =>
        haystacks.some((haystack) => haystack.includes(filterValue)),
      );
    });
  } catch (error) {
    logStructured('log-query-error', {
      message: error instanceof Error ? error.message : 'Falha ao consultar LogIntegracao__c',
    });
  }

  const aggregatedText = [
    insertResult.responseText,
    ...requestResults.map((r) => r.responseText),
    ...matchedLogs.flatMap((r) => [r.BodyRequest__c ?? '', r.Response__c ?? '']),
  ].join('\n');
  const detected = detectLockSignals(aggregatedText);

  const finalAccount = accountState.records[0] ?? null;
  logStructured('final-state', {
    accountCount: accountState.totalSize,
    account: finalAccount,
    leadCount: leadState.totalSize,
    leads: leadState.records,
    accountLinkedToLead: Boolean(
      finalAccount?.IdProspectSalesforce__c && leadState.totalSize > 0,
    ),
    matchedLogCount: matchedLogs.length,
    summary: {
      insertOk: insertResult.ok,
      concurrentSuccessCount: requestResults.filter((r) => r.ok).length,
      concurrentNon2xxCount: requestResults.filter((r) => !r.ok).length,
      detectedLockError:
        detected.detectedLockError || requestResults.some((r) => r.detectedLockError) || insertResult.detectedLockError,
      detectedDmlException:
        detected.detectedDmlException || requestResults.some((r) => r.detectedDmlException) || insertResult.detectedDmlException,
    },
  });

  // cleanup
  for (const lead of leadState.records) {
    await restClient.deleteRecord('Lead', lead.Id);
  }
  for (const account of accountState.records) {
    await restClient.deleteRecord('Account', account.Id);
  }
  const controlAccountState = accountQuerySchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(createAccountStateQuery(idClienteX)),
    ),
  );
  for (const account of controlAccountState.records) {
    await restClient.deleteRecord('Account', account.Id);
  }
  const accountAfterCleanup = accountQuerySchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(createAccountStateQuery(idCliente)),
    ),
  );
  const controlAccountAfterCleanup = accountQuerySchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(createAccountStateQuery(idClienteX)),
    ),
  );
  const leadAfterCleanup = leadQuerySchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(createLeadStateQuery(idProspectX, cpf)),
    ),
  );
  logStructured('cleanup-result', {
    accountCountAfterCleanup: accountAfterCleanup.totalSize,
    controlAccountCountAfterCleanup: controlAccountAfterCleanup.totalSize,
    leadCountAfterCleanup: leadAfterCleanup.totalSize,
  });
}

main().catch((error: unknown) => {
  logStructured('o12-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
