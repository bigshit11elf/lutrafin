import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Language } from '$lib/i18n';
import { normalizeLanguage } from '$lib/i18n';
import * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

const excludedLibrariesKey = 'jellyfin.excludedLibraryIds';
const languageKey = 'ui.language';
const regionKey = 'ui.region';
const seasonDiagnosticsKey = 'ui.seasonDiagnostics.enabled';
const streamingAvailabilityEnabledKey = 'ui.streamingAvailability.enabled';
const amazonSeasonLinksEnabledKey = 'ui.amazonSeasonLinks.enabled';
const jellyfinSyncIntervalKey = 'jellyfin.sync.interval';
const metadataRefreshIntervalKey = 'metadata.refresh.interval';
const metadataFullRefreshIntervalKey = 'metadata.fullRefresh.interval';
const metadataFullRefreshLastRunAtKey = 'metadata.fullRefresh.lastRunAt';
const notificationEventTypesKey = 'notifications.eventTypes';

export const metadataRefreshIntervals = [
  'off',
  '1h',
  '3h',
  '6h',
  '12h',
  '24h'
] as const;
export const jellyfinSyncIntervals = [
  'off',
  '1h',
  '3h',
  '6h',
  '12h',
  '24h'
] as const;
export const metadataFullRefreshIntervals = [
  'off',
  '7d',
  '14d',
  '30d'
] as const;

export type MetadataRefreshInterval = (typeof metadataRefreshIntervals)[number];
export type JellyfinSyncInterval = (typeof jellyfinSyncIntervals)[number];
export type MetadataFullRefreshInterval =
  (typeof metadataFullRefreshIntervals)[number];
export type NotificationProviderId = 'ntfy' | 'gotify' | 'pushover' | 'webhook';
export type NotificationEventType = 'season_announced' | 'season_released';

export const notificationProviders: Array<{
  id: NotificationProviderId;
  label: string;
}> = [
  { id: 'ntfy', label: 'ntfy' },
  { id: 'gotify', label: 'Gotify' },
  { id: 'pushover', label: 'Pushover' },
  { id: 'webhook', label: 'Generic Webhook' }
];

export const notificationEventTypes: NotificationEventType[] = [
  'season_announced',
  'season_released'
];

export const supportedRegions = [
  { id: 'DE', label: 'Deutschland' },
  { id: 'AT', label: 'Österreich' },
  { id: 'CH', label: 'Schweiz' },
  { id: 'US', label: 'United States' },
  { id: 'GB', label: 'United Kingdom' }
] as const;

export const supportedStreamingProviders = [
  {
    id: 'amazon-prime',
    label: 'Amazon Prime',
    tmdbProviderIds: [9, 119],
    aliases: ['amazon prime video', 'prime video']
  },
  {
    id: 'paramount-plus',
    label: 'Paramount+',
    tmdbProviderIds: [531],
    aliases: ['paramount plus', 'paramount+']
  },
  {
    id: 'disney-plus',
    label: 'Disney+',
    tmdbProviderIds: [337],
    aliases: ['disney plus', 'disney+']
  },
  {
    id: 'netflix',
    label: 'Netflix',
    tmdbProviderIds: [8],
    aliases: ['netflix']
  },
  {
    id: 'rtl-now',
    label: 'RTL Now',
    tmdbProviderIds: [298],
    aliases: ['rtl+', 'rtl plus']
  },
  {
    id: 'ard-mediathek',
    label: 'ARD Mediathek',
    tmdbProviderIds: [],
    aliases: ['ard mediathek']
  },
  {
    id: 'zdf-mediathek',
    label: 'ZDF Mediathek',
    tmdbProviderIds: [],
    aliases: ['zdf mediathek']
  }
] as const;

export type Region = (typeof supportedRegions)[number]['id'];
export type StreamingProviderId =
  (typeof supportedStreamingProviders)[number]['id'];

export function normalizeRegion(region: string | undefined): Region {
  const normalizedRegion = region?.trim().toUpperCase();
  return supportedRegions.some((entry) => entry.id === normalizedRegion)
    ? (normalizedRegion as Region)
    : 'DE';
}

function providerEnabledKey(provider: string): string {
  return `provider.${provider}.enabled`;
}

function streamingProviderEnabledKey(provider: string): string {
  return `streamingProvider.${provider}.enabled`;
}

export function isSupportedStreamingProvider(
  provider: string
): provider is StreamingProviderId {
  return supportedStreamingProviders.some((entry) => entry.id === provider);
}

function normalizeRefreshInterval(
  value: string | undefined
): MetadataRefreshInterval {
  return metadataRefreshIntervals.includes(value as MetadataRefreshInterval)
    ? (value as MetadataRefreshInterval)
    : '24h';
}

function normalizeJellyfinSyncInterval(
  value: string | undefined
): JellyfinSyncInterval {
  return jellyfinSyncIntervals.includes(value as JellyfinSyncInterval)
    ? (value as JellyfinSyncInterval)
    : '6h';
}

function normalizeFullRefreshInterval(
  value: string | undefined
): MetadataFullRefreshInterval {
  return metadataFullRefreshIntervals.includes(
    value as MetadataFullRefreshInterval
  )
    ? (value as MetadataFullRefreshInterval)
    : '7d';
}

function notificationProviderKey(provider: NotificationProviderId): string {
  return `notifications.provider.${provider}`;
}

