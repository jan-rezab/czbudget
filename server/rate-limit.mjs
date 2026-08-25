export class FixedWindowRateLimiter {
  constructor({ maxBuckets = 50_000, sweepEvery = 256 } = {}) {
    if (!Number.isInteger(maxBuckets) || maxBuckets < 1) throw new TypeError("maxBuckets must be a positive integer");
    if (!Number.isInteger(sweepEvery) || sweepEvery < 1) throw new TypeError("sweepEvery must be a positive integer");
    this.maxBuckets = maxBuckets;
    this.sweepEvery = sweepEvery;
    this.buckets = new Map();
    this.operations = 0;
  }

  consume(key, { limit, windowMs }, now = Date.now()) {
    if (typeof key !== "string" || !key) throw new TypeError("key is required");
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError("limit must be a positive integer");
    if (!Number.isInteger(windowMs) || windowMs < 1) throw new TypeError("windowMs must be a positive integer");

    this.operations += 1;
    if (this.operations % this.sweepEvery === 0 || this.buckets.size >= this.maxBuckets) this.prune(now);

    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      if (!bucket && this.buckets.size >= this.maxBuckets) {
        // Bound memory under high-cardinality traffic. Edge rate limiting remains
        // the authoritative protection against distributed sources.
        this.buckets.delete(this.buckets.keys().next().value);
      }
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  prune(now = Date.now()) {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }

  clear() {
    this.buckets.clear();
    this.operations = 0;
  }

  get size() {
    return this.buckets.size;
  }
}
