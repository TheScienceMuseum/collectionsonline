// Keep the result of an async function in process memory.
//
// - The cached value is tied to `key()`: when the key changes (e.g. a new
//   widget period starts) the next call recomputes, whatever the TTL says.
// - A value is reused for `ttlMs`; a null/undefined result — which our widget
//   loaders return when Elasticsearch fails — only for `failureTtlMs`, so a
//   blip doesn't blank a section for the whole TTL but a slow cluster isn't
//   re-queried on every request either.
// - Concurrent callers share one in-flight call instead of each starting
//   their own.
// - A thrown error is passed to every waiting caller and not cached.
//
// Arguments are forwarded to `fn` but are not part of the cache key: use this
// only where every caller passes the same arguments (e.g. elastic + config).
module.exports = function memoizeAsync (fn, options) {
  const key = options.key || (() => 'default');
  const ttlMs = options.ttlMs;
  const failureTtlMs = options.failureTtlMs != null ? options.failureTtlMs : ttlMs;
  const now = options.now || Date.now;

  let entry = null; // { key, value, expires }
  let inFlight = null; // { key, promise }

  return function memoized (...args) {
    const k = key();

    if (entry && entry.key === k && entry.expires > now()) {
      return Promise.resolve(entry.value);
    }
    if (inFlight && inFlight.key === k) {
      return inFlight.promise;
    }

    const promise = Promise.resolve()
      .then(() => fn(...args))
      .then((value) => {
        const ttl = value == null ? failureTtlMs : ttlMs;
        entry = { key: k, value, expires: now() + ttl };
        return value;
      })
      .finally(() => {
        if (inFlight && inFlight.promise === promise) inFlight = null;
      });

    inFlight = { key: k, promise };
    return promise;
  };
};
