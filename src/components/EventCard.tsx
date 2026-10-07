import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { HackEvent } from '../types';

export function EventCard({ event }: { event: HackEvent }) {
  const open = event.open ?? Date.now() < Date.parse(event.deadline);
  return <article className={`event-card event-${event.id}`}>
    <div className="event-top"><span className="mono">/ {event.number}</span><span className={`status ${open ? '' : 'status-closed'}`}><span className="status-dot" />{open ? 'Регистрация открыта' : 'Регистрация закрыта'}</span></div>
    <div className="event-date"><span>{event.day}</span><div>{event.month}<small>2026 · воскресенье</small></div><span className="event-symbol" aria-hidden="true">{event.id === 'start' ? 'ML' : 'AI'}</span></div>
    <div className="tags">{event.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    <h3><Link to={`/events/${event.id}`}>{event.title}<ArrowUpRight size={28} aria-hidden="true" /></Link></h3>
    <p>{event.description}</p>
    <div className="event-deadline">{event.hasChallenge ? 'Регистрация и пробное задание' : 'Регистрация'} — до <strong>{event.deadlineLabel}</strong></div>
    <div className="event-actions"><Link className={`button ${event.id === 'vibe' ? 'button-secondary' : ''}`} to={open ? `/register?event=${event.id}` : `/events/${event.id}`}>{open ? 'Зарегистрироваться' : 'О хакатоне'}<ArrowUpRight size={18} aria-hidden="true" /></Link><Link className="text-link" to={event.hasChallenge ? '/challenge' : `/events/${event.id}`}>{event.hasChallenge ? 'Пробное задание' : 'Как всё устроено'}<ArrowRight size={16} aria-hidden="true" /></Link></div>
  </article>;
}
