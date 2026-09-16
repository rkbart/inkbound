// Unit tests for the sliding-window rate limiter.
//
// This is the guard that stops a runaway client from burning the NVIDIA quota,
// so its edges matter: an off-by-one here either blocks a legitimate writer or
// fails to protect the API. The clock is injectable precisely so these run
// instantly and deterministically — no sleeping, no flakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, rateLimitKey, clientIp } from '../../api/_lib/ratelimit.js';

// A controllable clock: tests advance time explicitly.
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('allows requests up to the limit, then blocks', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });

  for (let i = 0; i < 3; i++) {
    const v = limiter.check('k');
    assert.equal(v.allowed, true, `request ${i + 1} should be allowed`);
    assert.equal(v.remaining, 3 - (i + 1));
  }

  const blocked = limiter.check('k');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test('reports how long the caller must wait', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
  limiter.check('k');

  clock.advance(20_000);
  const v = limiter.check('k');
  assert.equal(v.allowed, false);
  // The single hit was 20s ago, so it leaves the window in 40s.
  assert.equal(v.retryAfterMs, 40_000);
});

test('frees up again once the window slides past the oldest hit', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });
  limiter.check('k');
  clock.advance(1_000);
  limiter.check('k');
  assert.equal(limiter.check('k').allowed, false, 'third request inside the window is blocked');

  clock.advance(60_000); // both hits are now older than the window
  assert.equal(limiter.check('k').allowed, true, 'window should have slid');
});

test('tracks each key independently', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('a').allowed, false);
  assert.equal(limiter.check('b').allowed, true, 'a different key has its own budget');
});

test('treats the boundary exactly at the window edge as expired', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
  limiter.check('k');
  clock.advance(1000); // precisely at the edge
  assert.equal(limiter.check('k').allowed, true, 'a hit exactly windowMs old is out of the window');
});

test('a single burst does not consume more than the limit', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 5, windowMs: 1000, now: clock.now });
  let allowed = 0;
  for (let i = 0; i < 50; i++) {
    if (limiter.check('burst').allowed) allowed++;
  }
  assert.equal(allowed, 5);
});

test('caps the number of tracked keys so a hostile client cannot grow the map', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 10, now: clock.now });
  for (let i = 0; i < 40; i++) {
    limiter.check(`key-${i}`);
  }
  assert.ok(limiter.size() <= 11, `map should stay bounded, got ${limiter.size()}`);
});

test('reset() forgets all recorded hits', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
  limiter.check('k');
  assert.equal(limiter.check('k').allowed, false);
  limiter.reset();
  assert.equal(limiter.check('k').allowed, true);
  assert.equal(limiter.size(), 1);
});

test('clientIp prefers x-forwarded-for, then x-real-ip, then the socket', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }), '203.0.113.7');
  assert.equal(clientIp({ headers: { 'x-real-ip': '198.51.100.9' } }), '198.51.100.9');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
  assert.equal(clientIp({ headers: {} }), 'unknown');
  assert.equal(clientIp(undefined), 'unknown');
});

test('rateLimitKey combines IP and username', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.7' } };
  assert.equal(rateLimitKey(req, 'Corvus'), '203.0.113.7|Corvus');
  // A missing name must not produce a key that collides with a real one.
  assert.equal(rateLimitKey(req, undefined), '203.0.113.7|anonymous');
});

test('rotating the username alone cannot escape the IP ceiling', () => {
  // Name-only auth means a client can invent a fresh username per request.
  // The identity bucket would grant each new name its own budget, so the
  // IP-only ceiling is what actually stops a scripted client. If this
  // regresses, the limiter is trivially bypassable.
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, ipLimit: 2, windowMs: 60_000, now: clock.now });
  const req = { headers: { 'x-forwarded-for': '203.0.113.7' } };
  assert.equal(limiter.checkInteraction(req, 'nameOne').allowed, true);
  assert.equal(limiter.checkInteraction(req, 'nameTwo').allowed, true, 'a new name gets its own identity budget');
  assert.equal(limiter.checkInteraction(req, 'nameThree').allowed, false, 'but the IP ceiling still blocks the third request');
});

test('a shared IP does not let one writer exhaust another writer', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 2, ipLimit: 5, windowMs: 60_000, now: clock.now });
  const req = { headers: { 'x-forwarded-for': '203.0.113.7' } };
  assert.equal(limiter.checkInteraction(req, 'alice').allowed, true);
  assert.equal(limiter.checkInteraction(req, 'alice').allowed, true);
  assert.equal(limiter.checkInteraction(req, 'alice').allowed, false, 'alice hits her own cap');
  assert.equal(limiter.checkInteraction(req, 'bob').allowed, true, 'bob still has his own budget');
});

test('checkInteraction rejects without digging the caller deeper', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, ipLimit: 1, windowMs: 60_000, now: clock.now });
  const req = { headers: { 'x-forwarded-for': '203.0.113.7' } };
  assert.equal(limiter.checkInteraction(req, 'a').allowed, true);
  assert.equal(limiter.checkInteraction(req, 'b').allowed, false);
  assert.equal(limiter.checkInteraction(req, 'b').allowed, false, 'still blocked');
  clock.advance(60_000);
  assert.equal(limiter.checkInteraction(req, 'b').allowed, true, 'window slides, budget returns');
});

test('checkIp enforces the per-address ceiling on its own', () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 10, ipLimit: 2, windowMs: 60_000, now: clock.now });
  assert.equal(limiter.checkIp('203.0.113.7').allowed, true);
  assert.equal(limiter.checkIp('203.0.113.7').allowed, true);
  assert.equal(limiter.checkIp('203.0.113.7').allowed, false);
  assert.equal(limiter.checkIp('198.51.100.9').allowed, true, 'a different address is unaffected');
});