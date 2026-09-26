import type { Handle } from '@sveltejs/kit';
import { isAdminSession } from '$lib/server/auth/admin';
import { loadConfig } from '$lib/server/config/app-config';
import { runMigrations } from '$lib/server/infrastructure/database/migrate';
import { startBackgroundJobs } from '$lib/server/jobs/scheduler';

const securityHeaders = {
  'content-security-policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'"
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

let migrationsApplied = false;

function themeAttributes(theme: string | undefined): string {
  if (theme === 'light' || theme === 'dark') {
    return ` data-theme="${theme}" data-theme-preference="${theme}"`;
  }

  return ' data-theme-preference="system"';
}

function ensureMigrationsApplied(): void {
  if (!migrationsApplied) {
    runMigrations();
    startBackgroundJobs();
    migrationsApplied = true;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  ensureMigrationsApplied();
  event.locals.requestId = crypto.randomUUID();
  event.locals.admin = isAdminSession(event.cookies);

  if (event.request.method === 'POST') {
    console.info('incoming POST request', {
      requestId: event.locals.requestId,
      urlOrigin: event.url.origin,
      originHeader: event.request.headers.get('origin'),
      hostHeader: event.request.headers.get('host'),
      forwardedHostHeader: event.request.headers.get('x-forwarded-host'),
      forwardedProtoHeader: event.request.headers.get('x-forwarded-proto'),
      configuredOrigin: process.env.ORIGIN ?? null,
      configuredHostHeader: process.env.HOST_HEADER ?? null,
      configuredProtocolHeader: process.env.PROTOCOL_HEADER ?? null
    });
  }

  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace(
        '%lutrafin.theme%',
        themeAttributes(event.cookies.get('lutrafin-theme'))
      )
  });

  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }

  const config = loadConfig();
  if (
    config.security.hstsEnabled &&
    new URL(config.appBaseUrl).protocol === 'https:'
  ) {
    response.headers.set(
      'strict-transport-security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return response;
};
