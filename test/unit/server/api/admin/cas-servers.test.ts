import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import casServersGet from '../../../../../server/api/admin/cas-servers.get'
import casServersPost from '../../../../../server/api/admin/cas-servers.post'
import casServersPut from '../../../../../server/api/admin/cas-servers/[id].put'
import casServersDelete from '../../../../../server/api/admin/cas-servers/[id].delete'

import mockDbAny from '@@/server/utils/db'

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

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

vi.mock('@@/server/utils/db', () => ({
  default: {
    casServer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    casIdentity: {
      count: vi.fn()
    }
  }
}))

const mockDb = mockDbAny as any

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

describe('API: Admin CAS Servers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/cas-servers', () => {
    it('returns formatted list of CAS servers', async () => {
      const event = mockEvent()

      mockDb.casServer.findMany.mockResolvedValue([
        {
          id: '123',
          name: 'VT',
          baseUrl: 'https://login.vt.edu/cas',
          serviceValidateVersion: '2.0',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          _count: { identities: 5 }
        }
      ])

      const result = await casServersGet(event)

      expect(mockDb.casServer.findMany).toHaveBeenCalled()
      expect(result.statusCode).toBe(200)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].identityCount).toBe(5)
      expect(result.data[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
    })
  })

  describe('POST /api/admin/cas-servers', () => {
    it('creates a new CAS server', async () => {
      const body = {
        name: 'New CAS',
        baseUrl: 'https://new.edu/cas',
        serviceValidateVersion: '3.0'
      }
      const event = mockEvent('ADMIN', {}, body)

      mockDb.casServer.findUnique.mockResolvedValue(null)
      mockDb.casServer.create.mockResolvedValue({
        id: 'new-id',
        name: 'New CAS',
        baseUrl: 'https://new.edu/cas',
        serviceValidateVersion: '3.0',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        _count: { identities: 0 }
      })

      const result = await casServersPost(event)

      expect(mockDb.casServer.create).toHaveBeenCalledWith(expect.objectContaining({ data: body }))
      expect(result.statusCode).toBe(201)
      expect(result.data.id).toBe('new-id')
    })

    it('rejects duplicate baseUrls', async () => {
      const body = {
        name: 'Dup CAS',
        baseUrl: 'https://dup.edu/cas',
        serviceValidateVersion: '2.0'
      }
      const event = mockEvent('ADMIN', {}, body)

      mockDb.casServer.findUnique.mockResolvedValue({ id: 'existing' })

      try {
        await casServersPost(event)
        expect.unreachable('Should throw error for duplicate baseUrl')
      } catch (err: any) {
        expect(err.statusCode).toBe(400)
        expect(err.statusMessage).toMatch(/already exists/)
      }
    })
  })

  describe('PUT /api/admin/cas-servers/:id', () => {
    it('updates a CAS server', async () => {
      const body = { name: 'Updated' }
      const event = mockEvent('ADMIN', {}, body, { id: '123' })

      mockDb.casServer.update.mockResolvedValue({
        id: '123',
        name: 'Updated',
        baseUrl: 'https://test.edu/cas',
        serviceValidateVersion: '2.0',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        _count: { identities: 0 }
      })

      const result = await casServersPut(event)

      expect(mockDb.casServer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '123' },
          data: { name: 'Updated', serviceValidateVersion: '2.0' }
        })
      )
      expect(result.statusCode).toBe(200)
      expect(result.data.name).toBe('Updated')
    })
  })

  describe('DELETE /api/admin/cas-servers/:id', () => {
    it('deletes a CAS server if no linked identities', async () => {
      const event = mockEvent('ADMIN', {}, {}, { id: '123' })
      mockDb.casIdentity.count.mockResolvedValue(0)
      mockDb.casServer.delete.mockResolvedValue({ id: '123' })

      const result = await casServersDelete(event)

      expect(mockDb.casIdentity.count).toHaveBeenCalledWith({ where: { casServerId: '123' } })
      expect(mockDb.casServer.delete).toHaveBeenCalledWith({ where: { id: '123' } })
      expect(result.statusCode).toBe(200)
    })

    it('prevents deletion if identities exist', async () => {
      const event = mockEvent('ADMIN', {}, {}, { id: '123' })
      mockDb.casIdentity.count.mockResolvedValue(3)

      try {
        await casServersDelete(event)
        expect.unreachable('Should throw error when identities exist')
      } catch (err: any) {
        expect(err.statusCode).toBe(400)
        expect(err.statusMessage).toMatch(/Cannot delete/)
        expect(mockDb.casServer.delete).not.toHaveBeenCalled()
      }
    })
  })
})
