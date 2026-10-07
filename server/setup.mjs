import { existsSync, writeFileSync } from 'node:fs';
import { randomToken, hashPassword } from './security.mjs';

if (existsSync('.env')) {
  console.error('.env already exists. No changes made.');
  process.exit(1);
}
const password = randomToken();
writeFileSync('.env', `PORT=3000\nHOST=127.0.0.1\nPUBLIC_ORIGIN=https://peredovikov.ru\nDATASET_SECRET=${randomToken()}\nADMIN_PASSWORD_HASH=${hashPassword(password)}\n`, { mode: 0o600, flag: 'wx' });
writeFileSync('.admin-password', password + '\n', { mode: 0o600, flag: 'wx' });
console.log('Created .env and .admin-password. Keep both private. Admin page: /admin');
