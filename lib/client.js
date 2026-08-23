window.__ModuleLoader__.load({
  id: '@goodandready/dsh-model-sync',
  factory: (require) => {
    const React = require('react')
    const en = {
      title: 'Model synchronization', desc: 'Refresh model catalogs for API-key providers. A dry-run is the default; applying changes is explicit.', loading: 'Loading…', refresh: 'Refresh status', run: 'Discover', apply: 'Apply changes', dryRun: 'Preview only (dry-run)', all: 'All API-key providers', ok: 'ready', dormant: 'not configured', running: 'running…', noProviders: 'No API-key providers found.', lastRun: 'Last run',
    }
    const ru = {
      title: 'Синхронизация моделей', desc: 'Обновляет каталоги моделей у провайдеров с API-ключом. По умолчанию только dry-run; применение запускается явно.', loading: 'Загрузка…', refresh: 'Обновить статус', run: 'Проверить', apply: 'Применить изменения', dryRun: 'Только просмотр (dry-run)', all: 'Все API-key провайдеры', ok: 'готов', dormant: 'не настроен', running: 'выполняется…', noProviders: 'API-key провайдеры не найдены.', lastRun: 'Последний запуск',
    }
    const API = '/dsh-model-sync'
    function useLocale(ctx) {
      return React.useSyncExternalStore(React.useMemo(() => (cb) => ctx.locale?.subscribe?.(cb) ?? (() => {}), [ctx]), React.useCallback(() => ctx.locale?.getSnapshot?.().active ?? 'en', [ctx]))
    }
    function ModelSyncSection({ ctx }) {
      const locale = useLocale(ctx); const t = locale === 'ru' ? ru : en
      const [status, setStatus] = React.useState(null); const [provider, setProvider] = React.useState(''); const [dryRun, setDryRun] = React.useState(true); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('')
      const load = React.useCallback(() => { setError(''); return fetch(`${API}/status`).then((r) => r.json()).then(setStatus).catch((e) => setError(String(e?.message ?? e))) }, [])
      React.useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer) }, [load])
      const run = () => { setBusy(true); setError(''); fetch(`${API}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: provider || undefined, dryRun }) }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body }).then(setStatus).catch((e) => setError(String(e?.message ?? e))).finally(() => setBusy(false)) }
      const rows = status?.providers ?? []; const button = (label, onClick) => React.createElement('button', { type: 'button', disabled: busy, onClick, style: { marginRight: 8 } }, label)
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 } },
        React.createElement('p', null, t.desc),
        React.createElement('div', null, React.createElement('select', { value: provider, onChange: (e) => setProvider(e.target.value) }, React.createElement('option', { value: '' }, t.all), rows.map((row) => React.createElement('option', { key: row.provider, value: row.provider }, row.provider))), React.createElement('label', { style: { marginLeft: 12 } }, React.createElement('input', { type: 'checkbox', checked: dryRun, onChange: (e) => setDryRun(e.target.checked) }), ` ${t.dryRun}`)),
        React.createElement('div', null, button(t.refresh, load), button(dryRun ? t.run : t.apply, run)),
        status?.lastRun ? React.createElement('small', null, `${t.lastRun}: ${new Date(status.lastRun.finishedAt).toLocaleString()}`) : null, status?.running || busy ? React.createElement('small', null, t.running) : null, error ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, error) : null, status === null ? React.createElement('small', null, t.loading) : null, rows.length === 0 && status ? React.createElement('small', null, t.noProviders) : null,
        rows.map((row) => React.createElement('div', { key: row.provider }, `${row.provider}: ${row.configured ? t.ok : t.dormant} · ${row.models?.length ?? 0} models`)),
      )
    }
    function apply(ctx) { ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-model-sync', order: 25, label: () => 'Model Sync' }, (props) => React.createElement(ModelSyncSection, { ...props, ctx }))) }
    module.exports = { apply, inject: ['slots', 'locale'] }; return module.exports
  },
})
