import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, CheckCheck } from 'lucide-react';
import { ApiError, mutate, readableError } from './api';
import { useEvents } from './useEvents';

type Receipt = { id: string; eventId: string };

export function Register() {
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState(params.get('event') === 'vibe' ? 'vibe' : 'start');
  const { events, verified } = useEvents();
  const selected = events.find(event => event.id === eventId)!;
  const [teamMode, setTeamMode] = useState('looking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setFields({});
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const created = await mutate<Receipt>('/api/registrations', { ...values, eventId, consent: values.consent === 'on' });
      setReceipt(created);
      requestAnimationFrame(() => successHeading.current?.focus());
    } catch (failure) {
      setError(readableError(failure));
      if (failure instanceof ApiError) setFields(failure.fields || {});
    } finally { setBusy(false); }
  }
  if (receipt) return <section className="container page-section"><div className="success-panel"><CheckCheck size={44} className="accent" aria-hidden="true" /><span className="eyebrow">ТЫ С НАМИ</span><h1 ref={successHeading} tabIndex={-1}>Заявка принята.</h1><p>{selected.title} · {selected.day} {selected.month} 2026</p><p className="muted">Организатор свяжется с тобой в Telegram. Сайт запомнил твою заявку в этом браузере — ничего сохранять или вводить дополнительно не нужно.</p><div className="form-actions"><Link className="button" to={receipt.eventId === 'start' ? '/challenge#submit' : '/prepare?track=vibe'}>{receipt.eventId === 'start' ? 'Перейти к заданию' : 'Готовиться к хакатону'}<ArrowUpRight size={18} aria-hidden="true" /></Link><a className="text-link" href="https://t.me/dormitory_suai" target="_blank" rel="noreferrer">Канал с анонсами ↗</a></div><Link to={`/register?event=${eventId === 'start' ? 'vibe' : 'start'}`} className="text-link" onClick={() => { setReceipt(null); setEventId(eventId === 'start' ? 'vibe' : 'start'); }}>Записаться на второй хакатон →</Link></div></section>;
  return <section className="container page-section"><Link to="/#events" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> К хакатонам</Link><div className="registration-layout"><div className="registration-intro"><span className="eyebrow">УВИДИМСЯ НА СТАРТЕ</span><h1 tabIndex={-1}>Займи своё<br />место в команде.</h1><p className="lead muted">Выбери хакатон и расскажи немного о себе. Можно прийти одному — найдём единомышленников.</p><div className="registration-facts"><span className="mono">{selected.day}.{selected.id === 'start' ? '10' : '11'}.2026</span><h2>{selected.title}</h2><p>Регистрация до {selected.deadlineLabel}, 23:59 МСК.</p>{selected.hasChallenge && <p>Пробное задание тоже нужно отправить до 15 октября. <Link to="/challenge">Посмотреть условие ↗</Link></p>}<hr /><p>Общежитие №2 ГУАП<br />Передовиков, 13, корп. 1</p><p className="small muted">Время начала и комнату сообщим в канале.</p></div></div>
      <form className="registration-form" onSubmit={submit} onInput={() => { if (error) setError(''); }}>
        <fieldset><legend>На какой хакатон идёшь?</legend><div className="event-options">{events.map(event => <label className={`event-option ${event.id === eventId ? 'selected' : ''}`} key={event.id}><input type="radio" name="eventId" value={event.id} checked={event.id === eventId} onChange={() => setEventId(event.id)} /><span>{event.title}<small>{event.day} {event.month}</small></span><Check size={17} aria-hidden="true" /></label>)}</div></fieldset>
        <p className="small muted">Все поля обязательны, кроме названия команды при индивидуальной регистрации.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <label className="field">Имя и фамилия<input name="fullName" autoComplete="name" minLength={2} maxLength={100} required placeholder="Как к тебе обращаться" aria-invalid={Boolean(fields.fullName)} aria-describedby={fields.fullName ? 'fullName-error' : undefined} />{fields.fullName && <span id="fullName-error" className="field-error">{fields.fullName[0]}</span>}</label>
        <label className="field">Telegram<input name="telegram" autoComplete="off" pattern="@[A-Za-z0-9_]{5,32}" maxLength={33} required placeholder="@username" aria-describedby="telegram-help" /><span id="telegram-help" className="field-help">Для связи с организатором. Не появится в публичном рейтинге.</span></label>
        <label className="field">Ник участника<input name="displayName" minLength={2} maxLength={40} required placeholder="Например, gradient_cat" aria-describedby="nickname-help" /><span id="nickname-help" className="field-help">В рейтинге Campus ML будет виден этот ник. Не указывай здесь личные контакты.</span></label>
        <fieldset><legend>У тебя есть команда?</legend><div className="radio-stack">{[['looking', 'Ищу команду'], ['team', 'Уже есть команда'], ['solo', 'Хочу участвовать самостоятельно']].map(([value, label]) => <label key={value}><input type="radio" name="teamMode" value={value} checked={teamMode === value} onChange={() => setTeamMode(value)} />{label}</label>)}</div></fieldset>
        {teamMode === 'team' && <label className="field">Название команды<input name="teamName" required minLength={2} maxLength={80} placeholder="Одинаковое у всех участников" /><span className="field-help">Каждый участник команды заполняет свою заявку.</span></label>}
        <label className="field">Твой опыт<select name="experience" required defaultValue="beginner"><option value="beginner">Начинаю — это мой первый опыт</option><option value="some">Есть учебные или личные проекты</option><option value="experienced">Уже участвовал(а) в хакатонах</option></select></label>
        <div className="honeypot" aria-hidden="true"><label>Сайт<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="consent"><input type="checkbox" name="consent" required /><span>Согласен(на) на обработку данных заявки организатором SUAI Hack Club и публикацию выбранного ника и баллов в рейтинге Campus ML. <Link to="/privacy" target="_blank">Подробнее о данных</Link>.</span></label>
        {selected.open === false ? <p className="notice">Регистрация на {selected.title} уже завершена. Можно выбрать другой хакатон или написать организатору.</p> : <button className="button full-width" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Отправляем заявку…' : 'Зарегистрироваться'}{!busy && <ArrowUpRight size={18} aria-hidden="true" />}</button>}
        {!verified && <p className="small muted">Актуальный дедлайн проверится при отправке заявки.</p>}
      </form></div></section>;
}
