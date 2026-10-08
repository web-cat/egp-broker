/**
 * Canvas API In-Memory Rate Limiter & Concurrency Controller
 *
 * Implements the leaky-bucket rate limiting behavior of Canvas LMS:
 * - Default quota capacity: 700.0 tokens per API key / identity
 * - Replenishment rate: 20.0 tokens per second (0.02 tokens/ms)
 * - Progressive backoff:
 *   - Soft threshold (< 100.0 tokens): applies proactive inter-request pacing
 *   - Critical threshold (< 50.0 tokens): pauses execution until bucket recharges
 * - Technique A: Per-key concurrency limiter (max concurrent in-flight requests)
 * - Keying by LtiIdentity.id when available, falling back to accessToken
 */

export const CANVAS_MAX_QUOTA = 700.0
export const CANVAS_REFILL_RATE = 20.0 // tokens per second
export const CANVAS_SOFT_THRESHOLD = 100.0
export const CANVAS_CRITICAL_THRESHOLD = 50.0
export const CANVAS_MAX_CONCURRENT_PER_KEY = 3
export const CANVAS_INTER_PAGE_DELAY_MS = 100

export interface CanvasQuotaState {
  remaining: number
  lastUpdated: number
  activeRequests: number
}

interface QueuedRequest {
  resolve: () => void
  reject: (err: any) => void
}

const quotaMap = new Map<string, CanvasQuotaState>()
const waitQueues = new Map<string, QueuedRequest[]>()

/**
 * Resets all rate limiter state. Intended primarily for testing environments.
 */
export function resetCanvasRateLimiter(): void {
  quotaMap.clear()
  waitQueues.clear()
}

/**
 * Retrieves or initializes the quota state for a given identity or token key.
 */
export function getCanvasQuotaState(key: string): CanvasQuotaState {
  let state = quotaMap.get(key)
  if (!state) {
    state = {
      remaining: CANVAS_MAX_QUOTA,
      lastUpdated: Date.now(),
      activeRequests: 0
    }
    quotaMap.set(key, state)
  }
  return state
}

/**
 * Calculates current estimated remaining quota based on time elapsed since last update.
 */
export function estimateCanvasQuota(key: string, now = Date.now()): number {
  const state = getCanvasQuotaState(key)
  const elapsedSec = Math.max(0, (now - state.lastUpdated) / 1000)
  const replenished = elapsedSec * CANVAS_REFILL_RATE
  return Math.min(CANVAS_MAX_QUOTA, state.remaining + replenished)
}

/**
 * Updates quota state from Canvas response headers.
 */
export function updateCanvasQuotaFromHeaders(
  key: string,
  headers: Headers | Record<string, any>
): void {
  const state = getCanvasQuotaState(key)

  let remainingHeader: string | null = null
  if (headers instanceof Headers) {
    remainingHeader = headers.get('x-rate-limit-remaining')
  } else if (headers && typeof headers === 'object') {
    remainingHeader = headers['x-rate-limit-remaining'] || headers['X-Rate-Limit-Remaining'] || null
  }

  if (remainingHeader !== null && remainingHeader !== undefined) {
    const parsed = parseFloat(String(remainingHeader))
    if (!isNaN(parsed)) {
      state.remaining = parsed
      state.lastUpdated = Date.now()
    }
  }
}

/**
 * Acquires a concurrency execution slot for the specified key (Technique A).
 * If the number of active requests reaches CANVAS_MAX_CONCURRENT_PER_KEY,
 * subsequent callers wait in a FIFO queue.
 */
export async function acquireCanvasConcurrencySlot(
  key: string,
  maxConcurrent = CANVAS_MAX_CONCURRENT_PER_KEY
): Promise<void> {
  const state = getCanvasQuotaState(key)

  if (state.activeRequests < maxConcurrent) {
    state.activeRequests++
    return
  }

  return new Promise<void>((resolve, reject) => {
    let queue = waitQueues.get(key)
    if (!queue) {
      queue = []
      waitQueues.set(key, queue)
    }
    queue.push({
      resolve: () => {
        state.activeRequests++
        resolve()
      },
      reject
    })
  })
}

