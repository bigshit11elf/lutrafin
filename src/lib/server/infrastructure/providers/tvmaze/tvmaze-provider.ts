import { z } from 'zod';
import type {
  ExternalSeriesMetadata,
  SeriesMetadataProvider,
  SeriesResolveInput,
  SeriesResolveResult
} from '$lib/server/application/ports/series-metadata-provider';
import { normalizeTvmazeStatus } from '$lib/server/domain/series/status';
import {
  InvalidProviderResponse,
  ProviderRateLimited,
  ProviderUnavailable
} from '$lib/server/errors/domain-errors';
import {
  fetchJson,
  HttpStatusError
} from '$lib/server/infrastructure/http/fetch-json';

const showSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  status: z.string().nullable().optional(),
  premiered: z.string().nullable().optional(),
  ended: z.string().nullable().optional()
});
const searchSchema = z.array(z.object({ show: showSchema })).catch([]);
const seasonSchema = z.object({
  number: z.number().int().nullable(),
  name: z.string().nullable().optional(),
  premiereDate: z.string().nullable().optional(),
  episodeOrder: z.number().int().nullable().optional()
});

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function yearFromDate(value: string | null | undefined): number | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Number.parseInt(value.slice(0, 4), 10)
    : null;
}

export class TvmazeSeriesMetadataProvider implements SeriesMetadataProvider {
  readonly providerName = 'tvmaze';
  private readonly baseUrl: URL;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = new URL(options.baseUrl ?? 'https://api.tvmaze.com');
  }

  async resolveSeries(input: SeriesResolveInput): Promise<SeriesResolveResult> {
    const tvdbId =
      input.externalIds.tvdb ??
      input.externalIds.TVDB ??
      input.externalIds.TheTVDB;
    if (tvdbId) {
      const show = await this.lookup('thetvdb', tvdbId);
      if (show)
        return {
          matchMethod: 'cross_provider_id',
          metadata: await this.metadataForShow(show)
        };
    }

    const imdbId =
      input.externalIds.imdb ??
      input.externalIds.IMDB ??
      input.externalIds.Imdb;
    if (imdbId) {
      const show = await this.lookup('imdb', imdbId);
      if (show)
        return {
          matchMethod: 'cross_provider_id',
          metadata: await this.metadataForShow(show)
        };
    }

    const matches = (await this.search(input.name)).filter(
      (show) =>
        sameName(show.name, input.name) &&
        (!input.productionYear ||
          yearFromDate(show.premiered) === input.productionYear)
    );
    if (matches.length !== 1)
      return {
        matchMethod: 'unresolved',
        reason: 'TVmaze search did not produce one conservative match'
      };
    return {
      matchMethod: 'exact_name_year',
      metadata: await this.metadataForShow(matches[0])
    };
  }

  async getSeries(providerSeriesId: string): Promise<ExternalSeriesMetadata> {
    return this.metadataForShow(
      showSchema.parse(
        await this.get(`/shows/${encodeURIComponent(providerSeriesId)}`)
      )
    );
  }

  async healthCheck(): Promise<boolean> {
    await this.get('/shows/1');
    return true;
  }

  private async metadataForShow(
    show: z.infer<typeof showSchema>
  ): Promise<ExternalSeriesMetadata> {
    const seasons = z
      .array(seasonSchema)
      .parse(await this.get(`/shows/${show.id}/seasons`));
    return {
      provider: 'tvmaze',
      providerSeriesId: String(show.id),
      name: show.name,
      originalName: null,
      providerRawStatus: show.status ?? null,
      normalizedStatus: normalizeTvmazeStatus(show.status),
      firstAirDate: show.premiered ?? null,
      lastAirDate: show.ended ?? null,
      seasons: seasons.map((season) => ({
        seasonNumber: season.number ?? 0,
        name: season.name ?? null,
        airDate: season.premiereDate ?? null,
        episodeCount: season.episodeOrder ?? null,
        episodes: []
      })),
      rawData: { show, seasons }
    };
  }

  private async lookup(
    kind: 'thetvdb' | 'imdb',
    id: string
  ): Promise<z.infer<typeof showSchema> | undefined> {
    try {
      return showSchema.parse(await this.get('/lookup/shows', { [kind]: id }));
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404)
        return undefined;
      throw error;
    }
  }

  private async search(
    name: string
  ): Promise<Array<z.infer<typeof showSchema>>> {
    return searchSchema
      .parse(await this.get('/search/shows', { q: name }))
      .map((result) => result.show);
  }

  private async get(
    path: string,
    query: Record<string, string> = {}
  ): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    try {
      return await fetchJson(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 429)
        throw new ProviderRateLimited('tvmaze');
      if (error instanceof HttpStatusError && error.status === 404) throw error;
      if (error instanceof z.ZodError)
        throw new InvalidProviderResponse('tvmaze');
      throw new ProviderUnavailable('tvmaze');
    }
  }
}
