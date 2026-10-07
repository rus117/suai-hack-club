import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { z } from 'zod';
import { openDatabase } from './database.mjs';
import { participantAccess } from './participants.mjs';
import { datasetCsv, getLeaderboard, loadDataset, scorePredictions } from './challenge.mjs';
import { digest, randomToken, rateLimit, requireAdmin, requireCsrf, sessionMiddleware, verifyPassword } from './security.mjs';

const events = JSON.parse(readFileSync(new URL('../shared/events.json', import.meta.url), 'utf8'));
const registrationSchema = z.object({
  eventId: z.enum(['start', 'vibe']),
  fullName: z.string().trim().min(2, 'Укажи имя и фамилию.').max(100),
  telegram: z.string().trim().regex(/^@[A-Za-z0-9_]{5,32}$/, 'Telegram должен быть в формате @username, от 5 символов.').transform(value => value.toLowerCase()),
  displayName: z.string().trim().min(2, 'Придумай ник для рейтинга.').max(40).regex(/^[\p{L}\p{N} _.-]+$/u, 'В нике допустимы буквы, цифры, пробелы, _, точка и дефис.'),
  teamMode: z.enum(['looking', 'team', 'solo']),
  teamName: z.string().trim().max(80).default(''),
  experience: z.enum(['beginner', 'some', 'experienced']),
  consent: z.literal(true, { error: 'Подтверди согласие на обработку данных заявки.' }),
  website: z.string().max(0, 'Не удалось отправить заявку.').optional(),
}).refine(value => value.teamMode !== 'team' || value.teamName.length > 1, { path: ['teamName'], message: 'Укажи название команды.' });

