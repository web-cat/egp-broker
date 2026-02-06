import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'
import { logger } from '~/server/utils/logger.helpers'

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event)
  const idToken = body.id_token
  const state = body.state

  if (!idToken || !state) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing id_token or state'
    })
  }

  // Get session to verify state
  const session = await getUserSession(event)
  if (!session.lti || session.lti.state !== state) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid state or session expired'
    })
  }

  const { issuer } = session.lti

  // Find the platform to get clientId and jwksUrl
  const platform = await prisma.ltiPlatform.findUnique({
    where: { issuer }
  })

  if (!platform) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Platform not found'
    })
  }

  try {
    // Verify the LTI token
    const claims = await verifyLtiToken(idToken, platform.jwksEndpoint, platform.clientId, issuer)

    // Check nonce
    if (claims.nonce !== session.lti.nonce) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid nonce'
      })
    }

    const sub = claims.sub
    const email = claims.email
    const name = claims.name || claims.given_name || 'LTI User'

    // Find or create user and identity
    const ltiUser = await prisma.$transaction(async (tx) => {
      // 1. Find existing identity
      const identity = await tx.ltiIdentity.findUnique({
        where: {
          platformId_ltiSub: {
            platformId: platform.id,
            ltiSub: sub
          }
        },
        include: { user: true }
      })

      if (identity) {
        return identity.user
      }

      // 2. If no identity, find user by email or create new
      let user = null
      if (email) {
        user = await tx.user.findUnique({ where: { email } })
      }

      if (!user) {
        user = await tx.user.create({
          data: {
            email: email || `${sub}@lti.${platform.issuer.replace(/https?:\/\//, '')}`,
            name,
            emailVerified: true,
            emailVerifiedAt: new Date()
          }
        })
      }

      const platformUserId = String(claims['https://canvas.instructure.com/lti/legacy_user_id'] || '') || null
      const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
      const deploymentHost = claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null

      // 3. Upsert deployment to store deploymentHost
      await tx.ltiDeployment.upsert({
        where: {
          platformId_deploymentId: {
            platformId: platform.id,
            deploymentId
          }
        },
        update: { deploymentHost },
        create: {
          platformId: platform.id,
          deploymentId,
          deploymentHost
        }
      })

      // 4. Create LTI identity linked to user and deployment
      await tx.ltiIdentity.create({
        data: {
          userId: user.id,
          platformId: platform.id,
          ltiSub: sub,
          platformUserId,
          deploymentId
        }
      })

      return user
    })

    // Clear LTI temporary state and set the actual user session
    await setUserSession(event, {
      user: {
        id: ltiUser.id,
        email: ltiUser.email,
        name: ltiUser.name
      },
      // Pass along LTI context if needed
      lti: {
        platformId: platform.id,
        issuer: platform.issuer,
        deploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
        context: claims['https://purl.imsglobal.org/spec/lti/claim/context'],
        resourceLink: claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']
      }
    })

    // Redirect to the target link URI (or home)
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
