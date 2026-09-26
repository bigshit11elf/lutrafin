import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, isNull } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  JellyfinLibrary,
  JellyfinMediaSource,
  JellyfinSeason,
  JellyfinSeries,
  JellyfinServerInfo
} from '../src/lib/server/application/ports/jellyfin-media-source';
import { SyncJellyfinLibrary } from '../src/lib/server/application/use-cases/sync-jellyfin-library';
import { DrizzleSyncJellyfinRepository } from '../src/lib/server/infrastructure/database/repositories/sync-jellyfin-repository';
import * as schema from '../src/lib/server/infrastructure/database/schema';

class FakeJellyfinMediaSource implements JellyfinMediaSource {
  constructor(
    private readonly series: JellyfinSeries[],
    private readonly seasons: Map<string, JellyfinSeason[]>,
    private readonly failOnSeriesId?: string
  ) {}

  async getServerInfo(): Promise<JellyfinServerInfo> {
    return { id: 'server', name: 'Fake Jellyfin', version: '12.1.0' };
  }

  async getLibraries(): Promise<JellyfinLibrary[]> {
    return [{ id: 'library-1', name: 'Shows', collectionType: 'tvshows' }];
  }

  async getSeries(): Promise<JellyfinSeries[]> {
    return this.series;
  }

  async getSeasons(seriesId: string): Promise<JellyfinSeason[]> {
    if (seriesId === this.failOnSeriesId) {
      throw new Error('Simulated season failure');
    }

    return this.seasons.get(seriesId) ?? [];
  }

  async getEpisodes() {
    return [];
  }

  getPrimaryImageUrl(seriesId: string): string {
    return `/poster/${seriesId}`;
  }
}

function applyMigration(
  sqlite: Database.Database,
  migrationFile: string
): void {
  const sql = readFileSync(migrationFile, 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      sqlite.exec(trimmed);
    }
  }
}

function createTestDb() {
  const directory = mkdtempSync(join(tmpdir(), 'lutrafin-sync-'));
  mkdirSync(directory, { recursive: true });
  const sqlite = new Database(join(directory, 'test.db'));
  sqlite.pragma('foreign_keys = ON');
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0000_initial.sql'
  );
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0001_local_season_external_ids.sql'
  );
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0002_settings_and_ignored_series.sql'
  );
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0003_shopping_list.sql'
  );
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0004_local_season_number_overrides.sql'
  );
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0005_admin_sessions.sql'
  );
  applyMigration(
    sqlite,
    'src/lib/server/infrastructure/database/migrations/0006_episodes.sql'
  );

  return {
    db: drizzle(sqlite, { schema }),
    close: () => {
      sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

function series(id: string, name = id): JellyfinSeries {
  return {
    jellyfinItemId: id,
    jellyfinLibraryId: 'library-1',
    name,
    originalTitle: null,
    sortName: name,
    productionYear: 2024,
    premiereDate: null,
    providerIds: { Tmdb: '12345' },
    primaryImageTag: null
  };
}

function season(
  seriesId: string,
  id: string,
  seasonNumber: number | null
): JellyfinSeason {
  return {
    jellyfinItemId: id,
    parentSeriesJellyfinItemId: seriesId,
    seasonNumber,
    displayName:
      seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber ?? 'Unknown'}`,
    providerIds: { Tvdb: id },
    premiereDate: null,
    primaryImageTag: null
  };
}

describe('SyncJellyfinLibrary reconciliation', () => {
  let closeDb: (() => void) | undefined;

  afterEach(() => {
    closeDb?.();
    closeDb = undefined;
  });

  it('adds series and seasons from a complete Jellyfin scan', async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const source = new FakeJellyfinMediaSource(
      [series('series-1', 'Example Show')],
      new Map([
        [
          'series-1',
          [season('series-1', 'season-0', 0), season('series-1', 'season-1', 1)]
        ]
      ])
    );

    const result = await new SyncJellyfinLibrary(
      source,
      new DrizzleSyncJellyfinRepository(db)
    ).execute();

    expect(result.seriesRead).toBe(1);
    expect(result.seasonsRead).toBe(2);
    expect(db.select().from(schema.mediaEntities).all()).toHaveLength(1);
    expect(db.select().from(schema.localSeasons).all()).toHaveLength(2);
    expect(db.select().from(schema.mediaExternalIds).all()).toHaveLength(1);
    expect(db.select().from(schema.localSeasonExternalIds).all()).toHaveLength(
      2
    );
  });

  it('marks removed series only after a successful full scan', async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const repository = new DrizzleSyncJellyfinRepository(db);

    await new SyncJellyfinLibrary(
      new FakeJellyfinMediaSource(
        [series('series-1')],
        new Map([['series-1', [season('series-1', 'season-1', 1)]]])
      ),
      repository
    ).execute();

    await expect(
      new SyncJellyfinLibrary(
        new FakeJellyfinMediaSource(
          [series('series-1')],
          new Map(),
          'series-1'
        ),
        repository
      ).execute()
    ).rejects.toThrow('Simulated season failure');

    expect(
      db
        .select()
        .from(schema.mediaEntities)
        .where(isNull(schema.mediaEntities.removedFromJellyfinAt))
        .all()
    ).toHaveLength(1);

    await new SyncJellyfinLibrary(
      new FakeJellyfinMediaSource([], new Map()),
      repository
    ).execute();

    expect(
      db
        .select()
        .from(schema.mediaEntities)
        .where(eq(schema.mediaEntities.jellyfinItemId, 'series-1'))
        .get()?.removedFromJellyfinAt
    ).not.toBeNull();
  });

  it('adds a newly arrived season during a later sync', async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const repository = new DrizzleSyncJellyfinRepository(db);

    await new SyncJellyfinLibrary(
      new FakeJellyfinMediaSource(
        [series('series-1')],
        new Map([['series-1', [season('series-1', 'season-1', 1)]]])
      ),
      repository
    ).execute();
    await new SyncJellyfinLibrary(
      new FakeJellyfinMediaSource(
        [series('series-1')],
        new Map([
          [
            'series-1',
            [
              season('series-1', 'season-1', 1),
              season('series-1', 'season-2', 2)
            ]
          ]
        ])
      ),
      repository
    ).execute();

    expect(db.select().from(schema.localSeasons).all()).toHaveLength(2);
  });

  it('deduplicates series with the same strong external id and merges seasons', async () => {
    const { db, close } = createTestDb();
    closeDb = close;
    const source = new FakeJellyfinMediaSource(
      [
        series('series-1', 'Example Show'),
        series('series-duplicate', 'Example Show')
      ],
      new Map([
        ['series-1', [season('series-1', 'season-1', 1)]],
        ['series-duplicate', [season('series-duplicate', 'season-2', 2)]]
      ])
    );

    const result = await new SyncJellyfinLibrary(
      source,
      new DrizzleSyncJellyfinRepository(db)
    ).execute();

    expect(result.seriesRead).toBe(1);
    expect(result.seasonsRead).toBe(2);
    expect(db.select().from(schema.mediaEntities).all()).toHaveLength(1);
    expect(db.select().from(schema.localSeasons).all()).toMatchObject([
      { seasonNumber: 1 },
      { seasonNumber: 2 }
    ]);
  });
});
