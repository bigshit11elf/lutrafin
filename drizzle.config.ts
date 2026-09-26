import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/infrastructure/database/schema.ts',
  out: './src/lib/server/infrastructure/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './data/app.db'
  }
});
