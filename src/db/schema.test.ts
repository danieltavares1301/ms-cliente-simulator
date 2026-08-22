import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  auditEvent,
  cleanupPolicyEnum,
  deliveryAttempt,
  graphqlCallback,
  runStatusEnum,
  scenarioRun,
  scenarioRunStep,
  stepKindEnum,
} from './schema';

const tables = [
  scenarioRun,
  scenarioRunStep,
  deliveryAttempt,
  graphqlCallback,
  auditEvent,
];

const tableColumns = (table: (typeof tables)[number]) =>
  Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([propertyName, column]) => [
      propertyName,
      column.name,
    ]),
  );

describe('persistence schema contract', () => {
  it('maps camelCase properties to the planned SQL tables and critical columns', () => {
    expect(tables.map(getTableName)).toStrictEqual([
      'scenario_run',
      'scenario_run_step',
      'delivery_attempt',
      'graphql_callback',
      'audit_event',
    ]);

    expect(tableColumns(scenarioRun)).toMatchObject({
      scenarioKey: 'scenario_key',
      idempotencyKeyHash: 'idempotency_key_hash',
      variablesRedacted: 'variables_redacted',
      retentionExpiresAt: 'retention_expires_at',
    });
    expect(tableColumns(scenarioRunStep)).toMatchObject({
      runId: 'run_id',
      requestRedacted: 'request_redacted',
      qstashMessageId: 'qstash_message_id',
      stepKind: 'step_kind',
    });
    expect(tableColumns(graphqlCallback)).toMatchObject({
      idClienteHash: 'id_cliente_hash',
      normalizedCorrelationKeyHash: 'normalized_correlation_key_hash',
      responseRedacted: 'response_redacted',
    });
    expect(
      tables.flatMap((table) => Object.keys(tableColumns(table))),
    ).not.toContainEqual(expect.stringContaining('_'));
  });

  it('exposes only the allowed workflow enum values', () => {
    expect(runStatusEnum.enumValues).toStrictEqual([
      'CREATED',
      'PROVISIONING',
      'SCHEDULED',
      'RUNNING',
      'WAITING_ASYNC',
      'VERIFYING',
      'SUCCEEDED',
      'FAILED',
      'PARTIAL',
      'CANCELLING',
      'CANCELLED',
    ]);
    expect(stepKindEnum.enumValues).toStrictEqual([
      'SETUP',
      'DISPATCH',
      'VERIFY',
      'CLEANUP',
    ]);
    expect(cleanupPolicyEnum.enumValues).toStrictEqual([
      'ALWAYS',
      'ON_SUCCESS',
      'NEVER',
    ]);
  });

  it('does not define columns that could persist raw payloads, secrets, or direct business data', () => {
    const sqlColumnNames = tables.flatMap((table) =>
      Object.values(tableColumns(table)),
    );

    expect(sqlColumnNames).not.toContainEqual(
      expect.stringMatching(/raw_payload|token|cpf|email|phone/i),
    );
  });
});

describe('initial migration contract', () => {
  const migrationDirectory = join(process.cwd(), 'drizzle');
  const initialMigrationFiles = readdirSync(migrationDirectory).filter(
    (fileName) => /^0000_.+\.sql$/.test(fileName),
  );

  it('contains one generated initial SQL migration', () => {
    expect(initialMigrationFiles).toHaveLength(1);
  });

  it('enforces the critical foreign keys, uniqueness, and value checks', () => {
    const migrationSql = readFileSync(
      join(migrationDirectory, initialMigrationFiles[0]),
      'utf8',
    )
      .replaceAll('"', '')
      .replace(/\s+/g, ' ')
      .replace(
        /\b(?:scenario_run|scenario_run_step|delivery_attempt|graphql_callback)\./g,
        '',
      )
      .toLowerCase();

    expect(migrationSql).toContain(
      'foreign key (run_id) references public.scenario_run(id) on delete cascade',
    );
    expect(migrationSql).toContain(
      'foreign key (step_id) references public.scenario_run_step(id) on delete cascade',
    );
    expect(migrationSql).toContain(
      'foreign key (run_id) references public.scenario_run(id) on delete set null',
    );
    expect(migrationSql).toContain('unique(requested_by,idempotency_key_hash)');
    expect(migrationSql).toContain('unique(run_id,step_key)');
    expect(migrationSql).toContain('unique(run_id,ordinal)');
    expect(migrationSql).toContain('unique(step_id,attempt_number)');
    expect(migrationSql).toContain(
      'constraint delivery_attempt_request_id_unique unique(request_id)',
    );
    expect(migrationSql).toContain(
      'constraint graphql_callback_request_id_unique unique(request_id)',
    );
    expect(migrationSql).toContain('check (scenario_version > 0)');
    expect(migrationSql).toContain('check (expected_callback_min >= 0)');
    expect(migrationSql).toContain(
      'check (expected_callback_max >= expected_callback_min)',
    );
    expect(migrationSql).toContain('check (ordinal >= 0)');
    expect(migrationSql).toContain('check (attempt_count >= 0)');
    expect(migrationSql).toContain('check (attempt_number > 0)');
    expect(
      migrationSql.match(/check \([^)]*http_status[^)]*between 100 and 599\)/g),
    ).toHaveLength(3);
    expect(
      migrationSql.match(/check \([^)]*duration_ms[^)]*>= 0\)/g),
    ).toHaveLength(3);
  });
});
