import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { mutate, readableError } from './api';
import { PasswordField } from './Account';
import { useAuth } from './auth';
export function Restore() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [done,setDone] = useState(false);
  const {refresh} = useAuth();
  useEffect(()=>{window.history.replaceState(window.history.state,'','/restore');},[]);
  async function restore(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {await mutate('/api/participant/restore',{token,password:new FormData(event.currentTarget).get('password')}); await refresh(); setDone(true);}
    catch(failure){setError(readableError(failure));} finally{setBusy(false);}
  }
  return <section className="container page-section"><div className="success-panel"><span className="eyebrow">SUAI HACK CLUB / ВОССТАНОВЛЕНИЕ</span><h1 tabIndex={-1}>{done ? 'Ты снова с нами.' : 'Новый пароль'}</h1>{done ? <><p role="status">Ты вошёл в аккаунт. Заявки и результаты доступны в кабинете.</p><Link className="button" to="/account">Открыть кабинет</Link></> : token ? <form className="auth-form registration-form" onSubmit={restore}><p>Установи новый пароль для сайта клуба. Старые сеансы входа будут закрыты.</p><PasswordField fresh/><button className="button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить пароль и войти'}</button>{error && <p role="alert" className="form-error">{error}</p>}</form> : <p>Попроси личную ссылку у <a href="https://t.me/Ryctam9">@Ryctam9</a> со своего Telegram или <Link to="/login">войди с паролем</Link>.</p>}</div></section>;
}
