import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDictionary } from '$lib/i18n';
import {
  setAdminSession,
  validateAdminCredentials
} from '$lib/server/auth/admin';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';

const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const rateLimitWindowMs = 60_000;
const maxFailedAttempts = 8;
const maxLoginBodyBytes = 4096;
const maxTrackedClients = 10_000;

export function _loginClientKey(getClientAddress: () => string): string {
  return getClientAddress();
}

function cleanupFailedAttempts(now: number): void {
  for (const [key, attempt] of failedAttempts) {
    if (attempt.resetAt <= now) failedAttempts.delete(key);
  }

  while (failedAttempts.size > maxTrackedClients) {
    const oldest = failedAttempts.keys().next();
    if (oldest.done) break;
    failedAttempts.delete(oldest.value);
  }
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  cleanupFailedAttempts(now);
  const attempt = failedAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) return false;
  return attempt.count >= maxFailedAttempts;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  cleanupFailedAttempts(now);
  const current = failedAttempts.get(key);
  if (!current || current.resetAt <= now) {
    failedAttempts.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return;
  }
  current.count += 1;
}

function clearFailedAttempts(key: string): void {
  failedAttempts.delete(key);
}

export const POST: RequestHandler = async ({
  cookies,
  request,
  getClientAddress
}) => {
  const key = _loginClientKey(getClientAddress);
  if (rateLimited(key)) {
    return json({ error: 'Too many failed login attempts.' }, { status: 429 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxLoginBodyBytes) {
    return json({ error: 'Login request is too large.' }, { status: 413 });
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!validateAdminCredentials(username, password)) {
    recordFailedAttempt(key);
    const language = new SettingsRepository(getDatabase()).getLanguage();
    return json(
      { error: getDictionary(language).invalidLogin },
      { status: 401 }
    );
  }

  clearFailedAttempts(key);
  setAdminSession(cookies);
  return json({ ok: true });
};
