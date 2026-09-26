import { and, eq, isNull, lte, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  MetadataRefreshCandidate,
  RefreshSeriesMetadataRepository
} from '$lib/server/application/use-cases/refresh-series-metadata';
import type { ExternalSeriesMetadata } from '$lib/server/application/ports/series-metadata-provider';
import { SettingsRepository } from './settings-repository';
import { NotificationRepository } from './notification-repository';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

function stableId(prefix: string, value: string): string {
  return `${prefix}_${value}`;
}

type SeasonSnapshot = {
  seasonNumber: number;
  airDate: string | null;
};

function seasonEventType(
  season: SeasonSnapshot,
  previous: SeasonSnapshot | undefined,
  today: string
): 'season_announced' | 'season_released' | null {
  if (!season.airDate) return null;
  if (season.airDate > today) {
    return previous ? null : 'season_announced';
  }
  if (!previous || !previous.airDate || previous.airDate > today) {
    return 'season_released';
  }
  return null;
}

export class DrizzleMetadataRefreshRepository implements RefreshSeriesMetadataRepository {
  constructor(private readonly db: Db) {}

  async getCandidate(
    mediaEntityId: string
  ): Promise<MetadataRefreshCandidate | undefined> {
    const row = this.db
      .select({
        mediaEntityId: schema.mediaEntities.id,
        name: schema.mediaEntities.name,
        originalTitle: schema.mediaEntities.originalTitle,
        productionYear: schema.mediaEntities.productionYear
      })
      .from(schema.mediaEntities)
      .where(
        and(
          eq(schema.mediaEntities.id, mediaEntityId),
          isNull(schema.mediaEntities.removedFromJellyfinAt)
        )
      )
      .get();

    if (!row) {
      return undefined;
    }

    return { ...row, externalIds: this.externalIdsFor(mediaEntityId) };
  }

  async getDueCandidates(
    limit: number,
    now: string
  ): Promise<MetadataRefreshCandidate[]> {
    const rows = this.db
      .select({
        mediaEntityId: schema.mediaEntities.id,
        name: schema.mediaEntities.name,
        originalTitle: schema.mediaEntities.originalTitle,
        productionYear: schema.mediaEntities.productionYear
      })
      .from(schema.mediaEntities)
      .innerJoin(
        schema.localSeries,
        eq(schema.localSeries.id, schema.mediaEntities.id)
      )
      .where(
        and(
          eq(schema.mediaEntities.mediaType, 'series'),
          isNull(schema.mediaEntities.removedFromJellyfinAt),
          or(
            isNull(schema.localSeries.metadataNextCheckAt),
            lte(schema.localSeries.metadataNextCheckAt, now)
          )
        )
      )
      .limit(limit)
      .all();

    return rows.map((row) => ({
      ...row,
      externalIds: this.externalIdsFor(row.mediaEntityId)
    }));
  }

  async getAllCandidates(limit: number): Promise<MetadataRefreshCandidate[]> {
    const rows = this.db
      .select({
        mediaEntityId: schema.mediaEntities.id,
        name: schema.mediaEntities.name,
        originalTitle: schema.mediaEntities.originalTitle,
        productionYear: schema.mediaEntities.productionYear
      })
      .from(schema.mediaEntities)
      .innerJoin(
        schema.localSeries,
        eq(schema.localSeries.id, schema.mediaEntities.id)
      )
      .where(
        and(
          eq(schema.mediaEntities.mediaType, 'series'),
          isNull(schema.mediaEntities.removedFromJellyfinAt)
        )
      )
      .limit(limit)
      .all();

    return rows.map((row) => ({
      ...row,
      externalIds: this.externalIdsFor(row.mediaEntityId)
    }));
  }

