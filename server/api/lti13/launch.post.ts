import { defineEventHandler, createError, readValidatedBody, sendRedirect } from 'h3'
import prisma from '@@/server/utils/db'
import { LtiLaunchSchema } from '@@/shared/schemas/auth.schema'
import { handleLtiLaunch } from '@@/server/utils/lti-launch'

export default defineEventHandler(async (event) => {
  const { id_token: idToken, state } = await readValidatedBody(event, LtiLaunchSchema.parse)
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

    // Execute launch logic
    const { user, assignmentId, needsConfiguration, userRole, sourcedId } = await handleLtiLaunch(
      prisma,
      { claims, platform }
    )

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
      return sendRedirect(event, '/', 303)
    }

    if (needsConfiguration) {
      const isStaff = ['TA', 'TEACHER', 'DESIGNER', 'ADMIN'].includes(userRole)
      return isStaff
        ? sendRedirect(event, `/setup/${assignmentId}`, 303)
        : sendRedirect(event, '/not-ready', 303)
    }

    return sendRedirect(event, `/launch/${assignmentId}`)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('LTI Launch Error:', error)
    const message = error instanceof Error ? error.message : 'LTI failed'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
