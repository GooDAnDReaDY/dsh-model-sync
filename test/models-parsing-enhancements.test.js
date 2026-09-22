import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeModel } from '../lib/models.js'

test('normalizeModel parses contextWindow with suffix multipliers', () => {
  const m1 = normalizeModel('demo', { id: 'gpt-4o', contextWindow: '128k' })
  assert.equal(m1.contextWindow, 128000)

  const m2 = normalizeModel('demo', { id: 'claude-3-5', context_window: '200K' })
  assert.equal(m2.contextWindow, 200000)

  const m3 = normalizeModel('demo', { id: 'gemini-1-5', maxContextTokens: '2M' })
  assert.equal(m3.contextWindow, 2000000)
})

test('normalizeModel parses numbers with comma separators', () => {
  const m1 = normalizeModel('demo', { id: 'model-a', contextWindow: '128,000' })
  assert.equal(m1.contextWindow, 128000)

  const m2 = normalizeModel('demo', { id: 'model-b', maxTokens: '8,192' })
  assert.equal(m2.maxTokens, 8192)
})
