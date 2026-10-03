import { afterEach, describe, expect, it, vi } from 'vitest';

import { SalesforceNetworkError } from '../../src/salesforce/network-policy.ts';
import { SalesforceRestError } from '../../src/salesforce/rest-client.ts';
import { Execucao, FalhaDeEvento, type AccountRegistro, type Aprovacao } from './engine.ts';
import { FalhaDeRede } from './rede.ts';
import type { TargetOrgConnection } from '../stress-o10-concurrent-events-lib.ts';

// Conexão falsa: nada aqui toca a org.
const access = { accessToken: 'token', instanceUrl: 'https://exemplo.my.salesforce.com' };
const vazio = { totalSize: 0, records: [] };

function conexaoFalsa(
  query: (soql: string) => Promise<unknown>,
  extras: {
    composite?: () => Promise<unknown>;
    deleteRecord?: (objeto: string, id: string) => Promise<void>;
  } = {},
) {
  const restClient = {
    query: vi.fn(query),
    composite: vi.fn(extras.composite ?? (async () => ({ compositeResponse: [] }))),
    deleteRecord: vi.fn(extras.deleteRecord ?? (async () => undefined)),
  };
  const conexao = {
    access,
    safetyGuard: { validate: async () => access },
    restClient,
  } as unknown as TargetOrgConnection;
  return { conexao, restClient };
}

const quedaSalesforce = () => new SalesforceNetworkError('SALESFORCE_NETWORK_ERROR');

