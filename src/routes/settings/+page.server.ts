import { redirect } from '@sveltejs/kit';
import { isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import {
  SettingsRepository,
  jellyfinSyncIntervals,
  metadataFullRefreshIntervals,
  metadataRefreshIntervals,
  notificationEventTypes,
  notificationProviders,
  supportedRegions,
  supportedStreamingProviders
} from '$lib/server/infrastructure/database/repositories/settings-repository';
import { providerConfigured } from '$lib/server/notifications/providers';
import { mergeNotificationConfig } from '$lib/server/notifications/config';
import * as schema from '$lib/server/infrastructure/database/schema';
import { HttpJellyfinMediaSource } from '$lib/server/infrastructure/jellyfin/jellyfin-media-source';

export const load: PageServerLoad = async ({ cookies, url }) => {
  const db = getDatabase();
  const settings = new SettingsRepository(db);
  const language = settings.getLanguage();
  const admin = isAdminSession(cookies);
  if (!admin) throw redirect(303, '/login');
  const config = loadConfig();
  const excludedLibraryIds = settings.getExcludedLibraryIds(
    config.jellyfin?.excludedLibraryIds ?? []
  );
  const activeSeries = db
    .select({ id: schema.mediaEntities.id, name: schema.mediaEntities.name })
    .from(schema.mediaEntities)
    .where(isNull(schema.mediaEntities.removedFromJellyfinAt))
    .orderBy(schema.mediaEntities.name)
    .all();
  const seriesSearch = url.searchParams.get('seriesSearch')?.trim() ?? '';
  const ignoredSeriesIds = settings.getIgnoredSeriesIds();
  let libraries: Array<{
    id: string;
    name: string;
    collectionType: string | null;
  }> = [];

  if (config.jellyfin?.token) {
    try {
      libraries = await new HttpJellyfinMediaSource({
        baseUrl: config.jellyfin.url,
        token: config.jellyfin.token
      }).getLibraries();
    } catch {
      libraries = [];
    }
  }

  const t = getDictionary(language);

  return {
    admin,
    t,
    language,
    region: settings.getRegion(),
    jellyfinSyncInterval: settings.getJellyfinSyncInterval(config.syncInterval),
    jellyfinSyncIntervals,
    metadataRefreshInterval: settings.getMetadataRefreshInterval(),
    metadataRefreshIntervals,
    metadataFullRefreshInterval: settings.getMetadataFullRefreshInterval(),
    metadataFullRefreshIntervals,
    notificationEventTypes: notificationEventTypes.map((event) => ({
      id: event,
      enabled: settings.getNotificationEventTypes().includes(event)
    })),
    notificationProviders: notificationProviders.map((provider) => {
      const providerConfig = settings.getNotificationProviderConfig(
        provider.id
      );
      return {
        id: provider.id,
        label: provider.label,
        enabled: providerConfig.enabled === true,
        configured: providerConfigured(
          provider.id,
          mergeNotificationConfig(provider.id, providerConfig)
        ),
        serverUrl:
          typeof providerConfig.serverUrl === 'string'
            ? providerConfig.serverUrl
            : '',
        topic:
          typeof providerConfig.topic === 'string' ? providerConfig.topic : '',
        webhookUrl:
          typeof providerConfig.webhookUrl === 'string'
            ? providerConfig.webhookUrl
            : '',
        device:
          typeof providerConfig.device === 'string'
            ? providerConfig.device
            : '',
        priority:
          typeof providerConfig.priority === 'number'
            ? providerConfig.priority
            : 0
      };
    }),
    regions: supportedRegions,
    streamingAvailabilityEnabled: settings.getStreamingAvailabilityEnabled(),
    amazonSeasonLinksEnabled: settings.getAmazonSeasonLinksEnabled(),
    streamingProviders: supportedStreamingProviders.map((provider) => ({
      id: provider.id,
      label: provider.label,
      enabled: settings.getStreamingProviderEnabled(provider.id)
    })),
    seasonDiagnosticsEnabled: settings.getSeasonDiagnosticsEnabled(),
    libraries,
    excludedLibraryIds,
    providers: [
      {
        id: 'tmdb',
        name: 'TMDB',
        configured: Boolean(config.providers.tmdbApiToken),
        enabled: Boolean(config.providers.tmdbApiToken),
        purpose: t.primaryMetadataProvider
      },
      {
        id: 'tvmaze',
        name: 'TVmaze',
        configured: true,
        enabled: settings.getProviderEnabled(
          'tvmaze',
          config.providers.tvmazeEnabled
        ),
        purpose: t.fallbackMetadataProvider
      },
      {
        id: 'tvdb',
        name: 'TheTVDB',
        configured: config.providers.tvdbEnabled,
        enabled: settings.getProviderEnabled(
          'tvdb',
          config.providers.tvdbEnabled
        ),
        purpose: t.optionalProvider
      }
    ],
    seriesSearch,
    seriesTotalCount: activeSeries.length,
    series: activeSeries.map((series) => ({
      ...series,
      ignored: ignoredSeriesIds.includes(series.id)
    }))
  };
};
