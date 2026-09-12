# Plan: Issue #124 — Оптимизация скорости, фонового трафика, UI поиска и распознавания возможностей моделей

## Цели
1. **HTTP ETag / 304 Not Modified** в lib/http.js для GET /dsh-model-sync/status:
   - Вычислять слабый ETag на основе состояния (конфиг, finishedAt последнего синка, количество провайдеров и моделей).
   - При совпадении If-None-Match возвращать 304 Not Modified с пустым телом, полностью экономя JSON-сериализацию и передачу по сети при регулярном 15-секундном опросе UI.
2. **Upstream Conditional Requests (ETag / If-None-Match)** в адаптерах и синхронизаторе:
   - Сохранять upstream etag / lastModified в метаданных провайдера/кэше.
   - Передавать If-None-Match / If-Modified-Since при опросе API провайдеров (OpenRouter, Generic OpenAI endpoints).
   - При ответе 304 от провайдера мгновенно возвращать закэшированный список моделей без повторного парсинга и реконсиляции.
3. **Debounce и memoization в UI (lib/client.js)**:
   - Добавить debounce (150ms) на строку поиска моделей в ModelPicker.
   - Использовать React.useMemo для сортировки и фильтрации каталога моделей.
4. **Расширенное детектирование возможностей моделей в lib/models.js**:
   - Добавить теги / маркеры для современных специализированных моделей: code, thinking / reasoning (DeepSeek-R1, o1/o3-mini, QwQ и аналоги), распознавание больших контекстов (>128k).
5. **Backoff jitter при повторах запросов**:
   - В retry-механизме запросов добавить экспоненциальный джиттер, предотвращая одновременные повторные обращения к провайдерам.
6. **Тесты и документация**:
   - 100% прохождение тестов, расширение unit-тестов под ETag/304, jitter, capabilities и debounce.
   - Обновление docs/design/DESIGN.md, README.md, README.ru.md, README.zh.md.

## Фазы
- [x] Фаза 1: HTTP ETag / 304 в lib/http.js и тест ETag.
- [x] Фаза 2: Upstream conditional requests и retry jitter в адаптерах и синхронизаторе.
- [x] Фаза 3: Расширенное распознавание capabilities в lib/models.js.
- [x] Фаза 4: UI debounce и useMemo в lib/client.js.
- [x] Фаза 5: Тестирование, покрытие, обновление документации (DESIGN.md, README*).
