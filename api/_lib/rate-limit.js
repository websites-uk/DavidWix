// Best-effort per-instance limiter. Use Vercel Firewall or a shared store for
// enforcement across serverless instances and regions.
const buckets = new Map();

export function rateLimit(req, res, { key, limit, windowMs }) {
  const forwarded = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "").split(",")[0]).trim()
    || req.socket?.remoteAddress
    || "unknown";
  const bucketKey = key + ":" + ip;
  const now = Date.now();
  let bucket = buckets.get(bucketKey);

  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.setHeader("Cache-Control", "no-store");
    res.status(429).json({ error: "Too many requests. Please wait and try again." });
    return false;
  }

  // Bound memory use and remove expired entries opportunistically.
  if (buckets.size > 5000) {
    for (const [id, value] of buckets) {
      if (now - value.startedAt >= windowMs) buckets.delete(id);
    }
    while (buckets.size > 4000) buckets.delete(buckets.keys().next().value);
  }
  return true;
}
