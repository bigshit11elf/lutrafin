export type SeriesOverviewItem = {
  id: string;
  name: string;
  originalTitle: string | null;
  productionYear: number | null;
  posterUrl: string | null;
  normalizedStatus:
    'continuing' | 'ended' | 'canceled' | 'upcoming' | 'unknown';
  localSeasonNumbers: number[];
  comparableLocalSeasonNumbers: number[];
  localMaxSeason: number | null;
  latestAiredSeason: number | null;
  latestKnownSeason: number | null;
  missingSeasonNumbers: number[];
  announcedSeasonNumbers: number[];
  hasNewAiredSeason: boolean;
  hasAnnouncedFutureSeason: boolean;
  metadataProvider: string | null;
  externalProvider: string | null;
  externalProviderSeriesId: string | null;
  metadataLastCheckedAt: string | null;
  metadataHealth: 'not_checked' | 'ok' | 'error' | 'unresolved';
  ignored: boolean;
  removedFromJellyfinAt: string | null;
  lastSeenInJellyfinAt: string | null;
};

export type SeriesOverviewStats = {
  totalSeries: number;
  upToDate: number;
  newSeasonsAvailable: number;
  newSeasonsTotal: number;
  metadataIssues: number;
  announcedSeasons: number;
  gaps: number;
};

export type SeriesOverviewFilter =
  | 'all'
  | 'continuing'
  | 'ended'
  | 'new-season'
  | 'announced'
  | 'gaps'
  | 'metadata-issues'
  | 'ignored';

export type SeriesOverviewSort =
  'name-asc' | 'name-desc' | 'last-checked' | 'status' | 'missing-seasons';

export type SeriesOverviewQuery = {
  filter: SeriesOverviewFilter;
  search: string;
  sort: SeriesOverviewSort;
};

export type SeriesOverviewDTO = {
  stats: SeriesOverviewStats;
  query: SeriesOverviewQuery;
  filterCounts: Record<SeriesOverviewFilter, number>;
  series: SeriesOverviewItem[];
};

export type SeriesOverviewRepository = {
  getSeriesOverview(): Promise<SeriesOverviewItem[]>;
};

function hasGap(seasons: number[]): boolean {
  if (seasons.length < 2) {
    return false;
  }

  for (let index = 1; index < seasons.length; index += 1) {
    if (seasons[index] !== seasons[index - 1] + 1) {
      return true;
    }
  }

  return false;
}

function applySearch(
  series: SeriesOverviewItem[],
  search: string
): SeriesOverviewItem[] {
  if (search.length === 0) {
    return series;
  }

  const needle = search.toLowerCase();
  return series.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) ||
      item.originalTitle?.toLowerCase().includes(needle) ||
      item.productionYear?.toString().includes(needle)
  );
}

function applyFilter(
  series: SeriesOverviewItem[],
  filter: SeriesOverviewFilter
): SeriesOverviewItem[] {
  switch (filter) {
    case 'all':
      return series;
    case 'continuing':
      return series.filter((item) => item.normalizedStatus === 'continuing');
    case 'ended':
      return series.filter((item) => item.normalizedStatus === 'ended');
    case 'new-season':
      return series.filter((item) => item.hasNewAiredSeason);
    case 'announced':
      return series.filter((item) => item.hasAnnouncedFutureSeason);
    case 'gaps':
      return series.filter((item) => hasGap(item.comparableLocalSeasonNumbers));
    case 'metadata-issues':
      return series.filter(
        (item) =>
          item.metadataHealth === 'error' ||
          item.metadataHealth === 'unresolved'
      );
    case 'ignored':
      return series.filter((item) => item.ignored);
  }
}

