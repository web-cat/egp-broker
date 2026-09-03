import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendCbtfIncidentNotification } from '../../../../server/utils/cbtf-notifications'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfReservation: {
      findUnique: vi.fn()
    },
    enrollment: {
      findMany: vi.fn()
    },
    user: {
      findMany: vi.fn()
    }
  }
}))

const mockSendMail = vi.fn()
vi.mock('@@/server/utils/email-transporter.helpers', () => ({
  getEmailTransporter: vi.fn(() => ({
    sendMail: mockSendMail
  }))
}))

describe('CBTF Incident Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when reservation has no notes', async () => {
    vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
      id: 'res-1',
      notes: []
    } as any)

    const result = await sendCbtfIncidentNotification('res-1')
    expect(result).toBe(false)
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('sends email to instructors and managers when notes are present', async () => {
    const mockReservation = {
      id: 'res-10',
      seatNumber: 14,
      checkedInAt: new Date('2026-10-05T09:00:00.000Z'),
      checkedOutAt: new Date('2026-10-05T10:00:00.000Z'),
      user: {
        firstName: 'John',
        lastName: 'Doe',
        studentId: '906000001',
        email: 'john@example.com'
      },
      assignment: {
        id: 'asg-1',
        title: 'Midterm Exam 1',
        courseId: 'course-1',
        course: { title: 'CS 1114 Intro to CS', label: 'CS 1114' }
      },
      facility: { name: 'Main CBTF' },
      notes: [
        {
          id: 'note-1',
          content: 'Observed note card beneath keyboard',
          hasPhotos: true,
          createdAt: new Date('2026-10-05T09:20:00.000Z'),
          author: { firstName: 'Jane', lastName: 'Proctor', email: 'jane.proctor@example.com' }
        },
        {
          id: 'note-2',
          content: 'Student finished early, did not take card',
          hasPhotos: false,
          createdAt: new Date('2026-10-05T09:45:00.000Z'),
          author: { firstName: 'Jane', lastName: 'Proctor', email: 'jane.proctor@example.com' }
        }
      ]
    }

    vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(mockReservation as any)

    // Instructors
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { user: { email: 'instructor@example.edu' } }
    ] as any)

    // Managers
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ email: 'manager@example.edu' }] as any)

    mockSendMail.mockResolvedValueOnce({ messageId: 'msg-123' })

    const result = await sendCbtfIncidentNotification('res-10')

    expect(result).toBe(true)
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.arrayContaining(['instructor@example.edu', 'manager@example.edu']),
        subject: expect.stringContaining('John Doe - Midterm Exam 1'),
        html: expect.stringContaining('PHOTO EVIDENCE TAKEN'),
        text: expect.stringContaining('Observed note card beneath keyboard')
      })
    )
  })

  it('handles transporter failure gracefully without throwing', async () => {
    vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
      id: 'res-10',
      assignment: { courseId: 'c-1', course: { title: 'CS' } },
      user: { firstName: 'A', lastName: 'B' },
      facility: { name: 'F' },
      notes: [{ id: 'n1', content: 'test', hasPhotos: false, author: {}, createdAt: new Date() }]
    } as any)

    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { user: { email: 'prof@edu' } }
    ] as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])

    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection error'))

    const result = await sendCbtfIncidentNotification('res-10')
    expect(result).toBe(false)
  })
})
