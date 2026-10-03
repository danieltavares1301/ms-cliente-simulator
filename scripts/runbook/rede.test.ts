import { afterEach, describe, expect, it, vi } from 'vitest';

import { SalesforceNetworkError } from '../../src/salesforce/network-policy.ts';
import { SalesforceRestError } from '../../src/salesforce/rest-client.ts';
import {
  causaDeRede,
  comRetentativas,
  criarPortaoDeRede,
  ehFalhaDeRede,
  FalhaDeRede,
  sondarRede,
  type EventoDeRede,
} from './rede.ts';

const semEspera = async () => undefined;
const fetchFalhou = (code: string) => new TypeError('fetch failed', { cause: { code } });

describe('ehFalhaDeRede e causaDeRede', () => {
  it('reconhece falha de transporte, e não erro com resposta HTTP', () => {
    expect(ehFalhaDeRede(new SalesforceNetworkError('SALESFORCE_NETWORK_ERROR'))).toBe(true);
    expect(ehFalhaDeRede(new SalesforceNetworkError('SALESFORCE_REQUEST_TIMEOUT'))).toBe(true);
    expect(ehFalhaDeRede(new FalhaDeRede('POST Account', 'ECONNRESET'))).toBe(true);
    expect(ehFalhaDeRede(fetchFalhou('ECONNRESET'))).toBe(true);
    expect(ehFalhaDeRede(new DOMException('aborted', 'TimeoutError'))).toBe(true);
    expect(ehFalhaDeRede(new SalesforceRestError('SALESFORCE_REQUEST_FAILED', 500, 'Server Error'))).toBe(false);
    expect(ehFalhaDeRede(new TypeError('x is not a function'))).toBe(false);
    expect(ehFalhaDeRede(new Error('Precheck: chaves sintéticas já existem'))).toBe(false);
  });

  it('traz o código do sistema quando o fetch o informa', () => {
    expect(causaDeRede(fetchFalhou('SELF_SIGNED_CERT_IN_CHAIN'))).toBe('SELF_SIGNED_CERT_IN_CHAIN');
    expect(causaDeRede(new SalesforceNetworkError('SALESFORCE_REQUEST_TIMEOUT'))).toBe(
      'SALESFORCE_REQUEST_TIMEOUT',
    );
    expect(causaDeRede(new FalhaDeRede('userinfo', 'ENOTFOUND'))).toBe('ENOTFOUND');
    expect(causaDeRede(new DOMException('aborted', 'TimeoutError'))).toBe('TIMEOUT');
    expect(new FalhaDeRede('POST Account', 'ECONNRESET').message).toBe(
      'POST Account: falha de rede (ECONNRESET)',
    );
  });
});

describe('comRetentativas', () => {
  it('repete a falha de rede e devolve o resultado quando a rede volta', async () => {
    const operacao = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SalesforceNetworkError('SALESFORCE_NETWORK_ERROR'))
      .mockRejectedValueOnce(fetchFalhou('ECONNRESET'))
      .mockResolvedValue('ok');
    const causas: string[] = [];
    const dormir = vi.fn<(ms: number) => Promise<void>>(semEspera);
    await expect(
      comRetentativas(operacao, { esperas: [10, 20, 30], aoFalhar: (causa) => causas.push(causa), dormir }),
    ).resolves.toBe('ok');
    expect(operacao).toHaveBeenCalledTimes(3);
    expect(dormir.mock.calls.map(([ms]) => ms)).toEqual([10, 20]);
    expect(causas).toEqual(['SALESFORCE_NETWORK_ERROR', 'ECONNRESET']);
  });

  it('não repete erro que não é de rede', async () => {
    const erro = new SalesforceRestError('SALESFORCE_REQUEST_FAILED', 400, 'Bad Request');
    const operacao = vi.fn<() => Promise<void>>().mockRejectedValue(erro);
    await expect(comRetentativas(operacao, { esperas: [0, 0], dormir: semEspera })).rejects.toBe(erro);
    expect(operacao).toHaveBeenCalledTimes(1);
  });

  it('desiste depois da última espera com a falha de rede original', async () => {
    const erro = new SalesforceNetworkError('SALESFORCE_NETWORK_ERROR');
    const operacao = vi.fn<() => Promise<void>>().mockRejectedValue(erro);
    await expect(comRetentativas(operacao, { esperas: [0, 0], dormir: semEspera })).rejects.toBe(erro);
    expect(operacao).toHaveBeenCalledTimes(3);
    // Sem esperas, não repete.
    operacao.mockClear();
    await expect(comRetentativas(operacao, { esperas: [] })).rejects.toBe(erro);
    expect(operacao).toHaveBeenCalledTimes(1);
  });
});

