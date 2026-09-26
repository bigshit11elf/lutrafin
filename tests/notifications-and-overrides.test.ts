import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { DrizzleMetadataRefreshRepository } from '../src/lib/server/infrastructure/database/repositories/metadata-refresh-repository';
import { EpisodeOverrideRepository } from '../src/lib/server/infrastructure/database/repositories/episode-override-repository';
import { NotificationRepository } from '../src/lib/server/infrastructure/database/repositories/notification-repository';
import { SettingsRepository } from '../src/lib/server/infrastructure/database/repositories/settings-repository';
import {
  PermanentNotificationError,
  RetryableNotificationError,
  sendNotification
} from '../src/lib/server/notifications/providers';
import * as schema from '../src/lib/server/infrastructure/database/schema';

function applyMigration(
  sqlite: Database.Database,
  migrationFile: string
): void {
  const sql = readFileSync(migrationFile, 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) sqlite.exec(trimmed);
  }
}

function createTestDb() {
  const directory = mkdtempSync(join(tmpdir(), 'lutrafin-notifications-'));
  mkdirSync(directory, { recursive: true });
  const sqlite = new Database(join(directory, 'test.db'));
  sqlite.pragma('foreign_keys = ON');
  for (const migration of [
    '0000_initial',
    '0001_local_season_external_ids',
    '0002_settings_and_ignored_series',
    '0003_shopping_list',
    '0004_local_season_number_overrides',
    '0005_admin_sessions',
    '0006_episodes',
    '0007_episode_overrides_notifications',
    '0008_delivery_claims_watch_cache',
    '0009_notification_delivery_claimed_at'
  ]) {
    applyMigration(
      sqlite,
      `src/lib/server/infrastructure/database/migrations/${migration}.sql`
    );
  }

  return {
    db: drizzle(sqlite, { schema }),
    close: () => {
      sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

function seedSeries(db: ReturnType<typeof createTestDb>['db']) {
  const now = '2026-01-01T00:00:00.000Z';
  db.insert(schema.mediaEntities)
    .values({
      id: 'series-1',
      mediaType: 'series',
      jellyfinItemId: 'jellyfin-1',
      name: 'Example Show',
      originalTitle: null,
      sortName: 'Example Show',
      productionYear: 2026,
      premiereDate: null,
      primaryImageTag: null,
      createdAt: now,
      updatedAt: now,
      lastSeenInJellyfinAt: now,
      removedFromJellyfinAt: null
    })
    .run();
  db.insert(schema.localSeries).values({ id: 'series-1' }).run();
}

describe('episode overrides and notifications', () => {
  it('stores and resets episode presence overrides', () => {
    const { db, close } = createTestDb();
    try {
      seedSeries(db);
      const repository = new EpisodeOverrideRepository(db);
      repository.markPresent({
        mediaEntityId: 'series-1',
        seasonNumber: 2,
        episodeNumber: 3
      });
      expect(
        db.select().from(schema.episodePresenceOverrides).all()
      ).toHaveLength(1);
      repository.reset({
        mediaEntityId: 'series-1',
        seasonNumber: 2,
        episodeNumber: 3
      });
      expect(
        db.select().from(schema.episodePresenceOverrides).all()
      ).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('emits one announcement when a known season changes from null to future air date', async () => {
    const { db, close } = createTestDb();
    try {
      seedSeries(db);
      const repository = new DrizzleMetadataRefreshRepository(db);
      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-01-01T00:00:00.000Z',
        nextCheckAt: '2026-01-02T00:00:00.000Z',
        metadata: {
          provider: 'tmdb',
          providerSeriesId: '100',
          name: 'Example Show',
          originalName: null,
          providerRawStatus: null,
          normalizedStatus: 'continuing',
          firstAirDate: null,
          lastAirDate: null,
          seasons: [
            {
              seasonNumber: 2,
              name: null,
              airDate: null,
              episodeCount: 1,
              episodes: []
            }
          ],
          rawData: {}
        }
      });
      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-01-02T00:00:00.000Z',
        nextCheckAt: '2026-01-03T00:00:00.000Z',
        metadata: {
          provider: 'tmdb',
          providerSeriesId: '100',
          name: 'Example Show',
          originalName: null,
          providerRawStatus: null,
          normalizedStatus: 'continuing',
          firstAirDate: null,
          lastAirDate: null,
          seasons: [
            {
              seasonNumber: 2,
              name: null,
              airDate: '2026-05-01',
              episodeCount: 1,
              episodes: []
            }
          ],
          rawData: {}
        }
      });

      const events = db.select().from(schema.notificationEvents).all();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('season_announced');
    } finally {
      close();
    }
  });

  it('emits one release when an announced season crosses its air date', async () => {
    const { db, close } = createTestDb();
    try {
      seedSeries(db);
      const repository = new DrizzleMetadataRefreshRepository(db);
      const metadata = (airDate: string) => ({
        provider: 'tmdb' as const,
        providerSeriesId: '100',
        name: 'Example Show',
        originalName: null,
        providerRawStatus: null,
        normalizedStatus: 'continuing' as const,
        firstAirDate: null,
        lastAirDate: null,
        seasons: [
          {
            seasonNumber: 2,
            name: null,
            airDate,
            episodeCount: 1,
            episodes: []
          }
        ],
        rawData: {}
      });

      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-01-01T00:00:00.000Z',
        nextCheckAt: '2026-01-02T00:00:00.000Z',
        metadata: { ...metadata('2025-01-01'), seasons: [] }
      });
      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-01-02T00:00:00.000Z',
        nextCheckAt: '2026-01-03T00:00:00.000Z',
        metadata: metadata('2026-02-01')
      });
      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-02-02T00:00:00.000Z',
        nextCheckAt: '2026-02-03T00:00:00.000Z',
        metadata: metadata('2026-02-01')
      });
      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-02-03T00:00:00.000Z',
        nextCheckAt: '2026-02-04T00:00:00.000Z',
        metadata: metadata('2026-02-01')
      });

      const events = db
        .select()
        .from(schema.notificationEvents)
        .orderBy(schema.notificationEvents.createdAt)
        .all();
      expect(events.map((event) => event.eventType)).toEqual([
        'season_announced',
        'season_released'
      ]);
      expect(events[1].eventKey).toBe('season_released:series-1:season:2');
    } finally {
      close();
    }
  });

  it('allows an intentionally empty notification event selection', () => {
    const { db, close } = createTestDb();
    try {
      const settings = new SettingsRepository(db);
      settings.setNotificationEventTypes([]);
      expect(settings.getNotificationEventTypes()).toEqual([]);
    } finally {
      close();
    }
  });

  it('claims due notification deliveries once and marks final retry exhausted', () => {
    const { db, close } = createTestDb();
    try {
      const repository = new NotificationRepository(db);
      repository.createDelivery({
        notificationId: 'notification-1',
        provider: 'webhook',
        summary: 'Summary',
        payloadJson: '{}',
        createdAt: '2026-01-01T00:00:00.000Z'
      });

      const firstClaim = repository.claimDueDeliveries(
        '2026-01-01T00:00:00.000Z',
        25
      );
      const secondClaim = repository.claimDueDeliveries(
        '2026-01-01T00:00:00.000Z',
        25
      );
      expect(firstClaim).toHaveLength(1);
      expect(secondClaim).toHaveLength(0);

      repository.markFailed(firstClaim[0].id, {
        now: '2026-01-01T00:00:01.000Z',
        error: 'failed',
        nextAttemptAt: null
      });
      expect(
        db.select().from(schema.notificationDeliveries).get()?.status
      ).toBe('exhausted');
    } finally {
      close();
    }
  });

  it('reclaims stale sending notification deliveries after the lease expired', () => {
    const { db, close } = createTestDb();
    try {
      const repository = new NotificationRepository(db);
      repository.createDelivery({
        notificationId: 'notification-1',
        provider: 'webhook',
        summary: 'Summary',
        payloadJson: '{}',
        createdAt: '2026-01-01T00:00:00.000Z'
      });

      expect(
        repository.claimDueDeliveries('2026-01-01T00:00:00.000Z', 25)
      ).toHaveLength(1);
      expect(
        repository.claimDueDeliveries('2026-01-01T00:04:59.000Z', 25)
      ).toHaveLength(0);
      expect(
        repository.claimDueDeliveries('2026-01-01T00:05:01.000Z', 25)
      ).toHaveLength(1);
    } finally {
      close();
    }
  });

  it('uses the first metadata save as baseline and deduplicates later events', async () => {
    const { db, close } = createTestDb();
    try {
      seedSeries(db);
      const repository = new DrizzleMetadataRefreshRepository(db);
      await repository.saveSuccess({
        mediaEntityId: 'series-1',
        provider: 'tmdb',
        matchMethod: 'exact_external_id',
        checkedAt: '2026-01-01T00:00:00.000Z',
        nextCheckAt: '2026-01-02T00:00:00.000Z',
        metadata: {
          provider: 'tmdb',
          providerSeriesId: '100',
          name: 'Example Show',
          originalName: null,
          providerRawStatus: null,
          normalizedStatus: 'continuing',
          firstAirDate: null,
          lastAirDate: null,
          seasons: [
            {
              seasonNumber: 1,
              name: null,
              airDate: '2025-01-01',
              episodeCount: 1,
              episodes: []
            }
          ],
          rawData: {}
        }
      });
      expect(db.select().from(schema.notificationEvents).all()).toHaveLength(0);

      for (const checkedAt of [
        '2026-01-02T00:00:00.000Z',
        '2026-01-03T00:00:00.000Z'
      ]) {
        await repository.saveSuccess({
          mediaEntityId: 'series-1',
          provider: 'tmdb',
          matchMethod: 'exact_external_id',
          checkedAt,
          nextCheckAt: '2026-01-04T00:00:00.000Z',
          metadata: {
            provider: 'tmdb',
            providerSeriesId: '100',
            name: 'Example Show',
            originalName: null,
            providerRawStatus: null,
            normalizedStatus: 'continuing',
            firstAirDate: null,
            lastAirDate: null,
            seasons: [
              {
                seasonNumber: 1,
                name: null,
                airDate: '2025-01-01',
                episodeCount: 1,
                episodes: []
              },
              {
                seasonNumber: 2,
                name: null,
                airDate: '2026-05-01',
                episodeCount: 1,
                episodes: []
              }
            ],
            rawData: {}
          }
        });
      }

      const events = db.select().from(schema.notificationEvents).all();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('season_announced');
      expect(events[0].eventKey).toBe('season_announced:series-1:season:2');
    } finally {
      close();
    }
  });

  it('sends generic webhook payloads without exposing secrets', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await sendNotification(
        'webhook',
        {
          enabled: true,
          webhookUrl: 'https://example.invalid/hook',
          token: 'secret'
        },
        {
          notificationId: 'notification-1',
          summary: 'Summary',
          events: [
            {
              eventKey: 'season_released:series-1:season:2',
              eventType: 'season_released',
              seriesName: 'Example Show',
              seasonNumber: 2,
              airDate: '2026-01-01'
            }
          ]
        }
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.invalid/hook',
        expect.objectContaining({ method: 'POST', redirect: 'error' })
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.notificationId).toBe('notification-1');
      expect(body.events).toHaveLength(1);
      expect(JSON.stringify(body)).not.toContain('secret');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('adds a timeout signal to notification provider requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await sendNotification(
        'ntfy',
        { enabled: true, serverUrl: 'https://ntfy.invalid', topic: 'topic' },
        { notificationId: 'n1', summary: 'Summary', events: [] }
      );
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('classifies notification provider HTTP failures by retryability', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(
        sendNotification(
          'webhook',
          { enabled: true, webhookUrl: 'https://example.invalid/hook' },
          { notificationId: 'n1', summary: 'Summary', events: [] }
        )
      ).rejects.toBeInstanceOf(PermanentNotificationError);
      await expect(
        sendNotification(
          'webhook',
          { enabled: true, webhookUrl: 'https://example.invalid/hook' },
          { notificationId: 'n2', summary: 'Summary', events: [] }
        )
      ).rejects.toBeInstanceOf(RetryableNotificationError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('treats Pushover API status 0 responses as permanent failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 0,
        errors: ['application token is invalid']
      })
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(
        sendNotification(
          'pushover',
          { enabled: true, userKey: 'user', applicationToken: 'token' },
          { notificationId: 'n1', summary: 'Summary', events: [] }
        )
      ).rejects.toBeInstanceOf(PermanentNotificationError);
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        'content-type': 'application/x-www-form-urlencoded'
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
