import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { SalesforceAccess } from '../src/salesforce/oauth-client.ts';
import {
  asAllowlistedQuery,
  createSalesforceRestClient,
  getPersonAccountRecordTypeId,
} from '../src/salesforce/rest-client.ts';
import { createSalesforceSafetyGuard } from '../src/salesforce/safety-guard.ts';
import { generateSyntheticCpf } from '../src/synthetic/cpf.ts';
import {
  createStaticAccessProvider,
  detectLockSignals,
  dispatchConcurrentRequest,
  loadOrgAccess,
  logStructured,
  parseCliArguments,
  sleep,
} from './stress-o10-concurrent-events-lib.ts';

const compositeResponseSchema = z.object({
  compositeResponse: z.array(
    z.object({ body: z.object({ id: z.string(), success: z.literal(true) }) }),
  ),
});

const accountStateSchema = z.object({
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
        Celular__c: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});

async function updateAccountField(
  access: SalesforceAccess,
  accountId: string,
  fields: Record<string, string | null>,
): Promise<void> {
  const response = await fetch(
    new URL(
      `/services/data/v61.0/sobjects/Account/${accountId}`,
      access.instanceUrl,
    ),
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${access.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(fields),
    },
  );
  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new Error(
      `PATCH Account/${accountId} falhou (${response.status}): ${body}`,
    );
  }
}

