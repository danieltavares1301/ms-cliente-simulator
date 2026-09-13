import { describe, expect, it, vi } from 'vitest';

import type { RunRepository } from '../db/run-repository';
import {
  createDispatchDeduplicationId,
  QStashRunScheduler,
} from './qstash-scheduler';

const runId = '11111111-1111-4111-8111-111111111111';
const steps = [
  {
    stepId: '22222222-2222-4222-8222-000000000001',
    stepKey: 'first',
    ordinal: 1,
    delayMs: 250,
    attemptNumber: 1,
  },
  {
    stepId: '22222222-2222-4222-8222-000000000002',
    stepKey: 'second',
    ordinal: 2,
    delayMs: 1_250,
    attemptNumber: 1,
  },
] as const;

describe('createDispatchDeduplicationId', () => {
  it('returns a readable QStash-safe identifier within the defensive limit', () => {
    const id = createDispatchDeduplicationId(
      'run with whitespace:and-sensitive@example.com',
      'step:with:separators',
      1,
    );

    expect(id).toMatch(/^dispatch_[A-Za-z0-9_-]+$/);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).not.toContain(':');
    expect(id).not.toContain('sensitive');
  });

  it('is deterministic for the same dispatch identity', () => {
    const first = createDispatchDeduplicationId(runId, steps[0].stepId, 1);
    const second = createDispatchDeduplicationId(runId, steps[0].stepId, 1);

    expect(second).toBe(first);
  });

  it('distinguishes attempts and obvious input-boundary collisions', () => {
    const attemptOne = createDispatchDeduplicationId(runId, steps[0].stepId, 1);
    const attemptTwo = createDispatchDeduplicationId(runId, steps[0].stepId, 2);
    const leftBoundary = createDispatchDeduplicationId('ab', 'c', 1);
    const rightBoundary = createDispatchDeduplicationId('a', 'bc', 1);

    expect(attemptTwo).not.toBe(attemptOne);
    expect(rightBoundary).not.toBe(leftBoundary);
  });
});

describe('QStashRunScheduler', () => {
  it('publishes only the minimal technical body with ordered second delays and deterministic deduplication', async () => {
    const publishJSON = vi
      .fn()
      .mockResolvedValueOnce({ messageId: 'msg-first' })
      .mockResolvedValueOnce({ messageId: 'msg-second' });
    const recordStepScheduled = vi.fn().mockResolvedValue(true);
    const markRunScheduled = vi.fn().mockResolvedValue(true);
    const repository = {
      recordStepScheduled,
      markRunScheduled,
    } as unknown as RunRepository;
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON,
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com/',
      retries: 3,
    });

    await scheduler.schedule({ runId, steps: [...steps].reverse() });

    expect(publishJSON).toHaveBeenNthCalledWith(1, {
      url: 'https://simulator.example.com/api/v1/internal/dispatches',
      body: {
        runId,
        stepId: steps[0].stepId,
        attemptNumber: 1,
      },
      delay: 1,
      retries: 3,
      deduplicationId: createDispatchDeduplicationId(runId, steps[0].stepId, 1),
    });
    expect(publishJSON).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: {
          runId,
          stepId: steps[1].stepId,
          attemptNumber: 1,
        },
        delay: 2,
        deduplicationId: createDispatchDeduplicationId(
          runId,
          steps[1].stepId,
          1,
        ),
      }),
    );
    expect(publishJSON.mock.calls[0]?.[0].deduplicationId).not.toContain(':');
    expect(JSON.stringify(publishJSON.mock.calls)).not.toContain('numerocpf');
    expect(recordStepScheduled).toHaveBeenNthCalledWith(1, {
      stepId: steps[0].stepId,
      messageId: 'msg-first',
    });
    expect(recordStepScheduled).toHaveBeenNthCalledWith(2, {
      stepId: steps[1].stepId,
      messageId: 'msg-second',
    });
    expect(markRunScheduled).toHaveBeenCalledWith(runId);
  });

  it('records an auditable PARTIAL state after a partial publication without pretending rollback', async () => {
    const publishJSON = vi
      .fn()
      .mockResolvedValueOnce({ messageId: 'msg-first' })
      .mockRejectedValueOnce(new Error('provider unavailable'));
    const recordSchedulingFailure = vi.fn().mockResolvedValue(undefined);
    const repository = {
      recordStepScheduled: vi.fn().mockResolvedValue(true),
      recordSchedulingFailure,
    } as unknown as RunRepository;
    const scheduler = new QStashRunScheduler({
      repository,
      clientFactory: () => ({
        publishJSON,
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 2,
    });

    await expect(scheduler.schedule({ runId, steps })).rejects.toThrow(
      'QStash scheduling failed',
    );
    expect(recordSchedulingFailure).toHaveBeenCalledWith({
      runId,
      failedStepId: steps[1].stepId,
      publishedCount: 1,
    });
  });

  it('treats an accepted message as published when local message-id persistence fails', async () => {
    const recordSchedulingFailure = vi.fn().mockResolvedValue(undefined);
    const scheduler = new QStashRunScheduler({
      repository: {
        recordStepScheduled: vi.fn().mockResolvedValue(false),
        recordSchedulingFailure,
      } as unknown as RunRepository,
      clientFactory: () => ({
        publishJSON: vi.fn().mockResolvedValue({ messageId: 'msg-accepted' }),
        messages: { cancel: vi.fn() },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await expect(
      scheduler.schedule({ runId, steps: [steps[0]] }),
    ).rejects.toThrow('QStash scheduling failed');
    expect(recordSchedulingFailure).toHaveBeenCalledWith({
      runId,
      failedStepId: steps[0].stepId,
      publishedCount: 1,
    });
  });

  it('does not construct the SDK client before schedule is invoked', async () => {
    const clientFactory = vi.fn(() => ({
      publishJSON: vi.fn().mockResolvedValue({ messageId: 'msg' }),
      messages: { cancel: vi.fn() },
    }));
    const scheduler = new QStashRunScheduler({
      repository: {
        recordStepScheduled: vi.fn().mockResolvedValue(true),
        markRunScheduled: vi.fn().mockResolvedValue(true),
      } as unknown as RunRepository,
      clientFactory,
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    expect(clientFactory).not.toHaveBeenCalled();
    await scheduler.schedule({ runId, steps: [steps[0]] });
    expect(clientFactory).toHaveBeenCalledOnce();
  });

  it('cancels messages independently, tolerates repeats, and reports partial failures', async () => {
    const cancel = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockRejectedValueOnce({ status: 404 });
    const scheduler = new QStashRunScheduler({
      repository: {} as RunRepository,
      clientFactory: () => ({
        publishJSON: vi.fn(),
        messages: { cancel },
      }),
      publicAppBaseUrl: 'https://simulator.example.com',
      retries: 1,
    });

    await expect(
      scheduler.cancelPending(['msg-1', 'msg-2']),
    ).resolves.toStrictEqual({
      cancelledMessageIds: ['msg-1'],
      failedMessageIds: ['msg-2'],
    });
    await expect(scheduler.cancelPending(['msg-1'])).resolves.toStrictEqual({
      cancelledMessageIds: ['msg-1'],
      failedMessageIds: [],
    });

    expect(cancel).toHaveBeenNthCalledWith(1, 'msg-1');
    expect(cancel).toHaveBeenNthCalledWith(2, 'msg-2');
    expect(cancel).toHaveBeenNthCalledWith(3, 'msg-1');
  });
});
