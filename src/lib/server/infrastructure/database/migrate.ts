import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDatabase } from './client';

export function runMigrations(): void {
  migrate(getDatabase(), {
    migrationsFolder: 'src/lib/server/infrastructure/database/migrations'
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
