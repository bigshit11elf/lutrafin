import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderRateLimited } from '../src/lib/server/errors/domain-errors';
import { TvmazeSeriesMetadataProvider } from '../src/lib/server/infrastructure/providers/tvmaze/tvmaze-provider';

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
  if (!address || typeof address === 'string')
    throw new Error('Mock server did not bind');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  };
}

describe('TvmazeSeriesMetadataProvider', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  it('resolves by TVDB ID and reads seasons', async () => {
    const paths: string[] = [];
    const server = await mockServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://mock.local');
      paths.push(url.pathname);
      if (url.pathname === '/lookup/shows') {
        json(response, {
          id: 42,
          name: 'Example Show',
          status: 'Running',
          premiered: '2024-01-01',
          ended: null
        });
        return;
      }
      if (url.pathname === '/shows/42/seasons') {
        json(response, [
          {
            number: 1,
            name: 'Season 1',
            premiereDate: '2024-01-01',
            episodeOrder: 8
          },
          {
            number: 2,
            name: 'Season 2',
            premiereDate: '2027-01-01',
            episodeOrder: 8
          }
        ]);
        return;
      }
      json(response, {}, 404);
    });
    closeServer = server.close;

    const provider = new TvmazeSeriesMetadataProvider({
      baseUrl: server.baseUrl
    });
    const result = await provider.resolveSeries({
      name: 'Example Show',
      originalTitle: null,
      productionYear: 2024,
      externalIds: { tvdb: '123' }
    });

    expect(result.matchMethod).toBe('cross_provider_id');
    expect(paths).toEqual(['/lookup/shows', '/shows/42/seasons']);
    if (result.matchMethod !== 'unresolved')
      expect(result.metadata.normalizedStatus).toBe('continuing');
  });

  it('does not guess ambiguous search results', async () => {
    const server = await mockServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://mock.local');
      if (url.pathname === '/search/shows') {
        json(response, [
          {
            show: {
              id: 1,
              name: 'Example',
              status: 'Running',
              premiered: '2024-01-01',
              ended: null
            }
          },
          {
            show: {
              id: 2,
              name: 'Example',
              status: 'Ended',
              premiered: '2024-02-01',
              ended: null
            }
          }
        ]);
        return;
      }
      json(response, {}, 404);
    });
    closeServer = server.close;

    const provider = new TvmazeSeriesMetadataProvider({
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
      reason: 'TVmaze search did not produce one conservative match'
    });
  });

  it('maps 429 to ProviderRateLimited', async () => {
    const server = await mockServer((_request, response) =>
      json(response, {}, 429)
    );
    closeServer = server.close;
    const provider = new TvmazeSeriesMetadataProvider({
      baseUrl: server.baseUrl
    });
    await expect(provider.healthCheck()).rejects.toBeInstanceOf(
      ProviderRateLimited
    );
  });
});
