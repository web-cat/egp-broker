import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event: H3Event) => {
  const query = getQuery(event)
  const iss = query.iss as string
  const loginHint = query.login_hint as string
  const targetLinkUri = query.target_link_uri as string
  const ltiMessageHint = query.lti_message_hint as string

  if (!iss || !loginHint || !targetLinkUri) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required OIDC parameters'
    })
  }

  // Find the platform registration
  const platform = await prisma.ltiPlatform.findUnique({
    where: { issuer: iss }
  })

  if (!platform) {
    throw createError({
      statusCode: 404,
      statusMessage: `Platform for issuer ${iss} not registered`
    })
  }

  // Generate state and nonce
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()

  // Store state in session for validation during launch
  // We use a dedicated cookie or session key for this
  await setUserSession(event, {
    lti: {
      state,
      nonce,
      issuer: iss,
      targetLinkUri
    }
  })

  // Construct the redirect URL to the platform's auth endpoint
  const redirectUrl = createLtiLoginUrl(
    platform.authEndpoint,
    platform.clientId,
    `${process.env.NUXT_SITE_URL}/api/lti13/launch`,
    loginHint,
    ltiMessageHint,
    nonce,
    state
  )

  return sendRedirect(event, redirectUrl)
})
