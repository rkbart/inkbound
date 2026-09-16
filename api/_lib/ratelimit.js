// Sliding-window rate limiter for the expensive endpoints.
//
// Why this exists: /api/interact calls a paid LLM API. Without a limit, one
// runaway client (a script, a retry loop, or someone holding down "double tap")
// can burn the whole NVIDIA quota in minutes. Everything else in the app is
// cheap enough not to need a guard.
//
// Two buckets, checked together (see `checkInteraction`):
//
//   1. IP + username — the per-identity budget. Keeps one writer behind a
//      shared address from eating everyone else's allowance.
//   2. IP alone      — the abuse ceiling. App auth is name-only, so a client
//      can invent a new username on every request; only the IP is expensive to
//      rotate. This bucket is what actually bounds a scripted client, and it is
//      the reason the username is NOT allowed to be the outermost key.
//
// IMPORTANT — what this does and does not do:
//   * It is an IN-MEMORY, PER-INSTANCE guard. Vercel runs several short-lived
//     serverless instances, each with its own copy of this Map, so the real
//     global ceiling is roughly (limit x instances). That is fine for its
//     purpose — stopping runaway clients — but it is NOT a hard quota.
//   * A durable limiter would need shared state (the Turso DB, or a service
//     like Upstash Redis). That is the natural next step, and the reason the
//     limits are configurable rather than hard-coded.
//
// The clock is injectable so the logic is deterministic in tests: you can
// advance time without sleeping.

export function createRateLimiter({
  limit = 20,
  // Deliberately looser than the per-identity limit: several legitimate writers
  // can share one address (a household, an office, a VPN), so the IP bucket
  // must tolerate that while still capping a single abusive client.
  ipLimit = limit * 3,
  windowMs = 60_000,
  maxKeys = 5000,
  now = () => Date.now()
} = {}) {
  // bucket key -> array of request timestamps, oldest first.
  const buckets = new Map();

  const evictOldest = () => {
    // Map iterates in insertion order, so the first key is the oldest entry.
    const oldest = buckets.keys().next();
    if (!oldest.done) buckets.delete(oldest.value);
  };

  /**
   * Records one request against `bucket` if it is still under `cap`.
   * @returns {{allowed: boolean, remaining: number, retryAfterMs: number}}
   */
  const consume = (bucket, cap) => {
    const t = now();
    const cutoff = t - windowMs;

    let stamps = buckets.get(bucket);
    if (!stamps) {
      stamps = [];
      buckets.set(bucket, stamps);
    }

    // Drop timestamps that have fallen out of the window.
    while (stamps.length > 0 && stamps[0] <= cutoff) stamps.shift();

    if (stamps.length >= cap) {
      // Blocked. The oldest hit leaves the window at stamps[0] + windowMs.
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, stamps[0] + windowMs - t)
      };
    }

    stamps.push(t);
    if (buckets.size > maxKeys) evictOldest();
    return { allowed: true, remaining: cap - stamps.length, retryAfterMs: 0 };
  };

  /** The IP-only bucket is namespaced so it can never collide with an identity key. */
  const ipBucket = (ip) => `ip:${ip}`;

  return {
    /** Checks one identity bucket. */
    check(key) {
      return consume(key, limit);
    },

    /** Checks the IP-only abuse ceiling. */
    checkIp(ip) {
      return consume(ipBucket(ip), ipLimit);
    },

    /**
     * The check the API handlers use: both buckets, and the stricter verdict
     * wins. A request rejected by the identity bucket consumes nothing; one
     * rejected by the IP ceiling has already spent an identity slot, which is
     * acceptable — that caller is being blocked anyway.
     */
    checkInteraction(req, username) {
      const ip = clientIp(req);
      const identity = consume(rateLimitKey(req, username), limit);
      if (!identity.allowed) return identity;
      return consume(ipBucket(ip), ipLimit);
    },

    /** Number of tracked buckets (exposed for tests and metrics). */
    size() {
      return buckets.size;
    },

    /** Forgets all recorded hits. */
    reset() {
      buckets.clear();
    }
  };
}

/** Reads the caller's IP, honouring the proxy headers Vercel sets. */
export function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  const real = req?.headers?.['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) return real;
  return req?.socket?.remoteAddress || 'unknown';
}

/**
 * The per-identity rate-limit key: IP + username.
 *
 * Note this is the *fairness* key, not the security boundary — see the IP
 * bucket above for why. A missing name must not collide with a real one.
 */
export function rateLimitKey(req, username) {
  return `${clientIp(req)}|${username || 'anonymous'}`;
}

/** Per-name requests allowed per minute. Override with RATE_LIMIT_PER_MINUTE. */
export const INTERACT_LIMIT_PER_MINUTE =
  Number(process.env.RATE_LIMIT_PER_MINUTE) > 0
    ? Number(process.env.RATE_LIMIT_PER_MINUTE)
    : 20;

/** Per-IP ceiling per minute. Override with RATE_LIMIT_IP_PER_MINUTE. */
export const INTERACT_IP_LIMIT_PER_MINUTE =
  Number(process.env.RATE_LIMIT_IP_PER_MINUTE) > 0
    ? Number(process.env.RATE_LIMIT_IP_PER_MINUTE)
    : INTERACT_LIMIT_PER_MINUTE * 3;

/** Shared limiter instance for POST /api/interact. */
export const interactLimiter = createRateLimiter({
  limit: INTERACT_LIMIT_PER_MINUTE,
  ipLimit: INTERACT_IP_LIMIT_PER_MINUTE,
  windowMs: 60_000
});
