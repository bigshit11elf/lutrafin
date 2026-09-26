import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { requireAdmin } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

export const load: PageServerLoad = async ({ cookies }) => {
  requireAdmin(cookies);
  const settings = new SettingsRepository(getDatabase());
  return { t: getDictionary(settings.getLanguage()) };
};
