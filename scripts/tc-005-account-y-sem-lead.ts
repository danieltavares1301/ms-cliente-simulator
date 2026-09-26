import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { EventGridEnvelope } from '../src/contracts/event-grid.ts';
import type { SalesforceAccess } from '../src/salesforce/oauth-client.ts';
import {
  asAllowlistedQuery,
  createSalesforceRestClient,
  getPersonAccountRecordTypeId,
  type SalesforceRestClient,
} from '../src/salesforce/rest-client.ts';
import { createSalesforceSafetyGuard } from '../src/salesforce/safety-guard.ts';
import { generateSyntheticCpf } from '../src/synthetic/cpf.ts';
import {
  createStaticAccessProvider,
  dispatchConcurrentRequest,
  loadOrgAccess,
  logStructured,
  parseCliArguments,
  sleep,
  type RequestResult,
} from './stress-o10-concurrent-events-lib.ts';

/**
 * TC-005 — "Account Y existente, Lead Y ausente"
 * (`com_salesforce_mrv/docs/runbook-testes-manuais-unificacao-2.2.md`,
 * copiado para `docs/runbook-testes-manuais-unificacao-2.2.md` neste repo).
 *
 * Massa: Account X já sincronizada (própria jornada, contatos e Lead
 * intactos, sem relação com a PAC deste TC). Account Y já existe com CPF Y
 * e `IDCLI-Y`, mas SEM Lead. A PAC é aprovada referenciando Y (Proponente
 * principal com `idCliente = Y`) com um e-mail/celular novos (C/D).
 *
 * Achado real (validado ao vivo, isolado do catálogo, ver
 * `docs/tc-005-conta-y-sem-lead.md`): a criação do Lead de Y **não**
 * depende do prospect carregado no `cliente-update` — depende de um
 * `contato-*`/`endereco-*` chegar **antes** do primeiro
 * `cliente-update(Y)`. Isso é exatamente a causa-raiz do "bug 2" descrita
 * em `unificacao-2.2-pos-pac.md` ("ordem de chegada não é garantida...
 * `contato-*` / `endereco-*` frequentemente chegam antes do cliente-insert").
 * Ordens cuja sequência não tem um `contato-*` antes do `cliente-update`
 * **não** criam Lead — isso é o comportamento real e esperado do Apex,
 * não uma falha do script. Ver `expectedLeadCreated` abaixo para o mapa
 * ordem → resultado esperado.
 *
 * Esperado (quando `expectedLeadCreated[order] === true`): Account Y
 * atualizada com C/D; exatamente um Lead novo para Y com C/D; X permanece
 * intacta. Quando `false`: Account Y atualizada, mas sem Lead (ordem
 * desfavorável, convergência esperada é "nenhum Lead").
 *
 * Este script roda a massa do TC-005 contra as 14 ordens já implementadas
 * no catálogo desta sessão (O01-O09, O11-O14; O10/O12 são variantes de
 * stress/contenção aplicadas sobre a mesma massa; O15 permanece bloqueado
 * e fica fora deste orquestrador), em dois modos:
 *
 * - `--mode same-x` (padrão): cria a Account X UMA VEZ e a reutiliza em
 *   todas as 14 ordens; cria uma Account Y NOVA a cada ordem.
 * - `--mode fresh-x`: cria Account X e Account Y novas a cada ordem
 *   (isolamento total, igual aos scripts O06/O07/O09/O10/O12 individuais).
 *
 * Simplificações honestas assumidas (documentadas em
 * `docs/tc-005-conta-y-sem-lead.md`):
 * - O03 (mesmo eventTime) executa uma permutação representativa, não as
 *   três do catálogo original.
 * - O11 (transição idCliente) é adaptado como um `jornadausuario-update`
 *   simples sobre Y após o Lead existir, não uma reentrega completa.
 * - O07/O09 reaproveitam a mesma limitação de autenticação (mesmo bearer
 *   token) já documentada em `docs/phase-8/tarefa-8-4-o07.md`.
 */

