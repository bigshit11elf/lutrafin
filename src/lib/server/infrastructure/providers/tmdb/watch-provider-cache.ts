import type { TmdbWatchProvider } from './tmdb-provider';
import { eq, lte } from 'drizzle-orm';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import * as schema from '$lib/server/infrastructure/database/schema';

const ttlMs = 6 * 60 * 60 * 1000;
const maxEntries = 4000;

const cache = new Map<
  string,
  { expiresAt: number; providers: TmdbWatchProvider[] }
>();

function cacheKey(
  providerSeriesId: string,
  seasonNumber: number,
  region: string
): string {
  return `${providerSeriesId}:${seasonNumber}:${region.trim().toUpperCase()}`;
}

function debugCache(message: string, context: Record<string, unknown> = {}) {
  if (loadConfig().logLevel !== 'debug') return;
  console.debug(
    JSON.stringify({
      level: 'debug',
      component: 'tmdb-cache',
      message,
      ...context
    })
  );
}

export function clearSeasonWatchProviderCache(): void {
  cache.clear();
  try {
    getDatabase().delete(schema.tmdbWatchProviderCache).run();
  } catch (error) {
    debugCache('failed to clear sqlite cache', {
      error: error instanceof Error ? error.name : 'unknown'
    });
  }
}

function fromSqlite(key: string, now: number): TmdbWatchProvider[] | undefined {
  const row = getDatabase()
    .select({
      providersJson: schema.tmdbWatchProviderCache.providersJson,
      expiresAt: schema.tmdbWatchProviderCache.expiresAt
    })
    .from(schema.tmdbWatchProviderCache)
    .where(eq(schema.tmdbWatchProviderCache.cacheKey, key))
    .get();

  if (!row) return undefined;
  if (Date.parse(row.expiresAt) <= now) {
    getDatabase()
      .delete(schema.tmdbWatchProviderCache)
      .where(eq(schema.tmdbWatchProviderCache.cacheKey, key))
      .run();
    return undefined;
  }

  return JSON.parse(row.providersJson) as TmdbWatchProvider[];
}

function saveSqlite(
  key: string,
  providerSeriesId: string,
  seasonNumber: number,
  region: string,
  providers: TmdbWatchProvider[],
  expiresAt: number,
  now: number
): void {
  const db = getDatabase();
  db.insert(schema.tmdbWatchProviderCache)
    .values({
      cacheKey: key,
      providerSeriesId,
      seasonNumber,
      region: region.trim().toUpperCase(),
      providersJson: JSON.stringify(providers),
      expiresAt: new Date(expiresAt).toISOString(),
      updatedAt: new Date(now).toISOString()
    })
    .onConflictDoUpdate({
      target: schema.tmdbWatchProviderCache.cacheKey,
      set: {
        providersJson: JSON.stringify(providers),
        expiresAt: new Date(expiresAt).toISOString(),
        updatedAt: new Date(now).toISOString()
      }
    })
    .run();
  db.delete(schema.tmdbWatchProviderCache)
    .where(
      lte(schema.tmdbWatchProviderCache.expiresAt, new Date(now).toISOString())
    )
    .run();
}

export async function cachedSeasonWatchProviders(
  providerSeriesId: string,
  seasonNumber: number,
  region: string,
  load: () => Promise<TmdbWatchProvider[]>,
  now: () => number = Date.now
): Promise<TmdbWatchProvider[]> {
  const key = cacheKey(providerSeriesId, seasonNumber, region);
  const cached = cache.get(key);
  if (cached) {
    if (cached.expiresAt > now()) {
      cache.delete(key);
      cache.set(key, cached);
      return cached.providers;
    }
    cache.delete(key);
  }

  try {
    const sqliteCached = fromSqlite(key, now());
    if (sqliteCached) {
      cache.set(key, { expiresAt: now() + ttlMs, providers: sqliteCached });
      return sqliteCached;
    }
  } catch (error) {
    debugCache('failed to read sqlite cache', {
      providerSeriesId,
      seasonNumber,
      error: error instanceof Error ? error.name : 'unknown'
    });
  }

  const providers = await load();
  const expiresAt = now() + ttlMs;
  cache.set(key, { expiresAt, providers });
  try {
    saveSqlite(
      key,
      providerSeriesId,
      seasonNumber,
      region,
      providers,
      expiresAt,
      now()
    );
  } catch (error) {
    debugCache('failed to write sqlite cache', {
      providerSeriesId,
      seasonNumber,
      error: error instanceof Error ? error.name : 'unknown'
    });
  }

  while (cache.size > maxEntries) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }

  return providers;
}
