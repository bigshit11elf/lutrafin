import type { LayoutServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { appVersion } from '$lib/version';

export const load: LayoutServerLoad = ({ cookies, url }) => {
  const language = new SettingsRepository(getDatabase()).getLanguage();
  const admin = isAdminSession(cookies);
  const dismissUrl = new URL(url);
  dismissUrl.searchParams.delete('shoppingAdded');

  return {
    admin,
    language,
    currentPath: url.pathname,
    currentFullPath: `${url.pathname}${url.search}`,
    shoppingAddedCount: Number(url.searchParams.get('shoppingAdded')) || 0,
    shoppingAddedDismissPath: `${dismissUrl.pathname}${dismissUrl.search}`,
    t: getDictionary(language),
    version: appVersion
  };
};