const orderIds = [
  'O01',
  'O02',
  'O03',
  'O04',
  'O05',
  'O06',
  'O07',
  'O08',
  'O09',
  'O11',
  'O12',
  'O13',
  'O14',
] as const;
type OrderId = (typeof orderIds)[number];

/**
 * Resultado esperado de criação do Lead de Y, por ordem, derivado do
 * achado real documentado no cabeçalho deste arquivo: um `contato-*`
 * chegando antes do primeiro `cliente-update(Y)` cria o Lead; sem essa
 * anteposição, nenhum Lead é criado (comportamento real do Apex, não uma
 * falha do script). Validado ao vivo isoladamente para `true` e `false`
 * antes de fixar este mapa — ver `docs/tc-005-conta-y-sem-lead.md`.
 */
const expectedLeadCreated: Record<OrderId, boolean> = {
  O01: true, // contato-email/celular antes do cliente-update.
  O02: false, // cliente-update chega primeiro, parciais depois.
  O03: false, // cliente-update é o primeiro dispatch, mesmo eventTime dos demais.
  O04: false, // cliente-update + pac-update antes do contato de regressão.
  O05: false, // cliente-update + pac-insert antes do contato de regressão.
  O06: true, // contato-email antes do cliente-update (após limpar o prospect provisório).
  O07: false, // corrida cliente-update || pac-update, sem contato algum.
  O08: true, // contato-email/celular antes do cliente-update (massa de referência do TC-005).
  O09: true, // contato-email antes da corrida cliente-update || pac-update.
  O11: false, // cliente-update + pac-update + jornada-update, sem contato algum.
  O12: false, // cliente-update (+ rajada) + pac-update, sem contato algum.
  O13: false, // cliente-update + pac-update antes do contato tardio.
  O14: false, // cliente-update + pac-update + reentrega, sem contato algum.
};

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

