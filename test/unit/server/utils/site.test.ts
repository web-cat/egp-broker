import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent } from 'h3'
import { getServerSiteUrl } from '../../../../server/utils/site'

describe('getServerSiteUrl', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv }
    delete process.env.NUXT_SITE_URL

    // Mock global Nuxt/Nitro functions
    global.useRuntimeConfig = vi.fn() as any
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    // @ts-expect-error: expected error
    delete global.useRuntimeConfig
  })

  it('should return URL from runtimeConfig if available', () => {
    vi.mocked(global.useRuntimeConfig).mockReturnValue({
      public: { siteUrl: 'https://config.example.com' }
    } as any)

    const event = createEvent({ headers: {} } as any)
    const url = getServerSiteUrl(event)

    expect(url).toBe('https://config.example.com')
  })

  it('should trim trailing slash from runtimeConfig URL', () => {
    vi.mocked(global.useRuntimeConfig).mockReturnValue({
      public: { siteUrl: 'https://config.example.com/' }
    } as any)

    const event = createEvent({ headers: {} } as any)
    const url = getServerSiteUrl(event)

    expect(url).toBe('https://config.example.com')
  })

  it('should fallback to process.env.NUXT_SITE_URL', () => {
    vi.mocked(global.useRuntimeConfig).mockReturnValue({ public: { siteUrl: '' } } as any)
    process.env.NUXT_SITE_URL = 'https://env.example.com/'

    const event = createEvent({ headers: {} } as any)
    const url = getServerSiteUrl(event)

    expect(url).toBe('https://env.example.com')
  })

  it('should fallback to host header if no config/env provided', () => {
    vi.mocked(global.useRuntimeConfig).mockReturnValue({ public: { siteUrl: '' } } as any)

    const event = createEvent({
      headers: { host: 'myhost.com' }
    } as any)
    const url = getServerSiteUrl(event)

    expect(url).toBe('https://myhost.com')
  })

  it('should use http for localhost', () => {
    vi.mocked(global.useRuntimeConfig).mockReturnValue({ public: { siteUrl: '' } } as any)

    const event = createEvent({
      headers: { host: 'localhost:3000' }
    } as any)
    const url = getServerSiteUrl(event)

    expect(url).toBe('http://localhost:3000')
  })

  it('should provide a final fallback to localhost:3000', () => {
    vi.mocked(global.useRuntimeConfig).mockReturnValue({ public: { siteUrl: '' } } as any)

    const event = createEvent({ headers: {} } as any)
    const url = getServerSiteUrl(event)

    expect(url).toBe('http://localhost:3000')
  })
})
