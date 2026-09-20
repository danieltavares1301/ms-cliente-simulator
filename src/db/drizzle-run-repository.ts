import { randomUUID } from 'node:crypto';

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
  graphqlCallback,
  scenarioRun,
  scenarioRunStep,
} from './schema';
import type {
  AuditEvent,
  ClaimLifecycleStepResult,
  CorrelatableRunMatch,
  CreateRunInput,
  CreateRunResult,
  DeliveryAttempt,
  DispatchClaimResult,
  GraphqlCallbackRecord,
  ClaimInitialSchedulingResult,
  LifecycleStepKind,
  NewRunStep,
  RecordGraphqlCallbackInput,
  Run,
  RunFilters,
  RunPage,
  RunRepository,
  RunStatus,
  RunStep,
  RunStepPage,
  ReserveRetriesResult,
  StepStatus,
} from './run-repository';
import * as schema from './schema';
import {
  canTransitionRun,
  canTransitionStep,
  deriveDispatchRunStatus,
} from '../runs/state-machine';

export class RunRecoveryError extends Error {
  constructor() {
    super('Run steps could not be recovered consistently');
    this.name = 'RunRecoveryError';
  }
}

const DISPATCH_CLAIM_RECOVERY_MS = 1_000;
const DEFAULT_SCHEDULING_LEASE_MS = 60_000;
export const DEFAULT_LIFECYCLE_CLAIM_RECOVERY_MS = 60_000;

type DrizzleRunRepositoryOptions = {
  now?: () => Date;
  schedulingLeaseMs?: number;
  lifecycleClaimRecoveryMs?: number;
};

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('limit must be between 1 and 100');
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
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

function asGraphqlCallback(
  row: typeof graphqlCallback.$inferSelect,
): GraphqlCallbackRecord {
  return row;
}

function normalizeCorrelationIdentifier(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === undefined || normalized.length === 0
    ? null
    : normalized;
}

export class DrizzleRunRepository<
  TQueryResult extends PgQueryResultHKT = PgQueryResultHKT,
