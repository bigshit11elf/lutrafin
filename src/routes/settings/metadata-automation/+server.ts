import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

async function requestData(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.includes('application/json')) {
    const data = await request.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function text(
  data: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const value = data[key];
  return typeof value === 'string' ? value : fallback;
}

export const POST: RequestHandler = async ({ cookies, request, url }) => {
  requireAdmin(cookies);
  const data = await requestData(request);
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  const settings = new SettingsRepository(getDatabase());
  settings.setJellyfinSyncInterval(text(data, 'jellyfinSyncInterval', '6h'));
  settings.setMetadataRefreshInterval(
    text(data, 'metadataRefreshInterval', '24h')
  );
  settings.setMetadataFullRefreshInterval(
    text(data, 'metadataFullRefreshInterval', '7d')
  );
  if (wantsJson) return json({ ok: true });
  throw redirect(
    303,
    safeRedirectPath(url.searchParams.get('returnTo'), '/settings#automation')
  );
};
