import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(24).toString('hex');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || !stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash || hash.length !== 128) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
}

export function sessionMiddleware(db, { secure, now }) {
  return (req, res, next) => {
    const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('suai_session='));
    const token = cookie?.slice('suai_session='.length);
    const current = now().getTime();
    let session = token ? db.prepare('SELECT * FROM sessions WHERE id = ? AND expires > ?').get(digest(token), current) : null;
    if (!session) {
      const newToken = randomToken();
      session = { id: digest(newToken), csrf: randomToken(), is_admin: 0, expires: current + 12 * 60 * 60 * 1000 };
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(current);
      db.prepare('INSERT INTO sessions (id,csrf,expires) VALUES (?,?,?)').run(session.id, session.csrf, session.expires);
      res.cookie('suai_session', newToken, { httpOnly: true, secure, sameSite: 'strict', maxAge: 12 * 60 * 60 * 1000, path: '/' });
    }
    req.session = session;
    const accountCookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('suai_account='));
    const accountToken = accountCookie?.slice('suai_account='.length);
    req.accountAdmin = Boolean(accountToken && db.prepare(`SELECT a.is_admin FROM account_sessions s
      JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>?`).get(digest(accountToken), current)?.is_admin);
    next();
  };
}

export function rateLimit(db, { scope, max, windowMs, now }) {
  return (req, res, next) => {
    const current = now().getTime();
    const key = `${scope}:${digest(req.ip || 'unknown')}`;
    const existing = db.prepare('SELECT * FROM limits WHERE key = ?').get(key);
    if (existing && existing.expires > current && existing.count >= max) {
      res.set('Retry-After', String(Math.ceil((existing.expires - current) / 1000)));
      return res.status(429).json({ error: 'Слишком много попыток. Подожди немного и попробуй ещё раз.' });
    }
    if (!existing || existing.expires <= current) {
      db.prepare('DELETE FROM limits WHERE expires <= ?').run(current);
      db.prepare('INSERT OR REPLACE INTO limits VALUES (?,?,?)').run(key, 1, current + windowMs);
    } else db.prepare('UPDATE limits SET count=count+1 WHERE key=?').run(key);
    next();
  };
}

export function requireCsrf(req, res, next) {
  const supplied = req.headers['x-csrf-token'];
  if (typeof supplied !== 'string' || supplied !== req.session.csrf) {
    return res.status(403).json({ error: 'Сессия истекла. Обнови страницу и повтори отправку.' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session.is_admin && !req.accountAdmin) return res.status(401).json({ error: 'Войди как организатор.' });
  next();
}
