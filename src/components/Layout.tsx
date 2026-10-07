import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X, UserRound } from 'lucide-react';

import { useAuth } from '../auth';

function Brand() {
  return <Link to="/" className="brand" aria-label="SUAI Hack Club — главная"><span className="brand-mark" aria-hidden="true">/›</span><span>SUAI<span className="brand-caption">HACK CLUB</span></span></Link>;
}

const navLinks = [{ to: '/#events', text: 'Хакатоны' }, { to: '/prepare', text: 'Подготовка' }, { to: '/leaderboard', text: 'Рейтинг' }, { to: '/challenge', text: 'Пробное задание' }];

export function Layout() {
  const { data, checking, error } = useAuth();
  const menu = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    menu.current?.close();
    setMenuOpen(false);
    const frame = requestAnimationFrame(() => {
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
      else {
        window.scrollTo(0, 0);
        document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  return <>
    <a className="skip-link" href="#main">Перейти к содержимому</a>
    <header className="site-header"><div className="container header-inner">
      <Brand />
      <nav className="desktop-nav" aria-label="Основная навигация">{navLinks.map(link => <NavLink key={link.to} to={link.to} className={link.to === '/challenge' ? 'nav-task' : undefined}>{link.text}</NavLink>)}{data.user?.isAdmin && <NavLink to="/admin">Админка</NavLink>}</nav>
      <div className="auth-status">{checking ? <span className="small" role="status">Входим…</span> : data.user ? <Link className="account-chip" to="/account" aria-label={`Личный кабинет: ${data.user.fullName}`}><UserRound size={20}/><span><strong>{data.user.fullName}</strong><small>В АККАУНТЕ · КАБИНЕТ</small></span></Link> : <Link className="button button-small" to="/login">{error ? 'Проверить вход' : 'Войти'}</Link>}</div>
      <button className="icon-button menu-trigger" aria-label="Открыть меню" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => { menu.current?.showModal(); setMenuOpen(true); }}><Menu /></button>
    </div></header>
    <dialog ref={menu} id="mobile-menu" className="mobile-menu" aria-label="Навигация" onClose={() => setMenuOpen(false)}>
      <div className="menu-top"><Brand /><button className="icon-button" aria-label="Закрыть меню" onClick={() => menu.current?.close()}><X /></button></div>
      <nav aria-label="Мобильная навигация">{navLinks.map(link => <Link key={link.to} to={link.to}>{link.text}<ArrowUpRight size={20} aria-hidden="true" /></Link>)}{data.user?.isAdmin && <Link to="/admin">Админка<ArrowUpRight size={20} aria-hidden="true" /></Link>}<Link to={data.user ? '/account' : '/login'}>{data.user ? `Кабинет · ${data.user.fullName}` : 'Войти на сайт'}<ArrowUpRight size={20} aria-hidden="true" /></Link></nav>
    </dialog>
    <main id="main"><Outlet /></main>
    <footer className="site-footer"><div className="container">
      <div className="footer-top"><Brand /><p>Начинается с идеи.<br />Продолжается вместе.</p><a className="text-link" href="https://t.me/dormitory_suai" target="_blank" rel="noreferrer">Наш Telegram <ArrowUpRight size={18} aria-hidden="true" /></a></div>
      <div className="footer-bottom"><span>© 2026 SUAI Hack Club · Студенческая инициатива</span><Link to="/privacy">Данные и приватность</Link><a href="https://t.me/Ryctam9" target="_blank" rel="noreferrer">Написать организатору ↗</a></div>
    </div></footer>
  </>;
}
