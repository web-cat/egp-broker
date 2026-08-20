import { defineEventHandler, createError, readBody, sendRedirect } from 'h3'
import prisma from '@@/lib/prisma'
import { LtiLaunchSchema } from '@@/shared/schemas/auth.schema'
import { handleLtiLaunch } from '@@/server/utils/lti-launch'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = LtiLaunchSchema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid LTI Launch' })
  }

  const { id_token: idToken, state } = result.data
  const session = await getUserSession(event)

  if (!session.lti || session.lti.state !== state) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid state' })
  }

  const issuer = session.lti.issuer as string
  const platform = await prisma.ltiPlatform.findUnique({ where: { issuer } })
  if (!platform) throw createError({ statusCode: 404, statusMessage: 'Platform not found' })

  try {
    const claims = await verifyLtiToken(idToken, platform.jwksEndpoint, platform.clientId, issuer)
    if (claims.nonce !== session.lti.nonce)
      throw createError({ statusCode: 403, statusMessage: 'Invalid nonce' })

    console.info('[LTI Launch] Verified claims:', {
      sub: claims.sub,
      email: claims.email,
      messageType: claims['https://purl.imsglobal.org/spec/lti/claim/message_type'],
      targetLinkUri: claims['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'],
      custom: claims['https://purl.imsglobal.org/spec/lti/claim/custom'],
      endpoint: claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']
    })

    // Use the logic that was working
    const { user, assignmentId, needsConfiguration, userRole, sourcedId } = await handleLtiLaunch(
      prisma as any,
      { claims, platform }
    )

    console.info('[LTI Launch] Launch handled result:', {
      userId: user.id,
      role: userRole,
      assignmentId,
      needsConfiguration
    })

    // Set the session
    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        currentCourseId: user.currentCourseId,
        role: userRole
      },
      lti: { ...session.lti, sourcedId }
    })

    // Routing
    if (!assignmentId) {
      console.info('[LTI Launch] No assignmentId -> Redirecting to dashboard /')
      return sendRedirect(event, '/', 303)
    }

    if (needsConfiguration) {
      const isStaff = ['TA', 'TEACHER', 'DESIGNER', 'ADMIN'].includes(userRole)
      const target = isStaff ? `/setup/${assignmentId}` : '/not-ready'
      console.info(`[LTI Launch] Assignment needs configuration -> Redirecting to ${target}`)
      return sendRedirect(event, target, 303)
    }

    console.info(`[LTI Launch] Assignment ready -> Redirecting to /launch/${assignmentId}`)
    return sendRedirect(event, `/launch/${assignmentId}`)
  } catch (error: any) {
    console.error('LTI Launch Error:', error)
    throw createError({ statusCode: 500, statusMessage: error.message || 'LTI failed' })
  }
})
