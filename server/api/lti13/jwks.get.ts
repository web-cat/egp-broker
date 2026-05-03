import type { H3Event } from 'h3'
import { exportJWK, importSPKI } from 'jose' // Use importSPKI for Public Keys

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)
  // Use your Public Key for the JWKS endpoint
  const publicKeyPem = config.ltiPublicKey

  if (!publicKeyPem) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LTI public key not configured'
    })
  }

  try {
    // 1. Fix: Add { extractable: true }
    // 2. Fix: Use importSPKI to ensure we are exporting a Public Key
    const publicKey = await importSPKI(publicKeyPem, 'RS256', { extractable: true })
    const jwk = await exportJWK(publicKey)

    return {
      keys: [
        {
          ...jwk,
          kid: config.ltiKeyId, // Must match the KID in your SJWT header
          use: 'sig',
          alg: 'RS256'
        }
      ]
    }
  } catch (error: any) {
    // Ensure logger is available or use console
    console.error('Failed to export JWK:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate JWKS'
    })
  }
})
