import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { TmdbSeriesMetadataProvider } from '../src/lib/server/infrastructure/providers/tmdb/tmdb-provider';
import { ProviderUnauthorized } from '../src/lib/server/errors/domain-errors';

function json(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function mockServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Mock server did not bind to a TCP port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  };
}

describe('TmdbSeriesMetadataProvider', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  it('uses an existing TMDB ID without text search', async () => {
    const paths: string[] = [];
    const server = await mockServer((request, response) => {
      paths.push(new URL(request.url ?? '/', 'http://mock.local').pathname);
      expect(request.headers.authorization).toBe('Bearer token');
      const url = new URL(request.url ?? '/', 'http://mock.local');
      if (url.pathname.includes('/season/')) {
        json(response, {
          episodes: [
            {
              season_number: Number(url.pathname.split('/').at(-1)),
              episode_number: 1,
              name: 'Episode 1',
              air_date: '2024-01-01'
            }
          ]
        });
        return;
      }
      json(response, {
        id: 12345,
        name: 'Example Show',
        original_name: 'Example Show',
        status: 'Returning Series',
        first_air_date: '2024-01-01',
        last_air_date: '2025-01-01',
        seasons: [
          {
            season_number: 0,
            name: 'Specials',
            air_date: null,
            episode_count: 1
          },
          {
            season_number: 1,
            name: 'Season 1',
            air_date: '2024-01-01',
            episode_count: 8
          },
          {
            season_number: 2,
            name: 'Season 2',
            air_date: '2027-01-01',
            episode_count: 8
          }
        ]
      });
    });
    closeServer = server.close;

    const provider = new TmdbSeriesMetadataProvider({
      apiToken: 'token',
      baseUrl: server.baseUrl
    });
    const result = await provider.resolveSeries({
      name: 'Example Show',
      originalTitle: null,
      productionYear: 2024,
      externalIds: { tmdb: '12345' }
    });

    expect(result.matchMethod).toBe('exact_external_id');
    expect(paths).toEqual([
      '/3/tv/12345',
      '/3/tv/12345/season/0',
      '/3/tv/12345/season/1',
      '/3/tv/12345/season/2'
    ]);
    if (result.matchMethod !== 'unresolved') {
      expect(result.metadata.normalizedStatus).toBe('continuing');
      expect(result.metadata.seasons).toHaveLength(3);
      expect(result.metadata.seasons[1].episodes).toHaveLength(1);
    }
  });

  it('keeps ambiguous search results unresolved', async () => {
    const server = await mockServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://mock.local');
      if (url.pathname === '/3/search/tv') {
        json(response, {
          results: [
            {
              id: 1,
              name: 'Example',
              original_name: 'Example',
              first_air_date: '2024-01-01'
            },
            {
              id: 2,
              name: 'Example',
              original_name: 'Example',
              first_air_date: '2024-02-01'
            }
          ]
        });
        return;
      }
      json(response, {}, 404);
    });
    closeServer = server.close;

    const provider = new TmdbSeriesMetadataProvider({
      apiToken: 'token',
      baseUrl: server.baseUrl
    });
    await expect(
      provider.resolveSeries({
        name: 'Example',
        originalTitle: null,
        productionYear: 2024,
        externalIds: {}
      })
    ).resolves.toEqual({
      matchMethod: 'unresolved',
      reason: 'TMDB search did not produce one conservative match'
    });
  });

  it('maps 401 to ProviderUnauthorized', async () => {
    const server = await mockServer((_request, response) =>
      json(response, { success: false }, 401)
    );
    closeServer = server.close;

    const provider = new TmdbSeriesMetadataProvider({
      apiToken: 'bad',
      baseUrl: server.baseUrl
    });
    await expect(provider.healthCheck()).rejects.toBeInstanceOf(
      ProviderUnauthorized
    );
  });
});