const contaX: AccountRegistro = {
  Id: '001HZ000000XXXXAAA',
  Id__c: 'IDCLI-X',
  IdProspectSalesforce__c: 'PROS-X',
  CPF__pc: '12345678909',
  LastName: 'QA UNIF22 X',
  PersonEmail: 'qa.x@example.com',
  Celular__c: '31980000000',
  CreatedDate: '2026-10-02T12:00:00.000+0000',
  LastModifiedDate: '2026-10-02T12:00:00.000+0000',
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('limpar com falha de rede', () => {
  it('sem a descoberta, apaga o que conhece e deixa o resíduo não verificado (null, e não 0)', async () => {
    const aoFalhar = vi.fn();
    const { conexao, restClient } = conexaoFalsa(async () => {
      throw quedaSalesforce();
    });
    const execucao = new Execucao(conexao, 'TC-041', 'ME', 1_000, { esperas: [0], aoFalhar });
    execucao.criados.Account.push('001HZ000011wqzjYAA');
    execucao.criados.Lead.push('00QHZ00000cBFVt2AO');

    const cleanup = await execucao.limpar(1_000);

    expect(cleanup.restantes).toBeNull();
    expect(cleanup.apagados.Account).toEqual(['001HZ000011wqzjYAA']);
    expect(cleanup.apagados.Lead).toEqual(['00QHZ00000cBFVt2AO']);
    expect(cleanup.erros).toEqual([
      'descoberta: SALESFORCE_NETWORK_ERROR',
      expect.stringContaining('resíduo não verificado'),
    ]);
    expect(aoFalhar).toHaveBeenCalledWith('SALESFORCE_NETWORK_ERROR');
    // Cada leitura da descoberta tentou de novo antes de desistir.
    expect(restClient.query.mock.calls.length).toBeGreaterThan(1);
  });

  it('conta como apagado o 404 que vem depois de uma queda na exclusão', async () => {
    const deleteRecord = vi
      .fn<(objeto: string, id: string) => Promise<void>>()
      .mockRejectedValueOnce(quedaSalesforce())
      .mockRejectedValueOnce(new SalesforceRestError('SALESFORCE_REQUEST_FAILED', 404, 'Not Found'));
    const { conexao, restClient } = conexaoFalsa(async () => vazio, { deleteRecord });
    const execucao = new Execucao(conexao, 'TC-040', 'CA', 1_000, { esperas: [0] });
    execucao.criados.Opportunity.push('006HZ00000UILxZYAX');

    const cleanup = await execucao.limpar(1_000);

    expect(deleteRecord).toHaveBeenCalledTimes(2);
    expect(cleanup.apagados.Opportunity).toEqual(['006HZ00000UILxZYAX']);
    expect(cleanup.erros).toEqual([]);
    expect(cleanup.restantes).toBe(0);
    // Sem eventos enviados, não há jobs do RUN para esperar.
    expect(restClient.query.mock.calls.some(([soql]) => String(soql).includes('AsyncApexJob'))).toBe(false);
  });

  it('mantém como erro o 404 sem queda antes', async () => {
    const deleteRecord = vi
      .fn<(objeto: string, id: string) => Promise<void>>()
      .mockRejectedValue(new SalesforceRestError('SALESFORCE_REQUEST_FAILED', 404, 'Not Found'));
    const { conexao } = conexaoFalsa(async () => vazio, { deleteRecord });
    const execucao = new Execucao(conexao, 'TC-040', 'CA', 1_000, { esperas: [0] });
    execucao.criados.Opportunity.push('006HZ00000UILxZYAX');

    const cleanup = await execucao.limpar(1_000);

    expect(deleteRecord).toHaveBeenCalledTimes(1);
    expect(cleanup.apagados.Opportunity).toEqual([]);
    expect(cleanup.erros).toEqual(['Opportunity 006HZ00000UILxZYAX: SALESFORCE_REQUEST_FAILED']);
  });

  it('com a cadeia interrompida, espera os jobs antes de procurar o que o Apex criou', async () => {
    vi.useFakeTimers();
    const consultas: string[] = [];
    const { conexao } = conexaoFalsa(async (soql) => {
      consultas.push(String(soql));
      return vazio;
    });
    const execucao = new Execucao(conexao, 'TC-022', 'PA', 1_000, { esperas: [] });
    execucao.eventos.push({
      rotulo: 'contato-email',
      eventType: 'contato-insert',
      eventTime: '2026-10-02T13:31:04.000Z',
      httpStatus: 200,
      ok: true,
      resposta: '',
    });

    const limpeza = execucao.limpar(30_000);
    await vi.advanceTimersByTimeAsync(10_000);
    const cleanup = await limpeza;

    expect(consultas[0]).toContain('FROM AsyncApexJob');
    expect(consultas.findIndex((soql) => soql.includes('FROM Account'))).toBeGreaterThan(0);
    expect(cleanup.restantes).toBe(0);
  });
});

describe('falha de rede fora do cleanup', () => {
  it('um evento sem resposta HTTP é falha de rede, não divergência', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })),
    );
    const composite = vi.fn(async () => ({
      compositeResponse: [{ body: { id: '006HZ00000UILxZYAX' } }],
    }));
    const aoFalhar = vi.fn();
    const { conexao } = conexaoFalsa(async () => vazio, { composite });
    const execucao = new Execucao(conexao, 'TC-001', 'CA', 1_000, { esperas: [], aoFalhar });
    execucao.fixtures.set('accountX', { objeto: 'Account', registro: contaX });
    const aprovacao: Aprovacao = {
      pessoa: execucao.y,
      email: 'qa.y@example.com',
      celular: '31970000000',
      tipoEventoCliente: 'cliente-insert',
    };

    const falha = await execucao.executarCadeia(aprovacao, 1_000).catch((error: unknown) => error);

    expect(falha).toBeInstanceOf(FalhaDeRede);
    expect(falha).not.toBeInstanceOf(FalhaDeEvento);
    expect((falha as FalhaDeRede).message).toBe('pac-insert-x: falha de rede (fetch failed)');
    expect(execucao.eventos).toEqual([
      expect.objectContaining({ rotulo: 'pac-insert-x', httpStatus: null, ok: false }),
    ]);
    expect(aoFalhar).toHaveBeenCalledWith('fetch failed');
  });

  it('a leitura do carimbo de pendência não confunde queda de rede com falta de FLS', async () => {
    const consulta = (erroDoContact: Error) => async (soql: string) => {
      if (soql.includes('FROM Contact')) throw erroDoContact;
      if (soql.includes('FROM Account')) return { totalSize: 1, records: [contaX] };
      return vazio;
    };
    const queda = quedaSalesforce();
    const semRede = new Execucao(conexaoFalsa(consulta(queda)).conexao, 'TC-001', 'CA', 1_000, { esperas: [] });
    await expect(semRede.snapshot()).rejects.toBe(queda);

    const semFls = new Execucao(
      conexaoFalsa(consulta(new SalesforceRestError('SALESFORCE_REQUEST_FAILED', 400, 'Bad Request'))).conexao,
      'TC-001',
      'CA',
      1_000,
      { esperas: [] },
    );
    await expect(semFls.snapshot()).rejects.toThrow(/AcessoDeAPI/);
  });
});
