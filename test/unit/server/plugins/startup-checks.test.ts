import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock useRuntimeConfig (Nuxt auto-import available globally in server context)
const mockRuntimeConfig = vi.fn()
vi.stubGlobal('useRuntimeConfig', mockRuntimeConfig)

describe('startup-checks plugin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not log errors in non-production environments', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const spy = vi.spyOn(console, 'error')

    const { default: plugin } = await import('@@/server/plugins/startup-checks')
    plugin({})

    expect(spy).not.toHaveBeenCalled()
    process.env.NODE_ENV = originalEnv
  })

  it('logs an error in production when email config keys are empty', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    mockRuntimeConfig.mockReturnValue({
      email: { host: '', user: '', pass: '', from: '', port: 587, secure: false }
    })

    const spy = vi.spyOn(console, 'error')

    const { default: plugin } = await import('@@/server/plugins/startup-checks')
    plugin({})

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('NUXT_EMAIL_HOST'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('NUXT_EMAIL_USER'))

    process.env.NODE_ENV = originalEnv
  })

  it('does NOT log errors when all required email fields are present', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    mockRuntimeConfig.mockReturnValue({
      email: {
        host: 'smtp.example.com',
        user: 'noreply@example.com',
        pass: 'secret',
        from: 'noreply@example.com',
        port: 587,
        secure: false
      }
    })

    const spy = vi.spyOn(console, 'error')

    const { default: plugin } = await import('@@/server/plugins/startup-checks')
    plugin({})

    expect(spy).not.toHaveBeenCalled()

    process.env.NODE_ENV = originalEnv
  })
})
