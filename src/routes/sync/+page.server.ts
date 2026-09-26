import type { PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getDictionary } from '$lib/i18n';
import { createSyncJellyfinLibrary } from '$lib/server/application/factories/sync-jellyfin';
import { isAdminSession, requireAdmin } from '$lib/server/auth/admin';
import { AppError } from '$lib/server/errors/domain-errors';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { syncRuns } from '$lib/server/infrastructure/database/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ cookies, url }) => {
  const db = getDatabase();
  const language = new SettingsRepository(db).getLanguage();
  const message = url.searchParams.get('message');
  return {
    admin: isAdminSession(cookies),
    confirmClear: url.searchParams.get('confirmClear') === '1',
    message:
      message === 'status-cleared'
        ? getDictionary(language).statusCleared
        : message,
    t: getDictionary(language),
    runs: db
      .select()
      .from(syncRuns)
      .orderBy(desc(syncRuns.startedAt))
      .limit(20)
      .all()
  };
};

export const actions = {
  default: async ({ cookies }) => {
    requireAdmin(cookies);
    try {
      await createSyncJellyfinLibrary().execute();
    } catch (error) {
      const message =
        error instanceof AppError ? error.safeMessage : 'Jellyfin sync failed.';
      return fail(500, { message });
    }

    throw redirect(303, '/sync');
  }
};
