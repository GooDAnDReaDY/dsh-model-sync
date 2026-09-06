# План реализации: Комплексное устранение замечаний аудита (#107, #108, #109)

## 1. Контекст
Автоматический аудит DSH выявил 3 проблемы:
1. **Issue #108**: В `lib/client.js` используется `t.noHistory`, но ключ отсутствует в словарях `en` и `ru`.
2. **Issue #109**: В `lib/client.js` в пикере моделей захардкожены русские строки поиска и сортировки (`'Поиск id/name/tag'`, `'Имя A→Z'`, `'Цена ↑'`, `'Контекст ↓'`, `'Новые ↓'`).
3. **Issue #107**: Поля схемы `Config` (`scheduleEnabled`, `intervalMinutes`, `autoApply`) не имеют элементов редактирования в карточке настроек; клиент не запрашивает `settingsScope`.

## 2. Архитектура решения

### Блок 1. Локализация (Issues #108, #109)
- В `en` и `ru` добавить:
  - `noHistory`: `'No synchronization history.'` / `'Истории синхронизаций нет.'`
  - `searchPlaceholder`: `'Search id/name/tag'` / `'Поиск id/name/tag'`
  - `sortName`: `'Name A→Z'` / `'Имя A→Z'`
  - `sortPrice`: `'Price ↑'` / `'Цена ↑'`
  - `sortContext`: `'Context ↓'` / `'Контекст ↓'`
  - `sortDate`: `'Newest ↓'` / `'Новые ↓'`
  - `schedulerSettings`: `'Scheduler configuration'` / `'Настройка планировщика'`
  - `scheduleEnabled`: `'Enable background schedule'` / `'Включить фоновое расписание'`
  - `intervalMinutes`: `'Interval (minutes)'` / `'Интервал (минуты)'`
  - `autoApply`: `'Auto-apply changes'` / `'Автоматически применять изменения'`
  - `saveScheduler`: `'Save scheduler'` / `'Сохранить настройки планировщика'`
  - `schedulerSaved`: `'Saved'` / `'Сохранено'`
- Заменить жестко закодированные строки в пикере на обращение к `t.*`.

### Блок 2. Управление планировщиком через settingsScope (Issue #107)
- В `lib/client.js`:
  - В `module.exports.inject` добавить `'settingsScope'`: `['slots', 'locale', 'settingsScope']`.
  - В `ModelSyncSection` добавить секцию формы для планировщика:
    - Подписка на снимок `ctx.settingsScope.bind({ namespace: NS })`.
    - Отображение статуса снимка (`loading` / `unavailable` / `ready`).
    - Поля: чекбокс `scheduleEnabled`, числовое поле `intervalMinutes` (min: 1), чекбокс `autoApply`.
    - Кнопка сохранения с записью через `scope.set(...)`.

### Блок 3. Тесты и документация
- Обновить `test/client-factory.test.mjs` для проверки экспорта `settingsScope` и новых ключей.
- Добавить тесты на сохранение настроек планировщика.
- Прогнать `node --test` (93+ тестов).
