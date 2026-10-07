import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mutate, readableError } from './api';

export function Restore() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [eventId, setEventId] = useState('');
  useEffect(() => { window.history.replaceState(window.history.state, '', '/restore'); }, []);
  async function restore() {
    setBusy(true); setError('');
    try {
      const result = await mutate<{ eventId: string }>('/api/participant/restore', { token });
      setEventId(result.eventId);
    } catch (failure) { setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  return <section className="container page-section"><div className="success-panel"><span className="eyebrow">SUAI HACK CLUB / УЧАСТНИК</span><h1 tabIndex={-1}>{eventId ? 'Ты снова с нами.' : 'Продолжить участие'}</h1>{eventId ? <><p role="status">Доступ восстановлен в этом браузере. Можно продолжать без кода и пароля.</p><Link className="button" to={eventId === 'start' ? '/challenge#submit' : '/prepare?track=vibe'}>{eventId === 'start' ? 'Перейти к заданию' : 'Открыть подготовку'}</Link></> : <><p>Ссылка от организатора восстановит доступ к твоей заявке на этом устройстве.</p>{token ? <button className="button" disabled={busy} onClick={restore}>{busy ? 'Восстанавливаем…' : 'Продолжить участие'}</button> : <p>Открой личную ссылку, которую прислал организатор. Если она потерялась, напиши <a href="https://t.me/Ryctam9">@Ryctam9</a>.</p>}{error && <p className="form-error" role="alert">{error}</p>}</>}</div></section>;
}
