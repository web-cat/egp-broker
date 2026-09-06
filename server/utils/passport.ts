import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import { getServerSiteUrl } from '@@/server/utils/site'
import { toToolRow } from '@@/server/utils/lti-tools'
import type { ToolRow } from '@@/shared/models/tool'
import type { PassPortPhase1Request } from '@@/shared/models/passport'
import { passPortPhase2CredentialsSchema } from '@@/shared/models/passport'

/**
 * Initiates the 2-Phase Dynamic Registration Handshake for an LtiTool.
 * Sends Phase 1 POST request to tool's passportRegistrationUrl with a tokenized callback URL.
 */
export async function initiatePassPortRegistration(
  toolId: string,
  event: H3Event
): Promise<ToolRow> {
  const tool = await prisma.ltiTool.findUnique({
    where: { id: toolId },
    include: { platform: { select: { issuer: true } } }
  })

  if (!tool) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tool not found'
    })
  }

  if (!tool.passportRegistrationUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tool is missing passportRegistrationUrl'
    })
  }

  const registrationToken = randomUUID()

  // Transition tool to PENDING state with unique callback token
  const pendingTool = await prisma.ltiTool.update({
    where: { id: toolId },
    data: {
      supportsPassport: true,
      passportRegistrationStatus: 'PENDING',
      passportRegistrationToken: registrationToken,
      passportRegistrationError: null
    },
    include: { platform: { select: { issuer: true } } }
  })

  const siteUrl = getServerSiteUrl(event)
  const payload: PassPortPhase1Request = {
    broker_base_url: siteUrl,
    callback_url: `${siteUrl}/api/passport/v1/credentials?token=${registrationToken}`,
    name: 'EGP Broker',
    passport_version: '1.0'
  }

  try {
    await $fetch(tool.passportRegistrationUrl, {
      method: 'POST',
      body: payload,
      timeout: 10000
    })

    return toToolRow(pendingTool)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.ltiTool.update({
      where: { id: toolId },
      data: {
        passportRegistrationStatus: 'FAILED',
        passportRegistrationError: message
      }
    })

    throw createError({
      statusCode: 502,
      statusMessage: `Failed to initiate registration with external tool: ${message}`
    })
  }
}

/**
 * Handles the Phase 2 credential delivery push from an external tool.
 * Validates the callback token and payload, updates tool credentials, and marks as REGISTERED.
 */
export async function handlePassPortCredentialsDelivery(
  token: string | undefined | null,
  body: unknown
): Promise<ToolRow> {
  if (!token || typeof token !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Registration token is required'
    })
  }

  const validated = passPortPhase2CredentialsSchema.parse(body)

  const tool = await prisma.ltiTool.findUnique({
    where: { passportRegistrationToken: token },
    include: { platform: { select: { issuer: true } } }
  })

  if (!tool || tool.passportRegistrationStatus !== 'PENDING') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid or expired registration token'
    })
  }

  const updatedTool = await prisma.ltiTool.update({
    where: { id: tool.id },
    data: {
      passportClientId: validated.credentials.client_id,
      passportClientSecret: validated.credentials.client_secret,
      passportExtensionUrl: validated.endpoints.extension_handler,
      passportRequestedProperties: (validated.requested_properties || []) as any,
      passportRegistrationStatus: 'REGISTERED',
      passportRegistrationError: null,
      passportRegisteredAt: new Date(),
      passportRegistrationToken: null
    },
    include: { platform: { select: { issuer: true } } }
  })

  return toToolRow(updatedTool)
}
