/**
 * PassPort Protocol v1 Models & Schemas
 *
 * Universal Truths and Zod validation schemas for the PassPort Protocol v1
 * Cross-Platform Extension Management and Dynamic Registration Handshake.
 */

import { z } from 'zod'

// =============================================================================
// ENUMS & REGISTRATION STATUS
// =============================================================================

export const passPortRegistrationStatusSchema = z.enum([
  'NOT_REGISTERED',
  'PENDING',
  'REGISTERED',
  'FAILED'
])

export type PassPortRegistrationStatus = z.infer<typeof passPortRegistrationStatusSchema>

// =============================================================================
// DYNAMIC REGISTRATION SCHEMAS
// =============================================================================

/**
 * Phase 1: Registration Request (Broker -> Tool)
 * Method: POST
 * Endpoint: [Tool_Registered_URL]/api/passport/v1/register
 */
export const passPortPhase1RequestSchema = z.object({
  broker_base_url: z.string().url('broker_base_url must be a valid URL'),
  callback_url: z.string().url('callback_url must be a valid URL'),
  name: z.string().min(1, 'Broker name is required'),
  passport_version: z.literal('1.0')
})

export type PassPortPhase1Request = z.infer<typeof passPortPhase1RequestSchema>

/**
 * Phase 2: Credential Delivery (Tool -> Broker Callback)
 * Method: POST
 * Endpoint: /api/passport/v1/credentials?token=<cuid>
 */
export const passPortPhase2CredentialsSchema = z.object({
  tool_name: z.string().min(1, 'tool_name is required'),
  passport_version: z.literal('1.0'),
  endpoints: z.object({
    extension_handler: z.string().url('extension_handler must be a valid URL')
  }),
  requested_properties: z.array(z.string()).optional().default([]),
  credentials: z.object({
    client_id: z.string().min(1, 'client_id is required'),
    client_secret: z.string().min(1, 'client_secret is required')
  })
})

export type PassPortPhase2Credentials = z.infer<typeof passPortPhase2CredentialsSchema>

// =============================================================================
// EXTENSION DISPATCH SCHEMAS
// =============================================================================

export const passPortContextSchema = z.object({
  lms_instance_guid: z.string(),
  issuer: z.string(),
  lti_context_id: z.string(),
  lms_instance: z.string().optional(),
  lti_deployment_id: z.string().optional(),
  canvas_course_id: z.string().optional()
})

export const passPortUserSchema = z.object({
  lti_user_id: z.string(),
  broker_user_id: z.string().optional(),
  canvas_user_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  display_name: z.string().optional(),
  course_role: z.string().optional()
})

export const passPortResourceSchema = z.object({
  lti_resource_link_id: z.string(),
  broker_assignment_id: z.string().optional(),
  canvas_assignment_id: z.string().optional(),
  title: z.string().optional(),
  external_url: z.string().optional()
})

export const passPortExtensionDetailsSchema = z.object({
  pass_type: z.string(),
  original_due_date: z.string(),
  new_due_date: z.string(),
  applied_at: z.string()
})

/**
 * Extension Request (Broker -> Tool extension_handler)
 * Method: POST
 * Endpoint: [Tool_Extension_Handler]
 */
export const passPortExtensionPayloadSchema = z.object({
  request_id: z.string().uuid(),
  context: passPortContextSchema,
  user: passPortUserSchema,
  resource: passPortResourceSchema,
  extension: passPortExtensionDetailsSchema
})

export type PassPortExtensionPayload = z.infer<typeof passPortExtensionPayloadSchema>

/**
 * Rollback / Failure Recovery Request (Broker -> Tool extension_handler)
 * Method: DELETE
 * Endpoint: [Tool_Extension_Handler]
 */
export const passPortRollbackPayloadSchema = z.object({
  request_id: z.string().uuid()
})

export type PassPortRollbackPayload = z.infer<typeof passPortRollbackPayloadSchema>
