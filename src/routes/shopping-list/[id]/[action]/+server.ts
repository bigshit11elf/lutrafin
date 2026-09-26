import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { ShoppingListRepository } from '$lib/server/infrastructure/database/repositories/shopping-list-repository';

export const POST: RequestHandler = ({ cookies, params }) => {
  requireAdmin(cookies);
  const repository = new ShoppingListRepository(getDatabase());
  if (params.action === 'up') repository.move(params.id, 'up');
  if (params.action === 'down') repository.move(params.id, 'down');
  if (params.action === 'remove') repository.remove(params.id);
  throw redirect(303, '/shopping-list');
};
