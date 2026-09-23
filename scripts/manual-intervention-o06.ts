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
    z.object({
      body: z.object({ id: z.string(), success: z.literal(true) }),
    }),
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

/**
 * Ferramenta diagnóstica dedicada ao perfil O06 ("Intervenção manual
 * Pós-PAC"), do catálogo de ordens de eventos do MS Cliente Pós-PAC.
 *
 * Decisão arquitetural (discutida e aprovada explicitamente antes desta
 * implementação): fica fora do catálogo declarativo, como O10/O12. O motivo
 * é duplo: (1) o orquestrador `ScenarioDefinition`/QStash é sequencial por
 * design e não tem noção de "pausar para ação humana"; (2) o próprio O06 é
 * intrinsecamente manual — o catálogo já marca as duas ações como
 * `[MANUAL]`, ou seja, nunca foi pensado como fluxo self-service via API.
 * Construir um mecanismo de checkpoint administrativo no motor compartilhado
 * (usado por outros 45 cenários) seria um risco desproporcional ao ganho.
 *
 * Adaptação de cronologia (mesmo princípio já usado no O05): a PAC exige
 * Account/Opportunity já existentes (achado real confirmado no O05), então
 * a Account X é criada como pré-condição de setup, não "depois" da PAC como
 * o catálogo original sugere. As duas ações `[MANUAL]` são executadas pelo
 * próprio script via REST direto (Account.IdProspectSalesforce__c), no
 * ponto exato da sequência, sem passar pelas operações allowlisted do
 * catálogo (que hoje só suportam CREATE/DELETE, não UPDATE de campo
 * arbitrário — a atualização manual é, por definição, a capacidade que não
 * existe em nenhum outro lugar do simulador).
 */

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
  const idClienteX = `CLI-SIM-O06-X-${token}`;
  const idProspectX = `PRO-SIM-O06-X-${token}`;
  const cpfX = generateSyntheticCpf(`${token}:x`, options.runId);
  const idClienteY = `CLI-SIM-O06-Y-${token}`;
  const provisionalProspectY = `PROVISORIO-${token}`;
  const cpfY = generateSyntheticCpf(`${token}:y`, options.runId);
  const opp = `OPP-SIM-O06-${token}`;
  const pac = `PAC-SIM-O06-${token}`;
  const prop = `PROP-SIM-O06-${token}`;
  const eventStartAt = options.eventStartAt;
  const t0 = eventStartAt;
  const t1 = new Date(Date.parse(eventStartAt) + 10_000).toISOString();

  logStructured('o06-config', {
    orgAlias: options.orgAlias,
    instanceUrl: access.instanceUrl,
    idClienteX,
    idClienteY,
    runId: options.runId,
    architecturalChoice:
      'Script dedicado (aprovado explicitamente); acoes MANUAL executadas como PATCH REST direto na Account.',
  });

  const recordTypeId = await getPersonAccountRecordTypeId(restClient);

  // Setup (pre-condicao real confirmada no O05: PAC exige Account+Opportunity existentes)
  const setupRequests: SalesforceCompositeRequest[] = [
    {
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Account',
      referenceId: 'createAccount',
      body: {
        RecordTypeId: recordTypeId,
        LastName: `Cliente O06 X ${token}`,
        Id__c: idClienteX,
        IdProspectSalesforce__c: idProspectX,
        CPF__pc: cpfX,
        DataAlteracaoEvento__c: t0,
      },
    },
  ];
  const setupResponse = compositeResponseSchema.parse(
    await restClient.composite(setupRequests),
  );
  const accountXId = setupResponse.compositeResponse[0]!.body.id;
  logStructured('setup-account-x-created', { accountXId, idClienteX });

  const oppResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Opportunity',
        referenceId: 'createOpportunity',
        body: {
          Name: 'Opportunity Sintética O06',
          StageName: 'Simulação',
          CloseDate: '2027-12-31',
          Id__c: opp,
          AccountId: accountXId,
        },
      },
    ]),
  );
  logStructured('setup-opportunity-created', {
    opportunityId: oppResponse.compositeResponse[0]!.body.id,
    opp,
  });

  // Passo 1: pac-insert aprovada, referenciando X
  const pacInsertResult = await dispatchConcurrentRequest(
    access,
    {
      index: 1,
      variantKey: 'cliente-update',
      eventType: 'pac-insert',
      eventLabel: 'pac-insert-aprovada',
      envelope: [
        {
          id: `EVT-O06-PAC-INSERT-${token}`,
          subject: 'MS_Clientes',
          eventType: 'pac-insert',
          eventTime: t0,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            id: pac,
            idjornadapac: opp,
            status: 'CREDITO_APROVADO_CONDICIONADO',
            dataalteracao: t0,
            proponentes: [
              {
                id: prop,
                idPac: pac,
                idCliente: idClienteX,
                cpf: cpfX,
                tipoClassificacao: 'Principal',
                dataAlteracao: t0,
                nomeCompleto: `Cliente O06 X ${token}`,
                email: `aprovado.${token}@simulador.mrv.invalid`,
                telefoneCelular: '11988887777',
              },
            ],
          },
        },
      ],
      payloadSummary: { dataalteracao: t0 },
    },
    options.requestTimeoutMs,
    'PAC',
  );
  logStructured('step-1-pac-insert-aprovada', pacInsertResult);
  await sleep(6_000);

  // Passo 2 [MANUAL]: cria Account Y com prospect provisorio
  const accountYResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Account',
        referenceId: 'createAccount',
        body: {
          RecordTypeId: recordTypeId,
          LastName: `Cliente O06 Y ${token}`,
          Id__c: idClienteY,
          IdProspectSalesforce__c: provisionalProspectY,
          CPF__pc: cpfY,
          DataAlteracaoEvento__c: t0,
        },
      },
    ]),
  );
  const accountYId = accountYResponse.compositeResponse[0]!.body.id;
  logStructured('step-2-manual-create-account-y-provisional', {
    accountYId,
    idClienteY,
    provisionalProspectY,
  });

  // Passo 3: cliente-update(X) - reforco real via /Cliente
  const clienteUpdateXResult = await dispatchConcurrentRequest(
    access,
    {
      index: 3,
      variantKey: 'cliente-update',
      eventType: 'cliente-update',
      eventLabel: 'cliente-update-x',
      envelope: [
        {
          id: `EVT-O06-CLIENTE-UPDATE-X-${token}`,
          subject: 'MS_Clientes',
          eventType: 'cliente-update',
          eventTime: t0,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idClienteX,
            idprospectsalesforce: idProspectX,
            numerocpf: cpfX,
            dataalteracao: t0,
            nomecompleto: `Cliente O06 X ${token}`,
          },
        },
      ],
      payloadSummary: { dataalteracao: t0 },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  logStructured('step-3-cliente-update-x', clienteUpdateXResult);

  // Passo 4: contato-insert Email/Celular divergentes de C/D, em Y
  const contatoEmailResult = await dispatchConcurrentRequest(
    access,
    {
      index: 4,
      variantKey: 'contato-insert-email',
      eventType: 'contato-insert',
      eventLabel: 'contato-insert-email-y',
      envelope: [
        {
          id: `EVT-O06-CONTATO-EMAIL-Y-${token}`,
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
  logStructured('step-4-contato-insert-email-y', contatoEmailResult);

  // Passo 5 [MANUAL]: limpa o prospect provisorio de Y
  await updateAccountField(access, accountYId, {
    IdProspectSalesforce__c: null,
  });
  logStructured('step-5-manual-clear-account-y-prospect', { accountYId });

  // Passo 6: pac-update aprovada REENTREGUE, referenciando X, dataAlteracao mais nova
  const pacUpdateResult = await dispatchConcurrentRequest(
    access,
    {
      index: 6,
      variantKey: 'cliente-update',
      eventType: 'pac-update',
      eventLabel: 'pac-update-reentregue',
      envelope: [
        {
          id: `EVT-O06-PAC-UPDATE-${token}`,
          subject: 'MS_Clientes',
          eventType: 'pac-update',
          eventTime: t1,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            id: pac,
            idjornadapac: opp,
            status: 'CREDITO_APROVADO_CONDICIONADO',
            dataalteracao: t1,
            proponentes: [
              {
                id: prop,
                idPac: pac,
                idCliente: idClienteX,
                cpf: cpfX,
                tipoClassificacao: 'Principal',
                dataAlteracao: t1,
                nomeCompleto: `Cliente O06 X ${token}`,
                email: `aprovado.${token}@simulador.mrv.invalid`,
                telefoneCelular: '11988887777',
              },
            ],
          },
        },
      ],
      payloadSummary: { dataalteracao: t1 },
    },
    options.requestTimeoutMs,
    'PAC',
  );
  logStructured('step-6-pac-update-reentregue', pacUpdateResult);

  // Passo 7: cliente-update(X) final
  const clienteUpdateXFinalResult = await dispatchConcurrentRequest(
    access,
    {
      index: 7,
      variantKey: 'cliente-update',
      eventType: 'cliente-update',
      eventLabel: 'cliente-update-x-final',
      envelope: [
        {
          id: `EVT-O06-CLIENTE-UPDATE-X-FINAL-${token}`,
          subject: 'MS_Clientes',
          eventType: 'cliente-update',
          eventTime: t1,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idClienteX,
            idprospectsalesforce: idProspectX,
            numerocpf: cpfX,
            dataalteracao: t1,
            nomecompleto: `Cliente O06 X ${token}`,
          },
        },
      ],
      payloadSummary: { dataalteracao: t1 },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  logStructured('step-7-cliente-update-x-final', clienteUpdateXFinalResult);

  // Passo 8: cliente-update(Y) final, apos o prospect provisorio ter sido limpo
  const clienteUpdateYFinalResult = await dispatchConcurrentRequest(
    access,
    {
      index: 8,
      variantKey: 'cliente-update',
      eventType: 'cliente-update',
      eventLabel: 'cliente-update-y-final',
      envelope: [
        {
          id: `EVT-O06-CLIENTE-UPDATE-Y-FINAL-${token}`,
          subject: 'MS_Clientes',
          eventType: 'cliente-update',
          eventTime: t1,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idClienteY,
            numerocpf: cpfY,
            dataalteracao: t1,
            nomecompleto: `Cliente O06 Y ${token}`,
          },
        },
      ],
      payloadSummary: { dataalteracao: t1 },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  logStructured('step-8-cliente-update-y-final', clienteUpdateYFinalResult);

  logStructured('post-dispatch-wait', { waitMs: options.waitMs });
  await sleep(options.waitMs);

  const accountXState = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, PersonEmail, Celular__c FROM Account WHERE Id__c = '${idClienteX}'`,
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
    pacInsertResult,
    clienteUpdateXResult,
    contatoEmailResult,
    pacUpdateResult,
    clienteUpdateXFinalResult,
    clienteUpdateYFinalResult,
  ];
  const aggregatedText = allResults.map((r) => r.responseText).join('\n');
  const detected = detectLockSignals(aggregatedText);

  logStructured('final-state', {
    accountX: accountXState.records[0] ?? null,
    accountY: accountYState.records[0] ?? null,
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
  for (const record of accountXState.records) {
    await restClient.deleteRecord('Account', record.Id);
  }
  for (const record of accountYState.records) {
    await restClient.deleteRecord('Account', record.Id);
  }

  const accountXAfterCleanup = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c FROM Account WHERE Id__c = '${idClienteX}'`,
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
    accountXCountAfterCleanup: accountXAfterCleanup.totalSize,
    accountYCountAfterCleanup: accountYAfterCleanup.totalSize,
  });
}

main().catch((error: unknown) => {
  logStructured('o06-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
