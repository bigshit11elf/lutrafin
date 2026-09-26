import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/admin';
import { createSyncJellyfinLibrary } from '$lib/server/application/factories/sync-jellyfin';
import { AppError } from '$lib/server/errors/domain-errors';

export const POST = async ({ cookies }) => {
  requireAdmin(cookies);
  try {
    await createSyncJellyfinLibrary().execute();
    return json({ ok: true });
  } catch (error) {
    const message =
      error instanceof AppError ? error.safeMessage : 'Jellyfin sync failed.';
    return json({ ok: false, message }, { status: 500 });
  }
};
