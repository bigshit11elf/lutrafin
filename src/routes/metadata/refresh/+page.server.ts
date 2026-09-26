import { fail, redirect } from '@sveltejs/kit';
import { createRefreshSeriesMetadata } from '$lib/server/application/factories/refresh-metadata';
import { AppError } from '$lib/server/errors/domain-errors';

export const actions = {
  default: async () => {
    try {
      await createRefreshSeriesMetadata().refreshDue(50);
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.safeMessage
          : 'Metadata refresh failed.';
      return fail(500, { message });
    }

    throw redirect(303, '/');
  }
};
