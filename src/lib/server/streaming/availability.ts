import {
  supportedStreamingProviders,
  type SettingsRepository
} from '$lib/server/infrastructure/database/repositories/settings-repository';
import type { TmdbWatchProvider } from '$lib/server/infrastructure/providers/tmdb/tmdb-provider';

export type StreamingProviderAvailability = {
  id: string;
  label: string;
  available: boolean;
};

export function streamingProviderAvailability(
  watchProviders: TmdbWatchProvider[],
  settings: SettingsRepository
): StreamingProviderAvailability[] {
  const providerIds = new Set(
    watchProviders.map((provider) => provider.providerId)
  );
  const normalizedProviderNames = watchProviders.map((provider) =>
    provider.name.trim().toLowerCase()
  );

  return supportedStreamingProviders
    .filter((provider) => settings.getStreamingProviderEnabled(provider.id))
    .map((provider) => ({
      id: provider.id,
      label: provider.label,
      available:
        provider.tmdbProviderIds.some((providerId) =>
          providerIds.has(providerId)
        ) ||
        provider.aliases.some((alias) =>
          normalizedProviderNames.some((name) => name === alias)
        )
    }));
}
