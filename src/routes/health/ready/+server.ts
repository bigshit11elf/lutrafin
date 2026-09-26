import { json } from '@sveltejs/kit';
import { checkDatabaseReady } from '$lib/server/infrastructure/database/client';

export function GET() {
  try {
    checkDatabaseReady();
    return json({ status: 'ready', checks: { database: 'ok' } });
  } catch {
    return json(
      { status: 'not_ready', checks: { database: 'failed' } },
      { status: 503 }
    );
  }
}
