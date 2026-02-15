import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import deploymentsGet from '../../../../../server/api/admin/deployments.get'
import deploymentsPost from '../../../../../server/api/admin/deployments.post'
import deploymentsPatch from '../../../../../server/api/admin/deployments/[id].patch'
import {
  getAllDeployments,
  createDeployment,
  updateDeployment
} from '../../../../../server/utils/lti-deployments'

// Mock dependencies
vi.mock('../../../../../server/utils/lti-deployments', () => ({
  getAllDeployments: vi.fn(),
  createDeployment: vi.fn(),
  updateDeployment: vi.fn()
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

describe('API: Admin Deployments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/deployments', () => {
    it('should call getAllDeployments with query params', async () => {
      const event = mockEvent('ADMIN', { p: 'platform1' })
      const mockDeployments = [{ id: 'd1' }]
      vi.mocked(getAllDeployments).mockResolvedValue(mockDeployments as any)

      const result = await deploymentsGet(event)

      expect(getAllDeployments).toHaveBeenCalledWith({ p: 'platform1' })
      expect(result.data).toEqual(mockDeployments)
    })
  })

  describe('POST /api/admin/deployments', () => {
    it('should call createDeployment with body', async () => {
      const body = { platformId: 'p1', deploymentId: 'dep1' }
      const event = mockEvent('ADMIN', {}, body)
      const mockDeployment = { id: 'd1' }
      vi.mocked(createDeployment).mockResolvedValue(mockDeployment as any)

      const result = await deploymentsPost(event)

      expect(createDeployment).toHaveBeenCalledWith(body)
      expect(result.data).toEqual(mockDeployment)
    })
  })

  describe('PATCH /api/admin/deployments/:id', () => {
    it('should call updateDeployment with id and body', async () => {
      const body = { deploymentHost: 'newhost.com' }
      const event = mockEvent('ADMIN', {}, body, { id: 'd1' })
      const mockDeployment = { id: 'd1', deploymentHost: 'newhost.com' }
      vi.mocked(updateDeployment).mockResolvedValue(mockDeployment as any)

      const result = await deploymentsPatch(event)

      expect(updateDeployment).toHaveBeenCalledWith('d1', expect.objectContaining(body))
      expect(result.data).toEqual(mockDeployment)
    })
  })
})
