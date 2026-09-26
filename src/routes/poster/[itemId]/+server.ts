import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { DrizzlePosterRepository } from '$lib/server/infrastructure/database/repositories/poster-repository';

const allowedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);
const maxPosterBytes = 15 * 1024 * 1024;

function buildJellyfinPosterUrl(
  baseUrl: string,
  itemId: string,
  tag: string | null
): URL {
  const url = new URL(
    `/Items/${encodeURIComponent(itemId)}/Images/Primary`,
    baseUrl
  );
  url.searchParams.set('maxWidth', '320');
  url.searchParams.set('quality', '90');
  if (tag) {
    url.searchParams.set('tag', tag);
  }
  return url;
}

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  if (!/^[A-Za-z0-9_-]+$/.test(params.itemId)) {
    throw error(404, 'Poster not found');
  }

  const item = new DrizzlePosterRepository(
    getDatabase()
  ).getKnownSeriesPosterItem(params.itemId);
  if (!item) {
    throw error(404, 'Poster not found');
  }

  const config = loadConfig();
  if (!config.jellyfin?.token) {
    throw error(503, 'Jellyfin is not configured');
  }

  const url = buildJellyfinPosterUrl(
    config.jellyfin.url,
    item.jellyfinItemId,
    item.primaryImageTag
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Authorization: `MediaBrowser Token="${config.jellyfin.token}"`,
        'X-Emby-Token': config.jellyfin.token
      },
      signal: controller.signal
    });

    if (response.status === 404) {
      throw error(404, 'Poster not found');
    }

    if (!response.ok) {
      throw error(502, 'Poster source unavailable');
    }

    const contentType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.toLowerCase();
    if (!contentType || !allowedImageTypes.has(contentType)) {
      throw error(502, 'Invalid poster response');
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > maxPosterBytes) {
      throw error(502, 'Poster response is too large');
    }

    const body = await response.arrayBuffer();
    if (body.byteLength > maxPosterBytes) {
      throw error(502, 'Poster response is too large');
    }
    setHeaders({
      'cache-control': 'private, max-age=3600',
      'content-type': contentType
    });

    return new Response(body);
  } finally {
    clearTimeout(timeout);
  }
};
