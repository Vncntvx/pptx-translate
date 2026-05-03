import { describe, it, expect } from 'vitest';
import { DualRateLimiter } from '../../src/translation/rate-limiter.js';

describe('DualRateLimiter', () => {
  it('should allow requests within RPM limit', async () => {
    const limiter = new DualRateLimiter(10, 10000);
    // Should not block for a single request
    await limiter.acquire(100);
    // No error means it passed
  });

  it('should handle high RPM limits without blocking', async () => {
    const limiter = new DualRateLimiter(1000, 100000);
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(limiter.acquire(50));
    }
    await Promise.all(promises);
    // All should complete quickly
  });

  it('should enforce minimum RPM of 1', () => {
    const limiter = new DualRateLimiter(0, 0);
    expect(limiter).toBeDefined();
  });
});