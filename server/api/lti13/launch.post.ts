import { defineEventHandler, createError, readBody, sendRedirect } from 'h3'
import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'
import { LtiLaunchSchema, LtiSessionUserSchema } from '@@/shared/schemas/auth.schema'
import { handleLtiLaunch } from '@@/server/utils/lti-launch'

export default defineEventHandler(async (event: H3Event) => {
  // 1. Validate the LTI 1.3 Launch Body
  const body = await readBody(event)
  const result = LtiLaunchSchema.safeParse(body)
  
  const { id_token: idToken, state } = result.data

  // Verify state matches the OIDC login initiation session
  const session = await getUserSession(event)
  if (!session.lti || !session.lti.issuer || session.lti.state !== state) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid LTI Launch: Missing id_token or state'
    })
  }

  const issuer = session.lti.issuer as string
  const platform = await prisma.ltiPlatform.findUnique({ where: { issuer } })
  if (!platform) {
    throw createError({ statusCode: 404, statusMessage: 'Platform not found' })
  }

  // 3. Verify LTI Token & Claims
    const claims = await verifyLtiToken(idToken, platform.jwksEndpoint, platform.clientId, issuer)
    if (claims.nonce !== session.lti.nonce) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid nonce' })
    }

    // 4. Run Transaction via Utility (Logic from your branch should be inside handleLtiLaunch)
    const { 
      user, 
      assignmentId, 
      needsConfiguration, 
      userRole, 
      sourcedId 
    } = await handleLtiLaunch(prisma as any, { claims, platform })

    // Optional: Sync from main branch
    if (assignmentId) {
      await syncAssignmentEligibility(assignmentId)
    }

    // 5. Establish Session
    const validatedUser = LtiSessionUserSchema.parse({
      ...user,
      role: userRole
    })

    await setUserSession(event, {
      user: validatedUser,
      lti: { 
        ...session.lti, 
        sourcedId,
        deploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      }
    })

    // 6. Flow Control: Setup vs Launch (Your branch logic)
    if (needsConfiguration) {
      const isStaff = ['TA', 'TEACHER', 'DESIGNER', 'ADMIN'].includes(userRole)
      return isStaff 
        ? sendRedirect(event, `/setup/${assignmentId}`, 303)
        : sendRedirect(event, '/not-ready', 303)
    }

    return sendRedirect(event, `/launch/${assignmentId}`)

  } catch (error: any) {
    console.error('LTI Launch Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'LTI authentication failed'
    })
  }
})
