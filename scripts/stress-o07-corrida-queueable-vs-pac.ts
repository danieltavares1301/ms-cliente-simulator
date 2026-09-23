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

/**
 * Ferramenta diagnóstica dedicada ao perfil O07 ("Corrida Queueable versus
 * PAC"), do catálogo de ordens de eventos do MS Cliente Pós-PAC.
 *
 * Limite honesto e real (não contornável com as ferramentas disponíveis
 * neste ambiente): o catálogo exige "conexões HTTP e contextos de
 * autenticação independentes; não reutilizar uma única sessão serializada".
 * Testado ao vivo antes de escrever este script: `sf org display` sempre
 * retorna o MESMO token de sessão em cache, chamada após chamada — não há
 * como obter um token OAuth genuinamente independente sem uma Connected
 * App/External Client App dedicada (fora do escopo desta tarefa). Este
 * script portanto reutiliza o mesmo bearer token entre as duas requisições
 * concorrentes (igual ao experimento O10, mesma limitação já documentada
 * em docs/phase-6/o10-stress-concorrencia.md), mas usa `fetch` com
 * `keepalive: false` e conexões TCP distintas para maximizar a
 * independência de transporte que é alcançável.
 *
 * Duas variantes formais do catálogo, executadas em runs separados deste
 * mesmo script (`--variant cq-x` ou `--variant cq-y`):
 * - CQ-X: cliente-update reforça a própria identidade da Account (mesmo
 *   idcliente/idprospectsalesforce já existentes) || pac-update aprovado.
 * - CQ-Y: cliente-update carrega um idprospectsalesforce DIFERENTE
 *   (simulando uma identidade Y distinta) || pac-update aprovado.
 *
 * Não se assume nem se exige um vencedor fixo. O script apenas dispara a
 * corrida genuína e documenta o resultado observado, validando somente os
 * invariantes gerais (nenhuma Account duplicada, nenhum erro de lock/DML).
 */

const variantSchema = z.enum(['cq-x', 'cq-y']);

function parseVariant(argv: readonly string[]): 'cq-x' | 'cq-y' {
  const index = argv.indexOf('--variant');
  const raw = index >= 0 ? argv[index + 1] : undefined;
  return variantSchema.parse(raw ?? 'cq-x');
}

