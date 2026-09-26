import { z } from 'zod';
import type {
  ExternalSeriesMetadata,
  SeriesMetadataProvider,
  SeriesResolveInput,
  SeriesResolveResult
} from '$lib/server/application/ports/series-metadata-provider';
import { normalizeTmdbStatus } from '$lib/server/domain/series/status';
import {
  InvalidProviderResponse,
  ProviderRateLimited,
  ProviderUnauthorized,
  ProviderUnavailable
} from '$lib/server/errors/domain-errors';
import {
  fetchJson,
  HttpStatusError
} from '$lib/server/infrastructure/http/fetch-json';

const tmdbSeasonSchema = z.object({
  air_date: z.string().nullable().optional(),
  episode_count: z.number().int().nullable().optional(),
  name: z.string().nullable().optional(),
  season_number: z.number().int()
});

const tmdbSeriesSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  original_name: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  first_air_date: z.string().nullable().optional(),
  last_air_date: z.string().nullable().optional(),
  seasons: z.array(tmdbSeasonSchema).catch([])
});

const tmdbEpisodeSchema = z.object({
  air_date: z.string().nullable().optional(),
  episode_number: z.number().int(),
  name: z.string().nullable().optional(),
  season_number: z.number().int()
});

const tmdbSeasonDetailsSchema = z.object({
  episodes: z.array(tmdbEpisodeSchema).catch([])
});

const tmdbSearchSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        original_name: z.string().nullable().optional(),
        first_air_date: z.string().nullable().optional()
      })
    )
    .catch([])
});

const tmdbHealthSchema = z.object({ success: z.boolean() });

const tmdbWatchProviderSchema = z.object({
  provider_id: z.number().int(),
  provider_name: z.string()
});

export type TmdbWatchProvider = {
  providerId: number;
  name: string;
};

const tmdbWatchProvidersSchema = z.object({
  results: z.record(
    z.string(),
    z.object({
      flatrate: z.array(tmdbWatchProviderSchema).optional(),
      free: z.array(tmdbWatchProviderSchema).optional(),
      ads: z.array(tmdbWatchProviderSchema).optional()
    })
  )
});

export type TmdbProviderOptions = {
  apiToken: string;
  baseUrl?: string;
  timeoutMs?: number;
};

function yearFromDate(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return Number.parseInt(value.slice(0, 4), 10);
}

