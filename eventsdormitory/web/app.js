"use strict";
const $ = (s) => document.querySelector(s),
  app = $("#app");
let data = { events: [], articles: [], auth: {} },
  me = { user: null },
  filter = "Все",
  adminTab = "events",
  adminData = null;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (d, opts) =>
  new Date(d).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", ...opts });
const month = (d) => fmt(d, { month: "short" }).replace(".", "");
const upcoming = () =>
  data.events
    .filter((e) => new Date(e.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
const past = () =>
  data.events
    .filter((e) => new Date(e.date) <= new Date())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
const paras = (s) =>
  String(s)
    .split("\n\n")
    .map((x) => `<p>${esc(x).replaceAll("\n", "<br>")}</p>`)
    .join("");
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
async function api(path, body) {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": me.csrf || "",
          },
          body: JSON.stringify(body),
        },
  );
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "Не удалось выполнить запрос");
  return v;
}
async function refresh() {
  [data, me] = await Promise.all([api("public"), api("me")]);
  $("#account-link").href = me.admin
    ? "/admin"
    : me.user
      ? "/profile"
      : "/login";
  $("#account-link").textContent = me.admin
    ? "Админка"
    : me.user
      ? "Мой профиль"
      : "Войти";
}
function icon(name) {
  return `<img class="ui-icon" src="/assets/icons/${name}.svg" alt="" aria-hidden="true">`;
}
function proximity(date) {
  const today = DormCalendar.dayKey();
  const day = DormCalendar.dayKey(date);
  const diff = Math.round((Date.parse(day) - Date.parse(today)) / 86400000);
  if (new Date(date) <= new Date()) return "Прошло";
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  return `Через ${diff} ${diff % 10 === 1 && diff % 100 !== 11 ? "день" : [2, 3, 4].includes(diff % 10) && ![12, 13, 14].includes(diff % 100) ? "дня" : "дней"}`;
}
function card(e, heading = 3) {
  return `<article class="event-card">
    <div class="card-picture"><img src="${esc(e.image)}" alt="" loading="lazy">
      <div class="date-badge"><strong>${fmt(e.date, { day: "numeric" })}</strong><small>${month(e.date)}</small></div>
    </div>
    <div class="card-content">
      <div class="card-meta"><span>${esc(e.category)}</span><span class="event-proximity">${proximity(e.date)}</span></div>
      <h${heading}><a class="card-link" href="/events/${esc(e.id)}">${esc(e.title)}</a></h${heading}>
      <p>${esc(e.intro)}</p>
      <div class="event-logistics">
        <div>${icon("clock")}<time datetime="${esc(e.date)}">${fmt(e.date, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · МСК</time></div>
        <div>${icon("map-pin")}<span>${esc(e.place)}</span></div>
      </div>
    </div>
  </article>`;
}
let calendarState = null,
  calendarContext = "",
  calendarTabsStart = "";
