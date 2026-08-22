import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DrizzleRunRepository } from './drizzle-run-repository';
import type { CreateRunInput } from './run-repository';
import * as schema from './schema';

const actor = 'integration-test';
const idempotencyKeyHash = 'a'.repeat(64);
const requestFingerprint = 'b'.repeat(64);

type CreateInputOverrides = {
  run?: Partial<CreateRunInput['run']>;
  steps?: CreateRunInput['steps'];
};

function createInput(overrides: CreateInputOverrides = {}): CreateRunInput {
  return {
    run: {
      id: '00000000-0000-4000-8000-000000000001',
      scenarioKey: 'match-id-cliente',
      scenarioVersion: 1,
      idempotencyKeyHash,
      requestFingerprint,
      requestedBy: actor,
      seed: 42,
      variablesRedacted: {},
      dryRun: false,
      stopOnFailure: true,
      expectedCallbackMin: 0,
      expectedCallbackMax: 1,
      cleanupPolicy: 'ALWAYS',
      retentionExpiresAt: new Date('2026-08-23T12:00:00.000Z'),
      ...overrides.run,
    },
    steps: overrides.steps ?? [
      {
        stepKey: 'setup',
        ordinal: 0,
        target: 'SALESFORCE',
        status: 'PENDING',
        requestRedacted: {},
        responseRedacted: {},
        stepKind: 'SETUP',
      },
      {
        stepKey: 'dispatch',
        ordinal: 1,
        target: 'EVENT_GRID',
        eventType: 'CLIENTE',
        status: 'PENDING',
        requestRedacted: {},
        responseRedacted: {},
        stepKind: 'DISPATCH',
      },
    ],
  };
}