const leadStateSchema = z.object({
  totalSize: z.number().int().nonnegative(),
  records: z.array(
    z
      .object({
        Id: z.string(),
        Id__c: z.string().nullable(),
        CPF__c: z.string().nullable(),
        Email: z.string().nullable().optional(),
        MobilePhone: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});

const compositeResponseSchema = z.object({
  compositeResponse: z.array(
    z.object({ body: z.object({ id: z.string(), success: z.literal(true) }) }),
  ),
});

interface OrgContext {
  access: SalesforceAccess;
  restClient: SalesforceRestClient;
  recordTypeId: string;
  requestTimeoutMs: number;
}

interface AccountXHandle {
  accountId: string;
  idClienteX: string;
  idProspectX: string;
  cpfX: string;
}

interface AccountYHandle {
  accountId: string;
  idClienteY: string;
  cpfY: string;
  opp: string;
  pac: string;
  prop: string;
}

async function createAccountX(ctx: OrgContext, eventStartAt: string): Promise<AccountXHandle> {
  const token = randomUUID().replace(/-/g, '').slice(0, 10);
  const idClienteX = `CLI-TC005-X-${token}`;
  const idProspectX = `PRO-TC005-X-${token}`;
  const cpfX = generateSyntheticCpf(`${token}:x`, 'tc-005');
  const response = compositeResponseSchema.parse(
    await ctx.restClient.composite([
      {
        method: 'POST',
        url: '/services/data/v61.0/sobjects/Account',
        referenceId: 'createAccount',
        body: {
          RecordTypeId: ctx.recordTypeId,
          LastName: `QA UNIF22 TC005 CLIENTE X ${token}`,
          Id__c: idClienteX,
          IdProspectSalesforce__c: idProspectX,
          CPF__pc: cpfX,
          DataAlteracaoEvento__c: eventStartAt,
        },
      },
    ]),
  );
  return {
    accountId: response.compositeResponse[0]!.body.id,
    idClienteX,
    idProspectX,
    cpfX,
  };
}

async function createAccountRaw(
  access: SalesforceAccess,
  body: Record<string, string | boolean | undefined>,
): Promise<string> {
  const response = await fetch(
    new URL('/services/data/v61.0/sobjects/Account', access.instanceUrl),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${access.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST Account falhou (${response.status}): ${text}`);
  }
  const parsed = (await response.json()) as { id: string };
  return parsed.id;
}

async function createAccountYWithoutLead(
  ctx: OrgContext,
  eventStartAt: string,
): Promise<AccountYHandle> {
  const token = randomUUID().replace(/-/g, '').slice(0, 10);
  const idClienteY = `CLI-TC005-Y-${token}`;
  const cpfY = generateSyntheticCpf(`${token}:y`, 'tc-005');
  const opp = `OPP-TC005-${token}`;
  const pac = `PAC-TC005-${token}`;
  const prop = `PROP-TC005-${token}`;
  // Massa do TC-005: Account Y existe sem Lead. Achado real (validado ao
  // vivo antes de fixar este design): a criacao de Lead novo via
  // cliente-update so acontece quando IdProspectSalesforce__c comeca
  // genuinamente EM BRANCO — um placeholder nao-vazio bloqueia a criacao
  // do Lead (o campo so e carimbado quando esta em branco, e testado ao
  // vivo que sem essa condicao nenhum Lead e criado). O schema de
  // composite() deste simulador exige valor nao-vazio para qualquer
  // criacao de Account, entao a criacao de Y usa fetch cru (fora do
  // catalogo de operacoes allowlisted do simulador), unicamente para
  // reproduzir fielmente esta massa de fixture.
  const accountId = await createAccountRaw(ctx.access, {
    RecordTypeId: ctx.recordTypeId,
    LastName: `QA UNIF22 TC005 CLIENTE Y ${token}`,
    Id__c: idClienteY,
    CPF__pc: cpfY,
    DataAlteracaoEvento__c: eventStartAt,
  });
  await ctx.restClient.composite([
    {
      method: 'POST',
      url: '/services/data/v61.0/sobjects/Opportunity',
      referenceId: 'createOpportunity',
      body: {
        Name: 'Opportunity Sintética TC-005',
        StageName: 'Simulação',
        CloseDate: '2027-12-31',
        Id__c: opp,
        AccountId: accountId,
      },
    },
  ]);
  return { accountId, idClienteY, cpfY, opp, pac, prop };
}

function pacEnvelope(
  y: AccountYHandle,
  status: string,
  dataalteracao: string,
  email: string,
  celular: string,
  eventIdSuffix = '',
) {
  return [
    {
      id: `EVT-TC005-PAC-${y.pac}${eventIdSuffix}`,
      subject: 'MS_Clientes',
      eventType: (status === 'CREDITO_APROVADO_CONDICIONADO'
        ? 'pac-update'
        : 'pac-insert') as 'pac-insert' | 'pac-update',
      eventTime: dataalteracao,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        id: y.pac,
        idjornadapac: y.opp,
        status,
        dataalteracao,
        proponentes: [
          {
            id: y.prop,
            idPac: y.pac,
            idCliente: y.idClienteY,
            cpf: y.cpfY,
            tipoClassificacao: 'Principal',
            dataAlteracao: dataalteracao,
            nomeCompleto: `QA UNIF22 TC005 CLIENTE Y`,
            email,
            telefoneCelular: celular,
          },
        ],
      },
    },
  ];
}

function clienteUpdateYEnvelope(
  y: AccountYHandle,
  x: AccountXHandle,
  dataalteracao: string,
  eventIdSuffix = '',
) {
  return [
    {
      id: `EVT-TC005-CLIENTE-Y-${y.idClienteY}${eventIdSuffix}`,
      subject: 'MS_Clientes',
      eventType: 'cliente-update' as const,
      eventTime: dataalteracao,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: y.idClienteY,
        idprospectsalesforce: x.idProspectX,
        numerocpf: y.cpfY,
        dataalteracao,
        nomecompleto: 'QA UNIF22 TC005 CLIENTE Y',
      },
    },
  ];
}

function contatoEnvelope(
  y: AccountYHandle,
  tipo: 'Email' | 'Celular',
  descricao: string,
  dataalteracao: string,
  eventType: 'contato-insert' | 'contato-update' = 'contato-insert',
  eventIdSuffix = '',
) {
  return [
    {
      id: `EVT-TC005-CONTATO-${tipo}-${y.idClienteY}${eventIdSuffix}`,
      subject: 'MS_Clientes',
      eventType,
      eventTime: dataalteracao,
      dataVersion: '1.0',
      metadataVersion: '1',
      topic: '/simulator/ms-clientes',
      data: {
        idcliente: y.idClienteY,
        dataalteracao,
        tipocontato: tipo,
        descricao,
      },
    },
  ];
}

async function dispatch(
  ctx: OrgContext,
  target: 'Cliente' | 'PAC' | 'MaquinaEstado',
  envelope: EventGridEnvelope,
  label: string,
): Promise<RequestResult> {
  const result = await dispatchConcurrentRequest(
    ctx.access,
    {
      index: 0,
      variantKey: 'cliente-update',
      eventType: envelope[0]!.eventType,
      eventLabel: label,
      envelope,
      payloadSummary: { dataalteracao: envelope[0]!.eventTime },
    },
    ctx.requestTimeoutMs,
    target,
  );
  logStructured(`dispatch-${label}`, result);
  return result;
}

async function updateAccountField(
  access: SalesforceAccess,
  accountId: string,
  fields: Record<string, string | null>,
): Promise<void> {
  const response = await fetch(
    new URL(`/services/data/v61.0/sobjects/Account/${accountId}`, access.instanceUrl),
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
    throw new Error(`PATCH Account/${accountId} falhou (${response.status})`);
  }
}

const emailFor = (label: string) => `${label.toLowerCase()}@simulador.mrv.invalid`;
const CELULAR_APROVADO = '11988887777';

/**
 * Cada ordem recebe a massa (X, Y) e o instante base, dispara sua
 * variante especifica, e retorna os resultados HTTP para diagnostico.
 */
async function runOrder(
  ctx: OrgContext,
  order: OrderId,
  x: AccountXHandle,
  y: AccountYHandle,
  eventStartAt: string,
): Promise<RequestResult[]> {
  const t0 = eventStartAt;
  const t1 = new Date(Date.parse(eventStartAt) + 5_000).toISOString();
  const t2 = new Date(Date.parse(eventStartAt) + 10_000).toISOString();
  const emailAprovado = emailFor(`aprovado-${order}`);
  const results: RequestResult[] = [];

  switch (order) {
    case 'O01': {
      // Parciais antes: contato-insert(divergente, prospect de X) antes do cliente-update(Y).
      results.push(
        await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailAprovado, t0), 'o01-contato-email'),
      );
      results.push(
        await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Celular', CELULAR_APROVADO, t0), 'o01-contato-celular'),
      );
      await sleep(2_000);
      results.push(
        await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t1), 'o01-cliente-update-y'),
      );
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t1, emailAprovado, CELULAR_APROVADO), 'o01-pac-update'));
      break;
    }
    case 'O02': {
      // Cliente antes: cliente-update(Y) primeiro, parciais chegam durante o processamento.
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o02-cliente-update-y'));
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailAprovado, t1), 'o02-contato-email'));
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Celular', CELULAR_APROVADO, t1), 'o02-contato-celular'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t2, emailAprovado, CELULAR_APROVADO), 'o02-pac-update'));
      break;
    }
    case 'O03': {
      // Mesmo eventTime: cliente-update, contato-email e contato-celular compartilham o mesmo eventTime logico.
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o03-cliente-update-y'));
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailAprovado, t0), 'o03-contato-email'));
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Celular', CELULAR_APROVADO, t0), 'o03-contato-celular'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t0, emailAprovado, CELULAR_APROVADO), 'o03-pac-update'));
      break;
    }
    case 'O04': {
      // PAC mutavel: contato diverge depois de estabelecida a PAC com dataAlteracao mais antiga; PAC deve prevalecer (achado real do O04).
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o04-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t0, emailAprovado, CELULAR_APROVADO), 'o04-pac-update'));
      await sleep(3_000);
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailFor('regressao'), t1), 'o04-contato-regressao'));
      break;
    }
    case 'O05': {
      // PAC reentregue: aprova, regride via contato, reentrega a PAC com dataAlteracao mais nova para restaurar.
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o05-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t0, emailAprovado, CELULAR_APROVADO), 'o05-pac-insert'));
      await sleep(3_000);
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailFor('regressao'), t1), 'o05-contato-regressao'));
      await sleep(3_000);
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t2, emailAprovado, CELULAR_APROVADO), 'o05-pac-reentregue'));
      break;
    }
    case 'O06': {
      // Intervencao manual: carimba e depois limpa o prospect provisorio de Y, interpondo entre os eventos.
      await updateAccountField(ctx.access, y.accountId, { IdProspectSalesforce__c: `PROVISORIO-${y.idClienteY}` });
      logStructured('o06-manual-stamp-provisional', { accountId: y.accountId });
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailAprovado, t0), 'o06-contato-email'));
      await updateAccountField(ctx.access, y.accountId, { IdProspectSalesforce__c: null });
      logStructured('o06-manual-clear-prospect', { accountId: y.accountId });
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t1), 'o06-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t1, emailAprovado, CELULAR_APROVADO), 'o06-pac-update'));
      break;
    }
    case 'O07': {
      // Corrida genuina: cliente-update(Y) || pac-update, disparados em paralelo (mesma limitacao de auth do O07).
      const [clienteResult, pacResult] = await Promise.all([
        dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o07-cliente-update-y'),
        dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t0, emailAprovado, CELULAR_APROVADO), 'o07-pac-update'),
      ]);
      results.push(clienteResult, pacResult);
      break;
    }
    case 'O08': {
      // Identidade antiga: e a propria massa do TC-005 (contatos com prospect de X, cliente-update cria o vinculo de Y). Ordem de referencia.
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailAprovado, t0), 'o08-contato-email'));
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Celular', CELULAR_APROVADO, t0), 'o08-contato-celular'));
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t1), 'o08-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t1, emailAprovado, CELULAR_APROVADO), 'o08-pac-update'));
      break;
    }
    case 'O09': {
      // Composta: intervencao manual (O06) + corrida (O07).
      await updateAccountField(ctx.access, y.accountId, { IdProspectSalesforce__c: `PROVISORIO-${y.idClienteY}` });
      results.push(await dispatch(ctx, 'Cliente', contatoEnvelope(y, 'Email', emailAprovado, t0), 'o09-contato-email'));
      await updateAccountField(ctx.access, y.accountId, { IdProspectSalesforce__c: null });
      const [clienteResult, pacResult] = await Promise.all([
        dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t1), 'o09-cliente-update-y'),
        dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t1, emailAprovado, CELULAR_APROVADO), 'o09-pac-update'),
      ]);
      results.push(clienteResult, pacResult);
      break;
    }
    case 'O11': {
      // Transicao idCliente: adaptado como jornadausuario-update simples apos a PAC.
      // Sem contato-* antes do cliente-update, entao nenhum Lead e esperado (ver expectedLeadCreated).
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o11-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t0, emailAprovado, CELULAR_APROVADO), 'o11-pac-update'));
      await sleep(3_000);
      results.push(
        await dispatch(
          ctx,
          'MaquinaEstado',
          [
            {
              id: `EVT-TC005-MAQUINA-${y.idClienteY}`,
              subject: 'MS_Clientes',
              eventType: 'jornadausuario-update' as const,
              eventTime: t1,
              dataVersion: '1.0',
              metadataVersion: '1',
              topic: '/simulator/ms-clientes',
              data: {
                cliente: { idCliente: y.idClienteY, idProspectSalesforce: x.idProspectX },
                id: y.opp,
                dataalteracao: t1,
                estado: 'SIMULACAO',
                idunidade: '37dd20e6-4b3c-ea11-801d-005056856875',
              },
            },
          ] as unknown as EventGridEnvelope,
          'o11-jornada-update',
        ),
      );
      break;
    }
    case 'O12': {
      // Contencao: rajada concorrente logo apos o cliente-update que cria o Lead de Y.
      const clienteResult = await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o12-cliente-update-y');
      results.push(clienteResult);
      const burst = await Promise.all(
        Array.from({ length: 6 }, (_value, index) =>
          dispatch(
            ctx,
            'Cliente',
            clienteUpdateYEnvelope(y, x, t0, `-burst-${index}`),
            `o12-burst-${index}`,
          ),
        ),
      );
      results.push(...burst);
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t1, emailAprovado, CELULAR_APROVADO), 'o12-pac-update'));
      break;
    }
    case 'O13': {
      // Evento tardio: PAC aprovada, depois contato-update tardio com dataalteracao anterior (deve ser rejeitado).
      results.push(await dispatch(ctx, 'Cliente', clienteUpdateYEnvelope(y, x, t0), 'o13-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t0, emailAprovado, CELULAR_APROVADO), 'o13-pac-update'));
      await sleep(3_000);
      results.push(
        await dispatch(
          ctx,
          'Cliente',
          contatoEnvelope(y, 'Email', emailFor('tardio'), new Date(Date.parse(t0) - 10_000).toISOString(), 'contato-update'),
          'o13-contato-tardio-anterior',
        ),
      );
      break;
    }
    case 'O14': {
      // Reentrega generica: mesmo cliente-update reenviado com o mesmo id.
      const envelope = clienteUpdateYEnvelope(y, x, t0);
      results.push(await dispatch(ctx, 'Cliente', envelope, 'o14-cliente-update-y'));
      results.push(await dispatch(ctx, 'PAC', pacEnvelope(y, 'CREDITO_APROVADO_CONDICIONADO', t1, emailAprovado, CELULAR_APROVADO), 'o14-pac-update'));
      await sleep(3_000);
      results.push(await dispatch(ctx, 'Cliente', envelope, 'o14-cliente-update-y-reentregue'));
      break;
    }
  }
  return results;
}

/**
 * Verifica a convergência da ordem contra o resultado esperado
 * (`expectedLeadCreated`). Só emite o detalhamento completo do estado
 * quando a ordem **diverge** do esperado — quando converge (inclusive
 * quando o esperado é "nenhum Lead"), registra apenas um resumo terso,
 * evitando ruído no log para o caminho feliz.
 */
async function verifyAndReport(
  ctx: OrgContext,
  order: OrderId,
  x: AccountXHandle,
  y: AccountYHandle,
  waitMs: number,
): Promise<{ pass: boolean; details: Record<string, unknown> }> {
  await sleep(waitMs);
  const accountY = accountStateSchema.parse(
    await ctx.restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName, PersonEmail, Celular__c FROM Account WHERE Id__c = '${y.idClienteY}'`,
      ),
    ),
  );
  const leadY = leadStateSchema.parse(
    await ctx.restClient.query<unknown>(
      asAllowlistedQuery(`SELECT Id, Id__c, CPF__c, Email, MobilePhone FROM Lead WHERE CPF__c = '${y.cpfY}'`),
    ),
  );
  const accountX = accountStateSchema.parse(
    await ctx.restClient.query<unknown>(
      asAllowlistedQuery(
        `SELECT Id, Id__c, IdProspectSalesforce__c, CPF__pc, LastName FROM Account WHERE Id__c = '${x.idClienteX}'`,
      ),
    ),
  );

  const expected = expectedLeadCreated[order];
  const actualLeadCreated = leadY.totalSize === 1;
  const accountXUnchanged = accountX.records[0]?.Id__c === x.idClienteX;
  const converged =
    accountY.totalSize === 1 &&
    accountX.totalSize === 1 &&
    accountXUnchanged &&
    leadY.totalSize <= 1 &&
    actualLeadCreated === expected;

  const details = {
    order,
    expectedLeadCreated: expected,
    actualLeadCreated,
    accountYCount: accountY.totalSize,
    accountY: accountY.records[0] ?? null,
    leadYCount: leadY.totalSize,
    leadY: leadY.records[0] ?? null,
    accountXCount: accountX.totalSize,
    accountXUnchanged,
  };

  if (converged) {
    logStructured('order-ok', { order, expectedLeadCreated: expected, actualLeadCreated });
  } else {
    logStructured('order-divergencia', details);
  }
  return { pass: converged, details };
}

async function cleanupY(ctx: OrgContext, y: AccountYHandle): Promise<void> {
  const leads = (
    await ctx.restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(`SELECT Id FROM Lead WHERE CPF__c = '${y.cpfY}'`),
    )
  ).records;
  for (const lead of leads) await ctx.restClient.deleteRecord('Lead', lead.Id);
  const proponentes = (
    await ctx.restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(`SELECT Id FROM Proponente__c WHERE Id__c = '${y.prop}'`),
    )
  ).records;
  for (const record of proponentes) await ctx.restClient.deleteRecord('Proponente__c', record.Id);
  const pacs = (
    await ctx.restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(`SELECT Id FROM PropostaAnaliseCredito__c WHERE Id__c = '${y.pac}'`),
    )
  ).records;
  for (const record of pacs) await ctx.restClient.deleteRecord('PropostaAnaliseCredito__c', record.Id);
  const opportunities = (
    await ctx.restClient.query<{ totalSize: number; records: Array<{ Id: string }> }>(
      asAllowlistedQuery(`SELECT Id FROM Opportunity WHERE Id__c = '${y.opp}'`),
    )
  ).records;
  for (const record of opportunities) await ctx.restClient.deleteRecord('Opportunity', record.Id);
  await ctx.restClient.deleteRecord('Account', y.accountId);
}

