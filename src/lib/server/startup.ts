import { runMigrations } from '$lib/server/infrastructure/database/migrate';
import { startBackgroundJobs } from '$lib/server/jobs/scheduler';

let started = false;

export function startServerProcess(): void {
  if (started) return;
  runMigrations();
  startBackgroundJobs();
  started = true;
}
