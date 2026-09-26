import { json } from '@sveltejs/kit';
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
    return json({ ok: true });
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.safeMessage
        : 'Metadata refresh failed.';
    return json({ ok: false, message }, { status: 500 });
  }
};
