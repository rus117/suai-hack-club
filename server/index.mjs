import { createApp } from './app.mjs';

const production = process.env.NODE_ENV === 'production';
if (production && (!process.env.PUBLIC_ORIGIN?.startsWith('https://') || !process.env.ADMIN_PASSWORD_HASH)) {
  throw new Error('Production requires PUBLIC_ORIGIN=https://... and ADMIN_PASSWORD_HASH. See README.md.');
}
const { app, db } = createApp({
  dbPath: process.env.DB_PATH || 'data/club.sqlite',
  datasetPath: process.env.DATASET_PATH || 'data/dataset.json',
  datasetSecret: process.env.DATASET_SECRET,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
  production, publicOrigin: process.env.PUBLIC_ORIGIN,
});
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`SUAI Hack Club: http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