describe('criarPortaoDeRede', () => {
  function portaoDeTeste(sondagens: Array<'falha' | 'ok'>, limiteMs = 60_000) {
    let relogio = 0;
    const eventos: EventoDeRede[] = [];
    const sondar = vi.fn(async () => {
      if (sondagens.shift() !== 'ok') throw fetchFalhou('ECONNREFUSED');
    });
    const portao = criarPortaoDeRede({
      sondar,
      esperas: [1_000, 5_000],
      limiteMs,
      aoMudar: (evento) => eventos.push(evento),
      agora: () => relogio,
      dormir: async (ms) => {
        relogio += ms;
      },
    });
    return { portao, sondar, eventos };
  }

  it('começa aberto e não sonda sem queda', async () => {
    const { portao, sondar } = portaoDeTeste([]);
    await expect(portao.liberado()).resolves.toBe(true);
    expect(sondar).not.toHaveBeenCalled();
  });

  it('fecha na queda, sonda com espera crescente e reabre quando a org responde', async () => {
    const { portao, sondar, eventos } = portaoDeTeste(['falha', 'falha', 'ok', 'ok']);
    portao.acusarQueda('SALESFORCE_NETWORK_ERROR');
    // Uma segunda queda com o portão fechado não abre outra sondagem.
    portao.acusarQueda('ECONNRESET');
    await expect(portao.liberado()).resolves.toBe(true);
    expect(sondar).toHaveBeenCalledTimes(3);
    expect(eventos).toEqual([
      { tipo: 'queda', causa: 'SALESFORCE_NETWORK_ERROR' },
      { tipo: 'sondagem', tentativa: 1, causa: 'ECONNREFUSED' },
      { tipo: 'sondagem', tentativa: 2, causa: 'ECONNREFUSED' },
      { tipo: 'volta', foraDoArMs: 11_000, sondagens: 3 },
    ]);
    // Reaberto, libera na hora e aceita uma queda nova.
    await expect(portao.liberado()).resolves.toBe(true);
    portao.acusarQueda('ETIMEDOUT');
    expect(eventos.at(-1)).toEqual({ tipo: 'queda', causa: 'ETIMEDOUT' });
    await expect(portao.liberado()).resolves.toBe(true);
    expect(sondar).toHaveBeenCalledTimes(4);
  });

  it('desiste depois do limite e não libera mais', async () => {
    const { portao, sondar, eventos } = portaoDeTeste(['falha', 'falha', 'falha'], 10_000);
    portao.acusarQueda('SALESFORCE_NETWORK_ERROR');
    await expect(portao.liberado()).resolves.toBe(false);
    // Sondagens aos 1 s, 6 s e 11 s: a terceira já passa do limite de 10 s.
    expect(eventos.at(-1)).toEqual({ tipo: 'desistencia', foraDoArMs: 11_000, sondagens: 3 });
    portao.acusarQueda('ECONNRESET');
    await expect(portao.liberado()).resolves.toBe(false);
    expect(sondar).toHaveBeenCalledTimes(3);
  });
});

describe('sondarRede', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aceita qualquer resposta HTTP de /services/data/, sem token', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sondarRede('https://exemplo.my.salesforce.com')).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe('https://exemplo.my.salesforce.com/services/data/');
    expect(init.headers).toBeUndefined();
  });

  it('falha com a causa do fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(fetchFalhou('SELF_SIGNED_CERT_IN_CHAIN')));
    await expect(sondarRede('https://exemplo.my.salesforce.com')).rejects.toMatchObject({
      name: 'FalhaDeRede',
      causa: 'SELF_SIGNED_CERT_IN_CHAIN',
    });
  });
});
