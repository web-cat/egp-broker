import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', vi.fn())
vi.stubGlobal('setUserSession', vi.fn())
vi.stubGlobal('defineEventHandler', (fn: any) => fn)

const createMockEvent = (path = '/'): H3Event => {
  return {
    path,
    context: {}
  } as unknown as H3Event
}

describe('Server Middleware: session-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips static asset paths', async () => {
    const { default: sessionBackfill } = await import('@@/server/middleware/session-backfill')
    const event = createMockEvent('/_nuxt/app.js')

    await sessionBackfill(event)

    expect(getUserSession).not.toHaveBeenCalled()
  })

  it('does nothing if no session or user', async () => {
    const { default: sessionBackfill } = await import('@@/server/middleware/session-backfill')
    vi.mocked(getUserSession).mockResolvedValue({} as any)
    const event = createMockEvent('/')

    await sessionBackfill(event)

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(setUserSession).not.toHaveBeenCalled()
  })

  it('does nothing if session user already has globalRole', async () => {
    const { default: sessionBackfill } = await import('@@/server/middleware/session-backfill')
    vi.mocked(getUserSession).mockResolvedValue({
      user: { id: 'usr-1', globalRole: 'PROCTOR' }
    } as any)
    const event = createMockEvent('/')

    await sessionBackfill(event)

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(setUserSession).not.toHaveBeenCalled()
  })

  it('backfills globalRole from database when missing in session', async () => {
    const { default: sessionBackfill } = await import('@@/server/middleware/session-backfill')
    const existingSession = {
      user: {
        id: 'usr-proctor-1',
        email: 'proctor@example.com',
        firstName: 'Jane',
        lastName: 'Doe'
      }
    }
    vi.mocked(getUserSession).mockResolvedValue(existingSession as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      globalRole: 'PROCTOR',
      avatarUrl: 'https://example.com/avatar.jpg'
    } as any)

    const event = createMockEvent('/')
    await sessionBackfill(event)

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'usr-proctor-1' },
      select: { globalRole: true, avatarUrl: true }
    })

    expect(setUserSession).toHaveBeenCalledWith(event, {
      user: {
        id: 'usr-proctor-1',
        email: 'proctor@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        globalRole: 'PROCTOR',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    })
  })
})
