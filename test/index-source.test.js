import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../lib/index.js', import.meta.url)), 'utf8')

test('no longer uses the removed settings injection seam', () => {
  // settings.register and the settings injection seam were removed before
  // 0.1.7-rc.2; the host passes the profile entry config to apply() instead.
  assert.doesNotMatch(source, /settings\s*\.\s*register\s*\(/)
  assert.doesNotMatch(source, /ctx\.inject\(\['settings'\]/)
  // Config still reaches apply() from the host and is unwrapped by resolveConfig.
  assert.match(source, /saveConfigImpl/)
  assert.match(source, /const resolveConfig =/)
  assert.match(source, /const baseConfig = structuredClone/)
  assert.match(source, /const resolveConfig =/)
  assert.match(source, /return saveConfigImpl\(patch\)/)
  assert.doesNotMatch(source, /settings\.settings\.register/)
})
