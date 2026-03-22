import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiterService } from '../../services/rate-limiter.service.js';

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('RateLimiterService (in-memory)', () => {
  let limiter: RateLimiterService;

  beforeEach(() => {
    limiter = new RateLimiterService(60000, 3, null, '', noopLogger);
  });

  it('allows requests under the limit', async () => {
    const result = await limiter.checkLimit('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('blocks after max attempts', async () => {
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    const result = await limiter.checkLimit('ip1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('decrements remaining on each attempt', async () => {
    await limiter.recordAttempt('ip1');
    const result = await limiter.checkLimit('ip1');
    expect(result.remaining).toBe(2);
  });

  it('resets counter for a key', async () => {
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    await limiter.reset('ip1');
    const result = await limiter.checkLimit('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('isolates keys from each other', async () => {
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    const result = await limiter.checkLimit('ip2');
    expect(result.allowed).toBe(true);
  });
});
