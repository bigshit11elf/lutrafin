import type {
  JellyfinEpisode,
  JellyfinMediaSource,
  JellyfinSeason,
  JellyfinSeries
} from '../ports/jellyfin-media-source';

export type SyncJellyfinLibraryResult = {
  syncRunId: string;
  seriesRead: number;
  seasonsRead: number;
  added: number;
  updated: number;
  removed: number;
};

export type SyncJellyfinRepository = {
  beginSyncRun(startedAt: string): Promise<string>;
  completeSyncRun(
    syncRunId: string,
    input: SyncJellyfinLibraryResult & { startedAt: string; finishedAt: string }
  ): Promise<void>;
  failSyncRun(
    syncRunId: string,
    finishedAt: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void>;
  reconcile(input: {
    scannedAt: string;
    series: JellyfinSeries[];
    seasonsBySeriesId: Map<string, JellyfinSeason[]>;
    episodesBySeriesId: Map<string, JellyfinEpisode[]>;
  }): Promise<Pick<SyncJellyfinLibraryResult, 'added' | 'updated' | 'removed'>>;
};

let runningSync: Promise<SyncJellyfinLibraryResult> | undefined;

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return 'Unknown Jellyfin sync error';
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name.slice(0, 100);
  }

  return 'JellyfinSyncFailed';
}

type SeriesGroup = {
  canonical: JellyfinSeries;
  members: JellyfinSeries[];
};

function canonicalSeriesKey(series: JellyfinSeries): string {
  const providerIds = Object.entries(series.providerIds).map(
    ([provider, value]) => [provider.toLowerCase(), value.trim().toLowerCase()]
  );

  for (const provider of ['tmdb', 'tvdb', 'imdb']) {
    const match = providerIds.find(
      ([candidateProvider, value]) =>
        candidateProvider === provider && value.length > 0
    );
    if (match) return `${provider}:${match[1]}`;
  }

  return `jellyfin:${series.jellyfinItemId}`;
}

function providerIdCount(series: JellyfinSeries): number {
  return Object.values(series.providerIds).filter(
    (value) => value.trim().length > 0
  ).length;
}

function mergeProviderIds(
  series: JellyfinSeries[]
): JellyfinSeries['providerIds'] {
  const merged: JellyfinSeries['providerIds'] = {};

  for (const item of series) {
    for (const [provider, value] of Object.entries(item.providerIds)) {
      if (value.trim().length > 0 && !merged[provider]) {
        merged[provider] = value;
      }
    }
  }

  return merged;
}

function groupSeries(series: JellyfinSeries[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();

  for (const item of series) {
    const key = canonicalSeriesKey(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { canonical: item, members: [item] });
      continue;
    }

    existing.members.push(item);
    if (providerIdCount(existing.canonical) < providerIdCount(item)) {
      existing.canonical = item;
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    canonical: {
      ...group.canonical,
      providerIds: mergeProviderIds(group.members)
    }
  }));
}

function uniqueSeasons(seasons: JellyfinSeason[]): JellyfinSeason[] {
  const byJellyfinItemId = new Map<string, JellyfinSeason>();
  for (const season of seasons) {
    byJellyfinItemId.set(season.jellyfinItemId, season);
  }
  return [...byJellyfinItemId.values()];
}

function uniqueEpisodes(episodes: JellyfinEpisode[]): JellyfinEpisode[] {
  const byJellyfinItemId = new Map<string, JellyfinEpisode>();
  for (const episode of episodes) {
    byJellyfinItemId.set(episode.jellyfinItemId, episode);
  }
  return [...byJellyfinItemId.values()];
}

export class SyncJellyfinLibrary {
  constructor(
    private readonly mediaSource: JellyfinMediaSource,
    private readonly repository: SyncJellyfinRepository,
    private readonly excludedLibraryIds: string[] = []
  ) {}

  execute(): Promise<SyncJellyfinLibraryResult> {
    if (runningSync) {
      return runningSync;
    }

    runningSync = this.executeInternal().finally(() => {
      runningSync = undefined;
    });

    return runningSync;
  }

  private async executeInternal(): Promise<SyncJellyfinLibraryResult> {
    const startedAt = new Date().toISOString();
    const syncRunId = await this.repository.beginSyncRun(startedAt);

    try {
      await this.mediaSource.getServerInfo();
      const seriesGroups = groupSeries(
        await this.mediaSource.getSeries(this.excludedLibraryIds)
      );
      const series = seriesGroups.map((group) => group.canonical);
      const seasonsBySeriesId = new Map<string, JellyfinSeason[]>();
      const episodesBySeriesId = new Map<string, JellyfinEpisode[]>();
      let seasonsRead = 0;

      for (const group of seriesGroups) {
        const seasons: JellyfinSeason[] = [];
        const episodes: JellyfinEpisode[] = [];
        for (const item of group.members) {
          const itemSeasons = await this.mediaSource.getSeasons(
            item.jellyfinItemId
          );
          seasons.push(...itemSeasons);
          seasonsRead += itemSeasons.length;
          for (const season of itemSeasons) {
            episodes.push(
              ...(await this.mediaSource.getEpisodes(
                item.jellyfinItemId,
                season.jellyfinItemId
              ))
            );
          }
        }
        seasonsBySeriesId.set(
          group.canonical.jellyfinItemId,
          uniqueSeasons(seasons)
        );
        episodesBySeriesId.set(
          group.canonical.jellyfinItemId,
          uniqueEpisodes(episodes)
        );
      }

      const reconciliation = await this.repository.reconcile({
        scannedAt: startedAt,
        series,
        seasonsBySeriesId,
        episodesBySeriesId
      });

      const result: SyncJellyfinLibraryResult = {
        syncRunId,
        seriesRead: series.length,
        seasonsRead,
        ...reconciliation
      };

      await this.repository.completeSyncRun(syncRunId, {
        ...result,
        startedAt,
        finishedAt: new Date().toISOString()
      });

      return result;
    } catch (error) {
      await this.repository.failSyncRun(
        syncRunId,
        new Date().toISOString(),
        safeErrorCode(error),
        safeErrorMessage(error)
      );
      throw error;
    }
  }
}
