import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'

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
    const firstName = claims.given_name || claims.name?.split(' ')[0] || 'LTI'
    const lastName = claims.family_name || claims.name?.split(' ').slice(1).join(' ') || 'User'

    // Find or create user and identity, then upsert course and enrollment
    const ltiUser = await prisma.$transaction(async (tx) => {
      const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
      const deploymentHost =
        claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null

      // 1. Upsert deployment to store deploymentHost and get its ID
      const deployment = await tx.ltiDeployment.upsert({
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

      // 2. Find or create user and identity
      let user
      const existingIdentity = await tx.ltiIdentity.findUnique({
        where: {
          platformId_ltiSub: {
            platformId: platform.id,
            ltiSub: sub
          }
        },
        include: { user: true }
      })

      if (existingIdentity) {
        user = existingIdentity.user
      } else {
        // Find user by email or create new
        if (email) {
          user = await tx.user.findUnique({ where: { email } })
        }

        if (!user) {
          user = await tx.user.create({
            data: {
              email: claims.email as string,
              firstName,
              lastName,
              emailVerified: true,
              emailVerifiedAt: new Date()
            }
          })
        }

        const platformUserId =
          String(claims['https://canvas.instructure.com/lti/legacy_user_id'] || '') || null

        // Create LTI identity linked to user and deployment
        await tx.ltiIdentity.create({
          data: {
            userId: user.id,
            platformId: platform.id,
            ltiSub: sub,
            platformUserId,
            deploymentId
          }
        })
      }

      // 3. Upsert Course and Enrollment if context is present (for all users)
      const context = claims['https://purl.imsglobal.org/spec/lti/claim/context']
      if (context?.id) {
        const customClaims = claims['https://purl.imsglobal.org/spec/lti/claim/custom']

        const course = await tx.course.upsert({
          where: {
            deploymentId_ltiContextId: {
              deploymentId: deployment.id,
              ltiContextId: context.id
            }
          },
          update: {
            label: context.label,
            title: context.title,
            canvasCourseId: customClaims?.canvas_course_id?.toString(),
            workflowState: customClaims?.canvas_course_workflow_state
          },
          create: {
            deploymentId: deployment.id,
            ltiContextId: context.id,
            label: context.label,
            title: context.title,
            canvasCourseId: customClaims?.canvas_course_id?.toString(),
            workflowState: customClaims?.canvas_course_workflow_state
          }
        })

        // Parse user role from LTI roles claim
        const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles']
        const courseRole = parseCourseRole(roles)

        await tx.enrollment.upsert({
          where: {
            userId_courseId: {
              userId: user.id,
              courseId: course.id
            }
          },
          update: { role: courseRole },
          create: {
            userId: user.id,
            courseId: course.id,
            role: courseRole
          }
        })
      }

      return user
    })

    // Clear LTI temporary state and set the actual user session
    await setUserSession(event, {
      user: {
        id: ltiUser.id,
        email: ltiUser.email,
        firstName: ltiUser.firstName,
        lastName: ltiUser.lastName
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
