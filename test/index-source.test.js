import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../lib/index.js', import.meta.url)), 'utf8')

test('uses the DSH settings injection seam for the writable plugin namespace', () => {
  assert.match(source, /ctx\.inject\(\['settings'\]/)
  assert.match(source, /sctx\.settings\.register/)
  assert.match(source, /scope\.update/)
  assert.match(source, /saveConfigImpl/)
  assert.match(source, /return saveConfigImpl\(patch\)/)
  assert.doesNotMatch(source, /settings\.settings\.register/)
})
