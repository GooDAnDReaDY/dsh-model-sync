# План работ: Расширение функционала и языковой стандарт (#126)

## Задачи и статус

- [x] **Блок 1: Языковой стандарт и изоляция сборки**
  - [x] Удаление захардкоженного русского словаря из `lib/client.js`.
  - [x] Внедрение полного канонического словаря `zh` (118 ключей) наряду с `en`.
  - [x] Регистрация задачи на перевод в `goodandready/dsh-russian-lang` (Issue #191).
  - [x] Создание `.npmignore` для изоляции документации, тестов и планов от npm-пакета.

- [x] **Блок 2.2: Пакетная проверка доступности моделей (Batch Try)**
  - [x] Серверный метод `synchronizer.batchTryModels({ provider, models })` с ограниченным параллелизмом.
  - [x] Эндпоинт `POST /dsh-model-sync/batch-try`.
  - [x] UI кнопка «Test Selected» («批量测试选中模型»), отображение латентности, кнопка «Deselect unreachable».
  - [x] Тестовое покрытие в `test/http.test.js` и `test/synchronizer.test.js`.

- [x] **Блок 2.3: Политики фильтрации по цене и контексту (Cost & Context Filters)**
  - [x] Поддержка `enableCostFilter`, `maxPricePerMillion`, `enableContextFilter`, `minContextTokens` в `lib/policy.js`.
  - [x] Проброс полей в схему `Config` в `lib/index.js` и валидацию `lib/http.js`.
  - [x] UI контролы в карточке политики провайдера.
  - [x] Тестовое покрытие в `test/policy.test.js` и `test/http.test.js`.

- [x] **Блок 2.4: Экспорт и импорт конфигурации каталогов**
  - [x] Серверные методы `synchronizer.exportConfig()` и `synchronizer.importConfig(data)`.
  - [x] Эндпоинты `GET /dsh-model-sync/export` и `POST /dsh-model-sync/import`.
  - [x] UI карточка для скачивания JSON и вставки/применения JSON-конфигурации.
  - [x] Тестовое покрытие экспорта/импорта в `test/synchronizer.test.js` и `test/http.test.js`.

- [x] **Блок 2.5: Назначение пользовательских алиасов моделей**
  - [x] Хранение алиасов в схеме `aliases` в `settings.yaml`.
  - [x] Методы `getAliases()`, `setAlias()`, `deleteAlias()`.
  - [x] Эндпоинты `GET /dsh-model-sync/aliases` и `POST /dsh-model-sync/aliases`.
  - [x] UI карточка управления алиасами (добавление, просмотр, удаление).
  - [x] Тестовое покрытие в `test/synchronizer.test.js` и `test/http.test.js`.

- [x] **Блок 3: Документация и приёмка**
  - [x] Обновление `docs/design/DESIGN.md`.
  - [x] Обновление `README.md`, `README.zh.md`, `README.ru.md`.
  - [x] Проверка всех тестов: 110/110 passed, покрытие строк >= 95%.
