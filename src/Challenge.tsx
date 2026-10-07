import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, CheckCircle2, FileUp, Trophy } from 'lucide-react';
import { mutate, readableError } from './api';
import { useEvents } from './useEvents';
import { getParticipants } from './participant';
import type { Participant } from './participant';

function SubmissionForm() {
  const { events } = useEvents();
  const closed = events.find(event => event.id === 'start')?.open === false;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState('');
  useEffect(() => {
    let active = true;
    getParticipants().then(result => { if (active) setParticipant(result.participants.find(p => p.eventId === 'start') || null); })
      .catch(failure => { if (active) setAccessError(readableError(failure)); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<{ score: number; remaining: number } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    try { setResult(await mutate('/api/submissions', new FormData(event.currentTarget))); }
    catch (failure) { setError(readableError(failure)); }
    finally { setBusy(false); }
  }
  return <section id="submit" className="submission-section"><div><span className="eyebrow">ГОТОВО? ПРОВЕРИМ.</span><h2>Отправить решение</h2><p className="muted">После регистрации сайт автоматически связывает решение с твоей заявкой в этом браузере. На другом устройстве доступ поможет восстановить <a href="https://t.me/Ryctam9">@Ryctam9</a>.</p><p className="small muted">До 5 успешных отправок в день. В рейтинг попадёт твой лучший открытый результат.</p></div><form className="submission-form" onSubmit={submit}>{closed ? <div className="notice">Приём решений завершён. <Link to="/leaderboard">Посмотреть итоговый рейтинг →</Link></div> : checking ? <p role="status">Проверяем регистрацию…</p> : accessError ? <p role="alert" className="form-error">{accessError} Обнови страницу, чтобы повторить проверку.</p> : !participant ? <div className="notice"><p>Для отправки решения зарегистрируйся на Campus ML.</p><Link className="button" to="/register?event=start">Зарегистрироваться</Link><p className="small">Уже регистрировался в другом браузере? <a href="https://t.me/Ryctam9">Восстановить доступ через организатора ↗</a></p></div> : <>
    <p className="notice">Участник: <strong>{participant.displayName}</strong>. Решение будет добавлено в твой рейтинг.</p>
    <label className="field">Ссылка на ноутбук или репозиторий<input name="reportUrl" type="url" required maxLength={1000} placeholder="https://github.com/…" aria-describedby="report-help" /><span className="field-help" id="report-help">Открой доступ по ссылке. Добавь исследование данных, сравнение моделей и выводы.</span></label>
    <label className="field file-field"><span><FileUp size={20} aria-hidden="true" /> Файл с предсказаниями</span><input name="predictions" type="file" accept=".csv,text/csv" required aria-describedby="csv-help" /><span className="field-help" id="csv-help">CSV до 128 КБ · 300 строк · столбцы id,busy</span></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="button full-width" disabled={busy} aria-busy={busy}>{busy ? 'Проверяем предсказания…' : 'Проверить и добавить в рейтинг'}<ArrowUpRight size={18} aria-hidden="true" /></button>
    </>}{result && <div role="status" className="submission-success"><CheckCircle2 size={23} aria-hidden="true" /><div><strong>Решение принято. F1: {result.score.toFixed(2)}</strong><p>Осталось попыток сегодня: {result.remaining}. <Link to="/leaderboard">Открыть рейтинг →</Link></p></div></div>}</form></section>;
}

export function Challenge() {
  return <section className="container page-section"><span className="eyebrow">CAMPUS ML / ПРОБНОЕ ЗАДАНИЕ</span><div className="page-heading"><h1 tabIndex={-1}>Очередь<br /><span className="accent">без сюрпризов.</span></h1><p className="lead muted">Предскажи загруженность студенческого кафе.<br />От первого анализа данных до собственной модели.</p></div><div className="challenge-meta"><span>Бинарная классификация</span><span>Метрика: F1 × 100</span><span>Ориентир: 3–5 часов</span><span>Дедлайн: 15.10, 23:59 МСК</span></div>
    <div className="detail-layout"><div className="prose"><h2>Задача</h2><p>Перед парами хочется успеть за кофе. По времени, погоде и учебной нагрузке определи, будет ли в следующий интервал загружено кафе: <code>busy = 1</code> означает высокую загруженность, <code>busy = 0</code> — обычную.</p><p>Данные синтетические и созданы для обучения. Они не описывают реальную столовую ГУАП. Каждый ряд — отдельная ситуация, а не последовательный временной ряд.</p><h2>Что есть в данных</h2><div className="table-scroll"><table><thead><tr><th>Признак</th><th>Значение</th></tr></thead><tbody>{[
      ['id', 'Идентификатор строки; не используй как признак'], ['day_of_week', 'День недели: 0 — понедельник, 6 — воскресенье'], ['hour', 'Час наблюдения, от 8 до 19'], ['temperature', 'Температура воздуха, °C'], ['rain', 'Дождь: 1 — да, 0 — нет'], ['is_exam_week', 'Экзаменационная неделя: 1 — да'], ['nearby_classes', 'Число занятий поблизости'], ['menu_type', 'regular, student_combo или special'], ['previous_visitors', 'Посетители за предыдущий интервал'], ['busy', 'Целевая метка; есть только в train.csv'],
    ].map(([name, value]) => <tr key={name}><td><code>{name}</code></td><td>{value}</td></tr>)}</tbody></table></div><h2>План работы</h2><ol className="task-steps"><li><strong>Исследуй данные.</strong> Проверь пропуски, баланс классов и распределения. Построй минимум три графика и запиши три наблюдения.</li><li><strong>Сделай честное разбиение.</strong> Выдели из train.csv проверочную часть, зафиксируй random_state и не используй test.csv для выбора параметров.</li><li><strong>Построй базовое решение.</strong> Сравни DummyClassifier с простой моделью: например, логистической регрессией.</li><li><strong>Улучши результат.</strong> Попробуй ещё одну модель или осмысленно доработай признаки. Собери таблицу экспериментов с локальным F1.</li><li><strong>Разбери ошибки.</strong> Покажи матрицу ошибок и объясни, когда модель ошибается. Напиши, что можно улучшить.</li><li><strong>Отправь работу.</strong> Загрузи CSV-предсказания и ссылку на ноутбук или репозиторий с README. Укажи версии библиотек и способ повторить результат.</li></ol><h2>Как устроен рейтинг</h2><p>Открытый F1 считается на 200 тестовых строках; закрытый — на остальных 100. До дедлайна виден только открытый балл. После дедлайна система берёт твою лучшую по открытому F1 отправку и ранжирует её по закрытому F1.</p><p>При равенстве баллов выше более раннее решение. Не больше пяти успешных отправок в день по Москве. Невалидные файлы лимит не расходуют. Рейтинг показывает качество модели; ноутбук и воспроизводимость отдельно проверяет организатор.</p><p>ИИ разрешён как помощник. Обозначь, где его использовал, и убедись, что можешь объяснить свой код. Пробный рейтинг не определяет победителя основного хакатона 18 октября.</p></div><aside className="event-sidebar"><span className="eyebrow">НАБОР ДЛЯ СТАРТА</span><h2>Скачай данные</h2><p className="muted">1 200 обучающих строк.<br />300 строк для предсказания.</p><div className="download-list">{[['train.csv', 'Обучающая выборка'], ['test.csv', 'Тестовая выборка'], ['sample_submission.csv', 'Пример формата ответа']].map(([file, label]) => <a key={file} href={`/api/challenge/${file}`} download><span><strong>{file}</strong><small>{label}</small></span><ArrowDownToLine size={20} aria-hidden="true" /></a>)}<a href="/starter.py" download><span><strong>starter.py</strong><small>Первая модель на Python</small></span><ArrowDownToLine size={20} aria-hidden="true" /></a></div><Link to="/register?event=start" className="button full-width">Регистрация на Campus ML <ArrowUpRight size={18} aria-hidden="true" /></Link><Link to="/leaderboard" className="text-link"><Trophy size={17} aria-hidden="true" /> Посмотреть рейтинг</Link><hr /><Link to="/prepare/ml-first-model" className="text-link">Нужна помощь с первой моделью? ↗</Link></aside></div><SubmissionForm /></section>;
}
