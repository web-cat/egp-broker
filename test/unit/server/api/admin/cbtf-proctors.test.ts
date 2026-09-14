import { describe, it, expect, vi, beforeEach } from 'vitest'
import proctorsGet from '../../../../../server/api/admin/cbtf/proctors.get'
import proctorsSearchGet from '../../../../../server/api/admin/cbtf/proctors/search.get'
import proctorsPost from '../../../../../server/api/admin/cbtf/proctors.post'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Admin CBTF Proctor Management Endpoints', () => {
  const mockEvent = (userRole: string | null = 'ADMIN', body = {}, params = {}, query = {}) =>
    ({
      context: {
        user: userRole ? { id: 'admin-1', globalRole: userRole } : null,
        params
      },
      node: { req: { method: 'GET' } },
      _body: body,
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
      getQuery: (event: any) => event._query || {},
      getRouterParam: (event: any, name: string) => event.context?.params?.[name] || null,
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/cbtf/proctors', () => {
    it('rejects unauthenticated requests', async () => {
      const event = mockEvent(null)
      await expect(proctorsGet(event)).rejects.toThrow('Unauthorized')
    })

    it('rejects non-admin requests', async () => {
      const event = mockEvent('PROCTOR')
      await expect(proctorsGet(event)).rejects.toThrow('Forbidden')
    })

    it('returns all users with PROCTOR globalRole', async () => {
      const event = mockEvent('ADMIN')
      const mockProctors = [
        {
          id: 'p1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          globalRole: 'PROCTOR',
          avatarUrl: null
        }
      ]
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockProctors as any)

      const res = await proctorsGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(mockProctors)
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { globalRole: 'PROCTOR' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          globalRole: true,
          avatarUrl: true
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      })
    })
  })

  describe('GET /api/admin/cbtf/proctors/search', () => {
    it('rejects non-admin requests', async () => {
      const event = mockEvent('USER', {}, {}, { email: 'student@example.com' })
      await expect(proctorsSearchGet(event)).rejects.toThrow('Forbidden')
    })

    it('rejects invalid email parameter', async () => {
      const event = mockEvent('ADMIN', {}, {}, { email: 'not-an-email' })
      await expect(proctorsSearchGet(event)).rejects.toThrow()
    })

    it('returns 404 when user is not found', async () => {
      const event = mockEvent('ADMIN', {}, {}, { email: 'unknown@example.com' })
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(proctorsSearchGet(event)).rejects.toThrow('User not found')
    })

    it('returns found user details', async () => {
      const event = mockEvent('ADMIN', {}, {}, { email: 'found@example.com' })
      const mockUser = {
        id: 'u-123',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'found@example.com',
        globalRole: 'USER',
        avatarUrl: null
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const res = await proctorsSearchGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'found@example.com' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          globalRole: true,
          avatarUrl: true
        }
      })
    })
  })

  describe('POST /api/admin/cbtf/proctors', () => {
    it('rejects non-admin requests', async () => {
      const event = mockEvent('USER', { userId: 'u-123' })
      await expect(proctorsPost(event)).rejects.toThrow('Forbidden')
    })

    it('rejects missing userId in body', async () => {
      const event = mockEvent('ADMIN', {})
      await expect(proctorsPost(event)).rejects.toThrow()
    })

    it('updates user globalRole to PROCTOR and returns user', async () => {
      const event = mockEvent('ADMIN', { userId: 'u-123' })
      const updatedUser = {
        id: 'u-123',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'found@example.com',
        globalRole: 'PROCTOR',
        avatarUrl: null
      }
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any)

      const res = await proctorsPost(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(updatedUser)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-123' },
        data: { globalRole: 'PROCTOR' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          globalRole: true,
          avatarUrl: true
        }
      })
    })
  })
})
