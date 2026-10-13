import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import gradeTranslationsGet from '@@/server/api/admin/grade-translations/index.get'
import gradeTranslationsPost from '@@/server/api/admin/grade-translations/index.post'
import gradeTranslationsPatch from '@@/server/api/admin/grade-translations/[id].patch'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    gradeTranslation: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}))

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

const mockEvent = (userRole: string | null = 'ADMIN', params = {}, body = {}) =>
  ({
    context: {
      user: userRole ? { globalRole: userRole } : null
    },
    params,
    body
  }) as unknown as H3Event

vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Admin Grade Translations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/grade-translations', () => {
    it('throws 403 if not admin', async () => {
      const event = mockEvent('USER')
      await expect(gradeTranslationsGet(event)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns projected grade translations', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z')
      vi.mocked(prisma.gradeTranslation.findMany).mockResolvedValueOnce([
        {
          id: 'gt-1',
          name: 'Standard Letter',
          description: 'A-F scale',
          maxScore: 4.0,
          mapping: { A: 4.0 },
          createdAt: now,
          updatedAt: now
        } as any
      ])

      const event = mockEvent('ADMIN')
      const result = await gradeTranslationsGet(event)

      expect(result.statusCode).toBe(200)
      expect(result.data).toEqual([
        {
          id: 'gt-1',
          name: 'Standard Letter',
          description: 'A-F scale',
          maxScore: 4.0,
          mapping: { A: 4.0 },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        }
      ])
    })
  })

  describe('POST /api/admin/grade-translations', () => {
    it('throws 403 if not admin', async () => {
      const event = mockEvent('USER')
      await expect(gradeTranslationsPost(event)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('creates grade translation with projected select', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z')
      vi.mocked(prisma.gradeTranslation.create).mockResolvedValueOnce({
        id: 'gt-new',
        name: 'Pass/Fail',
        description: null,
        maxScore: 1.0,
        mapping: null,
        createdAt: now,
        updatedAt: now
      } as any)

      const event = mockEvent('ADMIN', {}, { name: 'Pass/Fail' })
      const result = await gradeTranslationsPost(event)

      expect(result.statusCode).toBe(201)
      expect(result.data).toEqual({
        id: 'gt-new',
        name: 'Pass/Fail',
        description: null,
        maxScore: 1.0,
        mapping: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })
    })
  })

  describe('PATCH /api/admin/grade-translations/[id]', () => {
    it('throws 403 if not admin', async () => {
      const event = mockEvent('USER')
      await expect(gradeTranslationsPatch(event)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 400 if missing ID', async () => {
      const event = mockEvent('ADMIN', {}, { name: 'Updated Scale' })
      await expect(gradeTranslationsPatch(event)).rejects.toMatchObject({ statusCode: 400 })
    })

    it('updates grade translation with projected select', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z')
      vi.mocked(prisma.gradeTranslation.update).mockResolvedValueOnce({
        id: 'gt-1',
        name: 'Updated Scale',
        description: null,
        maxScore: 5.0,
        mapping: null,
        createdAt: now,
        updatedAt: now
      } as any)

      const event = mockEvent('ADMIN', { id: 'gt-1' }, { name: 'Updated Scale', maxScore: 5.0 })
      const result = await gradeTranslationsPatch(event)

      expect(result.statusCode).toBe(200)
      expect(result.data.name).toBe('Updated Scale')
      expect(result.data.maxScore).toBe(5.0)
    })
  })
})
