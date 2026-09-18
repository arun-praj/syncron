export { v7 as newId } from "uuid";
export class DomainError extends Error {
  constructor(
    public code: string,
    public status = 403,
  ) {
    super(code);
  }
}
export interface RateLimiter {
  take(key: string, limit: number, windowMs: number, burst?: number): boolean;
}
// ponytail: process-local buckets; replace the adapter when deploying multiple API processes.
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  private windows = new Map<string, number[]>();
  constructor(private now = () => Date.now()) {}
  take(key: string, limit: number, windowMs: number, burst?: number) {
    const now = this.now();
    if (burst === undefined) {
      const recent = (this.windows.get(key) ?? []).filter(
        (at) => now - at < windowMs,
      );
      const allowed = recent.length < limit;
      if (allowed) recent.push(now);
      this.windows.set(key, recent);
      if (this.windows.size > 10000)
        for (const [k, times] of this.windows)
          if (now - (times.at(-1) ?? 0) > 3600000) this.windows.delete(k);
      return allowed;
    }
    const previous = this.buckets.get(key) ?? { tokens: burst, at: now };
    const tokens = Math.min(
      burst,
      previous.tokens + ((now - previous.at) * limit) / windowMs,
    );
    this.buckets.set(key, {
      tokens: tokens >= 1 ? tokens - 1 : tokens,
      at: now,
    });
    if (this.buckets.size > 10000)
      for (const [k, v] of this.buckets)
        if (now - v.at > 3600000) this.buckets.delete(k);
    return tokens >= 1;
  }
}
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /password|secret|token|invite|otp|authorization|cookie|chat|body|text/i.test(
          k,
        )
          ? "[REDACTED]"
          : redact(v),
      ]),
    );
  return value;
}
export function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify(redact(fields)));
}
