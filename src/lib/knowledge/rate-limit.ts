import {
  GUEST_MAX_TOKENS,
  GUEST_REFILL_RATE,
  USER_MAX_TOKENS,
  USER_REFILL_RATE,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/knowledge/config";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number;
  windowMs: number;
}

const GUEST_CONFIG: RateLimiterConfig = { maxTokens: GUEST_MAX_TOKENS, refillRate: GUEST_REFILL_RATE, windowMs: RATE_LIMIT_WINDOW_MS };
const USER_CONFIG: RateLimiterConfig = { maxTokens: USER_MAX_TOKENS, refillRate: USER_REFILL_RATE, windowMs: RATE_LIMIT_WINDOW_MS };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const staleThreshold = now - 10 * 60_000;
  const keys = Array.from(buckets.keys());
  for (const key of keys) {
    const bucket = buckets.get(key)!;
    if (bucket.lastRefill < staleThreshold) buckets.delete(key);
  }
}

function consume(key: string, config: RateLimiterConfig): boolean {
  cleanup();
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

export function checkRateLimit(ip: string, userId: string | null): { allowed: boolean; retryAfterMs?: number } {
  const config = userId ? USER_CONFIG : GUEST_CONFIG;
  const key = userId ? `user:${userId}` : `ip:${ip}`;

  if (consume(key, config)) {
    return { allowed: true };
  }

  const retryAfterMs = Math.ceil(1000 / config.refillRate);
  return { allowed: false, retryAfterMs };
}
