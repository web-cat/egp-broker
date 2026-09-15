import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeRepairedUtcTimes, repairAssignmentCbtfTimezones } from '@@/server/utils/cbtf-canvas'
import prisma from '@@/server/utils/db'
import * as canvasModule from '@@/server/utils/canvas'

vi.mock('@@/server/services/alert.service', () => ({
  notifyCbtfCanvasOverrideFailure: vi.fn().mockResolvedValue(true),
  sendAdminAlert: vi.fn().mockResolvedValue(true)
}))

vi.mock('@@/server/utils/canvas', () => ({
  createCanvasAssignmentOverride: vi.fn().mockResolvedValue({ id: 999 }),
  updateCanvasAssignmentOverride: vi.fn().mockResolvedValue({ id: 999 }),
  fetchCanvasAssignmentOverrides: vi.fn().mockResolvedValue([])
}))

describe('CBTF Timezone Repair & Reseat (cbtf-repair-timezone)', () => {
  describe('computeRepairedUtcTimes', () => {
    it('keeps already-correct True UTC times unchanged', () => {
      // e.g. Sep 16 13:45 UTC (9:45 AM EDT)
      const t1 = new Date('2026-09-16T13:45:00.000Z')
      const r1 = computeRepairedUtcTimes(t1)
      expect(r1.start.toISOString()).toBe('2026-09-16T13:45:00.000Z')
      expect(r1.end.toISOString()).toBe('2026-09-16T14:45:00.000Z')
      expect(r1.shiftsUndone).toBe(0)

      // e.g. Sep 17 19:35 UTC (3:35 PM EDT)
      const t2 = new Date('2026-09-17T19:35:00.000Z')
      const r2 = computeRepairedUtcTimes(t2)
      expect(r2.start.toISOString()).toBe('2026-09-17T19:35:00.000Z')
      expect(r2.end.toISOString()).toBe('2026-09-17T20:35:00.000Z')
      expect(r2.shiftsUndone).toBe(0)
    })

    it('converts naive UTC times (15:55-16:20 on Sep 17) to True UTC (+4h)', () => {
      // Sep 17 16:00 naive UTC -> 20:00 True UTC (4:00 PM EDT)
      const t = new Date('2026-09-17T16:00:00.000Z')
      const r = computeRepairedUtcTimes(t)
      expect(r.start.toISOString()).toBe('2026-09-17T20:00:00.000Z')
      expect(r.end.toISOString()).toBe('2026-09-17T21:00:00.000Z')
    })

    it('unwinds 2-shift reservations by subtracting 4h', () => {
      // Sep 17 21:15 UTC -> 17:15 True UTC (1:15 PM EDT)
      const t = new Date('2026-09-17T21:15:00.000Z')
      const r = computeRepairedUtcTimes(t)
      expect(r.start.toISOString()).toBe('2026-09-17T17:15:00.000Z')
      expect(r.end.toISOString()).toBe('2026-09-17T18:15:00.000Z')
      expect(r.shiftsUndone).toBe(1)

      // Sep 17 00:55 UTC (medatab) -> Sep 16 20:55 True UTC (4:55 PM EDT)
      const tMedatab = new Date('2026-09-17T00:55:00.000Z')
      const rMedatab = computeRepairedUtcTimes(tMedatab)
      expect(rMedatab.start.toISOString()).toBe('2026-09-16T20:55:00.000Z')
      expect(rMedatab.end.toISOString()).toBe('2026-09-16T21:55:00.000Z')
      expect(rMedatab.shiftsUndone).toBe(1)
    })

    it('unwinds 3-shift reservations by subtracting 8h', () => {
      // Sep 19 03:40 UTC -> Sep 18 19:40 True UTC (3:40 PM EDT)
      const t = new Date('2026-09-19T03:40:00.000Z')
      const r = computeRepairedUtcTimes(t)
      expect(r.start.toISOString()).toBe('2026-09-18T19:40:00.000Z')
      expect(r.end.toISOString()).toBe('2026-09-18T20:40:00.000Z')
      expect(r.shiftsUndone).toBe(2)
    })

    it('unwinds 4-shift reservations by subtracting 12h', () => {
      // Sep 18 06:25 UTC -> Sep 17 18:25 True UTC (2:25 PM EDT)
      const t = new Date('2026-09-18T06:25:00.000Z')
      const r = computeRepairedUtcTimes(t)
      expect(r.start.toISOString()).toBe('2026-09-17T18:25:00.000Z')
      expect(r.end.toISOString()).toBe('2026-09-17T19:25:00.000Z')
      expect(r.shiftsUndone).toBe(3)
    })
  })

  describe('repairAssignmentCbtfTimezones', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('repairs reservations, handles seat collisions, and syncs Canvas overrides', async () => {
      const mockAssignment = {
        id: 'asg-1',
        title: 'Midterm 1',
        isSchedulable: true,
        courseId: 'course-1',
        canvasAssignmentId: 'canvas-asg-1',
        course: {
          canvasCourseId: 'canvas-course-1',
          deployment: {
            platform: {
              id: 'plat-1',
              apiUrl: 'https://canvas.example.com/api/v1'
            }
          }
        }
      }

      const mockFacility = {
        id: 'fac-1',
        name: 'Main CBTF Facility',
        timezone: 'America/New_York',
        seatAllocationOrder: [1, 2, 3, 4, 5]
      }

      // Two reservations: res-1 shifted 3 times, res-2 shifted 2 times
      const mockReservations = [
        {
          id: 'res-1',
          assignmentId: 'asg-1',
          facilityId: 'fac-1',
          seatNumber: 1,
          startTime: new Date('2026-09-19T03:40:00.000Z'), // Sep 18 19:40 True UTC
          endTime: new Date('2026-09-18T04:40:00.000Z'), // Corrupted prior-day end time
          status: 'SCHEDULED',
          canvasOverrideId: 'ov-1',
          facility: mockFacility,
          user: {
            id: 'user-1',
            firstName: 'John',
            email: 'john@example.com',
            ltiIdentities: [{ platformId: 'plat-1', platformUserId: '1001' }]
          }
        },
        {
          id: 'res-2',
          assignmentId: 'asg-1',
          facilityId: 'fac-1',
          seatNumber: 1, // Same seat! Collision test
          startTime: new Date('2026-09-18T23:40:00.000Z'), // Sep 18 19:40 True UTC (same time!)
          endTime: new Date('2026-09-19T00:40:00.000Z'),
          status: 'SCHEDULED',
          canvasOverrideId: null,
          facility: mockFacility,
          user: {
            id: 'user-2',
            firstName: 'Jane',
            email: 'jane@example.com',
            ltiIdentities: [{ platformId: 'plat-1', platformUserId: '1002' }]
          }
        }
      ]

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'instructor-key' }] }
      } as any)

      vi.spyOn(prisma.cbtfReservation, 'findMany')
        // Initial findMany for reservations
        .mockResolvedValueOnce(mockReservations as any)
        // Check for overlaps for res-1: no overlap yet
        .mockResolvedValueOnce([])
        // Check for overlaps for res-2: res-1 occupies seat 1
        .mockResolvedValueOnce([
          {
            seatNumber: 1,
            startTime: new Date('2026-09-18T19:40:00.000Z'),
            endTime: new Date('2026-09-18T20:40:00.000Z')
          }
        ] as any)

      vi.mocked(canvasModule.fetchCanvasAssignmentOverrides).mockResolvedValue([
        { id: 'ov-1', student_ids: [1001] } as any
      ])

      const updateSpy = vi.spyOn(prisma.cbtfReservation, 'update').mockResolvedValue({} as any)

      const result = await repairAssignmentCbtfTimezones('asg-1', 'admin-user-1')

      expect(result.totalChecked).toBe(2)
      expect(result.totalRepaired).toBe(2)
      expect(result.seatsReassigned).toBe(1) // res-2 reassigned from seat 1 to next seat (seat 2)
      expect(updateSpy).toHaveBeenCalledTimes(3) // 2 for reservations + 1 for canvasOverrideId of res-2

      // Verify res-1 updated with repaired time
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            startTime: new Date('2026-09-18T19:40:00.000Z'),
            endTime: new Date('2026-09-18T20:40:00.000Z'),
            seatNumber: 1
          })
        })
      )

      // Verify res-2 updated with repaired time and reassigned seat 2
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-2' },
          data: expect.objectContaining({
            startTime: new Date('2026-09-18T19:40:00.000Z'),
            endTime: new Date('2026-09-18T20:40:00.000Z'),
            seatNumber: 2
          })
        })
      )

      // Canvas overrides updated/created
      expect(canvasModule.updateCanvasAssignmentOverride).toHaveBeenCalledTimes(1)
      expect(canvasModule.createCanvasAssignmentOverride).toHaveBeenCalledTimes(1)
    })
  })
})
