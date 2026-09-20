import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DrizzleRunRepository } from './drizzle-run-repository';
import type { CreateRunInput } from './run-repository';
import * as schema from './schema';
import { QStashRunScheduler } from '../runs/qstash-scheduler';
import { createSalesforceLifecycleService } from '../runs/salesforce-lifecycle';
import { renderScenarioFixture } from '../scenarios/renderer';

const actor = 'integration-test';
const idempotencyKeyHash = 'a'.repeat(64);
const requestFingerprint = 'b'.repeat(64);
const fixtureSnapshot = renderScenarioFixture({
  scenarioKey: 'match-id-cliente',
  version: 1,
  seed: 'repository-test',
  runId: 'run_00000000000040008000000000000001',
  eventStartAt: '2026-08-21T10:00:00.000Z',
});

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
      fixtureSnapshot,
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
        eventEnvelope: [
          {
            id: 'evt-1',
            subject: 'cliente/evt-1',
            eventType: 'cliente-update',
            eventTime: '2026-08-21T10:00:00Z',
            dataVersion: '1.0',
            metadataVersion: '1',
            topic: '/subscriptions/test/topics/clientes',
            data: {
              idcliente: 'cli-1',
              id: 'cli-1',
              numerocpf: '12345678901',
              dataalteracao: '2026-08-21T10:00:00Z',
            },
          },
        ],
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
  let currentTime: Date;

  beforeEach(async () => {
    currentTime = new Date('2026-08-22T12:00:00.000Z');
    client = new PGlite();
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: 'drizzle' });
    repository = new DrizzleRunRepository(database, {
      now: () => currentTime,
    });
  });

  afterEach(async () => {
    await client.close();
  });

  it('applies migrations 0000 through the fixture snapshot increment on an empty PostgreSQL-compatible database', async () => {
    const runColumns = await client.query<{
      column_name: string;
    }>(
      "select column_name from information_schema.columns where table_name = 'scenario_run'",
    );
    const stepColumns = await client.query<{
      column_name: string;
    }>(
      "select column_name from information_schema.columns where table_name = 'scenario_run_step'",
    );
    const stepStatuses = await client.query<{ enumlabel: string }>(
      "select enumlabel from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid where typname = 'step_status' order by enumsortorder",
    );

    expect(runColumns.rows.map(({ column_name }) => column_name)).toContain(
      'request_fingerprint',
    );
    expect(runColumns.rows.map(({ column_name }) => column_name)).toEqual(
      expect.arrayContaining([
        'fixture_snapshot',
        'scheduling_kind',
        'scheduling_lease_expires_at',
      ]),
    );
    expect(stepColumns.rows.map(({ column_name }) => column_name)).toEqual(
      expect.arrayContaining([
        'event_envelope',
        'scheduling_kind',
        'scheduling_lease_expires_at',
      ]),
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
    expect(steps.items[1].eventEnvelope).toStrictEqual(
      createInput().steps[1]?.eventEnvelope,
    );
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
    const recoveryInput = createInput();
    const recovered = await repository.createRun({
      ...recoveryInput,
      steps: recoveryInput.steps.map((step) =>
        step.stepKind === 'DISPATCH'
          ? { ...step, stepKey: fixtureSnapshot.steps[0]!.key }
          : step,
      ),
    });

    expect(recovered.outcome).toBe('REPLAY');
    expect(
      (await repository.listSteps(recovered.run.id, { limit: 100 })).items,
    ).toHaveLength(2);
    expect(
      (await repository.listSteps(recovered.run.id, { limit: 100 })).items.find(
        ({ stepKind }) => stepKind === 'DISPATCH',
      )?.eventEnvelope,
    ).toStrictEqual(fixtureSnapshot.steps[0]?.envelope);
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

  it('returns the persisted dispatch envelope for the handler payload reconstruction', async () => {
    const created = await repository.createRun(createInput());
    const dispatchStep = (
      await repository.listSteps(created.run.id, { limit: 10 })
    ).items[1];

    await expect(
      repository.getDispatchPayload({
        runId: created.run.id,
        stepId: dispatchStep.id,
      }),
    ).resolves.toStrictEqual(createInput().steps[1]?.eventEnvelope);
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
    await repository.claimInitialScheduling({
      runId: failed.run.id,
      actor,
      recovery: false,
    });
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
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
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
    await repository.claimInitialScheduling({
      runId: partial.run.id,
      actor,
      recovery: false,
    });
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
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
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

  it('conditionally claims initial scheduling recovery once and preserves published steps', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'PARTIAL' },
        steps: [
          {
            stepKey: 'published',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            qstashMessageId: 'msg-published',
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
        ],
      }),
    );

    const claims = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.claimInitialScheduling({
          runId: created.run.id,
          actor: 'simulator-admin-api',
          recovery: true,
        }),
      ),
    );

    expect(claims.filter(({ outcome }) => outcome === 'CLAIMED')).toHaveLength(
      1,
    );
    expect(
      claims.filter(({ outcome }) => outcome === 'IN_PROGRESS'),
    ).toHaveLength(4);
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'PROVISIONING',
      schedulingKind: 'INITIAL',
      schedulingLeaseExpiresAt: new Date('2026-08-22T12:01:00.000Z'),
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({
      status: 'SCHEDULED',
      qstashMessageId: 'msg-published',
    });
    expect(await repository.listAuditEvents(created.run.id, 10)).toContainEqual(
      expect.objectContaining({
        action: 'RUN_SCHEDULING_RECOVERY_STARTED',
        metadataRedacted: { pendingCount: 1, previousStatus: 'PARTIAL' },
      }),
    );
    await repository.markRunScheduled(created.run.id);
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'SCHEDULED',
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
    });
  });

  it('reconciles a single zero-delay dispatch that completes before QStash publish returns', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'PROVISIONING', expectedCallbackMax: 0 },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON: vi.fn(async ({ body }) => {
          await expect(
            repository.claimDispatch({
              runId: body.runId,
              stepId: body.stepId,
              attemptNumber: body.attemptNumber,
              claimedAt: new Date('2026-08-22T12:00:00.000Z'),
            }),
          ).resolves.toStrictEqual({ outcome: 'CLAIMED' });
          await repository.completeDispatch({
            runId: body.runId,
            stepId: body.stepId,
            attemptNumber: body.attemptNumber,
            requestId: 'instant-delivery',
            httpStatus: 200,
            durationMs: 1,
            responseRedacted: { network: false },
            errorCode: null,
            finishedAt: new Date('2026-08-22T12:00:01.000Z'),
          });
          return { messageId: `msg-${body.stepId}` };
        }),
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await scheduler.schedule({
      runId: created.run.id,
      steps: [
        {
          stepId: step.id,
          stepKey: step.stepKey,
          ordinal: step.ordinal,
          delayMs: 0,
          attemptNumber: 1,
        },
      ],
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'VERIFYING',
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({ status: 'SUCCEEDED', qstashMessageId: `msg-${step.id}` });
  });

  it('does not leave a run scheduled when all zero-delay dispatches finish before markRunScheduled', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'PROVISIONING', expectedCallbackMax: 1 },
        steps: [
          {
            stepKey: 'first',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'second',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const dispatchSteps = (
      await repository.listSteps(created.run.id, { limit: 10 })
    ).items;
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON: vi.fn(async ({ body }) => {
          await repository.claimDispatch({
            runId: body.runId,
            stepId: body.stepId,
            attemptNumber: body.attemptNumber,
            claimedAt: new Date('2026-08-22T12:00:00.000Z'),
          });
          await repository.completeDispatch({
            runId: body.runId,
            stepId: body.stepId,
            attemptNumber: body.attemptNumber,
            requestId: `instant-${body.stepId}`,
            httpStatus: 200,
            durationMs: 1,
            responseRedacted: { network: false },
            errorCode: null,
            finishedAt: new Date('2026-08-22T12:00:01.000Z'),
          });
          return { messageId: `msg-${body.stepId}` };
        }),
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await scheduler.schedule({
      runId: created.run.id,
      steps: dispatchSteps.map((step) => ({
        stepId: step.id,
        stepKey: step.stepKey,
        ordinal: step.ordinal,
        delayMs: 0,
        attemptNumber: 1,
      })),
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'WAITING_ASYNC',
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items.map(
        ({ status }) => status,
      ),
    ).toStrictEqual(['SUCCEEDED', 'SUCCEEDED']);
  });

  it('keeps an in-progress run running when one fast dispatch completes and another remains scheduled', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'PROVISIONING', expectedCallbackMax: 0 },
        steps: [
          {
            stepKey: 'first',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'second',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const dispatchSteps = (
      await repository.listSteps(created.run.id, { limit: 10 })
    ).items;
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON: vi.fn(async ({ body }) => {
          if (body.stepId === dispatchSteps[0].id) {
            await repository.claimDispatch({
              runId: body.runId,
              stepId: body.stepId,
              attemptNumber: body.attemptNumber,
              claimedAt: new Date('2026-08-22T12:00:00.000Z'),
            });
            await repository.completeDispatch({
              runId: body.runId,
              stepId: body.stepId,
              attemptNumber: body.attemptNumber,
              requestId: 'instant-first',
              httpStatus: 200,
              durationMs: 1,
              responseRedacted: { network: false },
              errorCode: null,
              finishedAt: new Date('2026-08-22T12:00:01.000Z'),
            });
          }
          return { messageId: `msg-${body.stepId}` };
        }),
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await scheduler.schedule({
      runId: created.run.id,
      steps: dispatchSteps.map((step) => ({
        stepId: step.id,
        stepKey: step.stepKey,
        ordinal: step.ordinal,
        delayMs: 0,
        attemptNumber: 1,
      })),
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'RUNNING',
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items.map(
        ({ status }) => status,
      ),
    ).toStrictEqual(['SUCCEEDED', 'SCHEDULED']);
  });

  it('preserves cancellation when a zero-delay delivery races with final scheduling reconciliation', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'PROVISIONING', expectedCallbackMax: 0 },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON: vi.fn(async ({ body }) => {
          await repository.claimDispatch({
            runId: body.runId,
            stepId: body.stepId,
            attemptNumber: body.attemptNumber,
            claimedAt: new Date('2026-08-22T12:00:00.000Z'),
          });
          await repository.beginCancellation({
            runId: body.runId,
            actor: 'simulator-admin-api',
          });
          await repository.completeDispatch({
            runId: body.runId,
            stepId: body.stepId,
            attemptNumber: body.attemptNumber,
            requestId: 'cancel-race-delivery',
            httpStatus: 200,
            durationMs: 1,
            responseRedacted: { network: false },
            errorCode: null,
            finishedAt: new Date('2026-08-22T12:00:01.000Z'),
          });
          return { messageId: `msg-${body.stepId}` };
        }),
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await scheduler.schedule({
      runId: created.run.id,
      steps: [
        {
          stepId: step.id,
          stepKey: step.stepKey,
          ordinal: step.ordinal,
          delayMs: 0,
          attemptNumber: 1,
        },
      ],
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'CANCELLING',
    });
  });

  it('records a partial scheduling failure without erasing a fast dispatch success', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'PROVISIONING', expectedCallbackMax: 0 },
        steps: [
          {
            stepKey: 'first',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'second',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const dispatchSteps = (
      await repository.listSteps(created.run.id, { limit: 10 })
    ).items;
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON: vi
          .fn()
          .mockImplementationOnce(async ({ body }) => {
            await repository.claimDispatch({
              runId: body.runId,
              stepId: body.stepId,
              attemptNumber: body.attemptNumber,
              claimedAt: new Date('2026-08-22T12:00:00.000Z'),
            });
            await repository.completeDispatch({
              runId: body.runId,
              stepId: body.stepId,
              attemptNumber: body.attemptNumber,
              requestId: 'instant-before-failure',
              httpStatus: 200,
              durationMs: 1,
              responseRedacted: { network: false },
              errorCode: null,
              finishedAt: new Date('2026-08-22T12:00:01.000Z'),
            });
            return { messageId: `msg-${body.stepId}` };
          })
          .mockRejectedValueOnce(new Error('provider unavailable')),
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await expect(
      scheduler.schedule({
        runId: created.run.id,
        steps: dispatchSteps.map((step) => ({
          stepId: step.id,
          stepKey: step.stepKey,
          ordinal: step.ordinal,
          delayMs: 0,
          attemptNumber: 1,
        })),
      }),
    ).rejects.toThrow('QStash scheduling failed');

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'PARTIAL',
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items.map(
        ({ status }) => status,
      ),
    ).toStrictEqual(['SUCCEEDED', 'PENDING']);
  });

  it('reclaims an expired initial scheduling lease but not a valid lease', async () => {
    const created = await repository.createRun(createInput());

    await expect(
      repository.claimInitialScheduling({
        runId: created.run.id,
        actor,
        recovery: false,
      }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });

    currentTime = new Date('2026-08-22T12:00:59.999Z');
    await expect(
      repository.claimInitialScheduling({
        runId: created.run.id,
        actor,
        recovery: true,
      }),
    ).resolves.toStrictEqual({ outcome: 'IN_PROGRESS' });

    currentTime = new Date('2026-08-22T12:01:00.000Z');
    const claims = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.claimInitialScheduling({
          runId: created.run.id,
          actor,
          recovery: true,
        }),
      ),
    );

    expect(claims.filter(({ outcome }) => outcome === 'CLAIMED')).toHaveLength(
      1,
    );
    expect(
      claims.filter(({ outcome }) => outcome === 'IN_PROGRESS'),
    ).toHaveLength(4);
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'PROVISIONING',
      schedulingKind: 'INITIAL',
      schedulingLeaseExpiresAt: new Date('2026-08-22T12:02:00.000Z'),
    });
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
          requestedCount: 1,
          cancelledCount: 0,
          pendingCount: 1,
          status: 'CANCELLING',
          errorCode: 'QSTASH_CANCEL_FAILED',
        },
      }),
    );
  });

  it('persists partial cancellation progress and replay exposes only remaining messages', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'first',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            qstashMessageId: 'msg-first',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'second',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            qstashMessageId: 'msg-second',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    await repository.beginCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
    });
    await repository.recordCancellationProgress({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      messageIds: ['msg-first'],
    });
    await repository.recordCancellationFailure({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      requestedCount: 2,
      cancelledCount: 1,
      errorCode: 'QSTASH_CANCEL_FAILED',
    });

    await expect(
      repository.beginCancellation({
        runId: created.run.id,
        actor: 'simulator-admin-api',
      }),
    ).resolves.toStrictEqual({
      outcome: 'IN_PROGRESS',
      status: 'CANCELLING',
      messageIds: ['msg-second'],
      affectedStepCount: 1,
    });
    await repository.recordCancellationProgress({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      messageIds: ['msg-second'],
    });
    await repository.finalizeCancellation({
      runId: created.run.id,
      actor: 'simulator-admin-api',
      expectedAffectedStepCount: 1,
    });

    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'CANCELLED',
    });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items.map(
        ({ status }) => status,
      ),
    ).toStrictEqual(['CANCELLED', 'CANCELLED']);
    const audit = await repository.listAuditEvents(created.run.id, 10);
    expect(audit.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'RUN_CANCELLATION_PROGRESS',
        'RUN_CANCELLATION_FAILED',
        'RUN_CANCELLED',
      ]),
    );
    expect(JSON.stringify(audit)).not.toContain('msg-first');
    expect(JSON.stringify(audit)).not.toContain('payload');
  });

  it('lets only one concurrent cancellation begin', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'SCHEDULED' },
        steps: [
          {
            stepKey: 'scheduled',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SCHEDULED',
            qstashMessageId: 'msg-concurrent',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
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
      results
        .filter(({ outcome }) => outcome === 'IN_PROGRESS')
        .every(
          (result) =>
            'messageIds' in result &&
            result.messageIds.includes(
              (
                results.find(({ outcome }) => outcome === 'STARTED') as {
                  messageIds: string[];
                }
              ).messageIds[0],
            ),
        ),
    ).toBe(true);
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
    ).toMatchObject({
      status: 'PENDING',
      attemptCount: 2,
      schedulingKind: 'RETRY',
      schedulingLeaseExpiresAt: new Date('2026-08-22T12:01:00.000Z'),
    });
  });

  it('reclaims a crashed retry with the same durable attempt and does not duplicate history', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'FAILED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'FAILED',
            attemptCount: 1,
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];

    const initial = await repository.reserveRetries({
      runId: created.run.id,
      actor,
    });
    expect(initial).toMatchObject({
      outcome: 'RESERVED',
      steps: [{ stepId: step.id, attemptNumber: 2 }],
    });

    currentTime = new Date('2026-08-22T12:00:59.999Z');
    await expect(
      repository.reserveRetries({ runId: created.run.id, actor }),
    ).resolves.toMatchObject({ outcome: 'IN_PROGRESS' });

    currentTime = new Date('2026-08-22T12:01:00.000Z');
    const reclaims = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.reserveRetries({ runId: created.run.id, actor }),
      ),
    );
    expect(
      reclaims.filter(({ outcome }) => outcome === 'RESERVED'),
    ).toHaveLength(1);
    expect(
      reclaims.find(({ outcome }) => outcome === 'RESERVED'),
    ).toMatchObject({
      steps: [{ stepId: step.id, attemptNumber: 2 }],
    });
    expect(await repository.listDeliveryAttempts(step.id, 10)).toHaveLength(1);
    expect(await repository.listDeliveryAttempts(step.id, 10)).toMatchObject([
      {
        attemptNumber: 2,
        requestId: `retry:${created.run.id}:${step.id}:2`,
      },
    ]);
  });

  it('clears retry leases after message persistence and never reserves the published step again', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'FAILED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'FAILED',
            attemptCount: 1,
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    await repository.reserveRetries({ runId: created.run.id, actor });

    await expect(
      repository.recordStepScheduled({
        stepId: step.id,
        messageId: 'msg-retry-persisted',
      }),
    ).resolves.toBe(true);
    currentTime = new Date('2026-08-22T12:02:00.000Z');

    await expect(
      repository.reserveRetries({ runId: created.run.id, actor }),
    ).resolves.toMatchObject({ outcome: 'NO_ELIGIBLE' });
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({
      status: 'SCHEDULED',
      qstashMessageId: 'msg-retry-persisted',
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
    });
  });

  it('expires an explicit retry scheduling failure and reuses the same attempt immediately', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'FAILED' },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'FAILED',
            attemptCount: 1,
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const first = await repository.reserveRetries({
      runId: created.run.id,
      actor,
    });
    expect(first).toMatchObject({
      outcome: 'RESERVED',
      steps: [{ attemptNumber: 2 }],
    });
    if (first.outcome !== 'RESERVED') throw new Error('retry was not reserved');

    await repository.releaseRetryReservations({
      runId: created.run.id,
      stepIds: first.steps.map(({ stepId }) => stepId),
      actor,
      errorCode: 'QSTASH_SCHEDULING_FAILED',
    });

    await expect(
      repository.reserveRetries({ runId: created.run.id, actor }),
    ).resolves.toMatchObject({
      outcome: 'RESERVED',
      steps: [{ attemptNumber: 2 }],
    });
    const step = (await repository.listSteps(created.run.id, { limit: 10 }))
      .items[0];
    expect(await repository.listDeliveryAttempts(step.id, 10)).toHaveLength(1);
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
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items[0],
    ).toMatchObject({
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
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

  it('persists the complete rendered fixture without exposing it through step payloads', async () => {
    const created = await repository.createRun(createInput());

    expect(
      (await repository.findRun(created.run.id))?.fixtureSnapshot,
    ).toStrictEqual(fixtureSnapshot);
    expect(
      (await repository.listRuns({ limit: 10 })).items[0].fixtureSnapshot,
    ).toStrictEqual(fixtureSnapshot);
  });

  it('claims lifecycle work once and reclaims a stale running step', async () => {
    const created = await repository.createRun(
      createInput({
        run: {
          status: 'VERIFYING',
          expectedCallbackMax: 0,
        },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SUCCEEDED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'verify',
            ordinal: 1,
            target: 'SALESFORCE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'VERIFY',
          },
          {
            stepKey: 'cleanup',
            ordinal: 2,
            target: 'ACCOUNT',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'CLEANUP',
          },
        ],
      }),
    );

    const claims = await Promise.all(
      Array.from({ length: 2 }, () =>
        repository.claimLifecycleStep({
          runId: created.run.id,
          stepKind: 'VERIFY',
          claimedAt: currentTime,
          actor,
        }),
      ),
    );
    expect(claims.filter(({ outcome }) => outcome === 'CLAIMED')).toHaveLength(
      1,
    );
    expect(
      claims.filter(({ outcome }) => outcome === 'IN_PROGRESS'),
    ).toHaveLength(1);

    currentTime = new Date('2026-08-22T12:01:01.000Z');
    await expect(
      repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'VERIFY',
        claimedAt: currentTime,
        actor,
      }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });
  });

  it('audits setup lifecycle transitions with technical metadata only', async () => {
    const created = await repository.createRun(
      createInput({
        run: {
          status: 'PROVISIONING',
          schedulingKind: 'INITIAL',
          schedulingLeaseExpiresAt: new Date('2026-08-22T12:01:00.000Z'),
        },
        steps: [
          {
            stepKey: 'setup',
            ordinal: 0,
            target: 'ACCOUNT',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'SETUP',
          },
          {
            stepKey: 'dispatch',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );
    const claim = await repository.claimLifecycleStep({
      runId: created.run.id,
      stepKind: 'SETUP',
      claimedAt: currentTime,
      actor,
    });
    if (claim.outcome !== 'CLAIMED') throw new Error('setup was not claimed');
    await repository.completeLifecycleStep({
      runId: created.run.id,
      stepId: claim.step.id,
      stepKind: 'SETUP',
      succeeded: true,
      responseRedacted: {
        status: 'CREATED',
        createdCount: 1,
        replayedCount: 0,
      },
      errorCode: null,
      actor,
      finishedAt: currentTime,
    });

    const audits = await repository.listAuditEvents(created.run.id, 10);
    expect(audits.map(({ action }) => action).sort()).toStrictEqual([
      'SETUP_STARTED',
      'SETUP_SUCCEEDED',
    ]);
    expect(JSON.stringify(audits)).not.toContain('access_token');
  });

  it('reclaims a stale setup step after the durable scheduling lease expires', async () => {
    const created = await repository.createRun(
      createInput({
        run: {
          status: 'PROVISIONING',
          schedulingKind: 'INITIAL',
          schedulingLeaseExpiresAt: new Date('2026-08-22T12:01:00.000Z'),
        },
        steps: [
          {
            stepKey: 'setup',
            ordinal: 0,
            target: 'ACCOUNT',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'SETUP',
          },
          {
            stepKey: 'dispatch',
            ordinal: 1,
            target: 'CLIENTE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
        ],
      }),
    );

    await expect(
      repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'SETUP',
        claimedAt: currentTime,
        actor,
      }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });
    await expect(
      repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'SETUP',
        claimedAt: currentTime,
        actor,
      }),
    ).resolves.toStrictEqual({ outcome: 'IN_PROGRESS' });

    currentTime = new Date('2026-08-22T12:01:01.000Z');
    await expect(
      repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'SETUP',
        claimedAt: currentTime,
        actor,
      }),
    ).resolves.toMatchObject({ outcome: 'CLAIMED' });
  });

  it('runs verify and cleanup through the real repository to SUCCEEDED', async () => {
    const created = await repository.createRun(
      createInput({
        run: { status: 'VERIFYING', expectedCallbackMax: 0 },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SUCCEEDED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'verify',
            ordinal: 1,
            target: 'SALESFORCE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'VERIFY',
          },
          {
            stepKey: 'cleanup',
            ordinal: 2,
            target: 'ACCOUNT',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'CLEANUP',
          },
        ],
      }),
    );
    const testDataAdapter = {
      setup: vi.fn(),
      verify: vi.fn().mockResolvedValue({ passed: true, checks: [] }),
      cleanup: vi
        .fn()
        .mockResolvedValue({ status: 'DELETED', deletedCount: 1 }),
    };
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor,
      now: () => currentTime,
    });

    await expect(service.afterDispatch(created.run.id)).resolves.toStrictEqual({
      outcome: 'COMPLETED',
      status: 'SUCCEEDED',
    });
    expect(testDataAdapter.verify).toHaveBeenCalledOnce();
    expect(testDataAdapter.cleanup).toHaveBeenCalledOnce();
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'SUCCEEDED',
    });
  });

  it.each([
    {
      verifySucceeded: true,
      cleanupSucceeded: true,
      expected: 'SUCCEEDED',
    },
    {
      verifySucceeded: false,
      cleanupSucceeded: true,
      expected: 'FAILED',
    },
    {
      verifySucceeded: true,
      cleanupSucceeded: false,
      expected: 'PARTIAL',
    },
  ] as const)(
    'finalizes verify=$verifySucceeded cleanup=$cleanupSucceeded as $expected',
    async ({ verifySucceeded, cleanupSucceeded, expected }) => {
      const created = await repository.createRun(
        createInput({
          run: { status: 'VERIFYING', expectedCallbackMax: 0 },
          steps: [
            {
              stepKey: 'dispatch',
              ordinal: 0,
              target: 'CLIENTE',
              status: 'SUCCEEDED',
              requestRedacted: {},
              responseRedacted: {},
              stepKind: 'DISPATCH',
            },
            {
              stepKey: 'verify',
              ordinal: 1,
              target: 'SALESFORCE',
              status: 'PENDING',
              requestRedacted: {},
              responseRedacted: {},
              stepKind: 'VERIFY',
            },
            {
              stepKey: 'cleanup',
              ordinal: 2,
              target: 'ACCOUNT',
              status: 'PENDING',
              requestRedacted: {},
              responseRedacted: {},
              stepKind: 'CLEANUP',
            },
          ],
        }),
      );
      const verifyClaim = await repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'VERIFY',
        claimedAt: currentTime,
        actor,
      });
      if (verifyClaim.outcome !== 'CLAIMED') {
        throw new Error('verify was not claimed');
      }
      await repository.completeLifecycleStep({
        runId: created.run.id,
        stepId: verifyClaim.step.id,
        stepKind: 'VERIFY',
        succeeded: verifySucceeded,
        responseRedacted: { status: verifySucceeded ? 'PASSED' : 'FAILED' },
        errorCode: verifySucceeded ? null : 'VERIFICATION_FAILED',
        actor,
        finishedAt: currentTime,
      });
      const cleanupClaim = await repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'CLEANUP',
        claimedAt: currentTime,
        actor,
      });
      if (cleanupClaim.outcome !== 'CLAIMED') {
        throw new Error('cleanup was not claimed');
      }
      await repository.completeLifecycleStep({
        runId: created.run.id,
        stepId: cleanupClaim.step.id,
        stepKind: 'CLEANUP',
        succeeded: cleanupSucceeded,
        responseRedacted: {
          status: cleanupSucceeded ? 'DELETED' : 'FAILED',
        },
        errorCode: cleanupSucceeded ? null : 'OWNERSHIP_MISMATCH',
        actor,
        finishedAt: currentTime,
      });

      await expect(
        repository.finalizeLifecycleRun({
          runId: created.run.id,
          actor,
          finishedAt: currentTime,
        }),
      ).resolves.toBe(expected);
      expect(await repository.findRun(created.run.id)).toMatchObject({
        status: expected,
      });
    },
  );

  it('fails a legacy run closed when its fixture snapshot is null', async () => {
    const created = await repository.createRun(
      createInput({
        run: {
          status: 'VERIFYING',
          expectedCallbackMax: 0,
          fixtureSnapshot: null,
        },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SUCCEEDED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'verify',
            ordinal: 1,
            target: 'SALESFORCE',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'VERIFY',
          },
          {
            stepKey: 'cleanup',
            ordinal: 2,
            target: 'ACCOUNT',
            status: 'PENDING',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'CLEANUP',
          },
        ],
      }),
    );
    const claim = await repository.claimLifecycleStep({
      runId: created.run.id,
      stepKind: 'VERIFY',
      claimedAt: currentTime,
      actor,
    });
    if (claim.outcome !== 'CLAIMED') throw new Error('verify was not claimed');
    await repository.completeLifecycleStep({
      runId: created.run.id,
      stepId: claim.step.id,
      stepKind: 'VERIFY',
      succeeded: false,
      responseRedacted: { status: 'FAILED' },
      errorCode: 'FIXTURE_SNAPSHOT_MISSING',
      actor,
      finishedAt: currentTime,
    });

    await expect(
      repository.finalizeLifecycleRun({
        runId: created.run.id,
        actor,
        finishedAt: currentTime,
      }),
    ).resolves.toBe('FAILED');
    expect(
      (await repository.listSteps(created.run.id, { limit: 10 })).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stepKind: 'CLEANUP',
          status: 'SKIPPED',
        }),
      ]),
    );
  });

  it('fails closed and audits a legacy run whose lifecycle steps were skipped', async () => {
    const created = await repository.createRun(
      createInput({
        run: {
          status: 'VERIFYING',
          expectedCallbackMax: 0,
          fixtureSnapshot: null,
        },
        steps: [
          {
            stepKey: 'dispatch',
            ordinal: 0,
            target: 'CLIENTE',
            status: 'SUCCEEDED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'DISPATCH',
          },
          {
            stepKey: 'verify',
            ordinal: 1,
            target: 'SALESFORCE',
            status: 'SKIPPED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'VERIFY',
          },
          {
            stepKey: 'cleanup',
            ordinal: 2,
            target: 'ACCOUNT',
            status: 'SKIPPED',
            requestRedacted: {},
            responseRedacted: {},
            stepKind: 'CLEANUP',
          },
        ],
      }),
    );

    await expect(
      repository.claimLifecycleStep({
        runId: created.run.id,
        stepKind: 'VERIFY',
        claimedAt: currentTime,
        actor,
      }),
    ).resolves.toStrictEqual({
      outcome: 'TERMINAL',
      runStatus: 'FAILED',
      stepStatus: 'FAILED',
    });
    expect(await repository.findRun(created.run.id)).toMatchObject({
      status: 'FAILED',
    });
    expect(await repository.listAuditEvents(created.run.id, 10)).toEqual([
      expect.objectContaining({
        action: 'VERIFY_FAILED',
        metadataRedacted: {
          status: 'FAILED',
          errorCode: 'FIXTURE_SNAPSHOT_MISSING',
        },
      }),
    ]);
  });
});
