import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  DetailSeason,
  SeasonDiagnosticRow,
  SeriesDetailsDTO,
  SeriesDetailsRepository
} from '$lib/server/application/use-cases/get-series-details';
import { suggestedSeasonNumberFromDisplayName } from '$lib/server/domain/series/season-number-override';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

function isAired(airDate: string | null): boolean {
  return (
    !!airDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(airDate) &&
    airDate <= new Date().toISOString().slice(0, 10)
  );
}

function sortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function effectiveSeasonNumber(
  season: { id: string; seasonNumber: number | null },
  overrides: Map<string, number>
): number | null {
  return overrides.get(season.id) ?? season.seasonNumber;
}

function providerSourceUrl(
  provider: string | null | undefined,
  providerSeriesId: string | null | undefined,
  seasonNumber?: number
): string | null {
  if (!provider || !providerSeriesId) return null;

  if (provider === 'tmdb') {
    const seasonPath = seasonNumber ? `/season/${seasonNumber}` : '';
    return `https://www.themoviedb.org/tv/${encodeURIComponent(providerSeriesId)}${seasonPath}`;
  }

  if (provider === 'tvmaze') {
    return `https://www.tvmaze.com/shows/${encodeURIComponent(providerSeriesId)}`;
  }

  return null;
}

function providerLabel(provider: string | null | undefined): string | null {
  if (provider === 'tmdb') return 'TMDB';
  if (provider === 'tvmaze') return 'TVmaze';
  if (provider === 'tvdb') return 'TheTVDB';
  return null;
}

export class DrizzleSeriesDetailsRepository implements SeriesDetailsRepository {
  constructor(private readonly db: Db) {}