/**
 * Ferramenta diagnóstica dedicada ao perfil O09 ("Ordem composta Clarice"),
 * do catálogo de ordens de eventos do MS Cliente Pós-PAC.
 *
 * O próprio catálogo já reconhece que "nenhum perfil atual reproduz a cadeia
 * inteira" — mesmo o executor antigo. Esta implementação compõe, na ordem
 * descrita pelo catálogo, os dois mecanismos já validados isoladamente:
 * - O06 (intervenção manual): cria Account Y com prospect provisório,
 *   publica contatos divergentes, depois limpa o prospect via PATCH direto.
 * - O07 (corrida Queueable vs PAC): dispara `pac-update` aprovado e
 *   `cliente-update` verdadeiramente concorrentes (mesma limitação honesta
 *   de auth documentada no O07 — mesmo bearer token, conexões distintas).
 *
 * Não se assume nem se exige o estado intermediário exato do catálogo
 * ("Queueable lê estado ainda divergente e cria Lead com D0"). O script
 * valida a convergência final: a Account referenciada pela PAC (P) deve
 * terminar com os contatos aprovados (C/D), e a Account manualmente
 * criada (Y) deve terminar num estado consistente (sem duplicidade, sem
 * órfão), documentando o que for observado.
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
  const idClienteP = `CLI-SIM-O09-P-${token}`;
  const idProspectP = `PRO-SIM-O09-P-${token}`;
  const cpfP = generateSyntheticCpf(`${token}:p`, options.runId);
  const idClienteY = `CLI-SIM-O09-Y-${token}`;
  const provisionalProspectY = `PROVISORIO-${token}`;
  const cpfY = generateSyntheticCpf(`${token}:y`, options.runId);
  const opp = `OPP-SIM-O09-${token}`;
  const pac = `PAC-SIM-O09-${token}`;
  const prop = `PROP-SIM-O09-${token}`;
  const t0 = options.eventStartAt;

  logStructured('o09-config', {
    orgAlias: options.orgAlias,
    instanceUrl: access.instanceUrl,
    idClienteP,
    idClienteY,
    runId: options.runId,
    architecturalChoice:
      'Composicao de O06 (intervencao manual) + O07 (corrida concorrente), mesma limitacao de auth ja documentada.',
  });

  const recordTypeId = await getPersonAccountRecordTypeId(restClient);

  // Setup: Account P (referenciada pela PAC) + Opportunity
  const setupResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Account',
        referenceId: 'createAccount',
        body: {
          RecordTypeId: recordTypeId,
          LastName: `Cliente O09 P ${token}`,
          Id__c: idClienteP,
          IdProspectSalesforce__c: idProspectP,
          CPF__pc: cpfP,
          DataAlteracaoEvento__c: t0,
        },
      },
    ]),
  );
  const accountPId = setupResponse.compositeResponse[0]!.body.id;
  const oppResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Opportunity',
        referenceId: 'createOpportunity',
        body: {
          Name: 'Opportunity Sintética O09',
          StageName: 'Simulação',
          CloseDate: '2027-12-31',
          Id__c: opp,
          AccountId: accountPId,
        },
      },
    ]),
  );
  logStructured('setup-created', {
    accountPId,
    opportunityId: oppResponse.compositeResponse[0]!.body.id,
  });

  // Passo 1 [MANUAL]: cria Account Y com prospect provisorio
  const accountYResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Account',
        referenceId: 'createAccount',
        body: {
          RecordTypeId: recordTypeId,
          LastName: `Cliente O09 Y ${token}`,
          Id__c: idClienteY,
          IdProspectSalesforce__c: provisionalProspectY,
          CPF__pc: cpfY,
          DataAlteracaoEvento__c: t0,
        },
      },
    ]),
  );
  const accountYId = accountYResponse.compositeResponse[0]!.body.id;
  logStructured('step-1-manual-create-account-y-provisional', {
    accountYId,
    provisionalProspectY,
  });

  // Passo 2: contato-insert Email/Celular C0/D0, em Y
  const contatoEmailResult = await dispatchConcurrentRequest(
    access,
    {
      index: 2,
      variantKey: 'contato-insert-email',
      eventType: 'contato-insert',
      eventLabel: 'contato-insert-email-y',
      envelope: [
        {
          id: `EVT-O09-CONTATO-EMAIL-${token}`,
          subject: 'MS_Clientes',
          eventType: 'contato-insert',
          eventTime: t0,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idClienteY,
            dataalteracao: t0,
            tipocontato: 'Email',
            descricao: `divergente.${token}@simulador.mrv.invalid`,
          },
        },
      ],
      payloadSummary: { dataalteracao: t0 },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  const contatoCelularResult = await dispatchConcurrentRequest(
    access,
    {
      index: 3,
      variantKey: 'contato-insert-celular',
      eventType: 'contato-insert',
      eventLabel: 'contato-insert-celular-y',
      envelope: [
        {
          id: `EVT-O09-CONTATO-CELULAR-${token}`,
          subject: 'MS_Clientes',
          eventType: 'contato-insert',
          eventTime: t0,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idClienteY,
            dataalteracao: t0,
            tipocontato: 'Celular',
            descricao: '11977776666',
          },
        },
      ],
      payloadSummary: { dataalteracao: t0 },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  logStructured('step-2-3-contatos-divergentes-y', {
    contatoEmailResult,
    contatoCelularResult,
  });
  await sleep(4_000);

  // Passo 4 [MANUAL]: limpa o prospect provisorio de Y
  await updateAccountField(access, accountYId, {
    IdProspectSalesforce__c: null,
  });
  logStructured('step-4-manual-clear-account-y-prospect', { accountYId });

  // Passo 5: CORRIDA GENUINA (mesma tecnica do O07) - pac-update aprovado
  // (referenciando P) || cliente-update(P), disparados em paralelo.
  const raceEventTime = new Date(Date.parse(t0) + 8_000).toISOString();
  const raceStartedAt = new Date();
  const [pacUpdateResult, clienteUpdatePResult] = await Promise.all([
    dispatchConcurrentRequest(
      access,
      {
        index: 5,
        variantKey: 'cliente-update',
        eventType: 'pac-update',
        eventLabel: 'pac-update-aprovado',
        envelope: [
          {
            id: `EVT-O09-PAC-UPDATE-${token}`,
            subject: 'MS_Clientes',
            eventType: 'pac-update',
            eventTime: raceEventTime,
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              id: pac,
              idjornadapac: opp,
              status: 'CREDITO_APROVADO_CONDICIONADO',
              dataalteracao: raceEventTime,
              proponentes: [
                {
                  id: prop,
                  idPac: pac,
                  idCliente: idClienteP,
                  cpf: cpfP,
                  tipoClassificacao: 'Principal',
                  dataAlteracao: raceEventTime,
                  nomeCompleto: `Cliente O09 P ${token}`,
                  email: `aprovado.${token}@simulador.mrv.invalid`,
                  telefoneCelular: '11988887777',
                },
              ],
            },
          },
        ],
        payloadSummary: { dataalteracao: raceEventTime },
      },
      options.requestTimeoutMs,
      'PAC',
    ),
    dispatchConcurrentRequest(
      access,
      {
        index: 6,
        variantKey: 'cliente-update',
        eventType: 'cliente-update',
        eventLabel: 'cliente-update-p',
        envelope: [
          {
            id: `EVT-O09-CLIENTE-UPDATE-P-${token}`,
            subject: 'MS_Clientes',
            eventType: 'cliente-update',
            eventTime: raceEventTime,
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/simulator/ms-clientes',
            data: {
              idcliente: idClienteP,
              idprospectsalesforce: idProspectP,
              numerocpf: cpfP,
              dataalteracao: raceEventTime,
              nomecompleto: `Cliente O09 P ${token}`,
            },
          },
        ],
        payloadSummary: { dataalteracao: raceEventTime },
      },
      options.requestTimeoutMs,
      'Cliente',
    ),
  ]);
  const raceFinishedAt = new Date();
  logStructured('step-5-6-race-results', {
    windowMs: raceFinishedAt.getTime() - raceStartedAt.getTime(),
    pacUpdateResult,
    clienteUpdatePResult,
  });

  // Passo 7: cliente-update(Y), apos o prospect provisorio ter sido limpo
  const clienteUpdateYResult = await dispatchConcurrentRequest(
    access,
    {
      index: 7,
      variantKey: 'cliente-update',
      eventType: 'cliente-update',
      eventLabel: 'cliente-update-y-final',
      envelope: [
        {
          id: `EVT-O09-CLIENTE-UPDATE-Y-${token}`,
          subject: 'MS_Clientes',
          eventType: 'cliente-update',
          eventTime: raceEventTime,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idClienteY,
            numerocpf: cpfY,
            dataalteracao: raceEventTime,
            nomecompleto: `Cliente O09 Y ${token}`,
          },
        },
      ],
      payloadSummary: { dataalteracao: raceEventTime },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  logStructured('step-7-cliente-update-y-final', clienteUpdateYResult);

  logStructured('post-dispatch-wait', { waitMs: options.waitMs });
  await sleep(options.waitMs);

  const accountPState = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, PersonEmail, Celular__c FROM Account WHERE Id__c = '${idClienteP}'`,
      ),
    ),
  );
  const accountYState = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, PersonEmail, Celular__c FROM Account WHERE Id__c = '${idClienteY}'`,
      ),
    ),
  );

  const allResults = [
    contatoEmailResult,
    contatoCelularResult,
    pacUpdateResult,
    clienteUpdatePResult,
    clienteUpdateYResult,
  ];
  const aggregatedText = allResults.map((r) => r.responseText).join('\n');
  const detected = detectLockSignals(aggregatedText);

  logStructured('final-state', {
    accountP: accountPState.records[0] ?? null,
    accountY: accountYState.records[0] ?? null,
    accountPConvergedToApproved:
      accountPState.records[0]?.PersonEmail ===
      `aprovado.${token}@simulador.mrv.invalid`,
    accountYHasDivergentContacts:
      accountYState.records[0]?.PersonEmail ===
      `divergente.${token}@simulador.mrv.invalid`,
    accountYProspectHealed: Boolean(
      accountYState.records[0]?.IdProspectSalesforce__c &&
        accountYState.records[0]?.IdProspectSalesforce__c !==
          provisionalProspectY,
    ),
    summary: {
      allStepsOk: allResults.every((r) => r.ok),
      detectedLockError:
        detected.detectedLockError || allResults.some((r) => r.detectedLockError),
      detectedDmlException:
        detected.detectedDmlException ||
        allResults.some((r) => r.detectedDmlException),
    },
  });

  // cleanup
  const proponentes = (
    await restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(`SELECT Id FROM Proponente__c WHERE Id__c = '${prop}'`),
    )
  ).records;
  for (const record of proponentes) {
    await restClient.deleteRecord('Proponente__c', record.Id);
  }
  const pacs = (
    await restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(
        `SELECT Id FROM PropostaAnaliseCredito__c WHERE Id__c = '${pac}'`,
      ),
    )
  ).records;
  for (const record of pacs) {
    await restClient.deleteRecord('PropostaAnaliseCredito__c', record.Id);
  }
  const opportunities = (
    await restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(`SELECT Id FROM Opportunity WHERE Id__c = '${opp}'`),
    )
  ).records;
  for (const record of opportunities) {
    await restClient.deleteRecord('Opportunity', record.Id);
  }
  for (const record of accountPState.records) {
    await restClient.deleteRecord('Account', record.Id);
  }
  for (const record of accountYState.records) {
    await restClient.deleteRecord('Account', record.Id);
  }

  const accountPAfterCleanup = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c FROM Account WHERE Id__c = '${idClienteP}'`,
      ),
    ),
  );
  const accountYAfterCleanup = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c FROM Account WHERE Id__c = '${idClienteY}'`,
      ),
    ),
  );
  logStructured('cleanup-result', {
    accountPCountAfterCleanup: accountPAfterCleanup.totalSize,
    accountYCountAfterCleanup: accountYAfterCleanup.totalSize,
  });
}

main().catch((error: unknown) => {
  logStructured('o09-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
