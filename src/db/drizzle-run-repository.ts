import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import { auditEvent, scenarioRun, scenarioRunStep } from './schema';
import type {
  AuditEvent,
  CreateRunInput,
  CreateRunResult,
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
