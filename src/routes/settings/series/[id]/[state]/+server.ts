import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

export const POST: RequestHandler = ({ cookies, params, url }) => {
  requireAdmin(cookies);
  new SettingsRepository(getDatabase()).setSeriesIgnored(
    params.id,
    params.state === 'ignore'
  );
  throw redirect(
    303,
    safeRedirectPath(
      url.searchParams.get('returnTo'),
      `/settings#series-${encodeURIComponent(params.id)}`
    )
  );
};
