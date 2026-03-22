import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FollowUpWorker } from '../../workers/follow-up.worker.js';
import type { FollowUpWorkerDeps } from '../../workers/follow-up.worker.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const defaultOptions = {
  maxTimelineEntries: 200,
  followUpCheckIntervalMs: 60_000,
};

function makeCallLogDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'doc-id-1',
    callLogId: 'call-1',
    isClosed: false,
    nextFollowUpDate: new Date(Date.now() - 1000), // past due
    followUpNotifiedAt: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<FollowUpWorkerDeps> = {}): FollowUpWorkerDeps {
  return {
    CallLog: {
      find: vi.fn().mockResolvedValue([]),
      findOneAndUpdate: vi.fn().mockResolvedValue(null),
    } as unknown as FollowUpWorkerDeps['CallLog'],
    hooks: {},
    logger: mockLogger,
    options: defaultOptions,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FollowUpWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('begins the interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const worker = new FollowUpWorker(makeDeps());
      worker.start();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      worker.stop();
    });

    it('is a no-op if already started (double start)', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const worker = new FollowUpWorker(makeDeps());
      worker.start();
      worker.start(); // second call — no-op
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      worker.stop();
    });

    it('logs that worker started', () => {
      const worker = new FollowUpWorker(makeDeps());
      worker.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Follow-up worker started', expect.any(Object));
      worker.stop();
    });
  });

  describe('stop()', () => {
    it('clears the interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const worker = new FollowUpWorker(makeDeps());
      worker.start();
      worker.stop();
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('logs that worker stopped', () => {
      const worker = new FollowUpWorker(makeDeps());
      worker.start();
      worker.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Follow-up worker stopped');
    });

    it('is safe to call stop() without start()', () => {
      const worker = new FollowUpWorker(makeDeps());
      expect(() => worker.stop()).not.toThrow();
    });
  });

  describe('tick()', () => {
    it('finds due follow-ups and fires the onFollowUpDue hook', async () => {
      const callLogDoc = makeCallLogDoc();
      const onFollowUpDue = vi.fn().mockResolvedValue(undefined);
      const deps = makeDeps({
        CallLog: {
          find: vi.fn().mockResolvedValue([callLogDoc]),
          findOneAndUpdate: vi.fn().mockResolvedValue(null),
        } as unknown as FollowUpWorkerDeps['CallLog'],
        hooks: { onFollowUpDue },
      });

      const worker = new FollowUpWorker(deps);
      worker.start();
      await vi.advanceTimersByTimeAsync(60_000);
      worker.stop();

      expect(onFollowUpDue).toHaveBeenCalledWith(callLogDoc);
    });

    it('calls findOneAndUpdate to set followUpNotifiedAt and push timeline entry', async () => {
      const callLogDoc = makeCallLogDoc();
      const findOneAndUpdate = vi.fn().mockResolvedValue(null);
      const deps = makeDeps({
        CallLog: {
          find: vi.fn().mockResolvedValue([callLogDoc]),
          findOneAndUpdate,
        } as unknown as FollowUpWorkerDeps['CallLog'],
      });

      const worker = new FollowUpWorker(deps);
      worker.start();
      await vi.advanceTimersByTimeAsync(60_000);
      worker.stop();

      expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter, update] = findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ _id: 'doc-id-1' });
      expect(update.$set.followUpNotifiedAt).toBeInstanceOf(Date);
      expect(update.$push.timeline.type).toBe('follow_up_completed');
    });

    it('skips calls where followUpNotifiedAt is already set (query excludes them)', async () => {
      // The query itself filters these out — this tests the query arg is correct
      const findMock = vi.fn().mockResolvedValue([]);
      const deps = makeDeps({
        CallLog: { find: findMock } as unknown as FollowUpWorkerDeps['CallLog'],
      });

      const worker = new FollowUpWorker(deps);
      worker.start();
      await vi.advanceTimersByTimeAsync(60_000);
      worker.stop();

      expect(findMock).toHaveBeenCalledWith(
        expect.objectContaining({ followUpNotifiedAt: null }),
      );
    });

    it('error in one call does not abort processing of others', async () => {
      const failingCallLog = makeCallLogDoc({ callLogId: 'call-fail', _id: 'id-fail' });
      const goodCallLog = makeCallLogDoc({ callLogId: 'call-good', _id: 'id-good' });

      const onFollowUpDue = vi
        .fn()
        .mockRejectedValueOnce(new Error('hook exploded'))
        .mockResolvedValueOnce(undefined);

      const findOneAndUpdate = vi.fn().mockResolvedValue(null);

      const deps = makeDeps({
        CallLog: {
          find: vi.fn().mockResolvedValue([failingCallLog, goodCallLog]),
          findOneAndUpdate,
        } as unknown as FollowUpWorkerDeps['CallLog'],
        hooks: { onFollowUpDue },
      });

      const worker = new FollowUpWorker(deps);
      worker.start();
      await vi.advanceTimersByTimeAsync(60_000);
      worker.stop();

      // Both were attempted
      expect(onFollowUpDue).toHaveBeenCalledTimes(2);
      // Error was logged for the failing one
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process follow-up for call log',
        expect.objectContaining({ callLogId: 'call-fail' }),
      );
      // Good call still got persisted via findOneAndUpdate
      expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: 'id-good' });
    });

    it('does not run tick concurrently (running guard)', async () => {
      let resolveFind!: (value: unknown[]) => void;
      const findPromise = new Promise<unknown[]>((res) => { resolveFind = res; });
      const findMock = vi.fn().mockReturnValueOnce(findPromise).mockResolvedValue([]);

      const deps = makeDeps({
        CallLog: { find: findMock } as unknown as FollowUpWorkerDeps['CallLog'],
      });

      const worker = new FollowUpWorker(deps);
      worker.start();

      // First tick fires, stays pending
      await vi.advanceTimersByTimeAsync(60_000);
      // Second tick fires while first is still running
      await vi.advanceTimersByTimeAsync(60_000);

      // Resolve first tick
      resolveFind([]);
      await Promise.resolve(); // let microtasks drain
      worker.stop();

      // find() should have been called only once (second tick was guarded)
      expect(findMock).toHaveBeenCalledTimes(1);
    });
  });
});
