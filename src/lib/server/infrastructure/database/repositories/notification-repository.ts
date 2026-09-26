import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  NotificationEvent,
  NotificationProviderId
} from '$lib/server/notifications/types';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

export class NotificationRepository {
  constructor(private readonly db: Db) {}

  hasBaseline(mediaEntityId: string, provider: string): boolean {
    return Boolean(
      this.db
        .select({ baselineAt: schema.notificationBaselines.baselineAt })
        .from(schema.notificationBaselines)
        .where(
          and(
            eq(schema.notificationBaselines.mediaEntityId, mediaEntityId),
            eq(schema.notificationBaselines.provider, provider)
          )
        )
        .get()
    );
  }

  setBaseline(
    mediaEntityId: string,
    provider: string,
    baselineAt: string
  ): void {
    this.db
      .insert(schema.notificationBaselines)
      .values({ mediaEntityId, provider, baselineAt })
      .onConflictDoNothing()
      .run();
  }

  addEvent(input: {
    eventKey: string;
    eventType: 'season_announced' | 'season_released';
    mediaEntityId: string;
    seriesName: string;
    seasonNumber: number;
    airDate: string | null;
    metadataRunId: string;
    createdAt: string;
  }): void {
    this.db
      .insert(schema.notificationEvents)
      .values({ id: crypto.randomUUID(), ...input })
      .onConflictDoNothing()
      .run();
  }

  eventsForRun(metadataRunId: string): NotificationEvent[] {
    return this.db
      .select()
      .from(schema.notificationEvents)
      .where(eq(schema.notificationEvents.metadataRunId, metadataRunId))
      .all();
  }

  createDelivery(input: {
    notificationId: string;
    provider: NotificationProviderId;
    summary: string;
    payloadJson: string;
    createdAt: string;
  }): void {
    this.db
      .insert(schema.notificationDeliveries)
      .values({
        id: crypto.randomUUID(),
        notificationId: input.notificationId,
        provider: input.provider,
        status: 'pending',
        summary: input.summary,
        payloadJson: input.payloadJson,
        attemptCount: 0,
        nextAttemptAt: input.createdAt,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      })
      .run();
  }

  dueDeliveries(now: string, limit = 25) {
    return this.db
      .select()
      .from(schema.notificationDeliveries)
      .where(
        and(
          inArray(schema.notificationDeliveries.status, ['pending', 'failed']),
          or(
            isNull(schema.notificationDeliveries.nextAttemptAt),
            lte(schema.notificationDeliveries.nextAttemptAt, now)
          )
        )
      )
      .limit(limit)
      .all();
  }

  markSent(id: string, now: string): void {
    this.db
      .update(schema.notificationDeliveries)
      .set({
        status: 'sent',
        notifiedAt: now,
        lastAttemptAt: now,
        lastError: null,
        nextAttemptAt: null,
        updatedAt: now
      })
      .where(eq(schema.notificationDeliveries.id, id))
      .run();
  }

  markFailed(
    id: string,
    input: { now: string; error: string; nextAttemptAt: string | null }
  ): void {
    const existing = this.db
      .select({ attemptCount: schema.notificationDeliveries.attemptCount })
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.id, id))
      .get();
    this.db
      .update(schema.notificationDeliveries)
      .set({
        status: 'failed',
        attemptCount: (existing?.attemptCount ?? 0) + 1,
        lastAttemptAt: input.now,
        lastError: input.error.slice(0, 500),
        nextAttemptAt: input.nextAttemptAt,
        updatedAt: input.now
      })
      .where(eq(schema.notificationDeliveries.id, id))
      .run();
  }
}
