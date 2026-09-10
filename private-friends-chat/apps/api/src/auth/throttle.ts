interface Attempt {
  count: number;
  firstAttemptAt: number;
}

export class LoginThrottler {
  private readonly attempts = new Map<string, Attempt>();

  public isBlocked(key: string, now = Date.now()): boolean {
    const attempt = this.attempts.get(key);
    if (!attempt || now - attempt.firstAttemptAt > 15 * 60_000) return false;
    return attempt.count >= 5;
  }

  public recordFailure(key: string, now = Date.now()): void {
    const existing = this.attempts.get(key);
    if (!existing || now - existing.firstAttemptAt > 15 * 60_000) {
      this.attempts.set(key, { count: 1, firstAttemptAt: now });
      return;
    }
    existing.count += 1;
  }

  public clear(key: string): void {
    this.attempts.delete(key);
  }
}
