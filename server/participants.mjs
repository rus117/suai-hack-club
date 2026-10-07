import { digest, randomToken } from './security.mjs';

const lifetime = 30 * 24 * 60 * 60 * 1000;
export function participantAccess(db, { now, production }) {
  function find(req, eventId) {
    const name = `suai_participant_${eventId}=`;
    const token = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(name))?.slice(name.length);
    if (!token) return null;
    return db.prepare(`SELECT r.* FROM participant_sessions s JOIN registrations r ON r.id=s.registration_id
      WHERE s.token_hash=? AND s.expires>? AND r.event_id=? AND r.status!='withdrawn'`).get(digest(token), now().getTime(), eventId) || null;
  }
  function grant(res, registration) {
    const token = randomToken();
    db.prepare('DELETE FROM participant_sessions WHERE expires<=?').run(now().getTime());
    db.prepare('INSERT INTO participant_sessions VALUES (?,?,?)').run(digest(token), registration.id, now().getTime() + lifetime);
    res.cookie(`suai_participant_${registration.event_id}`, token, {
      httpOnly: true, secure: production, sameSite: 'strict', maxAge: lifetime, path: '/',
    });
  }
  return { find, grant };
}
