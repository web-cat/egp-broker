import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reconcileShiftReservations } from '../../../../server/utils/gta-shift-rescheduling'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    gtaShift: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    gtaInterviewReservation: {
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    createError: (opts: any) => opts
  }
})

describe('Server Utility: reconcileShiftReservations', () => {
  const mockShift = {
    id: 'shift-1',
    courseId: 'course-1',
    userId: 'gta-1',
    date: new Date('2026-10-05T00:00:00.000Z'),
    startTime: '10:00',
    endTime: '12:00',
    user: {
      id: 'gta-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'asmith@vt.edu'
    }
  }

  const mockConcurrentShift = {
    id: 'shift-2',
    courseId: 'course-1',
    userId: 'gta-2',
    date: new Date('2026-10-05T00:00:00.000Z'),
    startTime: '10:00',
    endTime: '12:00',
    user: {
      id: 'gta-2',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bjones@vt.edu'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue(mockShift as any)
  })

  it('reschedules orphaned reservations to concurrent GTA when shift is deleted', async () => {
    const reservation1 = {
      id: 'res-1',
      gtaId: 'gta-1',
      startTime: new Date('2026-10-05T14:00:00.000Z'), // 10:00 AM EDT
      endTime: new Date('2026-10-05T14:10:00.000Z'),
      status: 'SCHEDULED',
      student: { id: 'student-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@vt.edu' },
      assignment: { id: 'asg-1', title: 'Project 1' },
      gta: { id: 'gta-1', firstName: 'Alice', lastName: 'Smith', email: 'asmith@vt.edu' }
    }

    vi.mocked(prisma.gtaInterviewReservation.findMany)
      // 1st call: active reservations for deleted shift
      .mockResolvedValueOnce([reservation1] as any)
      // 2nd call: active reservations across course for concurrent conflict check
      .mockResolvedValueOnce([] as any)

    vi.mocked(prisma.gtaShift.findMany).mockResolvedValueOnce([mockConcurrentShift] as any)

    const impact = await reconcileShiftReservations('course-1', 'shift-1', null)

    expect(impact.rescheduled).toHaveLength(1)
    expect(impact.cancelled).toHaveLength(0)
    expect(impact.rescheduled[0]).toMatchObject({
      reservationId: 'res-1',
      studentName: 'Jane Doe',
      studentEmail: 'jane@vt.edu',
      previousGtaName: 'Alice Smith',
      newGtaName: 'Bob Jones'
    })

    expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { gtaId: 'gta-2' }
    })
  })

  it('cancels reservation when shift is deleted and no concurrent GTA is available', async () => {
    const reservation1 = {
      id: 'res-1',
      gtaId: 'gta-1',
      startTime: new Date('2026-10-05T14:00:00.000Z'),
      endTime: new Date('2026-10-05T14:10:00.000Z'),
      status: 'SCHEDULED',
      student: { id: 'student-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@vt.edu' },
      assignment: { id: 'asg-1', title: 'Project 1' },
      gta: { id: 'gta-1', firstName: 'Alice', lastName: 'Smith', email: 'asmith@vt.edu' }
    }

    vi.mocked(prisma.gtaInterviewReservation.findMany)
      .mockResolvedValueOnce([reservation1] as any)
      .mockResolvedValueOnce([] as any)

    // No other shifts on duty
    vi.mocked(prisma.gtaShift.findMany).mockResolvedValueOnce([])

    const impact = await reconcileShiftReservations('course-1', 'shift-1', null)

    expect(impact.rescheduled).toHaveLength(0)
    expect(impact.cancelled).toHaveLength(1)
    expect(impact.cancelled[0]).toMatchObject({
      reservationId: 'res-1',
      studentName: 'Jane Doe',
      studentEmail: 'jane@vt.edu',
      previousGtaName: 'Alice Smith'
    })

    expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: 'CANCELLED' }
    })
  })

  it('leaves reservations untouched if shift edit still contains them', async () => {
    const reservationWithin = {
      id: 'res-1',
      gtaId: 'gta-1',
      startTime: new Date('2026-10-05T14:10:00.000Z'), // 10:10 AM EDT
      endTime: new Date('2026-10-05T14:20:00.000Z'),
      status: 'SCHEDULED',
      student: { id: 'student-1', firstName: 'Jane', lastName: 'Doe', email: 'jane@vt.edu' },
      assignment: { id: 'asg-1', title: 'Project 1' },
      gta: { id: 'gta-1', firstName: 'Alice', lastName: 'Smith', email: 'asmith@vt.edu' }
    }

    vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValueOnce([
      reservationWithin
    ] as any)

    // Shift edited from 10:00-12:00 to 10:00-11:30 (reservation at 10:10 still fits)
    const impact = await reconcileShiftReservations('course-1', 'shift-1', {
      startTime: '10:00',
      endTime: '11:30'
    })

    expect(impact.rescheduled).toHaveLength(0)
    expect(impact.cancelled).toHaveLength(0)
    expect(prisma.gtaInterviewReservation.update).not.toHaveBeenCalled()
  })

  it('reschedules reservations that are cut off by a shortened shift', async () => {
    const reservationCutOff = {
      id: 'res-cutoff',
      gtaId: 'gta-1',
      startTime: new Date('2026-10-05T15:30:00.000Z'), // 11:30 AM EDT
      endTime: new Date('2026-10-05T15:40:00.000Z'),
      status: 'SCHEDULED',
      student: { id: 'student-2', firstName: 'Mark', lastName: 'Lee', email: 'mlee@vt.edu' },
      assignment: { id: 'asg-1', title: 'Project 1' },
      gta: { id: 'gta-1', firstName: 'Alice', lastName: 'Smith', email: 'asmith@vt.edu' }
    }

    vi.mocked(prisma.gtaInterviewReservation.findMany)
      .mockResolvedValueOnce([reservationCutOff] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(prisma.gtaShift.findMany).mockResolvedValueOnce([mockConcurrentShift] as any)

    // Shift edited to end early at 11:00 (11:30 is cut off)
    const impact = await reconcileShiftReservations('course-1', 'shift-1', {
      startTime: '10:00',
      endTime: '11:00'
    })

    expect(impact.rescheduled).toHaveLength(1)
    expect(impact.rescheduled[0].studentName).toBe('Mark Lee')
    expect(impact.rescheduled[0].newGtaName).toBe('Bob Jones')
    expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith({
      where: { id: 'res-cutoff' },
      data: { gtaId: 'gta-2' }
    })
  })

  it('performs dry-run calculation without executing database updates when dryRun is true', async () => {
    const reservationCutOff = {
      id: 'res-cutoff',
      gtaId: 'gta-1',
      startTime: new Date('2026-10-05T15:30:00.000Z'),
      endTime: new Date('2026-10-05T15:40:00.000Z'),
      status: 'SCHEDULED',
      student: { id: 'student-2', firstName: 'Mark', lastName: 'Lee', email: 'mlee@vt.edu' },
      assignment: { id: 'asg-1', title: 'Project 1' },
      gta: { id: 'gta-1', firstName: 'Alice', lastName: 'Smith', email: 'asmith@vt.edu' }
    }

    vi.mocked(prisma.gtaInterviewReservation.findMany)
      .mockResolvedValueOnce([reservationCutOff] as any)
      .mockResolvedValueOnce([] as any)

    vi.mocked(prisma.gtaShift.findMany).mockResolvedValueOnce([mockConcurrentShift] as any)

    const impact = await reconcileShiftReservations(
      'course-1',
      'shift-1',
      {
        startTime: '10:00',
        endTime: '11:00'
      },
      undefined,
      true // dryRun: true
    )

    expect(impact.rescheduled).toHaveLength(1)
    expect(impact.rescheduled[0].studentName).toBe('Mark Lee')
    expect(impact.rescheduled[0].newGtaName).toBe('Bob Jones')
    expect(prisma.gtaInterviewReservation.update).not.toHaveBeenCalled()
  })
})
