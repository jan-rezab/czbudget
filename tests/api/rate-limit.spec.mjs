import assert from "node:assert/strict";
import { test } from "node:test";
import { FixedWindowRateLimiter } from "../../server/rate-limit.mjs";

test("enforces a fixed-window request maximum", () => {
  const limiter = new FixedWindowRateLimiter();
  assert.equal(limiter.consume("client", { limit: 2, windowMs: 1_000 }, 1_000).allowed, true);
  assert.equal(limiter.consume("client", { limit: 2, windowMs: 1_000 }, 1_001).allowed, true);
  const blocked = limiter.consume("client", { limit: 2, windowMs: 1_000 }, 1_002);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(limiter.consume("client", { limit: 2, windowMs: 1_000 }, 2_000).allowed, true);
});

test("expires buckets and bounds high-cardinality state", () => {
  const limiter = new FixedWindowRateLimiter({ maxBuckets: 2, sweepEvery: 100 });
  limiter.consume("one", { limit: 1, windowMs: 1_000 }, 0);
  limiter.consume("two", { limit: 1, windowMs: 1_000 }, 0);
  limiter.consume("three", { limit: 1, windowMs: 1_000 }, 0);
  assert.equal(limiter.size, 2);
  limiter.prune(1_000);
  assert.equal(limiter.size, 0);
});
