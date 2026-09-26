import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import * as schema from '$lib/server/infrastructure/database/schema';
import { streamingProviderAvailability } from '$lib/server/streaming/availability';
import { TmdbSeriesMetadataProvider } from '$lib/server/infrastructure/providers/tmdb/tmdb-provider';

type MissingEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string | null;
  airDate: string;
};

type MissingSeason = {
  seasonNumber: number;
  episodes: MissingEpisode[];
};

type MissingSeries = {
  seriesId: string;
  seriesName: string;
  productionYear: number | null;
  posterUrl: string | null;
  missingCount: number;
  seasons: MissingSeason[];
  overrides: MissingEpisode[];
  externalProvider: string | null;
  externalProviderSeriesId: string | null;
};

type StreamingEpisodeGroup = {
  id: string;
  label: string;
  seriesIds: string[];
};

function episodeKey(
  seriesId: string,
  seasonNumber: number | null,
  episodeNumber: number | null
): string | null {
  if (
    !seasonNumber ||
    seasonNumber <= 0 ||
    !episodeNumber ||
    episodeNumber <= 0
  )
    return null;
  return `${seriesId}:${seasonNumber}:${episodeNumber}`;
}

export const load: PageServerLoad = async ({ cookies }) => {
  const db = getDatabase();
  const settings = new SettingsRepository(db);
  const dictionary = getDictionary(settings.getLanguage());
  const today = new Date().toISOString().slice(0, 10);

  const overrides = new Map(
    db
      .select({
        localSeasonId: schema.localSeasonNumberOverrides.localSeasonId,
        mappedSeasonNumber: schema.localSeasonNumberOverrides.mappedSeasonNumber
      })
      .from(schema.localSeasonNumberOverrides)
      .all()
      .map((row) => [row.localSeasonId, row.mappedSeasonNumber])
  );

  const localKeys = new Set<string>();
  const localSeasonKeys = new Set<string>();
  const overridesBySeries = new Map<string, MissingEpisode[]>();
  const overridesByKey = new Map<string, MissingEpisode>();
  for (const override of db
    .select({
      mediaEntityId: schema.episodePresenceOverrides.mediaEntityId,
      seasonNumber: schema.episodePresenceOverrides.seasonNumber,
      episodeNumber: schema.episodePresenceOverrides.episodeNumber
    })
    .from(schema.episodePresenceOverrides)
    .all()) {
    const key = `${override.mediaEntityId}:${override.seasonNumber}:${override.episodeNumber}`;
    localKeys.add(key);
    const seriesOverrides = overridesBySeries.get(override.mediaEntityId) ?? [];
    const entry = {
      seasonNumber: override.seasonNumber,
      episodeNumber: override.episodeNumber,
      episodeName: null,
      airDate: ''
    };
    seriesOverrides.push(entry);
    overridesByKey.set(key, entry);
    overridesBySeries.set(override.mediaEntityId, seriesOverrides);
  }
  for (const episode of db
    .select({
      seriesId: schema.localEpisodes.parentSeriesId,
      parentSeasonId: schema.localEpisodes.parentSeasonId,
      seasonNumber: schema.localEpisodes.seasonNumber,
      episodeNumber: schema.localEpisodes.episodeNumber
    })
    .from(schema.localEpisodes)
    .where(isNull(schema.localEpisodes.removedFromJellyfinAt))
    .all()) {
    const key = episodeKey(
      episode.seriesId,
      episode.parentSeasonId
        ? (overrides.get(episode.parentSeasonId) ?? episode.seasonNumber)
        : episode.seasonNumber,
      episode.episodeNumber
    );
    if (key) localKeys.add(key);
    const seasonNumber = episode.parentSeasonId
      ? (overrides.get(episode.parentSeasonId) ?? episode.seasonNumber)
      : episode.seasonNumber;
    if (seasonNumber && seasonNumber > 0 && episode.episodeNumber) {
      localSeasonKeys.add(`${episode.seriesId}:${seasonNumber}`);
    }
  }

  const missingBySeries = new Map<string, MissingSeries>();
  for (const episode of db
    .select({
      seriesId: schema.mediaEntities.id,
      jellyfinItemId: schema.mediaEntities.jellyfinItemId,
      seriesName: schema.mediaEntities.name,
      productionYear: schema.mediaEntities.productionYear,
      primaryImageTag: schema.mediaEntities.primaryImageTag,
      externalProvider: schema.externalSeriesStates.provider,
      externalProviderSeriesId: schema.externalSeriesStates.providerSeriesId,
      seasonNumber: schema.externalEpisodes.seasonNumber,
      episodeNumber: schema.externalEpisodes.episodeNumber,
      episodeName: schema.externalEpisodes.name,
      airDate: schema.externalEpisodes.airDate
    })
    .from(schema.externalEpisodes)
    .innerJoin(
      schema.externalSeriesStates,
      eq(
        schema.externalSeriesStates.id,
        schema.externalEpisodes.externalSeriesStateId
      )
    )
    .innerJoin(
      schema.mediaEntities,
      eq(schema.mediaEntities.id, schema.externalSeriesStates.mediaEntityId)
    )
    .leftJoin(
      schema.ignoredSeries,
      eq(schema.ignoredSeries.mediaEntityId, schema.mediaEntities.id)
    )
    .where(
      and(
        eq(schema.mediaEntities.mediaType, 'series'),
        isNull(schema.mediaEntities.removedFromJellyfinAt),
        isNull(schema.ignoredSeries.mediaEntityId)
      )
    )
    .all()) {
    if (!episode.airDate || episode.airDate > today) continue;
    if (!localSeasonKeys.has(`${episode.seriesId}:${episode.seasonNumber}`)) {
      continue;
    }
    const key = episodeKey(
      episode.seriesId,
      episode.seasonNumber,
      episode.episodeNumber
    );
    const override = key ? overridesByKey.get(key) : undefined;
    if (override) {
      override.episodeName = episode.episodeName;
      override.airDate = episode.airDate;
    }
    if (!key || localKeys.has(key)) continue;
    const series = missingBySeries.get(episode.seriesId) ?? {
      seriesId: episode.seriesId,
      seriesName: episode.seriesName,
      productionYear: episode.productionYear,
      posterUrl: episode.primaryImageTag
        ? `/poster/${encodeURIComponent(episode.jellyfinItemId)}`
        : null,
      missingCount: 0,
      seasons: [],
      overrides: overridesBySeries.get(episode.seriesId) ?? [],
      externalProvider: episode.externalProvider,
      externalProviderSeriesId: episode.externalProviderSeriesId
    };
    let season = series.seasons.find(
      (candidate) => candidate.seasonNumber === episode.seasonNumber
    );
    if (!season) {
      season = { seasonNumber: episode.seasonNumber, episodes: [] };
      series.seasons.push(season);
    }
    season.episodes.push({
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      episodeName: episode.episodeName,
      airDate: episode.airDate
    });
    series.missingCount += 1;
    missingBySeries.set(episode.seriesId, series);
  }

  const missing = [...missingBySeries.values()];
  for (const series of missing) {
    series.seasons.sort(
      (left, right) => left.seasonNumber - right.seasonNumber
    );
    for (const season of series.seasons) {
      season.episodes.sort(
        (left, right) => left.episodeNumber - right.episodeNumber
      );
    }
    series.overrides.sort(
      (left, right) =>
        left.seasonNumber - right.seasonNumber ||
        left.episodeNumber - right.episodeNumber
    );
  }

  missing.sort(
    (left, right) =>
      left.seriesName.localeCompare(right.seriesName) ||
      (left.productionYear ?? 0) - (right.productionYear ?? 0)
  );

  const streamingGroups: StreamingEpisodeGroup[] = [];
  const config = loadConfig();
  if (
    settings.getStreamingAvailabilityEnabled() &&
    config.providers.tmdbApiToken &&
    missing.length > 0
  ) {
    const groups = new Map<string, StreamingEpisodeGroup>();
    const unavailable: StreamingEpisodeGroup = {
      id: 'unavailable',
      label: dictionary.unavailableOrUnknown,
      seriesIds: []
    };
    const tmdb = new TmdbSeriesMetadataProvider({
      apiToken: config.providers.tmdbApiToken
    });
    await Promise.all(
      missing.map(async (series) => {
        let availability = streamingProviderAvailability([], settings);
        if (
          series.externalProvider === 'tmdb' &&
          series.externalProviderSeriesId
        ) {
          try {
            availability = streamingProviderAvailability(
              (
                await Promise.all(
                  series.seasons.map((season) =>
                    tmdb.getSeasonWatchProviders(
                      series.externalProviderSeriesId!,
                      season.seasonNumber,
                      settings.getRegion()
                    )
                  )
                )
              ).flat(),
              settings
            );
          } catch {
            availability = streamingProviderAvailability([], settings);
          }
        }
        const available = availability.filter((provider) => provider.available);
        if (available.length === 0) {
          unavailable.seriesIds.push(series.seriesId);
          return;
        }
        for (const provider of available) {
          const group = groups.get(provider.id) ?? {
            id: provider.id,
            label: provider.label,
            seriesIds: []
          };
          group.seriesIds.push(series.seriesId);
          groups.set(provider.id, group);
        }
      })
    );
    streamingGroups.push(
      ...groups.values(),
      ...(unavailable.seriesIds.length > 0 ? [unavailable] : [])
    );
  }

  return {
    admin: isAdminSession(cookies),
    t: dictionary,
    missing,
    streamingGroups,
    streamingGroupingAvailable: streamingGroups.length > 0
  };
};
