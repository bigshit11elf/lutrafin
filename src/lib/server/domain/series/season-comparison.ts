export type SeasonInput = {
  seasonNumber: number | null;
  airDate?: string | null;
};

export type SeasonComparison = {
  localSeasonNumbers: number[];
  comparableLocalSeasonNumbers: number[];
  externalKnownSeasonNumbers: number[];
  externalAiredSeasonNumbers: number[];
  localMaxRegularSeason: number | null;
  externalLatestKnownSeason: number | null;
  externalLatestAiredSeason: number | null;
  missingSeasonNumbers: number[];
  announcedSeasonNumbers: number[];
  missingAiredSeasonCount: number;
  hasNewAiredSeason: boolean;
  hasAnnouncedFutureSeason: boolean;
};

function regularSeasonNumber(value: number | null): number | null {
  if (!Number.isInteger(value) || value === null || value <= 0) {
    return null;
  }

  return value;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function maxOrNull(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function hasDateAired(
  airDate: string | null | undefined,
  today: Date
): boolean {
  if (!airDate || !/^\d{4}-\d{2}-\d{2}$/.test(airDate)) {
    return false;
  }

  const todayUtcDate = today.toISOString().slice(0, 10);
  return airDate <= todayUtcDate;
}

export function compareSeasons(
  localSeasons: SeasonInput[],
  externalSeasons: SeasonInput[],
  today = new Date()
): SeasonComparison {
  const localSeasonNumbers = uniqueSorted(
    localSeasons
      .map((season) => regularSeasonNumber(season.seasonNumber))
      .filter((season): season is number => season !== null)
  );

  const externalKnownSeasonNumbers = uniqueSorted(
    externalSeasons
      .map((season) => regularSeasonNumber(season.seasonNumber))
      .filter((season): season is number => season !== null)
  );

  const externalAiredSeasonNumbers = uniqueSorted(
    externalSeasons
      .filter((season) => hasDateAired(season.airDate, today))
      .map((season) => regularSeasonNumber(season.seasonNumber))
      .filter((season): season is number => season !== null)
  );

  const comparableLocalSeasonNumbers =
    externalKnownSeasonNumbers.length > 0
      ? localSeasonNumbers.filter((seasonNumber) =>
          externalKnownSeasonNumbers.includes(seasonNumber)
        )
      : localSeasonNumbers;

  const missingSeasonNumbers = externalAiredSeasonNumbers.filter(
    (seasonNumber) => !localSeasonNumbers.includes(seasonNumber)
  );

  const announcedSeasonNumbers = externalKnownSeasonNumbers.filter(
    (seasonNumber) =>
      !externalAiredSeasonNumbers.includes(seasonNumber) &&
      !localSeasonNumbers.includes(seasonNumber)
  );

  const externalLatestKnownSeason = maxOrNull(externalKnownSeasonNumbers);
  const externalLatestAiredSeason = maxOrNull(externalAiredSeasonNumbers);
  const localMaxRegularSeason = maxOrNull(comparableLocalSeasonNumbers);

  return {
    localSeasonNumbers,
    comparableLocalSeasonNumbers,
    externalKnownSeasonNumbers,
    externalAiredSeasonNumbers,
    localMaxRegularSeason,
    externalLatestKnownSeason,
    externalLatestAiredSeason,
    missingSeasonNumbers,
    announcedSeasonNumbers,
    missingAiredSeasonCount: missingSeasonNumbers.length,
    hasNewAiredSeason: missingSeasonNumbers.length > 0,
    hasAnnouncedFutureSeason: announcedSeasonNumbers.length > 0
  };
}
