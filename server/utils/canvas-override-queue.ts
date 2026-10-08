import { syncCbtfReservationCanvasOverride } from '@@/server/utils/cbtf-canvas'
import { syncPassRedemptionCanvasOverride } from '@@/server/utils/redemptions'

export type CanvasOverrideJobType = 'cbtf_reservation' | 'pass_redemption'

export interface CanvasOverrideJob {
  id: string
  type: CanvasOverrideJobType
  instructorUserId?: string
  retries?: number
  enqueuedAt?: number
}

const queue: CanvasOverrideJob[] = []
let processing = false

/**
 * Enqueues an assignment override sync to be executed asynchronously (Technique C: write-behind).
 * This shields student-facing response times from Canvas rate limits and allows
 * pacing calls smoothly through the background worker.
 */
export function enqueueCanvasOverrideSync(job: CanvasOverrideJob): void {
  queue.push({
    ...job,
    retries: job.retries ?? 0,
    enqueuedAt: job.enqueuedAt ?? Date.now()
  })

  // Trigger queue drain if not already active
  if (!processing) {
    processNextJob().catch((err) => {
      console.error('[Canvas Override Queue] Unexpected worker error:', err)
    })
  }
}

/**
 * Returns current statistics of the background queue.
 */
export function getCanvasOverrideQueueStats(): {
  pending: number
  isProcessing: boolean
} {
  return {
    pending: queue.length,
    isProcessing: processing
  }
}

/**
 * Clears the queue and resets state (useful for tests).
 */
export function resetCanvasOverrideQueue(): void {
  queue.length = 0
  processing = false
}

/**
 * Processes a single job directly.
 */
export async function executeCanvasOverrideJob(
  job: CanvasOverrideJob
): Promise<{ status: string; overrideId?: string; reason?: string; error?: string }> {
  if (job.type === 'cbtf_reservation') {
    return await syncCbtfReservationCanvasOverride(job.id)
  } else if (job.type === 'pass_redemption') {
    return await syncPassRedemptionCanvasOverride(job.id, job.instructorUserId)
  }
  return { status: 'skipped', reason: 'unknown_job_type' }
}

/**
 * Background loop that processes queued jobs sequentially with error recovery.
 */
async function processNextJob(): Promise<void> {
  if (processing || queue.length === 0) {
    return
  }

  processing = true

  try {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break

      try {
        const result = await executeCanvasOverrideJob(job)
        if (result.status === 'error') {
          console.warn(
            `[Canvas Override Queue] Job ${job.type}:${job.id} returned error: ${result.error}`
          )
          if ((job.retries ?? 0) < 3) {
            job.retries = (job.retries ?? 0) + 1
            // Re-enqueue at the end of the queue for later retry
            queue.push(job)
          }
        }
      } catch (err: any) {
        console.error(
          `[Canvas Override Queue] Failed to process ${job.type}:${job.id}:`,
          err?.message || err
        )
        if ((job.retries ?? 0) < 3) {
          job.retries = (job.retries ?? 0) + 1
          queue.push(job)
        }
      }
    }
  } finally {
    processing = false
  }
}

/**
 * Drains all queued jobs until queue is empty.
 * Returns a promise that resolves when all pending jobs have been executed.
 */
export async function drainCanvasOverrideQueue(): Promise<void> {
  while (queue.length > 0 || processing) {
    await processNextJob()
    if (queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}
