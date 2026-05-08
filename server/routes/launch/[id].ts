import prisma from '@@/lib/prisma'
import crypto from 'crypto'
//import { decodeJwt } from 'jose'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const session = await getUserSession(event)

    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired.' })
    }

    // 1. Fetch assignment context AND the specific LtiResult for this user
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        tool: true,
        course: true,
        // Fetch the result record that was created/updated during launch.post.ts
        ltiResults: {
          where: {
            userId: session.user.id,
            assignmentId: id
          }
        }
      }
    })

    if (!assignment?.tool) return 'Assignment configuration missing.'

    // 2. Identify the ltiResult for grade passback
    const ltiResult = assignment.ltiResults[0]
    if (!ltiResult) {
      throw createError({
        statusCode: 404,
        statusMessage: 'LTI result context not found. Please relaunch.'
      })
    }

    const oauthEncode = (str: string) => {
      return encodeURIComponent(str)
        .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
        .replace(/%20/g, '%20') // Use %20 for spaces, NOT +
    }

    const assignmentid =
      assignment.canvasAssignmentId ||
      ltiResult.lisOutcomeServiceUrl?.split('/').pop() ||
      ''

    // 3. Prepare LTI 1.1 Params
    const ltiParams: Record<string, string> = {
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',

      //Resource and Context
      resource_link_id: assignment.resourceLinkId,
      resource_link_title: assignment.title,
      context_id: assignment.course.ltiContextId,
      context_label: assignment.course.label,
      context_title: assignment.course.title,

      //User Info
      user_id: session.user.id,
      lis_person_name_full: `${session.user.firstName} ${session.user.lastName}`,
      lis_person_name_given: session.user.firstName,
      lis_person_name_family: session.user.lastName,
      lis_person_contact_email_primary: session.user.email,
      //generate unique sourcedid
      lis_person_sourcedid: Buffer.from(`${assignment.id}:${session.user.id}`).toString('base64'),
      //map role to lti 1.1
      roles:
        session.user.role === 'TEACHER' ||
        session.user.role === 'TA' ||
        session.user.role === 'ADMIN'
          ? 'Instructor'
          : 'Learner',

      //ext_roles: 'urn:lti:instrole:ims/lis/Administrator,urn:lti:instrole:ims/lis/Instructor,urn:lti:instrole:ims/lis/Student,urn:lti:role:ims/lis/Learner,urn:lti:sysrole:ims/lis/User',

      ext_lti_assignment_id: assignment.id, //uniqueness check

      //canvas custom - needs to be general for any lms
      custom_canvas_api_domain: 'canvas.endeavour.cs.vt.edu',
      custom_canvas_assignment_id: assignmentid,
      custom_canvas_course_id: assignment.course.canvasCourseId || '',
      custom_canvas_user_id: session.user.id || '',
      custom_canvas_user_login_id: session.user.email,

      //grade passback overwrite
      lis_outcome_service_url: `https://${event.node.req.headers.host}/api/proxy/grade-passback/lti11?assignmentId=${assignmentid}`,
      lis_result_sourcedid: ltiResult.id,
      ext_outcome_data_values_accepted: 'url,text',
      ext_outcome_result_total_score_accepted: 'true',

      //launch presentation information for the LMS
      launch_presentation_document_target: 'iframe',
      launch_presentation_locale: 'en',
      launch_presentation_return_url: `https://canvas.endeavour.cs.vt.edu/courses/${assignment.course.canvasCourseId}/assignments`,

      //tool information
      tool_consumer_info_product_family_code: 'canvas', //'EGP-Broker',
      tool_consumer_info_version: 'cloud', //'1.0',
      tool_consumer_instance_guid: 'egp-broker-instance-01',
      tool_consumer_instance_name: 'EGP Middleware Broker',

      oauth_callback: 'about:blank',
      oauth_consumer_key: assignment.tool.key,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    }

    //console.log('ltiParams: ', ltiParams)

    // 5. Generate OAuth Signature
    // LTI 1.1 requires alphabetical sorting for the base string
    const sortedParams = Object.keys(ltiParams)
      .sort()
      .map((key) => `${oauthEncode(key)}=${oauthEncode(ltiParams[key])}`)
      .join('&')

    const launchUrl = assignment.tool.baseUrl

    // console.log('--- DEBUG LAUNCH PARAMS ---')
    // console.log('Assignment ID:', assignment.id)
    // console.log('Resource Link ID (Passed to Tool):', ltiParams.resource_link_id)
    // console.log('Target URL:', launchUrl)

    const baseString = ['POST', oauthEncode(launchUrl), oauthEncode(sortedParams)].join('&')
    const signingKey = `${oauthEncode(assignment.tool.secret)}&`
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

    ltiParams['oauth_signature'] = signature

    // 6. Generate the Auto-submit form
    const inputs = Object.entries(ltiParams)
      .map(
        ([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`
      )
      .join('\n      ')

    // Example: verify variables exist before returning
    // console.log(`Attempting launch for Assignment: ${id} to URL: ${launchUrl}`)
    // console.log('FINAL SORTED PARAM STRING:', sortedParams)
    // console.log('SIGNATURE:', signature)

    //return { status: 'success', signature: signature }
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Launching...</title></head>
        <body onload="document.forms[0].submit()">
          <form method="POST" action="${launchUrl}">
            ${inputs}
          </form>
        </body>
      </html>
    `

    return send(event, html, 'text/html')
  } catch (err: any) {
    // THIS IS THE KEY: Log the full error to your terminal
    console.error('--- DETAILED LAUNCH ERROR ---')
    console.error('Message:', err.message)
    console.error('Stack:', err.stack)
    console.error('-----------------------------')

    throw createError({
      statusCode: 500,
      statusMessage: `Internal Crash: ${err.message}`
    })
  }
})
