import type { PageServerLoad } from './$types';
import { createGetSeriesOverview } from '$lib/server/application/factories/get-series-overview';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { appVersion } from '$lib/version';
import { loadConfig } from '$lib/server/config/app-config';
import type {
  SeriesOverviewItem,
  SeriesOverviewFilter,
  SeriesOverviewSort
} from '$lib/server/application/use-cases/get-series-overview';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { syncRuns } from '$lib/server/infrastructure/database/schema';
import { desc } from 'drizzle-orm';
import { streamingProviderAvailability } from '$lib/server/streaming/availability';
import { TmdbSeriesMetadataProvider } from '$lib/server/infrastructure/providers/tmdb/tmdb-provider';

const filters: SeriesOverviewFilter[] = [
  'all',
  'continuing',
  'ended',
  'new-season',
  'announced',
  'gaps',
  'metadata-issues',
  'ignored'
];
const sorts: SeriesOverviewSort[] = [
  'name-asc',
  'name-desc',
  'last-checked',
  'status',
  'missing-seasons'
];

function queryValue<T extends string>(
  value: string | null,
  allowed: T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

type StreamingGroupItem = {
  id: string;
  name: string;
  posterUrl: string | null;
  productionYear: number | null;
  missingSeasonNumbers: number[];
};

type StreamingOverviewGroup = {
  id: string;
  label: string;
  items: StreamingGroupItem[];
};

function groupItem(series: SeriesOverviewItem): StreamingGroupItem {
  return {
    id: series.id,
    name: series.name,
    posterUrl: series.posterUrl,
    productionYear: series.productionYear,
    missingSeasonNumbers: series.missingSeasonNumbers
  };
}

async function streamingGroupsFor(
  series: SeriesOverviewItem[],
  settings: SettingsRepository,
  unavailableLabel: string
): Promise<StreamingOverviewGroup[] | null> {
  const config = loadConfig();
  if (
    !settings.getStreamingAvailabilityEnabled() ||
    !config.providers.tmdbApiToken
  ) {
    return null;
  }

  const tmdb = new TmdbSeriesMetadataProvider({
    apiToken: config.providers.tmdbApiToken
  });
  const groups = new Map<string, StreamingOverviewGroup>();
  const unavailableGroup: StreamingOverviewGroup = {
    id: 'unavailable',
    label: unavailableLabel,
    items: []
  };
  const region = settings.getRegion();

  await Promise.all(
    series.map(async (item) => {
      let availability = streamingProviderAvailability([], settings);
      if (item.externalProvider === 'tmdb' && item.externalProviderSeriesId) {
        try {
          const seasonProviders = (
            await Promise.all(
              item.missingSeasonNumbers.map((seasonNumber) =>
                tmdb.getSeasonWatchProviders(
                  item.externalProviderSeriesId!,
                  seasonNumber,
                  region
                )
              )
            )
          ).flat();
          availability = streamingProviderAvailability(
            seasonProviders,
            settings
          );
        } catch {
          availability = streamingProviderAvailability([], settings);
        }
      }

      const availableProviders = availability.filter(
        (provider) => provider.available
      );
      if (availableProviders.length === 0) {
        unavailableGroup.items.push(groupItem(item));
        return;
      }

      for (const provider of availableProviders) {
        const group = groups.get(provider.id) ?? {
          id: provider.id,
          label: provider.label,
          items: []
        };
        group.items.push(groupItem(item));
        groups.set(provider.id, group);
      }
    })
  );

  return [
    ...groups.values(),
    ...(unavailableGroup.items.length > 0 ? [unavailableGroup] : [])
  ];
}

export const load: PageServerLoad = async ({ cookies, url }) => {
  const db = getDatabase();
  const settings = new SettingsRepository(db);
  const language = settings.getLanguage();
  const t = getDictionary(language);
  const latestSync = db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)
    .get();
  const overview = await createGetSeriesOverview().execute({
    filter: queryValue(url.searchParams.get('filter'), filters, 'all'),
    search: url.searchParams.get('q') ?? '',
    sort: queryValue(url.searchParams.get('sort'), sorts, 'name-asc')
  });
  const streamingGroupsEnabled =
    url.searchParams.get('streamingGroups') === '1' &&
    overview.query.filter === 'new-season';
  const streamingGroups = streamingGroupsEnabled
    ? await streamingGroupsFor(
        overview.series,
        settings,
        t.notAvailableOnEnabledProviders
      )
    : null;

  return {
    admin: isAdminSession(cookies),
    language,
    t,
    version: appVersion,
    currentPath: `${url.pathname}${url.search}`,
    latestSync: latestSync ?? null,
    streamingGroupsEnabled,
    streamingGroups,
    streamingGroupingAvailable:
      settings.getStreamingAvailabilityEnabled() &&
      Boolean(loadConfig().providers.tmdbApiToken),
    overview
  };
};
