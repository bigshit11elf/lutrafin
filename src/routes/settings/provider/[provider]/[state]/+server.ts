import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

const editableProviders = new Set(['tvmaze', 'tvdb']);

export const POST: RequestHandler = ({ cookies, params, url }) => {
  requireAdmin(cookies);
  if (editableProviders.has(params.provider)) {
    new SettingsRepository(getDatabase()).setProviderEnabled(
      params.provider,
      params.state === 'enable'
    );
  }
  throw redirect(
    303,
    safeRedirectPath(
      url.searchParams.get('returnTo'),
      `/settings#provider-${params.provider}`
    )
  );
};
