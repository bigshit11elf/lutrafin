import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { providerLookups } from '$lib/server/infrastructure/database/schema';

export const POST: RequestHandler = ({ cookies }) => {
  requireAdmin(cookies);
  getDatabase().delete(providerLookups).run();
  throw redirect(303, '/metadata/status?message=status-cleared');
};
