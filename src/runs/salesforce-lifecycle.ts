import type {
  ClaimLifecycleStepResult,
  LifecycleStepKind,
  RunRepository,
  RunStatus,
} from '../db/run-repository';
import type {
  SalesforceTestDataAdapter,
  SalesforceTestDataAdapterInput,
} from '../salesforce/test-data-adapter';

type LifecycleDependencies = {
  repository: RunRepository;
  adapter: SalesforceTestDataAdapter;
  actor: string;
  now?: () => Date;
};

type StepExecutionResult =
  | { outcome: 'SUCCEEDED' }
  | { outcome: 'TERMINAL'; succeeded: boolean }
  | { outcome: 'FAILED'; errorCode: string }
  | { outcome: 'IN_PROGRESS' | 'NOT_READY' | 'NOT_FOUND' | 'CANCELLED' };

export type PostDispatchLifecycleResult =
  | { outcome: 'COMPLETED'; status: RunStatus }
  | { outcome: 'FAILED'; status: RunStatus }
  | { outcome: 'IN_PROGRESS' | 'NOT_READY' | 'NOT_FOUND' | 'CANCELLED' };

function technicalErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)
  ) {
    return error.code;
  }
  return 'SALESFORCE_TEST_DATA_OPERATION_FAILED';
}

function adapterInput(
  claim: Extract<ClaimLifecycleStepResult, { outcome: 'CLAIMED' }>,
): SalesforceTestDataAdapterInput | null {
  const fixture = claim.run.fixtureSnapshot;
  if (fixture === null) return null;
  return {
    runId: fixture.runId,
    scenarioKey: claim.run
      .scenarioKey as SalesforceTestDataAdapterInput['scenarioKey'],
    fixture,
  };
}

export function createSalesforceLifecycleService(
  dependencies: LifecycleDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function complete(
    claim: Extract<ClaimLifecycleStepResult, { outcome: 'CLAIMED' }>,
    stepKind: LifecycleStepKind,
    succeeded: boolean,
    responseRedacted: Record<string, unknown>,
    errorCode: string | null,
  ): Promise<StepExecutionResult> {
    const persisted = await dependencies.repository.completeLifecycleStep({
      runId: claim.run.id,
      stepId: claim.step.id,
      stepKind,
      succeeded,
      responseRedacted,
      errorCode,
      actor: dependencies.actor,
      finishedAt: now(),
    });
    return persisted
      ? succeeded
        ? { outcome: 'SUCCEEDED' }
        : {
            outcome: 'FAILED',
            errorCode: errorCode ?? 'SALESFORCE_TEST_DATA_OPERATION_FAILED',
          }
      : { outcome: 'IN_PROGRESS' };
  }

  function execute(
    stepKind: LifecycleStepKind,
  ): (runId: string) => Promise<StepExecutionResult> {
    return async (runId: string): Promise<StepExecutionResult> => {
      const claim = await dependencies.repository.claimLifecycleStep({
        runId,
        stepKind,
        claimedAt: now(),
        actor: dependencies.actor,
      });
      if (claim.outcome === 'TERMINAL') {
        return {
          outcome: 'TERMINAL',
          succeeded:
            claim.stepStatus === 'SUCCEEDED' || claim.stepStatus === 'SKIPPED',
        };
      }
      if (claim.outcome !== 'CLAIMED') return claim;

      const input = adapterInput(claim);
      if (input === null) {
        return complete(
          claim,
          stepKind,
          false,
          { status: 'FAILED' },
          'FIXTURE_SNAPSHOT_MISSING',
        );
      }

      try {
        if (stepKind === 'SETUP') {
          const result = await dependencies.adapter.setup(input);
          return complete(
            claim,
            stepKind,
            true,
            {
              status: result.status,
              createdCount: result.createdCount,
              replayedCount: result.replayedCount,
            },
            null,
          );
        }
        if (stepKind === 'VERIFY') {
          const result = await dependencies.adapter.verify(input);
          return complete(
            claim,
            stepKind,
            result.passed,
            {
              status: result.passed ? 'PASSED' : 'FAILED',
              checkCount: result.checks.length,
              failedCheckCount: result.checks.filter(({ passed }) => !passed)
                .length,
            },
            result.passed ? null : 'VERIFICATION_FAILED',
          );
        }

        const result = await dependencies.adapter.cleanup(input);
        return complete(
          claim,
          stepKind,
          true,
          { status: result.status, deletedCount: result.deletedCount },
          null,
        );
      } catch (error) {
        return complete(
          claim,
          stepKind,
          false,
          { status: 'FAILED' },
          technicalErrorCode(error),
        );
      }
    };
  }

  let setupOperation:
    ((runId: string) => Promise<StepExecutionResult>) | undefined;
  let verifyOperation:
    ((runId: string) => Promise<StepExecutionResult>) | undefined;
  let cleanupOperation:
    ((runId: string) => Promise<StepExecutionResult>) | undefined;

  return {
    async setup(runId: string): Promise<StepExecutionResult> {
      setupOperation ??= execute('SETUP');
      const result = await setupOperation(runId);
      if (result.outcome === 'FAILED') {
        await dependencies.repository.finalizeLifecycleRun({
          runId,
          actor: dependencies.actor,
          finishedAt: now(),
        });
      }
      return result;
    },

    async afterDispatch(runId: string): Promise<PostDispatchLifecycleResult> {
      verifyOperation ??= execute('VERIFY');
      const verification = await verifyOperation(runId);
      if (
        verification.outcome === 'IN_PROGRESS' ||
        verification.outcome === 'NOT_READY' ||
        verification.outcome === 'NOT_FOUND' ||
        verification.outcome === 'CANCELLED'
      ) {
        return verification;
      }

      if (
        verification.outcome === 'FAILED' &&
        verification.errorCode === 'FIXTURE_SNAPSHOT_MISSING'
      ) {
        const status = await dependencies.repository.finalizeLifecycleRun({
          runId,
          actor: dependencies.actor,
          finishedAt: now(),
        });
        return { outcome: 'FAILED', status };
      }

      cleanupOperation ??= execute('CLEANUP');
      const cleanup = await cleanupOperation(runId);
      if (
        cleanup.outcome === 'IN_PROGRESS' ||
        cleanup.outcome === 'NOT_READY' ||
        cleanup.outcome === 'NOT_FOUND' ||
        cleanup.outcome === 'CANCELLED'
      ) {
        return cleanup;
      }

      const status = await dependencies.repository.finalizeLifecycleRun({
        runId,
        actor: dependencies.actor,
        finishedAt: now(),
      });
      return { outcome: 'COMPLETED', status };
    },
  };
}
