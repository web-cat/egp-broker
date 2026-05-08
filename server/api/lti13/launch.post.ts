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
    if (claims.nonce !== session.lti.nonce) throw createError({ statusCode: 403, statusMessage: 'Invalid nonce' })

    // Use the logic that was working
    const { user, assignmentId, needsConfiguration, userRole, sourcedId } = await handleLtiLaunch(
      prisma as any,
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
    if (needsConfiguration) {
      const isStaff = ['TA', 'TEACHER', 'DESIGNER', 'ADMIN'].includes(userRole)
      return isStaff 
        ? sendRedirect(event, `/setup/${assignmentId}`, 303)
        : sendRedirect(event, '/not-ready', 303)
    }

    return sendRedirect(event, `/launch/${assignmentId}`)

  } catch (error: any) {
    console.error('LTI Launch Error:', error)
    throw createError({ statusCode: 500, statusMessage: error.message || 'LTI failed' })
  }
})