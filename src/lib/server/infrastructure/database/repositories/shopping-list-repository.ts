import { and, desc, eq, gt, isNull, lt, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

export type ShoppingListCandidate = {
  mediaEntityId: string;
  seasonNumber: number;
  status: 'missing' | 'upcoming';
  sourceUrl: string | null;
  sourceLabel: string | null;
};

export type ShoppingListItem = ShoppingListCandidate & {
  id: string;
  priority: number;
  seriesName: string;
  posterUrl: string | null;
};

export type ShoppingListCandidateView = ShoppingListCandidate & {
  seriesName: string;
  posterUrl: string | null;
};

function isAired(airDate: string | null): boolean {
  return (
    !!airDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(airDate) &&
    airDate <= new Date().toISOString().slice(0, 10)
  );
}

function providerSourceUrl(
  provider: string,
  providerSeriesId: string,
  seasonNumber: number
): string | null {
  if (provider === 'tmdb')
    return `https://www.themoviedb.org/tv/${encodeURIComponent(providerSeriesId)}/season/${seasonNumber}`;
  if (provider === 'tvmaze')
    return `https://www.tvmaze.com/shows/${encodeURIComponent(providerSeriesId)}`;
  return null;
}

function providerLabel(provider: string): string | null {
  if (provider === 'tmdb') return 'TMDB';
  if (provider === 'tvmaze') return 'TVmaze';
  if (provider === 'tvdb') return 'TheTVDB';
  return null;
}

function effectiveSeasonNumber(
  season: { id: string; seasonNumber: number | null },
  overrides: Map<string, number>
): number | null {
  return overrides.get(season.id) ?? season.seasonNumber;
}

export class ShoppingListRepository {
  constructor(private readonly db: Db) {}

  private isIgnored(mediaEntityId: string): boolean {
    return !!this.db
      .select({ id: schema.ignoredSeries.mediaEntityId })
      .from(schema.ignoredSeries)
      .where(eq(schema.ignoredSeries.mediaEntityId, mediaEntityId))
      .get();
  }

  list(): ShoppingListItem[] {
    return this.db
      .select({
        id: schema.shoppingListItems.id,
        mediaEntityId: schema.shoppingListItems.mediaEntityId,
        seasonNumber: schema.shoppingListItems.seasonNumber,
        status: schema.shoppingListItems.status,
        priority: schema.shoppingListItems.priority,
        sourceUrl: schema.shoppingListItems.sourceUrl,
        sourceLabel: schema.shoppingListItems.sourceLabel,
        seriesName: schema.mediaEntities.name,
        jellyfinItemId: schema.mediaEntities.jellyfinItemId,
        primaryImageTag: schema.mediaEntities.primaryImageTag
      })
      .from(schema.shoppingListItems)
      .innerJoin(
        schema.mediaEntities,
        eq(schema.mediaEntities.id, schema.shoppingListItems.mediaEntityId)
      )
      .orderBy(
        schema.shoppingListItems.priority,
        schema.mediaEntities.sortName,
        schema.mediaEntities.name
      )
      .all()
      .map((row) => ({
        id: row.id,
        mediaEntityId: row.mediaEntityId,
        seasonNumber: row.seasonNumber,
        status: row.status,
        priority: row.priority,
        sourceUrl: row.sourceUrl,
        sourceLabel: row.sourceLabel,
        seriesName: row.seriesName,
        posterUrl: row.primaryImageTag
          ? `/poster/${encodeURIComponent(row.jellyfinItemId)}`
          : null
      }));
  }

  candidatesForSeries(
    mediaEntityId: string,
    status: 'missing' | 'upcoming'
  ): ShoppingListCandidate[] {
    if (this.isIgnored(mediaEntityId)) return [];

    const state = this.db
      .select({
        id: schema.externalSeriesStates.id,
        provider: schema.externalSeriesStates.provider,
        providerSeriesId: schema.externalSeriesStates.providerSeriesId
      })
      .from(schema.externalSeriesStates)
      .where(eq(schema.externalSeriesStates.mediaEntityId, mediaEntityId))
      .orderBy(desc(schema.externalSeriesStates.fetchedAt))
      .get();
    if (!state) return [];

    const localSeasonNumbers = new Set(
      (() => {
        const overrides = new Map(
          this.db
            .select({
              localSeasonId: schema.localSeasonNumberOverrides.localSeasonId,
              mappedSeasonNumber:
                schema.localSeasonNumberOverrides.mappedSeasonNumber
            })
            .from(schema.localSeasonNumberOverrides)
            .where(
              eq(schema.localSeasonNumberOverrides.mediaEntityId, mediaEntityId)
            )
            .all()
            .map((override) => [
              override.localSeasonId,
              override.mappedSeasonNumber
            ])
        );
        return this.db
          .select({
            id: schema.localSeasons.id,
            seasonNumber: schema.localSeasons.seasonNumber
          })
          .from(schema.localSeasons)
          .where(
            and(
              eq(schema.localSeasons.parentSeriesId, mediaEntityId),
              isNull(schema.localSeasons.removedFromJellyfinAt)
            )
          )
          .all()
          .map((season) => effectiveSeasonNumber(season, overrides));
      })().filter((season): season is number => season !== null && season > 0)
    );

    return this.db
      .select({
        seasonNumber: schema.externalSeasons.seasonNumber,
        airDate: schema.externalSeasons.airDate
      })
      .from(schema.externalSeasons)
      .where(eq(schema.externalSeasons.externalSeriesStateId, state.id))
      .all()
      .filter(
        (season) =>
          season.seasonNumber > 0 &&
          !localSeasonNumbers.has(season.seasonNumber)
      )
      .filter((season) =>
        status === 'missing'
          ? isAired(season.airDate)
          : !isAired(season.airDate)
      )
      .map((season) => ({
        mediaEntityId,
        seasonNumber: season.seasonNumber,
        status,
        sourceUrl: providerSourceUrl(
          state.provider,
          state.providerSeriesId,
          season.seasonNumber
        ),
        sourceLabel: providerLabel(state.provider)
      }));
  }

  allCandidates(status: 'missing' | 'upcoming'): ShoppingListCandidateView[] {
    const series = this.db
      .select({
        id: schema.mediaEntities.id,
        name: schema.mediaEntities.name,
        jellyfinItemId: schema.mediaEntities.jellyfinItemId,
        primaryImageTag: schema.mediaEntities.primaryImageTag
      })
      .from(schema.mediaEntities)
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
      .orderBy(schema.mediaEntities.sortName, schema.mediaEntities.name)
      .all();

    return series.flatMap((item) =>
      this.candidatesForSeries(item.id, status).map((candidate) => ({
        ...candidate,
        seriesName: item.name,
        posterUrl: item.primaryImageTag
          ? `/poster/${encodeURIComponent(item.jellyfinItemId)}`
          : null
      }))
    );
  }

  addCandidates(candidates: ShoppingListCandidate[]): number {
    if (candidates.length === 0) return 0;
    let nextPriority =
      (this.db
        .select({ value: max(schema.shoppingListItems.priority) })
        .from(schema.shoppingListItems)
        .get()?.value ?? 0) + 1;
    const now = new Date().toISOString();
    let added = 0;
    this.db.transaction((tx) => {
      for (const candidate of candidates) {
        const result = tx
          .insert(schema.shoppingListItems)
          .values({
            id: crypto.randomUUID(),
            mediaEntityId: candidate.mediaEntityId,
            seasonNumber: candidate.seasonNumber,
            status: candidate.status,
            priority: nextPriority,
            sourceUrl: candidate.sourceUrl,
            sourceLabel: candidate.sourceLabel,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoNothing()
          .run();
        if (result.changes > 0) {
          added += 1;
          nextPriority += 1;
        }
      }
    });
    return added;
  }

  move(id: string, direction: 'up' | 'down'): void {
    const current = this.db
      .select()
      .from(schema.shoppingListItems)
      .where(eq(schema.shoppingListItems.id, id))
      .get();
    if (!current) return;
    const other = this.db
      .select()
      .from(schema.shoppingListItems)
      .where(
        direction === 'up'
          ? lt(schema.shoppingListItems.priority, current.priority)
          : gt(schema.shoppingListItems.priority, current.priority)
      )
      .orderBy(
        direction === 'up'
          ? desc(schema.shoppingListItems.priority)
          : schema.shoppingListItems.priority
      )
      .limit(1)
      .get();
    if (!other) return;
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.update(schema.shoppingListItems)
        .set({ priority: other.priority, updatedAt: now })
        .where(eq(schema.shoppingListItems.id, current.id))
        .run();
      tx.update(schema.shoppingListItems)
        .set({ priority: current.priority, updatedAt: now })
        .where(eq(schema.shoppingListItems.id, other.id))
        .run();
    });
  }

  remove(id: string): void {
    this.db
      .delete(schema.shoppingListItems)
      .where(eq(schema.shoppingListItems.id, id))
      .run();
    this.reindex();
  }

  clear(): void {
    this.db.delete(schema.shoppingListItems).run();
  }

  reindex(): void {
    const rows = this.db
      .select({ id: schema.shoppingListItems.id })
      .from(schema.shoppingListItems)
      .orderBy(schema.shoppingListItems.priority)
      .all();
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      rows.forEach((row, index) => {
        tx.update(schema.shoppingListItems)
          .set({ priority: index + 1, updatedAt: now })
          .where(eq(schema.shoppingListItems.id, row.id))
          .run();
      });
    });
  }
}
