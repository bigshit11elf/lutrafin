import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

export const load: PageServerLoad = ({ cookies }) => {
  if (isAdminSession(cookies)) throw redirect(303, '/settings');
  const language = new SettingsRepository(getDatabase()).getLanguage();
  return { t: getDictionary(language) };
};
