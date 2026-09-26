import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

export class EpisodeOverrideRepository {
  constructor(private readonly db: Db) {}

  markPresent(input: {
    mediaEntityId: string;
    seasonNumber: number;
    episodeNumber: number;
  }): void {
    const now = new Date().toISOString();
    this.db
      .insert(schema.episodePresenceOverrides)
      .values({
        id: crypto.randomUUID(),
        mediaEntityId: input.mediaEntityId,
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [
          schema.episodePresenceOverrides.mediaEntityId,
          schema.episodePresenceOverrides.seasonNumber,
          schema.episodePresenceOverrides.episodeNumber
        ],
        set: { updatedAt: now }
      })
      .run();
  }

  reset(input: {
    mediaEntityId: string;
    seasonNumber: number;
    episodeNumber: number;
  }): void {
    this.db
      .delete(schema.episodePresenceOverrides)
      .where(
        and(
          eq(
            schema.episodePresenceOverrides.mediaEntityId,
            input.mediaEntityId
          ),
          eq(schema.episodePresenceOverrides.seasonNumber, input.seasonNumber),
          eq(schema.episodePresenceOverrides.episodeNumber, input.episodeNumber)
        )
      )
      .run();
  }
}
