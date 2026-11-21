import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const RUNTIME_STATE_KEYS = Object.freeze([
  'notifications',
  'history',
  'modelLifecycle',
  'lifecycleRevision',
  'modelCatalogs',
])

const RUNTIME_STATE_DEFAULTS = Object.freeze({
  notifications: [],
  history: [],
  modelLifecycle: {},
  lifecycleRevision: 0,
  modelCatalogs: {},
})

function cloneValue(value) {
  if (value === null || value === undefined || typeof value !== 'object') return value
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value))
  }
}

export function isTestRuntime() {
  return process.execArgv.includes('--test') || Boolean(process.env.NODE_TEST_CONTEXT)
}

export function resolveDefaultDataDir() {
  if (process.env.DSH_DATA_DIR) return path.resolve(process.env.DSH_DATA_DIR)
  return path.join(os.homedir(), '.dsh', 'data', 'dsh-model-sync')
}

export function resolveDefaultStatePath() {
  if (process.env.DSH_MODEL_SYNC_STATE_PATH) {
    return path.resolve(process.env.DSH_MODEL_SYNC_STATE_PATH)
  }
  if (isTestRuntime()) {
    return path.join(os.tmpdir(), `dsh-model-sync-test-state-${process.pid}.json`)
  }
  return path.join(resolveDefaultDataDir(), 'state.json')
}

export function resolveLegacyStatePath() {
  return path.join(os.homedir(), '.deepseek-agent', 'data', 'dsh-model-sync-state.json')
}

export function resolveStateDir() {
  return path.dirname(resolveDefaultStatePath())
}

export function splitConfigAndRuntimePatch(patch = {}) {
  const runtimePatch = {}
  const configPatch = {}
  if (!patch || typeof patch !== 'object') {
    return { runtimePatch, configPatch, hasRuntimeKeys: false, hasConfigKeys: false }
  }
  for (const [key, value] of Object.entries(patch)) {
    if (RUNTIME_STATE_KEYS.includes(key)) {
      runtimePatch[key] = value
    } else {
      configPatch[key] = value
    }
  }
  return {
    runtimePatch,
    configPatch,
    hasRuntimeKeys: Object.keys(runtimePatch).length > 0,
    hasConfigKeys: Object.keys(configPatch).length > 0,
  }
}

function sanitizeStateObject(source = {}) {
  const state = {}
  for (const key of RUNTIME_STATE_KEYS) {
    const fallback = RUNTIME_STATE_DEFAULTS[key]
    const raw = source?.[key]
    if (raw === undefined || raw === null) {
      state[key] = cloneValue(fallback)
    } else {
      state[key] = cloneValue(raw)
    }
  }
  return state
}

export function createRuntimeStateStore({
  storagePath,
  legacyPath,
  initialState = {},
  persistToDisk,
  logger = null,
} = {}) {
  const explicitPath = typeof storagePath === 'string' && storagePath.trim().length > 0
  const resolvedPath = explicitPath ? path.resolve(storagePath) : resolveDefaultStatePath()
  const shouldPersist = persistToDisk !== undefined ? Boolean(persistToDisk) : !isTestRuntime() || explicitPath
  const shouldReadFromDisk = shouldPersist && (explicitPath || !isTestRuntime())
  const fallbackPath = typeof legacyPath === 'string'
    ? legacyPath
    : (explicitPath || process.env.DSH_MODEL_SYNC_STATE_PATH ? '' : resolveLegacyStatePath())

  let state = sanitizeStateObject(initialState)

  const existingPath = existsSync(resolvedPath)
    ? resolvedPath
    : (fallbackPath && existsSync(fallbackPath) ? fallbackPath : '')

  if (shouldReadFromDisk && existingPath) {
    try {
      const diskRaw = JSON.parse(readFileSync(existingPath, 'utf8'))
      if (diskRaw && typeof diskRaw === 'object') {
        for (const key of RUNTIME_STATE_KEYS) {
          if (diskRaw[key] !== undefined) {
            state[key] = cloneValue(diskRaw[key])
          }
        }
      }
    } catch (err) {
      if (typeof logger?.warn === 'function') {
        logger.warn('[dsh-model-sync] failed to read runtime state store from disk:', err?.message || err)
      }
    }
  }

  if (existingPath && existingPath !== resolvedPath && flushToDisk()) {
    if (typeof logger?.warn === 'function') {
      logger.warn(`[dsh-model-sync] migrated runtime state from ${existingPath} to ${resolvedPath}`)
    }
  }

  function flushToDisk() {
    if (!shouldPersist) return false
    try {
      const dir = path.dirname(resolvedPath)
      mkdirSync(dir, { recursive: true })
      const tmpPath = `${resolvedPath}.${process.pid}.tmp`
      writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8')
      renameSync(tmpPath, resolvedPath)
      return true
    } catch (err) {
      if (typeof logger?.warn === 'function') {
        logger.warn('[dsh-model-sync] failed to persist runtime state store:', err?.message || err)
      }
      return false
    }
  }

  return Object.freeze({
    get storagePath() {
      return resolvedPath
    },
    get persistToDisk() {
      return shouldPersist
    },
    getState() {
      return cloneValue(state)
    },
    get(key) {
      if (!RUNTIME_STATE_KEYS.includes(key)) return undefined
      return cloneValue(state[key])
    },
    update(patch = {}) {
      if (!patch || typeof patch !== 'object') return cloneValue(state)
      let changed = false
      for (const key of RUNTIME_STATE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
          state[key] = cloneValue(patch[key])
          changed = true
        }
      }
      if (changed) {
        flushToDisk()
      }
      return cloneValue(state)
    },
    reset(nextState = {}) {
      state = sanitizeStateObject(nextState)
      flushToDisk()
      return cloneValue(state)
    },
  })
}
