// Share work only while it is running. Completed values keep the caller's existing
// cache policy, and failures are removed so the next request can retry normally.
export function shareInFlight(pending, key, run) {
  if (pending.has(key)) return pending.get(key);
  const promise = Promise.resolve().then(run).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
