import { defineEventHandler, createError, readValidatedBody } from 'h3'
import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'
import { LtiLaunchSchema, LtiSessionUserSchema } from '@@/shared/schemas/auth.schema'
import { handleLtiLaunch } from '@@/server/utils/lti-launch'

export default defineEventHandler(async (event: H3Event) => {
  const { id_token: idToken, state } = await readValidatedBody(event, LtiLaunchSchema.parse)

  // Verify state matches the OIDC login initiation session
  const session = await getUserSession(event)
  if (!session.lti || !session.lti.issuer || session.lti.state !== state) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid state or session expired'
    })
  }

  const issuer = session.lti.issuer as string

  const platform = await prisma.ltiPlatform.findUnique({ where: { issuer } })
  if (!platform) {
    throw createError({ statusCode: 404, statusMessage: 'Platform not found' })
  }

  try {
    // Verify the LTI token and extract claims
    const claims = await verifyLtiToken(idToken, platform.jwksEndpoint, platform.clientId, issuer)

    if (claims.nonce !== session.lti.nonce) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid nonce' })
    }

    // Run the full DB transaction (deployment → user → course → assignment)
    const { user, assignmentId } = await handleLtiLaunch(prisma as never, { claims, platform })

    // Sync pass eligibility after the transaction commits (uses global prisma, not tx)
    if (assignmentId) {
      await syncAssignmentEligibility(assignmentId)
    }

    // Validate the user payload against our strict schema before injecting into session token
    const validatedUser = LtiSessionUserSchema.parse(user)

    // Establish the authenticated user session
    await setUserSession(event, {
      user: validatedUser,
      lti: {
        platformId: platform.id,
        issuer: platform.issuer,
        deploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
        context: claims['https://purl.imsglobal.org/spec/lti/claim/context'],
        resourceLink: claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']
      }
    })

    const targetUri = session.lti.targetLinkUri || '/'
    return sendRedirect(event, targetUri)
  } catch (error: any) {
    logger.error('LTI Launch Error:', { error })
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'LTI authentication failed'
    })
  }
})
