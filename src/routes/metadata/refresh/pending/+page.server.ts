import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { requireAdmin } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

export const load: PageServerLoad = async ({ cookies, url }) => {
  requireAdmin(cookies);
  const settings = new SettingsRepository(getDatabase());
  return {
    force: url.searchParams.get('force') === '1',
    t: getDictionary(settings.getLanguage())
  };
};
