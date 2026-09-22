import { describe, expect, it } from 'vitest';

import { GET as getScenario } from '../../app/api/v1/scenarios/[scenarioKey]/route';
import { GET as listScenarios } from '../../app/api/v1/scenarios/route';
import {
  restErrorResponseSchema,
  scenarioDetailSchema,
  scenarioListResponseSchema,
} from '../contracts';

describe('GET /api/v1/scenarios', () => {
  it('paginates with stable ordering', async () => {
    const response = listScenarios(
      new Request('http://localhost/api/v1/scenarios?page=2&pageSize=2'),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(scenarioListResponseSchema.parse(body)).toStrictEqual(body);
    expect(body).toMatchObject({
      data: [
        { key: 'contato-antes-cliente-colisao' },
        { key: 'cpf-divergente-contato-primeiro' },
      ],
      pagination: { page: 2, pageSize: 2, total: 24, totalPages: 12 },
    });
  });

  it('filters by normalized tag and scope', async () => {
    const response = listScenarios(
      new Request(
        'http://localhost/api/v1/scenarios?tag=CPF&scope=CORE&pageSize=100',
      ),
    );
    const body = scenarioListResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.data.map(({ key }) => key)).toStrictEqual([
      'match-cpf-sem-id-cliente',
    ]);
  });

  it('returns 422 with a sanitized uniform error for invalid query values', async () => {
    const response = listScenarios(
      new Request(
        'http://localhost/api/v1/scenarios?page=0&pageSize=101&tag=cpf%3Cscript%3E',
      ),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(422);
    expect(restErrorResponseSchema.parse(body)).toStrictEqual(body);
    expect(body).toMatchObject({
      error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' },
    });
    expect(JSON.stringify(body)).not.toContain('cpf<script>');
  });

  it('returns minimized metadata without payload templates or business fields', async () => {
    const response = listScenarios(
      new Request('http://localhost/api/v1/scenarios'),
    );
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain('payloadTemplate');
    expect(serialized).not.toContain('numerocpf');
    expect(serialized).not.toContain('idprospectsalesforce');
    expect(serialized).not.toContain('sim@example');
  });
});

describe('GET /api/v1/scenarios/{scenarioKey}', () => {
  it('returns the active version with only sanitized public steps', async () => {
    const response = await getScenario(
      new Request('http://localhost/api/v1/scenarios/match-id-cliente'),
      { params: Promise.resolve({ scenarioKey: 'match-id-cliente' }) },
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(scenarioDetailSchema.parse(body)).toStrictEqual(body);
    expect(body).toMatchObject({
      key: 'match-id-cliente',
      version: 1,
      availability: 'READY',
      steps: [{ target: 'CLIENTE', eventType: 'cliente-update' }],
    });
    expect(JSON.stringify(body)).not.toContain('payloadTemplate');
  });

  it('returns the uniform 404 response for an unknown scenario', async () => {
    const response = await getScenario(
      new Request('http://localhost/api/v1/scenarios/unknown-scenario'),
      { params: Promise.resolve({ scenarioKey: 'unknown-scenario' }) },
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(404);
    expect(restErrorResponseSchema.parse(body)).toStrictEqual(body);
    expect(body).toMatchObject({
      error: { code: 'SCENARIO_NOT_FOUND', message: 'Scenario not found' },
    });
  });
});
