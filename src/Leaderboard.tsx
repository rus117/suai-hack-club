import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, RefreshCw, Trophy } from 'lucide-react';
import { readableError, request } from './api';
import type { Leaderboard as Board } from './types';

export function Leaderboard() {
  const [board, setBoard] = useState<Board | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  function refresh() {
    setLoading(true); setError('');
    request<Board>('/api/leaderboard').then(setBoard).catch(failure => setError(readableError(failure))).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);
  return <section className="container page-section"><span className="eyebrow">CAMPUS ML / ПРОБНОЕ ЗАДАНИЕ</span><div className="page-heading board-heading"><div><h1 tabIndex={-1}>Каждая попытка<br /><span className="accent">имеет значение.</span></h1><p className="lead muted">Рейтинг моделей для задачи «Очередь без сюрпризов».</p></div><Trophy className="board-trophy" size={96} strokeWidth={1} aria-hidden="true" /></div><div className="board-toolbar"><div><span className="status"><span className="status-dot" />{board?.final ? 'Итоговый рейтинг' : 'Открытый рейтинг'}</span><span className="small muted">F1 × 100 · Чем выше, тем лучше</span></div><button className="button button-secondary button-small" onClick={refresh} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? 'Обновляем…' : 'Обновить'}</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {loading && !board && <p role="status" className="empty-state">Загружаем результаты…</p>}
    {board && (board.entries.length ? <div className="table-scroll leaderboard-table"><table><caption className="sr-only">{board.final ? 'Итоговый' : 'Открытый'} рейтинг Campus ML</caption><thead><tr><th>Место</th><th>Участник</th><th className="numeric">F1-балл</th><th className="numeric">Попытки</th><th>Лучшее решение</th></tr></thead><tbody>{board.entries.map(entry => <tr key={entry.name}><td><span className={`rank ${entry.rank <= 3 ? 'rank-top' : ''}`}>{String(entry.rank).padStart(2, '0')}</span></td><td className="board-name">{entry.name}</td><td className="numeric board-score">{entry.score.toFixed(2)}</td><td className="numeric mono">{entry.attempts}</td><td className="small muted">{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.submittedAt))} МСК</td></tr>)}</tbody></table></div> : <div className="empty-state"><Trophy size={36} aria-hidden="true" /><h2>Первая строчка пока свободна.</h2><p>Загрузи своё решение — и открой рейтинг Campus ML.<br />Здесь появятся настоящие результаты участников.</p><Link className="button" to="/challenge#submit">Отправить решение <ArrowUpRight size={18} aria-hidden="true" /></Link></div>)}
    <div className="board-explanation"><h2>{board?.final ? 'Как получен итоговый балл' : 'Почему рейтинг ещё может измениться'}</h2><p>{board?.final ? 'Для каждого участника выбрана отправка с максимальным открытым F1. Её качество проверено на закрытых 100 строках. Эти баллы определяют итоговый порядок.' : 'Сейчас виден F1 на 200 тестовых строках. После 15 октября, 23:59 МСК, лучшие открытые отправки будут сравнены на остальных 100 строках. Финальные места могут измениться.'} При одинаковом балле выше более раннее решение.</p><p className="small muted">Это рейтинг пробного задания. Победителей основного хакатона определяет жюри на мероприятии.</p></div></section>;
}
