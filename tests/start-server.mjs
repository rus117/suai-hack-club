import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';
const { app } = createApp({ dbPath: ':memory:', datasetPath: null, datasetSecret: 'browser-tests-only-secret-2026', adminPasswordHash: hashPassword('browser-test-password'), now: () => new Date('2026-10-07T12:00:00+03:00') });
app.listen(4174, '127.0.0.1', () => console.log('Test server ready'));
