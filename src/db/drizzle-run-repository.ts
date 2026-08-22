import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import {
  auditEvent,
  deliveryAttempt,
  scenarioRun,
  scenarioRunStep,
} from './schema';
import type {
  AuditEvent,
  CreateRunInput,
  CreateRunResult,
  DeliveryAttempt,
  DispatchClaimResult,
  NewRunStep,
  Run,
  RunFilters,
  RunPage,
  RunRepository,
  RunStep,
  RunStepPage,
  StepStatus,
} from './run-repository';
import * as schema from './schema';

export class RunRecoveryError extends Error {
  constructor() {
    super('Run steps could not be recovered consistently');
    this.name = 'RunRecoveryError';
  }
}

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('limit must be between 1 and 100');
  }
}

function asRun(row: typeof scenarioRun.$inferSelect): Run {
  return row;
}

function asRunStep(row: typeof scenarioRunStep.$inferSelect): RunStep {
  return row;
}

function asAuditEvent(row: typeof auditEvent.$inferSelect): AuditEvent {
  return row;
}

function asDeliveryAttempt(
  row: typeof deliveryAttempt.$inferSelect,
): DeliveryAttempt {
  return row;
}

export class DrizzleRunRepository<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
> implements RunRepository {
  constructor(
    private readonly database: PgDatabase<TQueryResult, typeof schema>,
  ) {}

  async createRun(input: CreateRunInput): Promise<CreateRunResult> {
    const [inserted] = await this.database
      .insert(scenarioRun)
      .values(input.run)
      .onConflictDoNothing({
        target: [scenarioRun.requestedBy, scenarioRun.idempotencyKeyHash],
      })
      .returning();

    const existing =
      inserted ??
      (
        await this.database
          .select()
          .from(scenarioRun)
          .where(
            and(
              eq(scenarioRun.requestedBy, input.run.requestedBy),
              eq(scenarioRun.idempotencyKeyHash, input.run.idempotencyKeyHash),
            ),
          )
          .limit(1)
      )[0];

    if (existing === undefined) {
      throw new RunRecoveryError();
    }

    if (existing.requestFingerprint !== input.run.requestFingerprint) {
      return { outcome: 'CONFLICT', run: asRun(existing) };
    }

    await this.ensureSteps(existing.id, input.steps);

    return {
      outcome: inserted === undefined ? 'REPLAY' : 'CREATED',
      run: asRun(existing),
    };
  }

  async findRun(runId: string): Promise<Run | null> {
    const [run] = await this.database
      .select()
      .from(scenarioRun)
      .where(eq(scenarioRun.id, runId))
      .limit(1);

    return run === undefined ? null : asRun(run);
  }

  async listRuns(page: {
    limit: number;
    offset?: number;
    filters?: RunFilters;
  }): Promise<RunPage> {
    assertLimit(page.limit);
    const offset = page.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RangeError('offset must be a non-negative integer');
    }

    const conditions = [
      page.filters?.status === undefined
        ? undefined
        : eq(scenarioRun.status, page.filters.status),
      page.filters?.scenarioKey === undefined
        ? undefined
        : eq(scenarioRun.scenarioKey, page.filters.scenarioKey),
      page.filters?.createdFrom === undefined
        ? undefined
        : gte(scenarioRun.createdAt, page.filters.createdFrom),
      page.filters?.createdTo === undefined
        ? undefined
        : lte(scenarioRun.createdAt, page.filters.createdTo),
    ].filter((condition) => condition !== undefined);
    const where = conditions.length === 0 ? undefined : and(...conditions);
    const rows = await this.database
      .select()
      .from(scenarioRun)
      .where(where)
      .orderBy(desc(scenarioRun.createdAt), desc(scenarioRun.id))
      .limit(page.limit + 1)
      .offset(offset);
    const [countRow] = await this.database
      .select({ total: count() })
      .from(scenarioRun)
      .where(where);

    return {
      items: rows.slice(0, page.limit).map(asRun),
      total: countRow?.total ?? 0,
      hasMore: rows.length > page.limit,
    };
  }

  async listSteps(
    runId: string,
    page: { limit: number; offset?: number },
  ): Promise<RunStepPage> {
    assertLimit(page.limit);
    const offset = page.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RangeError('offset must be a non-negative integer');
    }
    const rows = await this.database
      .select()
      .from(scenarioRunStep)
      .where(eq(scenarioRunStep.runId, runId))
      .orderBy(asc(scenarioRunStep.ordinal), asc(scenarioRunStep.id))
      .limit(page.limit + 1)
      .offset(offset);
    const [countRow] = await this.database
      .select({ total: count() })
      .from(scenarioRunStep)
      .where(eq(scenarioRunStep.runId, runId));

    return {
      items: rows.slice(0, page.limit).map(asRunStep),
      total: countRow?.total ?? 0,
      hasMore: rows.length > page.limit,
    };
  }

  async appendAuditEvent(
    event: Omit<AuditEvent, 'id' | 'createdAt'>,
  ): Promise<AuditEvent> {
    const [inserted] = await this.database
      .insert(auditEvent)
      .values(event)
      .returning();

    if (inserted === undefined) {
      throw new Error('Audit event was not persisted');
    }
    return asAuditEvent(inserted);
  }

  async listAuditEvents(runId: string, limit: number): Promise<AuditEvent[]> {
    assertLimit(limit);
    const rows = await this.database
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.resourceType, 'scenario_run'),
          eq(auditEvent.resourceId, runId),
        ),
      )
      .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
      .limit(limit);

    return rows.map(asAuditEvent);
  }

  async updateRunStatus(input: {
    runId: string;
    expectedStatus: Run['status'];
    nextStatus: Run['status'];
    startedAt?: Date;
    finishedAt?: Date;
  }): Promise<boolean> {
    const [updated] = await this.database
      .update(scenarioRun)
      .set({
        status: input.nextStatus,
        ...(input.startedAt === undefined
          ? {}
          : { startedAt: input.startedAt }),
        ...(input.finishedAt === undefined
          ? {}
          : { finishedAt: input.finishedAt }),
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, input.expectedStatus),
        ),
      )
      .returning({ id: scenarioRun.id });

    return updated !== undefined;
  }

  async updateStepStatus(input: {
    stepId: string;
    expectedStatus: StepStatus;
    nextStatus: StepStatus;
    scheduledAt?: Date;
    startedAt?: Date;
    finishedAt?: Date;
  }): Promise<boolean> {
    const [updated] = await this.database
      .update(scenarioRunStep)
      .set({
        status: input.nextStatus,
        ...(input.scheduledAt === undefined
          ? {}
          : { scheduledAt: input.scheduledAt }),
        ...(input.startedAt === undefined
          ? {}
          : { startedAt: input.startedAt }),
        ...(input.finishedAt === undefined
          ? {}
          : { finishedAt: input.finishedAt }),
      })
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.status, input.expectedStatus),
        ),
      )
      .returning({ id: scenarioRunStep.id });

    return updated !== undefined;
  }

  async recordStepScheduled(input: {
    stepId: string;
    messageId: string;
  }): Promise<boolean> {
    const [updated] = await this.database
      .update(scenarioRunStep)
      .set({
        status: 'SCHEDULED',
        qstashMessageId: input.messageId,
      })
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.status, 'PENDING'),
        ),
      )
      .returning({ id: scenarioRunStep.id });
    if (updated !== undefined) return true;

    const [deliveredBeforePersistence] = await this.database
      .update(scenarioRunStep)
      .set({ qstashMessageId: input.messageId })
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          inArray(scenarioRunStep.status, [
            'SCHEDULED',
            'RUNNING',
            'SUCCEEDED',
            'FAILED',
          ]),
          or(
            isNull(scenarioRunStep.qstashMessageId),
            eq(scenarioRunStep.qstashMessageId, input.messageId),
          ),
        ),
      )
      .returning({ id: scenarioRunStep.id });
    if (deliveredBeforePersistence !== undefined) return true;

    const [existing] = await this.database
      .select({
        status: scenarioRunStep.status,
        messageId: scenarioRunStep.qstashMessageId,
      })
      .from(scenarioRunStep)
      .where(eq(scenarioRunStep.id, input.stepId))
      .limit(1);
    return (
      existing?.status === 'SCHEDULED' && existing.messageId === input.messageId
    );
  }

  async markRunScheduled(runId: string): Promise<void> {
    await this.database
      .update(scenarioRun)
      .set({ status: 'SCHEDULED' })
      .where(and(eq(scenarioRun.id, runId), eq(scenarioRun.status, 'CREATED')));
    await this.appendAuditEvent({
      actor: 'qstash-scheduler',
      action: 'RUN_SCHEDULED',
      resourceType: 'scenario_run',
      resourceId: runId,
      metadataRedacted: {},
    });
  }

  async recordSchedulingFailure(input: {
    runId: string;
    failedStepId: string;
    publishedCount: number;
  }): Promise<void> {
    await this.database
      .update(scenarioRun)
      .set({ status: input.publishedCount > 0 ? 'PARTIAL' : 'FAILED' })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          inArray(scenarioRun.status, ['CREATED', 'SCHEDULED']),
        ),
      );
    await this.appendAuditEvent({
      actor: 'qstash-scheduler',
      action: 'RUN_SCHEDULING_FAILED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        failedStepId: input.failedStepId,
        publishedCount: input.publishedCount,
        recoveryRequired: true,
      },
    });
  }

  async claimDispatch(input: {
    runId: string;
    stepId: string;
    attemptNumber: number;
    claimedAt: Date;
  }): Promise<DispatchClaimResult> {
    if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
      return { outcome: 'ATTEMPT_CONFLICT' };
    }

    const [claimed] = await this.database
      .update(scenarioRunStep)
      .set({
        status: 'RUNNING',
        startedAt: input.claimedAt,
        attemptCount: input.attemptNumber,
      })
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
          inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
          lt(scenarioRunStep.attemptCount, input.attemptNumber),
          sql`not exists (
            select 1
            from ${scenarioRunStep} previous
            where previous.run_id = ${scenarioRunStep.runId}
              and previous.ordinal < ${scenarioRunStep.ordinal}
              and previous.status not in ('SUCCEEDED', 'SKIPPED')
          )`,
        ),
      )
      .returning({ id: scenarioRunStep.id });

    if (claimed !== undefined) {
      await this.database
        .update(scenarioRun)
        .set({
          status: 'RUNNING',
          startedAt: input.claimedAt,
        })
        .where(
          and(
            eq(scenarioRun.id, input.runId),
            inArray(scenarioRun.status, ['CREATED', 'SCHEDULED']),
          ),
        );
      return { outcome: 'CLAIMED' };
    }

    const [step] = await this.database
      .select()
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
        ),
      )
      .limit(1);
    if (step === undefined) return { outcome: 'NOT_FOUND' };
    if (['SUCCEEDED', 'CANCELLED', 'SKIPPED'].includes(step.status)) {
      return { outcome: 'TERMINAL' };
    }
    if (
      step.status === 'RUNNING' &&
      step.attemptCount === input.attemptNumber
    ) {
      return { outcome: 'ALREADY_RUNNING' };
    }

    const [blocked] = await this.database
      .select({ id: scenarioRunStep.id })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          lt(scenarioRunStep.ordinal, step.ordinal),
          sql`${scenarioRunStep.status} not in ('SUCCEEDED', 'SKIPPED')`,
        ),
      )
      .limit(1);
    return {
      outcome: blocked === undefined ? 'ATTEMPT_CONFLICT' : 'OUT_OF_ORDER',
    };
  }

  async completeDispatch(input: {
    runId: string;
    stepId: string;
    attemptNumber: number;
    requestId: string;
    httpStatus: number;
    durationMs: number;
    responseRedacted: Record<string, unknown>;
    errorCode: string | null;
    finishedAt: Date;
  }): Promise<{ runStatus: Run['status'] }> {
    return this.database.transaction(async (transaction) => {
      const succeeded =
        input.errorCode === null &&
        input.httpStatus >= 200 &&
        input.httpStatus <= 299;
      const [updated] = await transaction
        .update(scenarioRunStep)
        .set({
          status: succeeded ? 'SUCCEEDED' : 'FAILED',
          finishedAt: input.finishedAt,
          httpStatus: input.httpStatus,
          durationMs: input.durationMs,
          responseRedacted: input.responseRedacted,
          errorCode: input.errorCode,
        })
        .where(
          and(
            eq(scenarioRunStep.id, input.stepId),
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.status, 'RUNNING'),
            eq(scenarioRunStep.attemptCount, input.attemptNumber),
          ),
        )
        .returning({ id: scenarioRunStep.id });
      if (updated === undefined) {
        const [run] = await transaction
          .select({ status: scenarioRun.status })
          .from(scenarioRun)
          .where(eq(scenarioRun.id, input.runId))
          .limit(1);
        if (run === undefined) throw new Error('Dispatch run not found');
        return { runStatus: run.status };
      }

      await transaction
        .insert(deliveryAttempt)
        .values({
          stepId: input.stepId,
          attemptNumber: input.attemptNumber,
          requestId: input.requestId,
          httpStatus: input.httpStatus,
          durationMs: input.durationMs,
          responseRedacted: input.responseRedacted,
          errorCode: input.errorCode,
        })
        .onConflictDoNothing();

      let nextStatus: Run['status'] = 'RUNNING';
      if (succeeded) {
        const [remaining] = await transaction
          .select({ total: count() })
          .from(scenarioRunStep)
          .where(
            and(
              eq(scenarioRunStep.runId, input.runId),
              eq(scenarioRunStep.stepKind, 'DISPATCH'),
              sql`${scenarioRunStep.status} not in ('SUCCEEDED', 'SKIPPED')`,
            ),
          );
        if ((remaining?.total ?? 0) === 0) {
          const [run] = await transaction
            .select({ expectedCallbackMax: scenarioRun.expectedCallbackMax })
            .from(scenarioRun)
            .where(eq(scenarioRun.id, input.runId))
            .limit(1);
          nextStatus =
            (run?.expectedCallbackMax ?? 0) > 0 ? 'WAITING_ASYNC' : 'VERIFYING';
        }
      } else {
        const [successful] = await transaction
          .select({ total: count() })
          .from(scenarioRunStep)
          .where(
            and(
              eq(scenarioRunStep.runId, input.runId),
              eq(scenarioRunStep.stepKind, 'DISPATCH'),
              eq(scenarioRunStep.status, 'SUCCEEDED'),
            ),
          );
        nextStatus = (successful?.total ?? 0) > 0 ? 'PARTIAL' : 'FAILED';
      }

      await transaction
        .update(scenarioRun)
        .set({
          status: nextStatus,
          ...(nextStatus === 'FAILED' || nextStatus === 'PARTIAL'
            ? { finishedAt: input.finishedAt }
            : {}),
        })
        .where(eq(scenarioRun.id, input.runId));
      return { runStatus: nextStatus };
    });
  }

  async listDeliveryAttempts(
    stepId: string,
    limit: number,
  ): Promise<DeliveryAttempt[]> {
    assertLimit(limit);
    const rows = await this.database
      .select()
      .from(deliveryAttempt)
      .where(eq(deliveryAttempt.stepId, stepId))
      .orderBy(asc(deliveryAttempt.attemptNumber))
      .limit(limit);
    return rows.map(asDeliveryAttempt);
  }

  private async ensureSteps(
    runId: string,
    steps: readonly NewRunStep[],
  ): Promise<void> {
    if (steps.length > 0) {
      await this.database
        .insert(scenarioRunStep)
        .values(steps.map((step) => ({ ...step, runId })))
        .onConflictDoNothing();
    }

    const persisted = (await this.listSteps(runId, { limit: 100 })).items;
    const matches =
      persisted.length === steps.length &&
      steps.every((expected) => {
        const actual = persisted.find(
          ({ stepKey }) => stepKey === expected.stepKey,
        );
        return (
          actual !== undefined &&
          actual.ordinal === expected.ordinal &&
          actual.target === expected.target &&
          actual.eventType === (expected.eventType ?? null) &&
          actual.stepKind === expected.stepKind
        );
      });

    if (!matches) {
      throw new RunRecoveryError();
    }
  }
}
