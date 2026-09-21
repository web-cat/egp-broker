import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeRepairedGtaUtcTimes,
  repairAssignmentGtaTimezones
} from '../../../../server/utils/gta-repair-timezone'
import prisma from '../../../../server/utils/db'

vi.mock('../../../../server/utils/db', () => ({
  default: {
    assignment: {
      findUnique: vi.fn()
    },
    gtaInterviewReservation: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn((ops) => Promise.all(ops))
  }
}))

describe('GTA Timezone Repair Utility (gta-repair-timezone)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('computeRepairedGtaUtcTimes', () => {
    it('shifts naive UTC timestamp by +4h in EDT to match true UTC', () => {
      // Naive reservation: student booked for 12:00 EDT, but it was stored naively as 12:00:00.000Z
      const naiveStart = new Date('2026-09-21T12:00:00.000Z')
      const naiveEnd = new Date('2026-09-21T12:05:00.000Z')

      const result = computeRepairedGtaUtcTimes(naiveStart, naiveEnd, 'America/New_York')

      expect(result.needsRepair).toBe(true)
      // 12:00 PM EDT in true UTC is 16:00:00.000Z
      expect(result.repairedStart.toISOString()).toBe('2026-09-21T16:00:00.000Z')
      expect(result.repairedEnd.toISOString()).toBe('2026-09-21T16:05:00.000Z')
    })

    it('keeps duration intact when repairing timestamps', () => {
      const naiveStart = new Date('2026-10-05T10:00:00.000Z')
      const naiveEnd = new Date('2026-10-05T10:10:00.000Z') // 10 min duration

      const result = computeRepairedGtaUtcTimes(naiveStart, naiveEnd, 'America/New_York')

      expect(result.needsRepair).toBe(true)
      // 10:00 AM EDT is 14:00 UTC
      expect(result.repairedStart.toISOString()).toBe('2026-10-05T14:00:00.000Z')
      expect(result.repairedEnd.toISOString()).toBe('2026-10-05T14:10:00.000Z')
    })
  })

  describe('repairAssignmentGtaTimezones', () => {
    it('throws 404 if assignment does not exist', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

      await expect(
        repairAssignmentGtaTimezones('asg-nonexistent', 'admin-1')
      ).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Assignment not found'
      })
    })

    it('throws 400 if assignment does not incorporate GTA interviews', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'asg-1',
        hasInterviews: false
      } as any)

      await expect(repairAssignmentGtaTimezones('asg-1', 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'This assignment does not require grading interviews'
      })
    })

    it('returns zero count when no pre-fix reservations exist', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'asg-1',
        hasInterviews: true,
        courseId: 'course-1'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([])

      const res = await repairAssignmentGtaTimezones('asg-1', 'admin-1')
      expect(res.totalChecked).toBe(0)
      expect(res.totalRepaired).toBe(0)
      expect(res.details).toHaveLength(0)
    })

    it('repairs naive reservations and updates database records', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'asg-1',
        hasInterviews: true,
        courseId: 'course-1'
      } as any)

      const naiveStart = new Date('2026-09-21T12:00:00.000Z')
      const naiveEnd = new Date('2026-09-21T12:05:00.000Z')

      // Mock finding the pre-fix reservation
      vi.mocked(prisma.gtaInterviewReservation.findMany)
        .mockResolvedValueOnce([
          {
            id: 'res-1',
            assignmentId: 'asg-1',
            gtaId: 'gta-1',
            startTime: naiveStart,
            endTime: naiveEnd,
            status: 'SCHEDULED',
            student: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' },
            gta: { firstName: 'Bob', lastName: 'GTA', email: 'bob@vt.edu' }
          }
        ] as any)
        // Mock finding active reservations for conflict detection
        .mockResolvedValueOnce([
          {
            id: 'res-1',
            gtaId: 'gta-1',
            startTime: naiveStart
          }
        ] as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({} as any)

      const res = await repairAssignmentGtaTimezones('asg-1', 'admin-1')

      expect(res.totalChecked).toBe(1)
      expect(res.totalRepaired).toBe(1)
      expect(res.conflicts).toBe(0)
      expect(res.details[0].status).toBe('repaired')
      expect(res.details[0].previousStartUtc).toBe('2026-09-21T12:00:00.000Z')
      expect(res.details[0].repairedStartUtc).toBe('2026-09-21T16:00:00.000Z')

      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            startTime: new Date('2026-09-21T16:00:00.000Z'),
            endTime: new Date('2026-09-21T16:05:00.000Z')
          })
        })
      )
    })

    it('detects and flags conflict if GTA already has a reservation at repaired time', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'asg-1',
        hasInterviews: true,
        courseId: 'course-1'
      } as any)

      const naiveStart = new Date('2026-09-21T12:00:00.000Z')
      const naiveEnd = new Date('2026-09-21T12:05:00.000Z')
      const targetTime = new Date('2026-09-21T16:00:00.000Z')

      vi.mocked(prisma.gtaInterviewReservation.findMany)
        .mockResolvedValueOnce([
          {
            id: 'res-1',
            assignmentId: 'asg-1',
            gtaId: 'gta-1',
            startTime: naiveStart,
            endTime: naiveEnd,
            status: 'SCHEDULED',
            student: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' },
            gta: { firstName: 'Bob', lastName: 'GTA', email: 'bob@vt.edu' }
          }
        ] as any)
        .mockResolvedValueOnce([
          { id: 'res-1', gtaId: 'gta-1', startTime: naiveStart },
          // Another reservation already occupies the repaired target slot
          { id: 'res-existing', gtaId: 'gta-1', startTime: targetTime }
        ] as any)

      const res = await repairAssignmentGtaTimezones('asg-1', 'admin-1')

      expect(res.totalChecked).toBe(1)
      expect(res.totalRepaired).toBe(0)
      expect(res.conflicts).toBe(1)
      expect(res.details[0].status).toBe('conflict')
      expect(prisma.gtaInterviewReservation.update).not.toHaveBeenCalled()
    })
  })
})
