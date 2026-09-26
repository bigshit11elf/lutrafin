import { SyncJellyfinLibrary } from '$lib/server/application/use-cases/sync-jellyfin-library';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { DrizzleSyncJellyfinRepository } from '$lib/server/infrastructure/database/repositories/sync-jellyfin-repository';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { HttpJellyfinMediaSource } from '$lib/server/infrastructure/jellyfin/jellyfin-media-source';

export function createSyncJellyfinLibrary(): SyncJellyfinLibrary {
  const config = loadConfig();

  if (!config.jellyfin?.token) {
    throw new Error(
      'JELLYFIN_URL and JELLYFIN_TOKEN are required for Jellyfin sync.'
    );
  }

  const mediaSource = new HttpJellyfinMediaSource({
    baseUrl: config.jellyfin.url,
    token: config.jellyfin.token
  });

  const db = getDatabase();
  const excludedLibraryIds = new SettingsRepository(db).getExcludedLibraryIds(
    config.jellyfin.excludedLibraryIds
  );

  return new SyncJellyfinLibrary(
    mediaSource,
    new DrizzleSyncJellyfinRepository(db),
    excludedLibraryIds
  );
}
