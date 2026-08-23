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
})