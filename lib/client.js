window.__ModuleLoader__.load({
  id: '@goodandready/dsh-model-sync',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const en = {
      title: 'Model synchronization', desc: 'Refresh model catalogs for API-key providers. A dry-run is the default; applying changes is explicit.', loading: 'Loading…', refresh: 'Refresh status', refreshAll: 'Refresh all', run: 'Discover', apply: 'Apply changes', dryRun: 'Preview only (dry-run)', all: 'All API-key providers', ok: 'ready', dormant: 'not configured', running: 'running…', noProviders: 'No API-key providers found.', lastRun: 'Last run', selectModels: 'Choose models', saveSelection: 'Save and apply selection', selectAtLeastOne: 'Select at least one model or use All models.', cancel: 'Cancel', selected: 'selected', allModels: 'All models', noModels: 'No models in the current catalog.', pickerNote: 'The selection is applied to the DSH model picker immediately.',
    }
    const ru = {
      title: 'Синхронизация моделей', desc: 'Обновляет каталоги моделей у провайдеров с API-ключом. По умолчанию только dry-run; применение запускается явно.', loading: 'Загрузка…', refresh: 'Обновить статус', refreshAll: 'Обновить все', run: 'Проверить', apply: 'Применить изменения', dryRun: 'Только просмотр (dry-run)', all: 'Все API-key провайдеры', ok: 'готов', dormant: 'не настроен', running: 'выполняется…', noProviders: 'API-key провайдеры не найдены.', lastRun: 'Последний запуск', selectModels: 'Выбрать модели', saveSelection: 'Сохранить и применить выбор', selectAtLeastOne: 'Выберите хотя бы одну модель или нажмите «Все модели».', cancel: 'Отмена', selected: 'выбрано', allModels: 'Все модели', noModels: 'В текущем каталоге нет моделей.', pickerNote: 'Выбор сразу применяется к пикеру моделей DSH.',
    }
    const API = '/dsh-model-sync'
    function useLocale(ctx) {
      return React.useSyncExternalStore(React.useMemo(() => (cb) => ctx.locale?.subscribe?.(cb) ?? (() => {}), [ctx]), React.useCallback(() => ctx.locale?.getSnapshot?.().active ?? 'en', [ctx]))
    }
    function ModelSyncSection({ ctx }) {
      const locale = useLocale(ctx); const t = locale === 'ru' ? ru : en
      const [status, setStatus] = React.useState(null); const [provider, setProvider] = React.useState(''); const [dryRun, setDryRun] = React.useState(true); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('')
      const [selectionProvider, setSelectionProvider] = React.useState(''); const [selectionDraft, setSelectionDraft] = React.useState([])
      const load = React.useCallback(() => { setError(''); return fetch(`${API}/status`).then((r) => r.json()).then(setStatus).catch((e) => setError(String(e?.message ?? e))) }, [])
      React.useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer) }, [load])
      const execute = (targetProvider) => { setBusy(true); setError(''); fetch(`${API}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: targetProvider || undefined, dryRun }) }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body }).then(setStatus).catch((e) => setError(String(e?.message ?? e))).finally(() => setBusy(false)) }
      const openSelection = (row) => { const available = row.availableModels ?? row.models ?? []; setSelectionProvider(row.provider); setSelectionDraft(row.selectedModels?.length ? row.selectedModels : available.map((model) => model.id)) }
      const closeSelection = () => { setSelectionProvider(''); setSelectionDraft([]) }
      const saveSelection = () => { const row = rows.find((item) => item.provider === selectionProvider); const available = row?.availableModels ?? row?.models ?? []; if (available.length > 0 && selectionDraft.length === 0) { setError(t.selectAtLeastOne); return } const models = selectionDraft.length === available.length ? [] : selectionDraft; setBusy(true); setError(''); fetch(`${API}/selection`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: selectionProvider, models }) }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body }).then((body) => { setStatus(body); closeSelection() }).catch((e) => setError(String(e?.message ?? e))).finally(() => setBusy(false)) }
      const rows = (status?.providers ?? []).filter((row) => row.configured); const selectedRow = rows.find((row) => row.provider === selectionProvider); const choices = selectedRow?.availableModels ?? selectedRow?.models ?? []; const button = (label, onClick) => React.createElement('button', { type: 'button', disabled: busy, onClick, style: { marginRight: 8 } }, label)
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 } },
        React.createElement('p', null, t.desc),
        React.createElement('div', null, React.createElement('select', { value: provider, onChange: (e) => setProvider(e.target.value) }, React.createElement('option', { value: '' }, t.all), rows.map((row) => React.createElement('option', { key: row.provider, value: row.provider }, row.provider))), React.createElement('label', { style: { marginLeft: 12 } }, React.createElement('input', { type: 'checkbox', checked: dryRun, onChange: (e) => setDryRun(e.target.checked) }), ` ${t.dryRun}`)),
        React.createElement('div', null, button(t.refresh, load), button(t.refreshAll, () => execute(undefined)), button(dryRun ? t.run : t.apply, () => execute(provider || undefined))),
        status?.lastRun ? React.createElement('small', null, `${t.lastRun}: ${new Date(status.lastRun.finishedAt).toLocaleString()}`) : null, status?.running || busy ? React.createElement('small', null, t.running) : null, error ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, error) : null, status === null ? React.createElement('small', null, t.loading) : null, rows.length === 0 && status ? React.createElement('small', null, t.noProviders) : null,
        rows.map((row) => React.createElement('div', { key: row.provider, style: { display: 'flex', alignItems: 'center', gap: 8 } }, React.createElement('span', null, `${row.provider}: ${row.configured ? t.ok : t.dormant} · ${row.models?.length ?? 0} models`), button(t.selectModels, () => openSelection(row)))),
        selectionProvider ? React.createElement('div', { style: { border: '1px solid var(--dsw-alias-border-primary)', padding: 12, borderRadius: 6 } }, React.createElement('strong', null, `${t.selectModels}: ${selectionProvider}`), React.createElement('div', { style: { margin: '8px 0' } }, choices.length === 0 ? React.createElement('small', null, t.noModels) : choices.map((model) => React.createElement('label', { key: model.id, style: { display: 'block', margin: '4px 0' } }, React.createElement('input', { type: 'checkbox', checked: selectionDraft.includes(model.id), onChange: (e) => setSelectionDraft((current) => e.target.checked ? [...current, model.id] : current.filter((id) => id !== model.id)) }), ` ${model.name ?? model.id} (${model.id})`))), React.createElement('small', null, t.pickerNote), React.createElement('div', { style: { marginTop: 8 } }, button(t.allModels, () => setSelectionDraft(choices.map((model) => model.id))), button(t.saveSelection, saveSelection), button(t.cancel, closeSelection))) : null,
      )
    }
    function apply(ctx) { ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-model-sync', order: 25, label: () => 'Model Sync' }, (props) => React.createElement(ModelSyncSection, { ...props, ctx }))) }
    module.exports = { apply, inject: ['slots', 'locale'] }; return module.exports
  },
})
