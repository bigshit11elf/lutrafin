import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderRateLimited } from '../src/lib/server/errors/domain-errors';
import { supportedStreamingProviders } from '../src/lib/server/infrastructure/database/repositories/settings-repository';
import { clearSeasonWatchProviderCache } from '../src/lib/server/infrastructure/providers/tmdb/watch-provider-cache';
import {
  resolveEpisodeCheckStreamingGroups,
  type EpisodeCheckStreamingSeries
} from '../src/lib/server/streaming/episode-check-availability';

const netflix = supportedStreamingProviders.find(
  (provider) => provider.id === 'netflix'
)!;

function series(
  seriesId: string,
  seasonNumbers: number[],
  externalProvider: string | null = 'tmdb'
): EpisodeCheckStreamingSeries {
  return {
    seriesId,
    externalProvider,
    externalProviderSeriesId: externalProvider ? `tmdb-${seriesId}` : null,
    seasonNumbers
  };
}

const baseOptions = {
  enabledProviders: [netflix],
  region: 'DE',
  unavailableLabel: 'Unavailable / unknown',
  concurrency: 4,
  sleep: async () => {}
};

describe('resolveEpisodeCheckStreamingGroups', () => {
  beforeEach(() => {
    clearSeasonWatchProviderCache();
  });

  it('groups series by the providers that stream them', async () => {
    const groups = await resolveEpisodeCheckStreamingGroups(
      [series('a', [1]), series('b', [1])],
      {
        ...baseOptions,
        load: async (providerSeriesId) =>
          providerSeriesId === 'tmdb-a'
            ? [{ providerId: 8, name: 'Netflix' }]
            : []
      }
    );

    expect(groups).toEqual([
      { id: 'netflix', label: 'Netflix', seriesIds: ['a'] },
      { id: 'unavailable', label: 'Unavailable / unknown', seriesIds: ['b'] }
    ]);
  });

  it('requests every season of every series exactly once', async () => {
    const calls: string[] = [];

    await resolveEpisodeCheckStreamingGroups(
      [series('a', [1, 2, 3]), series('b', [1])],
      {
        ...baseOptions,
        load: async (providerSeriesId, seasonNumber) => {
          calls.push(`${providerSeriesId}#${seasonNumber}`);
          return [];
        }
      }
    );

    expect(calls.sort()).toEqual([
      'tmdb-a#1',
      'tmdb-a#2',
      'tmdb-a#3',
      'tmdb-b#1'
    ]);
  });

  it('keeps the tmdb request concurrency within the limit', async () => {
    let running = 0;
    let peak = 0;

    await resolveEpisodeCheckStreamingGroups(
      Array.from({ length: 30 }, (_, index) => series(`s${index}`, [1, 2])),
      {
        ...baseOptions,
        concurrency: 3,
        load: async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 1));
          running -= 1;
          return [];
        }
      }
    );

    expect(peak).toBe(3);
  });

  it('serves repeated seasons from the cache', async () => {
    let calls = 0;

    const load = async () => {
      calls += 1;
      return [{ providerId: 8, name: 'Netflix' }];
    };

    await resolveEpisodeCheckStreamingGroups([series('a', [1])], {
      ...baseOptions,
      load
    });
    await resolveEpisodeCheckStreamingGroups([series('a', [1])], {
      ...baseOptions,
      load
    });

    expect(calls).toBe(1);
  });

  it('retries once when tmdb rate limits and then succeeds', async () => {
    let calls = 0;
    const delays: number[] = [];

    const groups = await resolveEpisodeCheckStreamingGroups(
      [series('a', [1])],
      {
        ...baseOptions,
        sleep: async (ms) => {
          delays.push(ms);
        },
        load: async () => {
          calls += 1;
          if (calls === 1) throw new ProviderRateLimited('tmdb');
          return [{ providerId: 8, name: 'Netflix' }];
        }
      }
    );

    expect(calls).toBe(2);
    expect(delays).toEqual([1000]);
    expect(groups[0]?.seriesIds).toEqual(['a']);
  });

  it('marks a series as unavailable when the lookup keeps failing', async () => {
    const groups = await resolveEpisodeCheckStreamingGroups(
      [series('a', [1])],
      {
        ...baseOptions,
        load: async () => {
          throw new ProviderRateLimited('tmdb');
        }
      }
    );

    expect(groups).toEqual([
      { id: 'unavailable', label: 'Unavailable / unknown', seriesIds: ['a'] }
    ]);
  });

  it('does not query tmdb for series without a tmdb id', async () => {
    let calls = 0;

    const groups = await resolveEpisodeCheckStreamingGroups(
      [series('a', [1], null)],
      {
        ...baseOptions,
        load: async () => {
          calls += 1;
          return [{ providerId: 8, name: 'Netflix' }];
        }
      }
    );

    expect(calls).toBe(0);
    expect(groups[0]?.id).toBe('unavailable');
  });
});
