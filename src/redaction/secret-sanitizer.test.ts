import { describe, expect, it } from 'vitest';

import { scanSecrets } from './scanner';
import { sanitizeSecrets } from './secret-sanitizer';

describe('sanitizeSecrets', () => {
  it('preserves business data while removing credentials recursively', () => {
    const source = {
      nome: 'Maria da Silva',
      email: 'maria.silva@empresa.com.br',
      telefone: '+55 (11) 98765-4321',
      cpf: '529.982.247-25',
      endereco: {
        logradouro: 'Avenida Paulista, 1000',
        bairro: 'Bela Vista',
        cep: '01310-100',
      },
      salesforceId: '001A0000009zGVP',
      authorization: 'Bearer segredo',
      clientSecret: 'segredo',
      nested: [{ nome: 'João Souza', email: 'joao@empresa.com.br' }],
    };

    const result = sanitizeSecrets(source);

    expect(result).toEqual({
      nome: source.nome,
      email: source.email,
      telefone: source.telefone,
      cpf: source.cpf,
      endereco: source.endereco,
      salesforceId: source.salesforceId,
      nested: source.nested,
    });
    expect(scanSecrets(result)).toEqual([]);
  });

  it('removes all credential-key families while preserving modeled hashes', () => {
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
      idempotencyKeyHash: 'sha256:valor-tecnico',
    };

    const result = sanitizeSecrets(source);

    expect(result).toEqual({
      nested: [{}, {}],
      scenarioKey: 'cliente-criado',
      idempotencyKeyHash: 'sha256:valor-tecnico',
    });
    expect(scanSecrets(result)).toEqual([]);
    for (const secret of secrets)
      expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('removes prefixed credential families while preserving safe technical keys', () => {
    const secrets = [
      ['authorization', 'opaque'].join('-'),
      ['subscription', 'opaque'].join('-'),
      ['connection', 'opaque'].join('-'),
      ['signing', 'opaque'].join('-'),
    ];
    const source = {
      requestAuthorizationHeader: secrets[0],
      nested: [
        {
          ocpApimSubscriptionKey: secrets[1],
          database_connection_string: secrets[2],
          'jwt-signing-key': secrets[3],
        },
        {
          proxyPrivateKey: secrets[0],
          service_access_token: secrets[1],
          'auth-refresh-token': secrets[2],
          USER_SESSION_TOKEN: secrets[3],
          oauthClientSecret: secrets[0],
          github_webhook_secret: secrets[1],
          INTERNAL_API_KEY: secrets[2],
          responseSetCookie: secrets[3],
          upstream_cookie: secrets[0],
        },
      ],
      scenarioKey: 'cliente-criado',
      stepKey: 'consultar-cliente',
      idempotencyKeyHash: 'sha256:valor-tecnico',
      requestedBy: 'automacao',
    };

    const result = sanitizeSecrets(source);

    expect(result).toEqual({
      nested: [{}, {}],
      scenarioKey: 'cliente-criado',
      stepKey: 'consultar-cliente',
      idempotencyKeyHash: 'sha256:valor-tecnico',
      requestedBy: 'automacao',
    });
    expect(scanSecrets(result)).toEqual([]);
    for (const secret of secrets)
      expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('redacts embedded Bearer, JWT and URL credentials without removing business text', () => {
    const source = {
      message:
        'Cliente Maria: Bearer abc.def.ghi em https://user:pass@host.invalid/path',
      notes: ['cpf 52998224725', 'JWT eyJheader.eyJpayload.signature'],
    };

    const result = sanitizeSecrets(source);

    expect(result).toEqual({
      message:
        'Cliente Maria: [REDACTED] em https://[REDACTED]@host.invalid/path',
      notes: ['cpf 52998224725', 'JWT [REDACTED]'],
    });
    expect(scanSecrets(result)).toEqual([]);
  });

  it('rejects non-JSON values', () => {
    expect(() => sanitizeSecrets({ createdAt: new Date(0) })).toThrow(
      'JSON controlado',
    );
  });
});
