import { and, eq, isNull, notInArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  JellyfinEpisode,
  JellyfinSeason,
  JellyfinSeries
} from '$lib/server/application/ports/jellyfin-media-source';
import type { SyncJellyfinRepository } from '$lib/server/application/use-cases/sync-jellyfin-library';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

function stableId(prefix: string, value: string): string {
  return `${prefix}_${value}`;
}

function externalIdRows(
  mediaEntityId: string,
  providerIds: Record<string, string>,
  now: string
) {
  return Object.entries(providerIds)
    .filter(([, externalId]) => externalId.trim().length > 0)
    .map(([provider, externalId]) => ({
      id: stableId(
        'external',
        `${mediaEntityId}_${provider.toLowerCase()}_${externalId}`
      ),
      mediaEntityId,
      provider: provider.toLowerCase(),
      externalId,
      source: 'jellyfin' as const,
      createdAt: now,
      updatedAt: now
    }));
}

function seasonExternalIdRows(
  localSeasonId: string,
  providerIds: Record<string, string>,
  now: string
) {
  return Object.entries(providerIds)
    .filter(([, externalId]) => externalId.trim().length > 0)
    .map(([provider, externalId]) => ({
      id: stableId(
        'season_external',
        `${localSeasonId}_${provider.toLowerCase()}_${externalId}`
      ),
      localSeasonId,
      provider: provider.toLowerCase(),
      externalId,
      source: 'jellyfin' as const,
      createdAt: now,
      updatedAt: now
    }));
}

export class DrizzleSyncJellyfinRepository implements SyncJellyfinRepository {
  constructor(private readonly db: Db) {}

  async beginSyncRun(startedAt: string): Promise<string> {
    const id = crypto.randomUUID();
    this.db
      .insert(schema.syncRuns)
      .values({ id, type: 'jellyfin', status: 'running', startedAt })
      .run();
    return id;
  }

  async completeSyncRun(
    syncRunId: string,
    input: {
      startedAt: string;
      finishedAt: string;
      seriesRead: number;
      seasonsRead: number;
      added: number;
      updated: number;
      removed: number;
    }
  ): Promise<void> {
    this.db
      .update(schema.syncRuns)
      .set({
        status: 'success',
        finishedAt: input.finishedAt,
        durationMs: Date.parse(input.finishedAt) - Date.parse(input.startedAt),
        seriesRead: input.seriesRead,
        seasonsRead: input.seasonsRead,
        added: input.added,
        updated: input.updated,
        removed: input.removed
      })
      .where(eq(schema.syncRuns.id, syncRunId))
      .run();
  }

  async failSyncRun(
    syncRunId: string,
    finishedAt: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    const run = this.db
      .select()
      .from(schema.syncRuns)
      .where(eq(schema.syncRuns.id, syncRunId))
      .get();

    this.db
      .update(schema.syncRuns)
      .set({
        status: 'failed',
        finishedAt,
        durationMs: run
          ? Date.parse(finishedAt) - Date.parse(run.startedAt)
          : null,
        errorCode,
        errorMessage
      })
      .where(eq(schema.syncRuns.id, syncRunId))
      .run();
  }

