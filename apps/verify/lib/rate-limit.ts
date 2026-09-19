// Public rate limiting for /verify/*: 60 requests per minute per IP through Upstash Redis.
// It FAILS OPEN: unset credentials, an Upstash error or a slow answer (> 500 ms) all let the
// request through. Only a positive "over the limit" answer blocks (architecture §9).
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface LimitDecision {
  success: boolean;
  /** Epoch milliseconds when the window resets. */
  reset: number;
}

export interface Limiter {
  limit(key: string): Promise<LimitDecision>;
}

export const LIMIT_PER_MINUTE = 60;
export const LIMIT_TIMEOUT_MS = 500;

export type GuardResult = { blocked: false } | { blocked: true; retryAfterSeconds: number };

export async function checkRateLimit(
  limiter: Limiter | null,
  ip: string | null,
  options: { timeoutMs?: number; now?: () => number } = {},
): Promise<GuardResult> {
  if (!limiter || !ip) return { blocked: false };
  const timeoutMs = options.timeoutMs ?? LIMIT_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const decision = await Promise.race([
      limiter.limit(ip),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (decision && !decision.success) {
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((decision.reset - now()) / 1000)),
      };
    }
    return { blocked: false };
  } catch {
    return { blocked: false };
  } finally {
    clearTimeout(timer);
  }
}

/** The client's IP as seen by Vercel's edge (first entry of X-Forwarded-For). */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

let cached: Limiter | null | undefined;

/** The real limiter, or null when Upstash is not configured (rate limiting is then simply off). */
export function getLimiter(env: NodeJS.ProcessEnv = process.env): Limiter | null {
  if (cached !== undefined) return cached;
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return (cached = null);
  cached = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(LIMIT_PER_MINUTE, "1 m"),
    prefix: "verify",
  });
  return cached;
}
