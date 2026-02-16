import { defineEventHandler, createError, readValidatedBody } from 'h3'
import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'
import { getGravatarUrl } from '@@/server/utils/gravatar'
import { LtiLaunchSchema } from '@@/shared/schemas/auth.schema'

export default defineEventHandler(async (event: H3Event) => {
  const { id_token: idToken, state } = await readValidatedBody(event, LtiLaunchSchema.parse)

  // Get session to verify state
  const session = await getUserSession(event)
  if (!session.lti || !session.lti.issuer || session.lti.state !== state) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid state or session expired'
    })
  }

  const issuer = session.lti.issuer as string

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
    const transactionResult = await prisma.$transaction(async (tx) => {
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
              emailVerifiedAt: new Date(),
              avatarUrl: getGravatarUrl(claims.email as string)
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
      const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']

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

        // 4. Upsert Assignment if resource_link is present
        if (resourceLink?.id) {
          const canvasAssignmentId = customClaims?.canvas_assignment_id?.toString()
          const title = resourceLink.title

          // Strategy:
          // 1. Try finding by resourceLinkId (standard LTI)
          // 2. Try finding by canvasAssignmentId (synced but never launched)
          // 3. Try finding by title where IDs are null (synced legacy fallback)

          let assignment = await tx.assignment.findUnique({
            where: {
              courseId_resourceLinkId: {
                courseId: course.id,
                resourceLinkId: resourceLink.id
              }
            }
          })

          if (!assignment && canvasAssignmentId) {
            assignment = await tx.assignment.findFirst({
              where: {
                courseId: course.id,
                canvasAssignmentId: canvasAssignmentId
              }
            })
          }

          if (!assignment && title) {
            assignment = await tx.assignment.findFirst({
              where: {
                courseId: course.id,
                title: title,
                resourceLinkId: null,
                canvasAssignmentId: null
              }
            })
          }

          if (assignment) {
            // Update existing
            await tx.assignment.update({
              where: { id: assignment.id },
              data: {
                resourceLinkId: resourceLink.id, // Ensure this is set
                canvasAssignmentId: canvasAssignmentId,
                title: title
              }
            })
          } else {
            // Create new
            await tx.assignment.create({
              data: {
                courseId: course.id,
                resourceLinkId: resourceLink.id,
                title: title,
                canvasAssignmentId: canvasAssignmentId
              }
            })
          }
        }

        // 5. Sync automatic pass eligibility
        if (resourceLink?.id) {
          // We need to get the internal ID of the assignment we just upserted/found
          const assignment = await tx.assignment.findUnique({
            where: {
              courseId_resourceLinkId: {
                courseId: course.id,
                resourceLinkId: resourceLink.id
              }
            },
            select: { id: true }
          })

          if (assignment) {
            // We can't await this inside the transaction if it uses a separate prisma client instance
            // or if we want it to run after the transaction commits.
            // However, syncAssignmentEligibility uses `prisma` global which is separate from `tx`.
            // To be safe and avoid locking issues, we should probably run this AFTER the transaction.
            // But we need to pass the ID out.
            // actually, let's just do it here, but we need to capture the ID.
            // Better yet, let's return the assignment ID from the transaction along with the user.
          }
        }

        // 5. Update user's current course context
        user = await tx.user.update({
          where: { id: user.id },
          data: { currentCourseId: course.id }
        })
      }

      // Check if we have a resource link to sync (internal ID lookup)
      let assignmentId: string | null = null
      if (resourceLink?.id && context?.id) {
        // We need the internal course ID which was created/found in step 3
        const course = await tx.course.findUnique({
          where: {
            deploymentId_ltiContextId: {
              deploymentId: deployment.id,
              ltiContextId: context.id
            }
          },
          select: { id: true }
        })

        if (course) {
          const a = await tx.assignment.findUnique({
            where: {
              courseId_resourceLinkId: {
                courseId: course.id,
                resourceLinkId: resourceLink.id
              }
            },
            select: { id: true }
          })
          assignmentId = a?.id ?? null
        }
      }

      return { user, assignmentId }
    })

    if (transactionResult.assignmentId) {
      await syncAssignmentEligibility(transactionResult.assignmentId)
    }

    // Clear LTI temporary state and set the actual user session
    await setUserSession(event, {
      user: {
        id: transactionResult.user.id,
        email: transactionResult.user.email,
        firstName: transactionResult.user.firstName,
        lastName: transactionResult.user.lastName,
        avatarUrl: transactionResult.user.avatarUrl,
        currentCourseId: transactionResult.user.currentCourseId
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
