# Changelog

## 0.2.6 — 2026-08-24

- frozen snapshots из scope.get() и watcher теперь клонируются перед Schema.resolve;
- устранено падение boot с Cannot assign to read only property при сохранённом выборе моделей.

## 0.2.5 — 2026-08-24

- Settings service привязывается синхронно до создания synchronizer, без окна CONFIG_UNAVAILABLE после старта;
- fallback через ctx.inject сохраняется для позднего подключения провайдера настроек.

## 0.2.4 — 2026-08-24

- base-конфиг настроек клонируется перед регистрацией схемы, чтобы frozen DSH config корректно принимал allowlist;
- устранена ошибка Cannot assign to read only property при первом сохранении выбора моделей.

## 0.2.3 — 2026-08-24

- writer выбора моделей теперь корректно подключается после асинхронной инициализации Cordis Settings;
- сохранение allowlist больше не возвращает CONFIG_UNAVAILABLE в штатном DSH runtime.

## 0.2.2 — 2026-08-24

- подключение namespace настроек переведено на штатный DSH Settings API через ctx.inject(['settings']);
- выбор моделей сохраняется в настройках DSH;
- при ошибке записи каталога allowlist откатывается, чтобы конфигурация не расходилась с каталогом;
- добавлены регрессионные тесты для wiring и атомарности.
