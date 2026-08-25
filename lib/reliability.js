const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524])
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'])

export function statusOfError(error) {
  const direct = Number(error?.status ?? error?.statusCode)
  if (Number.isInteger(direct) && direct > 0) return direct
  const match = String(error?.message ?? '').match(/HTTP\s+(\d{3})/i)
  return match ? Number(match[1]) : undefined
}

export function isRetryableError(error) {
  if (!error) return false
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true
  if (RETRYABLE_CODES.has(error.code)) return true
  const status = statusOfError(error)
  return status !== undefined && RETRYABLE_STATUSES.has(status)
}

export function catalogRequestError(status) {
  const error = new Error(`model catalog request failed with HTTP ${status}`)
  error.status = Number(status)
  return error
}

function abortError() {
  const error = new Error('operation aborted')
  error.name = 'AbortError'
  return error
}

function delay(ms, signal) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let timer
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(signal.reason ?? abortError())
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

export function createTimeoutSignal(parent, timeoutMs) {
  const controller = new AbortController()
  let timer = null
  const onParentAbort = () => controller.abort(parent.reason ?? abortError())
  if (parent) {
    if (parent.aborted) onParentAbort()
    else parent.addEventListener('abort', onParentAbort, { once: true })
  }
  const timeout = Number(timeoutMs)
  if (Number.isFinite(timeout) && timeout > 0) {
    timer = setTimeout(() => {
      const error = new Error(`request timed out after ${timeout}ms`)
      error.name = 'TimeoutError'
      controller.abort(error)
    }, timeout)
  }
  return {
    signal: controller.signal,
    cleanup() {
      if (timer !== null) clearTimeout(timer)
      if (parent) parent.removeEventListener('abort', onParentAbort)
    },
  }
}

export async function retryWithBackoff(operation, {
  attempts = 3,
  baseDelayMs = 250,
  maxDelayMs = 4000,
  signal,
  onRetry,
} = {}) {
  const total = Math.max(1, Math.floor(Number(attempts) || 1))
  let lastError
  for (let attempt = 1; attempt <= total; attempt += 1) {
    if (signal?.aborted) throw signal.reason ?? abortError()
    try {
      return await operation({ attempt })
    } catch (error) {
      lastError = error
      if (attempt >= total || !isRetryableError(error)) throw error
      const delayMs = Math.min(Math.max(0, Number(maxDelayMs) || 0), Math.max(0, Number(baseDelayMs) || 0) * (2 ** (attempt - 1)))
      onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, error })
      await delay(delayMs, signal)
    }
  }
  throw lastError
}

export async function mapWithConcurrency(items, worker, concurrency = 4) {
  const values = new Array(items.length)
  const limit = Math.max(1, Math.min(items.length || 1, Math.floor(Number(concurrency) || 1)))
  let cursor = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      values[index] = await worker(items[index], index)
    }
  }))
  return values
}
