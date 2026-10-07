import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { digest, hashPassword } from '../server/security.mjs';
import { datasetCsv, scorePredictions } from '../server/challenge.mjs';

const password = 'test-only-password-not-for-deployment';
const hash = hashPassword(password);
const registration = { eventId: 'start', fullName: 'Тестовый Участник', telegram: '@test_user', displayName: 'test_cat', teamMode: 'looking', experience: 'beginner', consent: true };
async function fixture(t, options = {}) {
  let date = new Date('2026-10-07T12:00:00+03:00');
  const { app, db, dataset } = createApp({ dbPath: ':memory:', datasetPath: null, datasetSecret: 'tests-only-dataset-secret-2026', adminPasswordHash: hash, now: () => date, ...options });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = new Map();
  let csrf = '';
  const cookieHeader = () => [...cookies].map(([key,value]) => `${key}=${value}`).join('; ');
  async function call(path, body, method = 'POST', extra = {}) {
    const multipart = body instanceof FormData;
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : method, headers: { cookie: cookieHeader(), 'x-csrf-token': csrf, ...(body !== undefined && !multipart ? { 'content-type': 'application/json' } : {}), ...extra }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
    for (const header of response.headers.getSetCookie()) { const pair = header.split(';')[0]; const at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    return response;
  }
  async function session() { const r = await call('/api/session'); const value = await r.json(); csrf = value.csrf; return value; }
  await session();
  async function login() { const r = await call('/api/admin/login', { password }); assert.equal(r.status, 200); await session(); }
  async function submit(csv = datasetCsv(dataset, 'sample_submission'), extra = {}) {
    const form = new FormData(); form.set('reportUrl', 'https://github.com/example/solution'); form.set('predictions', new Blob([csv], { type: 'text/csv' }), 'predictions.csv');
    return call('/api/submissions', form, 'POST', extra);
  }
  return { call, login, submit, db, dataset, session, cookieHeader, clearAccess: () => { for (const key of cookies.keys()) if (key.startsWith('suai_participant_')) cookies.delete(key); }, setDate: value => { date = new Date(value); } };
}

test('registration, CSRF, duplicate protection and private admin data', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/admin/registrations')).status, 401);
  assert.equal((await f.call('/api/admin/export.csv')).status, 401);
  assert.equal((await f.call('/api/registrations', registration, 'POST', { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.call('/api/registrations', { ...registration, consent: false })).status, 400);
  const response = await f.call('/api/registrations', registration); assert.equal(response.status, 201);
  const receipt = await response.json(); assert.equal(receipt.receiptCode, undefined);
  assert.match(response.headers.getSetCookie().join(';'), /suai_participant_start=.*HttpOnly/);
  const row = f.db.prepare('SELECT * FROM registrations').get(); assert.equal(typeof row.token_hash, 'string');
  assert.equal((await (await f.call('/api/participant')).json()).participants[0].displayName, 'test_cat');
  assert.equal((await f.call('/api/registrations', registration)).status, 409);
  assert.equal((await f.call('/api/registrations', { ...registration, eventId: 'vibe' })).status, 201);
  assert.equal((await (await f.call('/api/participant')).json()).participants.length, 2);
  await f.login(); const rows = await (await f.call('/api/admin/registrations')).json(); assert.equal(rows.registrations.length, 2);
  assert.equal(rows.registrations[0].token_hash, undefined);
});

test('CSV validation, F1, daily Moscow quota, private leaderboard, automatic access and deletion', async t => {
  const f = await fixture(t);
  const receipt = await (await f.call('/api/registrations', registration)).json();
  const perfect = 'id,busy\n' + f.dataset.test.map(row => `${row.id},${row.busy}`).join('\n');
  assert.deepEqual(scorePredictions(Buffer.from(perfect), f.dataset), { publicScore: 100, privateScore: 100 });
  assert.equal((await f.submit('id,busy\n1,2')).status, 400);
  assert.equal((await f.submit(perfect)).status, 201);
  for (let i = 0; i < 4; i++) assert.equal((await f.submit()).status, 201);
  assert.equal((await f.submit()).status, 429);
  const board = await (await f.call('/api/leaderboard')).json();
  assert.equal(board.entries[0].score, 100); assert.equal(board.entries[0].attempts, 5);
  assert.equal(JSON.stringify(board).includes('@test_user'), false); assert.equal(JSON.stringify(board).includes('private'), false);
  f.setDate('2026-10-07T21:00:01Z'); await f.session(); assert.equal((await f.submit()).status, 201);
  await f.login();
  assert.equal((await f.call(`/api/admin/registrations/${receipt.id}`, { status: 'withdrawn' }, 'PATCH')).status, 200);
  assert.equal((await (await f.call('/api/leaderboard')).json()).entries.length, 0);
  assert.equal((await f.submit()).status, 403);
  assert.equal((await f.call(`/api/admin/registrations/${receipt.id}`, {}, 'DELETE')).status, 200);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM submissions').get().n, 0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM participant_sessions').get().n, 0);
});

