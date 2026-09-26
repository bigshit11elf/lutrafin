import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { DrizzleMetadataRefreshRepository } from '../src/lib/server/infrastructure/database/repositories/metadata-refresh-repository';
import { EpisodeOverrideRepository } from '../src/lib/server/infrastructure/database/repositories/episode-override-repository';
import { sendNotification } from '../src/lib/server/notifications/providers';
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
    '0007_episode_overrides_notifications'
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
        expect.objectContaining({ method: 'POST' })
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.notificationId).toBe('notification-1');
      expect(body.events).toHaveLength(1);
      expect(JSON.stringify(body)).not.toContain('secret');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
