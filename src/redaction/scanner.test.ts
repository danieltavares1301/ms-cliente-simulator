import { describe, expect, it } from 'vitest';

import { assertNoSensitiveData, scanSensitiveData } from './scanner';

function makeCpf(base: string): string {
  const digit = (value: string, factor: number) => {
    let total = 0;
    for (const char of value) total += Number(char) * factor--;
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  const first = digit(base, 10);
  return `${base}${first}${digit(`${base}${first}`, 11)}`;
}

const outsideTestEmail = () =>
  ['pessoa', 'corp', 'invalid'].join('@').replace('@corp@', '@corp.');
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
const salesforceId = () => ['001', 'A'.repeat(6), '0'.repeat(6)].join('');
const salesforceId18 = () => [salesforceId(), 'A', 'B', 'C'].join('');
const brazilianPhone = () => ['+55', '11', '9', '8765', '4321'].join('');

function compact(findings: ReturnType<typeof scanSensitiveData>) {
  return findings.map(({ path, category }) => ({ path, category }));
}

describe('scanSensitiveData', () => {
  it('finds sensitive keys recursively without returning detected values', () => {
    const payload = {
      cadastroNacional: 'dado-nao-permitido',
      contato: {
        numeroCpf: 'dado-nao-permitido',
        Email: 'dado-nao-permitido',
        telefone: 'dado-nao-permitido',
        celular: 'dado-nao-permitido',
        nomeCompleto: 'dado-nao-permitido',
      },
      enderecos: [
        {
          logradouro: 'dado-nao-permitido',
          cep: 'dado-nao-permitido',
          bairro: 'dado-nao-permitido',
        },
      ],
      authorization: 'dado-nao-permitido',
      accessToken: 'dado-nao-permitido',
      client_secret: 'dado-nao-permitido',
      session: 'dado-nao-permitido',
    };

    const findings = scanSensitiveData(payload);

    expect(findings.length).toBeGreaterThanOrEqual(12);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '$.cadastroNacional',
          category: 'CPF',
        }),
        expect.objectContaining({ path: '$.contato.Email', category: 'EMAIL' }),
        expect.objectContaining({
          path: '$.enderecos[0].logradouro',
          category: 'ADDRESS',
        }),
        expect.objectContaining({
          path: '$.authorization',
          category: 'CREDENTIAL',
        }),
      ]),
    );
    for (const finding of findings) {
      expect(Object.keys(finding).sort()).toEqual([
        'category',
        'message',
        'path',
      ]);
      expect(finding.message).toBe('Possivel dado sensivel detectado.');
    }
    expect(JSON.stringify(findings)).not.toContain('dado-nao-permitido');
  });

  it('detects credential keys across nesting, casing and separators while allowing only modeled technical hashes', () => {
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

    const findings = scanSensitiveData(payload);

    expect(compact(findings)).toEqual([
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
      expect(JSON.stringify(findings)).not.toContain(value);
    }
    expect(findings.some(({ path }) => path.includes('scenarioKey'))).toBe(
      false,
    );
    expect(findings.some(({ path }) => path.includes('stepKey'))).toBe(false);
    expect(
      findings.some(({ path }) => path.includes('idempotencyKeyHash')),
    ).toBe(false);
    expect(findings.some(({ path }) => path.includes('idClienteHash'))).toBe(
      false,
    );
    expect(findings.some(({ path }) => path.includes('id_prospect_hash'))).toBe(
      false,
    );
    expect(
      findings.some(({ path }) =>
        path.includes('normalized-correlation-key-hash'),
      ),
    ).toBe(false);
  });

  it('reports credential keys even when their values are absent', () => {
    expect(
      compact(
        scanSensitiveData({
          nested: [{ cookie: null }, { set_cookie: undefined }],
        }),
      ),
    ).toStrictEqual([
      { path: '$.nested[0].cookie', category: 'CREDENTIAL' },
      { path: '$.nested[1].set_cookie', category: 'CREDENTIAL' },
    ]);
  });

  it('detects sensitive value patterns in nested objects, arrays, and strings', () => {
    const cpf = makeCpf(['5', '2', '9', '9', '8', '2', '2', '4', '7'].join(''));
    const email = outsideTestEmail();
    const jwt = bearer();
    const credentialUrl = [
      'https://',
      ['usuario', 'senha'].join(':'),
      '@',
      'host.invalid',
      '/recurso',
    ].join('');
    const sfid = salesforceId();
    const sfid18 = salesforceId18();
    const phone = ['prefixo ', brazilianPhone(), ' sufixo'].join('');

    const findings = scanSensitiveData({
      nested: [cpf, { email }, jwt, credentialUrl, sfid, sfid18, phone],
    });

    expect(compact(findings)).toEqual(
      expect.arrayContaining([
        { path: '$.nested[0]', category: 'CPF' },
        { path: '$.nested[1].email', category: 'EMAIL' },
        { path: '$.nested[2]', category: 'CREDENTIAL' },
        { path: '$.nested[3]', category: 'URL_CREDENTIALS' },
        { path: '$.nested[4]', category: 'SALESFORCE_ID' },
        { path: '$.nested[5]', category: 'SALESFORCE_ID' },
        { path: '$.nested[6]', category: 'PHONE' },
      ]),
    );
    for (const value of [cpf, email, jwt, credentialUrl, sfid, sfid18, phone]) {
      expect(JSON.stringify(findings)).not.toContain(value);
    }
  });

  it('accepts approved synthetic markers, test domains, invalid CPF checksums, and explicit allowlist', () => {
    const explicitlyAllowed = ['permitido', 'por', 'politica'].join('-');
    const payload = {
      clienteId: 'CLI-SIM-a1b2c3',
      proponenteId: 'PRO-SIM-a1b2c3',
      eventId: 'EVT-SIM-a1b2c3',
      runId: 'run_a1b2c3',
      stepId: 'step_a1b2c3',
      email: ['cliente', 'example', 'test']
        .join('@')
        .replace('@example@', '@example.'),
      nome: 'Cliente Simulado a1b2c3',
      telefone: 'TEL-SIM-a1b2c3',
      endereco: 'END-SIM-a1b2c3',
      invalidChecksum: [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '0',
        '0',
      ].join(''),
      custom: explicitlyAllowed,
      alternateEmail: ['cliente', 'fixtures', 'invalid']
        .join('@')
        .replace('@fixtures@', '@fixtures.'),
    };

    expect(
      scanSensitiveData(payload, {
        allowedValues: [explicitlyAllowed],
        allowedEmailDomains: ['fixtures.invalid'],
      }),
    ).toEqual([]);
  });

  it('runs sensitive detectors before synthetic-prefix allowlists', () => {
    const cpf = makeCpf(['5', '2', '9', '9', '8', '2', '2', '4', '7'].join(''));
    const email = outsideTestEmail();
    const credential = bearer();
    const credentialUrl = [
      'https://',
      ['usuario', 'senha'].join(':'),
      '@',
      'host.invalid',
    ].join('');
    const sfid = salesforceId();
    const phone = brazilianPhone();
    const values = {
      credential: ['CLI-SIM-', credential].join(''),
      credentialUrl: ['PRO-SIM-', credentialUrl].join(''),
      salesforceId: ['EVT-SIM-', sfid].join(''),
      email: ['TEL-SIM-', email].join(''),
      cpf: ['END-SIM-', cpf].join(''),
      phone: ['CEP-SIM-', phone].join(''),
    };

    const findings = scanSensitiveData(values);

    expect(compact(findings)).toEqual(
      expect.arrayContaining([
        { path: '$.credential', category: 'CREDENTIAL' },
        { path: '$.credentialUrl', category: 'URL_CREDENTIALS' },
        { path: '$.salesforceId', category: 'SALESFORCE_ID' },
        { path: '$.email', category: 'EMAIL' },
        { path: '$.cpf', category: 'CPF' },
        { path: '$.phone', category: 'PHONE' },
      ]),
    );
    for (const value of Object.values(values)) {
      expect(JSON.stringify(findings)).not.toContain(value);
    }
    let caught: unknown;
    try {
      assertNoSensitiveData(values);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    for (const value of Object.values(values)) {
      expect(String(caught)).not.toContain(value);
    }
  });

  it('allows only documented synthetic-marker formats to suppress key findings', () => {
    expect(scanSensitiveData({ telefone: 'TEL-SIM-a1b2c3' })).toEqual([]);
    expect(
      compact(scanSensitiveData({ telefone: 'TEL-SIM-not-hex' })),
    ).toContainEqual({
      path: '$.telefone',
      category: 'PHONE',
    });
  });

  it('throws only generic categories and paths', () => {
    const sensitive = outsideTestEmail();

    expect(() => assertNoSensitiveData({ payload: sensitive })).toThrowError(
      'EMAIL em $.payload',
    );
    try {
      assertNoSensitiveData({ payload: sensitive });
    } catch (error) {
      expect(String(error)).not.toContain(sensitive);
    }
  });
});
