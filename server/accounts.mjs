import { CHALLENGE_ID } from './challenge.mjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, hashPassword, randomToken, requireAdmin, requireCsrf, verifyPassword } from './security.mjs';

export const passwordSchema = z.string().min(12, 'Пароль должен содержать не меньше 12 символов.').max(128, 'Пароль слишком длинный.');
const telegramSchema = z.string().trim().regex(/^@[A-Za-z0-9_]{5,32}$/, 'Укажи Telegram в формате @username.').transform(value => value.toLowerCase());
const lifetime = 30 * 24 * 60 * 60 * 1000;
export function accounts(app, db, { now, production, limit, access }) {
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/' };
  const cookieToken = req => req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('suai_account='))?.slice(13);
  function find(req) {
    const token = cookieToken(req);
    return token ? db.prepare('SELECT a.* FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>?').get(digest(token), now().getTime()) : null;
  }
  function grant(res, account) {
    const token = randomToken();
    db.prepare('DELETE FROM account_sessions WHERE expires<=?').run(now().getTime());
    db.prepare('INSERT INTO account_sessions VALUES (?,?,?)').run(digest(token), account.id, now().getTime() + lifetime);
    res.cookie('suai_account', token, { ...cookieOptions, maxAge: lifetime });
  }
  function requireAccount(req, res, next) {
    req.account = find(req);
    if (!req.account) return res.status(401).json({ error: 'Сначала войди в аккаунт сайта.' });
    next();
  }
  function profile(account) {
    if (!account) return { user: null, registrations: [] };
    const registrations = db.prepare(`SELECT r.id,r.event_id AS eventId,r.display_name AS displayName,r.status,
      (SELECT count(*) FROM submissions WHERE registration_id=r.id AND challenge_id='${CHALLENGE_ID}') AS submissions,
      (SELECT max(public_score) FROM submissions WHERE registration_id=r.id AND challenge_id='${CHALLENGE_ID}') AS score
      FROM registrations r WHERE r.account_id=?`).all(account.id);
    return { user: { id: account.id, fullName: account.full_name, telegram: account.telegram, isAdmin: Boolean(account.is_admin) }, registrations };
  }
  function create({ telegram, fullName, password }) {
    const account = { id: randomUUID(), telegram, full_name: fullName };
    db.prepare('INSERT INTO accounts (id,telegram,full_name,password_hash,consent_version,created_at) VALUES (?,?,?,?,?,?)').run(account.id, telegram, fullName, hashPassword(password), '2026-10-07', now().toISOString());
    return account;
  }
  function linkLegacy(account) {
    db.prepare('UPDATE registrations SET account_id=?, token_hash=? WHERE telegram=? AND account_id IS NULL').run(account.id, digest(randomToken()), account.telegram);
    db.prepare('DELETE FROM participant_sessions WHERE registration_id IN (SELECT id FROM registrations WHERE account_id=?)').run(account.id);
    db.prepare('DELETE FROM participant_recovery WHERE registration_id IN (SELECT id FROM registrations WHERE account_id=?)').run(account.id);
  }
  app.get('/api/auth/me', (req,res) => res.json(profile(find(req))));
  app.post('/api/auth/signup', requireCsrf, limit('signup', 30), (req,res) => {
    const parsed = z.object({ telegram: telegramSchema, fullName: z.string().trim().min(2).max(100), password: passwordSchema, consent: z.literal(true) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const input = parsed.data;
    if (db.prepare('SELECT id FROM accounts WHERE telegram=?').get(input.telegram)) return res.status(409).json({ error: 'Аккаунт уже существует. Войди или восстанови пароль через организатора.' });
    const legacy = db.prepare('SELECT id FROM registrations WHERE telegram=?').get(input.telegram);
    if (legacy && !['start','vibe'].some(id => access.find(req,id)?.telegram === input.telegram)) return res.status(409).json({ error: 'Для этого Telegram уже есть заявка. Открой сайт в прежнем браузере или запроси ссылку восстановления у @Ryctam9.' });
    db.exec('BEGIN');
    let account;
    try { account = create(input); linkLegacy(account); grant(res,account); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    res.status(201).json(profile(account));
  });
  const dummyHash = hashPassword(randomToken());
  app.post('/api/auth/login', requireCsrf, limit('participant-login', 15, 15*60*1000), (req,res) => {
    const telegram = typeof req.body.telegram === 'string' ? req.body.telegram.trim().toLowerCase() : '';
    const account = db.prepare('SELECT * FROM accounts WHERE telegram=?').get(telegram);
    const valid = verifyPassword(req.body.password, account?.password_hash || dummyHash);
    if (!account || !valid) return res.status(401).json({ error: 'Неверный Telegram или пароль.' });
    const previous = cookieToken(req);
    if (previous) db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(digest(previous));
    grant(res,account); res.json(profile(account));
  });
  app.post('/api/auth/logout', requireCsrf, (req,res) => {
    const token = cookieToken(req);
    if (token) db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(digest(token));
    res.clearCookie('suai_account',cookieOptions);
    for (const id of ['start','vibe']) res.clearCookie(`suai_participant_${id}`,cookieOptions);
    res.json({ ok:true });
  });
  app.post('/api/admin/accounts/recovery-link', requireAdmin, requireCsrf, (req,res) => {
    const parsed = telegramSchema.safeParse(req.body.telegram);
    const account = parsed.success && db.prepare('SELECT id FROM accounts WHERE telegram=?').get(parsed.data);
    if (!account) return res.status(404).json({ error: 'Аккаунт не найден. Для старой заявки создай ссылку из её карточки.' });
    const token = randomToken(), expires = now().getTime() + 60*60*1000;
    db.prepare('DELETE FROM account_recovery WHERE expires<=?').run(now().getTime());
    db.prepare('INSERT OR REPLACE INTO account_recovery VALUES (?,?,?)').run(digest(token),account.id,expires);
    res.json({ path: `/restore#token=${token}` });
  });
  function restore(token,password,res) {
    const reset = db.prepare('SELECT a.* FROM account_recovery p JOIN accounts a ON a.id=p.account_id WHERE p.token_hash=? AND p.expires>?').get(digest(token),now().getTime());
    const legacy = db.prepare(`SELECT r.* FROM participant_recovery p JOIN registrations r ON r.id=p.registration_id WHERE p.token_hash=? AND p.expires>? AND r.status!='withdrawn'`).get(digest(token),now().getTime());
    if (!reset && !legacy) return null;
    db.exec('BEGIN');
    try {
      let account = reset || db.prepare('SELECT * FROM accounts WHERE id=?').get(legacy.account_id || '');
      if (!account) account = create({telegram:legacy.telegram,fullName:legacy.full_name,password});
      else db.prepare('UPDATE accounts SET password_hash=? WHERE id=?').run(hashPassword(password),account.id);
      linkLegacy(account);
      db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(account.id);
      db.prepare('DELETE FROM account_recovery WHERE account_id=?').run(account.id);
      db.prepare('DELETE FROM participant_recovery WHERE registration_id IN (SELECT id FROM registrations WHERE account_id=?)').run(account.id);
      grant(res,account); db.exec('COMMIT'); return profile(account);
    } catch(error) { db.exec('ROLLBACK'); throw error; }
  }
  return { find, requireAccount, profile, restore };
}
