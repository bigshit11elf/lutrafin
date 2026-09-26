import { z } from 'zod';
import type {
  JellyfinLibrary,
  JellyfinEpisode,
  JellyfinMediaSource,
  JellyfinSeason,
  JellyfinSeries,
  JellyfinServerInfo
} from '$lib/server/application/ports/jellyfin-media-source';
import {
  InvalidProviderResponse,
  JellyfinUnauthorized,
  JellyfinUnavailable
} from '$lib/server/errors/domain-errors';
import {
  fetchJson,
  HttpStatusError
} from '$lib/server/infrastructure/http/fetch-json';

const providerIdsSchema = z.record(z.string(), z.string()).catch({});

const baseItemDtoSchema = z.object({
  Id: z.string(),
  Name: z.string().catch('Unknown'),
  OriginalTitle: z.string().nullable().optional(),
  SortName: z.string().nullable().optional(),
  ProductionYear: z.number().int().nullable().optional(),
  PremiereDate: z.string().nullable().optional(),
  ProviderIds: providerIdsSchema.optional(),
  ImageTags: z.record(z.string(), z.string()).optional(),
  ParentId: z.string().nullable().optional(),
  SeriesId: z.string().nullable().optional(),
  IndexNumber: z.number().int().nullable().optional(),
  ParentIndexNumber: z.number().int().nullable().optional(),
  CollectionType: z.string().nullable().optional(),
  Type: z.string().nullable().optional()
});

const queryResultSchema = z.object({
  Items: z.array(baseItemDtoSchema).catch([]),
  TotalRecordCount: z.number().int().optional()
});

const systemInfoSchema = z.object({
  Id: z.string().nullable().optional(),
  ServerName: z.string().optional(),
  Version: z.string().optional()
});

export type JellyfinMediaSourceOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
};

function primaryImageTag(
  item: z.infer<typeof baseItemDtoSchema>
): string | null {
  return item.ImageTags?.Primary ?? null;
}

export class HttpJellyfinMediaSource implements JellyfinMediaSource {
  private readonly baseUrl: URL;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: JellyfinMediaSourceOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getServerInfo(): Promise<JellyfinServerInfo> {
    const response = systemInfoSchema.parse(await this.get('/System/Info'));
    return {
      id: response.Id ?? null,
      name: response.ServerName ?? 'Jellyfin',
      version: response.Version ?? 'unknown'
    };
  }

  async getLibraries(): Promise<JellyfinLibrary[]> {
    const response = queryResultSchema.parse(
      await this.get('/Library/MediaFolders')
    );

    return response.Items.filter(
      (item) => item.CollectionType === 'tvshows'
    ).map((item) => ({
      id: item.Id,
      name: item.Name,
      collectionType: item.CollectionType ?? null
    }));
  }

  async getSeries(
    excludedLibraryIds: string[] = []
  ): Promise<JellyfinSeries[]> {
    const excluded = new Set(excludedLibraryIds);
    const parentIds = (await this.getLibraries())
      .map((library) => library.id)
      .filter((libraryId) => !excluded.has(libraryId));
    const allSeries: JellyfinSeries[] = [];

    for (const parentId of parentIds) {
      const response = queryResultSchema.parse(
        await this.get('/Items', {
          parentId,
          includeItemTypes: 'Series',
          recursive: 'true',
          fields: 'DateCreated,ProviderIds,SortName',
          enableImages: 'true',
          imageTypeLimit: '1',
          enableImageTypes: 'Primary',
          enableUserData: 'false'
        })
      );

      for (const item of response.Items) {
        allSeries.push({
          jellyfinItemId: item.Id,
          jellyfinLibraryId: parentId,
          name: item.Name,
          originalTitle: item.OriginalTitle ?? null,
          sortName: item.SortName ?? null,
          productionYear: item.ProductionYear ?? null,
          premiereDate: item.PremiereDate ?? null,
          providerIds: item.ProviderIds ?? {},
          primaryImageTag: primaryImageTag(item)
        });
      }
    }

    return allSeries;
  }

  async getSeasons(seriesId: string): Promise<JellyfinSeason[]> {
    const response = queryResultSchema.parse(
      await this.get(`/Shows/${encodeURIComponent(seriesId)}/Seasons`, {
        fields: 'ProviderIds',
        enableImages: 'true',
        imageTypeLimit: '1',
        enableImageTypes: 'Primary',
        enableUserData: 'false'
      })
    );

    return response.Items.map((item) => ({
      jellyfinItemId: item.Id,
      parentSeriesJellyfinItemId: seriesId,
      seasonNumber: item.IndexNumber ?? null,
      displayName: item.Name,
      providerIds: item.ProviderIds ?? {},
      premiereDate: item.PremiereDate ?? null,
      primaryImageTag: primaryImageTag(item)
    }));
  }

  async getEpisodes(
    seriesId: string,
    seasonId?: string | null
  ): Promise<JellyfinEpisode[]> {
    const query: Record<string, string> = {
      fields: 'ProviderIds,ParentIndexNumber',
      enableImages: 'false',
      enableUserData: 'false'
    };
    if (seasonId) query.seasonId = seasonId;

    const response = queryResultSchema.parse(
      await this.get(`/Shows/${encodeURIComponent(seriesId)}/Episodes`, query)
    );

    return response.Items.map((item) => ({
      jellyfinItemId: item.Id,
      parentSeriesJellyfinItemId: seriesId,
      parentSeasonJellyfinItemId: item.ParentId ?? seasonId ?? null,
      seasonNumber: item.ParentIndexNumber ?? null,
      episodeNumber: item.IndexNumber ?? null,
      displayName: item.Name,
      premiereDate: item.PremiereDate ?? null,
      providerIds: item.ProviderIds ?? {}
    }));
  }

  getPrimaryImageUrl(seriesId: string, tag?: string | null): string {
    const url = this.buildUrl(
      `/Items/${encodeURIComponent(seriesId)}/Images/Primary`
    );
    url.searchParams.set('maxWidth', '320');
    url.searchParams.set('quality', '90');
    if (tag) {
      url.searchParams.set('tag', tag);
    }
    return url.pathname + url.search;
  }

  private async get(
    path: string,
    query: Record<string, string> = {}
  ): Promise<unknown> {
    const url = this.buildUrl(path);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    try {
      return await fetchJson(url, {
        timeoutMs: this.timeoutMs,
        headers: {
          Accept: 'application/json',
          Authorization: `MediaBrowser Token="${this.token}"`,
          'X-Emby-Token': this.token
        }
      });
    } catch (error) {
      if (
        error instanceof HttpStatusError &&
        (error.status === 401 || error.status === 403)
      ) {
        throw new JellyfinUnauthorized();
      }

      if (error instanceof z.ZodError) {
        console.warn('Invalid Jellyfin response', {
          path,
          issues: error.issues
        });
        throw new InvalidProviderResponse(
          'jellyfin',
          'Unexpected Jellyfin response shape'
        );
      }

      if (error instanceof HttpStatusError) {
        console.warn('Jellyfin request failed', {
          path,
          status: error.status
        });
      } else if (error instanceof Error) {
        console.warn('Jellyfin request failed', {
          path,
          errorName: error.name,
          message: error.message
        });
      }

      throw new JellyfinUnavailable();
    }
  }

  private buildUrl(path: string): URL {
    const url = new URL(path, this.baseUrl);
    if (url.origin !== this.baseUrl.origin) {
      throw new JellyfinUnavailable('Invalid Jellyfin URL resolution');
    }
    return url;
  }
}