/**
 * Releases a concurrency slot and dequeues the next waiting caller if any.
 */
export function releaseCanvasConcurrencySlot(key: string): void {
  const state = getCanvasQuotaState(key)
  state.activeRequests = Math.max(0, state.activeRequests - 1)

  const queue = waitQueues.get(key)
  if (queue && queue.length > 0) {
    const next = queue.shift()
    if (next) {
      next.resolve()
    }
  }
}

/**
 * Progressive backoff check:
 * - Critical threshold (< 50 tokens): sleeps until bucket recharges to safety
 * - Soft threshold (< 100 tokens): introduces a 150ms pacing delay
 */
export async function throttleBeforeCanvasRequest(key: string): Promise<number> {
  const estimated = estimateCanvasQuota(key)
  let sleepMs = 0

  if (estimated < CANVAS_CRITICAL_THRESHOLD) {
    const neededTokens = CANVAS_CRITICAL_THRESHOLD - estimated
    sleepMs = Math.ceil((neededTokens / CANVAS_REFILL_RATE) * 1000)
    // Cap minimum sleep to 500ms and maximum to 10000ms
    sleepMs = Math.min(10000, Math.max(500, sleepMs))
    await new Promise((resolve) => setTimeout(resolve, sleepMs))
  } else if (estimated < CANVAS_SOFT_THRESHOLD) {
    sleepMs = 150
    await new Promise((resolve) => setTimeout(resolve, sleepMs))
  }

  return sleepMs
}

export interface CanvasExecutionOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxConcurrent?: number
}

/**
 * Wraps an asynchronous Canvas call with:
 * 1. Concurrency limit acquisition (Technique A)
 * 2. Progressive backoff throttling
 * 3. 429/403 rate limit detection with Retry-After / exponential backoff
 * 4. Header inspection to update the in-memory leaky bucket
 */
export async function executeWithCanvasRateLimiter<T>(
  key: string,
  fn: () => Promise<{ response: T; headers?: Headers | Record<string, any> }>,
  options: CanvasExecutionOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  let retryDelay = options.initialDelayMs ?? 1000
  let attempt = 0

  await acquireCanvasConcurrencySlot(key, options.maxConcurrent)

  try {
    while (attempt <= maxRetries) {
      await throttleBeforeCanvasRequest(key)

      try {
        const { response, headers } = await fn()
        if (headers) {
          updateCanvasQuotaFromHeaders(key, headers)
        }
        return response
      } catch (err: any) {
        attempt++
        const status = err?.statusCode || err?.response?.status || err?.status
        const message = err?.message || err?.data?.message || ''
        const errorData = JSON.stringify(err?.data || '')

        const isRateLimit =
          status === 429 ||
          (status === 403 &&
            (message.toLowerCase().includes('rate limit') ||
              errorData.toLowerCase().includes('rate limit')))

        if (isRateLimit && attempt <= maxRetries) {
          // If Canvas returned remaining header on error, record it (typically 0)
          const errHeaders = err?.response?.headers
          if (errHeaders) {
            updateCanvasQuotaFromHeaders(key, errHeaders)
          } else {
            const state = getCanvasQuotaState(key)
            state.remaining = 0
            state.lastUpdated = Date.now()
          }

          // Check for Retry-After header
          let waitMs = retryDelay
          const retryAfter =
            errHeaders instanceof Headers
              ? errHeaders.get('retry-after')
              : errHeaders?.['retry-after'] || errHeaders?.['Retry-After']

          if (retryAfter) {
            const parsedSeconds = parseInt(retryAfter, 10)
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              waitMs = parsedSeconds * 1000
            }
          }

          console.warn(
            `[Canvas Rate Limiter] Key "${key}" throttled (${status}). Retrying attempt ${attempt}/${maxRetries} after ${waitMs}ms...`
          )
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          retryDelay *= 2
          continue
        }

        throw err
      }
    }

    throw new Error(`Canvas API call for key "${key}" failed after ${maxRetries} retries`)
  } finally {
    releaseCanvasConcurrencySlot(key)
  }
}
