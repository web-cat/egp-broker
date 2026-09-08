import { defineEventHandler, createError, type H3Event } from 'h3'
import { exportJWK } from 'jose'
import crypto from 'node:crypto'

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)

  // Use explicit public key if provided, or derive public key from private key
  const rawPublicKey = (config.ltiPublicKey || process.env.NUXT_LTI_PUBLIC_KEY) as
    | string
    | undefined
  const rawPrivateKey = (config.ltiPrivateKey ||
    config.ltiPrivateKeyPem ||
    process.env.NUXT_LTI_PRIVATE_KEY) as string | undefined

  const publicKeyPem = rawPublicKey ? rawPublicKey.replace(/\\n/g, '\n') : undefined
  const privateKeyPem = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined

  const keyPem = publicKeyPem || privateKeyPem

  if (!keyPem) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LTI key not configured'
    })
  }

  try {
    // crypto.createPublicKey extracts the public key from either public or private PEM
    const pubKeyObj = crypto.createPublicKey(keyPem)
    const jwk = await exportJWK(pubKeyObj)

    return {
      keys: [
        {
          ...jwk,
          kid: config.ltiKeyId || process.env.NUXT_LTI_KEY_ID || 'lti-key-1',
          use: 'sig',
          alg: 'RS256'
        }
      ]
    }
  } catch (error: unknown) {
    console.error('Failed to export JWK:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate JWKS'
    })
  }
})
