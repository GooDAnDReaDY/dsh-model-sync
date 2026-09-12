# Findings: Issue #124

- Текущая кодовая база имеет 100 тестов с покрытием строк 96.01%.
- В \lib/http.js\ маршрут \GET /dsh-model-sync/status\ отдает полный объект состояния \uildStatusPayload()\ без заголовков кэширования (\ETag\, \If-None-Match\).
- В \lib/client.js\ UI опрашивает \/status\ каждые 15000мс. Если возвращать \304 Not Modified\, браузерный fetch завершится без распаковки JSON.
- В \lib/generic-adapter.js\ и \lib/synchronizer.js\ запросы к upstream не используют передачу \If-None-Match\ / \If-Modified-Since\ и сохранение \ETag\ провайдера.
- В \lib/models.js\ распознаются только базовые capabilities (\ision\, \	ools\, \easoning\, \mbeddings\).
