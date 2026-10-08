import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCanvasQuotaState,
  estimateCanvasQuota,
  updateCanvasQuotaFromHeaders,
  acquireCanvasConcurrencySlot,
  releaseCanvasConcurrencySlot,
  throttleBeforeCanvasRequest,
  executeWithCanvasRateLimiter,
  resetCanvasRateLimiter,
  CANVAS_MAX_QUOTA
} from '@@/server/utils/canvas-rate-limiter'

describe('Canvas Rate Limiter & Concurrency Controller', () => {
  beforeEach(() => {
    resetCanvasRateLimiter()
    vi.restoreAllMocks()
  })

  describe('Quota State & Replenishment', () => {
    it('initializes bucket to max quota (700.0) with zero active requests', () => {
      const state = getCanvasQuotaState('identity-123')
      expect(state.remaining).toBe(CANVAS_MAX_QUOTA)
      expect(state.activeRequests).toBe(0)
      expect(state.lastUpdated).toBeLessThanOrEqual(Date.now())
    })

    it('estimates continuous replenishment at 20 tokens per second up to max capacity', () => {
      const state = getCanvasQuotaState('identity-123')
      state.remaining = 100.0
      const startTime = Date.now()
      state.lastUpdated = startTime

      // 5 seconds later -> +100 tokens -> total 200
      const estimatedAt5s = estimateCanvasQuota('identity-123', startTime + 5000)
      expect(estimatedAt5s).toBeCloseTo(200.0, 1)

      // 40 seconds later -> +800 tokens -> capped at 700.0
      const estimatedAt40s = estimateCanvasQuota('identity-123', startTime + 40000)
      expect(estimatedAt40s).toBe(CANVAS_MAX_QUOTA)
    })

    it('updates quota and timestamp from x-rate-limit-remaining header', () => {
      const headers = new Headers()
      headers.set('x-rate-limit-remaining', '450.5')
      headers.set('x-request-cost', '0.25')

      updateCanvasQuotaFromHeaders('identity-123', headers)

      const state = getCanvasQuotaState('identity-123')
      expect(state.remaining).toBe(450.5)
    })

    it('updates quota when header object is a plain dictionary', () => {
      updateCanvasQuotaFromHeaders('identity-456', {
        'x-rate-limit-remaining': '320.0'
      })

      const state = getCanvasQuotaState('identity-456')
      expect(state.remaining).toBe(320.0)
    })
  })

  describe('Technique A: Concurrency Limiting', () => {
    it('allows requests up to max concurrent without queuing', async () => {
      await acquireCanvasConcurrencySlot('token-1', 3)
      await acquireCanvasConcurrencySlot('token-1', 3)
      await acquireCanvasConcurrencySlot('token-1', 3)

      const state = getCanvasQuotaState('token-1')
      expect(state.activeRequests).toBe(3)

      releaseCanvasConcurrencySlot('token-1')
      expect(state.activeRequests).toBe(2)
      releaseCanvasConcurrencySlot('token-1')
      releaseCanvasConcurrencySlot('token-1')
      expect(state.activeRequests).toBe(0)
    })

    it('queues excess concurrent requests until previous callers release slots', async () => {
      const maxConcurrent = 2
      await acquireCanvasConcurrencySlot('token-queue', maxConcurrent)
      await acquireCanvasConcurrencySlot('token-queue', maxConcurrent)

      let thirdResolved = false
      const thirdPromise = acquireCanvasConcurrencySlot('token-queue', maxConcurrent).then(() => {
        thirdResolved = true
      })

      // The 3rd request must wait in FIFO queue
      await new Promise((r) => setTimeout(r, 10))
      expect(thirdResolved).toBe(false)

      // Release one slot
      releaseCanvasConcurrencySlot('token-queue')
      await thirdPromise
      expect(thirdResolved).toBe(true)

      const state = getCanvasQuotaState('token-queue')
      expect(state.activeRequests).toBe(2)

      releaseCanvasConcurrencySlot('token-queue')
      releaseCanvasConcurrencySlot('token-queue')
      expect(state.activeRequests).toBe(0)
    })
  })

  describe('Progressive Backoff & Throttling', () => {
    it('introduces a pacing delay when quota is below soft threshold (< 100)', async () => {
      const state = getCanvasQuotaState('pacing-key')
      state.remaining = 80.0
      state.lastUpdated = Date.now()

      const sleepMs = await throttleBeforeCanvasRequest('pacing-key')
      expect(sleepMs).toBe(150)
    })

    it('calculates replenishment sleep duration when below critical threshold (< 50)', async () => {
      const state = getCanvasQuotaState('critical-key')
      state.remaining = 30.0 // needs 20 tokens to reach 50.0 -> 20 / 20 = 1000ms
      state.lastUpdated = Date.now()

      const sleepMs = await throttleBeforeCanvasRequest('critical-key')
      expect(sleepMs).toBeGreaterThanOrEqual(500)
      expect(sleepMs).toBeLessThanOrEqual(2000)
    })

    it('does not delay when quota is abundant (>= 100)', async () => {
      const state = getCanvasQuotaState('abundant-key')
      state.remaining = 650.0
      state.lastUpdated = Date.now()

      const sleepMs = await throttleBeforeCanvasRequest('abundant-key')
      expect(sleepMs).toBe(0)
    })
  })

  describe('executeWithCanvasRateLimiter', () => {
    it('executes function, updates remaining quota from headers, and releases slot', async () => {
      const mockHeaders = new Headers()
      mockHeaders.set('x-rate-limit-remaining', '620.0')

      const result = await executeWithCanvasRateLimiter('exec-key', async () => {
        return {
          response: { success: true },
          headers: mockHeaders
        }
      })

      expect(result).toEqual({ success: true })
      const state = getCanvasQuotaState('exec-key')
      expect(state.remaining).toBe(620.0)
      expect(state.activeRequests).toBe(0)
    })

    it('retries on 429 error and honors Retry-After header', async () => {
      let callCount = 0
      const mockHeaders429 = new Headers()
      mockHeaders429.set('retry-after', '1') // 1 second

      const res = await executeWithCanvasRateLimiter(
        'retry-key',
        async () => {
          callCount++
          if (callCount === 1) {
            const err: any = new Error('Too Many Requests')
            err.statusCode = 429
            err.response = { status: 429, headers: mockHeaders429 }
            throw err
          }
          const successHeaders = new Headers()
          successHeaders.set('x-rate-limit-remaining', '50.0')
          return { response: 'ok', headers: successHeaders }
        },
        { initialDelayMs: 10, maxRetries: 2 }
      )

      expect(res).toBe('ok')
      expect(callCount).toBe(2)
      const state = getCanvasQuotaState('retry-key')
      expect(state.remaining).toBe(50.0)
      expect(state.activeRequests).toBe(0)
    })
  })
})
