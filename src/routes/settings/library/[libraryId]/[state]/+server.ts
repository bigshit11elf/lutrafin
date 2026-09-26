import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { loadConfig } from '$lib/server/config/app-config';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

export const POST: RequestHandler = ({ cookies, params, url }) => {
  requireAdmin(cookies);
  const settings = new SettingsRepository(getDatabase());
  const excluded = new Set(
    settings.getExcludedLibraryIds(
      loadConfig().jellyfin?.excludedLibraryIds ?? []
    )
  );

  if (params.state === 'exclude') excluded.add(params.libraryId);
  if (params.state === 'include') excluded.delete(params.libraryId);

  settings.setExcludedLibraryIds([...excluded]);
  throw redirect(
    303,
    safeRedirectPath(
      url.searchParams.get('returnTo'),
      `/settings#library-${encodeURIComponent(params.libraryId)}`
    )
  );
};
