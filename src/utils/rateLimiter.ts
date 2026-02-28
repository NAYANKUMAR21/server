// In-memory sliding window rate limiter
// For production at scale, replace with Redis-backed implementation

interface WindowEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, WindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup stale entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * @param key      Unique key (e.g. "login:127.0.0.1")
   * @param limit    Max requests allowed
   * @param windowSec Window size in seconds
   * @returns true if request is allowed
   */
  check(key: string, limit: number, windowSec: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) this.store.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const rateLimiter = new RateLimiter();
