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

export type StreamingProviderDefinition =
  (typeof supportedStreamingProviders)[number];

export function enabledStreamingProviders(
  settings: SettingsRepository
): StreamingProviderDefinition[] {
  return supportedStreamingProviders.filter((provider) =>
    settings.getStreamingProviderEnabled(provider.id)
  );
}

function matchesProvider(
  provider: StreamingProviderDefinition,
  providerIds: Set<number>,
  normalizedProviderNames: string[]
): boolean {
  return (
    provider.tmdbProviderIds.some((providerId) =>
      providerIds.has(providerId)
    ) ||
    provider.aliases.some((alias) => normalizedProviderNames.includes(alias))
  );
}

export function availableStreamingProviderIds(
  watchProviders: TmdbWatchProvider[],
  providers: StreamingProviderDefinition[]
): string[] {
  const providerIds = new Set(
    watchProviders.map((provider) => provider.providerId)
  );
  const normalizedProviderNames = watchProviders.map((provider) =>
    provider.name.trim().toLowerCase()
  );

  return providers
    .filter((provider) =>
      matchesProvider(provider, providerIds, normalizedProviderNames)
    )
    .map((provider) => provider.id);
}

export function streamingProviderAvailability(
  watchProviders: TmdbWatchProvider[],
  settings: SettingsRepository
): StreamingProviderAvailability[] {
  return enabledStreamingProviders(settings).map((provider) => ({
    id: provider.id,
    label: provider.label,
    available:
      availableStreamingProviderIds(watchProviders, [provider]).length > 0
  }));
}
