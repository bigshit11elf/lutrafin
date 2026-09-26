import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

export const POST: RequestHandler = ({ cookies }) => {
  requireAdmin(cookies);
  new ShoppingListRepository(getDatabase()).clear();
  throw redirect(303, '/shopping-list');
};
