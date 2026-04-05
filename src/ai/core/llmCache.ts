import { BaseCache, deserializeStoredGeneration, serializeGeneration } from "@langchain/core/caches";
import type { Generation } from "@langchain/core/outputs";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_CACHE_PATH = path.resolve(process.cwd(), "cache/langchain-llm-cache.sqlite");
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type CacheRow = {
  updated_at: number;
  value_json: string;
};

type GlobalCacheState = {
  db?: Database;
  cache?: SqliteExactMatchCache;
};

function resolveCachePath(): string {
  return process.env["AI_LLM_CACHE_PATH"]?.trim() || DEFAULT_CACHE_PATH;
}

function resolveCacheTtlMs(): number {
  const raw = Number(process.env["AI_LLM_CACHE_TTL_MS"]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
}

function getDatabase(): Database {
  const globalState = globalThis as typeof globalThis & { __pouletLangChainCache?: GlobalCacheState };
  const existing = globalState.__pouletLangChainCache?.db;
  if (existing) return existing;

  const cachePath = resolveCachePath();
  mkdirSync(path.dirname(cachePath), { recursive: true });

  const db = new Database(cachePath, { create: true });
  db.run(`
    CREATE TABLE IF NOT EXISTS llm_exact_cache (
      cache_key TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      llm_key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_llm_exact_cache_updated_at
      ON llm_exact_cache (updated_at)
  `);

  globalState.__pouletLangChainCache = {
    ...(globalState.__pouletLangChainCache ?? {}),
    db,
  };

  return db;
}

export class SqliteExactMatchCache extends BaseCache<Generation[]> {
  private readonly db: Database;
  private readonly ttlMs: number;
  private lastCleanupAt = 0;

  constructor(db: Database, ttlMs: number) {
    super();
    this.db = db;
    this.ttlMs = ttlMs;
  }

  private getCacheKey(prompt: string, llmKey: string): string {
    return this.keyEncoder(prompt, llmKey);
  }

  private pruneExpired(now: number): void {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    this.lastCleanupAt = now;
    this.db.query("DELETE FROM llm_exact_cache WHERE updated_at <= ?").run(now - this.ttlMs);
  }

  async lookup(prompt: string, llmKey: string): Promise<Generation[] | null> {
    const now = Date.now();
    this.pruneExpired(now);

    const cacheKey = this.getCacheKey(prompt, llmKey);
    const row = this.db.query("SELECT value_json, updated_at FROM llm_exact_cache WHERE cache_key = ?").get(cacheKey) as CacheRow | null;
    if (!row) return null;

    if (row.updated_at + this.ttlMs <= now) {
      this.db.query("DELETE FROM llm_exact_cache WHERE cache_key = ?").run(cacheKey);
      return null;
    }

    const stored = JSON.parse(row.value_json) as Array<Parameters<typeof deserializeStoredGeneration>[0]>;
    return stored.map((generation) => deserializeStoredGeneration(generation) as Generation);
  }

  async update(prompt: string, llmKey: string, value: Generation[]): Promise<void> {
    const now = Date.now();
    this.pruneExpired(now);

    const cacheKey = this.getCacheKey(prompt, llmKey);
    const serialized = JSON.stringify(value.map((generation) => serializeGeneration(generation)));

    this.db.query(`
      INSERT INTO llm_exact_cache (cache_key, prompt, llm_key, value_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        prompt = excluded.prompt,
        llm_key = excluded.llm_key,
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(cacheKey, prompt, llmKey, serialized, now);
  }
}

export function getLlmCache(): SqliteExactMatchCache {
  const globalState = globalThis as typeof globalThis & { __pouletLangChainCache?: GlobalCacheState };
  const existing = globalState.__pouletLangChainCache?.cache;
  if (existing) return existing;

  const cache = new SqliteExactMatchCache(getDatabase(), resolveCacheTtlMs());
  globalState.__pouletLangChainCache = {
    ...globalState.__pouletLangChainCache,
    cache,
  };

  return cache;
}
