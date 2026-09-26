import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

function withAddedConfirmation(path: string, added: number): string {
  if (added <= 0) return path;
  const [pathAndSearch, hash = ''] = path.split('#');
  const separator = pathAndSearch.includes('?') ? '&' : '?';
  return `${pathAndSearch}${separator}shoppingAdded=${added}${hash ? `#${hash}` : ''}`;
}

export const POST: RequestHandler = ({ cookies, params, url }) => {
  requireAdmin(cookies);
  const status = params.status === 'upcoming' ? 'upcoming' : 'missing';
  const repository = new ShoppingListRepository(getDatabase());
  const seasonParam = url.searchParams.get('season');
  const season = seasonParam === null ? null : Number(seasonParam);
  const candidates = repository.candidatesForSeries(params.id, status);
  const added = repository.addCandidates(
    season !== null && Number.isInteger(season)
      ? candidates.filter((candidate) => candidate.seasonNumber === season)
      : candidates
  );
  throw redirect(
    303,
    withAddedConfirmation(
      safeRedirectPath(url.searchParams.get('returnTo')),
      added
    )
  );
};
