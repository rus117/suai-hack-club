/* A readable HTML book with a perspective cover, page block and turning leaf. */
globalThis.DormBook = (() => {
  let context, spreads = [], current = 0, route = "", turning = false, activeCurl = null;
  const statusLabel = { pending: "На рассмотрении", accepted: "В афише", declined: "Пока не принято" };
  const sectionNames = { guide: "Гайд общежития", collection: "Мои ачивки", stories: "Мои мероприятия" };
  const page = (eyebrow, title, content, extra = "") => `<div class="book-page-inner ${extra}"><div class="book-eyebrow">${eyebrow}</div><h2>${title}</h2>${content}</div>`;
  function build(c) {
    const { esc, paras, fmt, data, me, badges, badge, unlocked } = c;
    const result = [{ section: "guide", id: "welcome", title: "Добро пожаловать домой",
      left: page("ЛИЧНЫЙ ДНЕВНИК · № 02", "Жизнь между<br>парами", `<div class="book-address">Передовиков, 13<br><span>Общежитие №2 · ГУАП</span></div><div class="book-doodle" aria-hidden="true">✦<span>13</span>✦</div><p class="book-handwritten">Маленькие встречи.<br>Большие воспоминания.</p><p>Здесь всё, что делает общежитие твоим домом: полезные заметки, заработанные карточки и встречи, которые начались с твоей идеи.</p>`, "book-title-page"),
      right: page("НАЧНИ С ЭТОЙ СТРАНИЦЫ", "Что внутри", `<div class="book-contents">${Object.entries(sectionNames).map(([key, name], i) => `<button data-book-section="${key}"><span>0${i + 1}</span><strong>${name}</strong><span aria-hidden="true">↗</span></button>`).join("")}</div><div class="book-note"><strong>Немного соседского этикета</strong><p>Знакомься в своём темпе. Договаривайся о тишине, убирай за собой в общих местах и спрашивай согласие перед публикацией чужих фото.</p><p>Официальные правила проживания и контакты служб уточняй у администрации общежития.</p></div><p class="book-pencil">Листай стрелками, клавишами ← → или свайпом.</p>`) }];
    for (const article of data.articles) {
      const illustrated = globalThis.DormJournal?.[article.id];
      if (illustrated) {
        const art = side => `<div class="book-art-page book-art-${side}"><img src="${esc(illustrated.image)}" alt="${esc(illustrated.title)} — ${side === 'left' ? 'левая' : 'правая'} страница" loading="eager"></div>`;
        result.push({section:"guide", id:article.id, title:illustrated.title, left:art("left"), right:art("right"), illustrated:true,
          transcript: `<details class="book-art-transcript"><summary>Прочитать текст разворота</summary><div>${illustrated.notes.map(note => `<p>${esc(note)}</p>`).join("")}${paras(article.body)}</div></details>`});
      } else {
        const paragraphs = String(article.body || "").split("\n\n"), middle = Math.ceil(paragraphs.length / 2);
        result.push({section:"guide", id:article.id, title:article.title,
          left:page(esc(article.category),esc(article.title),`<p class="book-lede">${esc(article.intro)}</p>${paras(paragraphs.slice(0,middle).join("\n\n"))}`),
          right:page("ЗАМЕТКИ НА ПОЛЯХ","Пригодится",`${paras(paragraphs.slice(middle).join("\n\n"))}<button class="book-text-button" data-read>Прочитал · забрать ачивку ↗</button>`)});
      }
    }
    for (let i = 0; i < badges.length; i += 4) {
      const items = badges.slice(i, i + 4);
      const count = badges.filter(unlocked).length;
      const half = (list) => `<div class="book-card-pair">${list.map(b => badge(b, false, true)).join("")}</div>`;
      result.push({ section: "collection", id: `collection-${i}`, title: "Коллекция достижений",
        left: page("СОБИРАЙ СВОЮ ИСТОРИЮ", "Карточки соседа", `${me.user ? `<p class="book-pencil">В коллекции ${count} из ${badges.length}</p>` : '<p class="book-pencil"><a href="/login">Войди</a>, чтобы сохранять достижения.</p>'}${half(items.slice(0, 2))}`, "book-collection-page"),
        right: page("КАЖДАЯ КАРТА — ВОСПОМИНАНИЕ", "Ещё одна встреча", `${items.length > 2 ? half(items.slice(2)) : '<div class="book-note"><strong>Встречи складываются в коллекцию</strong><p>Каждая вставленная карточка — маленькая история. Приходи на встречи, пробуй новое и заполняй пустые места в альбоме.</p><p>Новые карточки появятся, когда организатор подтвердит твоё участие.</p></div><div class="book-doodle" aria-hidden="true">✦ <span>10</span> ✦</div>'}<p class="book-pencil">Посещение подтверждает организатор. Пустые кармашки ждут твоих карточек.</p>`, "book-collection-page") });
    }
    const proposals = (me.proposals || []).slice().sort((a,b) => new Date(b.created) - new Date(a.created));
    result.push({ section: "stories", id: "ideas", title: "Всё начинается с идеи",
      left: page("ВСТРЕЧИ, КОТОРЫЕ ПРИДУМАЛ ТЫ", "А что, если<br>собраться?", `<p class="book-lede">Кино, турнир, обмен книгами — хорошая встреча начинается с одного предложения.</p><div class="book-note"><strong>Запиши три вещи</strong><ol><li>Что будем делать?</li><li>Где и когда соберёмся?</li><li>Что нужно принести?</li></ol></div><p>Организатор рассмотрит идею и свяжет её с опубликованным мероприятием. После встречи её история останется здесь.</p><p class="book-pencil">Предложено идей: ${proposals.length}</p>`),
      right: page("ПЕРВАЯ СТРОЧКА НОВОЙ ИСТОРИИ", "Предложить встречу", me.user ? `<form id="proposal-form" class="book-proposal-form"><label>Название<input name="title" maxlength="120" placeholder="Например, вечер настолок" required></label><label>Идея и подробности<textarea name="body" maxlength="2000" rows="5" placeholder="Что, где, когда и что понадобится?" required></textarea></label><button class="button" type="submit">Отправить идею ↗</button><p class="book-pencil">Идею увидят только ты и организаторы. До пяти идей на рассмотрении.</p><span id="proposal-status" role="status"></span></form>` : `<div class="book-empty"><span aria-hidden="true">✎</span><h3>Твой дневник ещё впереди</h3><p>Войди, чтобы предлагать встречи, следить за ответом и хранить истории своих мероприятий.</p><a class="button" href="/login">Войти в дневник ↗</a></div>`) });
    for (let i = 0; i < proposals.length; i += 2) {
      const proposalPage = (p) => {
        if (!p) return page("ПРОДОЛЖЕНИЕ СЛЕДУЕТ", "Место для новой истории", '<div class="book-empty"><span aria-hidden="true">✦</span><p>Следующая встреча может начаться с твоей идеи.</p></div>');
        const event = (me.proposedEvents || []).find(e => e.id === p.eventId);
        const finished = event && new Date(event.date) <= new Date();
        return page(finished ? "ИСТОРИЯ ТВОЕГО МЕРОПРИЯТИЯ" : "ТВОЯ ИДЕЯ", esc(p.title), `<span class="book-proposal-status">${finished ? "Встреча завершена" : event ? "В афише" : p.status === "accepted" ? "Событие пока недоступно" : statusLabel[p.status] || "На рассмотрении"}</span><p class="book-pencil">Предложено ${fmt(p.created, {day:"numeric", month:"long", year:"numeric"})}</p><div class="book-story-text">${paras(p.body)}</div>${event ? `<div class="book-event-memory"><p class="book-pencil">${fmt(event.date, {day:"numeric", month:"long", hour:"2-digit", minute:"2-digit"})} · МСК</p><h3>${esc(event.title)}</h3><p>${esc(event.place)}</p><div class="book-story-text">${paras(event.body)}</div>${finished ? "" : `<a class="book-text-button" href="/events/${esc(event.id)}">Открыть в афише ↗</a>`}</div>` : '<p class="book-pencil">Здесь появятся дата и история, когда организатор добавит встречу в афишу.</p>'}`);
      };
      result.push({ section:"stories", id:`proposal-${i}`, title:"Истории моих встреч", left:proposalPage(proposals[i]), right:proposalPage(proposals[i+1]) });
    }
    return result;
  }
  function shell() {
    const spread = spreads[current], n = current * 2 + 1;
    return `<div class="book-tabs" role="group" aria-label="Разделы дневника">${Object.entries(sectionNames).map(([key,name]) => `<button data-book-section="${key}" class="${spread.section === key ? "active" : ""}" aria-pressed="${spread.section === key}">${name}</button>`).join("")}</div><div class="book-scene"><div class="diary-book" tabindex="0" role="region" aria-label="Раскрытый дневник, ${context.esc(spread.title)}"><div class="book-cover" aria-hidden="true"></div><div class="book-paper-block" aria-hidden="true"></div><div class="book-spread ${spread.illustrated ? "book-illustrated-spread" : ""}"><section class="book-page book-left" aria-label="Левая страница">${spread.left}<span class="book-page-number">${n}</span></section><section class="book-page book-right" aria-label="Правая страница">${spread.right}<span class="book-page-number">${n + 1}</span></section></div><div class="book-spine" aria-hidden="true"></div><div class="book-ribbon" aria-hidden="true"></div></div></div><div class="book-controls"><button class="book-arrow" data-book-turn="-1" aria-label="Предыдущий разворот" ${current === 0 ? "disabled" : ""}>←</button><span role="status" aria-live="polite"><strong>${context.esc(spread.title)}</strong><small>Разворот ${current + 1} / ${spreads.length}</small></span><button class="book-arrow" data-book-turn="1" aria-label="Следующий разворот" ${current === spreads.length - 1 ? "disabled" : ""}>→</button></div>${spread.transcript || ""}${spread.illustrated ? '<div class="book-art-actions"><button class="book-text-button" data-read>Прочитал · забрать ачивку ↗</button></div>' : ""}`;
  }
  function render(c) {
    activeCurl?.cancel(); activeCurl = null; context = c; spreads = build(c); turning = false;
    const nextRoute = c.id || "welcome";
    if (route !== nextRoute) {
      route = nextRoute;
      const found = spreads.findIndex(s => s.id === nextRoute || s.section === nextRoute);
      current = found < 0 ? 0 : found;
    }
    current = Math.min(current, spreads.length - 1);
    return `<div class="diary-room"><div class="page diary-layout"><div class="diary-heading"><div><div class="eyebrow">ПЕРЕДОВИКОВ, 13 · ЛИЧНАЯ ХРОНИКА</div><h1>Дневник общежития</h1></div><p>Хорошие истории<br>начинаются по соседству.</p></div><div id="interactive-book">${shell()}</div><p class="book-help">Твои ачивки и идеи сохраняются в профиле. Гайд открыт всем.</p></div></div>`;
  }
  function prepareTurn(target, focus = ".diary-book") {
    if (turning || target < 0 || target >= spreads.length || target === current) return null;
    const root = document.querySelector("#interactive-book");
    if (!root) return null;
    const forward = target > current, book = root.querySelector(".diary-book");
    // Small screens use the same curved sheet; only one page is visible at once.
    const front = book.querySelector(forward ? ".book-right" : ".book-left");
    const back = front.cloneNode(false);
    back.className = `book-page ${forward ? 'book-left' : 'book-right'}`;
    const next = spreads[target], number = target * 2 + (forward ? 1 : 2);
    if (next.illustrated) back.style.padding = "0";
    back.innerHTML = (forward ? next.left : next.right) + `<span class="book-page-number">${number}</span>`;
    const sheet = DormPageCurl.create({book, front, back, forward, complete:landed => {
      activeCurl = null; turning = false;
      if (!root.isConnected) return;
      if (landed) current = target;
      root.innerHTML = shell();
      root.querySelector(focus)?.focus({preventScroll:true});
    }});
    // Under the moving sheet: the next right (or previous left) page is exposed.
    front.innerHTML = (forward ? next.right : next.left) + `<span class="book-page-number">${target * 2 + (forward ? 2 : 1)}</span>`;
    front.classList.toggle("book-under-illustration", !!next.illustrated);
    turning = true; activeCurl = sheet;
    return sheet;
  }
  function turn(target, focus = ".diary-book") {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (turning || target < 0 || target >= spreads.length || target === current) return;
      current = target;
      const root = document.querySelector("#interactive-book");
      if (root) { root.innerHTML = shell(); root.querySelector(focus)?.focus({preventScroll:true}); }
      return;
    }
    prepareTurn(target, focus)?.settle(1);
  }
  function handle(button) {
    if (button.hasAttribute("data-book-turn")) {
      turn(current + Number(button.dataset.bookTurn), `[data-book-turn="${button.dataset.bookTurn}"]`); return true;
    }
    if (button.dataset.bookSection) {
      turn(spreads.findIndex(s => s.section === button.dataset.bookSection), `[data-book-section="${button.dataset.bookSection}"]`); return true;
    }
    return false;
  }
  document.addEventListener("keydown", e => {
    if (!e.target.closest(".diary-book") || e.target.closest("input,textarea,select,button,a") || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); turn(current + (e.key === "ArrowRight" ? 1 : -1)); }
  });
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const book = e.target.closest(".diary-book");
    if (!book || e.button !== 0 || turning || e.target.closest("input,textarea,button,a,select,summary")) return;
    const rect = book.getBoundingClientRect(), fraction = (e.clientX - rect.left) / rect.width;
    // Page edges are draggable; the center stays available for reading/scrolling.
    if (fraction > .82 || fraction < .18) {
      const forward = fraction > .5;
      const sheet = prepareTurn(current + (forward ? 1 : -1));
      if (!sheet) return;
      e.preventDefault();
      drag = {sheet, book, id:e.pointerId, x:e.clientX, y:e.clientY, width:rect.width, forward, progress:0, moved:false};
      book.setPointerCapture(e.pointerId);
    } else if (e.pointerType !== "mouse") {
      drag = {x:e.clientX,y:e.clientY,book,width:rect.width,swipe:true};
    }
  });
  document.addEventListener("pointermove", e => {
    if (!drag || drag.swipe) return;
    const distance = (drag.x - e.clientX) * (drag.forward ? 1 : -1);
    if (Math.abs(distance) > 8) drag.moved = true;
    if (!drag.moved) return;
    e.preventDefault();
    drag.progress = Math.max(0,Math.min(1,distance / (drag.width * .72)));
    drag.sheet.setProgress(drag.progress);
  }, {passive:false});
  const release = (e, cancelled = false) => {
    if (!drag) return;
    const previous = drag; drag = null;
    if (previous.swipe) {
      if (cancelled) return;
      const x=e.clientX-previous.x,y=e.clientY-previous.y;
      if (Math.abs(x)>70 && Math.abs(x)>Math.abs(y)*1.5) turn(current+(x<0?1:-1));
    } else {
      if (previous.book.hasPointerCapture(previous.id)) previous.book.releasePointerCapture(previous.id);
      previous.sheet.settle(cancelled ? 0 : !previous.moved || previous.progress > .32 ? 1 : 0);
    }
  };
  document.addEventListener("pointerup", e => release(e));
  document.addEventListener("pointercancel", e => release(e,true));
  document.addEventListener("dragstart", e => { if (e.target.closest(".diary-book")) e.preventDefault(); });
  return {render, handle};
})();
