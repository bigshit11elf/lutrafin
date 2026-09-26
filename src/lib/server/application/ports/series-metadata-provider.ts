import type { NormalizedSeriesStatus } from '$lib/server/domain/series/status';

export type ExternalSeasonMetadata = {
  seasonNumber: number;
  name: string | null;
  airDate: string | null;
  episodeCount: number | null;
  episodes: ExternalEpisodeMetadata[];
};

export type ExternalEpisodeMetadata = {
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  airDate: string | null;
};

export type ExternalSeriesMetadata = {
  provider: string;
  providerSeriesId: string;
  name: string;
  originalName: string | null;
  providerRawStatus: string | null;
  normalizedStatus: NormalizedSeriesStatus;
  firstAirDate: string | null;
  lastAirDate: string | null;
  seasons: ExternalSeasonMetadata[];
  rawData: unknown;
};

export type SeriesResolveInput = {
  name: string;
  originalTitle: string | null;
  productionYear: number | null;
  externalIds: Record<string, string>;
};

export type SeriesResolveResult =
  | {
      matchMethod:
        'exact_external_id' | 'cross_provider_id' | 'exact_name_year';
      metadata: ExternalSeriesMetadata;
    }
  | {
      matchMethod: 'unresolved';
      reason: string;
    };

export interface SeriesMetadataProvider {
  providerName: string;
  resolveSeries(input: SeriesResolveInput): Promise<SeriesResolveResult>;
  getSeries(providerSeriesId: string): Promise<ExternalSeriesMetadata>;
  healthCheck(): Promise<boolean>;
}
