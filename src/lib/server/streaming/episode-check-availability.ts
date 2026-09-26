import { ProviderRateLimited } from '$lib/server/errors/domain-errors';
import { loadConfig } from '$lib/server/config/app-config';
import { mapWithConcurrency } from '$lib/server/http/concurrency';
import { cachedSeasonWatchProviders } from '$lib/server/infrastructure/providers/tmdb/watch-provider-cache';
import type { TmdbWatchProvider } from '$lib/server/infrastructure/providers/tmdb/tmdb-provider';
import {
  availableStreamingProviderIds,
  type StreamingProviderDefinition
} from './availability';

export type EpisodeCheckStreamingSeries = {
  seriesId: string;
  externalProvider: string | null;
  externalProviderSeriesId: string | null;
  seasonNumbers: number[];
};

export type StreamingEpisodeGroup = {
  id: string;
  label: string;
  seriesIds: string[];
};

export const tmdbWatchProviderConcurrency = 5;

const rateLimitRetryDelayMs = 1_000;

function debugAvailability(message: string, context: Record<string, unknown>) {
  if (loadConfig().logLevel !== 'debug') return;
  console.debug(
    JSON.stringify({
      level: 'debug',
      component: 'episode-check-availability',
      message,
      ...context
    })
  );
}

type WatchProviderLoader = (
  providerSeriesId: string,
  seasonNumber: number
) => Promise<TmdbWatchProvider[]>;

async function loadWithRateLimitRetry(
  load: () => Promise<TmdbWatchProvider[]>,
  sleep: (ms: number) => Promise<void>
): Promise<TmdbWatchProvider[]> {
  try {
    return await load();
  } catch (error) {
    if (!(error instanceof ProviderRateLimited)) throw error;
    await sleep(rateLimitRetryDelayMs);
    return await load();
  }
}

export async function resolveEpisodeCheckStreamingGroups(
  series: EpisodeCheckStreamingSeries[],
  options: {
    enabledProviders: StreamingProviderDefinition[];
    region: string;
    unavailableLabel: string;
    load: WatchProviderLoader;
    concurrency?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  }
): Promise<StreamingEpisodeGroup[]> {
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const tasks = series.flatMap((entry) =>
    entry.externalProvider === 'tmdb' && entry.externalProviderSeriesId
      ? entry.seasonNumbers.map((seasonNumber) => ({
          seriesId: entry.seriesId,
          providerSeriesId: entry.externalProviderSeriesId!,
          seasonNumber
        }))
      : []
  );

  const watchProvidersBySeries = new Map<string, TmdbWatchProvider[]>();
  await mapWithConcurrency(
    tasks,
    options.concurrency ?? tmdbWatchProviderConcurrency,
    async (task) => {
      try {
        const providers = await cachedSeasonWatchProviders(
          task.providerSeriesId,
          task.seasonNumber,
          options.region,
          () =>
            loadWithRateLimitRetry(
              () => options.load(task.providerSeriesId, task.seasonNumber),
              sleep
            ),
          now
        );
        const existing = watchProvidersBySeries.get(task.seriesId) ?? [];
        existing.push(...providers);
        watchProvidersBySeries.set(task.seriesId, existing);
      } catch (error) {
        debugAvailability('watch-provider lookup failed', {
          seriesId: task.seriesId,
          seasonNumber: task.seasonNumber,
          error: error instanceof Error ? error.name : 'unknown'
        });
      }
    }
  );

  const labels = new Map<string, string>(
    options.enabledProviders.map((provider) => [provider.id, provider.label])
  );
  const groups = new Map<string, StreamingEpisodeGroup>();
  const unavailable: StreamingEpisodeGroup = {
    id: 'unavailable',
    label: options.unavailableLabel,
    seriesIds: []
  };

  for (const entry of series) {
    const available = availableStreamingProviderIds(
      watchProvidersBySeries.get(entry.seriesId) ?? [],
      options.enabledProviders
    );
    if (available.length === 0) {
      unavailable.seriesIds.push(entry.seriesId);
      continue;
    }
    for (const providerId of available) {
      const group = groups.get(providerId) ?? {
        id: providerId,
        label: labels.get(providerId) ?? providerId,
        seriesIds: []
      };
      group.seriesIds.push(entry.seriesId);
      groups.set(providerId, group);
    }
  }

  return [
    ...groups.values(),
    ...(unavailable.seriesIds.length > 0 ? [unavailable] : [])
  ];
}
