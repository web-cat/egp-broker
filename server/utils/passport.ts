import { randomUUID, createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import { getServerSiteUrl } from '@@/server/utils/site'
import { toToolRow } from '@@/server/utils/lti-tools'
import type { ToolRow } from '@@/shared/models/tool'
import type {
  PassPortPhase1Request,
  PassPortExtensionPayload,
  PassPortRollbackPayload
} from '@@/shared/models/passport'
import {
  passPortPhase2CredentialsSchema,
  passPortExtensionPayloadSchema,
  passPortRollbackPayloadSchema
} from '@@/shared/models/passport'

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
    passport_version: '1.1'
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

/**
 * Signs a PassPort payload using HMAC-SHA256 with the shared client_secret.
 */
export function signPassPortRequest(
  secret: string,
  body: unknown,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp ?? Math.floor(Date.now() / 1000)
  const message = typeof body === 'string' ? body : JSON.stringify(body)
  const signature = createHmac('sha256', secret).update(message).digest('hex')
  return { signature, timestamp: ts }
}

export interface BuildPassPortExtensionParams {
  context: {
    lmsInstanceGuid: string
    issuer: string
    ltiContextId: string
    lmsInstance?: string | null
    ltiDeploymentId?: string | null
    canvasCourseId?: string | number | null
  }
  user: {
    ltiUserId: string
    brokerUserId?: string | null
    canvasUserId?: string | number | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    displayName?: string | null
    courseRole?: string | null
  }
  resource: {
    ltiResourceLinkId: string
    brokerAssignmentId?: string | null
    canvasAssignmentId?: string | number | null
    title?: string | null
    externalUrl?: string | null
  }
  extension: {
    passType: string
    originalAvailableFrom?: string | Date | null
    newAvailableFrom?: string | Date | null
    originalDueDate?: string | Date | null
    newDueDate?: string | Date | null
    originalAcceptUntil?: string | Date | null
    newAcceptUntil?: string | Date | null
    appliedAt?: string | Date | null
  }
  requestedProperties?: string[] | null
  requestId?: string
}

function toIsoOrNull(val?: string | Date | null): string | null {
  if (!val) return null
  return val instanceof Date ? val.toISOString() : val
}

/**
 * Builds a compliant PassPort extension payload, strictly filtering optional
 * properties according to the tool's requested_properties list.
 */
export function buildPassPortExtensionPayload(
  params: BuildPassPortExtensionParams
): PassPortExtensionPayload {
  const reqProps = new Set(params.requestedProperties || [])

  // Context: mandatory baseline + optional requested
  const context: Record<string, any> = {
    lms_instance_guid: params.context.lmsInstanceGuid,
    issuer: params.context.issuer,
    lti_context_id: params.context.ltiContextId
  }
  if (reqProps.has('lms_instance') && params.context.lmsInstance) {
    context.lms_instance = params.context.lmsInstance
  }
  if (reqProps.has('lti_deployment_id') && params.context.ltiDeploymentId) {
    context.lti_deployment_id = params.context.ltiDeploymentId
  }
  if (reqProps.has('canvas_course_id') && params.context.canvasCourseId != null) {
    context.canvas_course_id = String(params.context.canvasCourseId)
  }

  // User: mandatory baseline + optional requested
  const user: Record<string, any> = {
    lti_user_id: params.user.ltiUserId
  }
  if (reqProps.has('broker_user_id') && params.user.brokerUserId) {
    user.broker_user_id = params.user.brokerUserId
  }
  if (reqProps.has('canvas_user_id') && params.user.canvasUserId != null) {
    user.canvas_user_id = String(params.user.canvasUserId)
  }
  if (reqProps.has('first_name') && params.user.firstName) {
    user.first_name = params.user.firstName
  }
  if (reqProps.has('last_name') && params.user.lastName) {
    user.last_name = params.user.lastName
  }
  if (reqProps.has('email') && params.user.email) {
    user.email = params.user.email
  }
  if (reqProps.has('display_name') && params.user.displayName) {
    user.display_name = params.user.displayName
  }
  if (reqProps.has('course_role') && params.user.courseRole) {
    user.course_role = params.user.courseRole
  }

  // Resource: mandatory baseline + optional requested
  const resource: Record<string, any> = {
    lti_resource_link_id: params.resource.ltiResourceLinkId
  }
  if (reqProps.has('broker_assignment_id') && params.resource.brokerAssignmentId) {
    resource.broker_assignment_id = params.resource.brokerAssignmentId
  }
  if (reqProps.has('canvas_assignment_id') && params.resource.canvasAssignmentId != null) {
    resource.canvas_assignment_id = String(params.resource.canvasAssignmentId)
  }
  if (reqProps.has('title') && params.resource.title) {
    resource.title = params.resource.title
  }
  if (reqProps.has('external_url') && params.resource.externalUrl) {
    resource.external_url = params.resource.externalUrl
  }

  // Extension: 3 dates (available_from, due_date, accept_until)
  const appliedAt = params.extension.appliedAt
    ? params.extension.appliedAt instanceof Date
      ? params.extension.appliedAt.toISOString()
      : params.extension.appliedAt
    : new Date().toISOString()

  const extension = {
    pass_type: params.extension.passType,
    original_available_from: toIsoOrNull(params.extension.originalAvailableFrom),
    new_available_from: toIsoOrNull(params.extension.newAvailableFrom),
    original_due_date: toIsoOrNull(params.extension.originalDueDate),
    new_due_date: toIsoOrNull(params.extension.newDueDate),
    original_accept_until: toIsoOrNull(params.extension.originalAcceptUntil),
    new_accept_until: toIsoOrNull(params.extension.newAcceptUntil),
    applied_at: appliedAt
  }

  const payload = {
    request_id: params.requestId || randomUUID(),
    context,
    user,
    resource,
    extension
  }

  return passPortExtensionPayloadSchema.parse(payload)
}

/**
 * Dispatches an HMAC-signed extension POST request to an external tool's extension_handler.
 */
export async function sendPassPortExtension(
  tool: {
    passportExtensionUrl?: string | null
    passportClientId?: string | null
    passportClientSecret?: string | null
  },
  payload: PassPortExtensionPayload
): Promise<void> {
  if (!tool.passportExtensionUrl) {
    throw new Error('Tool is missing passportExtensionUrl')
  }
  if (!tool.passportClientId || !tool.passportClientSecret) {
    throw new Error('Tool is missing PassPort credentials (clientId or clientSecret)')
  }

  const { signature, timestamp } = signPassPortRequest(tool.passportClientSecret, payload)

  await $fetch(tool.passportExtensionUrl, {
    method: 'POST',
    body: payload,
    headers: {
      'Content-Type': 'application/json',
      'X-PassPort-Client-ID': tool.passportClientId,
      'X-PassPort-Signature': signature,
      'X-PassPort-Timestamp': String(timestamp)
    },
    timeout: 10000
  })
}

/**
 * Dispatches an HMAC-signed rollback DELETE request to an external tool's extension_handler.
 */
export async function sendPassPortRollback(
  tool: {
    passportExtensionUrl?: string | null
    passportClientId?: string | null
    passportClientSecret?: string | null
  },
  requestId: string
): Promise<void> {
  if (!tool.passportExtensionUrl) {
    throw new Error('Tool is missing passportExtensionUrl')
  }
  if (!tool.passportClientId || !tool.passportClientSecret) {
    throw new Error('Tool is missing PassPort credentials (clientId or clientSecret)')
  }

  const payload: PassPortRollbackPayload = passPortRollbackPayloadSchema.parse({
    request_id: requestId
  })

  const { signature, timestamp } = signPassPortRequest(tool.passportClientSecret, payload)

  await $fetch(tool.passportExtensionUrl, {
    method: 'DELETE',
    body: payload,
    headers: {
      'Content-Type': 'application/json',
      'X-PassPort-Client-ID': tool.passportClientId,
      'X-PassPort-Signature': signature,
      'X-PassPort-Timestamp': String(timestamp)
    },
    timeout: 10000
  })
}
