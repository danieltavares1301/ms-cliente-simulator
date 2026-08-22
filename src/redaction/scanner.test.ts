import { describe, expect, it } from 'vitest';

import { assertNoSecrets, scanSecrets } from './scanner';

const bearer = () =>
  [
    'Bear',
    'er ',
    'eyJ',
    'hbGciOiJIUzI1NiJ9',
    '.',
    'eyJzdWIiOiIxIn0',
    '.',
    'signature',
  ].join('');

function compact(findings: ReturnType<typeof scanSecrets>) {
  return findings.map(({ path, category }) => ({ path, category }));
}

describe('scanSecrets', () => {
  it('does not classify business data by key or format', () => {
    const payload = {
      cadastroNacional: '52998224725',
      contato: {
        numeroCpf: '529.982.247-25',
        Email: 'pessoa@empresa.com.br',
        telefone: '+55 (11) 98765-4321',
        celular: '11987654321',
        nomeCompleto: 'Maria da Silva',
      },
      enderecos: [
        {
          logradouro: 'Avenida Paulista, 1000',
          cep: '01310-100',
          bairro: 'Bela Vista',
        },
      ],
      salesforceId: '001A0000009zGVP',
      salesforceId18: '001A0000009zGVPABC',
    };

    expect(scanSecrets(payload)).toEqual([]);
    expect(() => assertNoSecrets(payload)).not.toThrow();
  });

  it('detects credential keys recursively without returning their values', () => {
    const opaqueValues = [
      ['prod', 'secret'].join('-'),
      ['sk', 'live', '123'].join('_'),
      ['seg', 'redo'].join(''),
    ];
    const payload = {
      password: opaqueValues[0],
      API_KEY: opaqueValues[1],
      nested: [
        {
          Senha: opaqueValues[2],
          passPhrase: opaqueValues[0],
          client_secret: opaqueValues[1],
          credentials: opaqueValues[2],
        },
        {
          private_key: opaqueValues[0],
          accessToken: opaqueValues[1],
          refresh_token: opaqueValues[2],
          SESSION_TOKEN: opaqueValues[0],
          cookie: opaqueValues[1],
          SET_COOKIE: opaqueValues[2],
          'subscription-key': opaqueValues[0],
          signingKey: opaqueValues[1],
          webhook_secret: opaqueValues[2],
          ConnectionString: opaqueValues[0],
          passwordHash: opaqueValues[1],
          secret_hash: opaqueValues[2],
          TOKEN_DIGEST: opaqueValues[0],
        },
      ],
      scenarioKey: 'cliente-criado',
      stepKey: 'consultar-cliente',
      idempotencyKeyHash: 'sha256:valor-tecnico',
      idClienteHash: 'sha256:cliente',
      id_prospect_hash: 'sha256:prospect',
      'normalized-correlation-key-hash': 'sha256:correlation',
    };

    expect(compact(scanSecrets(payload))).toEqual([
      { path: '$.API_KEY', category: 'CREDENTIAL' },
      { path: '$.nested[0].client_secret', category: 'CREDENTIAL' },
      { path: '$.nested[0].credentials', category: 'CREDENTIAL' },
      { path: '$.nested[0].passPhrase', category: 'CREDENTIAL' },
      { path: '$.nested[0].Senha', category: 'CREDENTIAL' },
      { path: '$.nested[1].accessToken', category: 'CREDENTIAL' },
      { path: '$.nested[1].ConnectionString', category: 'CREDENTIAL' },
      { path: '$.nested[1].cookie', category: 'CREDENTIAL' },
      { path: '$.nested[1].passwordHash', category: 'CREDENTIAL' },
      { path: '$.nested[1].private_key', category: 'CREDENTIAL' },
      { path: '$.nested[1].refresh_token', category: 'CREDENTIAL' },
      { path: '$.nested[1].secret_hash', category: 'CREDENTIAL' },
      { path: '$.nested[1].SESSION_TOKEN', category: 'CREDENTIAL' },
      { path: '$.nested[1].SET_COOKIE', category: 'CREDENTIAL' },
      { path: '$.nested[1].signingKey', category: 'CREDENTIAL' },
      { path: '$.nested[1].TOKEN_DIGEST', category: 'CREDENTIAL' },
      { path: '$.nested[1].webhook_secret', category: 'CREDENTIAL' },
      {
        path: '$.nested[1]["subscription-key"]',
        category: 'CREDENTIAL',
      },
      { path: '$.password', category: 'CREDENTIAL' },
    ]);
    for (const value of opaqueValues) {
      expect(JSON.stringify(scanSecrets(payload))).not.toContain(value);
    }
  });

  it('reports credential keys even when their values are absent', () => {
    expect(
      compact(
        scanSecrets({
          nested: [{ cookie: null }, { set_cookie: undefined }],
        }),
      ),
    ).toStrictEqual([
      { path: '$.nested[0].cookie', category: 'CREDENTIAL' },
      { path: '$.nested[1].set_cookie', category: 'CREDENTIAL' },
    ]);
  });

  it('detects Bearer, JWT and credential URLs in nested values', () => {
    const jwt = bearer();
    const credentialUrl = [
      'https://',
      ['usuario', 'senha'].join(':'),
      '@',
      'host.invalid',
      '/recurso',
    ].join('');
    const findings = scanSecrets({
      nested: [{ value: jwt }, credentialUrl],
    });

    expect(compact(findings)).toEqual([
      { path: '$.nested[0].value', category: 'CREDENTIAL' },
      { path: '$.nested[1]', category: 'URL_CREDENTIALS' },
    ]);
    expect(JSON.stringify(findings)).not.toContain(jwt);
    expect(JSON.stringify(findings)).not.toContain(credentialUrl);
  });

  it('throws only generic categories and paths', () => {
    const secret = bearer();

    expect(() => assertNoSecrets({ payload: secret })).toThrowError(
      'CREDENTIAL em $.payload',
    );
    try {
      assertNoSecrets({ payload: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
