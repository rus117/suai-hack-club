import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { digest, hashPassword } from '../server/security.mjs';
import { CHALLENGE_ID, datasetCsv, scorePredictions } from '../server/challenge.mjs';

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
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : method, headers: { ...(options.production ? {origin:options.publicOrigin} : {}), cookie: cookieHeader(), 'x-csrf-token': csrf, ...(body !== undefined && !multipart ? { 'content-type': 'application/json' } : {}), ...extra }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
    for (const header of response.headers.getSetCookie()) { const pair = header.split(';')[0]; const at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    return response;
  }
  async function session() { const r = await call('/api/session'); const value = await r.json(); csrf = value.csrf; return value; }
  await session();
  async function signup(input = {}) {
    return call('/api/auth/signup',{fullName:registration.fullName,telegram:registration.telegram,password,consent:true,...input});
  }
  if (options.account !== false) assert.equal((await signup()).status,201);
  async function login() { const r = await call('/api/admin/login', { password }); assert.equal(r.status, 200); await session(); }
  async function submit(csv = datasetCsv(dataset, 'sample_submission'), extra = {}) {
    const form = new FormData(); form.set('reportUrl', 'https://github.com/example/solution'); form.set('predictions', new Blob([csv], { type: 'text/csv' }), 'predictions.csv');
    return call('/api/submissions', form, 'POST', extra);
  }
  return { call, login, signup, submit, db, dataset, session, cookieHeader, clearAccess: () => { for (const key of cookies.keys()) if (key.startsWith('suai_participant_') || key === 'suai_account') cookies.delete(key); }, setDate: value => { date = new Date(value); } };
}

test('registration, CSRF, duplicate protection and private admin data', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/admin/registrations')).status, 401);
  assert.equal((await f.call('/api/admin/export.csv')).status, 401);
  assert.equal((await f.call('/api/registrations', registration, 'POST', { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.call('/api/registrations', { ...registration, consent: false })).status, 400);
  const response = await f.call('/api/registrations', registration); assert.equal(response.status, 201);
  const receipt = await response.json(); assert.equal(receipt.receiptCode, undefined);
  assert.equal(f.db.prepare('SELECT account_id FROM registrations').get().account_id, f.db.prepare('SELECT id FROM accounts').get().id);
  const row = f.db.prepare('SELECT * FROM registrations').get(); assert.equal(typeof row.token_hash, 'string');
  assert.equal((await (await f.call('/api/auth/me')).json()).registrations[0].displayName, 'test_cat');
  assert.equal((await f.call('/api/registrations', registration)).status, 409);
  assert.equal((await f.call('/api/registrations', { ...registration, eventId: 'vibe' })).status, 201);
  assert.equal((await (await f.call('/api/auth/me')).json()).registrations.length, 2);
  await f.login(); const rows = await (await f.call('/api/admin/registrations')).json(); assert.equal(rows.registrations.length, 2);
  assert.equal(rows.registrations[0].token_hash, undefined);
});

test('CSV validation, F1, daily Moscow quota, private leaderboard, automatic access and deletion', async t => {
  const f = await fixture(t);
  const receipt = await (await f.call('/api/registrations', registration)).json();
  const perfect = 'id,survived\n' + f.dataset.test.map(row => `${row.id},${row.survived}`).join('\n');
  assert.deepEqual(scorePredictions(Buffer.from(perfect), f.dataset), { publicScore: 100, privateScore: 100 });
  assert.equal((await f.submit('id,survived\n1,2')).status, 400);
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
  f.db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)').run('a', receipt.id, 90, 20, 'https://example.com', 'a.csv', '2026-10-08T10:00:00Z', '2026-10-08', CHALLENGE_ID);
  f.db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)').run('b', receipt.id, 80, 100, 'https://example.com', 'b.csv', '2026-10-08T11:00:00Z', '2026-10-08', CHALLENGE_ID);
  f.setDate('2026-10-15T20:59:59Z'); await f.session();
  await f.call('/api/auth/logout',{});
  assert.equal((await f.signup({telegram:'@before'})).status,201);
  assert.equal((await f.call('/api/registrations', { ...registration, displayName: 'before' })).status, 201);
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
  assert.equal(csv.split('\n')[0].includes('survived'), false); assert.equal(csv.includes('isPublic'), false); assert.equal(csv.includes('partitionKey'), false);
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

test('account login, logout, isolation and registration require authentication', async t => {
  const f = await fixture(t,{account:false});
  assert.equal((await f.call('/api/registrations',registration)).status,401);
  assert.equal((await f.signup({password:'short'})).status,400);
  const response=await f.signup(); assert.equal(response.status,201);
  assert.match(response.headers.getSetCookie().join(';'),/suai_account=.*HttpOnly/);
  assert.equal((await response.json()).user.telegram,registration.telegram);
  assert.notEqual(f.db.prepare('SELECT password_hash FROM accounts').get().password_hash,password);
  assert.equal((await f.signup()).status,409);
  assert.equal((await f.call('/api/registrations',{...registration,telegram:'@imposter'})).status,201);
  assert.equal(f.db.prepare('SELECT telegram FROM registrations').get().telegram,registration.telegram);
  const oldCookies=f.cookieHeader();
  await f.call('/api/auth/logout',{});
  assert.equal((await f.submit()).status,401);
  assert.equal((await (await f.call('/api/auth/me',undefined,'GET',{cookie:oldCookies})).json()).user,null);
  assert.equal((await f.call('/api/auth/login',{telegram:registration.telegram,password:'wrong'})).status,401);
  assert.equal((await f.call('/api/auth/login',{telegram:registration.telegram.toUpperCase(),password})).status,200);
  assert.equal((await f.submit()).status,201);
  await f.call('/api/auth/logout',{});
  assert.equal((await f.signup({telegram:'@second'})).status,201);
  assert.deepEqual((await (await f.call('/api/auth/me')).json()).registrations,[]);
  assert.equal((await f.submit()).status,403);
});

test('password recovery is admin-only, single-use, expires and revokes previous access', async t => {
  const f=await fixture(t);
  const receipt=await (await f.call('/api/registrations',registration)).json();
  assert.equal((await f.call('/api/admin/accounts/recovery-link',{telegram:registration.telegram})).status,401);
  await f.login();
  const issue=async()=> (await f.call('/api/admin/accounts/recovery-link',{telegram:registration.telegram})).json();
  const tokenOf=link=>new URLSearchParams(link.path.split('#')[1]).get('token');
  const first=await issue(), second=await issue();
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(first),password})).status,410);
  const oldCookies=f.cookieHeader();
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(second),password},'POST',{'x-csrf-token':''})).status,403);
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(second),password:'short'})).status,400);
  const nextPassword='another-long-test-password';
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(second),password:nextPassword})).status,200);
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(second),password})).status,410);
  assert.equal((await f.submit()).status,201);
  assert.equal((await (await f.call('/api/auth/me',undefined,'GET',{cookie:oldCookies})).json()).user,null);
  assert.equal((await f.call('/api/auth/login',{telegram:registration.telegram,password})).status,401);
  assert.equal((await f.call('/api/auth/login',{telegram:registration.telegram,password:nextPassword})).status,200);
  const expired=await issue(); f.setDate('2026-10-07T13:00:01+03:00');
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(expired),password})).status,410);
  // A recovery link from a registration card also resets the linked account.
  const viaRegistration=await (await f.call(`/api/admin/registrations/${receipt.id}/recovery-link`,{})).json();
  assert.equal((await f.call('/api/participant/restore',{token:tokenOf(viaRegistration),password})).status,200);
  f.setDate('2026-11-07T12:00:00+03:00');
  assert.equal((await (await f.call('/api/auth/me')).json()).user,null);
});