> implements RunRepository {
  constructor(
    private readonly database: PgDatabase<TQueryResult, typeof schema>,
    private readonly options: DrizzleRunRepositoryOptions = {},
  ) {}

  private schedulingLease(): { now: Date; expiresAt: Date } {
    const now = this.options.now?.() ?? new Date();
    return {
      now,
      expiresAt: new Date(
        now.getTime() +
          (this.options.schedulingLeaseMs ?? DEFAULT_SCHEDULING_LEASE_MS),
      ),
    };
  }

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

    const persistedFixture =
      inserted === undefined ? existing.fixtureSnapshot : null;
    const steps =
      persistedFixture === null
        ? input.steps
        : input.steps.map((step) => {
            if (step.stepKind !== 'DISPATCH') return step;
            const fixtureStep = persistedFixture.steps.find(
              ({ key }) => key === step.stepKey,
            );
            return fixtureStep === undefined
              ? step
              : {
                  ...step,
                  eventType: fixtureStep.eventType,
                  eventEnvelope: fixtureStep.envelope,
                  requestRedacted: {
                    eventId: fixtureStep.envelope[0].id,
                    eventType: fixtureStep.eventType,
                  },
                };
          });
    await this.ensureSteps(existing.id, steps);

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

  async findCorrelatableRun(input: {
    idClienteUpper?: string | null;
    idProspectUpper?: string | null;
    limit: number;
  }): Promise<CorrelatableRunMatch | null> {
    assertLimit(input.limit);

    const requestedIdCliente = normalizeCorrelationIdentifier(
      input.idClienteUpper,
    );
    const requestedIdProspect = normalizeCorrelationIdentifier(
      input.idProspectUpper,
    );
    if (requestedIdCliente === null && requestedIdProspect === null) {
      return null;
    }

    const rows = await this.database
      .select()
      .from(scenarioRun)
      .where(
        and(
          eq(scenarioRun.dryRun, false),
          sql`${scenarioRun.fixtureSnapshot} is not null`,
        ),
      )
      .orderBy(desc(scenarioRun.createdAt), desc(scenarioRun.id))
      .limit(input.limit);

    let fallback: CorrelatableRunMatch | null = null;

    for (const row of rows) {
      const fixture = row.fixtureSnapshot;
      if (fixture === null) continue;

      const runIdCliente = normalizeCorrelationIdentifier(
        fixture.identifiers.accountIdCliente,
      );
      const runIdProspect = normalizeCorrelationIdentifier(
        fixture.identifiers.accountIdProspect,
      );
      const matchIdCliente =
        requestedIdCliente !== null && runIdCliente === requestedIdCliente;
      const matchIdProspect =
        requestedIdProspect !== null && runIdProspect === requestedIdProspect;

      if (matchIdCliente && matchIdProspect) {
        return { run: asRun(row), matchedBy: 'both' };
      }
      if (fallback === null && matchIdCliente) {
        fallback = { run: asRun(row), matchedBy: 'idCliente' };
      }
      if (fallback === null && matchIdProspect) {
        fallback = { run: asRun(row), matchedBy: 'idProspect' };
      }
    }

    return fallback;
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
          or(
            inArray(scenarioRun.status, [
              'CREATED',
              'PROVISIONING',
              'SCHEDULED',
              'RUNNING',
              'WAITING_ASYNC',
              'VERIFYING',
            ]),
            and(
              eq(scenarioRun.status, 'PARTIAL'),
              eq(scenarioRun.testDataEnabled, true),
              sql`exists (
                select 1 from ${scenarioRunStep}
                where ${scenarioRunStep.runId} = ${input.runId}
                  and ${scenarioRunStep.stepKind} = 'CLEANUP'
                  and ${scenarioRunStep.status} = 'FAILED'
              )`,
            ),
          ),
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
      .set({
        status: 'CANCELLED',
        finishedAt: new Date(),
      })
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          or(
            inArray(scenarioRunStep.status, ['PENDING', 'SCHEDULED']),
            and(
              eq(scenarioRunStep.status, 'RUNNING'),
              inArray(scenarioRunStep.stepKind, ['SETUP', 'VERIFY', 'CLEANUP']),
            ),
          ),
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
    const lease = this.schedulingLease();
    const [current] = await this.database
      .select({
        status: scenarioRun.status,
        testDataEnabled: scenarioRun.testDataEnabled,
        schedulingKind: scenarioRun.schedulingKind,
        schedulingLeaseExpiresAt: scenarioRun.schedulingLeaseExpiresAt,
      })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (current === undefined) return { outcome: 'NOT_FOUND' };
    const reclaiming = current.status === 'PROVISIONING';
    if (reclaiming) {
      if (
        current.schedulingKind !== 'INITIAL' ||
        current.schedulingLeaseExpiresAt === null
      ) {
        return { outcome: 'NOT_RECOVERABLE' };
      }
      if (current.schedulingLeaseExpiresAt.getTime() > lease.now.getTime()) {
        return { outcome: 'IN_PROGRESS' };
      }
    } else if (
      !['CREATED', 'FAILED', 'PARTIAL', 'SCHEDULED'].includes(current.status) ||
      current.schedulingKind !== null ||
      current.schedulingLeaseExpiresAt !== null
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
    if ((pending?.value ?? 0) === 0 && !reclaiming) {
      return { outcome: 'NOT_RECOVERABLE' };
    }

    const [claimed] = await this.database
      .update(scenarioRun)
      .set({
        status: 'PROVISIONING',
        schedulingKind: 'INITIAL',
        schedulingLeaseExpiresAt: lease.expiresAt,
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, current.status),
          reclaiming
            ? and(
                eq(scenarioRun.schedulingKind, 'INITIAL'),
                lte(scenarioRun.schedulingLeaseExpiresAt, lease.now),
              )
            : and(
                isNull(scenarioRun.schedulingKind),
                isNull(scenarioRun.schedulingLeaseExpiresAt),
                sql`exists (
                  select 1 from ${scenarioRunStep}
                  where ${scenarioRunStep.runId} = ${input.runId}
                    and ${scenarioRunStep.stepKind} = 'DISPATCH'
                    and ${scenarioRunStep.status} = 'PENDING'
                    and ${scenarioRunStep.qstashMessageId} is null
                )`,
              ),
        ),
      )
      .returning({ id: scenarioRun.id });
    if (claimed === undefined) return { outcome: 'IN_PROGRESS' };
    if (
      input.recovery &&
      current.testDataEnabled &&
      (current.status === 'FAILED' || current.status === 'PARTIAL')
    ) {
      await this.database
        .update(scenarioRunStep)
        .set({
          status: 'PENDING',
          startedAt: null,
          finishedAt: null,
          responseRedacted: {},
          errorCode: null,
          lifecycleClaimId: null,
        })
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            inArray(scenarioRunStep.stepKind, ['SETUP', 'VERIFY', 'CLEANUP']),
          ),
        );
    }
    if (input.recovery || reclaiming) {
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
    const lease = this.schedulingLease();
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
        status: scenarioRunStep.status,
        attemptCount: scenarioRunStep.attemptCount,
        schedulingKind: scenarioRunStep.schedulingKind,
        schedulingLeaseExpiresAt: scenarioRunStep.schedulingLeaseExpiresAt,
      })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
          or(
            and(
              eq(scenarioRunStep.status, 'FAILED'),
              isNull(scenarioRunStep.schedulingKind),
              isNull(scenarioRunStep.schedulingLeaseExpiresAt),
            ),
            and(
              eq(scenarioRunStep.status, 'PENDING'),
              eq(scenarioRunStep.schedulingKind, 'RETRY'),
              isNull(scenarioRunStep.qstashMessageId),
            ),
          ),
          input.stepKeys === undefined
            ? undefined
            : inArray(scenarioRunStep.stepKey, [...input.stepKeys]),
        ),
      )
      .orderBy(asc(scenarioRunStep.ordinal));

    const reserved: import('./run-repository').RetryStepReservation[] = [];
    let inProgress = false;
    let reclaimedCount = 0;
    for (const candidate of candidates) {
      if (candidate.status === 'PENDING') {
        if (
          candidate.schedulingKind !== 'RETRY' ||
          candidate.schedulingLeaseExpiresAt === null
        ) {
          continue;
        }
        if (
          candidate.schedulingLeaseExpiresAt.getTime() > lease.now.getTime()
        ) {
          inProgress = true;
          continue;
        }
        const [reclaimed] = await this.database
          .update(scenarioRunStep)
          .set({ schedulingLeaseExpiresAt: lease.expiresAt })
          .where(
            and(
              eq(scenarioRunStep.id, candidate.id),
              eq(scenarioRunStep.status, 'PENDING'),
              eq(scenarioRunStep.schedulingKind, 'RETRY'),
              eq(
                scenarioRunStep.schedulingLeaseExpiresAt,
                candidate.schedulingLeaseExpiresAt,
              ),
              isNull(scenarioRunStep.qstashMessageId),
            ),
          )
          .returning({ attemptCount: scenarioRunStep.attemptCount });
        if (reclaimed === undefined) {
          inProgress = true;
          continue;
        }
        await this.database
          .insert(deliveryAttempt)
          .values({
            stepId: candidate.id,
            attemptNumber: reclaimed.attemptCount,
            requestId: `retry:${input.runId}:${candidate.id}:${reclaimed.attemptCount}`,
            errorCode: 'RETRY_SCHEDULED',
          })
          .onConflictDoNothing();
        reserved.push({
          stepId: candidate.id,
          stepKey: candidate.stepKey,
          ordinal: candidate.ordinal,
          attemptNumber: reclaimed.attemptCount,
        });
        reclaimedCount += 1;
        continue;
      }

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
          schedulingKind: 'RETRY',
          schedulingLeaseExpiresAt: lease.expiresAt,
        })
        .where(
          and(
            eq(scenarioRunStep.id, candidate.id),
            eq(scenarioRunStep.status, 'FAILED'),
            isNull(scenarioRunStep.schedulingKind),
            isNull(scenarioRunStep.schedulingLeaseExpiresAt),
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
        const [existing] = await this.database
          .select({ id: deliveryAttempt.id })
          .from(deliveryAttempt)
          .where(
            and(
              eq(deliveryAttempt.stepId, candidate.id),
              eq(deliveryAttempt.attemptNumber, attemptNumber),
            ),
          )
          .limit(1);
        if (existing === undefined) continue;
      }
      reserved.push({
        stepId: candidate.id,
        stepKey: candidate.stepKey,
        ordinal: candidate.ordinal,
        attemptNumber,
      });
    }

    if (reserved.length === 0) {
      if (inProgress) {
        return { outcome: 'IN_PROGRESS', status: run.status };
      }
      return { outcome: 'NO_ELIGIBLE', status: run.status };
    }
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_RETRY_RESERVED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        count: reserved.length,
        reclaimedCount,
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
      const { now } = this.schedulingLease();
      await this.database
        .update(scenarioRunStep)
        .set({ schedulingLeaseExpiresAt: now })
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            inArray(scenarioRunStep.id, [...input.stepIds]),
            eq(scenarioRunStep.status, 'PENDING'),
            eq(scenarioRunStep.schedulingKind, 'RETRY'),
            isNull(scenarioRunStep.qstashMessageId),
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
        schedulingKind: null,
        schedulingLeaseExpiresAt: null,
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
      .set({
        qstashMessageId: input.messageId,
        schedulingKind: null,
        schedulingLeaseExpiresAt: null,
      })
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
    const [currentRun] = await this.database
      .select({
        status: scenarioRun.status,
        expectedCallbackMax: scenarioRun.expectedCallbackMax,
      })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, runId))
      .limit(1);
    if (currentRun === undefined) return;

    const dispatchSteps = await this.database
      .select({ status: scenarioRunStep.status })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
        ),
      );
    const nextStatus = deriveDispatchRunStatus({
      currentStatus: currentRun.status,
      dispatchStepStatuses: dispatchSteps.map(({ status }) => status),
      expectedCallbackMax: currentRun.expectedCallbackMax,
    });
    if (
      nextStatus !== currentRun.status &&
      canTransitionRun(currentRun.status, nextStatus)
    ) {
      await this.database
        .update(scenarioRun)
        .set({
          status: nextStatus,
          finishedAt: null,
          schedulingKind: null,
          schedulingLeaseExpiresAt: null,
        })
        .where(
          and(
            eq(scenarioRun.id, runId),
            eq(scenarioRun.status, currentRun.status),
            inArray(scenarioRun.status, [
              'CREATED',
              'PROVISIONING',
              'SCHEDULED',
              'RUNNING',
              'FAILED',
              'PARTIAL',
            ]),
          ),
        );
    } else if (
      [
        'CREATED',
        'PROVISIONING',
        'SCHEDULED',
        'RUNNING',
        'FAILED',
        'PARTIAL',
      ].includes(currentRun.status)
    ) {
      await this.database
        .update(scenarioRun)
        .set({
          schedulingKind: null,
          schedulingLeaseExpiresAt: null,
        })
        .where(
          and(
            eq(scenarioRun.id, runId),
            eq(scenarioRun.status, currentRun.status),
          ),
        );
    }
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
        schedulingKind: null,
        schedulingLeaseExpiresAt: null,
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          inArray(scenarioRun.status, [
            'CREATED',
            'PROVISIONING',
            'SCHEDULED',
            'RUNNING',
          ]),
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
        schedulingKind: null,
        schedulingLeaseExpiresAt: null,
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
              and (
                ${scenarioRun.status} in (
                  'CREATED', 'PROVISIONING', 'SCHEDULED', 'RUNNING'
                )
                or (
                  ${scenarioRun.status} in ('FAILED', 'PARTIAL')
                  and ${scenarioRun.testDataEnabled} = false
                )
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

  async getDispatchPayload(input: {
    runId: string;
    stepId: string;
  }): Promise<RunStep['eventEnvelope']> {
    const [step] = await this.database
      .select({ eventEnvelope: scenarioRunStep.eventEnvelope })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
        ),
      )
      .limit(1);

    return step?.eventEnvelope ?? null;
  }

  async recordGraphqlCallback(input: RecordGraphqlCallbackInput): Promise<{
    callback: GraphqlCallbackRecord;
    runStatus: RunStatus | null;
  }> {
    const [inserted] = await this.database
      .insert(graphqlCallback)
      .values({
        runId: input.runId,
        requestId: input.requestId,
        operationName: input.operationName,
        idClienteHash: input.idClienteHash,
        idProspectHash: input.idProspectHash,
        normalizedCorrelationKeyHash: input.normalizedCorrelationKeyHash,
        policy: input.policy,
        httpStatus: input.httpStatus,
        requestRedacted: input.requestRedacted,
        responseRedacted: input.responseRedacted,
        durationMs: input.durationMs,
        createdAt: input.receivedAt,
      })
      .returning();

    if (inserted === undefined) {
      throw new Error('GraphQL callback was not persisted');
    }

    if (input.runId === null) {
      return { callback: asGraphqlCallback(inserted), runStatus: null };
    }

    let runStatus: RunStatus | null = null;
    const [currentRun] = await this.database
      .select({
        status: scenarioRun.status,
        expectedCallbackMin: scenarioRun.expectedCallbackMin,
        asyncWaitDeadline: scenarioRun.asyncWaitDeadline,
      })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);

    if (currentRun !== undefined) {
      runStatus = currentRun.status;
      const withinDeadline =
        currentRun.asyncWaitDeadline === null ||
        input.receivedAt.getTime() <= currentRun.asyncWaitDeadline.getTime();
      if (
        currentRun.status === 'WAITING_ASYNC' &&
        currentRun.expectedCallbackMin > 0 &&
        withinDeadline
      ) {
        const [countRow] = await this.database
          .select({ total: count() })
          .from(graphqlCallback)
          .where(eq(graphqlCallback.runId, input.runId));
        const callbackCount = countRow?.total ?? 0;

        if (callbackCount >= currentRun.expectedCallbackMin) {
          const [advanced] = await this.database
            .update(scenarioRun)
            .set({
              status: 'VERIFYING',
              finishedAt: null,
            })
            .where(
              and(
                eq(scenarioRun.id, input.runId),
                eq(scenarioRun.status, 'WAITING_ASYNC'),
              ),
            )
            .returning({ status: scenarioRun.status });

          if (advanced !== undefined) {
            runStatus = advanced.status;
            await this.appendAuditEvent({
              actor: input.actor,
              action: 'GRAPHQL_CALLBACK_THRESHOLD_REACHED',
              resourceType: 'scenario_run',
              resourceId: input.runId,
              metadataRedacted: {
                callbackCount,
                status: 'VERIFYING',
              },
            });
          }
        }
      }
    }

    return {
      callback: asGraphqlCallback(inserted),
      runStatus,
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
        schedulingKind: null,
        schedulingLeaseExpiresAt: null,
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

    const dispatchSteps = await this.database
      .select({ status: scenarioRunStep.status })
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'DISPATCH'),
        ),
      );
    const derivedStatus = deriveDispatchRunStatus({
      currentStatus: currentRun.status,
      dispatchStepStatuses: dispatchSteps.map(({ status }) => status),
      expectedCallbackMax: currentRun.expectedCallbackMax,
    });
    const nextStatus =
      currentRun.status === 'PROVISIONING' && derivedStatus === 'RUNNING'
        ? 'PROVISIONING'
        : derivedStatus;

    const [updatedRun] = await this.database
      .update(scenarioRun)
      .set({
        status: nextStatus,
        ...(nextStatus === 'FAILED' || nextStatus === 'PARTIAL'
          ? { finishedAt: input.finishedAt }
          : {}),
        ...(nextStatus === 'PROVISIONING'
          ? {}
          : { schedulingKind: null, schedulingLeaseExpiresAt: null }),
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, currentRun.status),
          inArray(scenarioRun.status, [
            'CREATED',
            'PROVISIONING',
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

  async claimLifecycleStep(input: {
    runId: string;
    stepKind: LifecycleStepKind;
    claimedAt: Date;
    actor: string;
  }): Promise<ClaimLifecycleStepResult> {
    const [run] = await this.database
      .select()
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (run === undefined) return { outcome: 'NOT_FOUND' };
    if (run.status === 'CANCELLING' || run.status === 'CANCELLED') {
      return { outcome: 'CANCELLED' };
    }
    if (['SUCCEEDED', 'FAILED', 'PARTIAL'].includes(run.status)) {
      const [terminalStep] = await this.database
        .select({ status: scenarioRunStep.status })
        .from(scenarioRunStep)
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.stepKind, input.stepKind),
          ),
        )
        .orderBy(asc(scenarioRunStep.ordinal))
        .limit(1);
      return terminalStep === undefined
        ? { outcome: 'NOT_FOUND' }
        : {
            outcome: 'TERMINAL',
            runStatus: run.status,
            stepStatus: terminalStep.status,
          };
    }
    const expectedRunStatus =
      input.stepKind === 'SETUP' ? 'PROVISIONING' : 'VERIFYING';
    if (run.status !== expectedRunStatus) return { outcome: 'NOT_READY' };

    const [step] = await this.database
      .select()
      .from(scenarioRunStep)
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, input.stepKind),
        ),
      )
      .orderBy(asc(scenarioRunStep.ordinal))
      .limit(1);
    if (step === undefined) return { outcome: 'NOT_FOUND' };
    if (['SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED'].includes(step.status)) {
      if (
        run.fixtureSnapshot === null &&
        (run.status === 'PROVISIONING' || run.status === 'VERIFYING')
      ) {
        const [failedRun] = await this.database
          .update(scenarioRun)
          .set({
            status: 'FAILED',
            finishedAt: input.claimedAt,
            schedulingKind: null,
            schedulingLeaseExpiresAt: null,
          })
          .where(
            and(
              eq(scenarioRun.id, input.runId),
              eq(scenarioRun.status, run.status),
            ),
          )
          .returning({ id: scenarioRun.id });
        if (failedRun !== undefined) {
          await this.appendAuditEvent({
            actor: input.actor,
            action: `${input.stepKind}_FAILED`,
            resourceType: 'scenario_run',
            resourceId: input.runId,
            metadataRedacted: {
              status: 'FAILED',
              errorCode: 'FIXTURE_SNAPSHOT_MISSING',
            },
          });
        }
        return {
          outcome: 'TERMINAL',
          runStatus: 'FAILED',
          stepStatus: 'FAILED',
        };
      }
      return {
        outcome: 'TERMINAL',
        runStatus: run.status,
        stepStatus: step.status,
      };
    }

    if (input.stepKind !== 'SETUP') {
      const requiredKind = input.stepKind === 'VERIFY' ? 'DISPATCH' : 'VERIFY';
      const [blocked] = await this.database
        .select({ id: scenarioRunStep.id })
        .from(scenarioRunStep)
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.stepKind, requiredKind),
            input.stepKind === 'VERIFY'
              ? sql`${scenarioRunStep.status} <> 'SUCCEEDED'`
              : sql`${scenarioRunStep.status} not in ('SUCCEEDED', 'FAILED', 'SKIPPED')`,
          ),
        )
        .limit(1);
      if (blocked !== undefined) return { outcome: 'NOT_READY' };
    }

    let claimed: { id: string } | undefined;
    const claimId = randomUUID();
    if (step.status === 'PENDING') {
      [claimed] = await this.database
        .update(scenarioRunStep)
        .set({
          status: 'RUNNING',
          startedAt: input.claimedAt,
          lifecycleClaimId: claimId,
        })
        .where(
          and(
            eq(scenarioRunStep.id, step.id),
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.status, 'PENDING'),
            sql`exists (
              select 1 from ${scenarioRun}
              where ${scenarioRun.id} = ${input.runId}
                and ${scenarioRun.status} = ${expectedRunStatus}
            )`,
          ),
        )
        .returning({ id: scenarioRunStep.id });
    } else if (step.status === 'RUNNING') {
      const recoveryMs =
        this.options.lifecycleClaimRecoveryMs ??
        DEFAULT_LIFECYCLE_CLAIM_RECOVERY_MS;
      const recoveryBefore = new Date(input.claimedAt.getTime() - recoveryMs);
      if (
        step.startedAt !== null &&
        step.startedAt.getTime() > recoveryBefore.getTime()
      ) {
        return { outcome: 'IN_PROGRESS' };
      }
      [claimed] = await this.database
        .update(scenarioRunStep)
        .set({ startedAt: input.claimedAt, lifecycleClaimId: claimId })
        .where(
          and(
            eq(scenarioRunStep.id, step.id),
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.status, 'RUNNING'),
            step.startedAt === null
              ? isNull(scenarioRunStep.startedAt)
              : eq(scenarioRunStep.startedAt, step.startedAt),
            sql`exists (
              select 1 from ${scenarioRun}
              where ${scenarioRun.id} = ${input.runId}
                and ${scenarioRun.status} = ${expectedRunStatus}
            )`,
          ),
        )
        .returning({ id: scenarioRunStep.id });
    }
    if (claimed === undefined) {
      const [current] = await this.database
        .select({ status: scenarioRun.status })
        .from(scenarioRun)
        .where(eq(scenarioRun.id, input.runId))
        .limit(1);
      if (current?.status === 'CANCELLING' || current?.status === 'CANCELLED') {
        return { outcome: 'CANCELLED' };
      }
      if (
        current === undefined ||
        ['SUCCEEDED', 'FAILED', 'PARTIAL'].includes(current.status)
      ) {
        return { outcome: 'STALE' };
      }
      return { outcome: 'IN_PROGRESS' };
    }

    await this.appendAuditEvent({
      actor: input.actor,
      action: `${input.stepKind}_STARTED`,
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        status: 'RUNNING',
        recovery: step.status === 'RUNNING',
      },
    });
    return {
      outcome: 'CLAIMED',
      claimId,
      run: asRun(run),
      step: asRunStep({
        ...step,
        status: 'RUNNING',
        startedAt: input.claimedAt,
        lifecycleClaimId: claimId,
      }),
    };
  }

  async completeLifecycleStep(input: {
    runId: string;
    stepId: string;
    stepKind: LifecycleStepKind;
    claimId: string;
    succeeded: boolean;
    responseRedacted: Record<string, unknown>;
    errorCode: string | null;
    actor: string;
    finishedAt: Date;
  }): Promise<import('./run-repository').CompleteLifecycleStepResult> {
    const nextStatus = input.succeeded ? 'SUCCEEDED' : 'FAILED';
    const expectedRunStatus =
      input.stepKind === 'SETUP' ? 'PROVISIONING' : 'VERIFYING';
    const [completed] = await this.database
      .update(scenarioRunStep)
      .set({
        status: nextStatus,
        finishedAt: input.finishedAt,
        responseRedacted: input.responseRedacted,
        errorCode: input.errorCode,
        lifecycleClaimId: null,
      })
      .where(
        and(
          eq(scenarioRunStep.id, input.stepId),
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, input.stepKind),
          eq(scenarioRunStep.status, 'RUNNING'),
          eq(scenarioRunStep.lifecycleClaimId, input.claimId),
          sql`exists (
            select 1 from ${scenarioRun}
            where ${scenarioRun.id} = ${input.runId}
              and ${scenarioRun.status} = ${expectedRunStatus}
          )`,
        ),
      )
      .returning({ id: scenarioRunStep.id });
    if (completed === undefined) {
      const [current] = await this.database
        .select({ status: scenarioRun.status })
        .from(scenarioRun)
        .where(eq(scenarioRun.id, input.runId))
        .limit(1);
      if (current?.status !== 'CANCELLING' && current?.status !== 'CANCELLED') {
        return { outcome: 'STALE' };
      }
      const [cancelled] = await this.database
        .update(scenarioRunStep)
        .set({
          status: 'CANCELLED',
          finishedAt: input.finishedAt,
          responseRedacted: input.responseRedacted,
          errorCode: input.errorCode,
          lifecycleClaimId: null,
        })
        .where(
          and(
            eq(scenarioRunStep.id, input.stepId),
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.stepKind, input.stepKind),
            inArray(scenarioRunStep.status, ['RUNNING', 'CANCELLED']),
            eq(scenarioRunStep.lifecycleClaimId, input.claimId),
          ),
        )
        .returning({ id: scenarioRunStep.id });
      return cancelled === undefined
        ? { outcome: 'STALE' }
        : { outcome: 'CANCELLED' };
    }

    await this.appendAuditEvent({
      actor: input.actor,
      action: `${input.stepKind}_${nextStatus}`,
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        status: nextStatus,
        ...input.responseRedacted,
        ...(input.errorCode === null ? {} : { errorCode: input.errorCode }),
      },
    });
    return { outcome: 'COMPLETED' };
  }

  async recordLifecycleCompensation(input: {
    runId: string;
    succeeded: boolean;
    responseRedacted: Record<string, unknown>;
    errorCode: string | null;
    actor: string;
    finishedAt: Date;
  }): Promise<'COMPLETED' | 'NOT_FOUND'> {
    const nextStatus = input.succeeded ? 'SUCCEEDED' : 'FAILED';
    const [step] = await this.database
      .update(scenarioRunStep)
      .set({
        status: nextStatus,
        finishedAt: input.finishedAt,
        responseRedacted: input.responseRedacted,
        errorCode: input.errorCode,
        lifecycleClaimId: null,
      })
      .where(
        and(
          eq(scenarioRunStep.runId, input.runId),
          eq(scenarioRunStep.stepKind, 'CLEANUP'),
          inArray(scenarioRunStep.status, ['PENDING', 'RUNNING', 'FAILED']),
        ),
      )
      .returning({ id: scenarioRunStep.id });
    if (step === undefined) {
      const [existing] = await this.database
        .select({ status: scenarioRunStep.status })
        .from(scenarioRunStep)
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            eq(scenarioRunStep.stepKind, 'CLEANUP'),
          ),
        )
        .limit(1);
      return existing?.status === 'SUCCEEDED' ? 'COMPLETED' : 'NOT_FOUND';
    }
    if (!input.succeeded) {
      await this.database
        .update(scenarioRun)
        .set({ status: 'PARTIAL', finishedAt: input.finishedAt })
        .where(
          and(
            eq(scenarioRun.id, input.runId),
            sql`${scenarioRun.status} <> 'CANCELLED'`,
          ),
        );
    }
    await this.appendAuditEvent({
      actor: input.actor,
      action: `CLEANUP_${nextStatus}`,
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: {
        status: nextStatus,
        ...input.responseRedacted,
        ...(input.errorCode === null ? {} : { errorCode: input.errorCode }),
        compensation: true,
      },
    });
    return 'COMPLETED';
  }

  async finalizeLifecycleRun(input: {
    runId: string;
    actor: string;
    finishedAt: Date;
  }): Promise<Run['status']> {
    const [run] = await this.database
      .select({
        status: scenarioRun.status,
        fixtureSnapshot: scenarioRun.fixtureSnapshot,
      })
      .from(scenarioRun)
      .where(eq(scenarioRun.id, input.runId))
      .limit(1);
    if (run === undefined) throw new Error('Lifecycle run not found');
    if (
      run.status === 'CANCELLING' ||
      run.status === 'CANCELLED' ||
      run.status === 'SUCCEEDED' ||
      run.status === 'FAILED' ||
      run.status === 'PARTIAL'
    ) {
      return run.status;
    }

    const steps = await this.database
      .select({
        kind: scenarioRunStep.stepKind,
        status: scenarioRunStep.status,
        errorCode: scenarioRunStep.errorCode,
      })
      .from(scenarioRunStep)
      .where(eq(scenarioRunStep.runId, input.runId));
    const statuses = (kind: LifecycleStepKind | 'DISPATCH') =>
      steps.filter((step) => step.kind === kind).map((step) => step.status);
    const setup = statuses('SETUP');
    const dispatch = statuses('DISPATCH');
    const verify = statuses('VERIFY');
    const cleanup = statuses('CLEANUP');
    const setupFailed = setup.includes('FAILED');
    const cleanupTerminal =
      cleanup.length > 0 &&
      cleanup.every((status) =>
        ['SUCCEEDED', 'FAILED', 'SKIPPED'].includes(status),
      );
    const missingFixture =
      run.fixtureSnapshot === null &&
      steps.some(({ errorCode }) => errorCode === 'FIXTURE_SNAPSHOT_MISSING');

    let nextStatus: Run['status'] | null = null;
    if (missingFixture) {
      await this.database
        .update(scenarioRunStep)
        .set({ status: 'SKIPPED', finishedAt: input.finishedAt })
        .where(
          and(
            eq(scenarioRunStep.runId, input.runId),
            inArray(scenarioRunStep.stepKind, ['SETUP', 'VERIFY', 'CLEANUP']),
            eq(scenarioRunStep.status, 'PENDING'),
          ),
        );
      nextStatus = 'FAILED';
    } else if (setupFailed && !dispatch.includes('SUCCEEDED')) {
      nextStatus = 'FAILED';
    } else if (run.status === 'VERIFYING' && cleanupTerminal) {
      nextStatus = cleanup.includes('FAILED')
        ? 'PARTIAL'
        : verify.includes('FAILED')
          ? 'FAILED'
          : dispatch.every((status) => status === 'SUCCEEDED') &&
              verify.every((status) =>
                ['SUCCEEDED', 'SKIPPED'].includes(status),
              )
            ? 'SUCCEEDED'
            : 'PARTIAL';
    }
    if (nextStatus === null) return run.status;

    const [updated] = await this.database
      .update(scenarioRun)
      .set({
        status: nextStatus,
        finishedAt: input.finishedAt,
        schedulingKind: null,
        schedulingLeaseExpiresAt: null,
      })
      .where(
        and(
          eq(scenarioRun.id, input.runId),
          eq(scenarioRun.status, run.status),
        ),
      )
      .returning({ status: scenarioRun.status });
    if (updated === undefined) {
      return (await this.findRun(input.runId))?.status ?? run.status;
    }
    await this.appendAuditEvent({
      actor: input.actor,
      action: 'RUN_LIFECYCLE_FINALIZED',
      resourceType: 'scenario_run',
      resourceId: input.runId,
      metadataRedacted: { status: updated.status },
    });
    return updated.status;
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
          stableStringify(actual.eventEnvelope) ===
            stableStringify(expected.eventEnvelope ?? null) &&
          actual.stepKind === expected.stepKind
        );
      });

    if (!matches) {
      throw new RunRecoveryError();
    }
  }
}