  async saveSuccess(input: {
    mediaEntityId: string;
    provider: string;
    matchMethod: 'exact_external_id' | 'cross_provider_id' | 'exact_name_year';
    metadata: ExternalSeriesMetadata;
    checkedAt: string;
    nextCheckAt: string;
  }): Promise<void> {
    const stateId = stableId(
      'external_state',
      `${input.mediaEntityId}_${input.provider}`
    );
    const previousSeasons = new Map(
      this.db
        .select({
          seasonNumber: schema.externalSeasons.seasonNumber,
          airDate: schema.externalSeasons.airDate
        })
        .from(schema.externalSeasons)
        .where(eq(schema.externalSeasons.externalSeriesStateId, stateId))
        .all()
        .map((season) => [season.seasonNumber, season])
    );
    const notificationRepository = new NotificationRepository(this.db);
    const settings = new SettingsRepository(this.db);
    const hasBaseline = notificationRepository.hasBaseline(
      input.mediaEntityId,
      input.provider
    );
    const eventTypes = new Set(settings.getNotificationEventTypes());
    const today = input.checkedAt.slice(0, 10);
    const series = this.db
      .select({
        name: schema.mediaEntities.name,
        ignored: schema.ignoredSeries.mediaEntityId
      })
      .from(schema.mediaEntities)
      .leftJoin(
        schema.ignoredSeries,
        eq(schema.ignoredSeries.mediaEntityId, schema.mediaEntities.id)
      )
      .where(eq(schema.mediaEntities.id, input.mediaEntityId))
      .get();

    this.db.transaction((tx) => {
      tx.update(schema.localSeries)
        .set({
          metadataProvider: input.provider,
          metadataMatchStatus: input.matchMethod,
          metadataLastCheckedAt: input.checkedAt,
          metadataNextCheckAt: input.nextCheckAt,
          metadataLastSuccessAt: input.checkedAt,
          metadataLastErrorAt: null,
          metadataErrorCode: null
        })
        .where(eq(schema.localSeries.id, input.mediaEntityId))
        .run();

      tx.insert(schema.externalSeriesStates)
        .values({
          id: stateId,
          mediaEntityId: input.mediaEntityId,
          provider: input.provider,
          providerSeriesId: input.metadata.providerSeriesId,
          providerRawStatus: input.metadata.providerRawStatus,
          normalizedStatus: input.metadata.normalizedStatus,
          firstAirDate: input.metadata.firstAirDate,
          lastAirDate: input.metadata.lastAirDate,
          fetchedAt: input.checkedAt,
          rawData: input.metadata.rawData
        })
        .onConflictDoUpdate({
          target: [
            schema.externalSeriesStates.mediaEntityId,
            schema.externalSeriesStates.provider
          ],
          set: {
            providerSeriesId: input.metadata.providerSeriesId,
            providerRawStatus: input.metadata.providerRawStatus,
            normalizedStatus: input.metadata.normalizedStatus,
            firstAirDate: input.metadata.firstAirDate,
            lastAirDate: input.metadata.lastAirDate,
            fetchedAt: input.checkedAt,
            rawData: input.metadata.rawData
          }
        })
        .run();

      tx.delete(schema.externalSeasons)
        .where(eq(schema.externalSeasons.externalSeriesStateId, stateId))
        .run();
      tx.delete(schema.externalEpisodes)
        .where(eq(schema.externalEpisodes.externalSeriesStateId, stateId))
        .run();
      for (const season of input.metadata.seasons) {
        tx.insert(schema.externalSeasons)
          .values({
            id: stableId(
              'external_season',
              `${stateId}_${season.seasonNumber}`
            ),
            externalSeriesStateId: stateId,
            seasonNumber: season.seasonNumber,
            name: season.name,
            airDate: season.airDate,
            episodeCount: season.episodeCount,
            fetchedAt: input.checkedAt
          })
          .run();

        for (const episode of season.episodes) {
          tx.insert(schema.externalEpisodes)
            .values({
              id: stableId(
                'external_episode',
                `${stateId}_${episode.seasonNumber}_${episode.episodeNumber}`
              ),
              externalSeriesStateId: stateId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              name: episode.name,
              airDate: episode.airDate,
              fetchedAt: input.checkedAt
            })
            .run();
        }
      }

      tx.insert(schema.providerLookups)
        .values({
          id: crypto.randomUUID(),
          mediaEntityId: input.mediaEntityId,
          provider: input.provider,
          matchMethod: input.matchMethod,
          providerSeriesId: input.metadata.providerSeriesId,
          successful: true,
          fetchedAt: input.checkedAt,
          nextRefreshAt: input.nextCheckAt,
          errorCode: null
        })
        .run();

      if (!hasBaseline) {
        tx.insert(schema.notificationBaselines)
          .values({
            mediaEntityId: input.mediaEntityId,
            provider: input.provider,
            baselineAt: input.checkedAt
          })
          .onConflictDoNothing()
          .run();
        return;
      }

      if (!series || series.ignored) return;

      for (const season of input.metadata.seasons) {
        if (season.seasonNumber <= 0) continue;
        const eventType = seasonEventType(
          { seasonNumber: season.seasonNumber, airDate: season.airDate },
          previousSeasons.get(season.seasonNumber),
          today
        );
        if (!eventType || !eventTypes.has(eventType)) continue;
        tx.insert(schema.notificationEvents)
          .values({
            id: crypto.randomUUID(),
            eventKey: `${eventType}:${input.mediaEntityId}:season:${season.seasonNumber}`,
            eventType,
            mediaEntityId: input.mediaEntityId,
            seriesName: series.name,
            seasonNumber: season.seasonNumber,
            airDate: season.airDate,
            metadataRunId: input.checkedAt,
            createdAt: input.checkedAt
          })
          .onConflictDoNothing()
          .run();
      }
    });
  }