test('legacy registrations can only be attached with proof of previous access', async t => {
  const f=await fixture(t,{account:false});
  f.db.prepare(`INSERT INTO registrations (id,event_id,full_name,telegram,display_name,team_mode,team_name,experience,token_hash,consent_version,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run('legacy','start','Тестовый Участник',registration.telegram,'legacy_cat','solo','','beginner',digest('legacy-test-token'),'2026-10-07','2026-10-07T09:00:00Z');
  assert.equal((await f.signup()).status,409);
  assert.equal((await f.call('/api/participant/migrate',{eventId:'start',token:'wrong'})).status,403);
  assert.equal((await f.call('/api/participant/migrate',{eventId:'start',token:'legacy-test-token'})).status,200);
  assert.equal((await f.signup()).status,201);
  const me=await (await f.call('/api/auth/me')).json();
  assert.equal(me.registrations[0].id,'legacy');
  assert.equal((await f.submit()).status,201);
  assert.equal((await f.call('/api/participant/migrate',{eventId:'start',token:'legacy-test-token'})).status,403);
});

test('legacy recovery creates an account and a linked application without losing results', async t => {
  const f=await fixture(t,{account:false});
  f.db.prepare(`INSERT INTO registrations (id,event_id,full_name,telegram,display_name,team_mode,team_name,experience,token_hash,consent_version,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run('old','start','Прежний Участник',registration.telegram,'old_cat','solo','','beginner',digest('old-token'),'2026-10-07','2026-10-07T09:00:00Z');
  f.db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)').run('old-submission','old',71,62,'https://example.com','old.csv','2026-10-07T10:00:00Z','2026-10-07', CHALLENGE_ID);
  await f.login();
  const link=await (await f.call('/api/admin/registrations/old/recovery-link',{})).json();
  const restored=await f.call('/api/participant/restore',{token:new URLSearchParams(link.path.split('#')[1]).get('token'),password});
  assert.equal(restored.status,200);
  const me=await restored.json(); assert.equal(me.registrations[0].score,71); assert.equal(me.registrations[0].submissions,1);
  await f.call('/api/auth/logout',{});
  assert.equal((await f.call('/api/auth/login',{telegram:registration.telegram,password})).status,200);
  assert.equal((await f.submit()).status,201);
});

test('organizer role requires the existing admin password and belongs to the account session', async t => {
  const f = await fixture(t, { account: false });
  assert.equal((await f.signup({ telegram: '@ryctam9' })).status, 201);
  assert.equal((await (await f.call('/api/auth/me')).json()).user.isAdmin, false);
  assert.equal((await f.call('/api/admin/registrations')).status, 401);
  assert.equal((await f.call('/api/admin/organizer-account', {})).status, 403);
  await f.login();
  assert.equal((await f.call('/api/admin/organizer-account', {}, 'POST', { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.call('/api/admin/organizer-account', {})).status, 200);
  assert.equal((await (await f.call('/api/auth/me')).json()).user.isAdmin, true);
  assert.equal((await f.call('/api/admin/registrations')).status, 200);
  assert.equal((await f.call('/api/admin/logout', {})).status, 200);
  assert.equal((await f.call('/api/admin/registrations')).status, 401);
  await f.session();
  assert.equal((await f.call('/api/auth/login', { telegram: '@ryctam9', password })).status, 200);
  assert.equal((await f.call('/api/admin/registrations')).status, 200);
  assert.equal((await f.call('/api/auth/logout', {})).status, 200);
  assert.equal((await f.call('/api/admin/registrations')).status, 401);
  assert.equal((await f.signup({ telegram: '@another_user' })).status, 201);
  assert.equal((await (await f.call('/api/auth/me')).json()).user.isAdmin, false);
  assert.equal((await f.call('/api/admin/registrations')).status, 401);
});
