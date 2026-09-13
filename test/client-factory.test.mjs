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
  assert.match(src, /变更预览/)
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
  assert.match(src, /手动模型选择/)
  assert.match(src, /grid-template-columns/)
  assert.match(src, /ensureStyles/)
  // Issue #108: noHistory dictionary entries
  assert.match(src, /noHistory:\s*'No synchronization history\.'/)
  assert.match(src, /noHistory:\s*'暂无同步历史\。'/)
  // Issue #109: model picker localization keys
  assert.match(src, /searchPlaceholder:\s*'Search id\/name\/tag'/)
  assert.match(src, /searchPlaceholder:\s*'搜索 ID \/ 名称 \/ 标签'/)
  assert.match(src, /sortName:\s*'Name A→Z'/)
  assert.match(src, /sortPrice:\s*'Price ↑'/)
  assert.match(src, /t\.searchPlaceholder/)
  assert.match(src, /t\.sortName/)
  assert.match(src, /t\.sortPrice/)
  // Issue #107: scheduler UI and settingsScope binding
  assert.match(src, /schedulerSettings:\s*'Scheduler configuration'/)
  assert.match(src, /scheduleEnabled:\s*'Enable background schedule'/)
  assert.match(src, /intervalMinutes:\s*'Interval \(minutes\)'/)
  assert.match(src, /saveScheduler/)
  assert.match(src, /settingsScope\.bind\(\{\s*namespace:\s*NS\s*\}\)/)
    assert.match(src, /batchTry/)
  assert.match(src, /exportConfig/)
  assert.match(src, /modelAliases/)
  assert.match(src, /enableCostFilter/)
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
  assert.deepEqual(Array.from(exported.inject), ['slots', 'locale', 'settingsScope'])
  const models = [{ id: 'vision-tools', capabilities: { vision: true, tools: true } }, { id: 'vision-only', capabilities: { vision: true } }, { id: 'plain' }]
  assert.deepEqual(exported.filterModelsByCapabilities(models, ['vision', 'tools']).map((model) => model.id), ['vision-tools'])
  assert.deepEqual(exported.filterModelsByCapabilities(models, []).map((model) => model.id), ['vision-tools', 'vision-only', 'plain'])
})

test('client apply registers settings.plugin.item and supports settingsScope', () => {
  const srcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/client.js')
  const src = readFileSync(srcPath, 'utf8')
    assert.match(src, /batchTry/)
  assert.match(src, /exportConfig/)
  assert.match(src, /modelAliases/)
  assert.match(src, /enableCostFilter/)
  let captured
  const window = { __ModuleLoader__: { load(entry) { captured = entry } } }
  runInNewContext(src, createContext({ window }))
  
  let registeredSlot = null
  let registeredComp = null
  let boundScope = null

  const fakeScope = {
    subscribe(cb) { return () => {} },
    getSnapshot() { return { status: 'ready', value: { scheduleEnabled: true, intervalMinutes: 30, autoApply: true } } },
    async set(k, v) {}
  }

  const mockCtx = {
    effect(fn, label) { fn() },
    locale: {
      register(ns, dicts) {},
      subscribe(cb) { return () => {} },
      getSnapshot() { return { active: 'ru' } }
    },
    settingsScope: {
      bind(opts) {
        boundScope = opts
        return fakeScope
      }
    },
    slots: {
      inject(name, fn) { fn(); return true },
      register(opts, comp) {
        registeredSlot = opts
        registeredComp = comp
      }
    }
  }

  const fakeReact = {
    createElement(type, props, ...children) { return { type, props, children } },
    useSyncExternalStore(sub, getSnap) { return getSnap() },
    useMemo(fn) { return fn() },
    useCallback(fn) { return fn },
    useState(value) { return [value, () => {}] },
    useEffect(fn) { fn() },
    Fragment: 'Fragment'
  }

  const exported = captured.factory((name) => {
    if (name === 'react') return fakeReact
    throw new Error('unexpected require ' + name)
  })

  exported.apply(mockCtx)
  assert.ok(registeredSlot)
  assert.equal(registeredSlot.name, 'settings.plugin.item')
  assert.equal(registeredSlot.key, 'dsh-model-sync')
  assert.equal(registeredSlot.locale, 'dsh-model-sync')
})
