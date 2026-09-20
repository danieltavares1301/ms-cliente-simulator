import { describe, expect, it, vi } from 'vitest';

import type {
  ClaimLifecycleStepResult,
  RunRepository,
} from '../db/run-repository';
import type { SalesforceTestDataAdapter } from '../salesforce/test-data-adapter';
import { renderScenarioFixture } from '../scenarios/renderer';
import { createSalesforceLifecycleService } from './salesforce-lifecycle';

const now = new Date('2026-09-20T16:00:00.000Z');
const runId = '11111111-1111-4111-8111-111111111111';
const fixture = renderScenarioFixture({
  scenarioKey: 'match-id-cliente',
  version: 1,
  seed: 'lifecycle-test',
  runId: `run_${runId.replaceAll('-', '')}`,
  eventStartAt: '2026-09-20T15:00:00.000Z',
});

function claimed(
  stepKind: 'SETUP' | 'VERIFY' | 'CLEANUP',
): Extract<ClaimLifecycleStepResult, { outcome: 'CLAIMED' }> {
  return {
    outcome: 'CLAIMED',
    run: {
      id: runId,
      scenarioKey: fixture.scenarioKey,
      scenarioVersion: fixture.version,
      status: stepKind === 'SETUP' ? 'PROVISIONING' : 'VERIFYING',
      idempotencyKeyHash: 'a'.repeat(64),
      requestFingerprint: 'b'.repeat(64),
      requestedBy: 'test',
      seed: 1,
      variablesRedacted: {},
      fixtureSnapshot: fixture,
      dryRun: false,
      stopOnFailure: true,
      expectedCallbackMin: 0,
      expectedCallbackMax: 0,
      asyncWaitDeadline: null,
      cleanupPolicy: 'ALWAYS',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      retentionExpiresAt: new Date('2026-09-27T16:00:00.000Z'),
      schedulingKind: stepKind === 'SETUP' ? 'INITIAL' : null,
      schedulingLeaseExpiresAt: null,
    },
    step: {
      id: `${stepKind.toLowerCase()}-step`,
      runId,
      stepKey: stepKind.toLowerCase(),
      ordinal: 0,
      target: 'SALESFORCE',
      eventType: null,
      status: 'RUNNING',
      scheduledAt: null,
      startedAt: now,
      finishedAt: null,
      eventEnvelope: null,
      requestRedacted: {},
      responseRedacted: {},
      httpStatus: null,
      durationMs: null,
      attemptCount: 0,
      qstashMessageId: null,
      errorCode: null,
      stepKind,
      schedulingKind: null,
      schedulingLeaseExpiresAt: null,
    },
  };
}

function repositoryWithClaims(
  claims: ClaimLifecycleStepResult[],
): RunRepository {
  return {
    claimLifecycleStep: vi.fn().mockImplementation(async () => claims.shift()),
    completeLifecycleStep: vi.fn().mockResolvedValue(true),
    finalizeLifecycleRun: vi.fn().mockResolvedValue('SUCCEEDED'),
  } as unknown as RunRepository;
}

function adapter(
  overrides: Partial<SalesforceTestDataAdapter> = {},
): SalesforceTestDataAdapter {
  return {
    setup: vi.fn().mockResolvedValue({
      status: 'CREATED',
      createdCount: 1,
      replayedCount: 0,
    }),
    verify: vi.fn().mockResolvedValue({ passed: true, checks: [] }),
    cleanup: vi.fn().mockResolvedValue({ status: 'DELETED', deletedCount: 1 }),
    ...overrides,
  };
}

