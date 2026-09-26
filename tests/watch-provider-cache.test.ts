import { beforeEach, describe, expect, it } from 'vitest';
import {
  cachedSeasonWatchProviders,
  clearSeasonWatchProviderCache
} from '../src/lib/server/infrastructure/providers/tmdb/watch-provider-cache';

const providers = [{ providerId: 9, name: 'Amazon Prime Video' }];

describe('cachedSeasonWatchProviders', () => {
  beforeEach(() => {
    clearSeasonWatchProviderCache();
  });

  it('loads once and serves later calls from the cache', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return providers;
    };

    expect(await cachedSeasonWatchProviders('550', 1, 'DE', load)).toEqual(
      providers
    );
    expect(await cachedSeasonWatchProviders('550', 1, 'DE', load)).toEqual(
      providers
    );
    expect(calls).toBe(1);
  });

  it('separates series, season and region', async () => {
    const calls: string[] = [];
    const load = async () => {
      calls.push('load');
      return providers;
    };

    await cachedSeasonWatchProviders('550', 1, 'DE', load);
    await cachedSeasonWatchProviders('551', 1, 'DE', load);
    await cachedSeasonWatchProviders('550', 2, 'DE', load);
    await cachedSeasonWatchProviders('550', 1, 'US', load);
    expect(calls).toHaveLength(4);

    await cachedSeasonWatchProviders('550', 1, 'de', load);
    expect(calls).toHaveLength(4);
  });

  it('reloads after the entry expired', async () => {
    let now = 1_000_000;
    let calls = 0;
    const load = async () => {
      calls += 1;
      return providers;
    };

    await cachedSeasonWatchProviders('550', 1, 'DE', load, () => now);
    now += 6 * 60 * 60 * 1000 - 1;
    await cachedSeasonWatchProviders('550', 1, 'DE', load, () => now);
    expect(calls).toBe(1);

    now += 2;
    await cachedSeasonWatchProviders('550', 1, 'DE', load, () => now);
    expect(calls).toBe(2);
  });

  it('does not cache failures', async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error('tmdb down');
    };

    await expect(
      cachedSeasonWatchProviders('550', 1, 'DE', failing)
    ).rejects.toThrow('tmdb down');
    await expect(
      cachedSeasonWatchProviders('550', 1, 'DE', failing)
    ).rejects.toThrow('tmdb down');
    expect(calls).toBe(2);
  });

  it('drops the oldest entry when the cap is exceeded', async () => {
    const load = async () => providers;

    for (let index = 0; index < 4001; index += 1) {
      await cachedSeasonWatchProviders(`series-${index}`, 1, 'DE', load);
    }

    let calls = 0;
    await cachedSeasonWatchProviders('series-4000', 1, 'DE', async () => {
      calls += 1;
      return providers;
    });
    expect(calls).toBe(0);

    await cachedSeasonWatchProviders('series-0', 1, 'DE', async () => {
      calls += 1;
      return providers;
    });
    expect(calls).toBe(1);
  });
});
