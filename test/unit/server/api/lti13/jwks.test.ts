import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent } from 'h3'
import crypto from 'node:crypto'
import handler from '../../../../../server/api/lti13/jwks.get'

describe('LTI 1.3 JWKS Endpoint', () => {
  let originalEnv: NodeJS.ProcessEnv
  let testPrivateKeyPem: string
  let testPublicKeyPem: string

  beforeEach(() => {
    originalEnv = { ...process.env }
    delete process.env.NUXT_LTI_PRIVATE_KEY
    delete process.env.NUXT_LTI_PUBLIC_KEY
    delete process.env.NUXT_LTI_KEY_ID

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    testPrivateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    testPublicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('automatically derives public JWK from private key when public key is not configured', async () => {
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      ltiPrivateKey: testPrivateKeyPem,
      ltiPublicKey: undefined,
      ltiKeyId: 'test-key-derived'
    }) as any

    const req = { url: '/api/lti13/jwks' }
    const event = createEvent(req as any, {} as any)

    const response = await handler(event)

    expect(response).toBeDefined()
    expect(response.keys).toHaveLength(1)
    const key = response.keys[0]
    expect(key.kty).toBe('RSA')
    expect(key.alg).toBe('RS256')
    expect(key.use).toBe('sig')
    expect(key.kid).toBe('test-key-derived')
    expect(key.n).toBeDefined()
    expect(key.e).toBe('AQAB')
    // Crucially, private components must never be leaked
    expect((key as any).d).toBeUndefined()
    expect((key as any).p).toBeUndefined()
    expect((key as any).q).toBeUndefined()
  })

  it('handles private keys with escaped newlines', async () => {
    const escapedPrivateKey = testPrivateKeyPem.replace(/\n/g, '\\n')
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      ltiPrivateKey: escapedPrivateKey,
      ltiPublicKey: undefined,
      ltiKeyId: 'test-key-escaped'
    }) as any

    const req = { url: '/api/lti13/jwks' }
    const event = createEvent(req as any, {} as any)

    const response = await handler(event)

    expect(response.keys).toHaveLength(1)
    expect(response.keys[0].kid).toBe('test-key-escaped')
    expect(response.keys[0].kty).toBe('RSA')
  })

  it('uses explicitly configured public key when provided', async () => {
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      ltiPrivateKey: undefined,
      ltiPublicKey: testPublicKeyPem,
      ltiKeyId: 'test-key-explicit'
    }) as any

    const req = { url: '/api/lti13/jwks' }
    const event = createEvent(req as any, {} as any)

    const response = await handler(event)

    expect(response.keys).toHaveLength(1)
    expect(response.keys[0].kid).toBe('test-key-explicit')
    expect(response.keys[0].kty).toBe('RSA')
    expect(response.keys[0].e).toBe('AQAB')
  })

  it('throws 500 error when neither private nor public key is configured', async () => {
    global.useRuntimeConfig = vi.fn().mockReturnValue({
      ltiPrivateKey: undefined,
      ltiPublicKey: undefined,
      ltiKeyId: 'test-key-missing'
    }) as any

    const req = { url: '/api/lti13/jwks' }
    const event = createEvent(req as any, {} as any)

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'LTI key not configured'
    })
  })
})
