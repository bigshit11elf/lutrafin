import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/admin';
import { createRefreshSeriesMetadata } from '$lib/server/application/factories/refresh-metadata';
import { AppError } from '$lib/server/errors/domain-errors';
import {
  JobAlreadyRunningError,
  runExclusive
} from '$lib/server/jobs/job-coordinator';

export const POST = async ({ cookies, url }) => {
  requireAdmin(cookies);
  try {
    const refresh = createRefreshSeriesMetadata();
    if (url.searchParams.get('force') === '1') {
      await runExclusive('metadata-refresh', () => refresh.refreshAll(250));
    } else {
      await runExclusive('metadata-refresh', () => refresh.refreshDue(50));
    }
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      throw redirect(
        303,
        `/?message=${encodeURIComponent(`Already running: ${error.jobName}`)}`
      );
    }
    const message =
      error instanceof AppError
        ? error.safeMessage
        : 'Metadata refresh failed.';
    throw redirect(303, `/?message=${encodeURIComponent(message)}`);
  }

  throw redirect(303, '/');
};
