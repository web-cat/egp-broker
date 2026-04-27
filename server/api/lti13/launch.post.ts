import { defineEventHandler, createError, readBody, sendRedirect } from 'h3'
import type { H3Event } from 'h3'
import prisma from '@@/lib/prisma'
import { getGravatarUrl } from '@@/server/utils/gravatar'
import { LtiLaunchSchema } from '@@/shared/schemas/auth.schema'

export default defineEventHandler(async (event: H3Event) => {
  // 1. Validate the LTI 1.3 Launch Body
  const body = await readBody(event)
  const result = LtiLaunchSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({ 
      statusCode: 400, 
      statusMessage: 'Invalid LTI Launch: Missing id_token or state' 
    })
  }

  const { id_token: idToken, state } = result.data

  // 2. Verify Session State
  const session = await getUserSession(event)
  if (!session.lti || session.lti.state !== state) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid state or session expired' })
  }

  const issuer = session.lti.issuer as string
  const platform = await prisma.ltiPlatform.findUnique({ where: { issuer } })
  if (!platform) throw createError({ statusCode: 404, statusMessage: 'Platform not found' })

  try {
    // 3. Verify LTI Token & Claims
    const claims = await verifyLtiToken(idToken, platform.jwksEndpoint, platform.clientId, issuer)
    if (claims.nonce !== session.lti.nonce) throw createError({ statusCode: 403, statusMessage: 'Invalid nonce' })

    const sub = claims.sub
    const email = claims.email

    console.log(claims['https://purl.imsglobal.org/spec/lti/claim/roles'])
    
    // 4. Run Database Transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
      const context = claims['https://purl.imsglobal.org/spec/lti/claim/context']
      const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']
      const customClaims = claims['https://purl.imsglobal.org/spec/lti/claim/custom'] || {}
      const platformClaims = claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform'] || {}
      const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || []

      // A. Upsert Deployment
      const deployment = await tx.ltiDeployment.upsert({
        where: { platformId_deploymentId: { platformId: platform.id, deploymentId } },
        update: { deploymentHost: platformClaims?.guid || null },
        create: { platformId: platform.id, deploymentId, deploymentHost: platformClaims?.guid || null }
      })

      // B. Upsert Course
      const course = await tx.course.upsert({
        where: { deploymentId_ltiContextId: { deploymentId: deployment.id, ltiContextId: context.id } },
        update: { 
            label: context.label, 
            title: context.title, 
            canvasCourseId: customClaims.canvas_course_id?.toString() 
        },
        create: { 
            deploymentId: deployment.id, 
            ltiContextId: context.id, 
            label: context.label, 
            title: context.title, 
            canvasCourseId: customClaims.canvas_course_id?.toString() 
        }
      })

      // C. Find or Create User
      let user = await tx.user.findFirst({
        where: { ltiIdentities: { some: { platformId: platform.id, ltiSub: sub } } }
      })

      if (!user && email) {
        user = await tx.user.upsert({
          where: { email },
          update: { currentCourseId: course.id },
          create: {
            email,
            firstName: claims.given_name || claims.name?.split(' ')[0] || 'LTI',
            lastName: claims.family_name || 'User',
            avatarUrl: getGravatarUrl(email),
            currentCourseId: course.id
          }
        })
      }

      if (!user) throw new Error("Could not find or create user context")

      // D. Identity and Enrollment
      await tx.ltiIdentity.upsert({
        where: { platformId_ltiSub: { platformId: platform.id, ltiSub: sub } },
        update: { deploymentId },
        create: { userId: user.id, platformId: platform.id, ltiSub: sub, deploymentId }
      })

      const userRole = parseCourseRole(roles)
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: { role: userRole },
        create: { userId: user.id, courseId: course.id, role: userRole }
      })

      // E. Dynamic Tool Identification Logic
      // 1. Check for existing assignment mapping
      let assignment = await tx.assignment.findUnique({
        where: { courseId_resourceLinkId: { courseId: course.id, resourceLinkId: resourceLink.id } },
        include: { tool: true }
      })

      // 2. If assignment doesn't exist, create the shell
      if (!assignment) {
        assignment = await tx.assignment.create({
          data: {
            courseId: course.id,
            resourceLinkId: resourceLink.id,
            title: resourceLink.title,
            canvasAgsEndpoint: claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitem
          },
          include: { tool: true }
        })
      }

      // 3. Determine if we have a tool to launch
      // Check order: URL Param > Custom Field > Saved DB Mapping
      const targetLinkUri = claims['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'] || ''
      const urlToolId = new URL(targetLinkUri).searchParams.get('tool_id')
      const effectiveToolId = urlToolId || customClaims.tool_id || assignment.toolId

      if (!effectiveToolId) {
        return { user, needsConfiguration: true, assignmentId: assignment.id, userRole }
      }

      const tool = await tx.ltiTool.findUnique({ where: { id: effectiveToolId } })
      if (!tool) throw new Error(`Tool with ID "${effectiveToolId}" not found`)

      // Update assignment with the tool if it was a new discovery
      if (assignment.toolId !== tool.id) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { toolId: tool.id }
        })
      }

      return { user, assignmentId: assignment.id, tool, needsConfiguration: false, userRole}
    })

    // 5. Flow Control: Setup vs Launch
    const { user, assignmentId, tool, needsConfiguration, custom, userRole } = transactionResult

    await setUserSession(event, { 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        currentCourseId: user.currentCourseId,
        role: userRole,
      }
    })

    //check that the assignment is configured
    if (needsConfiguration) {
      // Add a log here to be 100% sure what the variable 'role' contains at this exact moment
      console.log('Final check - Role:', userRole, 'Needs Config:', needsConfiguration)

      //lti 1.3 roles
      const isStaff = ['TA', 'TEACHER', 'DESIGNER', 'ADMIN'].includes(userRole)

      if (isStaff) {
        // Redirect the teacher to the setup page
        return sendRedirect(event, `/setup/${assignmentId}`, 303)
      } else {
        //redirect to a friendly "Not Ready" page
        return sendRedirect(event, `/not-ready`, 303)
      }
    } else {
      // If linked, send them to the universal launch wrapper
      return sendRedirect(event, `/launch/${assignmentId}`)
    }

  } catch (error: any) {
    console.error('LTI Launch Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'LTI authentication failed'
    })
  }
})