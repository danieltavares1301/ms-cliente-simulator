import { describe, expect, it } from 'vitest';

import { anonymizeJson } from './anonymizer';
import { scanSensitiveData } from './scanner';

const email = () =>
  ['origem', 'corp', 'invalid'].join('@').replace('@corp@', '@corp.');
const phone = () => ['+55', '21', '9', '7654', '3210'].join('');
const cpf = () =>
  ['5', '2', '9', '9', '8', '2', '2', '4', '7', '2', '5'].join('');

describe('anonymizeJson', () => {
  it('deterministically replaces controlled known fields and removes credentials and CPF', () => {
    const source = {
      nome: 'origem controlada',
      email: email(),
      telefone: phone(),
      cpf: cpf(),
      endereco: {
        logradouro: 'origem controlada',
        bairro: 'origem controlada',
        cep: 'origem controlada',
      },
      authorization: 'origem controlada',
      clientSecret: 'origem controlada',
      session: 'origem controlada',
      refreshToken: 'origem controlada',
      accountId: ['001', 'A'.repeat(6), '0'.repeat(6)].join(''),
      eventType: 'CLIENTE_UPDATE',
      valid: 'preservado',
      nested: [{ nome: 'origem controlada', email: email() }],
    };

    const first = anonymizeJson(source, { seed: 'seed-controlada' });
    const second = anonymizeJson(source, { seed: 'seed-controlada' });
    const other = anonymizeJson(source, { seed: 'outra-seed' });

    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
    expect(first).toMatchObject({
      nome: expect.stringMatching(/^Cliente Simulado [a-f0-9]+$/),
      email: expect.stringMatching(/@example\.test$/),
      telefone: expect.stringMatching(/^TEL-SIM-/),
      accountId: expect.stringMatching(/^CLI-SIM-/),
      eventType: 'CLIENTE_UPDATE',
      valid: 'preservado',
      endereco: {
        logradouro: expect.stringMatching(/^END-SIM-/),
        bairro: expect.stringMatching(/^END-SIM-/),
        cep: expect.stringMatching(/^CEP-SIM-/),
      },
    });
    expect(first).not.toHaveProperty('cpf');
    expect(first).not.toHaveProperty('authorization');
    expect(first).not.toHaveProperty('clientSecret');
    expect(first).not.toHaveProperty('session');
    expect(first).not.toHaveProperty('refreshToken');
    expect(scanSensitiveData(first)).toEqual([]);
    expect(source.cpf).toBe(cpf());
  });

  it('removes credential fields recursively while preserving only modeled technical hashes', () => {
    const secrets = [
      ['prod', 'secret'].join('-'),
      ['sk', 'live', '123'].join('_'),
      ['seg', 'redo'].join(''),
    ];
    const source = {
      password: secrets[0],
      apiKey: secrets[1],
      senha: secrets[2],
      nested: [
        {
          pass_phrase: secrets[0],
          Secret: secrets[1],
          clientSecret: secrets[2],
          credential: secrets[0],
        },
        {
          privateKey: secrets[1],
          access_token: secrets[2],
          refreshToken: secrets[0],
          session_token: secrets[1],
          cookie: null,
          SET_COOKIE: secrets[0],
          'subscription-key': secrets[1],
          signing_key: secrets[2],
          WebhookSecret: secrets[0],
          connection_string: secrets[1],
          passwordHash: secrets[2],
          secret_hash: secrets[0],
          tokenDigest: secrets[1],
        },
      ],
      scenarioKey: 'cliente-criado',
      stepKey: 'consultar-cliente',
      idempotencyKeyHash: 'sha256:valor-tecnico',
      idClienteHash: 'sha256:cliente',
      id_prospect_hash: 'sha256:prospect',
      'normalized-correlation-key-hash': 'sha256:correlation',
    };

    const result = anonymizeJson(source, { seed: 'seed-controlada' });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      nested: [{}, {}],
      scenarioKey: 'cliente-criado',
      stepKey: 'consultar-cliente',
      idempotencyKeyHash: 'sha256:valor-tecnico',
      idClienteHash: 'sha256:cliente',
      id_prospect_hash: 'sha256:prospect',
      'normalized-correlation-key-hash': 'sha256:correlation',
    });
    for (const secret of secrets) expect(serialized).not.toContain(secret);
    expect(scanSensitiveData(result)).toEqual([]);
  });

  it('uses stable tokens for repeated values and distinct tokens for distinct values', () => {
    const result = anonymizeJson(
      {
        primaryName: 'mesma origem',
        secondaryName: 'mesma origem',
        contactName: 'outra origem',
      },
      { seed: 'seed-controlada' },
    ) as Record<string, string>;

    expect(result.primaryName).toBe(result.secondaryName);
    expect(result.primaryName).not.toBe(result.contactName);
  });

  it('rejects free text and stack traces instead of attempting anonymization', () => {
    const freeText = 'conteudo livre deve ser removido';
    const stack = ['Error: falha', '    at modulo (arquivo.ts:1:1)'].join('\n');

    for (const source of [
      { message: freeText },
      { stackTrace: stack },
      { description: freeText },
    ]) {
      try {
        anonymizeJson(source, { seed: 'seed-controlada' });
        throw new Error('esperava rejeicao');
      } catch (error) {
        expect(String(error)).toContain('remova o campo de texto livre');
        expect(String(error)).not.toContain(freeText);
        expect(String(error)).not.toContain(stack);
      }
    }
  });

  it('rejects non-JSON values', () => {
    expect(() =>
      anonymizeJson({ createdAt: new Date(0) }, { seed: 'seed-controlada' }),
    ).toThrow('JSON controlado');
  });
});
