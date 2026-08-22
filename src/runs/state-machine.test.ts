import { describe, expect, it } from 'vitest';

import { runStatuses, stepStatuses } from '../db/run-repository';
import {
  canTransitionRun,
  canTransitionStep,
  deriveDispatchRunStatus,
  runTransitions,
  stepTransitions,
} from './state-machine';

describe('run state machine', () => {
  it('defines every allowed and rejected transition explicitly', () => {
    expect(runTransitions).toStrictEqual({
      CREATED: ['PROVISIONING', 'SCHEDULED', 'CANCELLING', 'FAILED'],
      PROVISIONING: [
        'SCHEDULED',
        'RUNNING',
        'WAITING_ASYNC',
        'VERIFYING',
        'CANCELLING',
        'FAILED',
        'PARTIAL',
      ],
      SCHEDULED: [
        'RUNNING',
        'WAITING_ASYNC',
        'VERIFYING',
        'CANCELLING',
        'FAILED',
        'PARTIAL',
      ],
      RUNNING: [
        'WAITING_ASYNC',
        'VERIFYING',
        'SUCCEEDED',
        'FAILED',
        'PARTIAL',
        'CANCELLING',
      ],
      WAITING_ASYNC: [
        'VERIFYING',
        'SUCCEEDED',
        'FAILED',
        'PARTIAL',
        'CANCELLING',
      ],
      VERIFYING: ['SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLING'],
      SUCCEEDED: [],
      FAILED: ['SCHEDULED', 'RUNNING', 'WAITING_ASYNC', 'VERIFYING'],
      PARTIAL: ['SCHEDULED', 'RUNNING', 'WAITING_ASYNC', 'VERIFYING'],
      CANCELLING: ['CANCELLED', 'PARTIAL'],
      CANCELLED: [],
    });
    for (const from of runStatuses) {
      for (const to of runStatuses) {
        expect(canTransitionRun(from, to)).toBe(
          runTransitions[from].includes(to),
        );
      }
    }
  });

  it('keeps terminal cancellation closed while allowing failed recovery', () => {
    expect(canTransitionRun('FAILED', 'SCHEDULED')).toBe(true);
    expect(canTransitionRun('PARTIAL', 'SCHEDULED')).toBe(true);
    expect(runTransitions.CANCELLED).toStrictEqual([]);
    expect(runTransitions.SUCCEEDED).toStrictEqual([]);
  });

  it('derives QStash scheduling reconciliation from dispatch step progress', () => {
    expect(
      deriveDispatchRunStatus({
        currentStatus: 'PROVISIONING',
        dispatchStepStatuses: ['SUCCEEDED'],
        expectedCallbackMax: 0,
      }),
    ).toBe('VERIFYING');
    expect(
      deriveDispatchRunStatus({
        currentStatus: 'PROVISIONING',
        dispatchStepStatuses: ['SUCCEEDED'],
        expectedCallbackMax: 1,
      }),
    ).toBe('WAITING_ASYNC');
    expect(
      deriveDispatchRunStatus({
        currentStatus: 'PROVISIONING',
        dispatchStepStatuses: ['SUCCEEDED', 'PENDING'],
        expectedCallbackMax: 0,
      }),
    ).toBe('RUNNING');
    expect(
      deriveDispatchRunStatus({
        currentStatus: 'PROVISIONING',
        dispatchStepStatuses: ['PENDING', 'SCHEDULED'],
        expectedCallbackMax: 0,
      }),
    ).toBe('SCHEDULED');
    expect(
      deriveDispatchRunStatus({
        currentStatus: 'RUNNING',
        dispatchStepStatuses: ['PENDING'],
        expectedCallbackMax: 0,
      }),
    ).toBe('RUNNING');
    expect(
      deriveDispatchRunStatus({
        currentStatus: 'VERIFYING',
        dispatchStepStatuses: ['PENDING', 'SCHEDULED'],
        expectedCallbackMax: 0,
      }),
    ).toBe('VERIFYING');
  });
});

describe('step state machine', () => {
  it('defines every allowed and rejected transition explicitly', () => {
    expect(stepTransitions).toStrictEqual({
      PENDING: ['SCHEDULED', 'RUNNING', 'CANCELLED', 'SKIPPED'],
      SCHEDULED: ['RUNNING', 'CANCELLED'],
      RUNNING: ['SUCCEEDED', 'FAILED'],
      SUCCEEDED: [],
      FAILED: ['PENDING', 'SCHEDULED'],
      CANCELLED: [],
      SKIPPED: [],
    });
    for (const from of stepStatuses) {
      for (const to of stepStatuses) {
        expect(canTransitionStep(from, to)).toBe(
          stepTransitions[from].includes(to),
        );
      }
    }
  });

  it('allows retry only from FAILED and cancellation only while pending', () => {
    expect(canTransitionStep('FAILED', 'PENDING')).toBe(true);
    expect(canTransitionStep('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransitionStep('SCHEDULED', 'CANCELLED')).toBe(true);
    expect(canTransitionStep('RUNNING', 'CANCELLED')).toBe(false);
    expect(stepTransitions.SUCCEEDED).toStrictEqual([]);
    expect(stepTransitions.CANCELLED).toStrictEqual([]);
  });
});
