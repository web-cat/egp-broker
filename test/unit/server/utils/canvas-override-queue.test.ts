import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  enqueueCanvasOverrideSync,
  getCanvasOverrideQueueStats,
  resetCanvasOverrideQueue,
  drainCanvasOverrideQueue,
  executeCanvasOverrideJob
} from '@@/server/utils/canvas-override-queue'
import * as cbtfCanvasModule from '@@/server/utils/cbtf-canvas'
import * as redemptionsModule from '@@/server/utils/redemptions'

describe('Canvas Override Asynchronous Job Queue (Technique C)', () => {
  beforeEach(() => {
    resetCanvasOverrideQueue()
    vi.restoreAllMocks()
  })

  it('enqueues CBTF reservation override job and drains via worker', async () => {
    const syncSpy = vi
      .spyOn(cbtfCanvasModule, 'syncCbtfReservationCanvasOverride')
      .mockResolvedValue({ status: 'created', overrideId: 'ov-123' })

    enqueueCanvasOverrideSync({
      type: 'cbtf_reservation',
      id: 'res-456'
    })

    await drainCanvasOverrideQueue()

    expect(syncSpy).toHaveBeenCalledWith('res-456')
    const stats = getCanvasOverrideQueueStats()
    expect(stats.pending).toBe(0)
    expect(stats.isProcessing).toBe(false)
  })

  it('enqueues Pass redemption override job and drains via worker', async () => {
    const syncSpy = vi
      .spyOn(redemptionsModule, 'syncPassRedemptionCanvasOverride')
      .mockResolvedValue({ status: 'updated', overrideId: 'ov-789' })

    enqueueCanvasOverrideSync({
      type: 'pass_redemption',
      id: 'red-101',
      instructorUserId: 'inst-999'
    })

    await drainCanvasOverrideQueue()

    expect(syncSpy).toHaveBeenCalledWith('red-101', 'inst-999')
    const stats = getCanvasOverrideQueueStats()
    expect(stats.pending).toBe(0)
  })

  it('retries jobs up to 3 times on transient errors', async () => {
    let attempts = 0
    vi.spyOn(cbtfCanvasModule, 'syncCbtfReservationCanvasOverride').mockImplementation(async () => {
      attempts++
      if (attempts < 2) {
        return { status: 'error', error: 'Canvas API temporary rate limit' }
      }
      return { status: 'updated', overrideId: 'ov-retry-success' }
    })

    enqueueCanvasOverrideSync({
      type: 'cbtf_reservation',
      id: 'res-flaky'
    })

    await drainCanvasOverrideQueue()

    expect(attempts).toBe(2)
    const stats = getCanvasOverrideQueueStats()
    expect(stats.pending).toBe(0)
  })

  it('direct execution handles unknown job types gracefully', async () => {
    const res = await executeCanvasOverrideJob({
      type: 'unknown' as any,
      id: 'dummy'
    })
    expect(res).toEqual({ status: 'skipped', reason: 'unknown_job_type' })
  })
})
