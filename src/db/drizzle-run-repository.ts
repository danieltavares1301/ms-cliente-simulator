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
  ClaimInitialSchedulingResult,
  NewRunStep,
  Run,
  RunFilters,
  RunPage,
  RunRepository,
  RunStep,
  RunStepPage,
  ReserveRetriesResult,
  StepStatus,
} from './run-repository';
import * as schema from './schema';
import { canTransitionRun, canTransitionStep } from '../runs/state-machine';

export class RunRecoveryError extends Error {
  constructor() {
    super('Run steps could not be recovered consistently');
    this.name = 'RunRecoveryError';
  }
}

const DISPATCH_CLAIM_RECOVERY_MS = 1_000;

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

  async beginCancellation(input: {
    runId: string;
    actor: string;
    reasonCode?: string;
  }): Promise<import('./run-repository').BeginCancellationResult> {
    const [started] = await this.database
      .update(scenarioRun)
      .set({ status: 'CANCELLING' })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          inArray(scenarioRun.status, [
            'CREATED',
            'PROVISIONING',
            'SCHEDULED',
            'RUNNING',
            'WAITING_ASYNC',
            'VERIFYING',
          ]),
        ),
      )
      .returning({ id: scenarioRun.id });

    if (started === undefined) {
      const [existing] = await this.database
        .select({ status: scenarioRun.status })
        .from(scenarioRun)
        .where(eq(scenarioRun.id, input.runId))
        .limit(1);
      if (existing === undefined) return { outcome: 'NOT_FOUND' };
      if (existing.status === 'CANCELLED') {
        const [cancelled] = await this.database
          .select({ total: count() })
          .from(scenarioRunStep)
          .where(
            and(
              eq(scenarioRunStep.runId, input.runId),
              eq(scenarioRunStep.status, 'CANCELLED'),
            ),
          );
        return {
          outcome: 'REPLAY',
          status: 'CANCELLED',
          affectedStepCount: cancelled?.total ?? 0,
        };
      }
      if (existing.status === 'CANCELLING') {
        const remaining = await this.database
          .select({ messageId: scenarioRunStep.qstashMessageId })
          .from(scenarioRunStep)
          .where(
            and(
              eq(scenarioRunStep.runId, input.runId),
              inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
            ),
          );
        return {
          outcome: 'IN_PROGRESS',
          status: 'CANCELLING',
          messageIds: remaining.flatMap(({ messageId }) =>
            messageId === null ? [] : [messageId],
          ),
          affectedStepCount: remaining.length,
        };
      }

      return { outcome: 'CONFLICT', status: existing.status };
    }

    const cancellable = await this.database
      .select({
        messageId: scenarioRunStep.qstashMessageId,
      })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
        ),
      );
    const messageIds = cancellable.flatMap(({ messageId }) =>
      messageId === null ? [] : [messageId],
    );
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_CANCELLATION_STARTED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        ...(input.reasonCode === undefined
          ? {}
          : { reasonCode: input.reasonCode }),
        count: cancellable.length,
        status: 'CANCELLING',
      },
    });
    return {
      outcome: 'STARTED',
      messageIds,
      affectedStepCount: cancellable.length,
    };
  }

  async recordCancellationProgress(input: {
    runId: string;
    actor: string;
    messageIds: readonly string[];
  }): Promise<void> {
    if (input.messageIds.length === 0) return;
    const cancelled = await this.database
      .update(scenarioRunStep)
      .set({ status: 'CANCELLED', finishedAt: new Date() })
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
          inArray(scenarioRunStep.qstashMessageId, [...input.messageIds]),
        ),
      )
      .returning({ id: scenarioRunStep.id });
    if (cancelled.length === 0) return;
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_CANCELLATION_PROGRESS',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: { count: cancelled.length, status: 'CANCELLING' },
    });
  }

  async finalizeCancellation(input: {
    runId: string;
    actor: string;
    reasonCode?: string;
    expectedAffectedStepCount: number;
  }): Promise<{ status: 'CANCELLED'; affectedStepCount: number }> {
    const cancelledSteps = await this.database
      .update(scenarioRunStep)
      .set({ status: 'CANCELLED', finishedAt: new Date() })
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
        ),
      )
      .returning({ id: scenarioRunStep.id });
    const [cancelledRun] = await this.database
      .update(scenarioRun)
      .set({ status: 'CANCELLED', finishedAt: new Date() })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, 'CANCELLING'),
        ),
      )
      .returning({ id: scenarioRun.id });
    if (cancelledRun === undefined) {
      const current = await this.findRun(input.runId);
      if (current?.status !== 'CANCELLED') {
        throw new Error('Cancellation could not be finalized');
      }
    } else {
      await this.appendAuditEvent({
        actor: input.actor,
        action: 'RUN_CANCELLED',
        resourceType: 'scenario_run',
        resourceId: input.runId,
        metadataRedacted: {
          ...(input.reasonCode === undefined
            ? {}
            : { reasonCode: input.reasonCode }),
          count: cancelledSteps.length,
          status: 'CANCELLED',
        },
      });
    }
    const [total] = await this.database
      .select({ value: count() })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.status, 'CANCELLED'),
        ),
      );
    return {
      status: 'CANCELLED',
      affectedStepCount: total?.value ?? cancelledSteps.length,
    };
  }

  async recordCancellationFailure(input: {
    runId: string;
    actor: string;
    reasonCode?: string;
    requestedCount: number;
    cancelledCount?: number;
    errorCode: 'QSTASH_CANCEL_FAILED';
  }): Promise<void> {
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_CANCELLATION_FAILED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        ...(input.reasonCode === undefined
          ? {}
          : { reasonCode: input.reasonCode }),
        requestedCount: input.requestedCount,
        cancelledCount: input.cancelledCount ?? 0,
        pendingCount: input.requestedCount - (input.cancelledCount ?? 0),
        status: 'CANCELLING',
        errorCode: input.errorCode,
      },
    });
  }

  async claimInitialScheduling(input: {
    runId: string;
    actor: string;
    recovery: boolean;
  }): Promise<ClaimInitialSchedulingResult> {
    const [current] = await this.database
      .select({ status: scenarioRun.status })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (current === undefined) return { outcome: 'NOT_FOUND' };
    if (current.status === 'PROVISIONING') return { outcome: 'IN_PROGRESS' };
    if (
      !['CREATED', 'FAILED', 'PARTIAL', 'SCHEDULED'].includes(current.status)
    ) {
      return { outcome: 'NOT_RECOVERABLE' };
    }
    const [pending] = await this.database
      .select({ value: count() })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
          eq(scenarioRunStep.status, 'PENDING'),
          isNull(scenarioRunStep.qstashMessageId),
        ),
      );
    if ((pending?.value ?? 0) === 0) return { outcome: 'NOT_RECOVERABLE' };

    const [claimed] = await this.database
      .update(scenarioRun)
      .set({ status: 'PROVISIONING' })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, current.status),
          sql`exists (
            select 1 from ${scenarioRunStep}
            where ${scenarioRunStep.runId} = ${input.runId}
              and ${scenarioRunStep.stepKind} = 'DISPATCH'
              and ${scenarioRunStep.status} = 'PENDING'
              and ${scenarioRunStep.qstashMessageId} is null
          )`,
        ),
      )
      .returning({ id: scenarioRun.id });
    if (claimed === undefined) return { outcome: 'IN_PROGRESS' };
    if (input.recovery) {
      await this.appendAuditEvent({
        actor: input.actor,
        action: 'RUN_SCHEDULING_RECOVERY_STARTED',
        resourceType: 'scenario_run',
        resourceId: input.runId,
        metadataRedacted: {
          previousStatus: current.status,
          pendingCount: pending?.value ?? 0,
        },
      });
    }
    return { outcome: 'CLAIMED', previousStatus: current.status };
  }

  async reserveRetries(input: {
    runId: string;
    stepKeys?: readonly string[];
    actor: string;
  }): Promise<ReserveRetriesResult> {
    const [run] = await this.database
      .select({ status: scenarioRun.status })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (run === undefined) return { outcome: 'NOT_FOUND' };
    if (!['FAILED', 'PARTIAL'].includes(run.status)) {
      return { outcome: 'CONFLICT', status: run.status };
    }

    const candidates = await this.database
      .select({
        id: scenarioRunStep.id,
        stepKey: scenarioRunStep.stepKey,
        ordinal: scenarioRunStep.ordinal,
      })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
          eq(scenarioRunStep.status, 'FAILED'),
          input.stepKeys === undefined
            ? undefined
            : inArray(scenarioRunStep.stepKey, [...input.stepKeys]),
        ),
      )
      .orderBy(asc(scenarioRunStep.ordinal));

    const reserved: import('./run-repository').RetryStepReservation[] = [];
    for (const candidate of candidates) {
      const [updated] = await this.database
        .update(scenarioRunStep)
        .set({
          status: 'PENDING',
          qstashMessageId: null,
          scheduledAt: null,
          startedAt: null,
          finishedAt: null,
          httpStatus: null,
          durationMs: null,
          responseRedacted: {},
          errorCode: null,
          attemptCount: sql`${scenarioRunStep.attemptCount} + 1`,
        })
        .where(
          and(
            eq(scenarioRunStep.id, candidate.id),
            eq(scenarioRunStep.status, 'FAILED'),
            sql`exists (
              select 1 from ${scenarioRun}
              where ${scenarioRun.id} = ${input.runId}
                and ${scenarioRun.status} in ('FAILED', 'PARTIAL')
            )`,
          ),
        )
        .returning({ attemptCount: scenarioRunStep.attemptCount });
      if (updated === undefined) continue;

      const attemptNumber = updated.attemptCount;
      const [attempt] = await this.database
        .insert(deliveryAttempt)
        .values({
          stepId: candidate.id,
          attemptNumber,
          requestId: `retry:${input.runId}:${candidate.id}:${attemptNumber}`,
          errorCode: 'RETRY_SCHEDULED',
        })
        .onConflictDoNothing()
        .returning({ id: deliveryAttempt.id });
      if (attempt === undefined) {
        await this.database
          .update(scenarioRunStep)
          .set({ status: 'FAILED' })
          .where(
            and(
              eq(scenarioRunStep.id, candidate.id),
              eq(scenarioRunStep.status, 'PENDING'),
              eq(scenarioRunStep.attemptCount, attemptNumber),
            ),
          );
        continue;
      }
      reserved.push({
        stepId: candidate.id,
        stepKey: candidate.stepKey,
        ordinal: candidate.ordinal,
        attemptNumber,
      });
    }

    if (reserved.length === 0) {
      return { outcome: 'NO_ELIGIBLE', status: run.status };
    }
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_RETRY_RESERVED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        count: reserved.length,
        status: run.status,
      },
    });
    return { outcome: 'RESERVED', steps: reserved };
  }

  async releaseRetryReservations(input: {
    runId: string;
    stepIds: readonly string[];
    actor: string;
    errorCode: 'QSTASH_SCHEDULING_FAILED';
  }): Promise<void> {
    if (input.stepIds.length > 0) {
      await this.database
        .update(scenarioRunStep)
        .set({ status: 'FAILED' })
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            inArray(scenarioRunStep.id, [...input.stepIds]),
            inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
          ),
        );
    }
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_RETRY_SCHEDULING_FAILED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        count: input.stepIds.length,
        status: 'FAILED',
        errorCode: input.errorCode,
      },
    });
  }

  async updateRunStatus(input: {
    runId: string;
    expectedStatus: Run['status'];
    nextStatus: Run['status'];
    startedAt?: Date;
    finishedAt?: Date;
  }): Promise<boolean> {
    if (!canTransitionRun(input.expectedStatus, input.nextStatus)) return false;
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
    if (!canTransitionStep(input.expectedStatus, input.nextStatus))
      return false;
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
      .set({ status: 'SCHEDULED', finishedAt: null })
      .where(
        and(
          eq(scenarioRun.id, runId),
          inArray(scenarioRun.status, [
            'CREATED',
            'PROVISIONING',
            'FAILED',
            'PARTIAL',
          ]),
        ),
      );
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
    const [published] = await this.database
      .select({ value: count() })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          sql`${scenarioRunStep.qstashMessageId} is not null`,
        ),
      );
    await this.database
      .update(scenarioRun)
      .set({
        status:
          input.publishedCount > 0 || (published?.value ?? 0) > 0
            ? 'PARTIAL'
            : 'FAILED',
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          inArray(scenarioRun.status, ['CREATED', 'PROVISIONING', 'SCHEDULED']),
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
          lte(scenarioRunStep.attemptCount, input.attemptNumber),
          sql`exists (
            select 1 from ${scenarioRun}
            where ${scenarioRun.id} = ${input.runId}
              and ${scenarioRun.status} in (
                'CREATED', 'SCHEDULED', 'RUNNING', 'FAILED', 'PARTIAL'
              )
          )`,
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
    const [run] = await this.database
      .select({ status: scenarioRun.status })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);

    const [persistedAttempt] = await this.database
      .select()
      .from(deliveryAttempt)
      .where(
        and(
          eq(deliveryAttempt.stepId, input.stepId),
          eq(deliveryAttempt.attemptNumber, input.attemptNumber),
        ),
      )
      .limit(1);
    if (
      step.attemptCount === input.attemptNumber &&
      persistedAttempt !== undefined &&
      persistedAttempt.httpStatus !== null
    ) {
      await this.completeDispatch({
        runId: input.runId,
        stepId: input.stepId,
        attemptNumber: input.attemptNumber,
        requestId: persistedAttempt.requestId,
        httpStatus: persistedAttempt.httpStatus,
        durationMs: persistedAttempt.durationMs ?? 0,
        responseRedacted: persistedAttempt.responseRedacted,
        errorCode: persistedAttempt.errorCode,
        finishedAt: persistedAttempt.createdAt,
      });
      return { outcome: 'TERMINAL' };
    }
    if (
      (step.status === 'SUCCEEDED' || step.status === 'FAILED') &&
      step.attemptCount === input.attemptNumber &&
      step.httpStatus !== null &&
      step.durationMs !== null
    ) {
      await this.completeDispatch({
        runId: input.runId,
        stepId: input.stepId,
        attemptNumber: input.attemptNumber,
        requestId: `recovery:${input.stepId}:${input.attemptNumber}`,
        httpStatus: step.httpStatus,
        durationMs: step.durationMs,
        responseRedacted: step.responseRedacted,
        errorCode: step.errorCode,
        finishedAt: step.finishedAt ?? input.claimedAt,
      });
      return { outcome: 'TERMINAL' };
    }
    if (run?.status === 'CANCELLING' || run?.status === 'CANCELLED') {
      return { outcome: 'TERMINAL' };
    }
    if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED'].includes(step.status)) {
      return { outcome: 'TERMINAL' };
    }
    if (
      step.status === 'RUNNING' &&
      step.attemptCount === input.attemptNumber
    ) {
      const claimAge =
        input.claimedAt.getTime() - (step.startedAt?.getTime() ?? 0);
      if (claimAge >= DISPATCH_CLAIM_RECOVERY_MS) {
        const [reclaimed] = await this.database
          .update(scenarioRunStep)
          .set({ startedAt: input.claimedAt })
          .where(
            and(
              eq(scenarioRunStep.id, input.stepId),
              eq(scenarioRunStep.runId, input.runId),
              eq(scenarioRunStep.status, 'RUNNING'),
              eq(scenarioRunStep.attemptCount, input.attemptNumber),
              step.startedAt === null
                ? isNull(scenarioRunStep.startedAt)
                : eq(scenarioRunStep.startedAt, step.startedAt),
              sql`not exists (
                select 1 from ${deliveryAttempt}
                where ${deliveryAttempt.stepId} = ${input.stepId}
                  and ${deliveryAttempt.attemptNumber} = ${input.attemptNumber}
              )`,
            ),
          )
          .returning({ id: scenarioRunStep.id });
        if (reclaimed !== undefined) return { outcome: 'CLAIMED' };
      }
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
    const [step] = await this.database
      .select({
        status: scenarioRunStep.status,
        attemptCount: scenarioRunStep.attemptCount,
      })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
        ),
      )
      .limit(1);
    if (step === undefined) throw new Error('Dispatch step not found');
    if (
      step.attemptCount !== input.attemptNumber ||
      !['RUNNING', 'SUCCEEDED', 'FAILED'].includes(step.status)
    ) {
      const [run] = await this.database
        .select({ status: scenarioRun.status })
        .from(scenarioRun)
        .where(eq(scenarioRun.id, input.runId))
        .limit(1);
      if (run === undefined) throw new Error('Dispatch run not found');
      return { runStatus: run.status };
    }

    await this.database
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
      .onConflictDoUpdate({
        target: [deliveryAttempt.stepId, deliveryAttempt.attemptNumber],
        set: {
          httpStatus: input.httpStatus,
          durationMs: input.durationMs,
          responseRedacted: input.responseRedacted,
          errorCode: input.errorCode,
        },
        setWhere: isNull(deliveryAttempt.httpStatus),
      });

    const [attempt] = await this.database
      .select()
      .from(deliveryAttempt)
      .where(
        and(
          eq(deliveryAttempt.stepId, input.stepId),
          eq(deliveryAttempt.attemptNumber, input.attemptNumber),
        ),
      )
      .limit(1);
    if (attempt === undefined) {
      throw new Error('Dispatch attempt could not be persisted');
    }

    const succeeded =
      attempt.errorCode === null &&
      attempt.httpStatus !== null &&
      attempt.httpStatus >= 200 &&
      attempt.httpStatus <= 299;
    await this.database
      .update(scenarioRunStep)
      .set({
        status: succeeded ? 'SUCCEEDED' : 'FAILED',
        finishedAt: input.finishedAt,
        httpStatus: attempt.httpStatus ?? 500,
        durationMs: attempt.durationMs ?? 0,
        responseRedacted: attempt.responseRedacted,
        errorCode:
          attempt.httpStatus === null
            ? 'DISPATCH_PERSISTENCE_FAILED'
            : attempt.errorCode,
      })
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.status, 'RUNNING'),
          eq(scenarioRunStep.attemptCount, input.attemptNumber),
        ),
      );

    const [currentRun] = await this.database
      .select({
        status: scenarioRun.status,
        expectedCallbackMax: scenarioRun.expectedCallbackMax,
      })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (currentRun === undefined) throw new Error('Dispatch run not found');
    if (
      currentRun.status === 'CANCELLING' ||
      currentRun.status === 'CANCELLED'
    ) {
      return { runStatus: currentRun.status };
    }

    let nextStatus: Run['status'] = 'RUNNING';
    if (succeeded) {
      const [remaining] = await this.database
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
        nextStatus =
          currentRun.expectedCallbackMax > 0 ? 'WAITING_ASYNC' : 'VERIFYING';
      }
    } else {
      const [successful] = await this.database
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

    const [updatedRun] = await this.database
      .update(scenarioRun)
      .set({
        status: nextStatus,
        ...(nextStatus === 'FAILED' || nextStatus === 'PARTIAL'
          ? { finishedAt: input.finishedAt }
          : {}),
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, currentRun.status),
          inArray(scenarioRun.status, [
            'CREATED',
            'SCHEDULED',
            'RUNNING',
            'FAILED',
            'PARTIAL',
          ]),
        ),
      )
      .returning({ status: scenarioRun.status });
    if (updatedRun !== undefined) return { runStatus: updatedRun.status };

    const [reconciledRun] = await this.database
      .select({ status: scenarioRun.status })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (reconciledRun === undefined) throw new Error('Dispatch run not found');
    return { runStatus: reconciledRun.status };
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
