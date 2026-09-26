import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/admin';
import { safeRedirectPath } from '$lib/server/http/redirects';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import {
  notificationProviders,
  SettingsRepository,
  type NotificationProviderId
} from '$lib/server/infrastructure/database/repositories/settings-repository';
import { NotificationDeliveryService } from '$lib/server/notifications/delivery-service';

async function requestData(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.includes('application/json')) {
    const data = await request.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }
  const form = await request.formData();
  const data: Record<string, string | string[]> = {};
  for (const [key, value] of form.entries()) {
    const stringValue = String(value);
    const existing = data[key];
    if (existing === undefined) data[key] = stringValue;
    else if (Array.isArray(existing)) existing.push(stringValue);
    else data[key] = [existing, stringValue];
  }
  return data;
}

function text(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function list(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' && value ? [value] : [];
}

function mergeConfig(
  existing: Record<string, unknown>,
  data: Record<string, unknown>,
  provider: NotificationProviderId
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    ...existing,
    enabled: data[`${provider}.enabled`] === 'on'
  };
  for (const key of ['serverUrl', 'topic', 'webhookUrl', 'device']) {
    const value = text(data, `${provider}.${key}`);
    if (value) config[key] = value;
    else if (Object.hasOwn(data, `${provider}.${key}`)) delete config[key];
  }
  for (const key of ['token', 'userKey', 'applicationToken']) {
    const value = text(data, `${provider}.${key}`);
    if (value) config[key] = value;
  }
  const priority = Number(text(data, `${provider}.priority`));
  if (Number.isFinite(priority)) config.priority = priority;
  return config;
}

export const POST: RequestHandler = async ({ cookies, request, url }) => {
  requireAdmin(cookies);
  const data = await requestData(request);
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  const settings = new SettingsRepository(getDatabase());
  const action = text(data, 'action') || 'save';
  const resetProvider = action.startsWith('reset:')
    ? action.slice('reset:'.length)
    : undefined;
  settings.setNotificationEventTypes(list(data, 'eventTypes'));
  for (const provider of notificationProviders) {
    if (resetProvider === provider.id) {
      settings.setNotificationProviderConfig(provider.id, {});
      continue;
    }
    settings.setNotificationProviderConfig(
      provider.id,
      mergeConfig(
        settings.getNotificationProviderConfig(provider.id),
        data,
        provider.id
      )
    );
  }
  const testCount =
    action === 'test' ? await new NotificationDeliveryService().sendTest() : 0;
  if (wantsJson) return json({ ok: true, action, testCount });
  throw redirect(
    303,
    safeRedirectPath(
      url.searchParams.get('returnTo'),
      '/settings#notifications'
    )
  );
};
