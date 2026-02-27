import { defineEventHandler, createError, readBody, parseCookies, sendRedirect } from 'h3'
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

      // A. Upsert Deployment
      const deployment = await tx.ltiDeployment.upsert({
        where: { platformId_deploymentId: { platformId: platform.id, deploymentId } },
        update: { deploymentHost: claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null },
        create: { platformId: platform.id, deploymentId, deploymentHost: claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null }
      })

      // B. Upsert Course (Defined in top scope of transaction to avoid "not defined" errors)
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

      const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles']
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: { role: parseCourseRole(roles) },
        create: { userId: user.id, courseId: course.id, role: parseCourseRole(roles) }
      })

      // E. Tool Identification (Look for tool_id in URL query string)
      const targetLinkUri = claims['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'] || ''
      const urlParams = new URL(targetLinkUri).searchParams
      const toolId = urlParams.get('tool_id') || customClaims.tool_id

      if (!toolId) throw new Error('No tool_id provided in launch URL or custom parameters')

      const tool = await tx.ltiTool.findUnique({ where: { id: toolId } })
      if (!tool) throw new Error(`Tool with ID "${toolId}" not found in Broker database`)

      // F. Upsert Assignment & Link Tool
      const assignment = await tx.assignment.upsert({
        where: { courseId_resourceLinkId: { courseId: course.id, resourceLinkId: resourceLink.id } },
        update: { 
            toolId: tool.id, 
            title: resourceLink.title,
            canvasAgsEndpoint: claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitem 
        },
        create: { 
            courseId: course.id, 
            resourceLinkId: resourceLink.id, 
            toolId: tool.id, 
            title: resourceLink.title,
            canvasAgsEndpoint: claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitem
        }
      })

      return { user, assignmentId: assignment.id, tool }
    })

    // 5. Finalize Session & Trigger LTI 1.1 Redirect
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const host = event.node.req.headers.host
    const { user, assignmentId, tool } = transactionResult

    await setUserSession(event, { 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        currentCourseId: user.currentCourseId
      }
    })

    // Sign the launch for the legacy LTI 1.1 tool (the test stub)
    const lti11Params = {
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      resource_link_id: claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'].id,
      user_id: user.id,
      roles: 'Learner', // Simplified for stub testing
      lis_person_name_full: `${user.firstName} ${user.lastName}`,
      lis_outcome_service_url: `${protocol}://${host}/api/proxy/grade-passback?assignmentId=${assignmentId}`
    }

    const signedData = signLti11(tool.baseUrl, 'POST', lti11Params, tool.key, tool.secret)

    // Render an auto-submitting HTML form to the tool's endpoint
    event.node.res.setHeader('Content-Type', 'text/html')
    return `
      <form action="${tool.baseUrl}" method="POST" id="lti_launch_form">
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