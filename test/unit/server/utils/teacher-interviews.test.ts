import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import { getStudentInterviewHistory } from '@@/server/utils/teacher'

vi.mock('@@/server/utils/db', () => ({
  default: {
    gtaInterviewReservation: {
      findMany: vi.fn()
    }
  }
}))

describe('teacher utility: getStudentInterviewHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries reservations for student and course ordered by startTime desc', async () => {
    const mockReservations = [
      {
        id: 'res-1',
        assignmentId: 'asg-1',
        studentId: 'student-1',
        gtaId: 'gta-1',
        startTime: new Date('2026-09-25T14:00:00.000Z'),
        endTime: new Date('2026-09-25T14:15:00.000Z'),
        status: 'COMPLETED',
        checkedInAt: new Date('2026-09-25T14:01:00.000Z'),
        checkedOutAt: new Date('2026-09-25T14:14:00.000Z'),
        notes: 'Passed interview with 100%',
        createdAt: new Date('2026-09-24T10:00:00.000Z'),
        assignment: {
          id: 'asg-1',
          title: 'Project 1'
        },
        gta: {
          id: 'gta-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice.gta@example.com'
        }
      },
      {
        id: 'res-2',
        assignmentId: 'asg-1',
        studentId: 'student-1',
        gtaId: 'gta-2',
        startTime: new Date('2026-09-20T10:00:00.000Z'),
        endTime: new Date('2026-09-20T10:15:00.000Z'),
        status: 'CANCELLED',
        checkedInAt: null,
        checkedOutAt: null,
        notes: null,
        createdAt: new Date('2026-09-19T09:00:00.000Z'),
        assignment: {
          id: 'asg-1',
          title: 'Project 1'
        },
        gta: {
          id: 'gta-2',
          firstName: null,
          lastName: null,
          email: 'gta2@example.com'
        }
      }
    ]

    vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue(mockReservations as any)

    const result = await getStudentInterviewHistory('student-1', 'course-1')

    expect(prisma.gtaInterviewReservation.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        assignment: { courseId: 'course-1' }
      },
      orderBy: { startTime: 'desc' },
      include: {
        assignment: { select: { id: true, title: true } },
        gta: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'res-1',
      assignmentId: 'asg-1',
      assignmentTitle: 'Project 1',
      gtaId: 'gta-1',
      gtaName: 'Alice Smith',
      gtaEmail: 'alice.gta@example.com',
      startTime: '2026-09-25T14:00:00.000Z',
      endTime: '2026-09-25T14:15:00.000Z',
      status: 'COMPLETED',
      checkedInAt: '2026-09-25T14:01:00.000Z',
      checkedOutAt: '2026-09-25T14:14:00.000Z',
      notes: 'Passed interview with 100%',
      createdAt: '2026-09-24T10:00:00.000Z'
    })

    expect(result[1].gtaName).toBe('gta2@example.com')
    expect(result[1].status).toBe('CANCELLED')
    expect(result[1].checkedInAt).toBeNull()
    expect(result[1].checkedOutAt).toBeNull()
  })
})
