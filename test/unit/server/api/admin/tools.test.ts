import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import toolsGet from '../../../../../server/api/admin/tools.get'
import toolsPost from '../../../../../server/api/admin/tools.post'
import toolsDelete from '../../../../../server/api/admin/tools/[id].delete'
import toolsPatch from '../../../../../server/api/admin/tools/[id].patch'
import {
  getAllTools,
  createTool,
  updateTool,
  deleteTool
} from '../../../../../server/utils/lti-tools'

// Mock dependencies
vi.mock('../../../../../server/utils/lti-tools', () => ({
  getAllTools: vi.fn(),
  createTool: vi.fn(),
  updateTool: vi.fn(),
  deleteTool: vi.fn()
}))

// Mock h3 utils
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getValidatedQuery: vi.fn((event, validator) => validator(event.query || {})),
    readValidatedBody: vi.fn((event, validator) => validator(event.body || {})),
    getRouterParam: vi.fn((event, param) => event.context.params?.[param]),
    createError: (opts: any) => opts
  }
})

// Mock generic event
const mockEvent = (userRole: string | null = 'ADMIN', query = {}, body = {}, params = {}) =>
  ({
    context: {
      user: userRole ? { globalRole: userRole } : null,
      params
    },
    query,
    body
  }) as unknown as H3Event

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Admin Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/tools', () => {
    it('should call getAllTools with query params', async () => {
      const event = mockEvent('ADMIN', { p: 'platform1' })
      const mockTools = [{ id: 't1' }]
      vi.mocked(getAllTools).mockResolvedValue(mockTools as any)

      const result = await toolsGet(event)

      expect(getAllTools).toHaveBeenCalledWith({ p: 'platform1' })
      expect(result.data).toEqual(mockTools)
    })
  })

  describe('POST /api/admin/tools', () => {
    it('should call createTool with body', async () => {
      const body = { baseUrl: 'https://example.com', protocol: 'LTI13' }
      const event = mockEvent('ADMIN', {}, body)
      const mockTool = { id: 't1' }
      vi.mocked(createTool).mockResolvedValue(mockTool as any)

      const result = await toolsPost(event)

      expect(createTool).toHaveBeenCalledWith(expect.objectContaining(body))
      expect(result.data).toEqual(mockTool)
    })
  })

  describe('PATCH /api/admin/tools/:id', () => {
    it('should call updateTool with id and body', async () => {
      const body = { name: 'New Name' }
      const event = mockEvent('ADMIN', {}, body, { id: 't1' })
      const mockTool = { id: 't1', name: 'New Name' }
      vi.mocked(updateTool).mockResolvedValue(mockTool as any)

      const result = await toolsPatch(event)

      expect(updateTool).toHaveBeenCalledWith('t1', expect.objectContaining(body))
      expect(result.data).toEqual(mockTool)
    })
  })

  describe('DELETE /api/admin/tools/:id', () => {
    it('should call deleteTool with id', async () => {
      const event = mockEvent('ADMIN', {}, {}, { id: 't1' })

      const result = await toolsDelete(event)

      expect(deleteTool).toHaveBeenCalledWith('t1')
      expect(result.statusCode).toBe(200)
    })
  })
})