describe('Salesforce lifecycle service', () => {
  it('executes setup once and records only technical metadata', async () => {
    const repository = repositoryWithClaims([claimed('SETUP')]);
    const testDataAdapter = adapter();
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor: 'simulator-admin-api',
      now: () => now,
    });

    const result = await service.setup(runId);

    expect(result).toStrictEqual({ outcome: 'SUCCEEDED' });
    expect(testDataAdapter.setup).toHaveBeenCalledOnce();
    expect(repository.completeLifecycleStep).toHaveBeenCalledWith({
      runId,
      stepId: 'setup-step',
      stepKind: 'SETUP',
      succeeded: true,
      responseRedacted: {
        status: 'CREATED',
        createdCount: 1,
        replayedCount: 0,
      },
      errorCode: null,
      actor: 'simulator-admin-api',
      finishedAt: now,
    });
  });

  it('fails closed when a persisted fixture is missing', async () => {
    const claim = claimed('VERIFY');
    claim.run.fixtureSnapshot = null;
    const repository = repositoryWithClaims([claim, claimed('CLEANUP')]);
    vi.mocked(repository.finalizeLifecycleRun).mockResolvedValue('FAILED');
    const testDataAdapter = adapter();
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor: 'qstash-dispatch',
      now: () => now,
    });

    const result = await service.afterDispatch(runId);

    expect(result).toStrictEqual({ outcome: 'FAILED', status: 'FAILED' });
    expect(testDataAdapter.verify).not.toHaveBeenCalled();
    expect(testDataAdapter.cleanup).not.toHaveBeenCalled();
    expect(repository.completeLifecycleStep).toHaveBeenCalledWith(
      expect.objectContaining({
        stepKind: 'VERIFY',
        succeeded: false,
        errorCode: 'FIXTURE_SNAPSHOT_MISSING',
      }),
    );
  });

  it('runs cleanup after a failed verification and finalizes deterministically', async () => {
    const repository = repositoryWithClaims([
      claimed('VERIFY'),
      claimed('CLEANUP'),
    ]);
    vi.mocked(repository.finalizeLifecycleRun).mockResolvedValue('FAILED');
    const testDataAdapter = adapter({
      verify: vi.fn().mockResolvedValue({
        passed: false,
        checks: [{ check: 'ACCOUNT_COUNT_BY_CLIENT_ID_IS_ONE', passed: false }],
      }),
    });
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor: 'qstash-dispatch',
      now: () => now,
    });

    const result = await service.afterDispatch(runId);

    expect(testDataAdapter.verify).toHaveBeenCalledOnce();
    expect(testDataAdapter.cleanup).toHaveBeenCalledOnce();
    expect(result).toStrictEqual({ outcome: 'COMPLETED', status: 'FAILED' });
  });

  it('marks cleanup failure as PARTIAL', async () => {
    const repository = repositoryWithClaims([
      claimed('VERIFY'),
      claimed('CLEANUP'),
    ]);
    vi.mocked(repository.finalizeLifecycleRun).mockResolvedValue('PARTIAL');
    const service = createSalesforceLifecycleService({
      repository,
      adapter: adapter({
        cleanup: vi.fn().mockRejectedValue(
          Object.assign(new Error('cleanup failed'), {
            code: 'OWNERSHIP_MISMATCH',
          }),
        ),
      }),
      actor: 'qstash-dispatch',
      now: () => now,
    });

    await expect(service.afterDispatch(runId)).resolves.toStrictEqual({
      outcome: 'COMPLETED',
      status: 'PARTIAL',
    });
  });

  it('does not execute an adapter when another delivery owns the claim', async () => {
    const repository = repositoryWithClaims([{ outcome: 'IN_PROGRESS' }]);
    const testDataAdapter = adapter();
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor: 'qstash-dispatch',
      now: () => now,
    });

    await expect(service.afterDispatch(runId)).resolves.toStrictEqual({
      outcome: 'IN_PROGRESS',
    });
    expect(testDataAdapter.verify).not.toHaveBeenCalled();
    expect(testDataAdapter.cleanup).not.toHaveBeenCalled();
  });

  it('lets only one concurrent redelivery execute verify and cleanup', async () => {
    let releaseVerify!: () => void;
    const verificationBlocked = new Promise<void>((resolve) => {
      releaseVerify = resolve;
    });
    const claims = [
      claimed('VERIFY'),
      { outcome: 'IN_PROGRESS' } as const,
      claimed('CLEANUP'),
    ];
    const repository = repositoryWithClaims(claims);
    const testDataAdapter = adapter({
      verify: vi.fn().mockImplementation(async () => {
        await verificationBlocked;
        return { passed: true, checks: [] };
      }),
    });
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor: 'qstash-dispatch',
      now: () => now,
    });

    const first = service.afterDispatch(runId);
    await vi.waitFor(() =>
      expect(testDataAdapter.verify).toHaveBeenCalledTimes(1),
    );
    const second = await service.afterDispatch(runId);
    releaseVerify();

    expect(second).toStrictEqual({ outcome: 'IN_PROGRESS' });
    await expect(first).resolves.toStrictEqual({
      outcome: 'COMPLETED',
      status: 'SUCCEEDED',
    });
    expect(testDataAdapter.verify).toHaveBeenCalledTimes(1);
    expect(testDataAdapter.cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not execute post-dispatch lifecycle for a cancelled run', async () => {
    const repository = repositoryWithClaims([{ outcome: 'CANCELLED' }]);
    const testDataAdapter = adapter();
    const service = createSalesforceLifecycleService({
      repository,
      adapter: testDataAdapter,
      actor: 'qstash-dispatch',
      now: () => now,
    });

    await expect(service.afterDispatch(runId)).resolves.toStrictEqual({
      outcome: 'CANCELLED',
    });
    expect(testDataAdapter.verify).not.toHaveBeenCalled();
    expect(testDataAdapter.cleanup).not.toHaveBeenCalled();
  });
});