describe('DrizzleRunRepository with the real PostgreSQL migrations', () => {
  let client: PGlite;
  let repository: DrizzleRunRepository;

  beforeEach(async () => {
    client = new PGlite();
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: 'drizzle' });
    repository = new DrizzleRunRepository(database);
  });

  afterEach(async () => {
    await client.close();
  });

  it('applies 0000 plus the increment on an empty PostgreSQL-compatible database', async () => {
    const columns = await client.query<{
      column_name: string;
    }>(
      "select column_name from information_schema.columns where table_name = 'scenario_run'",
    );
    const stepStatuses = await client.query<{ enumlabel: string }>(
      "select enumlabel from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid where typname = 'step_status' order by enumsortorder",
    );

    expect(columns.rows.map(({ column_name }) => column_name)).toContain(
      'request_fingerprint',
    );
    expect(stepStatuses.rows.map(({ enumlabel }) => enumlabel)).toStrictEqual([
      'PENDING',
      'SCHEDULED',
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'SKIPPED',
    ]);
  });

  it('creates a run with steps and supports find, list, audit, and conditional status updates', async () => {
    const created = await repository.createRun(createInput());

    expect(created.outcome).toBe('CREATED');
    expect(await repository.findRun(created.run.id)).toMatchObject({
      id: created.run.id,
      requestFingerprint,
      status: 'CREATED',
    });
    const steps = await repository.listSteps(created.run.id, {
      limit: 100,
    });
    expect(steps.items).toHaveLength(2);
    expect((await repository.listRuns({ limit: 1 })).items).toHaveLength(1);

    await repository.appendAuditEvent({
      actor,
      action: 'RUN_CREATED',
      resourceType: 'scenario_run',
      resourceId: created.run.id,
      metadataRedacted: {},
    });
    expect(await repository.listAuditEvents(created.run.id, 10)).toHaveLength(
      1,
    );

    expect(
      await repository.updateRunStatus({
        runId: created.run.id,
        expectedStatus: 'CREATED',
        nextStatus: 'SCHEDULED',
      }),
    ).toBe(true);
    expect(
      await repository.updateRunStatus({
        runId: created.run.id,
        expectedStatus: 'CREATED',
        nextStatus: 'RUNNING',
      }),
    ).toBe(false);
    expect(
      await repository.updateStepStatus({
        stepId: steps.items[0].id,
        expectedStatus: 'PENDING',
        nextStatus: 'SCHEDULED',
        scheduledAt: new Date('2026-08-22T12:00:00.000Z'),
      }),
    ).toBe(true);
    expect(
      await repository.updateStepStatus({
        stepId: steps.items[0].id,
        expectedStatus: 'PENDING',
        nextStatus: 'RUNNING',
      }),
    ).toBe(false);
  });

  it('returns replay for the same key and fingerprint and conflict for a different body', async () => {
    const created = await repository.createRun(createInput());
    const replay = await repository.createRun(createInput());
    const conflict = await repository.createRun(
      createInput({
        run: {
          ...createInput().run,
          requestFingerprint: 'c'.repeat(64),
        },
      }),
    );

    expect(created.outcome).toBe('CREATED');
    expect(replay).toMatchObject({
      outcome: 'REPLAY',
      run: { id: created.run.id },
    });
    expect(conflict).toMatchObject({
      outcome: 'CONFLICT',
      run: { id: created.run.id },
    });
  });

  it('converges concurrent creates to one run and recovers missing steps on replay', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repository.createRun(createInput())),
    );

    expect(results.filter(({ outcome }) => outcome === 'CREATED')).toHaveLength(
      1,
    );
    expect(new Set(results.map(({ run }) => run.id))).toHaveLength(1);
    expect(
      (await repository.listSteps(results[0].run.id, { limit: 100 })).items,
    ).toHaveLength(2);

    await client.query('delete from scenario_run_step where ordinal = 1');
    const recovered = await repository.createRun(createInput());

    expect(recovered.outcome).toBe('REPLAY');
    expect(
      (await repository.listSteps(recovered.run.id, { limit: 100 })).items,
    ).toHaveLength(2);
  });

  it('enforces repository pagination and database constraints', async () => {
    await expect(repository.listRuns({ limit: 101 })).rejects.toThrow(
      'limit must be between 1 and 100',
    );

    await repository.createRun(createInput());
    await expect(
      client.query(
        `insert into scenario_run_step
          (run_id, step_key, ordinal, target, status, step_kind)
         select id, 'invalid', -1, 'TEST', 'PENDING', 'SETUP'
         from scenario_run limit 1`,
      ),
    ).rejects.toThrow();
  });

  it('applies bounded run filters and paginates steps in ordinal order', async () => {
    await repository.createRun(
      createInput({
        run: {
          id: '11111111-1111-4111-8111-111111111111',
          scenarioKey: 'match-id-cliente',
          status: 'CREATED',
        },
      }),
    );
    await repository.createRun(
      createInput({
        run: {
          id: '22222222-2222-4222-8222-222222222222',
          scenarioKey: 'no-match-cliente-insert',
          status: 'FAILED',
          idempotencyKeyHash: 'c'.repeat(64),
        },
      }),
    );

    const filtered = await repository.listRuns({
      limit: 10,
      filters: {
        status: 'FAILED',
        scenarioKey: 'no-match-cliente-insert',
        createdFrom: new Date('2026-01-01T00:00:00.000Z'),
        createdTo: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
    const page = await repository.listSteps(
      '11111111-1111-4111-8111-111111111111',
      { limit: 1, offset: 1 },
    );

    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].scenarioKey).toBe('no-match-cliente-insert');
    expect(filtered.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].ordinal).toBe(1);
    expect(page.total).toBe(2);
  });

  it('atomically claims one concurrent delivery, blocks out-of-order steps, and persists attempts', async () => {
    const created = await repository.createRun(
      createInput({
        steps: [
          {
            stepKey: 'dispatch-1',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'dispatch-2',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const [first, second] = (
      await repository.listSteps(created.run.id, { limit: 10 })
    ).items;

    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: second.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'OUT_OF_ORDER' });

    const claims = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.claimDispatch({
          runId: created.run.id,
          stepId: first.id,
          attemptNumber: 1,
          claimedAt: new Date('2026-08-22T12:00:00.000Z'),
        }),
      ),
    );
    expect(claims.filter(({ outcome }) => outcome === 'CLAIMED')).toHaveLength(
      1,
    );
    expect(
      claims.filter(({ outcome }) => outcome === 'ALREADY_RUNNING'),
    ).toHaveLength(4);

    await repository.completeDispatch({
      runId: created.run.id,
      stepId: first.id,
      attemptNumber: 1,
      requestId: 'delivery-request-1',
      httpStatus: 200,
      durationMs: 0,
      responseRedacted: { transport: 'FAKE_SALESFORCE', network: false },
      errorCode: null,
      finishedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: first.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:01.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'TERMINAL' });
    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: second.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:01.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });

    await repository.completeDispatch({
      runId: created.run.id,
      stepId: second.id,
      attemptNumber: 1,
      requestId: 'delivery-request-2',
      httpStatus: 200,
      durationMs: 0,
      responseRedacted: { transport: 'FAKE_SALESFORCE', network: false },
      errorCode: null,
      finishedAt: new Date('2026-08-22T12:00:01.000Z'),
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'WAITING_ASYNC',
    });
    expect(await repository.listDeliveryAttempts(first.id, 10)).toHaveLength(1);
    expect(await repository.listDeliveryAttempts(second.id, 10)).toHaveLength(
      1,
    );
  });

  it('completes a dispatch through a Neon-compatible adapter that rejects transactions', async () => {
    const created = await repository.createRun(
      createInput({
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    const database = Reflect.get(repository, 'database') as object;
    const transaction = vi.fn(() => {
      throw new Error('No transactions support in neon-http driver');
    });
    Reflect.set(
      repository,
      'database',
      new Proxy(database, {
        get(target, property) {
          if (property === 'transaction') return transaction;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }),
    );

    await repository.completeDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      requestId: 'neon-compatible-completion',
      httpStatus: 200,
      durationMs: 1,
      responseRedacted: { network: false },
      errorCode: null,
      finishedAt: new Date('2026-08-22T12:00:01.000Z'),
    });

    expect(transaction).not.toHaveBeenCalled();
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({ status: 'SUCCEEDED' });
  });

  it('recovers an inserted attempt whose running step was not completed without duplicating history', async () => {
    const created = await repository.createRun(
      createInput({
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await client.query(
      `insert into delivery_attempt
         (id, step_id, attempt_number, request_id, http_status, duration_ms,
          response_redacted, error_code, created_at)
       values
         ('33333333-3333-4333-8333-333333333333', $1, 1,
          'partial-attempt', 200, 1, '{"network":false}', null,
          '2026-08-22T12:00:01.000Z')`,
      [step.id],
    );

    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: step.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:02.000Z'),
      }),
    ).resolves.toStrictEqual({ outcome: 'TERMINAL' });
    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: step.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:03.000Z'),
      }),
    ).resolves.toStrictEqual({ outcome: 'TERMINAL' });

    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({ status: 'SUCCEEDED' });
    expect(await repository.listDeliveryAttempts(step.id, 10)).toHaveLength(1);
  });

  it('backfills a missing attempt for an already completed step on redelivery', async () => {
    const created = await repository.createRun(
      createInput({
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await client.query(
      `update scenario_run_step
          set status = 'SUCCEEDED', finished_at = '2026-08-22T12:00:01.000Z',
              http_status = 200, duration_ms = 1,
              response_redacted = '{"network":false}', error_code = null
        where id = $1`,
      [step.id],
    );

    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: step.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:02.000Z'),
      }),
    ).resolves.toStrictEqual({ outcome: 'TERMINAL' });

    expect(await repository.listDeliveryAttempts(step.id, 10)).toMatchObject([
      {
        attemptNumber: 1,
        requestId: `recovery:${step.id}:1`,
        httpStatus: 200,
      },
    ]);
  });

  it('reconciles a late partial completion without reopening a cancelling run', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await repository.beginCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
    });
    await client.query(
      `insert into delivery_attempt
         (id, step_id, attempt_number, request_id, http_status, duration_ms,
          response_redacted, error_code, created_at)
       values
         ('44444444-4444-4444-8444-444444444444', $1, 1,
          'late-partial-attempt', 200, 1, '{"network":false}', null,
          '2026-08-22T12:00:01.000Z')`,
      [step.id],
    );

    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: step.id,
        attemptNumber: 1,
        claimedAt: new Date('2026-08-22T12:00:02.000Z'),
      }),
    ).resolves.toStrictEqual({ outcome: 'TERMINAL' });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'CANCELLING',
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({ status: 'SUCCEEDED' });
  });

  it('persists QStash message ids and exposes FAILED/PARTIAL scheduling recovery through audit', async () => {
    const failed = await repository.createRun(createInput());
    const failedStep = (
      await repository.listSteps(failed.run.id, { limit: 10 })
    ).items[1];
    await repository.recordSchedulingFailure({
      runId: failed.run.id,
      failedStepId: failedStep.id,
      publishedCount: 0,
    });
    expect(await repository.findRun(failed.run.id)).toMatchObject({
      status: 'FAILED',
    });

    const partial = await repository.createRun(
      createInput({
        run: {
          id: '33333333-3333-4333-8333-333333333333',
          idempotencyKeyHash: 'd'.repeat(64),
        },
      }),
    );
    const partialStep = (
      await repository.listSteps(partial.run.id, { limit: 10 })
    ).items[1];
    expect(
      await repository.recordStepScheduled({
        stepId: partialStep.id,
        messageId: 'msg-persisted',
      }),
    ).toBe(true);
    await repository.recordSchedulingFailure({
      runId: partial.run.id,
      failedStepId: partialStep.id,
      publishedCount: 1,
    });

    expect(await repository.findRun(partial.run.id)).toMatchObject({
      status: 'PARTIAL',
    });
    expect(
      (await repository.listSteps(partial.run.id, { limit: 10 })).items[1],
    ).toMatchObject({
      qstashMessageId: 'msg-persisted',
      status: 'SCHEDULED',
    });
    expect(await repository.listAuditEvents(partial.run.id, 10)).toEqual([
      expect.objectContaining({
        action: 'RUN_SCHEDULING_FAILED',
        metadataRedacted: expect.objectContaining({
          publishedCount: 1,
          recoveryRequired: true,
        }),
      }),
    ]);
  });

  it('atomically begins cancellation, cancels only pending work, and audits sanitized metadata', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'scheduled',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            qstashMessageId: 'msg-scheduled',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'pending',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'running',
            ordinal: 2,
            target: 'CLIENTE',
            status: 'RUNNING',
            qstashMessageId: 'msg-running',
            attemptCount: 1,
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );

    const begun = await repository.beginCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      reasonCode: 'OPERATOR_REQUEST',
    });
    expect(begun).toStrictEqual({
      outcome: 'STARTED',
      messageIds: ['msg-scheduled'],
      affectedStepCount: 2,
    });
    await expect(
      repository.claimDispatch({
        runId: created.run.id,
        stepId: (await repository.listSteps(created.run.id, { limit: 10 }))
          .items[0].id,
        attemptNumber: 1,
        claimedAt: new Date(),
      }),
    ).resolves.toStrictEqual({ outcome: 'TERMINAL' });

    await repository.finalizeCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      reasonCode: 'OPERATOR_REQUEST',
      expectedAffectedStepCount: 2,
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items.map(
        ({ status }) => status,
      ),
    ).toStrictEqual(['CANCELLED', 'CANCELLED', 'RUNNING']);
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'CANCELLED',
    });
    const audit = await repository.listAuditEvents(created.run.id, 10);
    expect(audit.map(({ action }) => action)).toStrictEqual([
      'RUN_CANCELLED',
      'RUN_CANCELLATION_STARTED',
    ]);
    expect(JSON.stringify(audit)).not.toContain('token');
    expect(JSON.stringify(audit)).not.toContain('payload');
  });

  it('keeps a failed QStash cancellation in CANCELLING with a technical audit error', async () => {
    const created = await repository.createRun(
      createInput({ run: { status: 'RUNNING' } }),
    );
    await repository.beginCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
    });
    await repository.recordCancellationFailure({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      requestedCount: 1,
      errorCode: 'QSTASH_CANCEL_FAILED',
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'CANCELLING',
    });
    expect(await repository.listAuditEvents(created.run.id, 10)).toContainEqual(
      expect.objectContaining({
        action: 'RUN_CANCELLATION_FAILED',
        metadataRedacted: {
          count: 1,
          status: 'CANCELLING',
          errorCode: 'QSTASH_CANCEL_FAILED',
        },
      }),
    );
  });

  it('lets only one concurrent cancellation begin', async () => {
    const created = await repository.createRun(
      createInput({ run: { status: 'SCHEDULED' } }),
    );
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.beginCancellation({
          runId: created.run.id,
          actor: 'simulator-admin-api',
        }),
      ),
    );

    expect(results.filter(({ outcome }) => outcome === 'STARTED')).toHaveLength(
      1,
    );
    expect(
      results.filter(({ outcome }) => outcome === 'IN_PROGRESS'),
    ).toHaveLength(4);
    expect(
      (await repository.listAuditEvents(created.run.id, 10)).filter(
        ({ action }) => action === 'RUN_CANCELLATION_STARTED',
      ),
    ).toHaveLength(1);
  });

  it('does not reopen CANCELLED when an already running delivery completes', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await repository.beginCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
    });
    await repository.finalizeCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      expectedAffectedStepCount: 0,
    });

    await expect(
      repository.completeDispatch({
        runId: created.run.id,
        stepId: step.id,
        attemptNumber: 1,
        requestId: 'late-delivery',
        httpStatus: 200,
        durationMs: 1,
        responseRedacted: { network: false },
        errorCode: null,
        finishedAt: new Date('2026-08-22T12:00:01.000Z'),
      }),
    ).resolves.toStrictEqual({ runStatus: 'CANCELLED' });
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('reserves one concurrent retry, increments the attempt, and preserves prior history', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await repository.completeDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      requestId: 'failed-attempt-1',
      httpStatus: 503,
      durationMs: 1,
      responseRedacted: { network: false },
      errorCode: 'DISPATCH_TARGET_FAILED',
      finishedAt: new Date('2026-08-22T12:00:01.000Z'),
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.reserveRetries({
          runId: created.run.id,
          stepKeys: ['dispatch'],
          actor: 'simulator-admin-api',
        }),
      ),
    );
    expect(
      results.filter(({ outcome }) => outcome === 'RESERVED'),
    ).toHaveLength(1);
    expect(
      results.filter(({ outcome }) => outcome === 'NO_ELIGIBLE'),
    ).toHaveLength(4);
    expect(await repository.listDeliveryAttempts(step.id, 10)).toMatchObject([
      { attemptNumber: 1, requestId: 'failed-attempt-1' },
      {
        attemptNumber: 2,
        requestId: `retry:${created.run.id}:${step.id}:2`,
      },
    ]);
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({ status: 'PENDING', attemptCount: 2 });
  });

  it('fills the reserved attempt when a retry dispatch completes', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      claimedAt: new Date('2026-08-22T12:00:00.000Z'),
    });
    await repository.completeDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 1,
      requestId: 'failed-before-retry',
      httpStatus: 503,
      durationMs: 1,
      responseRedacted: { network: false },
      errorCode: 'DISPATCH_TARGET_FAILED',
      finishedAt: new Date('2026-08-22T12:00:01.000Z'),
    });
    await repository.reserveRetries({
      runId: created.run.id,
      stepKeys: ['dispatch'],
      actor: 'simulator-admin-api',
    });
    await repository.claimDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 2,
      claimedAt: new Date('2026-08-22T12:00:02.000Z'),
    });

    await repository.completeDispatch({
      runId: created.run.id,
      stepId: step.id,
      attemptNumber: 2,
      requestId: 'successful-retry-delivery',
      httpStatus: 200,
      durationMs: 1,
      responseRedacted: { network: false },
      errorCode: null,
      finishedAt: new Date('2026-08-22T12:00:03.000Z'),
    });

    expect(await repository.listDeliveryAttempts(step.id, 10)).toMatchObject([
      { attemptNumber: 1, httpStatus: 503 },
      { attemptNumber: 2, httpStatus: 200, errorCode: null },
    ]);
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({ status: 'SUCCEEDED', attemptCount: 2 });
  });
});
