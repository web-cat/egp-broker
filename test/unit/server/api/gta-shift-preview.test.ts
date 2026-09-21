import { describe, it, expect, vi, beforeEach } from 'vitest'
import previewHandler from '../../../../server/api/me/courses/[courseId]/gta-shifts/[id]/preview.post'
import { reconcileShiftReservations } from '../../../../server/utils/gta-shift-rescheduling'
import { assertCourseInstructorOrSelfGta } from '../../../../server/utils/gta-interview'
import prisma from '../../../../server/utils/db'

vi.mock('../../../../server/utils/db', () => ({
  default: {
    gtaShift: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('../../../../server/utils/gta-interview', () => ({
  assertCourseInstructorOrSelfGta: vi.fn()
}))

vi.mock('../../../../server/utils/gta-shift-rescheduling', () => ({
  reconcileShiftReservations: vi.fn()
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    readBody: vi.fn(),
    getRouterParam: vi.fn(),
    createError: (opts: any) => opts
  }
})

describe('API: POST /api/me/courses/[courseId]/gta-shifts/[id]/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(assertCourseInstructorOrSelfGta).mockResolvedValue({ id: 'user-1' } as any)
    vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue({
      id: 'shift-1',
      courseId: 'course-1',
      userId: 'gta-1'
    } as any)
  })

  it('calculates dry-run impact for shift edit', async () => {
    const { readBody, getRouterParam } = await import('h3')
    vi.mocked(getRouterParam).mockImplementation((_event, param) => {
      if (param === 'courseId') return 'course-1'
      if (param === 'id') return 'shift-1'
      return undefined
    })

    vi.mocked(readBody).mockResolvedValue({
      date: '2026-10-05',
      startTime: '10:00',
      endTime: '11:00',
      isDelete: false
    })

    vi.mocked(reconcileShiftReservations).mockResolvedValue({
      rescheduled: [
        {
          reservationId: 'res-1',
          studentId: 'stud-1',
          studentName: 'Alice Student',
          studentEmail: 'alice@vt.edu',
          assignmentId: 'asg-1',
          assignmentTitle: 'Project 1',
          startTime: '2026-10-05T15:30:00.000Z',
          endTime: '2026-10-05T15:40:00.000Z',
          previousGtaId: 'gta-1',
          previousGtaName: 'Alice GTA',
          newGtaId: 'gta-2',
          newGtaName: 'Bob GTA'
        }
      ],
      cancelled: []
    })

    const result = await previewHandler({} as any)

    expect(assertCourseInstructorOrSelfGta).toHaveBeenCalledWith({}, 'course-1', 'gta-1')
    expect(reconcileShiftReservations).toHaveBeenCalledWith(
      'course-1',
      'shift-1',
      {
        userId: undefined,
        date: '2026-10-05',
        startTime: '10:00',
        endTime: '11:00'
      },
      undefined,
      true // dryRun: true
    )
    expect(result.rescheduled).toHaveLength(1)
  })

  it('calculates dry-run impact for shift delete when isDelete is true', async () => {
    const { readBody, getRouterParam } = await import('h3')
    vi.mocked(getRouterParam).mockImplementation((_event, param) => {
      if (param === 'courseId') return 'course-1'
      if (param === 'id') return 'shift-1'
      return undefined
    })

    vi.mocked(readBody).mockResolvedValue({
      isDelete: true
    })

    vi.mocked(reconcileShiftReservations).mockResolvedValue({
      rescheduled: [],
      cancelled: [
        {
          reservationId: 'res-1',
          studentId: 'stud-1',
          studentName: 'Alice Student',
          studentEmail: 'alice@vt.edu',
          assignmentId: 'asg-1',
          assignmentTitle: 'Project 1',
          startTime: '2026-10-05T15:30:00.000Z',
          endTime: '2026-10-05T15:40:00.000Z',
          previousGtaId: 'gta-1',
          previousGtaName: 'Alice GTA',
          reason: 'No concurrent GTA on duty'
        }
      ]
    })

    const result = await previewHandler({} as any)

    expect(reconcileShiftReservations).toHaveBeenCalledWith(
      'course-1',
      'shift-1',
      null, // deleted
      undefined,
      true // dryRun: true
    )
    expect(result.cancelled).toHaveLength(1)
  })
})
