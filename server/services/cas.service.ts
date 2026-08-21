import prisma from '@@/server/utils/db'
import type { CasServer } from '@prisma/client'
import { getGravatarUrl } from '@@/server/utils/gravatar'

/**
 * CAS Service - Pure business logic for CAS authentication
 */

/**
 * Attributes returned by CAS ticket validation
 */
export interface CasAttributes {
  email?: string
  firstName?: string
  lastName?: string
  [key: string]: string | undefined
}

/**
 * Result of CAS ticket validation
 */
export interface CasValidationResult {
  username: string
  attributes: CasAttributes
}

/**
 * Build the CAS service (callback) URL for a given server ID
 */
export function buildCasServiceUrl(siteUrl: string, serverId: string): string {
  return `${siteUrl}/api/cas/callback?serverId=${encodeURIComponent(serverId)}`
}

/**
 * Build the CAS login redirect URL
 */
export function buildCasLoginUrl(casBaseUrl: string, serviceUrl: string): string {
  return `${casBaseUrl}/login?service=${encodeURIComponent(serviceUrl)}`
}

/**
 * Validate a CAS ticket against the CAS server
 *
 * @param ticket - The CAS ticket from the callback query string
 * @param serviceUrl - The service URL that was used for the login redirect
 * @param casServer - The CAS server configuration
 * @returns The validated CAS username and attributes
 */
export async function validateCasTicket(
  ticket: string,
  serviceUrl: string,
  casServer: CasServer
): Promise<CasValidationResult> {
  // Determine the validation endpoint based on protocol version
  const validatePath =
    casServer.serviceValidateVersion === '3.0' ? '/p3/serviceValidate' : '/serviceValidate'

  const validateUrl = `${casServer.baseUrl}${validatePath}?ticket=${encodeURIComponent(ticket)}&service=${encodeURIComponent(serviceUrl)}`

  const response = await $fetch<string>(validateUrl, {
    responseType: 'text'
  })

  return parseCasXmlResponse(response)
}

/**
 * Parse CAS XML validation response
 *
 * CAS 2.0/3.0 success response format:
 * <cas:serviceResponse>
 *   <cas:authenticationSuccess>
 *     <cas:user>username</cas:user>
 *     <cas:attributes>
 *       <cas:email>user@example.com</cas:email>
 *       ...
 *     </cas:attributes>
 *   </cas:authenticationSuccess>
 * </cas:serviceResponse>
 *
 * CAS failure response format:
 * <cas:serviceResponse>
 *   <cas:authenticationFailure code="INVALID_TICKET">
 *     Ticket not recognized
 *   </cas:authenticationFailure>
 * </cas:serviceResponse>
 */
export function parseCasXmlResponse(xml: string): CasValidationResult {
  // Check for authentication failure
  const failureMatch = xml.match(
    /<cas:authenticationFailure[^>]*>([\s\S]*?)<\/cas:authenticationFailure>/
  )
  if (failureMatch) {
    const message = failureMatch[1]?.trim() || 'CAS authentication failed'
    throw createError({
      statusCode: 401,
      statusMessage: message
    })
  }

  // Extract username
  const userMatch = xml.match(/<cas:user>([\s\S]*?)<\/cas:user>/)
  if (!userMatch || !userMatch[1]) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid CAS response: missing user'
    })
  }

  const username = userMatch[1].trim()

  // Extract attributes (CAS 3.0 or custom CAS 2.0 with attributes)
  const attributes: CasAttributes = {}
  const attributesBlock = xml.match(/<cas:attributes>([\s\S]*?)<\/cas:attributes>/)

  if (attributesBlock) {
    // Match all attribute tags within the attributes block
    const attrRegex = /<cas:(\w+)>([\s\S]*?)<\/cas:\1>/g
    let match
    while ((match = attrRegex.exec(attributesBlock[1]!)) !== null) {
      attributes[match[1]!] = match[2]!.trim()
    }
  }

  return { username, attributes }
}

/**
 * Find or create a local user from CAS authentication data.
 *
 * Strategy:
 * 1. Look up existing CasIdentity by (casServerId, casUsername)
 * 2. If not found, look up User by email (auto-link)
 * 3. If no user found, create a new User
 * 4. Create the CasIdentity linking the user to the CAS server
 */
export async function findOrCreateCasUser(
  casUsername: string,
  attributes: CasAttributes,
  casServerId: string
): Promise<PublicUser> {
  return await prisma.$transaction(async (tx) => {
    // 1. Check for existing CAS identity
    const existingIdentity = await tx.casIdentity.findUnique({
      where: {
        casServerId_casUsername: {
          casServerId,
          casUsername
        }
      },
      include: { user: true }
    })

    if (existingIdentity) {
      const { password: _, ...publicUser } = existingIdentity.user
      return publicUser
    }

    // 2. Try to find existing user by email (auto-link)
    let user
    const email = attributes.email || attributes.mail

    if (email) {
      user = await tx.user.findUnique({
        where: { email: email.toLowerCase() }
      })
    }

    // 3. Create new user if not found
    if (!user) {
      if (!email) {
        throw createError({
          statusCode: 400,
          statusMessage: 'CAS server did not provide an email address. Cannot create account.'
        })
      }

      user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          firstName: attributes.firstName || attributes.givenName || casUsername,
          lastName: attributes.lastName || attributes.sn || '',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          avatarUrl: getGravatarUrl(email)
          // password remains null — CAS-only user
        }
      })
    }

    // 4. Create CAS identity link
    await tx.casIdentity.create({
      data: {
        userId: user.id,
        casServerId,
        casUsername
      }
    })

    const { password: _, ...publicUser } = user
    return publicUser
  })
}
