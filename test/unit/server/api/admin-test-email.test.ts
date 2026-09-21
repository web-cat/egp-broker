import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../server/api/admin/test-email.post'
import * as emailTransporterModule from '@@/server/utils/email-transporter.helpers'

vi.mock('@@/server/utils/email-transporter.helpers', () => ({
  getEmailTransporter: vi.fn()
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => opts
  }
})

describe('POST /api/admin/test-email', () => {
  const mockSendMail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(emailTransporterModule.getEmailTransporter).mockReturnValue({
      sendMail: mockSendMail
    } as any)
    vi.stubGlobal('useRuntimeConfig', () => ({
      email: {
        from: 'admin-noreply@example.edu'
      }
    }))
  })

  it('throws 403 when user is not logged in or not an ADMIN', async () => {
    vi.stubGlobal('getUserSession', () => Promise.resolve({ user: null }))

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })

    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'user-1', email: 'user@test.edu', globalRole: 'USER' } })
    )

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  })

  it('throws 400 when admin user has no email address', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', email: null, globalRole: 'ADMIN' } })
    )

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Current user has no email address configured'
    })
  })

  it('sends test email to admin email and returns success', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'msg-123' })
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({
        user: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@vt.edu',
          globalRole: 'ADMIN'
        }
      })
    )

    const result = await handler({} as any)

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@vt.edu',
        from: expect.stringContaining('admin-noreply@example.edu'),
        subject: expect.stringContaining('Email Configuration Test')
      })
    )
    expect(result).toEqual({
      statusCode: 200,
      data: {
        success: true,
        email: 'admin@vt.edu'
      }
    })
  })
})
