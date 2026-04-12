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
    
    // 4. Run Database Transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
      const context = claims['https://purl.imsglobal.org/spec/lti/claim/context']
      const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']
      const customClaims = claims['https://purl.imsglobal.org/spec/lti/claim/custom'] || {}
      const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || []

      // A. Upsert Deployment
      const deployment = await tx.ltiDeployment.upsert({
        where: { platformId_deploymentId: { platformId: platform.id, deploymentId } },
        update: { deploymentHost: claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null },
        create: { platformId: platform.id, deploymentId, deploymentHost: claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null }
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
        return { user, needsConfiguration: true, assignmentId: assignment.id, role: userRole }
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

      return { user, assignmentId: assignment.id, tool, needsConfiguration: false }
    })

    // 5. Flow Control: Setup vs Launch
    const { user, assignmentId, tool, needsConfiguration, role } = transactionResult

    await setUserSession(event, { 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        currentCourseId: user.currentCourseId
      }
    })

    //check that the assignment is configured
    if (needsConfiguration) {
      // Add a log here to be 100% sure what the variable 'role' contains at this exact moment
      console.log('Final check - Role:', role, 'Needs Config:', needsConfiguration)

      const isStaff = ['TEACHER', 'TA', 'DESIGNER', 'ADMIN'].includes(role)

      if (isStaff) {
        // Redirect the teacher to the setup page
        return sendRedirect(event, `/setup/${assignmentId}`, 303)
        //return sendRedirect(event, `/test`, 303)
      } else {
        // If it's a student, show the error
        throw createError({ 
          statusCode: 412, 
          statusMessage: 'This assignment has not been set up by an instructor.' 
        })
      }
    } else {
      // If linked, send them to the universal launch wrapper
      return sendRedirect(event, `/launch/${assignmentId}`)
    }

    // 6. Finalize LTI 1.1 Redirect (The "Proxy" Launch)
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = event.node.req.headers.host

    const lti11Params = {
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      resource_link_id: claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'].id,
      user_id: user.id,
      roles: role,
      lis_person_name_full: `${user.firstName} ${user.lastName}`,
      lis_outcome_service_url: `${protocol}://${host}/api/proxy/grade-passback?assignmentId=${assignmentId}`
    }

    const signedData = signLti11(tool!.baseUrl, 'POST', lti11Params, tool!.key, tool!.secret)

    event.node.res.setHeader('Content-Type', 'text/html')
    return `
      <form action="${tool!.baseUrl}" method="POST" id="lti_launch_form">
        ${Object.entries(signedData).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join('')}
      </form>
      <script>document.getElementById('lti_launch_form').submit();</script>
    `

  } catch (error: any) {
    console.error('LTI Launch Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'LTI authentication failed'
    })
  }
})