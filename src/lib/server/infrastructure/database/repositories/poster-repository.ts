import { and, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

export type KnownPosterItem = {
  jellyfinItemId: string;
  primaryImageTag: string | null;
};

export class DrizzlePosterRepository {
  constructor(private readonly db: Db) {}

  getKnownSeriesPosterItem(
    jellyfinItemId: string
  ): KnownPosterItem | undefined {
    return this.db
      .select({
        jellyfinItemId: schema.mediaEntities.jellyfinItemId,
        primaryImageTag: schema.mediaEntities.primaryImageTag
      })
      .from(schema.mediaEntities)
      .where(
        and(
          eq(schema.mediaEntities.mediaType, 'series'),
          eq(schema.mediaEntities.jellyfinItemId, jellyfinItemId),
          isNull(schema.mediaEntities.removedFromJellyfinAt)
        )
      )
      .get();
  }
}
