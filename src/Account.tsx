import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowUpRight, UserRound, LogOut } from 'lucide-react';
import { mutate, readableError } from './api';
import { useAuth } from './auth';
import { useEvents } from './useEvents';
import { getParticipants } from './participant';

export function PasswordField({ fresh = false }: { fresh?: boolean }) {
  const [visible,setVisible] = useState(false);
  return <div className="field"><label htmlFor={fresh ? 'new-password' : 'current-password'}>{fresh ? 'Придумай пароль' : 'Пароль'}</label><div className="password-field"><input id={fresh ? 'new-password' : 'current-password'} name="password" type={visible ? 'text' : 'password'} autoComplete={fresh ? 'new-password' : 'current-password'} minLength={fresh ? 12 : undefined} maxLength={128} required aria-describedby={fresh ? 'password-help' : undefined}/><button type="button" className="icon-button" aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? <EyeOff/> : <Eye/>}</button></div>{fresh && <span id="password-help" className="field-help">От 12 символов. Можно использовать длинную фразу.</span>}</div>;
}
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const {data,checking,error:authError,refresh} = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const rawNext = params.get('next') || '/account';
  const next = /^\/(account|register|challenge)([?#]|$)/.test(rawNext) ? rawNext : '/account';
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { if (signup) await getParticipants(); await mutate(`/api/auth/${signup ? 'signup' : 'login'}`,{...values,consent:values.consent === 'on'}); await refresh(); navigate(next,{replace:true}); }
    catch(failure) { setError(readableError(failure)); } finally {setBusy(false);}
  }
  if (!checking && data.user) return <Navigate to={next} replace/>;
  return <section className="container page-section auth-layout"><div className="auth-copy"><span className="eyebrow">SUAI HACK CLUB / ЛИЧНЫЙ КАБИНЕТ</span><h1 tabIndex={-1}>{signup ? 'Один аккаунт.\nДва хакатона.' : 'С возвращением.'}</h1><p className="lead muted">Войди на сайт, выбери хакатон и следи за своей заявкой и результатом пробного задания.</p><ol className="account-steps"><li>Создай аккаунт на сайте</li><li>Запишись на выбранный хакатон</li><li>Для Campus ML отправь пробное задание до 15 октября</li></ol><Link className="text-link accent-link" to="/challenge">Посмотреть пробное задание <ArrowUpRight size={18}/></Link></div><form className="registration-form auth-form" onSubmit={submit}><h2>{signup ? 'Создать аккаунт' : 'Вход на сайт'}</h2>{signup && <label className="field">Имя и фамилия<input name="fullName" autoComplete="name" required minLength={2} maxLength={100}/></label>}<label className="field">Telegram<input name="telegram" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="@username" pattern="@[A-Za-z0-9_]{5,32}" required maxLength={33}/><span className="field-help">Твой @username — логин на сайте и контакт для организатора. Пароль нужен отдельный, для сайта клуба.</span></label><PasswordField fresh={signup}/>{signup && <label className="consent"><input type="checkbox" name="consent" required/><span>Согласен(на) на обработку данных аккаунта. <Link to="/privacy">Подробнее</Link>.</span></label>}{(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}<button className="button full-width" disabled={busy || checking}>{busy ? 'Подожди…' : signup ? 'Создать аккаунт' : 'Войти'}</button><p>{signup ? 'Уже есть аккаунт?' : 'Впервые здесь?'} <Link to={`${signup ? '/login' : '/signup'}?next=${encodeURIComponent(next)}`}>{signup ? 'Войти' : 'Создать аккаунт'}</Link></p><details><summary>Забыл пароль или уже подавал заявку?</summary><p className="small">Если ты подавал заявку до появления аккаунтов, создай аккаунт с тем же Telegram в прежнем браузере — заявка сохранится. Для восстановления доступа напиши <a href="https://t.me/Ryctam9">@Ryctam9</a> со своего Telegram: организатор пришлёт личную ссылку для нового пароля.</p></details></form></section>;
}
const statuses:Record<string,string> = {registered:'Заявка отправлена',confirmed:'Участие подтверждено',waitlist:'Лист ожидания',withdrawn:'Заявка снята'};
export function AccountPage() {
  const {data,checking,error,refresh} = useAuth();
  const {events} = useEvents();
  const [busy,setBusy] = useState(false),[failure,setFailure] = useState('');
  const navigate = useNavigate();
  async function logout() { setBusy(true); try { await mutate('/api/auth/logout',{}); await refresh(); navigate('/login'); } catch(e) {setFailure(readableError(e));} finally {setBusy(false);} }
  if(checking) return <section className="container page-section"><h1>Личный кабинет</h1><p role="status">Проверяем вход…</p></section>;
  if(error) return <section className="container page-section"><h1>Личный кабинет</h1><p role="alert">{error}</p><button className="button" onClick={()=>void refresh()}>Повторить</button></section>;
  if(!data.user) return <Navigate to="/login?next=%2Faccount" replace/>;
  const ml = data.registrations.find(r=>r.eventId==='start' && r.status!=='withdrawn');
  return <section className="container page-section"><div className="account-heading"><div><span className="eyebrow"><UserRound size={16}/> ТЫ ВОШЁЛ В АККАУНТ</span><h1 tabIndex={-1}>Привет, {data.user.fullName}.</h1><p className="muted">{data.user.telegram} · Личный кабинет</p>{data.user.isAdmin && <Link className="text-link accent-link" to="/admin">Открыть админку <ArrowUpRight size={18}/></Link>}</div><button className="button button-secondary button-small" disabled={busy} onClick={logout}><LogOut size={16}/>Выйти</button></div>{failure && <p role="alert">{failure}</p>}<section className="challenge-spotlight"><div><span className="eyebrow">CAMPUS ML / ОБЯЗАТЕЛЬНЫЙ ШАГ</span><h2>Пробное задание</h2><p>{ml?.submissions ? `Решение принято · отправок: ${ml.submissions} · лучший открытый F1: ${ml.score?.toFixed(2)}.` : 'Ещё не отправлено. Исследуй данные, обучи модель и загрузи решение.'}</p><p><strong>Дедлайн: 15 октября, 23:59 МСК.</strong> Для вайбкодинга это задание не требуется.</p></div><Link className="button" to="/challenge">{ml?.submissions ? 'Посмотреть задание' : 'Открыть пробное задание'}<ArrowUpRight size={18}/></Link></section><h2>Мои хакатоны</h2><div className="account-events">{events.map(event=>{const enrollment=data.registrations.find(r=>r.eventId===event.id);return <article className="account-event" key={event.id}><span className="eyebrow">{event.day} {event.month} 2026</span><h3>{event.title}</h3><p className="enrollment-status">{enrollment ? statuses[enrollment.status] : 'Ты ещё не записался'}</p>{enrollment ? <><p className="muted">Ник участника: {enrollment.displayName}</p><Link className="button button-secondary" to={event.id==='start' ? '/challenge' : '/prepare?track=vibe'}>{event.id==='start' ? 'Пробное задание' : 'Материалы для подготовки'}</Link>{enrollment.status==='withdrawn' && <p className="small">Для повторного участия напиши <a href="https://t.me/Ryctam9">организатору</a>.</p>}</> : event.open===false ? <p>Регистрация завершена</p> : <Link className="button" to={`/register?event=${event.id}`}>Записаться на хакатон<ArrowUpRight size={18}/></Link>}</article>;})}</div></section>;
}
