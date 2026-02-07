import { createRemoteJWKSet, jwtVerify } from 'jose'
import { CourseRole } from '@prisma/client'

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

export interface LtiLaunchClaims {
  iss: string
  sub: string
  aud: string
  iat: number
  exp: number
  nonce: string
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': string
  'https://purl.imsglobal.org/spec/lti/claim/message_type': string
  'https://purl.imsglobal.org/spec/lti/claim/version': string
  'https://purl.imsglobal.org/spec/lti/claim/roles'?: string[]
  'https://purl.imsglobal.org/spec/lti/claim/context'?: {
    id: string
    label?: string
    title?: string
    type?: string[]
  }
  'https://purl.imsglobal.org/spec/lti/claim/resource_link'?: {
    id: string
    title?: string
  }
  'https://purl.imsglobal.org/spec/lti/claim/custom'?: Record<string, any>
  'https://purl.imsglobal.org/spec/lti/claim/tool_platform'?: {
    guid: string
    contact_email?: string
    description?: string
    name?: string
    url?: string
    product_family_code?: string
    version?: string
  }
  'https://canvas.instructure.com/lti/legacy_user_id'?: string | number
  email?: string
  name?: string
  given_name?: string
  family_name?: string
}

/**
 * Validates an LTI 1.3 ID Token
 */
export async function verifyLtiToken(
  idToken: string,
  jwksUrl: string,
  clientId: string,
  issuer: string
): Promise<LtiLaunchClaims> {
  const JWKS = createRemoteJWKSet(new URL(jwksUrl))

  const { payload } = await jwtVerify(idToken, JWKS, {
    audience: clientId,
    issuer: issuer
  })

  return payload as unknown as LtiLaunchClaims
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
  return url.toString()
}

/**
 * Helper to generate a session cookie configuration for iframe support
 */
export function getIframeCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    path: '/'
  }
}