test('deadline is exclusive Moscow midnight; final score uses best public submission', async t => {
  const f = await fixture(t);
  const receipt = await (await f.call('/api/registrations', registration)).json();
  f.db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?)').run('a', receipt.id, 90, 20, 'https://example.com', 'a.csv', '2026-10-08T10:00:00Z', '2026-10-08');
  f.db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?)').run('b', receipt.id, 80, 100, 'https://example.com', 'b.csv', '2026-10-08T11:00:00Z', '2026-10-08');
  f.setDate('2026-10-15T20:59:59Z'); await f.session();
  assert.equal((await f.call('/api/registrations', { ...registration, telegram: '@before', displayName: 'before' })).status, 201);
  f.setDate('2026-10-15T21:00:00Z');
  assert.equal((await f.call('/api/registrations', { ...registration, telegram: '@afterr', displayName: 'after' })).status, 410);
  assert.equal((await f.submit()).status, 410);
  const board = await (await f.call('/api/leaderboard')).json(); assert.equal(board.final, true); assert.equal(board.entries[0].score, 20);
  assert.equal((await f.call('/api/registrations', { ...registration, eventId: 'vibe' })).status, 201);
  f.setDate('2026-10-27T21:00:00Z'); await f.session();
  assert.equal((await f.call('/api/registrations', { ...registration, eventId: 'vibe', telegram: '@closed', displayName: 'closed' })).status, 410);
});

test('dataset downloads do not reveal targets or hidden partition; export neutralizes formulas', async t => {
  const f = await fixture(t);
  const csv = await (await f.call('/api/challenge/test.csv')).text();
  assert.equal(csv.split('\n')[0].includes('busy'), false); assert.equal(csv.includes('isPublic'), false); assert.equal(csv.includes('partitionKey'), false);
  assert.equal((await f.call('/api/challenge/dataset.json')).status, 404);
  const receipt = await f.call('/api/registrations', { ...registration, fullName: '=HYPERLINK("https://example.com")' }); assert.equal(receipt.status, 201);
  await f.login(); const exported = await (await f.call('/api/admin/export.csv')).text(); assert.ok(exported.includes("'=HYPERLINK"));
  assert.equal(exported.includes('token_hash'), false);
});

test('production rejects foreign origin and uses secure session cookies', async t => {
  const f = await fixture(t, { production: true, publicOrigin: 'https://peredovikov.ru' });
  const session = await f.call('/api/session', undefined, 'GET', { cookie: '' });
  assert.match(session.headers.get('set-cookie'), /Secure/);
  await f.session();
  assert.equal((await f.call('/api/registrations', registration, 'POST', { origin: 'https://other.example' })).status, 403);
  assert.equal((await f.call('/api/registrations', registration, 'POST', { origin: 'https://peredovikov.ru' })).status, 201);
});

test('recovery is admin-only, expiring, single-use and revokes old browser access', async t => {
  const f = await fixture(t);
  const receipt = await (await f.call('/api/registrations', registration)).json();
  const oldCookies = f.cookieHeader();
  assert.equal((await f.call(`/api/admin/registrations/${receipt.id}/recovery-link`, {})).status, 401);
  await f.login();
  const issue = async () => (await f.call(`/api/admin/registrations/${receipt.id}/recovery-link`, {})).json();
  const link = await issue();
  const token = new URLSearchParams(link.path.split('#')[1]).get('token');
  f.clearAccess();
  assert.equal((await f.submit()).status, 403);
  assert.equal((await f.call('/api/participant/restore', { token }, 'POST', { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.call('/api/participant/restore', { token })).status, 200);
  assert.equal((await f.submit()).status, 201);
  assert.equal((await f.call('/api/participant/restore', { token })).status, 410);
  const expiredLink = await issue();
  f.setDate('2026-10-07T13:00:01+03:00');
  assert.equal((await f.call('/api/participant/restore', { token: new URLSearchParams(expiredLink.path.split('#')[1]).get('token') })).status, 410);
  assert.deepEqual((await (await f.call('/api/participant', undefined, 'GET', { cookie: oldCookies })).json()).participants, []);
  f.setDate('2026-11-07T12:00:00+03:00');
  assert.deepEqual((await (await f.call('/api/participant')).json()).participants, []);
});

test('legacy saved credentials migrate once without exposing them in registration responses', async t => {
  const f = await fixture(t);
  const receipt = await (await f.call('/api/registrations', registration)).json();
  f.db.prepare('UPDATE registrations SET token_hash=? WHERE id=?').run(digest('legacy-test-token'), receipt.id);
  f.clearAccess();
  assert.equal((await f.call('/api/participant/migrate', { eventId: 'start', token: 'wrong' })).status, 403);
  assert.equal((await f.call('/api/participant/migrate', { eventId: 'start', token: 'legacy-test-token' })).status, 200);
  assert.equal((await f.submit()).status, 201);
  assert.equal((await f.call('/api/participant/migrate', { eventId: 'start', token: 'legacy-test-token' })).status, 403);
});
