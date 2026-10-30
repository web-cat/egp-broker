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

/**
 * Normalizes a PassPort extension URL.
 * Web-CAT uses Apple/NeXT WebObjects DirectActions (/wa/passport/extension) rather than REST (/v1/extension).
 * Normalizes any Web-CAT URLs containing /wa/passport/v1/extension(s) to /wa/passport/extension.
 */
export function normalizePassPortExtensionUrl(url: string): string {
  const trimmed = url.trim()
  return trimmed.replace(/\/wa\/passport\/v1\/extensions?/, '/wa/passport/extension')
}

/**
 * Normalizes a PassPort status URL.
 * Web-CAT uses Apple/NeXT WebObjects DirectActions (/wa/passport/status) rather than REST (/v1/status).
 * Normalizes any Web-CAT URLs containing /wa/passport/v1/status to /wa/passport/status.
 */
export function normalizePassPortStatusUrl(url: string): string {
  const trimmed = url.trim()
  return trimmed.replace(/\/wa\/passport\/v1\/status/, '/wa/passport/status')
}

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
  passport_version: z.enum(['1.0', '1.1', '1.2'])
})

export type PassPortPhase1Request = z.infer<typeof passPortPhase1RequestSchema>

/**
 * Phase 2: Credential Delivery (Tool -> Broker Callback)
 * Method: POST
 * Endpoint: /api/passport/v1/credentials?token=<cuid>
 */
export const passPortPhase2CredentialsSchema = z.object({
  tool_name: z.string().min(1, 'tool_name is required'),
  passport_version: z.enum(['1.0', '1.1', '1.2']),
  endpoints: z.object({
    extension_handler: z.string().url('extension_handler must be a valid URL'),
    status_handler: z.string().url('status_handler must be a valid URL').optional()
  }),
  requested_properties: z.array(z.string()).optional().default([]),
  credentials: z.object({
    client_id: z.string().min(1, 'client_id is required'),
    client_secret: z.string().min(1, 'client_secret is required')
  })
})

export type PassPortPhase2Credentials = z.infer<typeof passPortPhase2CredentialsSchema>

export const passPortCredentialsQuerySchema = z.object({
  token: z.string().min(1, 'Registration token is required')
})

export type PassPortCredentialsQuery = z.infer<typeof passPortCredentialsQuerySchema>

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
  original_available_from: z.string().nullish().default(null),
  new_available_from: z.string().nullish().default(null),
  original_due_date: z.string().nullish().default(null),
  new_due_date: z.string().nullish().default(null),
  original_accept_until: z.string().nullish().default(null),
  new_accept_until: z.string().nullish().default(null),
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

// =============================================================================
// SUBMISSION STATUS QUERY SCHEMAS (PassPort v1.2)
// =============================================================================

/**
 * Submission Status Query Request (Broker -> Tool status_handler)
 * Method: POST
 * Endpoint: [Tool_Status_Handler]
 */
export const passPortStatusPayloadSchema = z.object({
  context: passPortContextSchema,
  user: passPortUserSchema,
  resource: passPortResourceSchema
})

export type PassPortStatusPayload = z.infer<typeof passPortStatusPayloadSchema>

/**
 * Individual Submission Item returned in PassPort v1.2 status responses
 */
export const passPortSubmissionItemSchema = z.object({
  timestamp: z.string().nullish().default(null),
  submission_number: z.number().int().nullish().default(null),
  submit_number: z.number().int().nullish().default(null),
  total_score: z.number().nullish().default(null),
  ta_score: z.number().nullish().default(null),
  staff_notice: z.string().nullish().default(null),
  feedback_url: z.string().nullish().default(null),
  view_url: z.string().nullish().default(null),
  student_view_url: z.string().nullish().default(null),
  direct_url_feedback: z.string().nullish().default(null),
  grading_url: z.string().nullish().default(null),
  edit_url: z.string().nullish().default(null),
  grader_view_url: z.string().nullish().default(null),
  direct_url_grading: z.string().nullish().default(null)
})

export type PassPortSubmissionItem = z.infer<typeof passPortSubmissionItemSchema>

/**
 * PassPort v1.2 Status Response
 */
export const passPortStatusResponseSchema = z.object({
  status: z.string(),
  submission_for_grading: passPortSubmissionItemSchema.nullable().default(null),
  most_recent_submission: passPortSubmissionItemSchema.nullish().default(null)
})

export type PassPortStatusResponse = z.infer<typeof passPortStatusResponseSchema>

/**
 * Cached submission status stored in GtaInterviewReservation.submissionStatus
 */
export const cachedSubmissionStatusSchema = z.object({
  latestSubmissionUrl: z.string().nullable().default(null),
  latestSubmissionNumber: z.number().int().nullable().default(null),
  latestTotalScore: z.number().nullable().default(null),
  latestTaScore: z.number().nullable().default(null),
  gradingSubmissionUrl: z.string().nullable().default(null),
  gradingSubmissionNumber: z.number().int().nullable().default(null),
  gradingTotalScore: z.number().nullable().default(null),
  gradingTaScore: z.number().nullable().default(null),
  staffNotice: z.string().nullable().default(null),
  raw: passPortStatusResponseSchema.optional()
})

export type CachedSubmissionStatus = z.infer<typeof cachedSubmissionStatusSchema>

/**
 * Resolves the preferred action URL for staff graders from a submission item.
 * Prioritizes staff grading view, falling back to student feedback view.
 */
export function resolveStaffSubmissionUrl(
  item: PassPortSubmissionItem | null | undefined
): string | null {
  if (!item) return null
  return (
    item.grading_url ||
    item.direct_url_grading ||
    item.edit_url ||
    item.grader_view_url ||
    item.feedback_url ||
    item.direct_url_feedback ||
    item.view_url ||
    item.student_view_url ||
    null
  )
}

/**
 * Normalizes a PassPort v1.2 status response into a CachedSubmissionStatus object.
 */
export function toCachedSubmissionStatus(res: PassPortStatusResponse): CachedSubmissionStatus {
  const gradingItem = res.submission_for_grading
  const mostRecentItem = res.most_recent_submission

  // If most_recent_submission is provided, that is the latest submission.
  // Otherwise, submission_for_grading IS the latest submission.
  const latestItem = mostRecentItem || gradingItem

  const latestUrl = resolveStaffSubmissionUrl(latestItem)
  const latestNum = latestItem?.submission_number ?? latestItem?.submit_number ?? null

  // If most_recent_submission is present and different, gradingSubmissionUrl is separate
  let gradingUrl: string | null = null
  let gradingNum: number | null = null
  let gradingTotalScore: number | null = null
  let gradingTaScore: number | null = null

  if (mostRecentItem && gradingItem) {
    gradingUrl = resolveStaffSubmissionUrl(gradingItem)
    gradingNum = gradingItem.submission_number ?? gradingItem.submit_number ?? null
    gradingTotalScore = gradingItem.total_score ?? null
    gradingTaScore = gradingItem.ta_score ?? null
  }

  // Staff notice can be present on gradingItem or mostRecentItem
  const staffNotice = latestItem?.staff_notice || gradingItem?.staff_notice || null

  return {
    latestSubmissionUrl: latestUrl,
    latestSubmissionNumber: latestNum,
    latestTotalScore: latestItem?.total_score ?? null,
    latestTaScore: latestItem?.ta_score ?? null,
    gradingSubmissionUrl: gradingUrl,
    gradingSubmissionNumber: gradingNum,
    gradingTotalScore,
    gradingTaScore,
    staffNotice,
    raw: res
  }
}
