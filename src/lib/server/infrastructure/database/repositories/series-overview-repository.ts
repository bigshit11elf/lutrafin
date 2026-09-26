import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  SeriesOverviewItem,
  SeriesOverviewRepository
} from '$lib/server/application/use-cases/get-series-overview';
import { compareSeasons } from '$lib/server/domain/series/season-comparison';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

function sortedRegularSeasonNumbers(values: Array<number | null>): number[] {
  return [
    ...new Set(
      values.filter(
        (value): value is number =>
          value !== null && Number.isInteger(value) && value > 0
      )
    )
  ].sort((left, right) => left - right);
}

function effectiveSeasonNumber(
  season: { id: string; seasonNumber: number | null },
  overrides: Map<string, number>
): number | null {
  return overrides.get(season.id) ?? season.seasonNumber;
}

export class DrizzleSeriesOverviewRepository implements SeriesOverviewRepository {
  constructor(private readonly db: Db) {}

  async getSeriesOverview(): Promise<SeriesOverviewItem[]> {
    const rows = this.db
      .select({
        id: schema.mediaEntities.id,
        jellyfinItemId: schema.mediaEntities.jellyfinItemId,
        name: schema.mediaEntities.name,
        originalTitle: schema.mediaEntities.originalTitle,
        productionYear: schema.mediaEntities.productionYear,
        primaryImageTag: schema.mediaEntities.primaryImageTag,
        metadataProvider: schema.localSeries.metadataProvider,
        metadataLastCheckedAt: schema.localSeries.metadataLastCheckedAt,
        metadataLastErrorAt: schema.localSeries.metadataLastErrorAt,
        metadataMatchStatus: schema.localSeries.metadataMatchStatus,
        removedFromJellyfinAt: schema.mediaEntities.removedFromJellyfinAt,
        lastSeenInJellyfinAt: schema.mediaEntities.lastSeenInJellyfinAt
      })
      .from(schema.mediaEntities)
      .innerJoin(
        schema.localSeries,
        eq(schema.localSeries.id, schema.mediaEntities.id)
      )
      .where(eq(schema.mediaEntities.mediaType, 'series'))
      .orderBy(schema.mediaEntities.sortName, schema.mediaEntities.name)
      .all();

    return rows.map((row) => {
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
      const localSeasonNumbers = sortedRegularSeasonNumbers(
        localSeasons.map((season) => effectiveSeasonNumber(season, overrides))
      );
      const comparison = compareSeasons(
        localSeasonNumbers.map((seasonNumber) => ({ seasonNumber })),
        this.externalSeasonsFor(row.id)
      );
      const externalState = this.externalStateFor(row.id);
      const metadataHealth = row.metadataLastErrorAt
        ? 'error'
        : row.metadataMatchStatus === 'unresolved' && row.metadataLastCheckedAt
          ? 'unresolved'
          : row.metadataLastCheckedAt
            ? 'ok'
            : 'not_checked';
      const ignored = !!this.db
        .select({ id: schema.ignoredSeries.mediaEntityId })
        .from(schema.ignoredSeries)
        .where(eq(schema.ignoredSeries.mediaEntityId, row.id))
        .get();

      return {
        id: row.id,
        name: row.name,
        originalTitle: row.originalTitle,
        productionYear: row.productionYear,
        posterUrl: row.primaryImageTag
          ? `/poster/${encodeURIComponent(row.jellyfinItemId)}`
          : null,
        normalizedStatus: externalState?.normalizedStatus ?? 'unknown',
        localSeasonNumbers,
        comparableLocalSeasonNumbers: comparison.comparableLocalSeasonNumbers,
        localMaxSeason: comparison.localMaxRegularSeason,
        latestAiredSeason: comparison.externalLatestAiredSeason,
        latestKnownSeason: comparison.externalLatestKnownSeason,
        missingSeasonNumbers: comparison.missingSeasonNumbers,
        announcedSeasonNumbers: comparison.announcedSeasonNumbers,
        hasNewAiredSeason: comparison.hasNewAiredSeason,
        hasAnnouncedFutureSeason: comparison.hasAnnouncedFutureSeason,
        metadataProvider: row.metadataProvider,
        externalProvider: externalState?.provider ?? null,
        externalProviderSeriesId: externalState?.providerSeriesId ?? null,
        metadataLastCheckedAt: row.metadataLastCheckedAt,
        metadataHealth,
        ignored,
        removedFromJellyfinAt: row.removedFromJellyfinAt,
        lastSeenInJellyfinAt: row.lastSeenInJellyfinAt
      } satisfies SeriesOverviewItem;
    });
  }

  private externalStateFor(mediaEntityId: string):
    | {
        provider: string;
        providerSeriesId: string;
        normalizedStatus: SeriesOverviewItem['normalizedStatus'];
      }
    | undefined {
    return this.db
      .select({
        provider: schema.externalSeriesStates.provider,
        providerSeriesId: schema.externalSeriesStates.providerSeriesId,
        normalizedStatus: schema.externalSeriesStates.normalizedStatus
      })
      .from(schema.externalSeriesStates)
      .where(eq(schema.externalSeriesStates.mediaEntityId, mediaEntityId))
      .orderBy(desc(schema.externalSeriesStates.fetchedAt))
      .get();
  }

  private externalSeasonsFor(
    mediaEntityId: string
  ): Array<{ seasonNumber: number; airDate: string | null }> {
    const state = this.db
      .select({ id: schema.externalSeriesStates.id })
      .from(schema.externalSeriesStates)
      .where(eq(schema.externalSeriesStates.mediaEntityId, mediaEntityId))
      .orderBy(desc(schema.externalSeriesStates.fetchedAt))
      .get();
    if (!state) {
      return [];
    }

    return this.db
      .select({
        seasonNumber: schema.externalSeasons.seasonNumber,
        airDate: schema.externalSeasons.airDate
      })
      .from(schema.externalSeasons)
      .where(eq(schema.externalSeasons.externalSeriesStateId, state.id))
      .all();
  }
}
