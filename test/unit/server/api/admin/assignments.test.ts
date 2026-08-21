import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import assignmentDelete from '../../../../../server/api/admin/assignments/[id].delete'
import prisma from '@@/lib/prisma'
import { deleteAssignment } from '../../../../../server/utils/assignments'

vi.mock('@@/lib/prisma', () => ({
  default: {
    assignment: {
      findUnique: vi.fn(),
      delete: vi.fn()
    },
    ltiResult: {
      deleteMany: vi.fn()
    },
    $transaction: vi.fn((cb) => cb(prisma))
  }
}))

vi.mock('../../../../../server/utils/assignments', () => ({
  deleteAssignment: vi.fn()
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getRouterParam: vi.fn((event, param) => event.params?.[param]),
    createError: (opts: any) => opts
  }
})

const mockEvent = (userRole: string | null = 'ADMIN', params: Record<string, string> = {}) =>
  ({
    context: {
      user: userRole ? { globalRole: userRole } : null
    },
    params
  }) as unknown as H3Event

vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Admin Assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DELETE /api/admin/assignments/:id', () => {
    it('should throw 403 if not admin', async () => {
      const event = mockEvent('USER', { id: 'asgn-1' })
      try {
        await assignmentDelete(event)
      } catch (e: any) {
        expect(e.statusCode).toBe(403)
      }
    })

    it('should throw 404 if assignment does not exist', async () => {
      const event = mockEvent('ADMIN', { id: 'asgn-999' })
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

      try {
        await assignmentDelete(event)
      } catch (e: any) {
        expect(e.statusCode).toBe(404)
      }
    })

    it('should delete assignment and return status: deleted', async () => {
      const event = mockEvent('ADMIN', { id: 'asgn-1' })
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'asgn-1',
        title: 'Test'
      } as any)
      vi.mocked(deleteAssignment).mockResolvedValue({ id: 'asgn-1' } as any)

      const result = await assignmentDelete(event)

      expect(deleteAssignment).toHaveBeenCalledWith('asgn-1')
      expect(result).toEqual({ status: 'deleted' })
    })
  })
})