async function main(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
  const variant = parseVariant(process.argv.slice(2));
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
  const idCliente = `CLI-SIM-O07-${token}`;
  const idProspect = `PRO-SIM-O07-${token}`;
  const idProspectY = `PRO-SIM-O07-Y-${token}`;
  const cpf = generateSyntheticCpf(token, options.runId);
  const opp = `OPP-SIM-O07-${token}`;
  const pac = `PAC-SIM-O07-${token}`;
  const prop = `PROP-SIM-O07-${token}`;
  const eventStartAt = options.eventStartAt;

  logStructured('o07-config', {
    orgAlias: options.orgAlias,
    instanceUrl: access.instanceUrl,
    variant,
    idCliente,
    runId: options.runId,
    knownLimitation:
      'sf org display retorna sempre o mesmo token de sessao em cache; nao ha contexto de autenticacao genuinamente independente disponivel neste ambiente (testado ao vivo antes de escrever este script).',
  });

  const recordTypeId = await getPersonAccountRecordTypeId(restClient);
  const setupResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Account',
        referenceId: 'createAccount',
        body: {
          RecordTypeId: recordTypeId,
          LastName: `Cliente O07 ${token}`,
          Id__c: idCliente,
          IdProspectSalesforce__c: idProspect,
          CPF__pc: cpf,
          DataAlteracaoEvento__c: eventStartAt,
        },
      },
    ]),
  );
  const accountId = setupResponse.compositeResponse[0]!.body.id;
  logStructured('setup-account-created', { accountId, idCliente });

  const oppResponse = compositeResponseSchema.parse(
    await restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Opportunity',
        referenceId: 'createOpportunity',
        body: {
          Name: 'Opportunity Sintética O07',
          StageName: 'Simulação',
          CloseDate: '2027-12-31',
          Id__c: opp,
          AccountId: accountId,
        },
      },
    ]),
  );
  logStructured('setup-opportunity-created', {
    opportunityId: oppResponse.compositeResponse[0]!.body.id,
  });

  // Passo 1: contato-insert (C0/D0), divergente do C/D que a PAC vai aprovar
  const contatoEmailResult = await dispatchConcurrentRequest(
    access,
    {
      index: 1,
      variantKey: 'contato-insert-email',
      eventType: 'contato-insert',
      eventLabel: 'contato-insert-email',
      envelope: [
        {
          id: `EVT-O07-CONTATO-${token}`,
          subject: 'MS_Clientes',
          eventType: 'contato-insert',
          eventTime: eventStartAt,
          dataVersion: '1.0',
          metadataVersion: '1',
          topic: '/simulator/ms-clientes',
          data: {
            idcliente: idCliente,
            dataalteracao: eventStartAt,
            tipocontato: 'Email',
            descricao: `divergente.${token}@simulador.mrv.invalid`,
          },
        },
      ],
      payloadSummary: { dataalteracao: eventStartAt },
    },
    options.requestTimeoutMs,
    'Cliente',
  );
  logStructured('step-1-contato-insert', contatoEmailResult);
  await sleep(3_000);

  // Passo 2: CORRIDA GENUINA - cliente-update e pac-update disparados em
  // paralelo (Promise.all, fetch com keepalive:false para maximizar
  // independencia de transporte).
  const raceEventTime = new Date(
    Date.parse(eventStartAt) + 5_000,
  ).toISOString();
  const clienteUpdateEnvelope = [
    {
      id: `EVT-O07-CLIENTE-UPDATE-${token}`,
      subject: 'MS_Clientes',
      eventType: 'cliente-update' as const,
      eventTime: raceEventTime,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: idCliente,
        idprospectsalesforce: variant === 'cq-y' ? idProspectY : idProspect,
        numerocpf: cpf,
        dataalteracao: raceEventTime,
        nomecompleto: `Cliente O07 ${variant.toUpperCase()} ${token}`,
      },
    },
  ];
  const pacUpdateEnvelope = [
    {
      id: `EVT-O07-PAC-UPDATE-${token}`,
      subject: 'MS_Clientes',
      eventType: 'pac-update' as const,
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
            idCliente: idCliente,
            cpf,
            tipoClassificacao: 'Principal',
            dataAlteracao: raceEventTime,
            nomeCompleto: `Cliente O07 ${token}`,
            email: `aprovado.${token}@simulador.mrv.invalid`,
            telefoneCelular: '11988887777',
          },
        ],
      },
    },
  ];

  const raceStartedAt = new Date();
  const [clienteUpdateResult, pacUpdateResult] = await Promise.all([
    dispatchConcurrentRequest(
      access,
      {
        index: 2,
        variantKey: 'cliente-update',
        eventType: 'cliente-update',
        eventLabel: `cliente-update-${variant}`,
        envelope: clienteUpdateEnvelope,
        payloadSummary: { dataalteracao: raceEventTime },
      },
      options.requestTimeoutMs,
      'Cliente',
    ),
    dispatchConcurrentRequest(
      access,
      {
        index: 3,
        variantKey: 'cliente-update',
        eventType: 'pac-update',
        eventLabel: 'pac-update-aprovado',
        envelope: pacUpdateEnvelope,
        payloadSummary: { dataalteracao: raceEventTime },
      },
      options.requestTimeoutMs,
      'PAC',
    ),
  ]);
  const raceFinishedAt = new Date();
  logStructured('step-2-race-results', {
    variant,
    windowMs: raceFinishedAt.getTime() - raceStartedAt.getTime(),
    clienteUpdate: clienteUpdateResult,
    pacUpdate: pacUpdateResult,
  });

  logStructured('post-dispatch-wait', { waitMs: options.waitMs });
  await sleep(options.waitMs);

  const accountState = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, PersonEmail, Celular__c FROM Account WHERE Id__c = '${idCliente}'`,
      ),
    ),
  );
  const finalAccount = accountState.records[0] ?? null;
  const winner =
    finalAccount?.PersonEmail === `aprovado.${token}@simulador.mrv.invalid`
      ? 'pac-update'
      : finalAccount?.PersonEmail?.startsWith('divergente.')
        ? 'contato-insert (nenhum dos dois da corrida escreveu email)'
        : 'indeterminado';

  const aggregatedText = [
    contatoEmailResult.responseText,
    clienteUpdateResult.responseText,
    pacUpdateResult.responseText,
  ].join('\n');
  const detected = detectLockSignals(aggregatedText);

  logStructured('final-state', {
    variant,
    account: finalAccount,
    accountCount: accountState.totalSize,
    winnerHeuristic: winner,
    summary: {
      contatoInsertOk: contatoEmailResult.ok,
      clienteUpdateOk: clienteUpdateResult.ok,
      pacUpdateOk: pacUpdateResult.ok,
      detectedLockError:
        detected.detectedLockError ||
        clienteUpdateResult.detectedLockError ||
        pacUpdateResult.detectedLockError,
      detectedDmlException:
        detected.detectedDmlException ||
        clienteUpdateResult.detectedDmlException ||
        pacUpdateResult.detectedDmlException,
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
  for (const record of accountState.records) {
    await restClient.deleteRecord('Account', record.Id);
  }
  const accountAfterCleanup = accountStateSchema.parse(
    await restClient.query<unknown>(
      asAllowlistedQuery(`SELECT Id, Id__c FROM Account WHERE Id__c = '${idCliente}'`),
    ),
  );
  logStructured('cleanup-result', {
    accountCountAfterCleanup: accountAfterCleanup.totalSize,
  });
}

main().catch((error: unknown) => {
  logStructured('o07-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
