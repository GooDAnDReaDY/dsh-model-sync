# Progress: Issue #124

- **2026-09-12**: Создан worktree \eat-speed-quality-optimizations\ от свежего \origin/main\ (\6529fbf\).
- **2026-09-12**: Зарегистрирован Gitea Issue #124 (\priority/medium\, \	ype/feature\, \status/in-progress\).
- **2026-09-12**: Зафиксирован детальный план работ в \docs/plans/124-speed-quality-optimizations.md\.

- **2026-09-12**: Реализован HTTP ETag / 304 Not Modified для `GET /dsh-model-sync/status`.
- **2026-09-12**: Добавлена поддержка условных запросов `If-None-Match` и `If-Modified-Since` при опросе каталогов провайдеров.
- **2026-09-12**: Добавлен экспоненциальный retry jitter в `lib/reliability.js`.
- **2026-09-12**: Добавлено расширенное распознавание capabilities (`code`, `reasoning` / `thinking`) в `lib/models.js`, `lib/policy.js` и `lib/adapter-registry.js`.
- **2026-09-12**: Реализован 150ms debounce строки поиска и `React.useMemo` для фильтрации и сортировки в `lib/client.js`.
- **2026-09-12**: Написаны unit-тесты (104/104 passing), обновлены DESIGN.md, README.md, README.ru.md, README.zh.md.
