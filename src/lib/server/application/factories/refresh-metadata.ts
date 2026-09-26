import { RefreshSeriesMetadata } from '$lib/server/application/use-cases/refresh-series-metadata';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { DrizzleMetadataRefreshRepository } from '$lib/server/infrastructure/database/repositories/metadata-refresh-repository';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { CompositeSeriesMetadataProvider } from '$lib/server/infrastructure/providers/composite-provider';
import { TmdbSeriesMetadataProvider } from '$lib/server/infrastructure/providers/tmdb/tmdb-provider';
import { TvmazeSeriesMetadataProvider } from '$lib/server/infrastructure/providers/tvmaze/tvmaze-provider';

export function createRefreshSeriesMetadata(): RefreshSeriesMetadata {
  const config = loadConfig();
  const settings = new SettingsRepository(getDatabase());
  const providers = [];
  if (config.providers.tmdbApiToken)
    providers.push(
      new TmdbSeriesMetadataProvider({
        apiToken: config.providers.tmdbApiToken
      })
    );
  if (settings.getProviderEnabled('tvmaze', config.providers.tvmazeEnabled))
    providers.push(new TvmazeSeriesMetadataProvider());
  if (providers.length === 0)
    throw new Error('No metadata provider is configured.');

  return new RefreshSeriesMetadata(
    new CompositeSeriesMetadataProvider(providers),
    new DrizzleMetadataRefreshRepository(getDatabase())
  );
}
