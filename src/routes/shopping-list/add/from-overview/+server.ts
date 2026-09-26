import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createGetSeriesOverview } from '$lib/server/application/factories/get-series-overview';
import type {
  SeriesOverviewFilter,
  SeriesOverviewSort
} from '$lib/server/application/use-cases/get-series-overview';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

const filters: SeriesOverviewFilter[] = [
  'all',
  'continuing',
  'ended',
  'new-season',
  'announced',
  'gaps',
  'metadata-issues',
  'ignored'
];
const sorts: SeriesOverviewSort[] = [
  'name-asc',
  'name-desc',
  'last-checked',
  'status',
  'missing-seasons'
];

function queryValue<T extends string>(
  value: string | null,
  allowed: T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function withAddedConfirmation(path: string, added: number): string {
  if (added <= 0) return path;
  const [pathAndSearch, hash = ''] = path.split('#');
  const separator = pathAndSearch.includes('?') ? '&' : '?';
  return `${pathAndSearch}${separator}shoppingAdded=${added}${hash ? `#${hash}` : ''}`;
}

export const POST: RequestHandler = async ({ cookies, url }) => {
  requireAdmin(cookies);
  const filter = queryValue(
    url.searchParams.get('filter'),
    filters,
    'new-season'
  );
  const targetStatus = filter === 'announced' ? 'upcoming' : 'missing';
  const overview = await createGetSeriesOverview().execute({
    filter,
    search: url.searchParams.get('q') ?? '',
    sort: queryValue(url.searchParams.get('sort'), sorts, 'name-asc')
  });
  const repository = new ShoppingListRepository(getDatabase());
  const added = repository.addCandidates(
    overview.series.flatMap((series) =>
      repository.candidatesForSeries(series.id, targetStatus)
    )
  );
  throw redirect(
    303,
    withAddedConfirmation(
      safeRedirectPath(url.searchParams.get('returnTo')),
      added
    )
  );
};
