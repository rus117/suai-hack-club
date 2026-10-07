import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const source = resolve(process.env.DATA_DIR || 'data');
const destination = resolve(process.argv[2] || `backups/${new Date().toISOString().replaceAll(':', '-')}`);
mkdirSync(destination, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(source, 'club.sqlite'), { readOnly: true });
try {
  await backup(db, join(destination, 'club.sqlite'));
  for (const file of readdirSync(source).filter(name => /^dataset(?:-titanic-v1)?\.json$/.test(name))) {
    copyFileSync(join(source,file),join(destination,file)); chmodSync(join(destination,file),0o600);
  }
  chmodSync(join(destination, 'club.sqlite'), 0o600);
  console.log(`Backup saved to ${destination}. Keep it private.`);
} finally { db.close(); }
