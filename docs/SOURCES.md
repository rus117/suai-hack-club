# Источники и принципы

## Формат мероприятия

- [Вайбкодинг ФКН ВШЭ](https://cs.hse.ru/hack-club/vibehack) — прототип за ограниченное время, свободный выбор решений, командная работа, демонстрация и обсуждение AI-подхода. В опубликованных материалах клуба фигурируют мероприятия 7 декабря 2025 и 15 марта 2026. Формат адаптирован к небольшой встрече в общежитии; SUAI Hack Club не представлен как подразделение или партнёр ВШЭ.
- [Пост/регистрация, присланные организатором](https://cs.hse.ru/hack-club/polls/1104852324.html) — 7-часовой марафон, поддержка новичков и свобода выбора инструментов. Даты и призы ВШЭ не перенесены в SUAI.

Сайт использует собственные тексты, логотип и вёрстку. Для Campus ML подготовлено учебное задание на исторических данных Titanic с отдельным разбиением клуба. Подробности прошлых соревнований не выдаются за подтверждённую программу SUAI.

## Навыки фронтенда, указанные заказчиком

- [frontend-design](https://github.com/AnastasiyaW/codex-claude-code-config/blob/main/skills/frontend/frontend-design/SKILL.md) — цельное художественное направление, выразительная типографика и осмысленный макет.
- [Frontend Design Skills](https://github.com/AkyRayy/Frontend-Design-SKILLS-for-AI) — типографика, сетка, контраст, состояния элементов и доступность.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — согласованная система компонентов, адаптивность и проверка интерфейса.

Принятое направление: тёмная техническая афиша, лаймовый акцент, крупный Manrope, служебные подписи JetBrains Mono, заметные даты и прямые действия. Шрифты включены локально с пакетами Fontsource. В мобильной версии сетки становятся одноколоночными, таблицы прокручиваются в собственном контейнере, меню использует нативный dialog. Учитывается prefers-reduced-motion.

## Учебные первоисточники

- [pandas — вводные уроки](https://pandas.pydata.org/docs/getting_started/intro_tutorials/)
- [scikit-learn — начало работы](https://scikit-learn.org/stable/getting_started.html)
- [scikit-learn — типичные ошибки и утечка данных](https://scikit-learn.org/stable/common_pitfalls.html)
- [MDN — веб-разработка](https://developer.mozilla.org/en-US/docs/Learn_web_development)
- [GitHub — Hello World](https://docs.github.com/en/get-started/using-github/hello-world)


## Расширенная учебная мастерская (7 октября 2026)

Собственные объяснения и упражнения клуба связывают документацию с двумя сквозными работами: учебным ML-заданием Titanic и приложением встреч. Полные сторонние курсы не копируются и не встраиваются в iframe. На сайте у каждой ссылки указаны язык, формат и конкретное действие после чтения. Длительность учитывает практику; это оценка автора маршрута, не обещание провайдеров.

Дополнительно изучены и включены:

- [Inria scikit-learn MOOC](https://inria.github.io/scikit-learn-mooc/) — pipeline, переобучение, подбор, деревья и ансамбли.
- [Google ML Crash Course](https://developers.google.com/machine-learning/crash-course) и [упражнения](https://developers.google.com/machine-learning/crash-course/exercises).
- [Яндекс: кросс-валидация](https://education.yandex.ru/handbook/ml/article/kross-validaciya), [основы Python](https://education.yandex.ru/handbook/python).
- [scikit-learn: CV](https://scikit-learn.org/stable/modules/cross_validation.html), [Pipeline](https://scikit-learn.org/stable/modules/compose.html), [подбор](https://scikit-learn.org/stable/modules/grid_search.html), [порог](https://scikit-learn.org/stable/modules/classification_threshold.html), [permutation importance](https://scikit-learn.org/stable/inspection/permutation_importance.html).
- [MDN: клиент и сервер](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Client-Server_overview), [формы](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/HTML_forms), [отладка](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Debugging_JavaScript).
- [React: Thinking in React](https://react.dev/learn/thinking-in-react).
- [Claude Code: Best practices](https://code.claude.com/docs/en/best-practices), [GitHub Copilot: постановка задач](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-coding-agent-to-work-on-tasks/best-practices-for-using-copilot-to-work-on-tasks).
- [Playwright: Best practices](https://playwright.dev/docs/best-practices), [W3C WAI: Easy Checks](https://www.w3.org/WAI/test-evaluate/easy-checks/).

Тексты уроков находятся в `src/learning/`, порядок маршрутов — в `src/materials.ts`, материалы для скачивания — в `public/learning/`. При обновлении содержания проверяйте ссылки, суммы часов и согласованность схемы development/holdout. Учебный notebook публикуется с пустыми выводами и не содержит закрытых ответов.

## Данные Titanic

[OpenML Titanic 40945](https://www.openml.org/d/40945), авторы Frank E. Harrell Jr., Thomas Cason. 1 309 исторических записей; метаданные OpenML обозначают лицензию как Public. Подготовка данных, проверенная контрольная сумма и ограничения рейтинга описаны в [server/datasets/README.md](../server/datasets/README.md). Клуб использует своё стратифицированное разбиение и не претендует на секретность исторических исходов.
