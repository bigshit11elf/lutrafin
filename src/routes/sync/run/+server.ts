import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/admin';
import { createSyncJellyfinLibrary } from '$lib/server/application/factories/sync-jellyfin';
import { AppError } from '$lib/server/errors/domain-errors';

export const POST = async ({ cookies }) => {
  requireAdmin(cookies);
  try {
    await createSyncJellyfinLibrary().execute();
  } catch (error) {
    const message =
      error instanceof AppError ? error.safeMessage : 'Jellyfin sync failed.';
    throw redirect(303, `/sync?message=${encodeURIComponent(message)}`);
  }

  throw redirect(303, '/sync');
};
