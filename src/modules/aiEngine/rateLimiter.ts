const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 小时

class RateLimiter {
  private timestamps: number[] = [];

  /**
   * 检查是否允许此次调用。返回 true 表示放行，false 表示被限流。
   */
  check(): boolean {
    const now = Date.now();
    // 清理过期记录
    this.timestamps = this.timestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );
    if (this.timestamps.length >= RATE_LIMIT_MAX) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  /** 当前窗口内剩余可用次数 */
  get remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );
    return Math.max(0, RATE_LIMIT_MAX - this.timestamps.length);
  }

  reset(): void {
    this.timestamps = [];
  }
}

let limiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!limiterInstance) {
    limiterInstance = new RateLimiter();
  }
  return limiterInstance;
}
