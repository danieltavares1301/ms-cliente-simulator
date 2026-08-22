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
