import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent } from 'h3'
import handler from '../../../../../server/api/lti13/config.get'

describe('LTI 1.3 Config Endpoint', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original env
    originalEnv = process.env
    // Clear the env var we're testing
    delete process.env.NUXT_SITE_URL
  })

  afterEach(() => {
    // Restore original env
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('should generate correct JSON using NUXT_SITE_URL', async () => {
    process.env.NUXT_SITE_URL = 'https://broker.example.com'

    const req = {
      headers: { host: 'localhost:3000' },
      url: '/api/lti13/config'
    }
    const res = { setHeader: vi.fn() }
    const event = createEvent(req as any, res as any)

    const response = await handler(event)

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(response).toMatchObject({
      title: 'EGP Broker',
      oidc_initiation_url: 'https://broker.example.com/api/lti13/login',
      target_link_uri: 'https://broker.example.com/api/lti13/launch',
      public_jwk_url: 'https://broker.example.com/api/lti13/jwks'
    })
    expect(response.extensions[0].domain).toBe('broker.example.com')
    expect(response.extensions[0].settings.placements).toContainEqual({
      text: 'Link Selection via EGP Broker',
      placement: 'link_selection',
      message_type: 'LtiDeepLinkingRequest',
      target_link_uri: 'https://broker.example.com/api/lti13/launch'
    })
  })

  it('should generate correct JSON fallback using request host', async () => {
    const req = {
      headers: { host: 'testhost.local:3000' },
      url: '/api/lti13/config'
    }
    const res = { setHeader: vi.fn() }
    const event = createEvent(req as any, res as any)

    const response = await handler(event)

    expect(response.oidc_initiation_url).toBe('https://testhost.local:3000/api/lti13/login')
    expect(response.target_link_uri).toBe('https://testhost.local:3000/api/lti13/launch')
    expect(response.extensions[0].domain).toBe('testhost.local:3000')
  })
})
