import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

export const load: PageServerLoad = async () => {
  const config = loadConfig();
  const language = new SettingsRepository(getDatabase()).getLanguage();
  const t = getDictionary(language);
  return {
    t,
    providers: [
      {
        name: 'TMDB',
        configured: Boolean(config.providers.tmdbApiToken),
        purpose: t.primaryMetadataProvider
      },
      {
        name: 'TVmaze',
        configured: config.providers.tvmazeEnabled,
        purpose: t.fallbackMetadataProvider
      },
      {
        name: 'TheTVDB',
        configured: config.providers.tvdbEnabled,
        purpose: t.optionalProvider
      }
    ]
  };
};
