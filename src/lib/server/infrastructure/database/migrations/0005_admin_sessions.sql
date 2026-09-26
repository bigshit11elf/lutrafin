CREATE TABLE IF NOT EXISTS admin_sessions (
  id_hash TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  invalidated_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);
