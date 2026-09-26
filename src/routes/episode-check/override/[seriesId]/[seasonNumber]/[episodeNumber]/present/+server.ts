import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { EpisodeOverrideRepository } from '$lib/server/infrastructure/database/repositories/episode-override-repository';

export const POST: RequestHandler = ({ cookies, params, url }) => {
  requireAdmin(cookies);
  new EpisodeOverrideRepository(getDatabase()).markPresent({
    mediaEntityId: params.seriesId,
    seasonNumber: Number(params.seasonNumber),
    episodeNumber: Number(params.episodeNumber)
  });
  throw redirect(
    303,
    safeRedirectPath(url.searchParams.get('returnTo'), '/episode-check')
  );
};
