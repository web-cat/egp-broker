import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import passTypesGet from '@@/server/api/me/pass-types.get'
import passTypesPost from '@@/server/api/me/pass-types.post'
import passTypesPatch from '@@/server/api/me/pass-types/[id].patch'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    course: {
      findUnique: vi.fn()
    },
    passType: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/assignments', () => ({
  syncPassTypeEligibility: vi.fn().mockResolvedValue(undefined)
}))

vi.stubGlobal('syncPassTypeEligibility', vi.fn().mockResolvedValue(undefined))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getRouterParam: vi.fn((event: any, param: string) => event.params?.[param]),
    readValidatedBody: vi.fn((event: any, validator: (b: any) => any) =>
      validator(event.body || {})
    ),
    createError: (opts: any) => opts
  }
})

const mockEvent = (userId: string | null = 'user-1', globalRole = 'USER', params = {}, body = {}) =>
  ({
    context: {
      user: userId ? { id: userId, globalRole } : null
    },
    params,
    body
  }) as unknown as H3Event

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({
    user: event.context.user
      ? { id: event.context.user.id, globalRole: event.context.user.globalRole }
      : null
  })
)

describe('API: /api/me/pass-types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/me/pass-types', () => {
    it('throws 401 when unauthenticated', async () => {
      const event = mockEvent(null)
      await expect(passTypesGet(event)).rejects.toMatchObject({ statusCode: 401 })
    })

    it('returns empty array when user has no current course', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ currentCourseId: null } as any)
      const event = mockEvent('user-1')
      const result = await passTypesGet(event)
      expect(result.data).toEqual([])
    })

    it('returns projected pass types when user has current course', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z')
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ currentCourseId: 'c-1' } as any)
      vi.mocked(prisma.passType.findMany).mockResolvedValueOnce([
        {
          id: 'pt-1',
          name: 'Late Pass',
          description: null,
          extensionOnly: false,
          extendsCutoffOnly: false,
          initialBalance: 3,
          allowRequests: false,
          hoursPerPass: 24,
          titlePattern: null,
          minDaysPastDue: null,
          maxDaysPastDue: null,
          maxRedemptionsPerAssignment: 1,
          coolDownPeriod: null,
          coolDownUnit: null,
          coolDownReset: null,
          coolDownResetOffset: null,
          createdAt: now
        } as any
      ])

      const event = mockEvent('user-1')
      const result = await passTypesGet(event)

      expect(result.statusCode).toBe(200)
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'pt-1',
          name: 'Late Pass',
          createdAt: now.toISOString()
        })
      ])
    })
  })

  describe('POST /api/me/pass-types', () => {
    it('throws 403 when user is not teacher or admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        currentCourseId: 'c-1',
        enrollments: []
      } as any)

      const event = mockEvent('user-1', 'USER', {}, { name: 'Late Pass' })
      await expect(passTypesPost(event)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('creates pass type with projected data for instructor', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z')
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        currentCourseId: 'c-1',
        enrollments: [{ courseId: 'c-1' }]
      } as any)
      vi.mocked(prisma.passType.create).mockResolvedValueOnce({
        id: 'pt-new',
        name: 'Retry Pass',
        description: null,
        extensionOnly: false,
        extendsCutoffOnly: false,
        initialBalance: 3,
        allowRequests: false,
        hoursPerPass: 24,
        titlePattern: null,
        minDaysPastDue: null,
        maxDaysPastDue: null,
        maxRedemptionsPerAssignment: 1,
        coolDownPeriod: null,
        coolDownUnit: null,
        coolDownReset: null,
        coolDownResetOffset: null,
        createdAt: now
      } as any)

      const event = mockEvent('user-1', 'USER', {}, { name: 'Retry Pass' })
      const result = await passTypesPost(event)

      expect(result.statusCode).toBe(201)
      expect(result.data.name).toBe('Retry Pass')
      expect(result.data.createdAt).toBe(now.toISOString())
    })
  })

  describe('PATCH /api/me/pass-types/[id]', () => {
    it('throws 404 if pass type does not exist', async () => {
      vi.mocked(prisma.passType.findUnique).mockResolvedValueOnce(null)
      const event = mockEvent('user-1', 'USER', { id: 'pt-missing' }, { name: 'New Name' })
      await expect(passTypesPatch(event)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates pass type and returns projected data', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z')
      vi.mocked(prisma.passType.findUnique).mockResolvedValueOnce({
        id: 'pt-1',
        courseId: 'c-1'
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        enrollments: [{ id: 'en-1' }]
      } as any)
      vi.mocked(prisma.passType.update).mockResolvedValueOnce({
        id: 'pt-1',
        name: 'Updated Pass',
        description: null,
        extensionOnly: false,
        extendsCutoffOnly: false,
        initialBalance: 5,
        allowRequests: false,
        hoursPerPass: 48,
        titlePattern: null,
        minDaysPastDue: null,
        maxDaysPastDue: null,
        maxRedemptionsPerAssignment: 1,
        coolDownPeriod: null,
        coolDownUnit: null,
        coolDownReset: null,
        coolDownResetOffset: null,
        createdAt: now
      } as any)

      const event = mockEvent(
        'user-1',
        'USER',
        { id: 'pt-1' },
        { name: 'Updated Pass', initialBalance: 5, hoursPerPass: 48 }
      )
      const result = await passTypesPatch(event)

      expect(result.statusCode).toBe(200)
      expect(result.data.name).toBe('Updated Pass')
      expect(result.data.initialBalance).toBe(5)
      expect(result.data.createdAt).toBe(now.toISOString())
    })
  })
})