function getCalendar() {
  if (!calendarState)
    calendarState = DormCalendar.selectMonth(
      DormCalendar.dayKey().slice(0, 7),
      false,
    );
  return calendarState;
}
function calendarLabel(month, grammatical = false) {
  const date = `${month}-01T12:00:00Z`;
  return grammatical
    ? new Date(date)
        .toLocaleDateString("ru-RU", {
          timeZone: "UTC",
          day: "numeric",
          month: "long",
        })
        .replace(/^1 /, "")
    : new Date(date).toLocaleDateString("ru-RU", {
        timeZone: "UTC",
        month: "long",
      });
}
function rangeLabel(s) {
  const from = Number(s.from.slice(-2)),
    to = Number(s.to.slice(-2));
  return `${from === to ? from : `${from}–${to}`} ${calendarLabel(s.month, true)}`;
}
function afisha(archive = false, level = 1) {
  const s = getCalendar();
  const currentMonth = DormCalendar.dayKey().slice(0, 7);
  const arr = data.events
    .filter((e) => DormCalendar.matches(e, s, false, filter))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const today = DormCalendar.dayKey();
  const days = DormCalendar.monthDays(s.month).filter(
    (day) => s.month !== currentMonth || day >= today,
  );
  const eventDays = new Set(
    data.events
      .filter(
        (e) =>
          new Date(e.date) > new Date() &&
          (filter === "Все" || e.category === filter),
      )
      .map((e) => DormCalendar.dayKey(e.date)),
  );
  return `<div class="afisha">
    <div class="afisha-heading"><h${level}>Мероприятия</h${level}></div>
    <div class="calendar-toolbar"><span class="calendar-month">${esc(calendarLabel(s.month))} ${s.month.slice(0, 4)}</span></div>
    <div class="calendar-strip">
      <button class="calendar-nav" data-month-shift="-1" aria-label="Предыдущий месяц" ${s.month <= currentMonth ? "disabled" : ""}>${icon("chevron-left")}</button>
      <div class="calendar-days" role="group" aria-label="Выберите день или диапазон дат">${days
        .map((day) => {
          const boundary = day === s.from || day === s.to,
            inside = day >= s.from && day <= s.to;
          const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString(
            "ru-RU",
            { weekday: "short", timeZone: "UTC" },
          );
          const label = new Date(`${day}T12:00:00Z`).toLocaleDateString(
            "ru-RU",
            { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" },
          );
          return `<button class="calendar-day ${inside ? "in-range" : ""} ${boundary ? "boundary" : ""} ${day === s.from ? "range-start" : ""} ${day === s.to ? "range-end" : ""} ${eventDays.has(day) ? "has-events" : ""}" data-day="${day}" aria-pressed="${inside}" aria-label="${label}${eventDays.has(day) ? ", есть мероприятия" : ""}"><span>${Number(day.slice(-2))}</span><small>${weekday}</small><i aria-hidden="true"></i></button>`;
        })
        .join("")}</div>
      <button class="calendar-nav" data-month-shift="1" aria-label="Следующий месяц">${icon("chevron-right")}</button>
    </div>
    <div class="calendar-caption"><span id="calendar-help">${s.awaitingEnd ? "Нажми на второй день, чтобы выбрать конец периода." : "Выбери день или диапазон. Точки отмечают события."}</span><button class="calendar-reset" data-month-reset>Сбросить период</button></div>
    <div class="afisha-filters"><label class="category-select" for="event-category"><span>Категория</span><select id="event-category">${["Все", "Вместе", "Технологии", "Спорт", "Творчество"].map((cat) => `<option value="${cat}" ${filter === cat ? "selected" : ""}>${cat === "Все" ? "Все категории" : cat}</option>`).join("")}</select></label><span class="result-count" role="status" aria-live="polite">Найдено: ${arr.length}</span></div>
    <div class="events-grid">${arr.map((e) => card(e, level + 1)).join("") || '<div class="empty"><h3>В этот период событий нет</h3><p>Выбери другие даты или категорию.</p><button class="button light" data-month-reset>Сбросить период</button></div>'}</div>
  </div>`;
}
const badges = [
  {
    id: "first",
    icon: "✦",
    title: "Первый выход",
    text: "Посетить первую встречу",
    goal: 1,
  },
  {
    id: "three",
    icon: "♜",
    title: "Уже свой",
    text: "Побывать на трёх событиях",
    goal: 3,
  },
  {
    id: "five",
    icon: "♛",
    title: "Душа этажа",
    text: "Побывать на пяти событиях",
    goal: 5,
  },
  {
    id: "tech",
    icon: "⚙",
    title: "Собрал и запустил",
    text: "Посетить событие о технологиях",
    category: "Технологии",
  },
  {
    id: "read",
    icon: "❦",
    title: "Между строк",
    text: "Прочитать историю в дневнике",
    action: "read",
  },
  {
    id: "roof",
    icon: "☽",
    title: "Выход на крышу",
    text: "Найти тихий уголок сайта",
    action: "roof",
  },
];
function unlocked(b) {
  const attended = (me.registrations || []).filter((r) => r.attended);
  return b.goal
    ? attended.length >= b.goal
    : b.category
      ? attended.some((r) => findEvent(r.eventId)?.category === b.category)
      : !!me.user?.actions?.[b.action];
}
function badge(b, mini = false) {
  const yes = unlocked(b);
  return `<div class="achievement-card ${!mini && !yes ? "locked" : ""}"><small class="badge-status">${mini ? "КАРТА СОСЕДА" : yes ? "В коллекции" : "Ещё впереди"}</small><span class="achievement-icon" aria-hidden="true"><svg viewBox="0 0 80 80" aria-hidden="true"><use href="/assets/cards.svg#${b.id}"></use></svg></span><h3>${esc(b.title)}</h3>${mini ? "" : `<p>${esc(b.text)}</p>`}</div>`;
}
function home() {
  return `<div class="hero-landing"><div class="hero-illustration" role="img" aria-label="Рисунок общежития №2 ГУАП на Передовиков, 13"></div>
    <section class="hero-layout"><div aria-hidden="true"></div><div class="hero-copy"><div class="eyebrow">ГУАП · Общежитие №2</div><h1>Что происходит<br>в нашем общежитии</h1><p>Хакатоны, спорт, кино и встречи с соседями на Передовиков, 13. Выбирай мероприятие и присоединяйся.</p><div class="buttons"><a class="button" href="/events">Мероприятия</a><a class="text-link" href="/blog">Дневник общежития</a></div></div></section>
    <a class="hero-secret" href="/roof/quiet-hour" aria-label="Осмотреть маленькое окно над общежитием" title="Кажется, там кто-то есть">☽</a>
  </div>
  <div class="home-zone zone-events"><section>${afisha(false, 2)}<p class="schedule-note">Время и места предварительные. Подробности уточняются в карточках.</p></section></div>
  <div class="home-zone zone-collection"><section class="collection-band"><div><h2>Ачивки за участие</h2><p>Приходи на мероприятия и собирай карточки. Организатор отметит посещение, и достижение появится в твоём профиле.</p><a class="text-link" href="/achievements">Посмотреть коллекцию</a></div><div class="mini-cards">${badges
    .slice(0, 3)
    .map((x) => badge(x, true))
    .join("")}</div></section></div>
<div class="student-corner" role="img" aria-label="Студенческий уголок: конспекты, ноутбук, кружка и лампа"></div>`;
}
function events() {
  return `<div class="page events-page">${afisha(false)}<p class="schedule-note">Время и площадки предварительные. Настолки и киновечер пока служат примерами.</p></div>`;
}
function eventDetail(id) {
  const e = findEvent(id);
  if (!e) return missing();
  const closed = new Date(e.date) <= new Date(),
    registered = (me.registrations || []).some((x) => x.eventId === id);
  return `<div class="page"><div class="breadcrumb"><a href="/events">Мероприятия</a> / ${esc(e.category)}</div><div class="detail"><img src="${esc(e.image)}" alt="${esc(e.title)}"><div><div class="eyebrow">${esc(e.category)} · ${closed ? "В АРХИВЕ" : "ПРЕДСТОЯЩЕЕ СОБЫТИЕ"}</div><h1>${esc(e.title)}</h1><p class="lede">${esc(e.intro)}</p><div class="fact-row"><span>Когда</span><strong>${fmt(e.date, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} МСК</strong></div><div class="fact-row"><span>Где</span><span>${esc(e.place)}</span></div><div class="fact-row"><span>Кто собирает</span><span>Инициативные люди</span></div><div class="buttons">${closed ? '<span class="helper">Встреча завершена, запись закрыта.</span>' : `<button class="button" data-register="${esc(id)}" data-cancel="${registered}">${registered ? "Отменить запись" : "Приду"} <span>${registered ? "×" : ""}</span></button>${registered ? '<span class="helper">Ты в списке. До встречи!</span>' : '<span class="helper">Запись в один клик.</span>'}`}</div></div></div><div class="article-body">${paras(e.body)}</div></div>`;
}
function blog(id) {
  if (id) {
    const b = data.articles.find((x) => x.id === id);
    if (!b) return missing();
    const index = data.articles.findIndex((x) => x.id === id),
      next = data.articles[index + 1];
    return `<div class="diary-page diary-reading"><div class="page"><div class="breadcrumb"><a href="/blog">К разложенным страницам</a></div>
      <article class="diary-full paper-surface"><div class="paper-heading"><span>${esc(b.category)}</span><span>Лист ${String(index + 1).padStart(2, "0")}</span></div><h1>${esc(b.title)}</h1><p class="diary-lede">${esc(b.intro)}</p><figure class="diary-photo"><img src="${esc(b.image)}" alt="Иллюстрация к записи ${esc(b.title)}"></figure><div class="diary-full-text">${paras(b.body)}</div><div class="diary-end"><button class="button light" data-read>Прочитал</button>${next ? `<a class="text-link" href="/blog/${esc(next.id)}">Следующая страница</a>` : '<a class="text-link" href="/blog">Все страницы</a>'}</div></article>
    </div></div>`;
  }
  return `<div class="diary-page"><div class="page"><div class="diary-introduction"><h1>Дневник общежития</h1><p>Заметки, идеи и небольшие истории. Нажми на лист, чтобы прочитать запись целиком.</p></div>
    <div class="diary-scatter">${data.articles.map((b, index) => `<article class="diary-sheet paper-surface sheet-${index % 3}"><div class="paper-heading"><span>${esc(b.category)}</span><span>${String(index + 1).padStart(2, "0")}</span></div><h2><a class="sheet-link" href="/blog/${esc(b.id)}">${esc(b.title)}</a></h2>${index % 3 === 0 ? `<figure class="diary-photo"><img src="${esc(b.image)}" alt="" loading="lazy"></figure>` : ""}<p>${esc(b.intro)}</p>${index % 3 === 2 ? '<div class="paper-doodle" aria-hidden="true">ноутбук ✓<br>зарядка ✓<br>начать с малого</div>' : ""}<span class="paper-open">Развернуть запись</span></article>`).join("")}</div>
  </div></div>`;
}
function login() {
  const err = new URLSearchParams(location.search).get("error");
  return `<div class="page"><div class="auth-card"><div class="eyebrow">ПРИВЕТ, СОСЕД</div><h1>Войти в профиль</h1><p>Войди, чтобы записываться на встречи, отменять планы и собирать карточки достижений.</p>${err ? '<div class="note">Вход не завершён. Попробуй снова. Если ошибка повторяется, напиши организаторам.</div>' : ""}${["telegram", "vk"].map((p) => (data.auth[p] ? `<a class="auth-option" href="/auth/${p}">Войти через ${p === "vk" ? "VK" : "Telegram"}</a>` : `<div class="auth-option disabled">${p === "vk" ? "VK" : "Telegram"}<small>Организаторы ещё подключают вход</small></div>`)).join("")}${data.auth.demo ? '<button class="button light" data-demo>Попробовать демопрофиль</button><p class="helper">Локальная демонстрация, не аккаунт соцсети.</p>' : ""}<p class="helper">Получаем имя и идентификатор аккаунта, а VK может передать почту. Курс и возраст автоматически не определяем.</p><a class="text-link" href="/privacy">Как храним данные</a></div></div>`;
}
function achievements() {
  return `<div class="page"><h1>Коллекция достижений</h1><p class="page-intro">Карточки открываются за посещение мероприятий. Организатор подтверждает участие в админке; результат появляется в твоём профиле.</p><div class="achievement-grid">${badges.map((b) => badge(b)).join("")}</div><div class="note">За реальные посещения — четыре карточки. Ещё две прячутся в дневнике и в одном тихом месте сайта. ${me.user ? "Твои открытые карты уже отмечены." : '<a class="text-link" href="/login">Войди, чтобы начать коллекцию</a>'}</div></div>`;
}
function avatarURL(u) {
  return u.avatar
    ? `/api/profile/photo?user=${encodeURIComponent(u.id)}&v=${encodeURIComponent(u.avatar)}`
    : "";
}
function findEvent(id) {
  return (
    data.events.find((e) => e.id === id) ||
    (me.history || []).find((e) => e.id === id)
  );
}
function profile() {
  if (!me.user) return login();
  const u = me.user,
    regs = me.registrations || [];
  const plans = regs
    .map((r) => data.events.find((e) => e.id === r.eventId))
    .filter((e) => e && new Date(e.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const history = (me.history || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const full = u.name.split(" "),
    first = u.firstName || full[0],
    last = u.lastName || (!u.profileUpdated ? full.slice(1).join(" ") : "");
  return `<div class="page profile-page"><div class="profile-top"><div><h1>Личный кабинет</h1><p class="helper">Твои данные, записи на мероприятия и подтверждённые посещения.</p></div><button class="button light" data-logout>Выйти</button></div>
    <div class="profile-layout"><aside class="profile-summary panel"><div class="profile-avatar">${u.avatar ? `<img src="${avatarURL(u)}" alt="Фото ${esc(u.name)}">` : `<span>${esc(first.slice(0, 1))}</span>`}</div><h2>${esc(u.name)}</h2><p>${esc(u.provider === "demo" ? "Демопрофиль" : u.provider === "vk" ? "Аккаунт VK" : "Аккаунт Telegram")}</p><label class="photo-picker" for="profile-photo">Загрузить фото<input id="profile-photo" type="file" accept="image/jpeg,image/png"></label><p class="helper">PNG или JPEG до 3 МБ.<br>Фото обрезается по центру.</p><div class="profile-metrics"><div><strong>${plans.length}</strong><span>предстоящих встреч</span></div><div><strong>${regs.filter((r) => r.attended).length}</strong><span>подтверждённых посещений</span></div></div></aside>
    <section class="profile-information panel"><h2>Информация о себе</h2><p class="helper">Поля можно заполнить позже. Для записи на мероприятие они не нужны.</p><form id="profile-form" class="profile-form">
      <label>Имя<input name="firstName" value="${esc(first)}" maxlength="80" autocomplete="given-name" required></label><label>Фамилия<input name="lastName" value="${esc(last)}" maxlength="80" autocomplete="family-name"></label>
      <label class="wide">Почта<input name="email" type="email" value="${esc(u.email || "")}" maxlength="254" autocomplete="email"></label>
      <label>Курс<select name="course" aria-label="Курс"><option value="0">Не указан</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${u.course === n ? "selected" : ""}>${n} курс</option>`).join("")}</select></label><label>Возраст<input name="age" type="number" min="1" max="120" value="${u.age || ""}" inputmode="numeric" placeholder="Не указан"></label>
      <label class="wide">Факультет / институт<input name="faculty" value="${esc(u.faculty || "")}" maxlength="120" placeholder="Например, Институт №1"></label>
      <label class="wide">О себе<textarea name="about" maxlength="1000" rows="3" placeholder="Интересы, любимые занятия, идеи для встреч">${esc(u.about || "")}</textarea></label>
      <div class="profile-form-footer wide"><button class="button" type="submit">Сохранить профиль</button><span id="profile-save-status" role="status" aria-live="polite"></span></div>
    </form></section></div>
    <section class="profile-zone"><div class="section-head"><h2>Мои записи</h2><a class="text-link" href="/events">Выбрать мероприятие</a></div><div class="events-grid">${plans.map((e) => card(e)).join("") || '<div class="empty">Пока нет предстоящих записей. Выбери мероприятие и нажми «Приду».</div>'}</div></section>
    <section id="visited" class="profile-zone"><div class="section-head"><h2>Архив посещений</h2><span class="helper">Только события с подтверждённым присутствием</span></div><div class="events-grid">${history.map((e) => card(e)).join("") || '<div class="empty">Здесь появятся завершённые мероприятия, на которых ты побывал. Посещение отмечает организатор.</div>'}</div></section>

  </div>`;
}
function roof() {
  return `<div class="page"><div class="roof"><div><div class="eyebrow">ТЫ НАШЁЛ ТИХОЕ МЕСТО</div><h1>У каждого дома<br>есть свой<br><em>дружелюбный сосед.</em></h1><p>У автора этого сайта есть небольшая слабость: ему нравится Человек-паук. За остроумие, неловкость и привычку помогать, даже когда собственный день совсем не задался.</p><p>Здесь можно немного задержаться. Как на подоконнике после длинного дня — только виртуальном.</p><ul><li>Питер Паркер впервые появился в Amazing Fantasy №15 в 1962 году. Персонажа создали Стэн Ли и Стив Дитко.</li><li>В классических комиксах Питер сам разработал механические веб-шутеры. Его суперспособности и инженерные навыки — разные вещи.</li><li>Майлз Моралес впервые появился в Ultimate Fallout №4 в 2011 году. Его создатели — Брайан Майкл Бендис и Сара Пикелли.</li><li>Любимая часть этой истории: героем можно быть рядом с домом. Иногда достаточно просто заметить, что кому-то нужна помощь.</li></ul><button class="button light" data-roof>Забрать карточку «Выход на крышу» ☽</button><p class="helper">Фанатский уголок. Персонажи принадлежат Marvel.</p><a class="text-link" href="/">Вернуться к соседям</a></div><img src="/assets/roof.png" alt="Человек-паук и кот на подоконнике над городом в тёплом закатном свете"></div></div>`;
}
function privacy() {
  return `<div class="page"><div class="article-body"><h1>О твоих данных</h1><p>EventsDormitory хранит идентификатор и имя аккаунта Telegram или VK, доступный ник и почту, если VK её передал. В личном кабинете можно добровольно заполнить имя, фамилию, почту, курс, возраст, факультет, описание и загрузить фото. Эти поля не нужны для записи на мероприятие и доступны только владельцу профиля и организаторам.</p><p>Чтобы записаться на событие, достаточно нажать «Приду». Сохраняем связь аккаунта с мероприятием, время записи и отметку посещения. Эти данные доступны организаторам в админке; публичного списка участников нет.</p><p>Для входа используем cookie сессии. Сторонних рекламных трекеров здесь нет. Авторизация происходит на стороне выбранной соцсети — её пароль сайт не получает.</p><p>Встречи можно отменить в карточке события. Для удаления профиля и связанных записей напиши организатору <a class="text-link" href="https://t.me/Ryctam9">@Ryctam9</a>. Перед публичным запуском организаторам нужно утвердить сроки хранения и правила обработки персональных данных.</p></div></div>`;
}
function missing() {
  return `<div class="page"><h1>Эта страница<br><em>куда-то ушла.</em></h1><p>Возможно, запись ещё не опубликована.</p><a class="button" href="/">Вернуться домой</a></div>`;
}
function admin() {
  if (!me.admin)
    return `<div class="page"><form class="auth-card" id="admin-login"><div class="eyebrow">ДЛЯ ИНИЦИАТИВНЫХ ЛЮДЕЙ</div><h1>Комната<br><em>организаторов.</em></h1><label for="admin-key">Ключ администратора</label><input id="admin-key" name="token" type="password" required autocomplete="current-password"><button class="button">Войти</button><p class="helper">Ключ задаётся на сервере в ADMIN_TOKEN.</p></form></div>`;
  if (!adminData)
    return '<div class="loading">Загружаем комнату организаторов…</div>';
  const d = adminData;
  return `<div class="page"><div class="profile-top"><div><div class="eyebrow">АДМИНКА</div><h1>Комната организаторов</h1></div><button class="button light" data-logout>Выйти</button></div><div class="stats"><div><strong>${Object.keys(d.users).length}</strong><span>аккаунтов</span></div><div><strong>${d.registrations.length}</strong><span>записей</span></div><div><strong>${d.registrations.filter((r) => r.attended).length}</strong><span>посещений</span></div></div><div class="admin-tabs">${[
    ["events", "Мероприятия"],
    ["articles", "Статьи"],
    ["attendance", "Посещения"],
    ["users", "Пользователи"],
  ]
    .map(
      ([k, v]) =>
        `<button class="chip ${adminTab === k ? "active" : ""}" data-tab="${k}">${v}</button>`,
    )
    .join("")}</div><div id="admin-pane">${adminPane()}</div></div>`;
}
function adminPane() {
  const d = adminData;
  if (["events", "articles"].includes(adminTab)) {
    const items = d[adminTab];
    return `<div class="admin-toolbar"><span>${items.length} записей · черновики видны только здесь</span><button class="button" data-edit="" data-kind="${adminTab}">Добавить</button></div><div class="admin-list">${items.map((e) => `<div class="admin-row"><div><strong>${esc(e.title)}</strong><small>${e.draft ? "Черновик" : "Опубликовано"} · ${esc(e.id)} ${e.date ? " · " + fmt(e.date, { day: "numeric", month: "long" }) : ""}</small></div><button class="button light" data-edit="${esc(e.id)}" data-kind="${adminTab}">Изменить</button></div>`).join("")}</div>`;
  }
  if (adminTab === "users")
    return `<input class="search" id="user-search" placeholder="Поиск по имени, почте или ID" aria-label="Найти пользователя"><div class="table-wrap"><table><thead><tr><th>Сосед</th><th>Аккаунт / почта</th><th>Курс / возраст</th><th>Регистрация</th><th>Записи / пришёл</th></tr></thead><tbody>${Object.values(
      d.users,
    )
      .map(
        (u) =>
          `<tr data-user-search="${esc((u.name + " " + u.email + " " + u.id).toLowerCase())}"><td>${esc(u.name)}</td><td>${esc(u.id)}<br>${esc(u.email || "Почта не предоставлена")}</td><td>${u.course ? u.course + " курс" : "Курс не указан"}<br>${u.age ? u.age + " лет" : "Возраст не указан"}<br>${esc(u.faculty || "")}</td><td>${fmt(u.joined, { day: "numeric", month: "long", year: "numeric" })}</td><td>${d.registrations.filter((r) => r.userId === u.id).length} / ${d.registrations.filter((r) => r.userId === u.id && r.attended).length}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  return `<label for="attendance-event">Мероприятие</label> <select class="search" id="attendance-event">${d.events.map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join("")}</select><div id="attendees"></div>`;
}
function attendees() {
  const id = $("#attendance-event")?.value;
  if (!id) return;
  const rows = adminData.registrations.filter((r) => r.eventId === id);
  $("#attendees").innerHTML = rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>Участник</th><th>Аккаунт</th><th>Дата записи</th><th>Пришёл</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(adminData.users[r.userId]?.name || r.userId)}</td><td>${esc(r.userId)}</td><td>${fmt(r.created, { day: "numeric", month: "long" })}</td><td><input type="checkbox" aria-label="Посещение: ${esc(adminData.users[r.userId]?.name || r.userId)}" data-attendance="${esc(r.userId)}" data-event="${esc(id)}" ${r.attended ? "checked" : ""}></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">На эту встречу пока никто не записался.</div>';
}
function editor(kind, id) {
  const isEvent = kind === "events",
    e = adminData[kind].find((x) => x.id === id) || {};
  $("#admin-pane").innerHTML =
    `<form class="admin-form" id="editor" data-kind="${kind}"><h2>${id ? "Редактировать" : "Новая запись"}</h2><label>ID (латиница, цифры, дефис)<input name="id" value="${esc(e.id)}" pattern="[a-z0-9-]+" maxlength="80" required ${id ? "readonly" : ""}></label><label>Название<input name="title" value="${esc(e.title)}" maxlength="200" required></label>${isEvent ? `<label>Дата и время (Москва)<input type="datetime-local" name="date" value="${e.date ? esc(e.date.slice(0, 16)) : ""}" required></label><label>Место<input name="place" value="${esc(e.place)}" required></label>` : ""}<label>Категория${isEvent ? `<select name="category">${["Вместе", "Технологии", "Спорт", "Творчество"].map((s) => `<option ${e.category === s ? "selected" : ""}>${s}</option>`).join("")}</select>` : `<input name="category" value="${esc(e.category)}" required>`}</label><label>Краткое описание<textarea name="intro" required>${esc(e.intro)}</textarea></label><label>Основной текст (абзацы через пустую строку)<textarea name="body" required>${esc(e.body)}</textarea></label><label>Иллюстрация<select name="image">${["dormitory", "ml", "sport", "halloween", "vibe", "games", "cinema"].map((s) => `<option value="/assets/${s}.webp" ${e.image === "/assets/" + s + ".webp" ? "selected" : ""}>${s}</option>`).join("")}</select></label><label class="check"><input name="draft" type="checkbox" ${e.draft ? "checked" : ""}> Сохранить как черновик</label><div class="buttons"><button class="button">Сохранить</button><button type="button" class="button light" data-back-admin>Назад</button></div><p class="helper">Новые иллюстрации можно добавить в web/assets и расширить список в app.js.</p></form>`;
}
async function render() {
  const p = location.pathname.split("/").filter(Boolean);
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === "/" + p[0]),
    );
  if (p[0] === "admin" && me.admin) adminData = await api("admin/data");
  app.innerHTML = !p.length
    ? home()
    : p[0] === "events"
      ? p[1]
        ? eventDetail(p[1])
        : events()
      : p[0] === "archive"
        ? profile()
        : p[0] === "blog"
          ? blog(p[1])
          : p[0] === "login"
            ? login()
            : p[0] === "profile"
              ? profile()
              : p[0] === "achievements"
                ? achievements()
                : p[0] === "roof" && p[1] === "quiet-hour"
                  ? roof()
                  : p[0] === "privacy"
                    ? privacy()
                    : p[0] === "admin"
                      ? admin()
                      : missing();
  document.title =
    (p[0] === "events" && p[1]
      ? findEvent(p[1])?.title
      : p[0] === "blog" && p[1]
        ? data.articles.find((b) => b.id === p[1])?.title
        : {
            events: "Мероприятия",
            archive: "Архив",
            blog: "Дневник",
            profile: "Личный кабинет",
            achievements: "Коллекция",
            login: "Войти",
            admin: "Админка",
            roof: "Тихое место",
            privacy: "О данных",
          }[p[0]]) || "Мероприятия общежития №2";
  document.title += " · EventsDormitory";
  attendees();
}
async function go(href) {
  history.pushState({}, "", href);
  filter = "Все";
  await render();
  if (location.hash)
    document
      .getElementById(decodeURIComponent(location.hash.slice(1)))
      ?.scrollIntoView();
  else window.scrollTo(0, 0);
}
function promptLogin() {
  const d = $("#modal");
  $("#modal-content").innerHTML =
    '<h2>Войди, чтобы записаться</h2><p>Войди через Telegram или VK — и записывайся на встречи одним нажатием.</p><a href="/login" class="button">Войти</a>';
  d.showModal();
}

async function changeCalendar(button) {
  const archive = false;
  const railScroll = $(".calendar-days")?.scrollLeft || 0;
  let focus = "[data-month-reset]";
  if (button.dataset.day) {
    calendarState = DormCalendar.selectDay(
      getCalendar(archive),
      button.dataset.day,
    );
    focus = `[data-day="${button.dataset.day}"]`;
  } else {
    const month =
      button.dataset.month ||
      (button.dataset.monthShift
        ? DormCalendar.shiftMonth(
            getCalendar(archive).month,
            Number(button.dataset.monthShift),
          )
        : getCalendar(archive).month);
    calendarState = DormCalendar.selectMonth(month, archive);
    if (button.dataset.monthShift) calendarTabsStart = month;
    if (button.dataset.month) focus = `[data-month="${month}"]`;
    if (button.dataset.monthShift)
      focus = `[data-month-shift="${button.dataset.monthShift}"]`;
  }
  const scroll = window.scrollY;
  await render();
  if ($(".calendar-days"))
    $(".calendar-days").scrollLeft = button.dataset.day ? railScroll : 0;
  $(focus)?.focus({ preventScroll: true });
  window.scrollTo(0, scroll);
}

document.addEventListener("click", async (ev) => {
  const a = ev.target.closest("a");
  if (
    a &&
    a.origin === location.origin &&
    !a.pathname.startsWith("/auth/") &&
    !ev.ctrlKey &&
    !ev.metaKey
  ) {
    ev.preventDefault();
    $("#modal").close();
    try {
      await go(a.pathname + a.search + a.hash);
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.classList.contains("close")) {
    $("#modal").close();
    return;
  }
  try {
    if (
      b.dataset.day ||
      b.dataset.month ||
      b.dataset.monthShift ||
      b.hasAttribute("data-month-reset")
    ) {
      await changeCalendar(b);
      return;
    }
    if (b.dataset.filter) {
      filter = b.dataset.filter;
      const x = $(".calendar-days")?.scrollLeft || 0;
      await render();
      if ($(".calendar-days")) $(".calendar-days").scrollLeft = x;
      $(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (b.dataset.tab) {
      adminTab = b.dataset.tab;
      await render();
      return;
    }
    if (b.hasAttribute("data-edit")) {
      editor(b.dataset.kind, b.dataset.edit);
      return;
    }
    if (b.hasAttribute("data-back-admin")) {
      await render();
      return;
    }
    b.disabled = true;
    if (b.hasAttribute("data-demo")) {
      await api("demo/login", {});
      await refresh();
      await go("/profile");
      return;
    }
    if (b.hasAttribute("data-logout")) {
      await api("logout", {});
      await refresh();
      adminData = null;
      await go("/");
      return;
    }
    if (b.dataset.register) {
      if (!me.user) {
        promptLogin();
        return;
      }
      await api("register", {
        eventId: b.dataset.register,
        cancel: b.dataset.cancel === "true",
      });
      await refresh();
      await render();
      toast(
        b.dataset.cancel === "true"
          ? "Запись отменена. Встретимся в другой раз."
          : "Ты в списке. До встречи!",
      );
      return;
    }
    if (b.hasAttribute("data-read") || b.hasAttribute("data-roof")) {
      if (!me.user) {
        promptLogin();
        return;
      }
      const action = b.hasAttribute("data-read") ? "read" : "roof";
      await api("action", { action });
      await refresh();
      toast("Новая карточка в твоей коллекции ♡");
    }
  } catch (e) {
    toast(e.message);
  } finally {
    b.disabled = false;
  }
});
document.addEventListener("submit", async (ev) => {
  const f = ev.target;
  if (!["admin-login", "editor", "profile-form"].includes(f.id)) return;
  ev.preventDefault();
  const submit = f.querySelector("button[type=submit],button:not([type])");
  if (submit) submit.disabled = true;
  try {
    const fields = Object.fromEntries(new FormData(f));
    if (f.id === "profile-form") {
      fields.course = Number(fields.course);
      fields.age = Number(fields.age || 0);
      await api("profile", fields);
      await refresh();
      await render();
      $("#profile-save-status").textContent = "Изменения сохранены";
    } else if (f.id === "admin-login") {
      await api("admin/login", fields);
      await refresh();
      await render();
    } else {
      fields.draft = !!fields.draft;
      if (fields.date) fields.date += ":00+03:00";
      await api(
        "admin/" + (f.dataset.kind === "events" ? "event" : "article"),
        fields,
      );
      await refresh();
      await render();
      toast("Сохранено");
    }
  } catch (e) {
    toast(e.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("change", async (ev) => {
  if (ev.target.id === "event-category") {
    filter = ev.target.value;
    const scroll = $(".calendar-days")?.scrollLeft || 0;
    await render();
    if ($(".calendar-days")) $(".calendar-days").scrollLeft = scroll;
    $("#event-category")?.focus({ preventScroll: true });
    return;
  }
  if (ev.target.id === "profile-photo") {
    const input = ev.target,
      file = input.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast("Выбери фото до 3 МБ");
      input.value = "";
      return;
    }
    input.disabled = true;
    try {
      const form = new FormData();
      form.append("photo", file);
      const response = await fetch("/api/profile/photo", {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf },
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Не удалось загрузить фото");
      await refresh();
      const holder = $(".profile-avatar");
      if (holder)
        holder.innerHTML = `<img src="${avatarURL(me.user)}" alt="Фото профиля">`;
      toast("Фото сохранено");
    } catch (e) {
      toast(e.message);
    } finally {
      input.disabled = false;
      input.value = "";
    }
    return;
  }
  if (ev.target.id === "attendance-event") {
    attendees();
    return;
  }
  if (ev.target.dataset.attendance) {
    const b = ev.target;
    b.disabled = true;
    try {
      await api("admin/attendance", {
        userId: b.dataset.attendance,
        eventId: b.dataset.event,
        attended: b.checked,
      });
      adminData = await api("admin/data");
      toast("Посещение сохранено");
    } catch (e) {
      b.checked = !b.checked;
      toast(e.message);
    } finally {
      b.disabled = false;
    }
  }
});
document.addEventListener("input", (ev) => {
  if (ev.target.id === "user-search") {
    const q = ev.target.value.toLowerCase();
    document
      .querySelectorAll("[data-user-search]")
      .forEach((row) => (row.hidden = !row.dataset.userSearch.includes(q)));
  }
});
window.addEventListener("popstate", () => {
  filter = "Все";
  render().catch((e) => toast(e.message));
});
refresh()
  .then(render)
  .catch((e) => {
    app.innerHTML =
      '<div class="page"><h1>Не удалось открыть дневник</h1><p>Обнови страницу через минуту.</p></div>';
    toast(e.message);
  });
