export type JellyfinProviderIds = Record<string, string>;

export type JellyfinServerInfo = {
  id: string | null;
  name: string;
  version: string;
};

export type JellyfinLibrary = {
  id: string;
  name: string;
  collectionType: string | null;
};

export type JellyfinSeries = {
  jellyfinItemId: string;
  jellyfinLibraryId: string | null;
  name: string;
  originalTitle: string | null;
  sortName: string | null;
  productionYear: number | null;
  premiereDate: string | null;
  providerIds: JellyfinProviderIds;
  primaryImageTag: string | null;
};

export type JellyfinSeason = {
  jellyfinItemId: string;
  parentSeriesJellyfinItemId: string;
  seasonNumber: number | null;
  displayName: string;
  providerIds: JellyfinProviderIds;
  premiereDate: string | null;
  primaryImageTag: string | null;
};

export type JellyfinEpisode = {
  jellyfinItemId: string;
  parentSeriesJellyfinItemId: string;
  parentSeasonJellyfinItemId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  displayName: string;
  premiereDate: string | null;
  providerIds: JellyfinProviderIds;
};

export interface JellyfinMediaSource {
  getServerInfo(): Promise<JellyfinServerInfo>;
  getLibraries(): Promise<JellyfinLibrary[]>;
  getSeries(excludedLibraryIds?: string[]): Promise<JellyfinSeries[]>;
  getSeasons(seriesId: string): Promise<JellyfinSeason[]>;
  getEpisodes(
    seriesId: string,
    seasonId?: string | null
  ): Promise<JellyfinEpisode[]>;
  getPrimaryImageUrl(seriesId: string, tag?: string | null): string;
}
