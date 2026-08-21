import { sendRedirect } from 'h3'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { CourseRole } from '@prisma/client'
import prisma from '@@/server/utils/db'

// LTI 1.3 Role URIs mapped to CourseRole enum
const LTI_ROLE_MAPPINGS: { pattern: string; role: CourseRole }[] = [
  { pattern: 'membership/Instructor#TeachingAssistant', role: CourseRole.TA },
  { pattern: 'membership#Instructor', role: CourseRole.TEACHER },
  { pattern: 'membership#Learner', role: CourseRole.STUDENT },
  { pattern: 'membership#Mentor', role: CourseRole.OBSERVER },
  { pattern: 'membership#ContentDeveloper', role: CourseRole.DESIGNER },
  { pattern: 'institution/person#Administrator', role: CourseRole.ADMIN }
]

/**
 * Parses LTI 1.3 role URIs and returns the most appropriate CourseRole.
 * Priority: TA > Teacher > Designer > Observer > Admin > Student (default)
 */
export function parseCourseRole(roles?: string[]): CourseRole {
  if (!roles || roles.length === 0) {
    return CourseRole.STUDENT
  }

  // Check each mapping in priority order
  for (const mapping of LTI_ROLE_MAPPINGS) {
    if (roles.some((role) => role.includes(mapping.pattern))) {
      return mapping.role
    }
  }

  return CourseRole.STUDENT
}

/**
 * Shared logic to initiate the OIDC flow.
 * This handles the database lookup and session storage before redirecting to Canvas.
 */
export async function initiateOidcRedirect(
  event: any,
  params: {
    iss: string
    loginHint: string
    targetLinkUri: string
    ltiMessageHint?: string
  }
) {
  const platform = await prisma.ltiPlatform.findUnique({
    where: { issuer: params.iss }
  })

  if (!platform) {
    const session = await getUserSession(event)
    const isAdmin = session?.user?.globalRole === 'ADMIN'
    const setupUrl = `/admin/platforms/setup?iss=${encodeURIComponent(params.iss)}&login_hint=${encodeURIComponent(params.loginHint)}&target_link_uri=${encodeURIComponent(params.targetLinkUri)}&lti_message_hint=${encodeURIComponent(params.ltiMessageHint || '')}`

    const adminActionHtml = `
      <p>If you are an administrator, you can set up this platform to enable the launch.</p>
      <a href="${setupUrl}">Set up Platform</a>
    `

    const nonAdminActionHtml = `
      <p>Please contact your system administrator to configure and register this platform in EGP Broker.</p>
    `

    // Returning a small HTML page is more reliable than a 302 redirect inside an LMS iframe
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>LTI Setup Required</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
            .card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; border: 1px solid #e5e7eb; }
            h1 { font-size: 1.25rem; margin-bottom: 1rem; }
            p { font-size: 0.875rem; color: #4b5563; margin-bottom: 1.5rem; line-height: 1.5; }
            a { display: inline-block; background: #2563eb; color: white; padding: 0.625rem 1.25rem; border-radius: 0.375rem; text-decoration: none; font-weight: 500; font-size: 0.875rem; }
            .iss { font-family: monospace; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; word-break: break-all; margin: 1rem 0; display: block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>LTI Platform Not Registered</h1>
            <p>The platform with the following issuer is not registered in EGP Broker:</p>
            <span class="iss">${params.iss}</span>
            ${isAdmin ? adminActionHtml : nonAdminActionHtml}
          </div>
        </body>
      </html>
    `
  }

  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()

  console.log('--- OIDC INITIATION ---')
  console.log('Generated State:', state)

  // Store security values in session to verify during /launch
  await setUserSession(event, {
    lti: {
      state,
      nonce,
      issuer: params.iss,
      targetLinkUri: params.targetLinkUri
    }
  })

  // Verify the session was written immediately
  const sessionCheck = await getUserSession(event)
  console.log('Session Verify after Write:', !!sessionCheck.lti)

  const redirectUrl = createLtiLoginUrl(
    platform.authEndpoint,
    platform.clientId,
    `${process.env.NUXT_SITE_URL}/api/lti13/launch`,
    params.loginHint,
    params.ltiMessageHint || '',
    nonce,
    state
  )

  return sendRedirect(event, redirectUrl)
}

/**
 * Generates the OIDC Auth Request URL
 */
export function createLtiLoginUrl(
  authEndpoint: string,
  clientId: string,
  redirectUri: string,
  loginHint: string,
  ltiMessageHint: string,
  nonce: string,
  state: string
): string {
  const url = new URL(authEndpoint)
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('response_type', 'id_token')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('login_hint', loginHint)
  url.searchParams.set('lti_message_hint', ltiMessageHint)
  url.searchParams.set('nonce', nonce)
  url.searchParams.set('state', state)
  url.searchParams.set('response_mode', 'form_post')
  // REQUIRED for Canvas to avoid "missing prompt" errors
  url.searchParams.set('prompt', 'none')
  return url.toString()
}

/**
 * Validates an LTI 1.3 ID Token
 */
export async function verifyLtiToken(
  idToken: string,
  jwksUrl: string,
  clientId: string,
  issuer: string
): Promise<any> {
  const JWKS = createRemoteJWKSet(new URL(jwksUrl))
  const { payload } = await jwtVerify(idToken, JWKS, {
    audience: clientId,
    issuer: issuer
  })
  return payload
}

export function getIframeCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    path: '/'
  }
}
