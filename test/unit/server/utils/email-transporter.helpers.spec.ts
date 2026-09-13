import { describe, it, expect, vi, beforeEach } from 'vitest'
import nodemailer from 'nodemailer'
import {
  getEmailTransporter,
  resetEmailTransporter
} from '@@/server/utils/email-transporter.helpers'

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn()
    }))
  }
}))

const mockRuntimeConfig = vi.fn()
vi.stubGlobal('useRuntimeConfig', mockRuntimeConfig)

describe('email-transporter.helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetEmailTransporter()
  })

  it('creates transport without auth for whitelisted/unauthenticated relay (no user/pass)', () => {
    mockRuntimeConfig.mockReturnValue({
      email: {
        host: 'antispam.cs.vt.edu',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: 'egp-broker@cs.vt.edu'
      }
    })

    const transporter = getEmailTransporter()
    expect(transporter).toBeDefined()

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'antispam.cs.vt.edu',
      port: 587,
      secure: false
    })
    const callArgs = vi.mocked(nodemailer.createTransport).mock.calls[0][0] as any
    expect(callArgs.auth).toBeUndefined()
  })

  it('creates transport with auth when both user and pass are provided', () => {
    mockRuntimeConfig.mockReturnValue({
      email: {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        pass: 'SG.secret123',
        from: 'noreply@example.com'
      }
    })

    const transporter = getEmailTransporter()
    expect(transporter).toBeDefined()

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: 'SG.secret123'
      }
    })
  })

  it('does not attach auth if only user is provided without pass', () => {
    mockRuntimeConfig.mockReturnValue({
      email: {
        host: 'antispam.cs.vt.edu',
        port: 587,
        secure: false,
        user: 'edwards@cs.vt.edu',
        pass: '',
        from: 'edwards@cs.vt.edu'
      }
    })

    getEmailTransporter()

    const callArgs = vi.mocked(nodemailer.createTransport).mock.calls[0][0] as any
    expect(callArgs.auth).toBeUndefined()
  })

  it('throws an error if host is missing', () => {
    mockRuntimeConfig.mockReturnValue({
      email: {
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: 'noreply@example.com'
      }
    })

    expect(() => getEmailTransporter()).toThrow(/Missing required email configuration: host/)
  })

  it('reuses the singleton transporter across multiple invocations', () => {
    mockRuntimeConfig.mockReturnValue({
      email: {
        host: 'antispam.cs.vt.edu',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: 'egp-broker@cs.vt.edu'
      }
    })

    const t1 = getEmailTransporter()
    const t2 = getEmailTransporter()

    expect(t1).toBe(t2)
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1)
  })
})