export function createApp({ dbPath = 'data/club.sqlite', datasetPath = 'data/dataset.json', datasetSecret,
  adminPasswordHash = '', production = false, publicOrigin = '', now = () => new Date() } = {}) {
  if (!datasetSecret || datasetSecret.length < 24) throw new Error('DATASET_SECRET must contain at least 24 characters. Run npm run setup.');
  const app = express();
  const db = openDatabase(dbPath);
  const access = participantAccess(db, { now, production });
  const dataset = loadDataset(datasetPath, datasetSecret);
  const limit = (scope, max, windowMs = 60 * 60 * 1000) => rateLimit(db, { scope, max, windowMs, now });
  const closed = id => now().getTime() >= new Date(events.find(event => event.id === id).deadline).getTime();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 128 * 1024, files: 1, fields: 3, fieldSize: 2048 } });
  app.disable('x-powered-by');
  app.set('trust proxy', production ? 'loopback, linklocal, uniquelocal' : false);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"],
    objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: production ? [] : null,
  } }, strictTransportSecurity: production ? undefined : false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (production && !['GET', 'HEAD'].includes(req.method) && req.headers.origin !== publicOrigin) {
      return res.status(403).json({ error: 'Отправляй форму со страницы сайта клуба.' });
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }); });
  app.get('/api/events', (_req, res) => res.json({ events: events.map(event => ({ ...event, open: !closed(event.id) })), now: now().toISOString() }));
  app.get('/api/leaderboard', (_req, res) => res.json({ final: closed('start'), entries: getLeaderboard(db, closed('start')) }));
  app.get('/api/challenge/:file', (req, res) => {
    const kind = req.params.file.replace('.csv', '');
    if (!['train', 'test', 'sample_submission'].includes(kind) || req.params.file !== `${kind}.csv`) return res.status(404).json({ error: 'Файл не найден.' });
    res.type('text/csv').attachment(`${kind}.csv`).send(datasetCsv(dataset, kind));
  });
  app.use('/api', limit('api', 1200));
  app.use('/api', sessionMiddleware(db, { secure: production, now }));
  app.get('/api/session', (req, res) => res.json({ csrf: req.session.csrf, admin: Boolean(req.session.is_admin) }));

  app.get('/api/participant', (req, res) => {
    const participants = events.map(event => access.find(req, event.id)).filter(Boolean)
      .map(row => ({ eventId: row.event_id, displayName: row.display_name }));
    res.json({ participants });
  });
  app.post('/api/participant/migrate', requireCsrf, limit('migration', 30), (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const row = db.prepare("SELECT * FROM registrations WHERE token_hash=? AND event_id=? AND status!='withdrawn'")
      .get(digest(token), String(req.body.eventId || ''));
    if (!row) return res.status(403).json({ error: 'Для восстановления доступа напиши @Ryctam9.' });
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE registrations SET token_hash=? WHERE id=?').run(digest(randomToken()), row.id);
      access.grant(res, row);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ ok: true });
  });
  app.post('/api/participant/restore', requireCsrf, limit('recovery', 30), (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const recovery = db.prepare(`SELECT r.* FROM participant_recovery p JOIN registrations r ON r.id=p.registration_id
      WHERE p.token_hash=? AND p.expires>? AND r.status!='withdrawn'`).get(digest(token), now().getTime());
    if (!recovery) return res.status(410).json({ error: 'Ссылка уже использована или истекла. Попроси новую у @Ryctam9.' });
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM participant_recovery WHERE registration_id=?').run(recovery.id);
      db.prepare('DELETE FROM participant_sessions WHERE registration_id=?').run(recovery.id);
      db.prepare('UPDATE registrations SET token_hash=? WHERE id=?').run(digest(randomToken()), recovery.id);
      access.grant(res, recovery);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ eventId: recovery.event_id });
  });

  app.post('/api/registrations', requireCsrf, limit('registration', 60), (req, res) => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message, fields: parsed.error.flatten().fieldErrors });
    const input = parsed.data;
    if (closed(input.eventId)) return res.status(410).json({ error: 'Регистрация на этот хакатон завершена.' });
    const existing = db.prepare('SELECT id FROM registrations WHERE event_id=? AND telegram=?').get(input.eventId, input.telegram);
    if (existing) return res.status(409).json({ error: 'Заявка с этим Telegram уже есть. Для восстановления доступа напиши @Ryctam9.' });
    const nameTaken = db.prepare('SELECT id FROM registrations WHERE event_id=? AND lower(display_name)=lower(?)').get(input.eventId, input.displayName);
    if (nameTaken) return res.status(409).json({ error: 'Этот ник уже занят на выбранном хакатоне. Придумай другой.' });
    const id = randomUUID();
    const legacyPlaceholder = randomToken();
    db.prepare(`INSERT INTO registrations
      (id,event_id,full_name,telegram,display_name,team_mode,team_name,experience,token_hash,consent_version,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.eventId, input.fullName, input.telegram, input.displayName,
        input.teamMode, input.teamName, input.experience, digest(legacyPlaceholder), '2026-10-07', now().toISOString());
    access.grant(res, { id, event_id: input.eventId });
    res.status(201).json({ id, eventId: input.eventId });
  });

  app.post('/api/submissions', requireCsrf, limit('submission', 150), upload.single('predictions'), (req, res) => {
    if (closed('start')) return res.status(410).json({ error: 'Приём пробных заданий завершён 15 октября в 23:59 МСК.' });
    const registration = access.find(req, 'start');
    if (!registration) return res.status(403).json({ error: 'В этом браузере нет доступа к заявке Campus ML. Зарегистрируйся или восстанови доступ через @Ryctam9.' });
    const report = z.url().max(1000).refine(value => value.startsWith('https://')).safeParse(req.body.reportUrl);
    if (!report.success) return res.status(400).json({ error: 'Добавь HTTPS-ссылку на ноутбук или репозиторий с решением.' });
    if (!req.file) return res.status(400).json({ error: 'Прикрепи CSV с предсказаниями.' });
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
    const count = db.prepare('SELECT count(*) AS total FROM submissions WHERE registration_id=? AND day=?').get(registration.id, day).total;
    if (count >= 5) return res.status(429).json({ error: 'Сегодня уже было 5 успешных отправок. Следующие попытки доступны после полуночи по Москве.' });
    let scores;
    try { scores = scorePredictions(req.file.buffer, dataset); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    db.prepare('INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), registration.id,
      scores.publicScore, scores.privateScore, report.data, req.file.originalname.slice(0, 120), now().toISOString(), day);
    res.status(201).json({ score: Math.round(scores.publicScore * 100) / 100, remaining: 4 - count });
  });

  app.post('/api/admin/login', requireCsrf, limit('login', 8, 15 * 60 * 1000), (req, res) => {
    if (!verifyPassword(req.body.password, adminPasswordHash)) return res.status(401).json({ error: 'Неверный пароль организатора.' });
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.session.id);
    const token = randomToken(), csrf = randomToken();
    db.prepare('INSERT INTO sessions VALUES (?,?,?,1)').run(digest(token), csrf, now().getTime() + 4 * 60 * 60 * 1000);
    res.cookie('suai_session', token, { httpOnly: true, secure: production, sameSite: 'strict', maxAge: 4 * 60 * 60 * 1000, path: '/' });
    res.json({ csrf, admin: true });
  });
  app.post('/api/admin/logout', requireCsrf, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.session.id);
    res.clearCookie('suai_session', { path: '/' });
    res.json({ ok: true });
  });
  const adminRows = () => db.prepare(`SELECT r.id, r.event_id AS eventId, r.full_name AS fullName,
    r.telegram, r.display_name AS displayName, r.team_mode AS teamMode, r.team_name AS teamName,
    r.experience, r.status, r.created_at AS createdAt,
    (SELECT count(*) FROM submissions WHERE registration_id=r.id) AS submissions,
    (SELECT max(public_score) FROM submissions WHERE registration_id=r.id) AS publicScore,
    (SELECT report_url FROM submissions WHERE registration_id=r.id ORDER BY public_score DESC, created_at ASC, id ASC LIMIT 1) AS reportUrl
    FROM registrations r ORDER BY r.created_at DESC`).all();
  app.get('/api/admin/registrations', requireAdmin, (_req, res) => res.json({ registrations: adminRows() }));
  app.get('/api/admin/export.csv', requireAdmin, (_req, res) => {
    const rows = adminRows();
    const columns = ['id', 'eventId', 'fullName', 'telegram', 'displayName', 'teamMode', 'teamName', 'experience', 'status', 'createdAt', 'submissions', 'publicScore', 'reportUrl'];
    const cell = value => '"' + String(value ?? '').replace(/^[\s]*[=+@\-]/, match => "'" + match).replaceAll('"', '""') + '"';
    res.type('text/csv').attachment('suai-registrations.csv').send('\uFEFF' + columns.join(',') + '\n' + rows.map(row => columns.map(key => cell(row[key])).join(',')).join('\n'));
  });
  app.patch('/api/admin/registrations/:id', requireAdmin, requireCsrf, (req, res) => {
    const status = z.enum(['registered', 'confirmed', 'waitlist', 'withdrawn']).safeParse(req.body.status);
    if (!status.success) return res.status(400).json({ error: 'Неизвестный статус.' });
    const updated = db.prepare('UPDATE registrations SET status=? WHERE id=?').run(status.data, req.params.id);
    if (!updated.changes) return res.status(404).json({ error: 'Заявка не найдена.' });
    res.json({ ok: true });
  });
  app.post('/api/admin/registrations/:id/recovery-link', requireAdmin, requireCsrf, (req, res) => {
    const registration = db.prepare("SELECT * FROM registrations WHERE id=? AND status!='withdrawn'").get(req.params.id);
    if (!registration) return res.status(404).json({ error: 'Активная заявка не найдена.' });
    const token = randomToken();
    const expires = now().getTime() + 60 * 60 * 1000;
    db.prepare('DELETE FROM participant_recovery WHERE expires<=?').run(now().getTime());
    db.prepare('INSERT OR REPLACE INTO participant_recovery VALUES (?,?,?)').run(digest(token), registration.id, expires);
    res.json({ path: `/restore#token=${token}`, expiresAt: new Date(expires).toISOString() });
  });
  app.delete('/api/admin/registrations/:id', requireAdmin, requireCsrf, (req, res) => {
    if (!db.prepare('SELECT id FROM registrations WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Заявка не найдена.' });
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM submissions WHERE registration_id=?').run(req.params.id);
      db.prepare('DELETE FROM registrations WHERE id=?').run(req.params.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ ok: true });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Страница API не найдена.' }));
  app.use(express.static(resolve('dist'), { index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: resolve('dist') }));
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Прикрепи один CSV-файл размером до 128 КБ.' });
    if (error instanceof SyntaxError || error.type === 'entity.too.large') return res.status(400).json({ error: 'Не удалось прочитать запрос. Проверь форму и повтори отправку.' });
    console.error('Request failed:', error.code || error.name);
    res.status(500).json({ error: 'Сервис временно недоступен. Попробуй позже или напиши @Ryctam9.' });
  });
  return { app, db, dataset };
}