function safeJson(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export class SettingsRepository {
  constructor(private readonly db: Db) {}

  getExcludedLibraryIds(fallback: string[] = []): string[] {
    const setting = this.get(excludedLibrariesKey);
    return setting ? splitList(setting) : fallback;
  }

  setExcludedLibraryIds(libraryIds: string[]): void {
    this.set(excludedLibrariesKey, [...new Set(libraryIds)].join(','));
  }

  getLanguage(): Language {
    return normalizeLanguage(this.get(languageKey));
  }

  setLanguage(language: string): void {
    this.set(languageKey, normalizeLanguage(language));
  }

  getRegion(): Region {
    return normalizeRegion(this.get(regionKey));
  }

  setRegion(region: string): void {
    this.set(regionKey, normalizeRegion(region));
  }

  getSeasonDiagnosticsEnabled(): boolean {
    return this.get(seasonDiagnosticsKey) === 'true';
  }

  setSeasonDiagnosticsEnabled(enabled: boolean): void {
    this.set(seasonDiagnosticsKey, enabled ? 'true' : 'false');
  }

  getStreamingAvailabilityEnabled(): boolean {
    return this.get(streamingAvailabilityEnabledKey) !== 'false';
  }

  setStreamingAvailabilityEnabled(enabled: boolean): void {
    this.set(streamingAvailabilityEnabledKey, enabled ? 'true' : 'false');
  }

  getAmazonSeasonLinksEnabled(): boolean {
    return this.get(amazonSeasonLinksEnabledKey) !== 'false';
  }

  setAmazonSeasonLinksEnabled(enabled: boolean): void {
    this.set(amazonSeasonLinksEnabledKey, enabled ? 'true' : 'false');
  }

  getJellyfinSyncInterval(fallback = '6h'): JellyfinSyncInterval {
    return normalizeJellyfinSyncInterval(
      this.get(jellyfinSyncIntervalKey) ?? fallback
    );
  }

  setJellyfinSyncInterval(interval: string): void {
    this.set(jellyfinSyncIntervalKey, normalizeJellyfinSyncInterval(interval));
  }

  getMetadataRefreshInterval(): MetadataRefreshInterval {
    return normalizeRefreshInterval(this.get(metadataRefreshIntervalKey));
  }

  setMetadataRefreshInterval(interval: string): void {
    this.set(metadataRefreshIntervalKey, normalizeRefreshInterval(interval));
  }

  getMetadataFullRefreshInterval(): MetadataFullRefreshInterval {
    return normalizeFullRefreshInterval(
      this.get(metadataFullRefreshIntervalKey)
    );
  }

  setMetadataFullRefreshInterval(interval: string): void {
    this.set(
      metadataFullRefreshIntervalKey,
      normalizeFullRefreshInterval(interval)
    );
  }

  getMetadataFullRefreshLastRunAt(): string | undefined {
    return this.get(metadataFullRefreshLastRunAtKey);
  }

  setMetadataFullRefreshLastRunAt(value: string): void {
    this.set(metadataFullRefreshLastRunAtKey, value);
  }

  getNotificationEventTypes(): NotificationEventType[] {
    const stored = this.get(notificationEventTypesKey);
    if (stored === undefined) return [...notificationEventTypes];

    return splitList(stored).filter((event): event is NotificationEventType =>
      notificationEventTypes.includes(event as NotificationEventType)
    );
  }

  setNotificationEventTypes(events: string[]): void {
    this.set(
      notificationEventTypesKey,
      events
        .filter((event): event is NotificationEventType =>
          notificationEventTypes.includes(event as NotificationEventType)
        )
        .join(',')
    );
  }

  getNotificationProviderConfig(
    provider: NotificationProviderId
  ): Record<string, unknown> {
    return safeJson(this.get(notificationProviderKey(provider)));
  }

  setNotificationProviderConfig(
    provider: NotificationProviderId,
    config: Record<string, unknown>
  ): void {
    this.set(notificationProviderKey(provider), JSON.stringify(config));
  }

  getProviderEnabled(provider: string, fallback: boolean): boolean {
    const setting = this.get(providerEnabledKey(provider));
    if (setting === undefined) return fallback;
    return setting === 'true';
  }

  setProviderEnabled(provider: string, enabled: boolean): void {
    this.set(providerEnabledKey(provider), enabled ? 'true' : 'false');
  }

  getStreamingProviderEnabled(provider: string): boolean {
    const setting = this.get(streamingProviderEnabledKey(provider));
    if (setting === undefined) return true;
    return setting === 'true';
  }

  setStreamingProviderEnabled(provider: string, enabled: boolean): void {
    if (!isSupportedStreamingProvider(provider)) return;
    this.set(streamingProviderEnabledKey(provider), enabled ? 'true' : 'false');
  }

  getIgnoredSeriesIds(): string[] {
    return this.db
      .select({ id: schema.ignoredSeries.mediaEntityId })
      .from(schema.ignoredSeries)
      .all()
      .map((row) => row.id);
  }

  setSeriesIgnored(mediaEntityId: string, ignored: boolean): void {
    if (ignored) {
      this.db
        .insert(schema.ignoredSeries)
        .values({ mediaEntityId, createdAt: new Date().toISOString() })
        .onConflictDoNothing()
        .run();
      return;
    }

    this.db
      .delete(schema.ignoredSeries)
      .where(eq(schema.ignoredSeries.mediaEntityId, mediaEntityId))
      .run();
  }

  private get(key: string): string | undefined {
    return this.db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .get()?.value;
  }

  private set(key: string, value: string): void {
    this.db
      .insert(schema.appSettings)
      .values({ key, value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date().toISOString() }
      })
      .run();
  }
}
