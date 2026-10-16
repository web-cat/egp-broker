import { describe, it, expect, vi, beforeEach } from 'vitest'
import shiftDefinitionPut from '../../../../../server/api/admin/cbtf/proctors/[id]/shift-definition.put'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: PUT /api/admin/cbtf/proctors/:id/shift-definition', () => {
  const mockEvent = (userRole: string | null = 'ADMIN', body = {}, params = {}) =>
    ({
      context: {
        user: userRole ? { id: 'admin-1', globalRole: userRole } : null,
        params
      },
      node: { req: { method: 'PUT' } },
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
      readValidatedBody: (event: any, validator: any) => validator(event._body || {}),
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

  it('rejects unauthenticated requests', async () => {
    const event = mockEvent(null, { shiftDefinition: 'Mon 09:00-12:00' }, { id: 'p1' })
    await expect(shiftDefinitionPut(event)).rejects.toThrow('Unauthorized')
  })

  it('rejects non-admin requests', async () => {
    const event = mockEvent('PROCTOR', { shiftDefinition: 'Mon 09:00-12:00' }, { id: 'p1' })
    await expect(shiftDefinitionPut(event)).rejects.toThrow('Forbidden')
  })

  it('rejects invalid or missing target proctor id', async () => {
    const event = mockEvent('ADMIN', { shiftDefinition: 'Mon 09:00-12:00' }, {})
    await expect(shiftDefinitionPut(event)).rejects.toThrow('Proctor ID is required')
  })

  it('rejects if proctor not found', async () => {
    const event = mockEvent('ADMIN', { shiftDefinition: 'Mon 09:00-12:00' }, { id: 'p-none' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    await expect(shiftDefinitionPut(event)).rejects.toThrow('Proctor not found')
  })

  it('updates and persists proctorShiftDefinition for valid proctor', async () => {
    const event = mockEvent(
      'ADMIN',
      { shiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)' },
      { id: 'p1' }
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'p1',
      globalRole: 'PROCTOR'
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'p1',
      proctorShiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)'
    } as any)

    const res = await shiftDefinitionPut(event)
    expect(res.statusCode).toBe(200)
    expect(res.data.proctorShiftDefinition).toBe('Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        proctorShiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)'
      },
      select: {
        id: true,
        proctorShiftDefinition: true
      }
    })
  })
})
