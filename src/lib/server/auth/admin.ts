import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import * as schema from '$lib/server/infrastructure/database/schema';
import { eq, lt } from 'drizzle-orm';

const cookieName = 'lutrafin-admin';
const sessionMaxAgeSeconds = 60 * 60 * 12;
const processStartedAt = new Date().toISOString();

function sessionHash(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function isAdminSession(cookies: import('@sveltejs/kit').Cookies) {
  const config = loadConfig();
  if (!config.admin) return false;
  const sessionId = cookies.get(cookieName);
  if (!sessionId) return false;
  const now = new Date().toISOString();
  const session = getDatabase()
    .select()
    .from(schema.adminSessions)
    .where(eq(schema.adminSessions.idHash, sessionHash(sessionId)))
    .get();
  return Boolean(
    session &&
    session.username === config.admin.username &&
    !session.invalidatedAt &&
    session.createdAt >= processStartedAt &&
    session.expiresAt > now
  );
}

export function requireAdmin(cookies: import('@sveltejs/kit').Cookies): void {
  if (!isAdminSession(cookies)) throw redirect(303, '/login');
}

export function setAdminSession(
  cookies: import('@sveltejs/kit').Cookies
): void {
  const config = loadConfig();
  if (!config.admin) throw new Error('Admin credentials are not configured.');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionMaxAgeSeconds * 1000);
  const sessionId = randomBytes(32).toString('base64url');
  const db = getDatabase();
  db.delete(schema.adminSessions)
    .where(lt(schema.adminSessions.expiresAt, now.toISOString()))
    .run();
  db.insert(schema.adminSessions)
    .values({
      idHash: sessionHash(sessionId),
      username: config.admin.username,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    })
    .run();
  cookies.set(cookieName, sessionId, {
    path: '/',
    httpOnly: true,
    secure: new URL(config.appBaseUrl).protocol === 'https:',
    sameSite: 'strict',
    maxAge: sessionMaxAgeSeconds
  });
}

export function clearAdminSession(
  cookies: import('@sveltejs/kit').Cookies
): void {
  const sessionId = cookies.get(cookieName);
  if (sessionId) {
    getDatabase()
      .update(schema.adminSessions)
      .set({ invalidatedAt: new Date().toISOString() })
      .where(eq(schema.adminSessions.idHash, sessionHash(sessionId)))
      .run();
  }
  cookies.delete(cookieName, { path: '/' });
}

export function validateAdminCredentials(
  username: string,
  password: string
): boolean {
  if (username.trim().length === 0 || password.length === 0) return false;
  const config = loadConfig();
  if (!config.admin) return false;
  return (
    safeEqual(username, config.admin.username) &&
    safeEqual(password, config.admin.password)
  );
}
