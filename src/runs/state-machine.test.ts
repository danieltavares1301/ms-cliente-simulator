import { describe, expect, it } from 'vitest';

import { runStatuses, stepStatuses } from '../db/run-repository';
import {
  canTransitionRun,
  canTransitionStep,
  runTransitions,
  stepTransitions,
} from './state-machine';

describe('run state machine', () => {
  it('defines every allowed and rejected transition explicitly', () => {
    expect(runTransitions).toStrictEqual({
      CREATED: ['PROVISIONING', 'SCHEDULED', 'CANCELLING', 'FAILED'],
      PROVISIONING: ['SCHEDULED', 'RUNNING', 'CANCELLING', 'FAILED', 'PARTIAL'],
      SCHEDULED: ['RUNNING', 'CANCELLING', 'FAILED', 'PARTIAL'],
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
      FAILED: ['SCHEDULED', 'RUNNING'],
      PARTIAL: ['SCHEDULED', 'RUNNING'],
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
