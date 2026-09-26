export type DetailSeason = {
  seasonNumber: number;
  label: string;
  status: 'local' | 'missing' | 'upcoming';
  airDate: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
};

export type SeasonDiagnosticRow = {
  source: 'jellyfin' | 'metadata';
  seasonNumber: number | null;
  mappedSeasonNumber: number | null;
  label: string;
  itemId: string | null;
  airDate: string | null;
};

export type SeasonNumberOverrideSuggestion = {
  localSeasonId: string;
  originalSeasonNumber: number | null;
  mappedSeasonNumber: number;
  displayName: string;
};

export type SeriesDetailsDTO = {
  id: string;
  name: string;
  originalTitle: string | null;
  productionYear: number | null;
  posterUrl: string | null;
  providerIds: Array<{ provider: string; externalId: string }>;
  metadataProvider: string | null;
  externalProvider: string | null;
  externalProviderSeriesId: string | null;
  normalizedStatus: string;
  providerRawStatus: string | null;
  localSeasonNumbers: number[];
  externalSeasonNumbers: number[];
  seasons: DetailSeason[];
  seasonDiagnostics: SeasonDiagnosticRow[];
  seasonOverrideSuggestions: SeasonNumberOverrideSuggestion[];
  specialsCount: number;
  lastSeenInJellyfinAt: string | null;
  metadataLastCheckedAt: string | null;
  metadataLastSuccessAt: string | null;
  metadataLastErrorAt: string | null;
  metadataErrorCode: string | null;
  ignored: boolean;
};

export type SeriesDetailsRepository = {
  getSeriesDetails(id: string): Promise<SeriesDetailsDTO | undefined>;
};

export class GetSeriesDetails {
  constructor(private readonly repository: SeriesDetailsRepository) {}

  execute(id: string): Promise<SeriesDetailsDTO | undefined> {
    return this.repository.getSeriesDetails(id);
  }
}
