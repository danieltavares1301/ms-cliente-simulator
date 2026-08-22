import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import { GET as getHealth } from '../app/api/v1/health/route';
import { GET as getOpenApi } from '../app/api/v1/openapi/route';
import { restErrorResponseSchema } from './contracts';
import { openApiDocument } from './openapi';

const publicPaths = [
  '/api/v1/health',
  '/api/v1/openapi',
  '/api/v1/scenarios',
  '/api/v1/scenarios/{scenarioKey}',
  '/api/v1/runs',
  '/api/v1/runs/{runId}',
  '/api/v1/runs/{runId}/steps',
  '/api/v1/runs/{runId}/cancellations',
  '/api/v1/runs/{runId}/retries',
  '/api/ms-clientes/graphql',
] as const;

describe('OpenAPI document', () => {
  it('passes structural OpenAPI 3.1 validation', async () => {
    const validatedDocument = await SwaggerParser.validate(
      openApiDocument as unknown as OpenAPI.Document,
    );

    expect(validatedDocument).toMatchObject({ openapi: '3.1.0' });
  });

  it('is OpenAPI 3.1 and documents every planned public endpoint', () => {
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(openApiDocument.info.version).toBe('0.2.0');
    expect(openApiDocument.info.title).toBeTruthy();

    for (const path of publicPaths) {
      expect(openApiDocument.paths[path]).toBeDefined();
    }

    expect(
      openApiDocument.paths['/api/v1/internal/dispatches'],
    ).toBeUndefined();
  });

  it('does not promise unimplemented behavior', () => {
    expect(
      openApiDocument.paths['/api/v1/health']?.get?.['x-implementation-status'],
    ).toBe('implemented');
    expect(
      openApiDocument.paths['/api/v1/openapi']?.get?.[
        'x-implementation-status'
      ],
    ).toBe('implemented');
    expect(
      openApiDocument.paths['/api/v1/scenarios']?.get?.[
        'x-implementation-status'
      ],
    ).toBe('implemented');
    expect(
      openApiDocument.paths['/api/v1/scenarios/{scenarioKey}']?.get?.[
        'x-implementation-status'
      ],
    ).toBe('implemented');
    expect(
      openApiDocument.paths['/api/v1/runs']?.post?.['x-implementation-status'],
    ).toBe('future');
    expect(
      openApiDocument.paths['/api/ms-clientes/graphql']?.post?.[
        'x-implementation-status'
      ],
    ).toBe('future');
  });

  it('keeps key schemas strict and aligned with contract requirements', () => {
    const schemas = openApiDocument.components.schemas;
    const errorSchema = schemas.RestErrorResponse;
    const envelopeSchema = schemas.EventGridEnvelope;

    expect(errorSchema.additionalProperties).toBe(false);
    expect(envelopeSchema.minItems).toBe(1);
    expect(envelopeSchema.maxItems).toBe(1);
    expect(JSON.stringify(envelopeSchema)).toContain('idcliente');
    expect(JSON.stringify(envelopeSchema)).toContain('cliente-insert');
    expect(JSON.stringify(envelopeSchema)).toContain('endereco-update');
    expect(schemas.ScenarioMetadata.additionalProperties).toBe(false);
    expect(JSON.stringify(schemas.ScenarioMetadata)).toContain('CONTRACT_ONLY');
    expect(JSON.stringify(schemas.ScenarioMetadata)).toContain('READY');
    expect(JSON.stringify(schemas.ScenarioDetail)).not.toContain(
      'payloadTemplate',
    );
    const scenarioPaths = JSON.stringify({
      list: openApiDocument.paths['/api/v1/scenarios'],
      detail: openApiDocument.paths['/api/v1/scenarios/{scenarioKey}'],
    });
    expect(scenarioPaths).toContain('READY');
    expect(scenarioPaths).not.toContain('numerocpf');
    expect(scenarioPaths).not.toContain('payloadTemplate');
  });
});

describe('public document handlers', () => {
  it('returns the current health contract directly', async () => {
    Object.assign(process.env, {
      APP_ENV: 'test',
      TARGET_ENV: 'mrv-devDan',
      TARGET_SALESFORCE_BASE_URL: 'https://example.my.salesforce.com',
      TARGET_SALESFORCE_ORG_ID: '00DHZ000006mzDp2AI',
      DATABASE_URL: (() => {
        const url = new URL('postgresql://localhost/ms_clientes');
        url.username = 'test';
        url.password = 'test-password';
        return url.toString();
      })(),
      QSTASH_URL: 'https://qstash.example.com',
    });

    const response = getHealth();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
  });

  it('returns a uniform sanitized error when health configuration is invalid', async () => {
    const validTarget = process.env.TARGET_ENV;
    process.env.TARGET_ENV = 'forbidden-environment';

    const response = getHealth();
    const body: unknown = await response.json();
    process.env.TARGET_ENV = validTarget;

    expect(response.status).toBe(500);
    expect(restErrorResponseSchema.parse(body)).toStrictEqual(body);
    expect(JSON.stringify(body)).not.toContain('forbidden-environment');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('returns the in-memory OpenAPI JSON document directly', async () => {
    const response = getOpenApi();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toStrictEqual(openApiDocument);
  });
});
