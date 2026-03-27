type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function createTimedCache<K, V>(ttlMs: number) {
  const values = new Map<K, CacheEntry<V>>();
  const inflight = new Map<K, Promise<V>>();

  function get(key: K): V | undefined {
    const entry = values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: K, value: V): V {
    values.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  function del(key: K): void {
    values.delete(key);
    inflight.delete(key);
  }

  function clear(): void {
    values.clear();
    inflight.clear();
  }

  async function getOrLoad(key: K, loader: () => Promise<V>): Promise<V> {
    const cached = get(key);
    if (cached !== undefined) return cached;

    const current = inflight.get(key);
    if (current) return current;

    const promise = loader()
      .then((value) => set(key, value))
      .finally(() => {
        if (inflight.get(key) === promise) inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise;
  }

  return {
    get,
    set,
    delete: del,
    clear,
    getOrLoad,
  };
}
