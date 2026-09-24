import { describe, it, expect, vi, beforeEach } from 'vitest'
import notesGet from '../../../../../../server/api/admin/cbtf/notes.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfReservationNote: {
      count: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

let currentSessionUser: any = null
vi.stubGlobal('getUserSession', () => Promise.resolve({ user: currentSessionUser }))

describe('API: Admin CBTF Reservation Notes Endpoint (GET /api/admin/cbtf/notes)', () => {
  const mockEvent = (query = {}) =>
    ({
      context: {
        user: currentSessionUser
      },
      node: { req: { method: 'GET' } },
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      getQuery: (event: any) => event._query || {},
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    currentSessionUser = { id: 'admin-1', globalRole: 'ADMIN' }
  })

  describe('Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      currentSessionUser = null
      const event = mockEvent()
      await expect(notesGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('rejects non-admin (PROCTOR) requests with 403', async () => {
      currentSessionUser = { id: 'proctor-1', globalRole: 'PROCTOR' }
      const event = mockEvent()
      await expect(notesGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('rejects student (USER) requests with 403', async () => {
      currentSessionUser = { id: 'usr-1', globalRole: 'USER' }
      const event = mockEvent()
      await expect(notesGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })
  })

  describe('Query & Filtering', () => {
    const mockNotesData = [
      {
        id: 'note-1',
        reservationId: 'res-1',
        content: 'Unauthorized notes on scratch paper',
        hasPhotos: true,
        createdAt: new Date('2026-09-24T10:00:00.000Z'),
        updatedAt: new Date('2026-09-24T10:00:00.000Z'),
        author: {
          id: 'author-1',
          firstName: 'Proctor',
          lastName: 'Pat',
          email: 'pat@vt.edu'
        },
        reservation: {
          id: 'res-1',
          seatNumber: 12,
          startTime: new Date('2026-09-24T09:00:00.000Z'),
          endTime: new Date('2026-09-24T10:30:00.000Z'),
          status: 'CHECKED_IN',
          user: {
            id: 'u-1',
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'asmith@vt.edu',
            studentId: '906000001'
          },
          assignment: {
            id: 'a-1',
            title: 'Midterm Exam 1',
            course: {
              id: 'c-1',
              label: 'CS 2114',
              title: 'Software Design & Data Structures'
            }
          }
        }
      }
    ]

    it('returns notes in reverse chronological order with pagination metadata', async () => {
      vi.mocked(prisma.cbtfReservationNote.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservationNote.findMany).mockResolvedValue(mockNotesData as any)

      const event = mockEvent({ page: '1', pageSize: '20' })
      const res = await notesGet(event)

      expect(res.statusCode).toBe(200)
      expect(res.data.length).toBe(1)
      expect(res.data[0].id).toBe('note-1')
      expect(res.data[0].content).toBe('Unauthorized notes on scratch paper')
      expect(res.data[0].hasPhotos).toBe(true)
      expect(res.data[0].author?.name).toBe('Proctor Pat')
      expect(res.data[0].reservation?.student?.name).toBe('Alice Smith')
      expect(res.data[0].reservation?.assignment?.title).toBe('Midterm Exam 1')
      expect(res.data[0].reservation?.course?.label).toBe('CS 2114')
      expect(res.pagination).toEqual({
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1
      })

      expect(prisma.cbtfReservationNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20
        })
      )
    })

    it('filters by student name or email', async () => {
      vi.mocked(prisma.cbtfReservationNote.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservationNote.findMany).mockResolvedValue(mockNotesData as any)

      const event = mockEvent({ student: 'Alice Smith' })
      await notesGet(event)

      expect(prisma.cbtfReservationNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reservation: expect.objectContaining({
              user: expect.objectContaining({
                AND: expect.any(Array)
              })
            })
          })
        })
      )
    })

    it('filters by assignment and course', async () => {
      vi.mocked(prisma.cbtfReservationNote.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservationNote.findMany).mockResolvedValue(mockNotesData as any)

      const event = mockEvent({ assignment: 'Midterm', course: 'CS 2114' })
      await notesGet(event)

      expect(prisma.cbtfReservationNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reservation: expect.objectContaining({
              assignment: expect.objectContaining({
                title: { contains: 'Midterm', mode: 'insensitive' },
                course: expect.objectContaining({
                  OR: [
                    { label: { contains: 'CS 2114', mode: 'insensitive' } },
                    { title: { contains: 'CS 2114', mode: 'insensitive' } }
                  ]
                })
              })
            })
          })
        })
      )
    })

    it('filters by date range (from and to)', async () => {
      vi.mocked(prisma.cbtfReservationNote.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservationNote.findMany).mockResolvedValue(mockNotesData as any)

      const event = mockEvent({ from: '2026-09-01', to: '2026-09-24' })
      await notesGet(event)

      expect(prisma.cbtfReservationNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date)
            })
          })
        })
      )
    })
  })
})