async function mapSeries(
  raw: z.infer<typeof tmdbSeriesSchema>,
  loadSeasonEpisodes: (
    seasonNumber: number
  ) => Promise<z.infer<typeof tmdbEpisodeSchema>[]>
): Promise<ExternalSeriesMetadata> {
  const seasons = [];
  for (const season of raw.seasons) {
    seasons.push({
      seasonNumber: season.season_number,
      name: season.name ?? null,
      airDate: season.air_date ?? null,
      episodeCount: season.episode_count ?? null,
      episodes: (await loadSeasonEpisodes(season.season_number)).map(
        (episode) => ({
          seasonNumber: episode.season_number,
          episodeNumber: episode.episode_number,
          name: episode.name ?? null,
          airDate: episode.air_date ?? null
        })
      )
    });
  }

  return {
    provider: 'tmdb',
    providerSeriesId: String(raw.id),
    name: raw.name,
    originalName: raw.original_name ?? null,
    providerRawStatus: raw.status ?? null,
    normalizedStatus: normalizeTmdbStatus(raw.status),
    firstAirDate: raw.first_air_date ?? null,
    lastAirDate: raw.last_air_date ?? null,
    seasons,
    rawData: raw
  };
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export class TmdbSeriesMetadataProvider implements SeriesMetadataProvider {
  readonly providerName = 'tmdb';
  private readonly baseUrl: URL;
  private readonly apiToken: string;
  private readonly timeoutMs: number;

  constructor(options: TmdbProviderOptions) {
    this.baseUrl = new URL(options.baseUrl ?? 'https://api.themoviedb.org');
    this.apiToken = options.apiToken;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async resolveSeries(input: SeriesResolveInput): Promise<SeriesResolveResult> {
    const tmdbId =
      input.externalIds.tmdb ??
      input.externalIds.TMDB ??
      input.externalIds.Tmdb;
    if (tmdbId) {
      return {
        matchMethod: 'exact_external_id',
        metadata: await this.getSeries(tmdbId)
      };
    }

    const searchResult = await this.search(input.name, input.productionYear);
    const matching = searchResult.filter((result) => {
      const year = yearFromDate(result.first_air_date);
      return (
        (sameName(result.name, input.name) ||
          (input.originalTitle
            ? sameName(result.original_name ?? '', input.originalTitle)
            : false)) &&
        (!input.productionYear || year === input.productionYear)
      );
    });

    if (matching.length !== 1) {
      return {
        matchMethod: 'unresolved',
        reason: 'TMDB search did not produce one conservative match'
      };
    }

    return {
      matchMethod: 'exact_name_year',
      metadata: await this.getSeries(String(matching[0].id))
    };
  }

  async getSeries(providerSeriesId: string): Promise<ExternalSeriesMetadata> {
    const raw = tmdbSeriesSchema.parse(
      await this.get(`/3/tv/${encodeURIComponent(providerSeriesId)}`, {
        language: 'en-US'
      })
    );
    return mapSeries(raw, (seasonNumber) =>
      this.getSeasonEpisodes(providerSeriesId, seasonNumber)
    );
  }

  async getSeasonEpisodes(
    providerSeriesId: string,
    seasonNumber: number
  ): Promise<z.infer<typeof tmdbEpisodeSchema>[]> {
    const raw = tmdbSeasonDetailsSchema.parse(
      await this.get(
        `/3/tv/${encodeURIComponent(providerSeriesId)}/season/${encodeURIComponent(String(seasonNumber))}`,
        { language: 'en-US' }
      )
    );
    return raw.episodes;
  }

  async healthCheck(): Promise<boolean> {
    const response = tmdbHealthSchema.parse(
      await this.get('/3/authentication')
    );
    return response.success;
  }

  async getWatchProviders(
    providerSeriesId: string,
    region: string
  ): Promise<TmdbWatchProvider[]> {
    const raw = tmdbWatchProvidersSchema.parse(
      await this.get(
        `/3/tv/${encodeURIComponent(providerSeriesId)}/watch/providers`
      )
    );
    const regionProviders = raw.results[region.toUpperCase()];
    if (!regionProviders) return [];

    return [
      ...(regionProviders.flatrate ?? []),
      ...(regionProviders.free ?? []),
      ...(regionProviders.ads ?? [])
    ].map((provider) => ({
      providerId: provider.provider_id,
      name: provider.provider_name
    }));
  }

  async getSeasonWatchProviders(
    providerSeriesId: string,
    seasonNumber: number,
    region: string
  ): Promise<TmdbWatchProvider[]> {
    const raw = tmdbWatchProvidersSchema.parse(
      await this.get(
        `/3/tv/${encodeURIComponent(providerSeriesId)}/season/${encodeURIComponent(String(seasonNumber))}/watch/providers`
      )
    );
    const regionProviders = raw.results[region.toUpperCase()];
    if (!regionProviders) return [];

    return [
      ...(regionProviders.flatrate ?? []),
      ...(regionProviders.free ?? []),
      ...(regionProviders.ads ?? [])
    ].map((provider) => ({
      providerId: provider.provider_id,
      name: provider.provider_name
    }));
  }

  private async search(
    name: string,
    year: number | null
  ): Promise<z.infer<typeof tmdbSearchSchema>['results']> {
    const query: Record<string, string> = {
      query: name,
      include_adult: 'false',
      language: 'en-US',
      page: '1'
    };
    if (year) {
      query.first_air_date_year = String(year);
    }

    return tmdbSearchSchema.parse(await this.get('/3/search/tv', query))
      .results;
  }

  private async get(
    path: string,
    query: Record<string, string> = {}
  ): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    try {
      return await fetchJson(url, {
        timeoutMs: this.timeoutMs,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiToken}`
        }
      });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 401) {
        throw new ProviderUnauthorized('tmdb');
      }
      if (error instanceof HttpStatusError && error.status === 429) {
        throw new ProviderRateLimited('tmdb');
      }
      if (error instanceof z.ZodError) {
        throw new InvalidProviderResponse('tmdb');
      }
      throw new ProviderUnavailable('tmdb');
    }
  }
}