  async saveUnresolved(input: {
    mediaEntityId: string;
    provider: string;
    checkedAt: string;
    nextCheckAt: string;
    reason: string;
  }): Promise<void> {
    this.db.transaction((tx) => {
      tx.update(schema.localSeries)
        .set({
          metadataProvider: input.provider,
          metadataMatchStatus: 'unresolved',
          metadataLastCheckedAt: input.checkedAt,
          metadataNextCheckAt: input.nextCheckAt,
          metadataLastErrorAt: input.checkedAt,
          metadataErrorCode: 'MetadataUnresolved'
        })
        .where(eq(schema.localSeries.id, input.mediaEntityId))
        .run();
      tx.insert(schema.providerLookups)
        .values({
          id: crypto.randomUUID(),
          mediaEntityId: input.mediaEntityId,
          provider: input.provider,
          matchMethod: 'unresolved',
          providerSeriesId: null,
          successful: false,
          fetchedAt: input.checkedAt,
          nextRefreshAt: input.nextCheckAt,
          errorCode: 'MetadataUnresolved'
        })
        .run();
    });
  }

  async saveError(input: {
    mediaEntityId: string;
    provider: string;
    checkedAt: string;
    nextCheckAt: string;
    errorCode: string;
  }): Promise<void> {
    this.db
      .update(schema.localSeries)
      .set({
        metadataProvider: input.provider,
        metadataLastCheckedAt: input.checkedAt,
        metadataNextCheckAt: input.nextCheckAt,
        metadataLastErrorAt: input.checkedAt,
        metadataErrorCode: input.errorCode
      })
      .where(eq(schema.localSeries.id, input.mediaEntityId))
      .run();
  }

  private externalIdsFor(mediaEntityId: string): Record<string, string> {
    return Object.fromEntries(
      this.db
        .select({
          provider: schema.mediaExternalIds.provider,
          externalId: schema.mediaExternalIds.externalId
        })
        .from(schema.mediaExternalIds)
        .where(eq(schema.mediaExternalIds.mediaEntityId, mediaEntityId))
        .all()
        .map((row) => [row.provider.toLowerCase(), row.externalId])
    );
  }
}
