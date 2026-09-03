import { describe, it, expect, vi, beforeEach } from 'vitest'
import notesPost from '../../../../../server/api/proctor/notes.post'
import notesGet from '../../../../../server/api/proctor/notes.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfFacility: {
      findFirst: vi.fn()
    },
    cbtfReservation: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    cbtfReservationNote: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

let currentSessionUser: any = null
vi.stubGlobal('getUserSession', () => Promise.resolve({ user: currentSessionUser }))

describe('API: Proctor Notes Endpoints', () => {
  const mockEvent = (userRole: string | null = 'PROCTOR', query = {}, body = {}) =>
    ({
      context: {
        user: userRole
          ? { id: 'proctor-1', firstName: 'Proctor', lastName: 'User', globalRole: userRole }
          : null
      },
      node: { req: { method: 'POST' } },
      _query: query,
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      getQuery: (event: any) => event._query || {},
      readBody: (event: any) => Promise.resolve(event._body || {}),
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    currentSessionUser = { id: 'proctor-1', globalRole: 'PROCTOR' }
  })

  describe('Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      currentSessionUser = null
      const event = mockEvent(null)
      await expect(notesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('rejects student (USER) requests with 403', async () => {
      currentSessionUser = { id: 'usr-1', globalRole: 'USER' }
      const event = mockEvent('USER')
      await expect(notesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })
  })

  describe('POST /api/proctor/notes', () => {
    it('creates note directly using reservationId', async () => {
      const now = new Date()
      vi.mocked(prisma.cbtfReservationNote.create).mockResolvedValue({
        id: 'note-1',
        reservationId: 'res-123',
        authorId: 'proctor-1',
        content: 'Suspicious glancing toward seat 15',
        hasPhotos: true,
        createdAt: now,
        updatedAt: now,
        author: { firstName: 'Proctor', lastName: 'User', email: 'proctor@example.com' },
        reservation: {
          id: 'res-123',
          seatNumber: 14,
          user: { firstName: 'Alice', lastName: 'Smith', studentId: '906000001' }
        }
      } as any)

      const event = mockEvent(
        'PROCTOR',
        {},
        {
          reservationId: 'res-123',
          content: 'Suspicious glancing toward seat 15',
          hasPhotos: true
        }
      )

      const response = await notesPost(event)

      expect(response.statusCode).toBe(201)
      expect(response.data.id).toBe('note-1')
      expect(response.data.hasPhotos).toBe(true)
      expect(response.data.seatNumber).toBe(14)
      expect(response.data.studentName).toBe('Alice Smith')
      expect(prisma.cbtfReservationNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId: 'res-123',
            authorId: 'proctor-1',
            hasPhotos: true
          })
        })
      )
    })

    it('creates note dynamically by seatNumber resolving active reservation', async () => {
      const now = new Date()
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({ id: 'fac-1' } as any)
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue({
        id: 'res-seated-seat-7',
        seatNumber: 7
      } as any)

      vi.mocked(prisma.cbtfReservationNote.create).mockResolvedValue({
        id: 'note-2',
        reservationId: 'res-seated-seat-7',
        authorId: 'proctor-1',
        content: 'Unauthorized calculator on desk',
        hasPhotos: false,
        createdAt: now,
        updatedAt: now,
        author: { firstName: 'Proctor', lastName: 'User', email: 'proctor@example.com' },
        reservation: {
          id: 'res-seated-seat-7',
          seatNumber: 7,
          user: { firstName: 'Bob', lastName: 'Jones', studentId: '906000002' }
        }
      } as any)

      const event = mockEvent(
        'PROCTOR',
        {},
        {
          seatNumber: 7,
          content: 'Unauthorized calculator on desk',
          hasPhotos: false
        }
      )

      const response = await notesPost(event)

      expect(response.statusCode).toBe(201)
      expect(response.data.reservationId).toBe('res-seated-seat-7')
      expect(response.data.seatNumber).toBe(7)
      expect(prisma.cbtfReservationNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId: 'res-seated-seat-7'
          })
        })
      )
    })

    it('rejects creation when neither reservationId nor seatNumber is provided', async () => {
      const event = mockEvent('PROCTOR', {}, { content: 'No target provided' })
      await expect(notesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })
  })

  describe('GET /api/proctor/notes', () => {
    it('retrieves notes for a reservation', async () => {
      const now = new Date()
      vi.mocked(prisma.cbtfReservationNote.findMany).mockResolvedValue([
        {
          id: 'note-1',
          reservationId: 'res-100',
          authorId: 'proctor-1',
          content: 'First note',
          hasPhotos: false,
          createdAt: now,
          updatedAt: now,
          author: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }
        }
      ] as any)

      const event = mockEvent('PROCTOR', { reservationId: 'res-100' })
      const response = await notesGet(event)

      expect(response.statusCode).toBe(200)
      expect(response.data.length).toBe(1)
      expect(response.data[0].authorName).toBe('Jane Doe')
    })
  })
})
