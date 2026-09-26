import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/admin';
import { createRefreshSeriesMetadata } from '$lib/server/application/factories/refresh-metadata';
import { AppError } from '$lib/server/errors/domain-errors';

export const POST = async ({ cookies, url }) => {
  requireAdmin(cookies);
  try {
    const refresh = createRefreshSeriesMetadata();
    if (url.searchParams.get('force') === '1') {
      await refresh.refreshAll(250);
    } else {
      await refresh.refreshDue(50);
    }
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.safeMessage
        : 'Metadata refresh failed.';
    throw redirect(303, `/?message=${encodeURIComponent(message)}`);
  }

  throw redirect(303, '/');
};