function sortSeries(
  series: SeriesOverviewItem[],
  sort: SeriesOverviewSort
): SeriesOverviewItem[] {
  return [...series].sort((left, right) => {
    switch (sort) {
      case 'name-asc':
        return left.name.localeCompare(right.name);
      case 'name-desc':
        return right.name.localeCompare(left.name);
      case 'last-checked':
        return (right.metadataLastCheckedAt ?? '').localeCompare(
          left.metadataLastCheckedAt ?? ''
        );
      case 'status':
        return (
          left.normalizedStatus.localeCompare(right.normalizedStatus) ||
          left.name.localeCompare(right.name)
        );
      case 'missing-seasons':
        return (
          right.missingSeasonNumbers.length -
            left.missingSeasonNumbers.length ||
          left.name.localeCompare(right.name)
        );
    }
  });
}

export class GetSeriesOverview {
  constructor(private readonly repository: SeriesOverviewRepository) {}

  async execute(
    query: Partial<SeriesOverviewQuery> = {}
  ): Promise<SeriesOverviewDTO> {
    const normalizedQuery: SeriesOverviewQuery = {
      filter: query.filter ?? 'all',
      search: query.search?.trim() ?? '',
      sort: query.sort ?? 'name-asc'
    };
    const series = await this.repository.getSeriesOverview();
    const activeSeries = series.filter((item) => !item.removedFromJellyfinAt);
    const visibleSeries =
      normalizedQuery.filter === 'ignored'
        ? activeSeries
        : activeSeries.filter((item) => !item.ignored);
    const searchedSeries = applySearch(visibleSeries, normalizedQuery.search);
    const filteredSeries = applyFilter(searchedSeries, normalizedQuery.filter);

    return {
      stats: {
        totalSeries: activeSeries.filter((item) => !item.ignored).length,
        upToDate: activeSeries.filter(
          (item) =>
            !item.ignored &&
            !item.hasNewAiredSeason &&
            item.missingSeasonNumbers.length === 0 &&
            item.metadataHealth !== 'error' &&
            item.metadataHealth !== 'unresolved'
        ).length,
        newSeasonsAvailable: activeSeries.filter(
          (item) => !item.ignored && item.hasNewAiredSeason
        ).length,
        newSeasonsTotal: activeSeries
          .filter((item) => !item.ignored)
          .reduce((total, item) => total + item.missingSeasonNumbers.length, 0),
        metadataIssues: activeSeries.filter(
          (item) =>
            !item.ignored &&
            (item.metadataHealth === 'error' ||
              item.metadataHealth === 'unresolved')
        ).length,
        announcedSeasons: activeSeries.filter(
          (item) => !item.ignored && item.hasAnnouncedFutureSeason
        ).length,
        gaps: activeSeries.filter(
          (item) => !item.ignored && hasGap(item.comparableLocalSeasonNumbers)
        ).length
      },
      query: normalizedQuery,
      filterCounts: {
        all: activeSeries.filter((item) => !item.ignored).length,
        continuing: activeSeries.filter(
          (item) => !item.ignored && item.normalizedStatus === 'continuing'
        ).length,
        ended: activeSeries.filter(
          (item) => !item.ignored && item.normalizedStatus === 'ended'
        ).length,
        'new-season': activeSeries.filter(
          (item) => !item.ignored && item.hasNewAiredSeason
        ).length,
        announced: activeSeries.filter(
          (item) => !item.ignored && item.hasAnnouncedFutureSeason
        ).length,
        gaps: activeSeries.filter(
          (item) => !item.ignored && hasGap(item.comparableLocalSeasonNumbers)
        ).length,
        'metadata-issues': activeSeries.filter(
          (item) =>
            !item.ignored &&
            (item.metadataHealth === 'error' ||
              item.metadataHealth === 'unresolved')
        ).length,
        ignored: activeSeries.filter((item) => item.ignored).length
      },
      series: sortSeries(filteredSeries, normalizedQuery.sort)
    };
  }
}

export function localStatusText(item: SeriesOverviewItem): string {
  if (item.localSeasonNumbers.length === 0) {
    return 'No regular seasons';
  }

  if (item.localSeasonNumbers.length === 1) {
    return `S${String(item.localSeasonNumbers[0]).padStart(2, '0')}`;
  }

  return item.localSeasonNumbers
    .map((season) => `S${String(season).padStart(2, '0')}`)
    .join(', ');
}
