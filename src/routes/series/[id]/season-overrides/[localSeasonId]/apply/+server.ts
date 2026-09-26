import { redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import * as schema from '$lib/server/infrastructure/database/schema';

export const POST: RequestHandler = ({ cookies, params, url }) => {
  requireAdmin(cookies);
  const mappedSeasonNumber = Number(url.searchParams.get('to'));
  if (!Number.isInteger(mappedSeasonNumber) || mappedSeasonNumber <= 0) {
    throw redirect(303, safeRedirectPath(url.searchParams.get('returnTo')));
  }

  const db = getDatabase();
  const season = db
    .select({
      id: schema.localSeasons.id,
      parentSeriesId: schema.localSeasons.parentSeriesId,
      seasonNumber: schema.localSeasons.seasonNumber
    })
    .from(schema.localSeasons)
    .where(
      and(
        eq(schema.localSeasons.id, params.localSeasonId),
        eq(schema.localSeasons.parentSeriesId, params.id),
        isNull(schema.localSeasons.removedFromJellyfinAt)
      )
    )
    .get();

  if (season) {
    const now = new Date().toISOString();
    db.insert(schema.localSeasonNumberOverrides)
      .values({
        localSeasonId: season.id,
        mediaEntityId: season.parentSeriesId,
        originalSeasonNumber: season.seasonNumber,
        mappedSeasonNumber,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: schema.localSeasonNumberOverrides.localSeasonId,
        set: {
          originalSeasonNumber: season.seasonNumber,
          mappedSeasonNumber,
          updatedAt: now
        }
      })
      .run();
  }

  throw redirect(303, safeRedirectPath(url.searchParams.get('returnTo')));
};
