import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/admin';
import { createSyncJellyfinLibrary } from '$lib/server/application/factories/sync-jellyfin';
import { AppError } from '$lib/server/errors/domain-errors';
import {
  JobAlreadyRunningError,
  runExclusive
} from '$lib/server/jobs/job-coordinator';

export const POST = async ({ cookies }) => {
  requireAdmin(cookies);
  try {
    await runExclusive('jellyfin-sync', () =>
      createSyncJellyfinLibrary().execute()
    );
    return json({ ok: true });
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      return json(
        { ok: false, message: `Already running: ${error.jobName}` },
        { status: 409 }
      );
    }
    const message =
      error instanceof AppError ? error.safeMessage : 'Jellyfin sync failed.';
    return json({ ok: false, message }, { status: 500 });
  }
};
