import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  NotificationEvent,
  NotificationProviderId
} from '$lib/server/notifications/types';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;
const deliveryLeaseMs = 5 * 60 * 1000;

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

  claimDueDeliveries(now: string, limit = 25) {
    const leaseExpiredAt = new Date(
      new Date(now).getTime() - deliveryLeaseMs
    ).toISOString();
    return this.db.transaction((tx) => {
      const candidates = tx
        .select({ id: schema.notificationDeliveries.id })
        .from(schema.notificationDeliveries)
        .where(
          or(
            and(
              inArray(schema.notificationDeliveries.status, [
                'pending',
                'failed'
              ]),
              or(
                isNull(schema.notificationDeliveries.nextAttemptAt),
                lte(schema.notificationDeliveries.nextAttemptAt, now)
              )
            ),
            and(
              eq(schema.notificationDeliveries.status, 'sending'),
              or(
                isNull(schema.notificationDeliveries.claimedAt),
                lte(schema.notificationDeliveries.claimedAt, leaseExpiredAt)
              )
            )
          )
        )
        .limit(limit)
        .all();

      const ids = candidates.map((candidate) => candidate.id);
      if (ids.length === 0) return [];

      tx.update(schema.notificationDeliveries)
        .set({ status: 'sending', claimedAt: now, updatedAt: now })
        .where(
          and(
            inArray(schema.notificationDeliveries.id, ids),
            or(
              inArray(schema.notificationDeliveries.status, [
                'pending',
                'failed'
              ]),
              and(
                eq(schema.notificationDeliveries.status, 'sending'),
                or(
                  isNull(schema.notificationDeliveries.claimedAt),
                  lte(schema.notificationDeliveries.claimedAt, leaseExpiredAt)
                )
              )
            )
          )
        )
        .run();

      return tx
        .select()
        .from(schema.notificationDeliveries)
        .where(
          and(
            inArray(schema.notificationDeliveries.id, ids),
            eq(schema.notificationDeliveries.status, 'sending')
          )
        )
        .all();
    });
  }

  markSent(id: string, now: string): void {
    this.db
      .update(schema.notificationDeliveries)
      .set({
        status: 'sent',
        notifiedAt: now,
        lastAttemptAt: now,
        lastError: null,
        claimedAt: null,
        nextAttemptAt: null,
        updatedAt: now
      })
      .where(
        and(
          eq(schema.notificationDeliveries.id, id),
          eq(schema.notificationDeliveries.status, 'sending')
        )
      )
      .run();
  }

  markFailed(
    id: string,
    input: { now: string; error: string; nextAttemptAt: string | null }
  ): void {
    this.db
      .update(schema.notificationDeliveries)
      .set({
        status: input.nextAttemptAt ? 'failed' : 'exhausted',
        attemptCount: sql`${schema.notificationDeliveries.attemptCount} + 1`,
        lastAttemptAt: input.now,
        lastError: input.error.slice(0, 500),
        claimedAt: null,
        nextAttemptAt: input.nextAttemptAt,
        updatedAt: input.now
      })
      .where(
        and(
          eq(schema.notificationDeliveries.id, id),
          eq(schema.notificationDeliveries.status, 'sending')
        )
      )
      .run();
  }
}
