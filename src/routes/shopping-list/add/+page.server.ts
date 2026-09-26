import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

export const load: PageServerLoad = ({ cookies, url }) => {
  const db = getDatabase();
  const settings = new SettingsRepository(db);
  const repository = new ShoppingListRepository(db);
  const search = url.searchParams.get('q')?.trim() ?? '';
  return {
    admin: isAdminSession(cookies),
    t: getDictionary(settings.getLanguage()),
    search,
    missing: repository.allCandidates('missing'),
    upcoming: repository.allCandidates('upcoming')
  };
};
