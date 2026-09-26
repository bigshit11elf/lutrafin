import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

export const load: PageServerLoad = ({ cookies, url }) => {
  const db = getDatabase();
  const language = new SettingsRepository(db).getLanguage();
  return {
    admin: isAdminSession(cookies),
    confirmClear: url.searchParams.get('confirmClear') === '1',
    items: new ShoppingListRepository(db).list(),
    t: getDictionary(language)
  };
};
