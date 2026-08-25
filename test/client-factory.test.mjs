import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

test('client factory uses a browser-safe CommonJS shim', () => {
  const srcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/client.js')
  const src = readFileSync(srcPath, 'utf8')
  assert.match(src, /var module = \{ exports: \{\} \}/)
  assert.match(src, /var exports = module\.exports/)
  assert.match(src, /const rows = \(status\?\.providers \?\? \[\]\)\.filter\(\(row\) => row\.configured\)/)
  assert.match(src, /refreshAll: 'Refresh all'/)
  assert.match(src, /selection/)
  assert.match(src, /Choose models/)
  assert.match(src, /Select at least one model/)
  assert.match(src, /All models/)
  assert.match(src, /Changes preview/)
  assert.match(src, /Предпросмотр изменений/)
  assert.match(src, /filterModelsByCapabilities/)
  assert.match(src, /Synchronization history/)
  assert.match(src, /Rollback catalog/)
  assert.match(src, /Confirm stale removal/)
  assert.match(src, /Credential diagnostics/)
  assert.match(src, /Check credentials/)
  assert.match(src, /loadCredentials\(\)/)
  assert.match(src, /credentialStatus === null/)
  assert.match(src, /Run report/)
  assert.match(src, /Notifications/)
  assert.match(src, /updateNotification/)
  assert.match(src, /dms-wrap/)
  assert.match(src, /dms-provider/)
  assert.match(src, /dms-provider-wrap/)
  assert.match(src, /settings\.plugin\.item/)
  assert.match(src, /key: NS/)
  assert.match(src, /ModelSyncCard/)
  assert.match(src, /dms-card/)
  assert.match(src, /dms-card\{border:1px solid var\(--dsw-alias-border-l2\);background:var\(--dsw-alias-bg-layer-3\);border-radius:12px/)
  assert.match(src, /dms-card-header\{appearance:none;width:100%/)
  assert.match(src, /dms-card-name\{color:var\(--dsw-alias-label-primary\);font-size:15px;font-weight:600/)
  assert.match(src, /dms-card-body\{border-top:1px solid var\(--dsw-alias-border-l2\);margin:0 16px;padding-bottom:8px/)
  assert.match(src, /showSettings: 'Show settings'/)
  assert.match(src, /hideSettings: 'Hide settings'/)
  assert.match(src, /showSettings.*hideSettings/)
  assert.match(src, /createElement\('svg'/)
  assert.match(src, /availableModels/)
  assert.match(src, /modelSummary/)
  assert.match(src, /latestRun/)
  assert.match(src, /diff\?\.added/)
  assert.match(src, /selectionProvider === row\.provider/)
  assert.match(src, /Manual model selection/)
  assert.match(src, /Ручной выбор моделей/)
  assert.match(src, /grid-template-columns/)
  assert.match(src, /ensureStyles/)
  let captured
  const window = { __ModuleLoader__: { load(entry) { captured = entry } } }
  runInNewContext(src, createContext({ window }))
  assert.equal(captured.id, '@goodandready/dsh-model-sync')
  const fakeReact = {
    createElement() { return null },
    useSyncExternalStore() { return 'en' },
    useMemo(fn) { return fn() },
    useCallback(fn) { return fn },
    useState(value) { return [value, () => {}] },
    useEffect() {},
  }
  const exported = captured.factory((name) => {
    if (name === 'react') return fakeReact
    throw new Error('unexpected require ' + name)
  })
  assert.equal(typeof exported.apply, 'function')
  assert.equal(exported.inject.join(), String.fromCharCode(115,108,111,116,115,44,108,111,99,97,108,101))
  const models = [{ id: 'vision-tools', capabilities: { vision: true, tools: true } }, { id: 'vision-only', capabilities: { vision: true } }, { id: 'plain' }]
  assert.deepEqual(exported.filterModelsByCapabilities(models, ['vision', 'tools']).map((model) => model.id), ['vision-tools'])
  assert.deepEqual(exported.filterModelsByCapabilities(models, []).map((model) => model.id), ['vision-tools', 'vision-only', 'plain'])
})