  async reconcile(input: {
    scannedAt: string;
    series: JellyfinSeries[];
    seasonsBySeriesId: Map<string, JellyfinSeason[]>;
    episodesBySeriesId: Map<string, JellyfinEpisode[]>;
  }): Promise<{ added: number; updated: number; removed: number }> {
    return this.db.transaction((tx) => {
      let added = 0;
      let updated = 0;
      let removed = 0;
      const seenSeriesIds: string[] = [];
      const seenSeasonIds: string[] = [];
      const seenEpisodeIds: string[] = [];

      for (const series of input.series) {
        const mediaEntityId = stableId('media', series.jellyfinItemId);
        seenSeriesIds.push(mediaEntityId);

        const existing = tx
          .select({ id: schema.mediaEntities.id })
          .from(schema.mediaEntities)
          .where(eq(schema.mediaEntities.jellyfinItemId, series.jellyfinItemId))
          .get();

        if (existing) {
          updated += 1;
        } else {
          added += 1;
        }

        tx.insert(schema.mediaEntities)
          .values({
            id: mediaEntityId,
            mediaType: 'series',
            jellyfinItemId: series.jellyfinItemId,
            jellyfinLibraryId: series.jellyfinLibraryId,
            name: series.name,
            originalTitle: series.originalTitle,
            sortName: series.sortName,
            productionYear: series.productionYear,
            premiereDate: series.premiereDate,
            primaryImageTag: series.primaryImageTag,
            createdAt: input.scannedAt,
            updatedAt: input.scannedAt,
            lastSeenInJellyfinAt: input.scannedAt,
            removedFromJellyfinAt: null
          })
          .onConflictDoUpdate({
            target: schema.mediaEntities.jellyfinItemId,
            set: {
              jellyfinLibraryId: series.jellyfinLibraryId,
              name: series.name,
              originalTitle: series.originalTitle,
              sortName: series.sortName,
              productionYear: series.productionYear,
              premiereDate: series.premiereDate,
              primaryImageTag: series.primaryImageTag,
              updatedAt: input.scannedAt,
              lastSeenInJellyfinAt: input.scannedAt,
              removedFromJellyfinAt: null
            }
          })
          .run();

        tx.insert(schema.localSeries)
          .values({ id: mediaEntityId, metadataMatchStatus: 'unresolved' })
          .onConflictDoNothing()
          .run();

        for (const externalId of externalIdRows(
          mediaEntityId,
          series.providerIds,
          input.scannedAt
        )) {
          tx.insert(schema.mediaExternalIds)
            .values(externalId)
            .onConflictDoUpdate({
              target: [
                schema.mediaExternalIds.mediaEntityId,
                schema.mediaExternalIds.provider,
                schema.mediaExternalIds.externalId
              ],
              set: { updatedAt: input.scannedAt }
            })
            .run();
        }

        const localSeasonIdsByJellyfinId = new Map<string, string>();
        for (const season of input.seasonsBySeriesId.get(
          series.jellyfinItemId
        ) ?? []) {
          const seasonId = stableId('season', season.jellyfinItemId);
          localSeasonIdsByJellyfinId.set(season.jellyfinItemId, seasonId);
          seenSeasonIds.push(seasonId);

          tx.insert(schema.localSeasons)
            .values({
              id: seasonId,
              jellyfinItemId: season.jellyfinItemId,
              parentSeriesId: mediaEntityId,
              seasonNumber: season.seasonNumber,
              displayName: season.displayName,
              premiereDate: season.premiereDate,
              primaryImageTag: season.primaryImageTag,
              createdAt: input.scannedAt,
              updatedAt: input.scannedAt,
              lastSeenInJellyfinAt: input.scannedAt,
              removedFromJellyfinAt: null
            })
            .onConflictDoUpdate({
              target: schema.localSeasons.jellyfinItemId,
              set: {
                parentSeriesId: mediaEntityId,
                seasonNumber: season.seasonNumber,
                displayName: season.displayName,
                premiereDate: season.premiereDate,
                primaryImageTag: season.primaryImageTag,
                updatedAt: input.scannedAt,
                lastSeenInJellyfinAt: input.scannedAt,
                removedFromJellyfinAt: null
              }
            })
            .run();

          for (const externalId of seasonExternalIdRows(
            seasonId,
            season.providerIds,
            input.scannedAt
          )) {
            tx.insert(schema.localSeasonExternalIds)
              .values(externalId)
              .onConflictDoUpdate({
                target: [
                  schema.localSeasonExternalIds.localSeasonId,
                  schema.localSeasonExternalIds.provider,
                  schema.localSeasonExternalIds.externalId
                ],
                set: { updatedAt: input.scannedAt }
              })
              .run();
          }
        }

        for (const episode of input.episodesBySeriesId.get(
          series.jellyfinItemId
        ) ?? []) {
          const episodeId = stableId('episode', episode.jellyfinItemId);
          const parentSeasonId = episode.parentSeasonJellyfinItemId
            ? (localSeasonIdsByJellyfinId.get(
                episode.parentSeasonJellyfinItemId
              ) ?? null)
            : null;
          seenEpisodeIds.push(episodeId);

          tx.insert(schema.localEpisodes)
            .values({
              id: episodeId,
              jellyfinItemId: episode.jellyfinItemId,
              parentSeriesId: mediaEntityId,
              parentSeasonId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              displayName: episode.displayName,
              premiereDate: episode.premiereDate,
              createdAt: input.scannedAt,
              updatedAt: input.scannedAt,
              lastSeenInJellyfinAt: input.scannedAt,
              removedFromJellyfinAt: null
            })
            .onConflictDoUpdate({
              target: schema.localEpisodes.jellyfinItemId,
              set: {
                parentSeriesId: mediaEntityId,
                parentSeasonId,
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.episodeNumber,
                displayName: episode.displayName,
                premiereDate: episode.premiereDate,
                updatedAt: input.scannedAt,
                lastSeenInJellyfinAt: input.scannedAt,
                removedFromJellyfinAt: null
              }
            })
            .run();
        }
      }

      const removedSeriesWhere = and(
        eq(schema.mediaEntities.mediaType, 'series'),
        isNull(schema.mediaEntities.removedFromJellyfinAt),
        seenSeriesIds.length > 0
          ? notInArray(schema.mediaEntities.id, seenSeriesIds)
          : undefined
      );
      const removedSeries = tx
        .select({ id: schema.mediaEntities.id })
        .from(schema.mediaEntities)
        .where(removedSeriesWhere)
        .all();
      removed += removedSeries.length;

      tx.update(schema.mediaEntities)
        .set({
          removedFromJellyfinAt: input.scannedAt,
          updatedAt: input.scannedAt
        })
        .where(removedSeriesWhere)
        .run();

      tx.update(schema.localSeasons)
        .set({
          removedFromJellyfinAt: input.scannedAt,
          updatedAt: input.scannedAt
        })
        .where(
          and(
            isNull(schema.localSeasons.removedFromJellyfinAt),
            seenSeasonIds.length > 0
              ? notInArray(schema.localSeasons.id, seenSeasonIds)
              : undefined
          )
        )
        .run();

      tx.update(schema.localEpisodes)
        .set({
          removedFromJellyfinAt: input.scannedAt,
          updatedAt: input.scannedAt
        })
        .where(
          and(
            isNull(schema.localEpisodes.removedFromJellyfinAt),
            seenEpisodeIds.length > 0
              ? notInArray(schema.localEpisodes.id, seenEpisodeIds)
              : undefined
          )
        )
        .run();

      return { added, updated, removed };
    });
  }
}
