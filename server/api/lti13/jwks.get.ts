import type { H3Event } from 'h3'
import { exportJWK, importPKCS8 } from 'jose'
import { logger } from '~/server/utils/logger.helpers'

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)
  const privateKeyPem = config.ltiPrivateKey

  if (!privateKeyPem) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LTI private key not configured'
    })
  }

  // Convert PKCS8 private key to a JWK
  // Note: In a real app, you might want to cache the public JWK
  try {
    const privateKey = await importPKCS8(privateKeyPem, 'RS256')
    const jwk = await exportJWK(privateKey)

    return {
      keys: [
        {
          ...jwk,
          kid: config.ltiKeyId || 'lti-key-1',
          use: 'sig',
          alg: 'RS256'
        }
      ]
    }
  } catch (error: any) {
    logger.error('Failed to export JWK:', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate JWKS'
    })
  }
})