  async getSeriesDetails(id: string): Promise<SeriesDetailsDTO | undefined> {
    const row = this.db
      .select({
        id: schema.mediaEntities.id,
        jellyfinItemId: schema.mediaEntities.jellyfinItemId,
        name: schema.mediaEntities.name,
        originalTitle: schema.mediaEntities.originalTitle,
        productionYear: schema.mediaEntities.productionYear,
        primaryImageTag: schema.mediaEntities.primaryImageTag,
        lastSeenInJellyfinAt: schema.mediaEntities.lastSeenInJellyfinAt,
        metadataProvider: schema.localSeries.metadataProvider,
        metadataLastCheckedAt: schema.localSeries.metadataLastCheckedAt,
        metadataLastSuccessAt: schema.localSeries.metadataLastSuccessAt,
        metadataLastErrorAt: schema.localSeries.metadataLastErrorAt,
        metadataErrorCode: schema.localSeries.metadataErrorCode
      })
      .from(schema.mediaEntities)
      .innerJoin(
        schema.localSeries,
        eq(schema.localSeries.id, schema.mediaEntities.id)
      )
      .where(
        and(
          eq(schema.mediaEntities.id, id),
          isNull(schema.mediaEntities.removedFromJellyfinAt)
        )
      )
      .get();
    if (!row) return undefined;

    const externalState = this.db
      .select({
        id: schema.externalSeriesStates.id,
        provider: schema.externalSeriesStates.provider,
        providerSeriesId: schema.externalSeriesStates.providerSeriesId,
        normalizedStatus: schema.externalSeriesStates.normalizedStatus,
        providerRawStatus: schema.externalSeriesStates.providerRawStatus
      })
      .from(schema.externalSeriesStates)
      .where(eq(schema.externalSeriesStates.mediaEntityId, row.id))
      .orderBy(desc(schema.externalSeriesStates.fetchedAt))
      .get();
    const localSeasons = this.db
      .select({
        id: schema.localSeasons.id,
        seasonNumber: schema.localSeasons.seasonNumber
      })
      .from(schema.localSeasons)
      .where(
        and(
          eq(schema.localSeasons.parentSeriesId, row.id),
          isNull(schema.localSeasons.removedFromJellyfinAt)
        )
      )
      .all();
    const localSeasonDetails = this.db
      .select({
        id: schema.localSeasons.id,
        seasonNumber: schema.localSeasons.seasonNumber,
        displayName: schema.localSeasons.displayName,
        jellyfinItemId: schema.localSeasons.jellyfinItemId,
        premiereDate: schema.localSeasons.premiereDate
      })
      .from(schema.localSeasons)
      .where(
        and(
          eq(schema.localSeasons.parentSeriesId, row.id),
          isNull(schema.localSeasons.removedFromJellyfinAt)
        )
      )
      .all();
    const externalSeasons = externalState
      ? this.db
          .select({
            seasonNumber: schema.externalSeasons.seasonNumber,
            airDate: schema.externalSeasons.airDate
          })
          .from(schema.externalSeasons)
          .where(
            eq(schema.externalSeasons.externalSeriesStateId, externalState.id)
          )
          .all()
      : [];
    const overrides = new Map(
      this.db
        .select({
          localSeasonId: schema.localSeasonNumberOverrides.localSeasonId,
          mappedSeasonNumber:
            schema.localSeasonNumberOverrides.mappedSeasonNumber
        })
        .from(schema.localSeasonNumberOverrides)
        .where(eq(schema.localSeasonNumberOverrides.mediaEntityId, row.id))
        .all()
        .map((override) => [
          override.localSeasonId,
          override.mappedSeasonNumber
        ])
    );
    const localSeasonNumbers = sortedUnique(
      localSeasons
        .map((season) => effectiveSeasonNumber(season, overrides))
        .filter((season): season is number => season !== null && season > 0)
    );
    const externalSeasonNumbers = sortedUnique(
      externalSeasons
        .map((season) => season.seasonNumber)
        .filter((season) => season > 0)
    );
    const allSeasonNumbers = sortedUnique([
      ...localSeasonNumbers,
      ...externalSeasonNumbers
    ]);
    const ignored = !!this.db
      .select({ id: schema.ignoredSeries.mediaEntityId })
      .from(schema.ignoredSeries)
      .where(eq(schema.ignoredSeries.mediaEntityId, row.id))
      .get();
    const seasons: DetailSeason[] = allSeasonNumbers.map((seasonNumber) => {
      const external = externalSeasons.find(
        (season) => season.seasonNumber === seasonNumber
      );
      const local = localSeasonNumbers.includes(seasonNumber);
      return {
        seasonNumber,
        label: `S${String(seasonNumber).padStart(2, '0')}`,
        status: local
          ? 'local'
          : isAired(external?.airDate ?? null)
            ? 'missing'
            : 'upcoming',
        airDate: external?.airDate ?? null,
        sourceUrl: providerSourceUrl(
          externalState?.provider,
          externalState?.providerSeriesId,
          seasonNumber
        ),
        sourceLabel: providerLabel(externalState?.provider)
      };
    });
    const seasonDiagnostics: SeasonDiagnosticRow[] = [
      ...localSeasonDetails.map((season) => ({
        source: 'jellyfin' as const,
        seasonNumber: season.seasonNumber,
        mappedSeasonNumber: overrides.get(season.id) ?? null,
        label: season.displayName,
        itemId: season.jellyfinItemId,
        airDate: season.premiereDate
      })),
      ...externalSeasons.map((season) => ({
        source: 'metadata' as const,
        seasonNumber: season.seasonNumber,
        mappedSeasonNumber: null,
        label: `S${String(season.seasonNumber).padStart(2, '0')}`,
        itemId: externalState?.providerSeriesId ?? null,
        airDate: season.airDate
      }))
    ].sort((left, right) => {
      const source = left.source.localeCompare(right.source);
      if (source !== 0) return source;
      return (left.seasonNumber ?? -1) - (right.seasonNumber ?? -1);
    });
    const seasonOverrideSuggestions = localSeasonDetails.flatMap((season) => {
      if (overrides.has(season.id)) return [];
      const suggested = suggestedSeasonNumberFromDisplayName(
        season.displayName
      );
      if (
        suggested === null ||
        season.seasonNumber === suggested ||
        !externalSeasonNumbers.includes(suggested) ||
        localSeasonNumbers.includes(suggested)
      ) {
        return [];
      }

      return [
        {
          localSeasonId: season.id,
          originalSeasonNumber: season.seasonNumber,
          mappedSeasonNumber: suggested,
          displayName: season.displayName
        }
      ];
    });

    return {
      id: row.id,
      name: row.name,
      originalTitle: row.originalTitle,
      productionYear: row.productionYear,
      posterUrl: row.primaryImageTag
        ? `/poster/${encodeURIComponent(row.jellyfinItemId)}`
        : null,
      providerIds: this.db
        .select({
          provider: schema.mediaExternalIds.provider,
          externalId: schema.mediaExternalIds.externalId
        })
        .from(schema.mediaExternalIds)
        .where(eq(schema.mediaExternalIds.mediaEntityId, row.id))
        .all(),
      metadataProvider: row.metadataProvider,
      externalProvider: externalState?.provider ?? null,
      externalProviderSeriesId: externalState?.providerSeriesId ?? null,
      normalizedStatus: externalState?.normalizedStatus ?? 'unknown',
      providerRawStatus: externalState?.providerRawStatus ?? null,
      localSeasonNumbers,
      externalSeasonNumbers,
      seasons,
      seasonDiagnostics,
      seasonOverrideSuggestions,
      specialsCount: localSeasons.filter(
        (season) => season.seasonNumber === 0 && !overrides.has(season.id)
      ).length,
      lastSeenInJellyfinAt: row.lastSeenInJellyfinAt,
      metadataLastCheckedAt: row.metadataLastCheckedAt,
      metadataLastSuccessAt: row.metadataLastSuccessAt,
      metadataLastErrorAt: row.metadataLastErrorAt,
      metadataErrorCode: row.metadataErrorCode,
      ignored
    };
  }
}
