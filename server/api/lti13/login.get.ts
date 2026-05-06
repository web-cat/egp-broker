import type { H3Event } from 'h3'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { getServerSiteUrl } from '../../utils/site'
import prisma from '@@/lib/prisma'
import { LtiLoginSchema } from '@@/shared/schemas/auth.schema'

export default defineEventHandler(async (event: H3Event) => {
  const query = await getValidatedQuery(event, LtiLoginSchema.parse)
  const iss = query.iss
  const loginHint = query.login_hint
  const targetLinkUri = query.target_link_uri
  const ltiMessageHint = query.lti_message_hint

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
  const siteUrl = getServerSiteUrl(event)
  const redirectUrl = createLtiLoginUrl(
    platform.authEndpoint,
    platform.clientId,
    `${siteUrl}/api/lti13/launch`,
    loginHint,
    ltiMessageHint ?? '',
    nonce,
    state
  )

  return sendRedirect(event, redirectUrl)
})
