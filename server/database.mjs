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
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, telegram TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, consent_version TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_recovery (
      token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, full_name TEXT NOT NULL,
      telegram TEXT NOT NULL, display_name TEXT NOT NULL, team_mode TEXT NOT NULL,
      team_name TEXT NOT NULL, experience TEXT NOT NULL, token_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registered', consent_version TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(event_id, telegram),
      UNIQUE(event_id, display_name)
    );
    CREATE TABLE IF NOT EXISTS participant_sessions (
      token_hash TEXT PRIMARY KEY, registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS participant_sessions_registration ON participant_sessions(registration_id);
    CREATE TABLE IF NOT EXISTS participant_recovery (
      token_hash TEXT PRIMARY KEY, registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
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
  if (!db.prepare('PRAGMA table_info(accounts)').all().some(column => column.name === 'is_admin')) {
    db.exec('ALTER TABLE accounts ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  }
  if (!db.prepare('PRAGMA table_info(registrations)').all().some(column => column.name === 'account_id')) {
    db.exec('ALTER TABLE registrations ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL');
  }
  if (!db.prepare('PRAGMA table_info(submissions)').all().some(column => column.name === 'challenge_id')) {
    db.exec("ALTER TABLE submissions ADD COLUMN challenge_id TEXT NOT NULL DEFAULT 'cafe-v1'");
  }
  db.exec('CREATE INDEX IF NOT EXISTS submissions_challenge ON submissions(challenge_id,registration_id)');
  db.exec('CREATE INDEX IF NOT EXISTS registrations_account ON registrations(account_id)');
  return db;
}
