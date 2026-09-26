import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { createGetSeriesDetails } from '$lib/server/application/factories/get-series-details';
import { isAdminSession } from '$lib/server/auth/admin';
import { loadConfig } from '$lib/server/config/app-config';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import type { Region } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { streamingProviderAvailability } from '$lib/server/streaming/availability';
import {
  TmdbSeriesMetadataProvider,
  type TmdbWatchProvider
} from '$lib/server/infrastructure/providers/tmdb/tmdb-provider';

function amazonHost(region: Region): string {
  if (region === 'US') return 'www.amazon.com';
  if (region === 'GB') return 'www.amazon.co.uk';
  return 'www.amazon.de';
}

function amazonSeasonUrl(
  seriesName: string,
  seasonNumber: number,
  region: Region
): string {
  const seasonWord =
    region === 'DE' || region === 'AT' || region === 'CH'
      ? 'Staffel'
      : 'Season';
  const query = new URLSearchParams({
    k: `${seriesName} ${seasonWord} ${seasonNumber}`
  });
  return `https://${amazonHost(region)}/s?${query.toString()}`;
}

export const load: PageServerLoad = async ({ cookies, params, url }) => {
  const details = await createGetSeriesDetails().execute(params.id);
  if (!details) throw error(404, 'Series not found');
  const settings = new SettingsRepository(getDatabase());
  const language = settings.getLanguage();
  const region = settings.getRegion();
  const config = loadConfig();
  const streamingAvailabilityEnabled =
    settings.getStreamingAvailabilityEnabled();
  const amazonSeasonLinksEnabled = settings.getAmazonSeasonLinksEnabled();
  const watchProvidersBySeason = new Map<number, TmdbWatchProvider[]>();
  if (
    streamingAvailabilityEnabled &&
    details.externalProvider === 'tmdb' &&
    details.externalProviderSeriesId &&
    config.providers.tmdbApiToken
  ) {
    try {
      const tmdb = new TmdbSeriesMetadataProvider({
        apiToken: config.providers.tmdbApiToken
      });
      await Promise.all(
        details.seasons
          .filter((season) => season.status === 'missing')
          .map(async (season) => {
            watchProvidersBySeason.set(
              season.seasonNumber,
              await tmdb.getSeasonWatchProviders(
                details.externalProviderSeriesId!,
                season.seasonNumber,
                region
              )
            );
          })
      );
    } catch {
      watchProvidersBySeason.clear();
    }
  }
  const newSeasonAvailability = details.seasons
    .filter((season) => season.status === 'missing')
    .map((season) => ({
      seasonNumber: season.seasonNumber,
      label: season.label,
      airDate: season.airDate,
      streamingProviders: streamingAvailabilityEnabled
        ? streamingProviderAvailability(
            watchProvidersBySeason.get(season.seasonNumber) ?? [],
            settings
          )
        : [],
      amazonUrl: amazonSeasonLinksEnabled
        ? amazonSeasonUrl(details.name, season.seasonNumber, region)
        : null
    }))
    .filter(
      (season) =>
        streamingAvailabilityEnabled ||
        amazonSeasonLinksEnabled ||
        season.amazonUrl
    );
  return {
    admin: isAdminSession(cookies),
    details,
    newSeasonAvailability,
    region,
    language,
    streamingAvailabilityEnabled,
    amazonSeasonLinksEnabled,
    seasonDiagnosticsEnabled: settings.getSeasonDiagnosticsEnabled(),
    returnTo: safeRedirectPath(url.searchParams.get('returnTo')),
    t: getDictionary(language)
  };
};