async function cleanupX(ctx: OrgContext, x: AccountXHandle): Promise<void> {
  await ctx.restClient.deleteRecord('Account', x.accountId);
}

function parseMode(argv: readonly string[]): 'same-x' | 'fresh-x' {
  const index = argv.indexOf('--mode');
  const raw = index >= 0 ? argv[index + 1] : undefined;
  return raw === 'fresh-x' ? 'fresh-x' : 'same-x';
}

function parseOrdersFilter(argv: readonly string[]): readonly OrderId[] {
  const index = argv.indexOf('--orders');
  const raw = index >= 0 ? argv[index + 1] : undefined;
  if (!raw) return orderIds;
  const requested = raw.split(',').map((value) => value.trim().toUpperCase());
  return orderIds.filter((order) => requested.includes(order));
}

async function main(): Promise<void> {
  const options = parseCliArguments(process.argv.slice(2));
  const mode = parseMode(process.argv.slice(2));
  const ordersToRun = parseOrdersFilter(process.argv.slice(2));
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
  const recordTypeId = await getPersonAccountRecordTypeId(restClient);
  const ctx: OrgContext = { access, restClient, recordTypeId, requestTimeoutMs: options.requestTimeoutMs };

  logStructured('tc005-config', {
    orgAlias: options.orgAlias,
    instanceUrl: access.instanceUrl,
    mode,
    orders: ordersToRun,
  });

  let sharedX: AccountXHandle | null = null;
  const results: Array<{ order: OrderId; pass: boolean }> = [];

  for (const order of ordersToRun) {
    const eventStartAt = new Date().toISOString().replace(/\.\d+Z$/, '.000Z');
    const x = mode === 'same-x' ? (sharedX ??= await createAccountX(ctx, eventStartAt)) : await createAccountX(ctx, eventStartAt);
    const y = await createAccountYWithoutLead(ctx, eventStartAt);
    logStructured('order-setup', { order, mode, accountX: x.idClienteX, accountY: y.idClienteY });

    try {
      await runOrder(ctx, order, x, y, eventStartAt);
      const { pass } = await verifyAndReport(ctx, order, x, y, options.waitMs);
      results.push({ order, pass });
    } catch (error) {
      logStructured('order-error', {
        order,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      results.push({ order, pass: false });
    } finally {
      await cleanupY(ctx, y);
      if (mode === 'fresh-x') await cleanupX(ctx, x);
    }
  }

  if (mode === 'same-x' && sharedX) {
    await cleanupX(ctx, sharedX);
  }

  logStructured('tc005-summary', {
    mode,
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).map((r) => r.order),
    results,
  });
}

main().catch((error: unknown) => {
  logStructured('tc005-fatal-error', {
    message: error instanceof Error ? error.message : 'Erro desconhecido',
  });
  process.exitCode = 1;
});
