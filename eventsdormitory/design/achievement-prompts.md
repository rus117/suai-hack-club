# Иллюстрации коллекции дневника

Созданы встроенным image_gen, отдельной генерацией для каждой из десяти карточек. Финальные файлы: `web/assets/achievements/*.webp`, размер до 640×960, десять файлов суммарно около 2 МБ. Оригиналы генерации сохранены генератором отдельно. Обзор: `achievement-contact-sheet.jpg`.

Общее направление промпта: одна портретная коллекционная карточка 2:3 для студенческого общежития; дружелюбная spooky-cute иллюстрация, толстые неровные чёрные контуры, карандашная штриховка, фактура винтажной кремовой бумаги, ограниченная приглушённая палитра, кремовая рамка со скруглёнными углами. Вид строго спереди, объект заполняет карточку. Без текста, букв, цифр, логотипов, рук и фотографического окружения. Референсы пользователя задают настроение; композиции оригинальные.

| Файл | Название | Предмет промпта |
|---|---|---|
| first.webp | Первый выход | Friendly little ivory skull peeking through an open red dormitory door, tiny key and welcoming star |
| three.webp | Уже свой | Three friendly ivory skull neighbours sharing tea around a tiny table, muted lavender |
| five.webp | Душа этажа | Cheerful ivory skull wearing a brick-red jester hood with tiny bells, community party star confetti |
| tech.webp | Собрал и запустил | Cute ivory skull student with headphones building a tiny teal computer, circuit sparks |
| sport.webp | На площадке | Cheerful little ivory skull holding a basketball and wearing an orange headband |
| creative.webp | Творческий беспорядок | Little ivory skull artist holding a brush, burgundy paint jar and lavender ink splashes |
| together.webp | Чай с соседями | Three tiny pumpkin skull faces steeping inside a whimsical orange tea bag with a string, cozy shared evening |
| read.webp | Между строк | Small ivory skull reading a cream book by a burgundy candle, ink stars |
| roof.webp | Выход на крышу | Tiny ivory skull cat sitting in a crescent moon above dormitory rooftops, deep lavender night |
| ten.webp | Легенда общежития | Friendly ivory skull with a small crown and ten little cream stars, burgundy and gold accents |

Карточки не содержат сгенерированных надписей: названия, условия и статус выводятся доступным HTML рядом с кармашком. Незаработанные картинки представлены бледным силуэтом, заработанные — полноцветными карточками с уголками и отметкой «В коллекции».

## Реализация дневника

`book.js` формирует развороты из актуальных статей, достижений пользователя и его предложений. `book.css` оформляет физическую книгу в стиле референса: тёмный тканевый переплёт, округлые страницы, настоящие текстуры бумаги и дерева, рукописные заголовки. Иллюстрированные статьи снова используют исходные рисунки разворотов; текстовая версия доступна ниже книги. `page-curl.js` строит двусторонний лист из 48 соединённых полос CSS 3D, интегрирует изгиб поверхности по ширине и обновляет его при перетаскивании и анимации. В конце обратная сторона точно совмещается с соседней страницей. Тексты, карточки и формы остаются HTML.

API `POST /api/proposal` сохраняет авторство из серверной сессии. `POST /api/admin/proposal` позволяет организатору связать идею с опубликованным событием. `/api/me` возвращает только идеи текущего пользователя и связанные события, включая завершённые. Старая база JSON загружается без ручной миграции: поле proposals первоначально пустое. Идеи, ранее отправленные в Telegram, автоматически не импортируются.

Проверено: Go tests с race detector, go vet, сборка; браузерные сценарии гостя и пользователя, клавиши и перелистывание, десять изображений, отправка идеи, история завершённого события, выдача ачивки за чтение, кармашки заработанных/незаработанных карт, ширина 390 px без горизонтального переполнения. Скриншоты в этой папке показывают отдельные тестовые данные локального демопрофиля.


## Материалы книги и анимация

Два дополнительных ресурса созданы встроенным image_gen:

- `web/assets/book/open-diary.webp`: редактирование исходного `diary-spreads/neighbors.webp`. Промпт: preserve the exact overhead camera, dark navy woven cloth cover, rounded thick cream paper corners, page stacks, curved gutter, wood tabletop and soft daylight; remove all writing, highlight marks and drawings; leave both pages blank warm natural ivory paper with tactile grain; no extra objects.
- `web/assets/book/wood.webp`: strictly overhead seamless warm medium-brown oak desktop, horizontal natural wood grain, matte finish, diffuse daylight, no objects or writing.

Проверена анимация вперёд/назад, 48 разных пространственных преобразований полос, перетаскивание, возврат после короткого движения, совмещение страницы при завершении, reduced motion и отсутствие ошибок браузера. `diary-page-turn.gif` записан из 49 кадров реального браузера; это работа сайта, а не сгенерированное видео.
