import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Coffee, MapPin, Mic2, Users } from 'lucide-react';
import { EventCard } from './components/EventCard';
import { useEvents } from './useEvents';

function SeasonPoster() {
  return <div className="season-poster" aria-label="Осенний сезон: Campus ML 18 октября, вайбкодинг 1 ноября">
    <div className="poster-meta mono"><span>SUAI / BUILD SEASON</span><span>2026</span></div>
    <div className="poster-word">MAKE<br /><span>IT</span> REAL<span className="poster-period">.</span></div>
    <svg className="poster-arrow" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M14 86 86 14M14 14h72v72" stroke="currentColor" strokeWidth="12" /></svg>
    <div className="poster-coordinates mono">59° N / 30° E<span>САНКТ-ПЕТЕРБУРГ</span></div>
    <div className="poster-tickets"><div><span className="mono">01 / CAMPUS ML</span><strong>18.10</strong></div><div><span className="mono">02 / VIBE CODING</span><strong>01.11</strong></div></div>
    <span className="poster-stamp mono">СОБИРАЕМСЯ<br />И СОЗДАЁМ</span>
  </div>;
}

export function Home() {
  const { events } = useEvents();
  return <>
    <section className="hero container">
      <div className="hero-copy"><div className="eyebrow"><span className="tiny-square" /> СТУДЕНЧЕСКОЕ СООБЩЕСТВО · ОСЕНЬ 2026</div>
        <h1 tabIndex={-1}>Твоя идея.<br />Твоя команда.<br /><span>Твой проект.</span></h1>
        <p className="hero-description">Два хакатона этой осенью. Машинное обучение и разработка с ИИ — в кругу людей, которым тоже хочется что-то создать.</p>
        <div className="hero-actions"><a href="#events" className="button">Выбрать хакатон <ArrowDown size={18} aria-hidden="true" /></a><Link to="/prepare" className="text-link">Начать подготовку <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
        <div className="hero-location"><MapPin size={16} aria-hidden="true" /><span>Санкт-Петербург · Общежитие №2 ГУАП</span></div>
      </div><SeasonPoster />
    </section>
    <div className="benefit-strip"><div className="container"><span><Users size={18} aria-hidden="true" /> Приходи с командой или один</span><span><Coffee size={18} aria-hidden="true" /> Кофе-брейк и новые знакомства</span><span><Mic2 size={18} aria-hidden="true" /> Защита и обратная связь жюри</span></div></div>
    <section className="section container" id="events"><div className="section-heading"><div><span className="eyebrow">01 / КАЛЕНДАРЬ</span><h2>Выбери свой старт.</h2></div><p>Один клуб. Два способа<br />превратить интерес в опыт.</p></div><div className="event-grid">{events.map(event => <EventCard key={event.id} event={event} />)}</div><p className="section-note">Все дедлайны — до 23:59 включительно по московскому времени.</p></section>
    <section className="section container journey"><div><span className="eyebrow">02 / ОТ ЗАЯВКИ ДО ДЕМО</span><h2>Начать проще,<br />чем кажется.</h2><p className="muted">Первый опыт — уже повод прийти.<br />Подготовку можно начать сегодня.</p><Link to="/prepare" className="text-link accent-link">Открыть материалы <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
      <ol className="journey-list">{[
        ['01', 'Выбери направление', 'Campus ML — если интересны данные и модели. Вайбкодинг — если хочешь собрать продукт с помощью ИИ.'],
        ['02', 'Зарегистрируйся и подготовься', 'Для Campus ML реши пробное задание. Для вайбкодинга проверь инструменты и продумай небольшой проект.'],
        ['03', 'Создай и покажи', 'Работай с командой, делай перерывы на кофе и представь результат жюри. Забери опыт и обратную связь.'],
      ].map(([number, title, copy]) => <li key={number}><span className="mono">{number}</span><div><h3>{title}</h3><p>{copy}</p></div><ArrowUpRight size={20} aria-hidden="true" /></li>)}</ol>
    </section>
    <section className="section container" id="about"><div className="club-panel"><div><span className="eyebrow">03 / SUAI HACK CLUB</span><h2>Место, где<br />«а что, если»<br />становится проектом.</h2><p>Собираемся в общежитии, знакомимся и пробуем новое. Здесь найдётся дело тем, кто пишет код, работает с данными, придумывает интерфейсы или умеет понятно рассказать об идее.</p><a className="text-link" href="https://t.me/dormitory_suai" target="_blank" rel="noreferrer">Следить за анонсами <ArrowUpRight size={18} aria-hidden="true" /></a></div><div className="venue"><MapPin size={30} aria-hidden="true" /><span className="eyebrow">ВСТРЕЧАЕМСЯ ЗДЕСЬ</span><h3>Общежитие №2<br />ГУАП</h3><p>Санкт-Петербург,<br />ул. Передовиков, 13, корп. 1</p><p className="small muted">Время начала, комнату и порядок прохода сообщим в канале перед каждым хакатоном.</p><a className="text-link" href="https://yandex.ru/maps/?text=Санкт-Петербург%2C%20Передовиков%2013%20корпус%201" target="_blank" rel="noreferrer">Посмотреть на карте <ArrowUpRight size={18} aria-hidden="true" /></a></div></div></section>
    <section className="section container faq"><div><span className="eyebrow">04 / ПЕРЕД СТАРТОМ</span><h2>Есть вопрос?</h2><a className="text-link muted" href="https://t.me/Ryctam9" target="_blank" rel="noreferrer">Напиши @Ryctam9 <ArrowUpRight size={16} aria-hidden="true" /></a></div><div>{[
      ['Можно без команды?', 'Да. При регистрации выбери «Ищу команду». Организатор поможет познакомиться с другими участниками. Если команда уже есть, каждому участнику нужно заполнить свою заявку и указать одинаковое название команды.'],
      ['Я пока новичок. Мне подойдёт?', 'Материалы рассчитаны на самостоятельную подготовку. Для Campus ML понадобятся основы Python и работа с таблицами; пробное задание поможет освоиться. На вайбкодинге можно участвовать с небольшим опытом и применять ИИ для разработки.'],
      ['Можно участвовать в обоих хакатонах?', 'Да. Зарегистрируйся отдельно на каждое событие: у них разные даты и условия подготовки.'],
      ['Что взять с собой?', 'Ноутбук, зарядку и рабочие инструменты. Заранее проверь запуск своего проекта, доступ к ИИ-сервисам и их лимиты. На мероприятии будет кофе-брейк.'],
      ['Когда заканчивается регистрация?', 'Campus ML: регистрация и отправка пробного задания до 15 октября 2026, 23:59 МСК. Вайбкодинг: регистрация до 27 октября 2026, 23:59 МСК.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="container closing"><span className="eyebrow">УВИДИМСЯ НА СТАРТЕ</span><div><h2>Следующий проект — твой.</h2><Link to="/register" className="button">Я участвую <ArrowRight size={20} aria-hidden="true" /></Link></div></section>
  </>;
}
