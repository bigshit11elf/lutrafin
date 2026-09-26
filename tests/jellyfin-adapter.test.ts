import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpJellyfinMediaSource } from '../src/lib/server/infrastructure/jellyfin/jellyfin-media-source';
import { JellyfinUnauthorized } from '../src/lib/server/errors/domain-errors';

type RouteHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => void;

function json(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function mockServer(
  handler: RouteHandler
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Mock server did not bind to a TCP port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  };
}

describe('HttpJellyfinMediaSource', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  it('reads server info, libraries, series and seasons through GET requests only', async () => {
    const requestedMethods: string[] = [];
    const server = await mockServer((request, response) => {
      requestedMethods.push(request.method ?? 'UNKNOWN');
      const url = new URL(request.url ?? '/', 'http://mock.local');
      expect(request.headers.authorization).toContain(
        'MediaBrowser Token="test-token"'
      );

      if (url.pathname === '/System/Info') {
        json(response, {
          Id: 'server-1',
          ServerName: 'Jellyfin Test',
          Version: '12.1.0'
        });
        return;
      }

      if (url.pathname === '/Library/MediaFolders') {
        json(response, {
          Items: [
            { Id: 'library-1', Name: 'Shows', CollectionType: 'tvshows' },
            { Id: 'library-2', Name: 'Movies', CollectionType: 'movies' }
          ],
          TotalRecordCount: 2
        });
        return;
      }

      if (url.pathname === '/Items') {
        expect(url.searchParams.get('includeItemTypes')).toBe('Series');
        json(response, {
          Items: [
            {
              Id: 'series-1',
              Name: 'Example Show',
              SortName: 'Example Show',
              ProductionYear: 2024,
              PremiereDate: '2024-01-01T00:00:00.0000000Z',
              ProviderIds: { Tmdb: '12345', Imdb: 'tt1234567' },
              ImageTags: { Primary: 'poster-tag' }
            }
          ],
          TotalRecordCount: 1
        });
        return;
      }

      if (url.pathname === '/Shows/series-1/Seasons') {
        json(response, {
          Items: [
            {
              Id: 'season-0',
              Name: 'Specials',
              IndexNumber: 0,
              ProviderIds: {}
            },
            {
              Id: 'season-1',
              Name: 'Season 1',
              IndexNumber: 1,
              ProviderIds: { Tvdb: '987' }
            }
          ],
          TotalRecordCount: 2
        });
        return;
      }

      json(response, { error: 'not found' }, 404);
    });
    closeServer = server.close;

    const source = new HttpJellyfinMediaSource({
      baseUrl: server.baseUrl,
      token: 'test-token'
    });

    await expect(source.getServerInfo()).resolves.toEqual({
      id: 'server-1',
      name: 'Jellyfin Test',
      version: '12.1.0'
    });
    await expect(source.getLibraries()).resolves.toEqual([
      { id: 'library-1', name: 'Shows', collectionType: 'tvshows' }
    ]);
    await expect(source.getSeries()).resolves.toMatchObject([
      {
        jellyfinItemId: 'series-1',
        jellyfinLibraryId: 'library-1',
        name: 'Example Show',
        providerIds: { Tmdb: '12345', Imdb: 'tt1234567' },
        primaryImageTag: 'poster-tag'
      }
    ]);
    await expect(source.getSeasons('series-1')).resolves.toEqual([
      {
        jellyfinItemId: 'season-0',
        parentSeriesJellyfinItemId: 'series-1',
        seasonNumber: 0,
        displayName: 'Specials',
        providerIds: {},
        premiereDate: null,
        primaryImageTag: null
      },
      {
        jellyfinItemId: 'season-1',
        parentSeriesJellyfinItemId: 'series-1',
        seasonNumber: 1,
        displayName: 'Season 1',
        providerIds: { Tvdb: '987' },
        premiereDate: null,
        primaryImageTag: null
      }
    ]);
    expect(new Set(requestedMethods)).toEqual(new Set(['GET']));
  });

  it('excludes configured TV libraries from automatic discovery', async () => {
    const requestedParentIds: string[] = [];
    const server = await mockServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://mock.local');

      if (url.pathname === '/Library/MediaFolders') {
        json(response, {
          Items: [
            { Id: 'library-1', Name: 'Shows', CollectionType: 'tvshows' },
            { Id: 'library-2', Name: 'Kids Shows', CollectionType: 'tvshows' }
          ],
          TotalRecordCount: 2
        });
        return;
      }

      if (url.pathname === '/Items') {
        requestedParentIds.push(url.searchParams.get('parentId') ?? '');
        json(response, { Items: [], TotalRecordCount: 0 });
        return;
      }

      json(response, { error: 'not found' }, 404);
    });
    closeServer = server.close;

    const source = new HttpJellyfinMediaSource({
      baseUrl: server.baseUrl,
      token: 'test-token'
    });

    await expect(source.getSeries(['library-2'])).resolves.toEqual([]);
    expect(requestedParentIds).toEqual(['library-1']);
  });

  it('maps 401/403 to JellyfinUnauthorized', async () => {
    const server = await mockServer((_request, response) =>
      json(response, { error: 'unauthorized' }, 401)
    );
    closeServer = server.close;

    const source = new HttpJellyfinMediaSource({
      baseUrl: server.baseUrl,
      token: 'bad-token'
    });
    await expect(source.getServerInfo()).rejects.toBeInstanceOf(
      JellyfinUnauthorized
    );
  });
});
