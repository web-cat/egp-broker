import prisma from '@@/lib/prisma'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { tool: true }
  })

  if (!assignment?.tool) return "Assignment configuration missing."

  // --- BRANCH 1: LTI 1.3 (OIDC Flow) ---
  if (assignment.tool.protocol === 'LTI13') {
    // For 1.3, we don't POST data immediately. 
    // We redirect to the tool's OIDC login initiation endpoint.
    const oidcParams = new URLSearchParams({
      iss: 'https://canvas.vt.edu', // Your platform identifier
      login_hint: 'user-id-from-session', 
      target_link_uri: assignment.tool.baseUrl,
      lti_message_hint: assignment.id,
      client_id: assignment.tool.clientId || '' 
    })

    return sendRedirect(event, `${assignment.tool.oidcUrl}?${oidcParams.toString()}`)
  }

  // --- BRANCH 2: LTI 1.1 (OAuth Signing Flow) ---
  if (assignment.tool.protocol === 'LTI11') {
    const launchUrl = assignment.tool.baseUrl
    const consumerKey = assignment.tool.consumerKey || 'test'
    const consumerSecret = assignment.tool.sharedSecret || 'secret'

    const ltiParams: Record<string, string> = {
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      resource_link_id: assignment.id,
      user_id: 'ilse_dev',
      roles: 'Learner',
      oauth_callback: 'about:blank',
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
      //grade passback point
      lis_outcome_service_url: `https://${event.node.req.headers.host}/api/lti11/gradebook`,
      lis_result_sourcedid: assignment.id, // Or a composite key: assignmentId:userId
    }

    // Sign the request
    const sortedKeys = Object.keys(ltiParams).sort()
    const baseStringData = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(ltiParams[k])}`)
      .join('&')
    const baseString = ['POST', encodeURIComponent(launchUrl), encodeURIComponent(baseStringData)].join('&')
    const signingKey = `${encodeURIComponent(consumerSecret)}&`
    ltiParams['oauth_signature'] = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

    const inputs = Object.entries(ltiParams)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
      .join('')

    return `<html><body onload="document.forms[0].submit()"><form method="POST" action="${launchUrl}">${inputs}</form></body></html>`
  }

  return "Unknown tool version: " + assignment.tool.version
})