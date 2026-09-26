import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsPath = join(
  process.cwd(),
  'src/lib/server/infrastructure/database/migrations'
);

describe('database migrations', () => {
  it('registers every SQL migration in the Drizzle journal', () => {
    const sqlMigrations = readdirSync(migrationsPath)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => basename(file, '.sql'))
      .sort();
    const journal = JSON.parse(
      readFileSync(join(migrationsPath, 'meta/_journal.json'), 'utf8')
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.map((entry) => entry.tag).sort()).toEqual(
      sqlMigrations
    );
  });
});
