import { describe, it, expect, vi, beforeEach } from 'vitest'
import rosterSyncStatusGet from '../../../../../../server/api/me/course/roster-sync-status.get'
import rosterSyncPost from '../../../../../../server/api/me/course/roster-sync.post'
import prisma from '@@/server/utils/db'
import * as nrpsModule from '@@/server/utils/nrps'

vi.mock('@@/server/utils/db', () => ({
  default: {
    course: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/nrps', () => ({
  acquireRosterSyncLock: vi.fn(),
  syncCourseRosterFromNrps: vi.fn().mockResolvedValue({ success: true })
}))

vi.mock('@@/server/utils/session', () => ({
  requireCourseContext: vi.fn().mockResolvedValue('course-123')
}))

vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: /api/me/course/roster-sync endpoints', () => {
  const mockEvent = (user: any = { id: 'u1', globalRole: 'USER' }) =>
    ({
      context: { user },
      node: { req: { method: 'GET' } }
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      createError: (opts: any) => opts
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/me/course/roster-sync-status', () => {
    it('returns 401 when unauthorized', async () => {
      const event = mockEvent(null)
      await expect(rosterSyncStatusGet(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    })

    it('returns isSyncing and lastRosterSyncAt for current course', async () => {
      const event = mockEvent()
      const syncDate = new Date('2026-09-08T10:00:00Z')
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 'course-123',
        isRosterSyncing: true,
        lastRosterSyncAt: syncDate
      } as any)

      const response = await rosterSyncStatusGet(event)

      expect(response).toEqual({
        statusCode: 200,
        data: {
          isSyncing: true,
          lastRosterSyncAt: syncDate.toISOString()
        }
      })
    })
  })

  describe('POST /api/me/course/roster-sync', () => {
    it('returns 401 when unauthorized', async () => {
      const event = mockEvent(null)
      await expect(rosterSyncPost(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    })

    it('returns 403 when user is not a teacher or staff', async () => {
      const event = mockEvent({ id: 'u1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        role: 'STUDENT'
      } as any)

      await expect(rosterSyncPost(event)).rejects.toMatchObject({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    })

    it('initiates sync if teacher and lock acquired', async () => {
      const event = mockEvent({ id: 'u1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        role: 'TEACHER'
      } as any)
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 'course-123',
        isRosterSyncing: false
      } as any)
      vi.mocked(nrpsModule.acquireRosterSyncLock).mockResolvedValue(true)

      const response = await rosterSyncPost(event)

      expect(nrpsModule.acquireRosterSyncLock).toHaveBeenCalledWith('course-123')
      expect(nrpsModule.syncCourseRosterFromNrps).toHaveBeenCalledWith('course-123')
      expect(response).toEqual({
        statusCode: 200,
        data: {
          isSyncing: true
        }
      })
    })

    it('returns isSyncing: true without starting duplicate if already syncing', async () => {
      const event = mockEvent({ id: 'u1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        role: 'TEACHER'
      } as any)
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 'course-123',
        isRosterSyncing: true
      } as any)

      const response = await rosterSyncPost(event)

      expect(nrpsModule.acquireRosterSyncLock).not.toHaveBeenCalled()
      expect(nrpsModule.syncCourseRosterFromNrps).not.toHaveBeenCalled()
      expect(response).toEqual({
        statusCode: 200,
        data: {
          isSyncing: true,
          message: 'Roster sync is already in progress'
        }
      })
    })
  })
})
