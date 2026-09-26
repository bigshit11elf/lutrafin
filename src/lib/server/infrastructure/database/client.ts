import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { loadConfig } from '$lib/server/config/app-config';
import * as schema from './schema';

export type DatabaseClient = ReturnType<typeof getDatabase>;

let sqlite: Database.Database | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getSqliteConnection(): Database.Database {
  if (sqlite) {
    return sqlite;
  }

  const config = loadConfig();
  mkdirSync(dirname(config.databasePath), { recursive: true });
  sqlite = new Database(config.databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  return sqlite;
}

export function getDatabase() {
  if (!database) {
    database = drizzle(getSqliteConnection(), { schema });
  }

  return database;
}

export function checkDatabaseReady(): void {
  getDatabase().run(sql`select 1`);
}
