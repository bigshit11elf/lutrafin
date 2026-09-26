import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { syncRuns } from '$lib/server/infrastructure/database/schema';

export const POST: RequestHandler = ({ cookies }) => {
  requireAdmin(cookies);
  getDatabase().delete(syncRuns).run();
  throw redirect(303, '/sync?message=status-cleared');
};
