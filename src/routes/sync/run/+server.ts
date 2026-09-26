import { redirect } from '@sveltejs/kit';
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
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      throw redirect(
        303,
        `/sync?message=${encodeURIComponent(`Already running: ${error.jobName}`)}`
      );
    }
    const message =
      error instanceof AppError ? error.safeMessage : 'Jellyfin sync failed.';
    throw redirect(303, `/sync?message=${encodeURIComponent(message)}`);
  }

  throw redirect(303, '/sync');
};
