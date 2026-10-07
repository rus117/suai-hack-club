import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, full_name TEXT NOT NULL,
      telegram TEXT NOT NULL, display_name TEXT NOT NULL, team_mode TEXT NOT NULL,
      team_name TEXT NOT NULL, experience TEXT NOT NULL, token_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registered', consent_version TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(event_id, telegram),
      UNIQUE(event_id, display_name)
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, registration_id TEXT NOT NULL REFERENCES registrations(id),
      public_score REAL NOT NULL, private_score REAL NOT NULL,
      report_url TEXT NOT NULL, filename TEXT NOT NULL, created_at TEXT NOT NULL,
      day TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS submissions_registration ON submissions(registration_id, public_score DESC);
    CREATE TABLE IF NOT EXISTS limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL
    );
  `);
  return db;
}
