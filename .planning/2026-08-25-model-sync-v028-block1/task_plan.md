# dsh-model-sync: два patch-блока развития

## Goal

Разработать 10 согласованных направлений двумя последовательными блоками по 5 задач. Блок 1 выпускается как `v0.2.8`, блок 2 — как `v0.2.9`; внутри блока версия не меняется.

## Current Phase

Phase 7 — проверки блока и релиз v0.2.8

## Phases

### Phase 1 — preflight, milestones и план
Status: complete

- Проверить канонические инструкции, origin/main, version gate, worktrees.
- Назначить #26–#30/#31 в milestone `v0.2.8` и #27/#32–#35 в `v0.2.9`.
- Создать отдельную ветку блока от свежего `origin/main`.

### Phase 2 — #29 нормализация метаданных и capability-флаги
Status: complete

- Исследовать текущие provider adapters и публичные решения.
- Реализовать нормализованную схему без изменения raw provider/model id.
- Добавить unit/regression tests и evidence в issue/PR.

### Phase 3 — #31 надёжность массовой синхронизации
Status: complete
### Phase 4 — #30 health-check провайдеров
Status: complete
### Phase 5 — #28 постоянные политики отбора
Status: complete
### Phase 6 — #26 фоновый планировщик
Status: complete

### Phase 7 — проверки блока и релиз v0.2.8
Status: in_progress

- npm test, node --check, diff/audit/pack checks.
- staging install from publication artifact and smoke/e2e.
- Gitea PR/merge; one patch version increment to `0.2.8`.

### Phase 8 — #27 история изменений
Status: pending
### Phase 9 — #32 lifecycle stale/deprecated
Status: pending
### Phase 10 — #33 credentialRef diagnostics
Status: pending
### Phase 11 — #34 reports and notifications
Status: pending
### Phase 12 — #35 adapter registry
Status: pending

### Phase 13 — проверки блока и релиз v0.2.9
Status: pending

- Full release-artifact tests and staging smoke/e2e.
- Gitea PR/merge; one patch version increment to `0.2.9`.

## Next Step

Проверить публикационный артефакт и staging smoke для полного блока; затем открыть review/merge gate. До этого версия остаётся `0.2.7`.

## Decisions Made

- Блок 1: #29 → #31 → #30 → #28 → #26.
- Блок 2: #27 → #32 → #33 → #34 → #35.
- Версия меняется один раз после полного DoD каждого блока.
- Ветка блока общая; отдельные задачи закрываются только после проверок.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Milestone assignment script получил `None` для issue без milestone | 1 | Исправлен обработчик `issue.get('milestone') or {}`, повторный запуск выполнен идемпотентно |
| `apply_patch` отсутствует на MiniAI | 1 | Для server-side planning-файлов использован Python fallback; код проекта этим способом не меняется |
| Новые #31 тесты получили 0 вызовов | 1 | Выявлено, что unit fallback с отсутствующим `providers` не совпадал с Config default; введён безопасный `providerConfig=[]` |
| HTTP health route добавил четвёртый disposer, старое ожидание теста было 3 | 1 | Обновлено ожидание и добавлен отдельный route contract test |
| Ошибка оркестрации tool-вызова (`ReferenceError: command is not defined`) | 1 | Повторен вызов с корректным `exec_command` |

## #28 DoD

- Реализованы bounded include/exclude regex-паттерны, tags и explicit capability filters.
- `modelPolicies` сохраняются через settings API; dry-run показывает policy-approved models, apply обновляет только активный каталог.
- Добавлены `/policy`, bilingual Settings editor, tests/docs.
- Проверка: `npm test` 51/51; `node --check lib/*.js`; `git diff --check`; `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities.

## #26 DoD

- Планировщик включается только через `scheduleEnabled`; ручной путь не зависит от него.
- Один guarded timer поддерживает per-provider interval, TTL и jitter; overlap исключён.
- Статус API/UI показывает active, last/next и ошибки по провайдерам.
- Проверка: `npm test` 53/53; `node --check lib/*.js`; `git diff --check`; `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities.
