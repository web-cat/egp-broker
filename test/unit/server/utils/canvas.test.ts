import { describe, it, expect } from 'vitest'
import { getPlatformCanvasDomain } from '@@/server/utils/canvas'

describe('getPlatformCanvasDomain', () => {
  it('extracts custom institution domain from endpoints when issuer is canvas.instructure.com and deploymentHost is a GUID', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: 'https://canvas.vt.edu/api/lti/authorize_redirect',
      tokenEndpoint: 'https://canvas.vt.edu/login/oauth2/token',
      jwksEndpoint: 'https://canvas.vt.edu/api/lti/security/jwks'
    }
    const deploymentHost = 'yDz0MxxBs02YM08vCb8fQ85ISbDXw62vLT6KiA6s:canvas-lms'

    const domain = getPlatformCanvasDomain(platform, deploymentHost)
    expect(domain).toBe('canvas.vt.edu')
  })

  it('prefers a clean deploymentHost if it is a valid hostname', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: 'https://canvas.vt.edu/api/lti/authorize_redirect',
      tokenEndpoint: 'https://canvas.vt.edu/login/oauth2/token',
      jwksEndpoint: 'https://canvas.vt.edu/api/lti/security/jwks'
    }
    const deploymentHost = 'custom-canvas.example.edu'

    const domain = getPlatformCanvasDomain(platform, deploymentHost)
    expect(domain).toBe('custom-canvas.example.edu')
  })

  it('resolves domain from authEndpoint if tokenEndpoint is missing', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: 'https://canvas.vt.edu/api/lti/authorize_redirect',
      tokenEndpoint: null,
      jwksEndpoint: null
    }

    const domain = getPlatformCanvasDomain(platform, null)
    expect(domain).toBe('canvas.vt.edu')
  })

  it('falls back to issuer if endpoints are absent or generic', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: null,
      tokenEndpoint: null,
      jwksEndpoint: null
    }

    const domain = getPlatformCanvasDomain(platform, null)
    expect(domain).toBe('canvas.instructure.com')
  })
})
