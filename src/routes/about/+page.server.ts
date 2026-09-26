import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { appVersion } from '$lib/version';

export const load: PageServerLoad = () => {
  const settings = new SettingsRepository(getDatabase());
  const config = loadConfig();
  return {
    version: appVersion,
    sourceCodeUrl: config.sourceCodeUrl,
    t: getDictionary(settings.getLanguage())
  };
};
