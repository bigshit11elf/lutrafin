import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDictionary } from '$lib/i18n';
import { isAdminSession } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import * as schema from '$lib/server/infrastructure/database/schema';

export const load: PageServerLoad = ({ cookies, url }) => {
  const db = getDatabase();
  const language = new SettingsRepository(db).getLanguage();
  const dictionary = getDictionary(language);
  const lookups = db
    .select({
      seriesName: schema.mediaEntities.name,
      provider: schema.providerLookups.provider,
      matchMethod: schema.providerLookups.matchMethod,
      providerSeriesId: schema.providerLookups.providerSeriesId,
      successful: schema.providerLookups.successful,
      fetchedAt: schema.providerLookups.fetchedAt,
      nextRefreshAt: schema.providerLookups.nextRefreshAt,
      errorCode: schema.providerLookups.errorCode
    })
    .from(schema.providerLookups)
    .innerJoin(
      schema.mediaEntities,
      eq(schema.mediaEntities.id, schema.providerLookups.mediaEntityId)
    )
    .orderBy(desc(schema.providerLookups.fetchedAt))
    .limit(50)
    .all();

  return {
    admin: isAdminSession(cookies),
    confirmClear: url.searchParams.get('confirmClear') === '1',
    lookups,
    message:
      url.searchParams.get('message') === 'status-cleared'
        ? dictionary.statusCleared
        : null,
    t: dictionary
  };
};
