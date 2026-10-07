import { useEffect, useState } from 'react';
import { useSearchParams, Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Download } from 'lucide-react';
import { materials, courses, courseMaterials, courseHours, hoursLabel } from './materials';
import type { Material } from './materials';
import { NotFound } from './InfoPages';

const progressKey = 'suai-learning-v1';
function readProgress(): Record<string, boolean> {
  const parsed: unknown = JSON.parse(localStorage.getItem(progressKey) || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(materials.map(m => [m.slug, (parsed as Record<string, unknown>)[m.slug] === true]));
}
function useProgress() {
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const update = () => { try { setProgress(readProgress()); } catch { setUnavailable(true); } };
    update(); window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  function toggle(slug: string, checked: boolean) {
    const next = { ...progress, [slug]: checked }; setProgress(next);
    try { localStorage.setItem(progressKey, JSON.stringify(next)); setUnavailable(false); }
    catch { setUnavailable(true); }
  }
  return { progress, toggle, unavailable };
}
function usePageTitle(title: string) {
  useEffect(() => { const old = document.title; document.title = `${title} — SUAI Hack Club`; return () => { document.title = old; }; }, [title]);
}
function Downloads() {
  return <section className="learning-downloads"><div><span className="eyebrow">РАБОТАЙ СВОИМИ РУКАМИ</span><h2>Материалы для практики</h2><p>Ноутбук ведёт через ML-эксперимент. Тетрадь помогает фиксировать гипотезы, проверки и решения команды.</p></div><div className="learning-download-links"><a href="/learning/campus-ml-workbook.ipynb" download><Download size={18} aria-hidden="true" /><span>Учебный ML-ноутбук<small>Jupyter · код, графики и задания</small></span></a><a href="/learning/workbook.md" download><Download size={18} aria-hidden="true" /><span>Рабочая тетрадь<small>Markdown · 7 шаблонов для обоих направлений</small></span></a><Link to="/challenge">Данные и условие «Часа пик» <ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>;
}
export function Prepare() {
  usePageTitle('Подготовка');
  const [params, setParams] = useSearchParams();
  const track = ['ml', 'vibe'].includes(params.get('track') || '') ? params.get('track')! : 'all';
  const visible = track === 'all' ? materials : courseMaterials(track);
  const { progress, unavailable } = useProgress();
  return <section className="container page-section learning-hub">
    <span className="eyebrow">УЧЕБНАЯ МАСТЕРСКАЯ / 12 МОДУЛЕЙ</span>
    <div className="page-heading"><h1 tabIndex={-1}>Разберись глубже.<br /><span className="accent">Собери осознанно.</span></h1><p className="lead muted">Два маршрута от основ до собственного проекта.<br />Объяснения, первоисточники, лабораторные и самопроверка.</p></div>
    <div className="course-grid">{courses.map(course => {
      const done = course.slugs.filter(slug => progress[slug]).length;
      return <article className="course-card" key={course.id}><span className="eyebrow">{course.id === 'ml' ? '01 / ДАННЫЕ И МОДЕЛИ' : '02 / РАЗРАБОТКА С ИИ'}</span><div className="course-title"><h2>{course.title}</h2><span className="mono">{hoursLabel(courseHours(course.id))}</span></div><p>{course.description}</p><p className="small muted">{course.slugs.length} модулей с общими занятиями по команде, Git и защите</p><label htmlFor={`progress-${course.id}`} className="small">Завершено {done} из {course.slugs.length}</label><progress id={`progress-${course.id}`} value={done} max={course.slugs.length} /><button className="button button-secondary" onClick={() => { setParams({ track: course.id }); document.getElementById('curriculum')?.scrollIntoView({ behavior: 'instant' }); }}>Выбрать маршрут {course.title}<ArrowUpRight size={17} aria-hidden="true" /></button></article>;
    })}</div>
    <div className="learning-how"><h2>Как проходить</h2><ol><li><strong>Разберись.</strong> Прочитай объяснение и указанные разделы первоисточников.</li><li><strong>Сделай.</strong> Выполни лабораторную и сохрани конкретный результат.</li><li><strong>Проверь себя.</strong> Ответь на вопросы до открытия разбора. Отметь завершение.</li></ol><p className="small muted">Время — ориентир для чтения выбранных разделов, практики и разбора ошибок, а не длительность чтения страницы. Полные внешние курсы и задания со звёздочкой займут больше. Отметки хранятся только в этом браузере; они не влияют на регистрацию или рейтинг.</p>{unavailable && <p role="status" className="notice">Браузер не позволяет прочитать сохранённый прогресс. Материалы доступны без него.</p>}</div>
    <section id="curriculum"><h2 className="curriculum-heading">{track === 'all' ? 'Все модули' : `Твой маршрут: ${track === 'ml' ? 'Campus ML' : 'вайбкодинг'}`}</h2><div className="filter-bar" aria-label="Направление материалов">{[['all', 'Все материалы'], ['ml', 'Campus ML'], ['vibe', 'Вайбкодинг']].map(([value, label]) => <button key={value} className={track === value ? 'filter active' : 'filter'} aria-pressed={track === value} onClick={() => setParams(value === 'all' ? {} : { track: value })}>{label}</button>)}</div>
    <div className="material-list">{visible.map((material, index) => <Link className="material-row" to={`/prepare/${material.slug}${track === 'all' ? '' : `?track=${track}`}`} key={material.slug}><span className="mono muted">{String(index + 1).padStart(2, '0')}</span><div><span className="eyebrow">{material.track === 'ml' ? 'МАШИННОЕ ОБУЧЕНИЕ' : material.track === 'vibe' ? 'РАЗРАБОТКА С ИИ' : 'ОБЩАЯ ПРАКТИКА'}{progress[material.slug] && ' · ЗАВЕРШЕНО'}</span><h3>{material.title}</h3><p>{material.description}</p></div><span className="material-time"><BookOpen size={15} aria-hidden="true" />{hoursLabel(material.hours)}<span className="sr-only"> с практикой</span></span><ArrowUpRight size={24} aria-hidden="true" /></Link>)}</div></section>
    <Downloads /><p className="source-note">Тексты и задания клуба написаны для наших хакатонов. Внешние материалы открываются на сайтах авторов; у каждого указаны язык и конкретный план изучения. Ссылки проверены 7 октября 2026 года.</p>
  </section>;
}

function Lesson({ material }: { material: Material }) {
  usePageTitle(material.title);
  const [params] = useSearchParams();
  const { progress, toggle, unavailable } = useProgress();
  const track = material.track === 'all' ? (params.get('track') === 'vibe' ? 'vibe' : 'ml') : material.track;
  const route = courseMaterials(track), currentIndex = route.findIndex(m => m.slug === material.slug);
  const next = route[currentIndex + 1];
  return <article className="container page-section article-page lesson-page">
    <Link to={`/prepare?track=${track}`} className="back-link"><ArrowLeft size={16} aria-hidden="true" /> К маршруту {track === 'ml' ? 'Campus ML' : 'вайбкодинга'}</Link>
    <span className="eyebrow">МОДУЛЬ {currentIndex + 1} / {hoursLabel(material.hours)} С ПРАКТИКОЙ</span><h1 tabIndex={-1}>{material.title}</h1><p className="lead muted">{material.description}</p>
    <div className="lesson-brief"><div><span className="eyebrow">ПЕРЕД НАЧАЛОМ</span><p>{material.prerequisite}</p></div><div><span className="eyebrow">РЕЗУЛЬТАТ МОДУЛЯ</span><p>{material.outcome}</p></div></div>
    <div className="article-layout"><nav aria-label="Содержание статьи">{material.sections.map((section, index) => <a key={section.title} href={`#part-${index}`}>{String(index + 1).padStart(2, '0')} / {section.title}</a>)}<a href="#practice">Лабораторная работа</a><a href="#self-check">Самопроверка</a><a href="#sources">Изучить первоисточники</a><a href="#complete">Завершить модуль</a></nav>
      <div className="prose lesson-content">{material.sections.map((section, index) => <section id={`part-${index}`} key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.code && <pre tabIndex={0} aria-label={`Пример: ${section.title}`}><code>{section.code}</code></pre>}{section.source && <p className="inline-source">Подробнее: <a href={section.source.url} target="_blank" rel="noreferrer">{section.source.title} ↗</a></p>}</section>)}
        <section id="practice" className="lesson-practice"><span className="eyebrow">ПРИМЕНИ ЗНАНИЯ</span><h2>{material.practice.title}</h2><ol>{material.practice.steps.map(step => <li key={step}>{step}</li>)}</ol><h3>Работа готова, когда</h3><ul className="checklist" role="list">{material.practice.done.map(item => <li key={item}><Check size={18} aria-hidden="true" />{item}</li>)}</ul><div className="stretch-task"><h3>Если хочешь глубже</h3><p>{material.practice.stretch}</p></div></section>
        <section id="self-check"><h2>Проверь понимание</h2><p>Сначала сформулируй ответ своими словами — вслух или в тетради. Затем открой разбор и найди расхождения.</p>{material.questions.map((item, index) => <div className="quiz-item" key={item.question}><h3>{index + 1}. {item.question}</h3><details><summary>Показать разбор<span className="sr-only"> вопроса {index + 1}</span></summary><p>{item.answer}</p></details></div>)}</section>
        <section id="sources"><h2>Изучить и применить</h2><p>Не нужно проходить каждый внешний курс целиком. Ниже — конкретные разделы и действия для этого модуля. Англоязычные страницы можно читать с переводом браузера; имена функций и код оставляй без перевода.</p><div className="lesson-resources">{material.resources.map(resource => <article key={resource.url}><span className="eyebrow">{resource.language} · {resource.format}</span><h3><a href={resource.url} target={resource.url.startsWith('https://') ? '_blank' : undefined} rel="noreferrer">{resource.title} ↗</a></h3><p>{resource.task}</p></article>)}</div></section>
        <section id="complete" className="lesson-complete"><h2>Зафиксируй результат</h2><p>Отмечай завершение, когда выполнил лабораторную и можешь объяснить ответы. Эта отметка — для тебя, не оценка организатора.</p><label className="completion-check" htmlFor={`done-${material.slug}`}><input id={`done-${material.slug}`} type="checkbox" checked={Boolean(progress[material.slug])} onChange={event => toggle(material.slug, event.target.checked)} />Я выполнил практику и разобрал вопросы</label><p className="small" role="status">{unavailable ? 'Сохранение в браузере недоступно. Отметка действует до ухода со страницы.' : progress[material.slug] ? 'Модуль отмечен. Прогресс сохранён в этом браузере.' : 'Прогресс хранится в этом браузере без регистрации.'}</p>{next && <Link className="button" to={`/prepare/${next.slug}?track=${track}`}>Дальше: {next.title}<ArrowUpRight size={18} aria-hidden="true" /></Link>}{!next && <Link className="button" to={track === 'ml' ? '/challenge' : '/events/vibe'}>{track === 'ml' ? 'Отправить пробное задание' : 'К вайбкодинг-хакатону'}<ArrowUpRight size={18} aria-hidden="true" /></Link>}</section>
      </div></div><Downloads />
  </article>;
}
export function MaterialPage() {
  const { slug } = useParams();
  const material = materials.find(entry => entry.slug === slug);
  return material ? <Lesson key={material.slug} material={material} /> : <NotFound />;
}
