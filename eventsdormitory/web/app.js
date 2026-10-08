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
      ? "Мой дневник"
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
function getCalendar(archive) {
  const context = archive ? "past" : "future";
  if (calendarContext !== context || !calendarState) {
    const current = DormCalendar.dayKey().slice(0, 7);
    const latestPast = past()[0];
    const initial =
      archive && latestPast
        ? DormCalendar.dayKey(latestPast.date).slice(0, 7)
        : current;
    calendarState = DormCalendar.selectMonth(initial, archive);
    calendarTabsStart = initial;
    calendarContext = context;
  }
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
  const s = getCalendar(archive);
  const arr = data.events
    .filter((e) => DormCalendar.matches(e, s, archive, filter))
    .sort((a, b) =>
      archive
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date),
    );
  const today = DormCalendar.dayKey();
  const days = DormCalendar.monthDays(s.month).filter(
    (day) => archive || s.month !== today.slice(0, 7) || day >= today,
  );
  const eventDays = new Set(
    data.events
      .filter(
        (e) =>
          (archive
            ? new Date(e.date) <= new Date()
            : new Date(e.date) > new Date()) &&
          (filter === "Все" || e.category === filter),
      )
      .map((e) => DormCalendar.dayKey(e.date)),
  );
  const tabs = [0, 1, 2].map((n) =>
    DormCalendar.shiftMonth(calendarTabsStart, n),
  );
  const year = s.month.slice(0, 4);
  return `<div class="afisha" data-archive="${archive}">
    <div class="afisha-heading"><h${level}>Афиша ${rangeLabel(s)}</h${level}><span class="calendar-year">${year}</span></div>
    <div class="calendar-toolbar">
      <div class="month-tabs" aria-label="Месяц">${tabs.map((m) => `<button class="month-tab ${m === s.month ? "active" : ""}" data-month="${m}" aria-pressed="${m === s.month}">${esc(calendarLabel(m))}</button>`).join("")}</div>
      <div class="status-tabs" aria-label="Период мероприятий"><a class="${archive ? "" : "active"}" href="/events" ${archive ? "" : 'aria-current="page"'}>Предстоящие</a><a class="${archive ? "active" : ""}" href="/archive" ${archive ? 'aria-current="page"' : ""}>Прошедшие</a></div>
    </div>
    <div class="calendar-strip">
      <button class="calendar-nav" data-month-shift="-1" aria-label="Предыдущий месяц">${icon("chevron-left")}</button>
      <div class="calendar-days" role="group" aria-label="Выберите день или диапазон дат">${days
        .map((day) => {
          const boundary = day === s.from || day === s.to;
          const inside = day >= s.from && day <= s.to;
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
    <div class="calendar-caption"><span id="calendar-help">${s.awaitingEnd ? "День выбран. Нажми на второй день, чтобы задать конец периода." : "Нажми на день, затем на конец периода. Точки отмечают события."}</span><button class="calendar-reset" data-month-reset>Весь месяц</button></div>
    <div class="afisha-filters"><div class="filters" aria-label="Категория">${["Все", "Вместе", "Технологии", "Спорт", "Творчество"].map((cat) => `<button class="chip ${filter === cat ? "active" : ""}" data-filter="${cat}" aria-pressed="${filter === cat}">${cat}</button>`).join("")}</div><span class="result-count" role="status" aria-live="polite">Найдено: ${arr.length}</span></div>
    <div class="events-grid">${arr.map((e) => card(e, level + 1)).join("") || '<div class="empty"><h3>На эти даты ничего не запланировано</h3><p>Выбери другой период или посмотри весь месяц.</p><button class="button light" data-month-reset>Весь месяц</button></div>'}</div>
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
      ? attended.some(
          (r) =>
            data.events.find((e) => e.id === r.eventId)?.category ===
            b.category,
        )
      : !!me.user?.actions?.[b.action];
}
function badge(b, mini = false) {
  const yes = unlocked(b);
  return `<div class="achievement-card ${!mini && !yes ? "locked" : ""}"><small class="badge-status">${mini ? "КАРТА СОСЕДА" : yes ? "В коллекции" : "Ещё впереди"}</small><span class="achievement-icon" aria-hidden="true"><svg viewBox="0 0 80 80" aria-hidden="true"><use href="/assets/cards.svg#${b.id}"></use></svg></span><h3>${esc(b.title)}</h3>${mini ? "" : `<p>${esc(b.text)}</p>`}</div>`;
}
function home() {
  const b = data.articles;
  return `<section class="hero"><div>
    <div class="eyebrow">ГУАП · Общежитие №2</div>
    <h1>Афиша нашего<br>общежития</h1>
    <p>Хакатоны, спорт, кино и встречи с соседями на Передовиков, 13. Выбирай событие и записывайся.</p>
    <div class="buttons"><a class="button" href="/events">Смотреть афишу</a><a class="text-link" href="/blog">Дневник общежития</a></div>
  </div><div class="hero-art"><div class="pin"></div><figure><img src="/assets/dormitory.webp" alt="Рисунок общежития №2 ГУАП"><figcaption><span>Передовиков, 13</span><span>Санкт-Петербург</span></figcaption></figure><a class="tiny-roof" href="/roof/quiet-hour" aria-label="Осмотреть маленькое окно на крыше">☽</a></div></section>
  <section class="section-pad home-afisha">${afisha(false, 2)}<p class="schedule-note">Время и места предварительные. Подробности уточняются в карточках.</p></section>
  <section class="collection-band"><div><h2>Ачивки за участие</h2><p>Приходи на мероприятия и собирай карточки. Организатор отметит посещение, и достижение появится в твоём профиле.</p><a class="text-link" href="/achievements">Посмотреть коллекцию</a></div><div class="mini-cards">${badges
    .slice(0, 3)
    .map((x) => badge(x, true))
    .join("")}</div></section>
  <section class="section-pad"><div class="section-head"><h2>Дневник общежития</h2><a class="text-link" href="/blog">Все записи</a></div><div class="blog-grid">
    ${b[0] ? `<a class="blog-main" href="/blog/${esc(b[0].id)}"><img src="${esc(b[0].image)}" alt="" loading="lazy"><div><span class="tag">${esc(b[0].category)}</span><h3>${esc(b[0].title)}</h3><p>${esc(b[0].intro)}</p><span class="text-link">Читать</span></div></a>` : ""}
    <div class="blog-side">${b
      .slice(1, 3)
      .map(
        (x) =>
          `<article><a href="/blog/${esc(x.id)}"><span class="tag">${esc(x.category)}</span><h3>${esc(x.title)}</h3><p>${esc(x.intro)}</p><span class="text-link">Читать</span></a></article>`,
      )
      .join("")}</div>
  </div></section>`;
}
function events(archive = false) {
  return `<div class="page events-page">${afisha(archive)}<p class="schedule-note">${archive ? "Архив прошедших встреч. Сентябрьская запись служит примером." : "Время и площадки предварительные. Настолки и киновечер пока служат примерами."}</p></div>`;
}
function eventDetail(id) {
  const e = data.events.find((x) => x.id === id);
  if (!e) return missing();
  const closed = new Date(e.date) <= new Date(),
    registered = (me.registrations || []).some((x) => x.eventId === id);
  return `<div class="page"><div class="breadcrumb"><a href="/events">Афиша</a> / ${esc(e.category)}</div><div class="detail"><img src="${esc(e.image)}" alt="${esc(e.title)}"><div><div class="eyebrow">${esc(e.category)} · ${closed ? "В АРХИВЕ" : "ПРЕДСТОЯЩЕЕ СОБЫТИЕ"}</div><h1>${esc(e.title)}</h1><p class="lede">${esc(e.intro)}</p><div class="fact-row"><span>Когда</span><strong>${fmt(e.date, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} МСК</strong></div><div class="fact-row"><span>Где</span><span>${esc(e.place)}</span></div><div class="fact-row"><span>Кто собирает</span><span>Инициативные люди</span></div><div class="buttons">${closed ? '<span class="helper">Встреча завершена, запись закрыта.</span>' : `<button class="button" data-register="${esc(id)}" data-cancel="${registered}">${registered ? "Отменить запись" : "Приду"} <span>${registered ? "×" : ""}</span></button>${registered ? '<span class="helper">Ты в списке. До встречи!</span>' : '<span class="helper">Запись в один клик.</span>'}`}</div></div></div><div class="article-body">${paras(e.body)}</div></div>`;
}
function blog(id) {
  if (id) {
    const b = data.articles.find((x) => x.id === id);
    if (!b) return missing();
    return `<div class="page"><div class="breadcrumb"><a href="/blog">Дневник</a> / ${esc(b.category)}</div><div class="article-hero"><div class="tag">${esc(b.category)} · Инициативные люди</div><h1>${esc(b.title)}</h1><p class="page-intro centered">${esc(b.intro)}</p><img src="${esc(b.image)}" alt="Иллюстрация к истории ${esc(b.title)}"></div><div class="article-body">${paras(b.body)}<button class="button light" data-read>Прочитал</button><p class="helper">Оставит маленькую ачивку в твоей коллекции.</p></div></div>`;
  }
  return `<div class="page"><h1>Дневник общежития</h1><p class="page-intro">Заметки о жизни в общежитии, подготовке к мероприятиям и идеях соседей.</p><div class="events-grid">${data.articles.map((b) => `<article class="event-card"><a href="/blog/${esc(b.id)}"><div class="card-picture"><img src="${esc(b.image)}" alt="${esc(b.title)}" loading="lazy"></div><div class="card-meta">${esc(b.category)}</div><h3>${esc(b.title)}</h3><p>${esc(b.intro)}</p><span class="text-link">Читать</span></a></article>`).join("")}</div></div>`;
}
function login() {
  const err = new URLSearchParams(location.search).get("error");
  return `<div class="page"><div class="auth-card"><div class="eyebrow">ПРИВЕТ, СОСЕД</div><h1>Войти в профиль</h1><p>Войди, чтобы записываться на встречи, отменять планы и собирать карточки достижений.</p>${err ? '<div class="note">Вход не завершён. Попробуй снова. Если ошибка повторяется, напиши организаторам.</div>' : ""}${["telegram", "vk"].map((p) => (data.auth[p] ? `<a class="auth-option" href="/auth/${p}">Войти через ${p === "vk" ? "VK" : "Telegram"}</a>` : `<div class="auth-option disabled">${p === "vk" ? "VK" : "Telegram"}<small>Организаторы ещё подключают вход</small></div>`)).join("")}${data.auth.demo ? '<button class="button light" data-demo>Попробовать демопрофиль</button><p class="helper">Локальная демонстрация, не аккаунт соцсети.</p>' : ""}<p class="helper">Получаем имя и идентификатор аккаунта, а VK может передать почту. Курс и возраст автоматически не определяем.</p><a class="text-link" href="/privacy">Как храним данные</a></div></div>`;
}
function achievements() {
  return `<div class="page"><h1>Коллекция достижений</h1><p class="page-intro">Карточки открываются за посещение мероприятий. Организатор подтверждает участие в админке; результат появляется в твоём профиле.</p><div class="achievement-grid">${badges.map((b) => badge(b)).join("")}</div><div class="note">За реальные посещения — четыре карточки. Ещё две прячутся в дневнике и в одном тихом месте сайта. ${me.user ? "Твои открытые карты уже отмечены." : '<a class="text-link" href="/login">Войди, чтобы начать коллекцию</a>'}</div></div>`;
}
function profile() {
  if (!me.user) return login();
  const regs = me.registrations || [],
    att = regs.filter((r) => r.attended).length;
  return `<div class="page"><div class="profile-top"><div><div class="eyebrow">МОЙ ДНЕВНИК</div><h1>Привет, ${esc(me.user.name)}.</h1><span class="helper">${esc(me.user.provider === "demo" ? "Демонстрационный профиль" : me.user.provider)} · сосед с ${fmt(me.user.joined, { day: "numeric", month: "long" })}</span></div><button class="button light" data-logout>Выйти</button></div><div class="stats"><div><strong>${regs.length}</strong><span>записей на встречи</span></div><div><strong>${att}</strong><span>реальных посещений</span></div><div><strong>${badges.filter(unlocked).length} / 6</strong><span>карт в коллекции</span></div></div><div class="section-head"><h2>Мои планы</h2><a class="text-link" href="/events">Найти встречу</a></div><div class="events-grid">${
    regs
      .map((r) => data.events.find((e) => e.id === r.eventId))
      .filter(Boolean)
      .map((e) => card(e))
      .join("") ||
    '<div class="empty">Пока чистая страница. Выбери встречу в афише — и нажми «Приду».</div>'
  }</div><h2 class="spaced-heading">Мои достижения</h2><div class="achievement-grid">${badges.map((b) => badge(b)).join("")}</div></div>`;
}
function roof() {
  return `<div class="page"><div class="roof"><div><div class="eyebrow">ТЫ НАШЁЛ ТИХОЕ МЕСТО</div><h1>У каждого дома<br>есть свой<br><em>дружелюбный сосед.</em></h1><p>У автора этого сайта есть небольшая слабость: ему нравится Человек-паук. За остроумие, неловкость и привычку помогать, даже когда собственный день совсем не задался.</p><p>Здесь можно немного задержаться. Как на подоконнике после длинного дня — только виртуальном.</p><ul><li>Питер Паркер впервые появился в Amazing Fantasy №15 в 1962 году. Персонажа создали Стэн Ли и Стив Дитко.</li><li>В классических комиксах Питер сам разработал механические веб-шутеры. Его суперспособности и инженерные навыки — разные вещи.</li><li>Майлз Моралес впервые появился в Ultimate Fallout №4 в 2011 году. Его создатели — Брайан Майкл Бендис и Сара Пикелли.</li><li>Любимая часть этой истории: героем можно быть рядом с домом. Иногда достаточно просто заметить, что кому-то нужна помощь.</li></ul><button class="button light" data-roof>Забрать карточку «Выход на крышу» ☽</button><p class="helper">Фанатский уголок. Персонажи принадлежат Marvel.</p><a class="text-link" href="/">Вернуться к соседям</a></div><img src="/assets/roof.png" alt="Человек-паук и кот на подоконнике над городом в тёплом закатном свете"></div></div>`;
}
function privacy() {
  return `<div class="page"><div class="article-body"><h1>О твоих данных</h1><p>EventsDormitory хранит идентификатор и имя аккаунта Telegram или VK, доступный ник и почту, если VK её передал. Номер комнаты, возраст и курс мы не запрашиваем. Соцсети не всегда предоставляют эти сведения.</p><p>Чтобы записаться на событие, достаточно нажать «Приду». Сохраняем связь аккаунта с мероприятием, время записи и отметку посещения. Эти данные доступны организаторам в админке; публичного списка участников нет.</p><p>Для входа используем cookie сессии. Сторонних рекламных трекеров здесь нет. Авторизация происходит на стороне выбранной соцсети — её пароль сайт не получает.</p><p>Встречи можно отменить в карточке события. Для удаления профиля и связанных записей напиши организатору <a class="text-link" href="https://t.me/Ryctam9">@Ryctam9</a>. Перед публичным запуском организаторам нужно утвердить сроки хранения и правила обработки персональных данных.</p></div></div>`;
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
    return `<input class="search" id="user-search" placeholder="Поиск по имени, почте или ID" aria-label="Найти пользователя"><div class="table-wrap"><table><thead><tr><th>Сосед</th><th>Аккаунт / почта</th><th>Регистрация</th><th>Записи / пришёл</th></tr></thead><tbody>${Object.values(
      d.users,
    )
      .map(
        (u) =>
          `<tr data-user-search="${esc((u.name + " " + u.email + " " + u.id).toLowerCase())}"><td>${esc(u.name)}</td><td>${esc(u.id)}<br>${esc(u.email || "Почта не предоставлена")}</td><td>${fmt(u.joined, { day: "numeric", month: "long", year: "numeric" })}</td><td>${d.registrations.filter((r) => r.userId === u.id).length} / ${d.registrations.filter((r) => r.userId === u.id && r.attended).length}</td></tr>`,
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
        ? events(true)
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
      ? data.events.find((e) => e.id === p[1])?.title
      : p[0] === "blog" && p[1]
        ? data.articles.find((b) => b.id === p[1])?.title
        : {
            events: "Афиша",
            archive: "Архив",
            blog: "Дневник",
            profile: "Мой дневник",
            achievements: "Коллекция",
            login: "Войти",
            admin: "Админка",
            roof: "Тихое место",
            privacy: "О данных",
          }[p[0]]) || "Афиша общежития №2";
  document.title += " · EventsDormitory";
  attendees();
}
async function go(href) {
  history.pushState({}, "", href);
  filter = "Все";
  await render();
  window.scrollTo(0, 0);
}
function promptLogin() {
  const d = $("#modal");
  $("#modal-content").innerHTML =
    '<h2>Войди, чтобы записаться</h2><p>Войди через Telegram или VK — и записывайся на встречи одним нажатием.</p><a href="/login" class="button">Войти</a>';
  d.showModal();
}

async function changeCalendar(button) {
  const archive = $(".afisha")?.dataset.archive === "true";
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
      await go(a.pathname + a.search);
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
  if (!["admin-login", "editor"].includes(f.id)) return;
  ev.preventDefault();
  const submit = f.querySelector("button[type=submit],button:not([type])");
  if (submit) submit.disabled = true;
  try {
    const fields = Object.fromEntries(new FormData(f));
    if (f.id === "admin-login") {
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
