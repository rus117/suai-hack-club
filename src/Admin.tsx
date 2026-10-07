import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, Eye, EyeOff, LogOut, RefreshCw, Search } from 'lucide-react';
import { ApiError, mutate, readableError, request } from './api';
import type { Registration, Session } from './types';

const statuses: Record<string, string> = { registered: 'Новая', confirmed: 'Подтверждена', waitlist: 'Лист ожидания', withdrawn: 'Снята' };
const experienceNames: Record<string, string> = { beginner: 'Новичок', some: 'Есть проекты', experienced: 'Опыт хакатонов' };

export function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [rows, setRows] = useState<Registration[]>([]);
  const [eventFilter, setEventFilter] = useState('all'), [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Registration | null>(null), [recoveryLink, setRecoveryLink] = useState('');
  useEffect(() => { request<Session>('/api/session').then(setSession).catch(failure => setError(readableError(failure))).finally(() => setChecking(false)); }, []);
  async function refresh() {
    setBusy(true); setError('');
    try { const response = await request<{ registrations: Registration[] }>('/api/admin/registrations'); setRows(response.registrations); }
    catch (failure) { if (failure instanceof ApiError && failure.status === 401) setSession(null); setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (session?.admin) void refresh(); }, [session?.admin]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { setSession(await mutate<Session>('/api/admin/login', { password: new FormData(event.currentTarget).get('password') })); }
    catch (failure) { setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await mutate('/api/admin/logout', {}); setSession(null); setRows([]); setSelected(null); }
    catch (failure) { setError(readableError(failure)); }
  }
  async function changeStatus(id: string, status: string) {
    setBusy(true); setError('');
    try { await mutate(`/api/admin/registrations/${id}`, { status }, 'PATCH'); setRows(current => current.map(row => row.id === id ? { ...row, status } : row)); setSelected(current => current?.id === id ? { ...current, status } : current); setNotice('Статус обновлён.'); }
    catch (failure) { setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  async function deleteRegistration() {
    if (!selected || !window.confirm(`Удалить заявку ${selected.fullName} и все её результаты? Это действие нельзя отменить.`)) return;
    setBusy(true); setError('');
    try { await mutate(`/api/admin/registrations/${selected.id}`, {}, 'DELETE'); setRows(current => current.filter(row => row.id !== selected.id)); setSelected(null); setRecoveryLink(''); setNotice('Заявка и результаты удалены.'); }
    catch (failure) { setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  async function restoreAccess() {
    if (!selected) return;
    setBusy(true); setError('');
    try { const response = await mutate<{ path: string }>(`/api/admin/registrations/${selected.id}/recovery-link`, {}); setRecoveryLink(new URL(response.path, window.location.origin).href); }
    catch (failure) { setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  if (checking) return <section className="container page-section"><h1 tabIndex={-1}>Кабинет организатора</h1><p role="status">Проверяем сессию…</p></section>;
  if (!session?.admin) return <section className="container page-section"><form className="admin-login" onSubmit={login}><span className="eyebrow">SUAI HACK CLUB / ДЛЯ ОРГАНИЗАТОРА</span><h1 tabIndex={-1}>Вход в кабинет.</h1><p className="muted">Заявки, команды и результаты пробного задания.</p><label className="field">Пароль организатора<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} /><button type="button" className="icon-button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button full-width" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button></form></section>;
  const filtered = rows.filter(row => (eventFilter === 'all' || row.eventId === eventFilter) && (statusFilter === 'all' || row.status === statusFilter) && `${row.fullName} ${row.telegram} ${row.displayName} ${row.teamName}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="container page-section admin-page"><div className="admin-heading"><div><span className="eyebrow">SUAI HACK CLUB / ОРГАНИЗАТОР</span><h1 tabIndex={-1}>Всё под рукой.</h1></div><button className="button button-secondary button-small" onClick={logout}><LogOut size={16} aria-hidden="true" /> Выйти</button></div><div className="admin-stats">{[['Всего заявок', rows.length], ['Campus ML', rows.filter(row => row.eventId === 'start').length], ['Вайбкодинг', rows.filter(row => row.eventId === 'vibe').length], ['Сдали задание', rows.filter(row => row.submissions > 0).length]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div><div className="admin-toolbar"><label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="Поиск по имени, Telegram, нику или команде" placeholder="Имя, Telegram или команда" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Фильтр по хакатону" value={eventFilter} onChange={event => setEventFilter(event.target.value)}><option value="all">Все хакатоны</option><option value="start">Campus ML</option><option value="vibe">Вайбкодинг</option></select><select aria-label="Фильтр по статусу" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Все статусы</option>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="icon-button" aria-label="Обновить заявки" onClick={refresh} disabled={busy}><RefreshCw size={20} /></button><a className="button button-secondary button-small" href="/api/admin/export.csv" download><Download size={16} aria-hidden="true" /> Все заявки CSV</a></div>{error && <p role="alert" className="form-error">{error}</p>}<p className="small muted" role="status">{notice || `Найдено заявок: ${filtered.length}`}</p><div className="table-scroll admin-table"><table><caption className="sr-only">Заявки на хакатоны</caption><thead><tr><th>Участник</th><th>Хакатон</th><th>Команда</th><th>Задание</th><th>Статус</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><button className="table-link" onClick={() => { setSelected(row); setRecoveryLink(''); }}>{row.fullName}</button><small>{row.telegram} · {row.displayName}</small></td><td>{row.eventId === 'start' ? 'Campus ML' : 'Вайбкодинг'}</td><td>{row.teamName || (row.teamMode === 'looking' ? 'Ищет команду' : 'Самостоятельно')}</td><td>{row.eventId === 'vibe' ? 'Не требуется' : row.submissions ? <><strong>{row.publicScore?.toFixed(2)} F1</strong><small>{row.submissions} отправок</small></> : 'Ещё не сдано'}</td><td><select aria-label={`Статус заявки ${row.fullName}`} value={row.status} disabled={busy} onChange={event => changeStatus(row.id, event.target.value)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state"><h2>{rows.length ? 'По этим условиям ничего нет.' : 'Первые участники скоро появятся.'}</h2><p>{rows.length ? 'Измени поисковый запрос или фильтры.' : 'Заявки с формы регистрации будут доступны здесь.'}</p></div>}</div>
    {selected && <section className="admin-detail" aria-label="Подробности заявки"><div className="admin-heading"><h2>{selected.fullName}</h2><button className="button button-secondary button-small" onClick={() => setSelected(null)}>Закрыть карточку</button></div><dl><dt>Telegram</dt><dd><a href={`https://t.me/${selected.telegram.slice(1)}`} target="_blank" rel="noreferrer">{selected.telegram} ↗</a></dd><dt>Ник в рейтинге</dt><dd>{selected.displayName}</dd><dt>Опыт</dt><dd>{experienceNames[selected.experience]}</dd><dt>Дата заявки</dt><dd>{new Date(selected.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК</dd><dt>Решение</dt><dd>{selected.reportUrl ? <a href={selected.reportUrl} target="_blank" rel="noreferrer">Открыть ноутбук или репозиторий ↗</a> : 'Пока не отправлено'}</dd></dl><button className="button button-secondary" disabled={busy} onClick={restoreAccess}>Создать ссылку для входа</button>{recoveryLink && <div role="status" className="notice"><p>Передай ссылку участнику лично в его Telegram. Она одноразовая и действует час. После входа старые сеансы этой заявки будут закрыты.</p><label className="field">Ссылка для участника<input readOnly value={recoveryLink} onFocus={event => event.target.select()} /></label></div>}<p className="admin-delete"><button className="button button-secondary button-small" disabled={busy} onClick={deleteRegistration}>Удалить заявку и результаты</button></p></section>}
  </section>;
}
